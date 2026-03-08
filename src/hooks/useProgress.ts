import { useSyncExternalStore, useCallback } from 'react';
import { progressTracker } from '../core/progress/ProgressTracker';
import type { ProgressState } from '../core/progress/types';

export function useProgress() {
  const state = useSyncExternalStore(
    (cb) => progressTracker.subscribe(cb),
    () => progressTracker.getState()
  );

  const markLessonComplete = useCallback((lessonId: string, level: number) => {
    progressTracker.markLessonComplete(lessonId, level);
  }, []);

  const setCurrentLesson = useCallback((lessonId: string, sectionIndex = 0) => {
    progressTracker.setCurrentLesson(lessonId, sectionIndex);
  }, []);

  const setCurrentSection = useCallback((index: number) => {
    progressTracker.setCurrentSection(index);
  }, []);

  const isLessonComplete = useCallback((lessonId: string) => {
    return progressTracker.isLessonComplete(lessonId);
  }, []);

  const getLevelCompletedCount = useCallback((level: number) => {
    return progressTracker.getLevelCompletedCount(level);
  }, []);

  const markLessonSkipped = useCallback((lessonId: string) => {
    progressTracker.markLessonSkipped(lessonId);
  }, []);

  const isLessonSkipped = useCallback((lessonId: string) => {
    return progressTracker.isLessonSkipped(lessonId);
  }, []);

  const reset = useCallback(() => {
    progressTracker.reset();
  }, []);

  const getReviewLessons = useCallback(() => {
    return progressTracker.getReviewLessons();
  }, []);

  return {
    ...state,
    markLessonComplete,
    markLessonSkipped,
    setCurrentLesson,
    setCurrentSection,
    isLessonComplete,
    isLessonSkipped,
    getLevelCompletedCount,
    getReviewLessons,
    reset,
  } as ProgressState & {
    markLessonComplete: (lessonId: string, level: number) => void;
    markLessonSkipped: (lessonId: string) => void;
    setCurrentLesson: (lessonId: string, sectionIndex?: number) => void;
    setCurrentSection: (index: number) => void;
    isLessonComplete: (lessonId: string) => boolean;
    isLessonSkipped: (lessonId: string) => boolean;
    getLevelCompletedCount: (level: number) => number;
    getReviewLessons: () => string[];
    reset: () => void;
  };
}
