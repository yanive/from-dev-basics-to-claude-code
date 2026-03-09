import { describe, it, expect } from 'vitest';
import { parseIssueBody } from './issueParser.js';

const makeIssue = (body: string) => ({
  number: 42,
  title: 'Test issue',
  body,
  html_url: 'https://github.com/test/repo/issues/42',
  labels: ['bug', 'student-report'],
  created_at: '2026-01-01T00:00:00Z',
});

const fullBody = `## Student Bug Report

**Lesson:** lesson-1.5 — Working with Files (Section 3/8)
**Reported by:** alice (alice@example.com) (ID: abc-123)
**Date:** 2026-01-01

### Description
> The terminal doesn't accept my command.
> It says "command not found".

### Expected Behavior
> It should create the file.

---

### Auto-Gathered Context

**Current instruction:**
> Type \`touch myfile.txt\` to create a new file

**Validation rule:** \`command\` → \`touch myfile.txt\`

**Terminal History (last 30 lines):**
\`\`\`
$ touch myfile.txt
command not found: touch
\`\`\`

**Last command:** \`touch myfile.txt\`

**Filesystem State:**
\`\`\`json
{"home": {}}
\`\`\`

**Current directory:** \`/home\`

**Environment:**
- Browser: Chrome 120
- Screen: 1920x1080
- Theme: dark`;

describe('parseIssueBody', () => {
  it('parses a full bug report body', () => {
    const result = parseIssueBody(makeIssue(fullBody));

    expect(result.issueNumber).toBe(42);
    expect(result.issueUrl).toBe('https://github.com/test/repo/issues/42');
    expect(result.title).toBe('Test issue');
    expect(result.lessonId).toBe('lesson-1.5');
    expect(result.sectionIndex).toBe(3);
    expect(result.totalSections).toBe(8);
    expect(result.reporterEmail).toBe('alice@example.com');
    expect(result.reporterName).toBe('alice');
    expect(result.reporterUserId).toBe('abc-123');
    expect(result.lastCommand).toBe('touch myfile.txt');
    expect(result.cwd).toBe('/home');
    expect(result.browser).toBe('Chrome 120');
    expect(result.screenSize).toBe('1920x1080');
    expect(result.themeMode).toBe('dark');
  });

  it('parses description from quoted block', () => {
    const result = parseIssueBody(makeIssue(fullBody));
    expect(result.description).toContain("terminal doesn't accept");
    expect(result.description).toContain('command not found');
  });

  it('parses expected behavior', () => {
    const result = parseIssueBody(makeIssue(fullBody));
    expect(result.expectedBehavior).toBe('It should create the file.');
  });

  it('parses terminal history code block', () => {
    const result = parseIssueBody(makeIssue(fullBody));
    expect(result.terminalHistory).toContain('touch myfile.txt');
    expect(result.terminalHistory).toContain('command not found');
  });

  it('parses filesystem state code block', () => {
    const result = parseIssueBody(makeIssue(fullBody));
    expect(result.vfsState).toBe('{"home": {}}');
  });

  it('handles null body gracefully', () => {
    const result = parseIssueBody(makeIssue(null as any));
    expect(result.issueNumber).toBe(42);
    expect(result.description).toBe('');
    expect(result.lessonId).toBeNull();
    expect(result.reporterEmail).toBeNull();
  });

  it('handles empty body', () => {
    const result = parseIssueBody(makeIssue(''));
    expect(result.description).toBe('');
    expect(result.lessonId).toBeNull();
  });

  it('handles body with missing optional sections', () => {
    const minimalBody = `## Student Bug Report

**Lesson:** lesson-2.1 — Basics (Section 1/5)
**Reported by:** bob (ID: def-456)

### Description
> Something is broken`;

    const result = parseIssueBody(makeIssue(minimalBody));
    expect(result.lessonId).toBe('lesson-2.1');
    expect(result.sectionIndex).toBe(1);
    expect(result.totalSections).toBe(5);
    expect(result.reporterName).toBe('bob');
    expect(result.reporterEmail).toBeNull();
    expect(result.expectedBehavior).toBe('');
    expect(result.terminalHistory).toBeNull();
    expect(result.vfsState).toBeNull();
    expect(result.lastCommand).toBeNull();
    expect(result.cwd).toBeNull();
  });
});
