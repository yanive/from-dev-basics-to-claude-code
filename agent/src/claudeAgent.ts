import { query } from '@anthropic-ai/claude-code';
import { config } from './config.js';
import { logger } from './logger.js';
import type { ParsedBugReport, InvestigationResult, FixResult } from './types.js';

export async function investigate(report: ParsedBugReport): Promise<InvestigationResult> {
  const prompt = buildInvestigationPrompt(report);

  logger.info(`Investigating issue #${report.issueNumber} via Claude Code (read-only)...`);

  let resultText = '';
  let costUsd = 0;

  for await (const message of query({
    prompt,
    options: {
      cwd: config.PROJECT_ROOT,
      allowedTools: ['Read', 'Glob', 'Grep'],
      model: 'sonnet',
    },
  })) {
    if (message.type === 'result') {
      costUsd = message.total_cost_usd;
      if (message.subtype === 'success') {
        resultText = message.result;
      }
    }
  }

  logger.info(`Investigation complete (cost: $${costUsd.toFixed(4)})`);

  return parseInvestigationResult(resultText);
}

export async function fix(
  report: ParsedBugReport,
  investigation: InvestigationResult,
): Promise<FixResult | null> {
  const prompt = buildFixPrompt(report, investigation);

  logger.info(`Fixing issue #${report.issueNumber} via Claude Code (write+git)...`);

  let resultText = '';
  let costUsd = 0;

  for await (const message of query({
    prompt,
    options: {
      cwd: config.PROJECT_ROOT,
      allowedTools: [
        'Read', 'Edit', 'Write', 'Glob', 'Grep',
        'Bash(git fetch *)', 'Bash(git checkout *)',
        'Bash(git add *)', 'Bash(git commit *)',
        'Bash(git push *)', 'Bash(git branch *)',
        'Bash(git diff *)', 'Bash(git status)',
      ],
      permissionMode: 'acceptEdits',
      model: 'sonnet',
    },
  })) {
    if (message.type === 'result') {
      costUsd = message.total_cost_usd;
      if (message.subtype === 'success') {
        resultText = message.result;
      }
    }
  }

  logger.info(`Fix complete (cost: $${costUsd.toFixed(4)})`);

  return parseFixResult(resultText);
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
    `1. Read the lesson JSON file at \`src/data/lessons/\` — find the file matching lesson ID "${report.lessonId}"`,
    `2. Read the relevant component code based on the section type and validation logic`,
    `3. Determine if this is a valid bug or a user misunderstanding`,
    `4. Identify which files would need to change if it is a bug`,
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
    `Set canAutoFix=true only if the fix is straightforward (e.g. typo in lesson JSON, wrong validation value, simple logic error).`,
    `Set canAutoFix=false for complex fixes, architectural issues, or things you're unsure about.`,
  );

  return parts.join('\n');
}

function buildFixPrompt(report: ParsedBugReport, investigation: InvestigationResult): string {
  const slug = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const branchName = `fix/issue-${report.issueNumber}-${slug}`;

  return [
    `You are fixing a confirmed bug in the "From Zero to Claude Code" training app.`,
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
    `1. Run: \`git fetch origin main && git checkout -b ${branchName} origin/main\``,
    `2. Read the affected files and implement the fix`,
    `3. Run: \`git add <changed files>\``,
    `4. Run: \`git commit -m "Fix #${report.issueNumber}: <concise description>"\``,
    `5. Run: \`git push -u origin ${branchName}\``,
    `6. Run: \`git checkout main\` (return to main branch)`,
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

function parseInvestigationResult(text: string): InvestigationResult {
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
  return json as unknown as InvestigationResult;
}

function parseFixResult(text: string): FixResult | null {
  const json = extractJsonBlock(text);
  if (!json) {
    logger.warn('Failed to parse fix result');
    return null;
  }
  return json as unknown as FixResult;
}

function extractJsonBlock(text: string): Record<string, unknown> | null {
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
