import { apiFetch, getAccessToken } from './api';
import { progressTracker } from '../core/progress/ProgressTracker';

interface ServerProgress {
  lessonId: string;
  sectionIndex: number;
  completed: boolean;
  completedAt: string | null;
  skipped: boolean;
  skippedAt: string | null;
}

// Pull server progress into localStorage on login
export async function pullProgress(): Promise<void> {
  if (!getAccessToken()) return;

  try {
    const res = await apiFetch('/api/progress');
    if (!res.ok) return;

    const serverData: ServerProgress[] = await res.json();
    const state = progressTracker.getState();

    for (const entry of serverData) {
      if (entry.completed && !state.completedLessons.includes(entry.lessonId)) {
        // Extract level from lesson ID (e.g., "0.1" -> 0)
        const level = parseInt(entry.lessonId.split('.')[0]);
        progressTracker.markLessonComplete(entry.lessonId, level);
      }
      if (entry.skipped && !state.skippedLessons.includes(entry.lessonId)) {
        progressTracker.markLessonSkipped(entry.lessonId);
      }
    }
  } catch {
    // Silent fail — localStorage already has data
  }
}

// Push a lesson completion to the server (fire-and-forget)
export function pushCompletion(lessonId: string, sectionIndex: number): void {
  if (!getAccessToken()) return;

  apiFetch(`/api/progress/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify({ sectionIndex, completed: true }),
  }).catch(() => {
    // Silent fail — localStorage already has the completion
  });
}

// Push a lesson skip to the server (fire-and-forget)
export function pushSkip(lessonId: string): void {
  if (!getAccessToken()) return;

  apiFetch(`/api/progress/${lessonId}/skip`, {
    method: 'POST',
  }).catch(() => {
    // Silent fail — localStorage already has the skip
  });
}

// Push section progress (fire-and-forget)
export function pushSectionProgress(lessonId: string, sectionIndex: number): void {
  if (!getAccessToken()) return;

  apiFetch(`/api/progress/${lessonId}`, {
    method: 'PUT',
    body: JSON.stringify({ sectionIndex, completed: false }),
  }).catch(() => {});
}
