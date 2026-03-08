import { STORAGE_KEY } from '../../lib/constants';
import type { ProgressState } from './types';

const PROGRESS_VERSION = 2;

const DEFAULT_STATE: ProgressState = {
  completedLessons: [],
  skippedLessons: [],
  currentLessonId: '0.1',
  currentSectionIndex: 0,
  levelProgress: {},
  version: PROGRESS_VERSION,
};

export class ProgressTracker {
  private state: ProgressState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.load();
  }

  private load(): ProgressState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProgressState;
        if (parsed.version !== PROGRESS_VERSION) {
          // Schema migration: preserve completed/skipped lessons but reset current position
          return {
            ...DEFAULT_STATE,
            completedLessons: parsed.completedLessons ?? [],
            skippedLessons: parsed.skippedLessons ?? [],
            levelProgress: parsed.levelProgress ?? {},
          };
        }
        return parsed;
      }
    } catch {
      // corrupt data, reset
    }
    return { ...DEFAULT_STATE };
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((fn) => fn());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): ProgressState {
    return this.state;
  }

  isLessonComplete(lessonId: string): boolean {
    return this.state.completedLessons.includes(lessonId);
  }

  isLessonSkipped(lessonId: string): boolean {
    return this.state.skippedLessons.includes(lessonId);
  }

  markLessonComplete(lessonId: string, level: number): void {
    // Auto-unskip on complete
    this.state.skippedLessons = this.state.skippedLessons.filter(id => id !== lessonId);

    if (!this.state.completedLessons.includes(lessonId)) {
      this.state.completedLessons = [...this.state.completedLessons, lessonId];
      this.state.levelProgress[level] = (this.state.levelProgress[level] || 0) + 1;
    }
    if (!this.state.completionDates) this.state.completionDates = {};
    if (!this.state.completionDates[lessonId]) {
      this.state.completionDates[lessonId] = new Date().toISOString();
    }
    this.save();
  }

  markLessonSkipped(lessonId: string): void {
    if (!this.state.skippedLessons.includes(lessonId)) {
      this.state.skippedLessons = [...this.state.skippedLessons, lessonId];
    }
    // Remove from completed if somehow there
    this.state.completedLessons = this.state.completedLessons.filter(id => id !== lessonId);
    this.save();
  }

  setCurrentLesson(lessonId: string, sectionIndex = 0): void {
    this.state.currentLessonId = lessonId;
    this.state.currentSectionIndex = sectionIndex;
    this.save();
  }

  setCurrentSection(index: number): void {
    this.state.currentSectionIndex = index;
    this.save();
  }

  getLevelCompletedCount(level: number): number {
    return this.state.levelProgress[level] || 0;
  }

  /** Returns lesson IDs completed 3+ days ago, sorted oldest-first (max 5) */
  getReviewLessons(): string[] {
    const dates = this.state.completionDates;
    if (!dates) return [];
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    return Object.entries(dates)
      .filter(([, iso]) => new Date(iso).getTime() < cutoff)
      .sort(([, a], [, b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(0, 5)
      .map(([id]) => id);
  }

  reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.save();
  }
}

export const progressTracker = new ProgressTracker();
