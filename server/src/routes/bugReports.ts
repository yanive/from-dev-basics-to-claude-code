import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth, blockIfImpersonating } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { sendBugSubmittedEmail } from '../lib/email.js';
import { recordAdminEvent } from '../lib/adminNotifications.js';

export const bugReportsRouter = Router();

const GITHUB_OWNER = 'itayshmool';
const GITHUB_REPO = 'from-dev-basics-to-claude-code';

// In-memory rate limiting: userId -> timestamps[]
const reportTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const timestamps = (reportTimestamps.get(userId) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW,
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    throw new AppError(429, 'Too many bug reports. Please try again later.');
  }
  timestamps.push(now);
  reportTimestamps.set(userId, timestamps);
}

const bugReportSchema = z.object({
  description: z.string().min(1).max(2000),
  expectedBehavior: z.string().max(2000).optional(),
  lessonId: z.string(),
  lessonTitle: z.string().optional(),
  sectionIndex: z.number().int().min(0),
  totalSections: z.number().int().min(1),
  instruction: z.string().optional(),
  validation: z.unknown().optional(),
  terminalHistory: z.array(z.object({
    type: z.enum(['input', 'output', 'error']),
    text: z.string(),
  })).optional(),
  lastCommand: z.string().optional(),
  vfsState: z.unknown().optional(),
  cwd: z.string().optional(),
  browser: z.string().optional(),
  screenSize: z.string().optional(),
  themeMode: z.string().optional(),
  turnstileToken: z.string().optional(),
});

async function verifyTurnstile(token: string, ip: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const data = await res.json() as { success: boolean; 'error-codes'?: string[] };
  if (!data.success) {
    console.warn('Turnstile verification failed:', data['error-codes']);
  }
  return data.success;
}

function formatIssueBody(data: z.infer<typeof bugReportSchema>, user: { id: string; username: string; email?: string | null }): string {
  const lines: string[] = [];

  lines.push('## Student Bug Report\n');
  lines.push(`**Lesson:** ${data.lessonId}${data.lessonTitle ? ` — ${data.lessonTitle}` : ''} (Section ${data.sectionIndex + 1}/${data.totalSections})`);
  lines.push(`**Reported by:** ${user.username}${user.email ? ` (${user.email})` : ''} (ID: ${user.id})`);
  lines.push(`**Date:** ${new Date().toISOString()}\n`);

  lines.push('### Description');
  lines.push(`> ${data.description.replace(/\n/g, '\n> ')}\n`);

  if (data.expectedBehavior) {
    lines.push('### Expected Behavior');
    lines.push(`> ${data.expectedBehavior.replace(/\n/g, '\n> ')}\n`);
  }

  lines.push('---\n');
  lines.push('### Auto-Gathered Context\n');

  if (data.instruction) {
    lines.push('**Current instruction:**');
    lines.push(`> ${data.instruction.replace(/\n/g, '\n> ')}\n`);
  }

  if (data.validation) {
    const val = data.validation as { type?: string; value?: unknown };
    lines.push(`**Validation rule:** \`${val.type || 'unknown'}\` → \`${typeof val.value === 'string' ? val.value : JSON.stringify(val.value)}\`\n`);
  }

  if (data.terminalHistory && data.terminalHistory.length > 0) {
    lines.push('**Terminal History (last 30 lines):**');
    lines.push('```');
    for (const line of data.terminalHistory) {
      lines.push(line.text);
    }
    lines.push('```\n');
  }

  if (data.lastCommand) {
    lines.push(`**Last command:** \`${data.lastCommand}\`\n`);
  }

  if (data.vfsState) {
    lines.push('**Filesystem State:**');
    lines.push('```json');
    lines.push(JSON.stringify(data.vfsState, null, 2));
    lines.push('```\n');
  }

  if (data.cwd) {
    lines.push(`**Current directory:** \`${data.cwd}\`\n`);
  }

  lines.push('**Environment:**');
  if (data.browser) lines.push(`- Browser: ${data.browser}`);
  if (data.screenSize) lines.push(`- Screen: ${data.screenSize}`);
  if (data.themeMode) lines.push(`- Theme: ${data.themeMode}`);

  return lines.join('\n');
}

bugReportsRouter.post('/', requireAuth, blockIfImpersonating, asyncHandler(async (req, res) => {
  const githubToken = process.env.GITHUB_PAT;
  if (!githubToken) {
    throw new AppError(503, 'Bug reporting is not configured on this server.');
  }

  const parsed = bugReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid bug report data.');
  }

  // Verify Turnstile CAPTCHA if token provided (before rate limit so failures don't count)
  if (process.env.TURNSTILE_SECRET_KEY && parsed.data.turnstileToken) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined) || req.socket.remoteAddress;
    const valid = await verifyTurnstile(parsed.data.turnstileToken, ip);
    if (!valid) {
      throw new AppError(403, 'CAPTCHA verification failed. Please try again.');
    }
  }

  const userId = req.user!.userId;
  checkRateLimit(userId);

  const [user] = await db.select({ id: users.id, username: users.username, email: users.email, displayName: users.displayName })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(401, 'User not found');

  const body = formatIssueBody(parsed.data, {
    id: user.id,
    username: user.username,
    email: user.email,
  });

  const title = `[Student Report] Lesson ${parsed.data.lessonId}: ${parsed.data.description.slice(0, 80)}`;

  const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      labels: ['bug', 'student-report'],
    }),
  });

  if (!ghRes.ok) {
    const err = await ghRes.text();
    console.error('GitHub API error:', ghRes.status, err);
    throw new AppError(502, 'Failed to create GitHub issue.');
  }

  const issue = await ghRes.json() as { number: number; html_url: string };

  // Fire-and-forget bug confirmation email
  if (user.email) {
    sendBugSubmittedEmail(user.id, user.email, user.displayName, issue.number).catch(() => {});
  }

  // Fire-and-forget admin notification
  recordAdminEvent('bug_report', {
    title,
    description: parsed.data.description,
    issueUrl: issue.html_url,
    reportedBy: user.displayName || user.username,
  }).catch(() => {});

  res.status(201).json({
    issueNumber: issue.number,
    issueUrl: issue.html_url,
  });
}));
