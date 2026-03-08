import { Router } from 'express';
import { z } from 'zod';
import { desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { triageRuns, triageIssues } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { sendAndLog } from '../lib/email.js';
import { recordAdminEvent } from '../lib/adminNotifications.js';
import {
  triageFixCreatedTemplate,
  triageNeedsReviewTemplate,
  triageNotABugTemplate,
  triageAdminDigestTemplate,
  type TriageDigestIssue,
} from '../lib/emailTemplates.js';

export const triageRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/admin/triage/runs — called by the local agent after each cycle
// Auth: Bearer <GITHUB_PAT> (not JWT — the agent doesn't have a user session)
// ---------------------------------------------------------------------------

const issueSchema = z.object({
  issueNumber: z.number(),
  issueUrl: z.string(),
  title: z.string(),
  decision: z.enum(['auto-fixed', 'needs-review', 'not-a-bug']),
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string(),
  reporterEmail: z.string().nullable(),
  reporterName: z.string().nullable(),
  branchName: z.string().nullable(),
  prUrl: z.string().nullable(),
  prNumber: z.number().nullable(),
  changedFiles: z.array(z.string()),
  costUsd: z.number(),
});

const postRunSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string(),
  dryRun: z.boolean(),
  issues: z.array(issueSchema),
});

function requireGitHubPAT(req: { headers: { authorization?: string } }, _res: unknown, next: () => void) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) throw new AppError(500, 'Server GITHUB_PAT not configured');

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Missing authorization');

  if (header.slice(7) !== pat) throw new AppError(401, 'Invalid token');
  next();
}

triageRouter.post('/runs', requireGitHubPAT as any, asyncHandler(async (req, res) => {
  const body = postRunSchema.parse(req.body);

  const autoFixed = body.issues.filter(i => i.decision === 'auto-fixed').length;
  const needsReview = body.issues.filter(i => i.decision === 'needs-review').length;
  const notABug = body.issues.filter(i => i.decision === 'not-a-bug').length;
  const totalCost = body.issues.reduce((sum, i) => sum + i.costUsd, 0);

  // Insert run
  const [run] = await db.insert(triageRuns).values({
    startedAt: new Date(body.startedAt),
    finishedAt: new Date(body.finishedAt),
    issuesProcessed: body.issues.length,
    autoFixed,
    needsReview,
    notABug,
    errors: 0,
    totalCostUsd: totalCost.toFixed(4),
    dryRun: body.dryRun,
  }).returning({ id: triageRuns.id });

  // Insert issues
  for (const issue of body.issues) {
    await db.insert(triageIssues).values({
      runId: run.id,
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      title: issue.title,
      decision: issue.decision,
      confidence: issue.confidence,
      explanation: issue.explanation,
      reporterEmail: issue.reporterEmail,
      reporterName: issue.reporterName,
      prNumber: issue.prNumber,
      prUrl: issue.prUrl,
      changedFiles: issue.changedFiles,
      costUsd: issue.costUsd.toFixed(4),
    });
  }

  // Send reporter emails (best-effort, never block response)
  if (!body.dryRun) {
    for (const issue of body.issues) {
      if (!issue.reporterEmail || !issue.reporterName) continue;
      try {
        let html: string;
        let subject: string;
        switch (issue.decision) {
          case 'auto-fixed':
            subject = `Fix created for your bug report #${issue.issueNumber}`;
            html = triageFixCreatedTemplate(issue.reporterName, issue.issueNumber, issue.prUrl ?? issue.issueUrl);
            break;
          case 'needs-review':
            subject = `Bug report #${issue.issueNumber} confirmed`;
            html = triageNeedsReviewTemplate(issue.reporterName, issue.issueNumber);
            break;
          case 'not-a-bug':
            subject = `Bug report #${issue.issueNumber} reviewed`;
            html = triageNotABugTemplate(issue.reporterName, issue.issueNumber, issue.explanation);
            break;
        }
        await sendAndLog({
          emailType: `triage_${issue.decision}`,
          to: issue.reporterEmail,
          subject,
          html,
        });
      } catch (err) {
        console.error(`Failed to email reporter for issue #${issue.issueNumber}:`, err);
      }
    }

    // Send admin digest via the existing admin notification system
    if (body.issues.length > 0) {
      try {
        const digestIssues: TriageDigestIssue[] = body.issues.map(i => ({
          issueNumber: i.issueNumber,
          title: i.title,
          decision: i.decision,
          confidence: i.confidence,
          prUrl: i.prUrl,
        }));
        const html = triageAdminDigestTemplate(digestIssues, {
          autoFixed,
          needsReview,
          notABug,
          errors: 0,
          totalCost: totalCost.toFixed(2),
        });
        await recordAdminEvent('triage_run', {
          subject: `Triage: ${body.issues.length} issue${body.issues.length === 1 ? '' : 's'} processed`,
          html,
          issueCount: body.issues.length,
          autoFixed,
          needsReview,
          notABug,
        });
      } catch (err) {
        console.error('Failed to send admin triage digest:', err);
      }
    }
  }

  res.json({ ok: true, runId: run.id });
}));

// ---------------------------------------------------------------------------
// GET /api/admin/triage/runs — admin page: list runs
// Auth: admin JWT
// ---------------------------------------------------------------------------

triageRouter.get('/runs', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const runs = await db.select().from(triageRuns)
    .orderBy(desc(triageRuns.createdAt))
    .limit(limit)
    .offset(offset);

  // For each run, fetch issues
  const result = await Promise.all(runs.map(async (run) => {
    const issues = await db.select().from(triageIssues)
      .where(sql`${triageIssues.runId} = ${run.id}`)
      .orderBy(triageIssues.issueNumber);
    return { ...run, issues };
  }));

  res.json(result);
}));

// ---------------------------------------------------------------------------
// GET /api/admin/triage/stats — admin page: aggregate stats
// Auth: admin JWT
// ---------------------------------------------------------------------------

triageRouter.get('/stats', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const [totals] = await db.select({
    totalRuns: sql<number>`count(*)::int`,
    totalIssues: sql<number>`coalesce(sum(${triageRuns.issuesProcessed}), 0)::int`,
    totalAutoFixed: sql<number>`coalesce(sum(${triageRuns.autoFixed}), 0)::int`,
    totalNeedsReview: sql<number>`coalesce(sum(${triageRuns.needsReview}), 0)::int`,
    totalNotABug: sql<number>`coalesce(sum(${triageRuns.notABug}), 0)::int`,
    totalErrors: sql<number>`coalesce(sum(${triageRuns.errors}), 0)::int`,
    totalCostUsd: sql<string>`coalesce(sum(${triageRuns.totalCostUsd}), 0)::text`,
  }).from(triageRuns);

  const [lastRun] = await db.select({
    finishedAt: triageRuns.finishedAt,
  }).from(triageRuns).orderBy(desc(triageRuns.finishedAt)).limit(1);

  res.json({
    ...totals,
    lastRunAt: lastRun?.finishedAt ?? null,
  });
}));
