export interface ParsedBugReport {
  issueNumber: number;
  issueUrl: string;
  title: string;
  description: string;
  expectedBehavior: string | null;
  lessonId: string | null;
  sectionIndex: number | null;
  totalSections: number | null;
  instruction: string | null;
  validation: string | null;
  terminalHistory: string | null;
  lastCommand: string | null;
  vfsState: string | null;
  cwd: string | null;
  reporterEmail: string | null;
  reporterName: string | null;
  reporterUserId: string | null;
  browser: string | null;
  screenSize: string | null;
  themeMode: string | null;
}

export interface InvestigationResult {
  isValidBug: boolean;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  category: 'content' | 'ui' | 'logic' | 'backend' | 'unclear';
  affectedFiles: string[];
  suggestedFix: string | null;
  canAutoFix: boolean;
  costUsd: number;
}

export interface TriageResult {
  issueNumber: number;
  issueUrl: string;
  title: string;
  decision: 'auto-fixed' | 'needs-review' | 'not-a-bug' | 'error';
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  reporterEmail: string | null;
  reporterName: string | null;
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  changedFiles: string[];
  costUsd: number;
}

export interface FixResult {
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  changedFiles: string[];
  costUsd: number;
}
