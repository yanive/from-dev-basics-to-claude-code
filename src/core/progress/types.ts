export interface ProgressState {
  completedLessons: string[];
  skippedLessons: string[];
  currentLessonId: string | null;
  currentSectionIndex: number;
  levelProgress: Record<number, number>; // level -> completed lesson count
  completionDates?: Record<string, string>; // lessonId -> ISO date string
  version?: number; // Schema version for migration support (fixes #11)
}
