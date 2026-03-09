import { query } from '@anthropic-ai/claude-code';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import { config } from './config.js';
import { logger } from './logger.js';
import type { ParsedBugReport, InvestigationResult, FixResult } from './types.js';

// Zod schemas for validating Claude's JSON output
const investigationSchema = z.object({
  isValidBug: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string(),
  category: z.enum(['content', 'ui', 'logic', 'backend', 'unclear']),
  affectedFiles: z.array(z.string()),
  suggestedFix: z.string().nullable(),
  canAutoFix: z.boolean(),
});

const fixResultSchema = z.object({
  branchName: z.string(),
  commitMessage: z.string(),
  prTitle: z.string(),
  prBody: z.string(),
  changedFiles: z.array(z.string()),
});

export async function investigate(report: ParsedBugReport): Promise<InvestigationResult> {
  const prompt = buildInvestigationPrompt(report);

  logger.info(`Investigating issue #${report.issueNumber} via Claude Code (read-only)...`);

  let resultText = '';
  let costUsd = 0;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: config.PROJECT_ROOT,
        allowedTools: [
          'Read', 'Glob', 'Grep',
          'Bash(git log --oneline *)',
          'Bash(git show HEAD*)', 'Bash(git show origin/*)',
        ],
        model: 'sonnet',
      },
    })) {
      if (message.type === 'result') {
        costUsd = message.total_cost_usd;
        if (message.subtype === 'success') {
          resultText = message.result;
        } else {
          logger.error(`Investigation ended with subtype="${message.subtype}": ${JSON.stringify(message).slice(0, 500)}`);
        }
      }
    }
  } catch (err) {
    logger.error(`Claude Code investigation failed: ${err}`);
    return {
      isValidBug: true,
      confidence: 'low',
      explanation: `Claude Code investigation failed: ${err}. Routing to human review.`,
      category: 'unclear',
      affectedFiles: [],
      suggestedFix: null,
      canAutoFix: false,
    };
  }

  logger.info(`Investigation complete (cost: $${costUsd.toFixed(4)})`);

  return parseInvestigationResult(resultText);
}

export function buildBranchName(issueNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `fix/issue-${issueNumber}-${slug}`;
}

export async function fix(
  report: ParsedBugReport,
  investigation: InvestigationResult,
): Promise<FixResult | null> {
  const branchName = buildBranchName(report.issueNumber, report.title);
  const worktreeDir = path.join(config.PROJECT_ROOT, '.worktrees', `issue-${report.issueNumber}`);

  logger.info(`Fixing issue #${report.issueNumber} via Claude Code (worktree: ${worktreeDir})...`);

  // Create an isolated worktree so we never touch the main working tree
  try {
    execSync('git fetch origin main', { cwd: config.PROJECT_ROOT, stdio: 'pipe' });
    execSync(`git worktree add "${worktreeDir}" -b "${branchName}" origin/main`, {
      cwd: config.PROJECT_ROOT,
      stdio: 'pipe',
    });
  } catch (err) {
    logger.error(`Failed to create worktree for issue #${report.issueNumber}: ${err}`);
    return null;
  }

  let resultText = '';
  let costUsd = 0;

  try {
    const prompt = buildFixPrompt(report, investigation, branchName);

    for await (const message of query({
      prompt,
      options: {
        cwd: worktreeDir,
        allowedTools: [
          'Read', 'Edit', 'Write', 'Glob', 'Grep',
          'Bash(git add *)',
          'Bash(git commit *)',
          'Bash(git push -u origin fix/*)',
          'Bash(git diff *)',
          'Bash(git status)',
        ],
        permissionMode: 'acceptEdits',
        model: 'sonnet',
      },
    })) {
      if (message.type === 'result') {
        costUsd = message.total_cost_usd;
        if (message.subtype === 'success') {
          resultText = message.result;
        } else {
          logger.error(`Fix ended with subtype="${message.subtype}": ${JSON.stringify(message).slice(0, 500)}`);
        }
      }
    }

    logger.info(`Fix complete (cost: $${costUsd.toFixed(4)})`);

    const fixResult = parseFixResult(resultText, branchName);
    if (!fixResult) {
      logger.warn(`Fix for issue #${report.issueNumber} produced unparseable output. Branch "${branchName}" may have been pushed — check remote.`);
    }
    return fixResult;
  } finally {
    // Always clean up the worktree
    try {
      execSync(`git worktree remove "${worktreeDir}" --force`, {
        cwd: config.PROJECT_ROOT,
        stdio: 'pipe',
      });
    } catch {
      logger.warn(`Failed to remove worktree at ${worktreeDir} — clean up manually`);
    }
    // Remove the local branch (it's already pushed to remote if fix succeeded)
    try {
      execSync(`git branch -D "${branchName}"`, {
        cwd: config.PROJECT_ROOT,
        stdio: 'pipe',
      });
    } catch {
      // Branch may not exist locally if worktree creation failed
    }
  }
}

