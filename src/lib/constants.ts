export const LEVELS = [
  { id: 0, displayNumber: 1, lessonPrefix: '0', title: 'Computers Are Not Magic', subtitle: 'Files, folders, paths, and what a terminal actually is', lessonCount: 6, mvp: true },
  { id: 1, displayNumber: 2, lessonPrefix: '1', title: 'Your First 30 Minutes in the Terminal', subtitle: 'Navigate, create, and manage files like a developer', lessonCount: 13, mvp: true },
  { id: 2, displayNumber: 3, lessonPrefix: '2', title: 'Reading and Writing Files', subtitle: 'Look inside files, search for text, and chain commands together', lessonCount: 13, mvp: true },
  { id: 3, displayNumber: 4, lessonPrefix: '3', title: 'Your Code Has a History', subtitle: 'Git and GitHub — never lose your work again', lessonCount: 17, mvp: false },
  { id: 4, displayNumber: 5, lessonPrefix: '4', title: 'How Software Actually Works', subtitle: 'Client, server, APIs, databases, and the cloud — demystified', lessonCount: 14, mvp: false },
  { id: 45, displayNumber: 6, lessonPrefix: '4b', title: 'Talk to the Internet', subtitle: 'Make real HTTP requests, call real APIs, read real data', lessonCount: 12, mvp: false },
  { id: 5, displayNumber: 7, lessonPrefix: '5', title: 'Building With Real Tools', subtitle: 'Install Node.js, run code, build a real server', lessonCount: 15, mvp: false },
  { id: 6, displayNumber: 8, lessonPrefix: '6', title: 'Claude Code — Your AI Pair Programmer', subtitle: 'Build real projects by describing what you want', lessonCount: 15, mvp: false },
  { id: 7, displayNumber: 9, lessonPrefix: '7', title: 'Junior Developer Patterns', subtitle: 'Debug, deploy, and work like a professional', lessonCount: 12, mvp: false },
] as const;

/** Map internal level ID → display number (1-9) shown to users */
const LEVEL_DISPLAY_MAP = new Map<number, number>(LEVELS.map(l => [l.id, l.displayNumber]));
export function getLevelDisplayNumber(internalId: number): number {
  return LEVEL_DISPLAY_MAP.get(internalId) ?? internalId;
}

export const APP_NAME = 'From Zero to Claude Code';
export const STORAGE_KEY = 'terminal-trainer-progress';
