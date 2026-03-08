export interface FileSystemSpec {
  [key: string]: string | FileSystemSpec;
}

// --- Section types ---

export interface NarrativeSection {
  type: 'narrative';
  content: string;
  analogy?: string;
  keyPoints?: string[];
  tip?: string;
}

export interface QuizSection {
  type: 'quiz';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MatchSection {
  type: 'match';
  instruction: string;
  pairs: Array<{ left: string; right: string }>;
}

export interface FillInBlankSection {
  type: 'fillInBlank';
  prompt: string;
  answer: string;
  acceptAlternates?: string[];
  caseSensitive?: boolean;
  hintDetail?: string;
}

export interface InteractiveTreeSection {
  type: 'interactiveTree';
  instruction: string;
  tree: FileSystemSpec;
  highlightPath?: string;
}

export interface PathBuilderSection {
  type: 'pathBuilder';
  instruction: string;
  tree: FileSystemSpec;
  targetPath: string;
}

export interface TerminalPreviewSection {
  type: 'terminalPreview';
  instruction: string;
  lines: Array<{
    type: 'command' | 'output';
    text: string;
    annotation?: string;
  }>;
}

export interface ProgramSimSection {
  type: 'programSim';
  instruction: string;
  lines: string[];
  interactions: Array<{
    afterLine: number;
    type: 'input' | 'display';
    prompt?: string;
    value?: string;
  }>;
}

export interface TerminalStepSection {
  type: 'terminalStep';
  instruction: string;
  prompt: string;
  hint: string;
  hints?: string[];
  freeMode?: boolean;
  expectError?: boolean;
  /** Initial working directory shown in prompt and used by pwd */
  initialDirectory?: string;
  /** Initial file system state for the virtual FS — must sync with file tree panel */
  fileSystemState?: FileSystemSpec;
  /** When true, only valid commands are accepted as correct — errors trigger retry */
  strictValidation?: boolean;
  /** Context message shown when resuming a lesson mid-progress */
  contextMessage?: string;
  validation: {
    type: 'exactCommand' | 'commandStartsWith' | 'outputContains'
      | 'fileExists' | 'fileContains' | 'directoryExists' | 'fsStateMatch';
    value: string | Record<string, unknown>;
  };
  onSuccess: {
    message: string;
    highlightExplorer?: string;
  };
}

// --- Level 4 section types ---

export interface CodeExampleSection {
  type: 'codeExample';
  instruction: string;
  blocks: Array<{
    language: string;
    label?: string;
    code: string;
  }>;
  explanation?: string;
}

export interface DragSortSection {
  type: 'dragSort';
  instruction: string;
  categories: Array<{
    name: string;
    description?: string;
  }>;
  items: Array<{
    text: string;
    correctCategory: string;
  }>;
}

export interface StepThroughSection {
  type: 'stepThrough';
  instruction: string;
  steps: Array<{
    title: string;
    description: string;
    highlight?: string;
  }>;
}

// --- Levels 5-7 section types (guide mode) ---

export interface GuideStepSection {
  type: 'guideStep';
  instruction: string;
  platform?: {
    mac: string;
    windows: string;
  };
  codeBlocks?: Array<{
    language: string;
    code: string;
    filename?: string;
    copyable?: boolean;
  }>;
  expectedOutput?: string;
  troubleshooting?: Array<{
    problem: string;
    solution: string;
  }>;
  confirmationType: 'success_or_error' | 'continue' | 'checklist';
  checklistItems?: string[];
}

export interface PromptTemplateSection {
  type: 'promptTemplate';
  instruction: string;
  prompt: string;
  placeholders?: Array<{
    token: string;
    description: string;
  }>;
  expectedResult?: string;
}

/**
 * Checklist section for self-assessment checklists (Levels 5-7).
 * Implementation notes:
 * - Each item MUST use role="checkbox" + aria-checked for accessibility
 * - Toggle logic should use a Set and guard against multi-toggle per render cycle
 * - Hint buttons must meet 44x44px minimum touch target
 */
export interface ChecklistSection {
  type: 'checklist';
  instruction: string;
  items: Array<{
    text: string;
    hint?: string;
  }>;
}

export type LessonSection =
  | NarrativeSection
  | QuizSection
  | MatchSection
  | FillInBlankSection
  | InteractiveTreeSection
  | PathBuilderSection
  | TerminalPreviewSection
  | ProgramSimSection
  | TerminalStepSection
  | CodeExampleSection
  | DragSortSection
  | StepThroughSection
  | GuideStepSection
  | PromptTemplateSection
  | ChecklistSection;

// --- Lesson ---

export interface MilestoneInfo {
  title: string;
  summary: string[];
  nextLevelTeaser: string;
}

export interface Lesson {
  id: string;
  level: number;
  order: number;
  title: string;
  subtitle: string;
  type: 'conceptual' | 'terminal' | 'guide';
  initialFs?: FileSystemSpec;
  initialDir?: string;
  commandsIntroduced?: string[];
  cheatSheet?: Array<{ command: string; description: string }>;
  /** Mocked curl responses for the terminal sandbox. Keys are URLs (or "METHOD URL" for non-GET). */
  curlMocks?: Record<string, string>;
  sections: LessonSection[];
  completionMessage?: string;
  milestone?: MilestoneInfo | null;
  nextLesson: string | null;
}