function buildInvestigationPrompt(report: ParsedBugReport): string {
  const parts: string[] = [
    `You are investigating a student bug report for the "From Zero to Claude Code" training app.`,
    ``,
    `## Bug Report`,
    `**Issue #${report.issueNumber}**: ${report.title}`,
    `**Lesson:** ${report.lessonId ?? 'unknown'}${report.sectionIndex !== null ? ` (Section ${report.sectionIndex}/${report.totalSections})` : ''}`,
    ``,
    `### Description`,
    report.description || '(no description)',
  ];

  if (report.expectedBehavior) {
    parts.push(``, `### Expected Behavior`, report.expectedBehavior);
  }

  if (report.instruction) {
    parts.push(``, `### Current Instruction`, report.instruction);
  }

  if (report.validation) {
    parts.push(``, `### Validation Rule`, report.validation);
  }

  if (report.terminalHistory) {
    parts.push(``, `### Terminal History`, '```', report.terminalHistory, '```');
  }

  if (report.lastCommand) {
    parts.push(``, `**Last command:** \`${report.lastCommand}\``);
  }

  if (report.vfsState) {
    parts.push(``, `### Filesystem State`, '```json', report.vfsState, '```');
  }

  parts.push(
    ``,
    `## Your Task`,
    ``,
    `1. First, check recent git history: run \`git log --oneline -20\` and look for commits that may have already fixed this issue. If a recent commit clearly addresses the reported problem, mark it as not a bug (already fixed).`,
    `2. Read the lesson JSON file at \`src/data/lessons/\` — find the file matching lesson ID "${report.lessonId}"`,
    `3. Read the relevant component code based on the section type and validation logic`,
    `4. Determine if this is a valid bug, a user misunderstanding, or already fixed in a recent commit`,
    `5. Identify which files would need to change if it is a bug`,
    ``,
    `## Response Format`,
    ``,
    `You MUST respond with a JSON block (wrapped in \`\`\`json ... \`\`\`) containing:`,
    `\`\`\`json`,
    `{`,
    `  "isValidBug": boolean,`,
    `  "confidence": "high" | "medium" | "low",`,
    `  "explanation": "human-readable summary of findings",`,
    `  "category": "content" | "ui" | "logic" | "backend" | "unclear",`,
    `  "affectedFiles": ["relative/path/to/file.ts"],`,
    `  "suggestedFix": "description of the fix" | null,`,
    `  "canAutoFix": boolean`,
    `}`,
    `\`\`\``,
    ``,
    `Set isValidBug=false if the bug was already fixed in a recent commit — explain which commit fixed it.`,
    `Set canAutoFix=true only if the fix is straightforward (e.g. typo in lesson JSON, wrong validation value, simple logic error).`,
    `Set canAutoFix=false for complex fixes, architectural issues, or things you're unsure about.`,
  );

  return parts.join('\n');
}

function buildFixPrompt(report: ParsedBugReport, investigation: InvestigationResult, branchName: string): string {
  return [
    `You are fixing a confirmed bug in the "From Zero to Claude Code" training app.`,
    `You are working in an isolated git worktree. The branch "${branchName}" is already checked out.`,
    ``,
    `## Bug Report (Issue #${report.issueNumber})`,
    report.description || '(no description)',
    ``,
    `## Investigation Findings`,
    `**Category:** ${investigation.category}`,
    `**Explanation:** ${investigation.explanation}`,
    `**Affected files:** ${investigation.affectedFiles.join(', ')}`,
    `**Suggested fix:** ${investigation.suggestedFix ?? 'none provided'}`,
    ``,
    `## Your Task`,
    ``,
    `1. Read the affected files and implement the fix`,
    `2. Run: \`git add <changed files>\``,
    `3. Run: \`git commit -m "Fix #${report.issueNumber}: <concise description>"\``,
    `4. Run: \`git push -u origin ${branchName}\``,
    ``,
    `Do NOT run git checkout or git fetch — you are already on the correct branch.`,
    ``,
    `## Response Format`,
    ``,
    `After completing all steps, respond with a JSON block:`,
    `\`\`\`json`,
    `{`,
    `  "branchName": "${branchName}",`,
    `  "commitMessage": "the commit message you used",`,
    `  "prTitle": "Fix: concise title for the PR",`,
    `  "prBody": "markdown description of what was changed and why",`,
    `  "changedFiles": ["list", "of", "changed", "files"]`,
    `}`,
    `\`\`\``,
  ].join('\n');
}

export function parseInvestigationResult(text: string): InvestigationResult {
  const json = extractJsonBlock(text);
  if (!json) {
    logger.warn('Failed to parse investigation result, defaulting to needs-review');
    return {
      isValidBug: true,
      confidence: 'low',
      explanation: 'Investigation returned unparseable output. Routing to human review.',
      category: 'unclear',
      affectedFiles: [],
      suggestedFix: null,
      canAutoFix: false,
    };
  }

  const parsed = investigationSchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    logger.warn(`Investigation result failed validation (${errors}), defaulting to needs-review`);
    return {
      isValidBug: true,
      confidence: 'low',
      explanation: `Investigation returned invalid structure (${errors}). Routing to human review.`,
      category: 'unclear',
      affectedFiles: [],
      suggestedFix: null,
      canAutoFix: false,
    };
  }

  return parsed.data;
}

export function parseFixResult(text: string, branchName: string): FixResult | null {
  const json = extractJsonBlock(text);
  if (!json) {
    logger.warn(`Failed to parse fix result for branch "${branchName}"`);
    return null;
  }

  const parsed = fixResultSchema.safeParse(json);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    logger.warn(`Fix result failed validation (${errors}) for branch "${branchName}"`);
    return null;
  }

  return parsed.data;
}

export function extractJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!match) {
    // Try parsing the entire text as JSON
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
