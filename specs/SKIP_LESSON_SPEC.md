# Skip Lesson Feature Spec

## Overview
Allow students to skip lessons they don't want to do. Skipped lessons unlock the next lesson but do **not** count toward achievements. Students can unskip by completing the lesson normally.

## User Stories
- As a student, I want to skip a lesson I already know so I can focus on new material
- As a student, I want to see which lessons I skipped so I can return to them later
- As a student, I want skipped lessons to not count toward my achievements so accomplishments remain meaningful

## Behavior
- **Skip**: A "Skip" button in the lesson progress bar opens a confirmation dialog. On confirm, the lesson is marked as skipped and the user returns to the home screen.
- **Visual treatment**: Skipped lessons show a yellow double-chevron icon and "Skipped" badge on the home screen, distinct from completed (green checkmark) and not-started (muted circle).
- **Unskip**: Opening a skipped lesson and completing it normally converts it from skipped to completed.
- **Achievements**: Skipped lessons do not count toward any achievement (milestones, level mastery, streaks, speed).
- **Navigation**: Skipped lessons are excluded from "next lesson" recommendations in smart continue.
- **Progress bars**: Level progress bars show skipped lessons as a striped segment, separate from completed.
- **Dashboard**: Stats display includes a skipped count.
- **No restrictions**: Any lesson can be skipped.
- **Already completed**: Completed lessons cannot be skipped (skip button not shown).

## Data Model
- `progress` table gains `skipped` (boolean, default false) and `skipped_at` (timestamp) columns
- Invariant: `completed=true` implies `skipped=false`; `skipped=true` implies `completed=false`

## API
- `POST /api/progress/:lessonId/skip` — mark lesson as skipped
- `GET /api/progress` — returns `skipped` field per row
- `GET /api/progress/stats` — includes `totalSkipped` and per-level `skipped` count
- `GET /api/progress/continue` — excludes skipped from next lesson, includes `totalSkipped`
- `PUT /api/progress/:lessonId` — completing a lesson auto-unskips it
