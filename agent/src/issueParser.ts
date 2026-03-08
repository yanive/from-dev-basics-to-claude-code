import type { ParsedBugReport } from './types.js';
import type { GitHubIssue } from './github.js';

export function parseIssueBody(issue: GitHubIssue): ParsedBugReport {
  const body = issue.body ?? '';

  return {
    issueNumber: issue.number,
    issueUrl: issue.html_url,
    title: issue.title,
    description: extractSection(body, 'Description'),
    expectedBehavior: extractSection(body, 'Expected Behavior'),
    lessonId: extractField(body, /\*\*Lesson:\*\*\s*(\S+)/),
    sectionIndex: extractNumber(body, /Section\s+(\d+)\//),
    totalSections: extractNumber(body, /Section\s+\d+\/(\d+)/),
    instruction: extractSection(body, 'Current instruction'),
    validation: extractField(body, /\*\*Validation rule:\*\*\s*(.+)/),
    terminalHistory: extractCodeBlock(body, 'Terminal History'),
    lastCommand: extractField(body, /\*\*Last command:\*\*\s*`([^`]+)`/),
    vfsState: extractCodeBlock(body, 'Filesystem State'),
    cwd: extractField(body, /\*\*Current directory:\*\*\s*`([^`]+)`/),
    reporterEmail: extractField(body, /\*\*Reported by:\*\*\s*\S+\s*\(([^)]+@[^)]+)\)/),
    reporterName: extractField(body, /\*\*Reported by:\*\*\s*(\S+)/),
    reporterUserId: extractField(body, /\(ID:\s*([^)]+)\)/),
    browser: extractField(body, /- Browser:\s*(.+)/),
    screenSize: extractField(body, /- Screen:\s*(.+)/),
    themeMode: extractField(body, /- Theme:\s*(.+)/),
  };
}

function extractField(body: string, regex: RegExp): string | null {
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

function extractNumber(body: string, regex: RegExp): number | null {
  const val = extractField(body, regex);
  if (val === null) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function extractSection(body: string, heading: string): string {
  // Matches "### Heading" or "**Heading:**" followed by quoted content
  const headingPattern = new RegExp(
    `(?:###\\s*${escapeRegex(heading)}|\\*\\*${escapeRegex(heading)}:?\\*\\*)\\s*\\n((?:>\\s*.+\\n?)+)`,
    'i'
  );
  const match = body.match(headingPattern);
  if (!match) return '';
  return match[1]
    .split('\n')
    .map(line => line.replace(/^>\s*/, ''))
    .join('\n')
    .trim();
}

function extractCodeBlock(body: string, label: string): string | null {
  const pattern = new RegExp(
    `\\*\\*${escapeRegex(label)}[^*]*\\*\\*[^\\n]*\\n\`\`\`[^\\n]*\\n([\\s\\S]*?)\`\`\``,
    'i'
  );
  const match = body.match(pattern);
  return match ? match[1].trim() : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
