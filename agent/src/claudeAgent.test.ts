import { describe, it, expect } from 'vitest';
import { extractJsonBlock, parseInvestigationResult, parseFixResult, buildBranchName } from './claudeAgent.js';

describe('extractJsonBlock', () => {
  it('extracts JSON from a fenced code block', () => {
    const text = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
    expect(extractJsonBlock(text)).toEqual({ key: 'value' });
  });

  it('extracts JSON with nested objects', () => {
    const text = '```json\n{"a": {"b": [1, 2, 3]}, "c": true}\n```';
    expect(extractJsonBlock(text)).toEqual({ a: { b: [1, 2, 3] }, c: true });
  });

  it('falls back to parsing entire text as JSON', () => {
    const text = '{"key": "value"}';
    expect(extractJsonBlock(text)).toEqual({ key: 'value' });
  });

  it('returns null for non-JSON text', () => {
    expect(extractJsonBlock('just some random text')).toBeNull();
  });

  it('returns null for invalid JSON in code block', () => {
    const text = '```json\n{invalid json}\n```';
    expect(extractJsonBlock(text)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractJsonBlock('')).toBeNull();
  });

  it('extracts first JSON block when multiple exist', () => {
    const text = '```json\n{"first": true}\n```\n```json\n{"second": true}\n```';
    expect(extractJsonBlock(text)).toEqual({ first: true });
  });

  it('handles multiline JSON in code block', () => {
    const text = '```json\n{\n  "isValidBug": true,\n  "confidence": "high"\n}\n```';
    expect(extractJsonBlock(text)).toEqual({ isValidBug: true, confidence: 'high' });
  });
});

describe('parseInvestigationResult', () => {
  it('parses a valid investigation result', () => {
    const text = '```json\n' + JSON.stringify({
      isValidBug: true,
      confidence: 'high',
      explanation: 'Found the bug in lesson JSON',
      category: 'content',
      affectedFiles: ['src/data/lessons/level1/lesson-1.5.json'],
      suggestedFix: 'Fix the validation rule',
      canAutoFix: true,
    }) + '\n```';

    const result = parseInvestigationResult(text);
    expect(result.isValidBug).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.category).toBe('content');
    expect(result.canAutoFix).toBe(true);
    expect(result.affectedFiles).toEqual(['src/data/lessons/level1/lesson-1.5.json']);
  });

  it('returns safe fallback for unparseable text', () => {
    const result = parseInvestigationResult('no json here');
    expect(result.isValidBug).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.canAutoFix).toBe(false);
    expect(result.category).toBe('unclear');
  });

  it('returns safe fallback for invalid schema (wrong types)', () => {
    const text = '```json\n' + JSON.stringify({
      isValidBug: 'yes',  // should be boolean
      confidence: 'high',
      explanation: 'test',
      category: 'content',
      affectedFiles: [],
      suggestedFix: null,
      canAutoFix: true,
    }) + '\n```';

    const result = parseInvestigationResult(text);
    expect(result.isValidBug).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.canAutoFix).toBe(false);
  });

  it('returns safe fallback for missing required fields', () => {
    const text = '```json\n' + JSON.stringify({
      isValidBug: true,
      confidence: 'high',
      // missing explanation, category, etc.
    }) + '\n```';

    const result = parseInvestigationResult(text);
    expect(result.confidence).toBe('low');
    expect(result.canAutoFix).toBe(false);
  });

  it('returns safe fallback for invalid confidence value', () => {
    const text = '```json\n' + JSON.stringify({
      isValidBug: true,
      confidence: 'very-high',  // invalid enum
      explanation: 'test',
      category: 'content',
      affectedFiles: [],
      suggestedFix: null,
      canAutoFix: true,
    }) + '\n```';

    const result = parseInvestigationResult(text);
    expect(result.confidence).toBe('low');
    expect(result.canAutoFix).toBe(false);
  });
});

describe('parseFixResult', () => {
  const branchName = 'fix/issue-42-test-bug';

  it('parses a valid fix result', () => {
    const text = '```json\n' + JSON.stringify({
      branchName: 'fix/issue-42-test-bug',
      commitMessage: 'Fix #42: corrected validation',
      prTitle: 'Fix: correct validation in lesson 1.5',
      prBody: 'Changed the validation rule to accept...',
      changedFiles: ['src/data/lessons/level1/lesson-1.5.json'],
    }) + '\n```';

    const result = parseFixResult(text, branchName);
    expect(result).not.toBeNull();
    expect(result!.branchName).toBe('fix/issue-42-test-bug');
    expect(result!.changedFiles).toEqual(['src/data/lessons/level1/lesson-1.5.json']);
  });

  it('returns null for unparseable text', () => {
    const result = parseFixResult('no json here', branchName);
    expect(result).toBeNull();
  });

  it('returns null for missing required fields', () => {
    const text = '```json\n' + JSON.stringify({
      branchName: 'fix/issue-42-test-bug',
      // missing other fields
    }) + '\n```';

    const result = parseFixResult(text, branchName);
    expect(result).toBeNull();
  });

  it('returns null when changedFiles is not an array', () => {
    const text = '```json\n' + JSON.stringify({
      branchName: 'fix/issue-42-test-bug',
      commitMessage: 'Fix',
      prTitle: 'Fix',
      prBody: 'Fix',
      changedFiles: 'single-file.ts',  // should be array
    }) + '\n```';

    const result = parseFixResult(text, branchName);
    expect(result).toBeNull();
  });
});

describe('buildBranchName', () => {
  it('creates a valid branch name', () => {
    expect(buildBranchName(42, 'Test Bug Report')).toBe('fix/issue-42-test-bug-report');
  });

  it('strips special characters', () => {
    expect(buildBranchName(1, "I can't type `ls` — it doesn't work!"))
      .toBe('fix/issue-1-i-can-t-type-ls-it-doesn-t-work');
  });

  it('truncates long titles to 40 chars', () => {
    const longTitle = 'This is a very long bug report title that should be truncated to fit in a branch name';
    const branch = buildBranchName(99, longTitle);
    const slug = branch.replace('fix/issue-99-', '');
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it('strips leading/trailing hyphens from slug', () => {
    expect(buildBranchName(5, '---test---')).toBe('fix/issue-5-test');
  });
});
