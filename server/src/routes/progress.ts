import { Router } from 'express';
import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { progress, lessons, levels } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ACHIEVEMENTS, type AchievementContext } from '../lib/achievements.js';

export const progressRouter = Router();

progressRouter.use(requireAuth);

// GET /api/progress — all progress for current user
progressRouter.get('/', async (req, res) => {
  const rows = await db.select({
    lessonId: progress.lessonId,
    sectionIndex: progress.sectionIndex,
    completed: progress.completed,
    completedAt: progress.completedAt,
    skipped: progress.skipped,
    skippedAt: progress.skippedAt,
  }).from(progress)
    .where(eq(progress.userId, req.user!.userId));

  res.json(rows);
});

// GET /api/progress/stats — aggregated stats for current user
// IMPORTANT: must be before /:lessonId to avoid matching "stats" as a lessonId
progressRouter.get('/stats', async (req, res) => {
  const userId = req.user!.userId;

  // Completed lessons with timestamps
  const completedRows = await db.select({
    lessonId: progress.lessonId,
    completedAt: progress.completedAt,
  }).from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.completed, true)))
    .orderBy(desc(progress.completedAt));

  const totalCompleted = completedRows.length;

  // Total lessons count
  const [totalRow] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(lessons).where(eq(lessons.isPublished, true));
  const totalLessons = totalRow.count;

  const completionPercent = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  // Streak calculation: consecutive calendar days with 1-day grace period
  const completionDates = new Set(
    completedRows
      .filter(r => r.completedAt)
      .map(r => new Date(r.completedAt!).toISOString().slice(0, 10))
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let graceUsed = false;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    if (completionDates.has(dateStr)) {
      streak++;
      if (i <= 1 || currentStreak > 0) {
        currentStreak = streak;
      }
      longestStreak = Math.max(longestStreak, streak);
    } else {
      if (i === 0) continue; // Today might not have a completion yet
      if (currentStreak === 0 && streak === 0) continue;
      // 1-day grace: allow one missed day before breaking streak
      if (!graceUsed && streak > 0) {
        graceUsed = true;
        continue;
      }
      streak = 0;
    }
  }

  // Level breakdown
  const levelRows = await db.select({
    levelId: levels.id,
    title: levels.title,
    emoji: levels.emoji,
  }).from(levels).orderBy(asc(levels.order));

  const lessonCounts = await db.select({
    levelId: lessons.levelId,
    count: sql<number>`count(*)::int`,
  }).from(lessons)
    .where(eq(lessons.isPublished, true))
    .groupBy(lessons.levelId);

  const countMap = new Map(lessonCounts.map(r => [r.levelId, r.count]));

  // Count completed per level
  const completedLessonIds = new Set(completedRows.map(r => r.lessonId));
  const allLessons = await db.select({
    id: lessons.id,
    levelId: lessons.levelId,
  }).from(lessons).where(eq(lessons.isPublished, true));

  // Skipped lessons
  const skippedRows = await db.select({
    lessonId: progress.lessonId,
  }).from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.skipped, true)));

  const totalSkipped = skippedRows.length;
  const skippedLessonIds = new Set(skippedRows.map(r => r.lessonId));

  const completedPerLevel = new Map<number, number>();
  const skippedPerLevel = new Map<number, number>();
  for (const l of allLessons) {
    if (completedLessonIds.has(l.id)) {
      completedPerLevel.set(l.levelId, (completedPerLevel.get(l.levelId) || 0) + 1);
    }
    if (skippedLessonIds.has(l.id)) {
      skippedPerLevel.set(l.levelId, (skippedPerLevel.get(l.levelId) || 0) + 1);
    }
  }

  const levelBreakdown = levelRows.map(lv => ({
    level: lv.levelId,
    title: lv.title,
    emoji: lv.emoji,
    completed: completedPerLevel.get(lv.levelId) || 0,
    skipped: skippedPerLevel.get(lv.levelId) || 0,
    total: countMap.get(lv.levelId) || 0,
  }));

  // Activity map — count of completions per day (last 180 days)
  const activityMap: Record<string, number> = {};
  for (const row of completedRows) {
    if (!row.completedAt) continue;
    const dateStr = new Date(row.completedAt).toISOString().slice(0, 10);
    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
  }

  // Recent activity (last 10 with lesson titles)
  const lessonTitles = new Map(
    (await db.select({ id: lessons.id, title: lessons.title }).from(lessons)).map(l => [l.id, l.title])
  );

  const recentActivity = completedRows.slice(0, 10).map(r => ({
    lessonId: r.lessonId,
    lessonTitle: lessonTitles.get(r.lessonId) || r.lessonId,
    completedAt: r.completedAt,
  }));

  res.json({
    totalCompleted,
    totalSkipped,
    totalLessons,
    completionPercent,
    currentStreak,
    longestStreak,
    levelBreakdown,
    recentActivity,
    activityMap,
  });
});

// GET /api/progress/achievements — computed achievements for current user
progressRouter.get('/achievements', async (req, res) => {
  const userId = req.user!.userId;

  const completedRows = await db.select({
    lessonId: progress.lessonId,
    completedAt: progress.completedAt,
  }).from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.completed, true)))
    .orderBy(desc(progress.completedAt));

  const allLessons = await db.select({
    id: lessons.id,
    levelId: lessons.levelId,
  }).from(lessons).where(eq(lessons.isPublished, true));

  const [totalRow] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(lessons).where(eq(lessons.isPublished, true));

  const completedLessonIds = new Set(completedRows.map(r => r.lessonId));

  // Per-level counts
  const completedPerLevel = new Map<number, number>();
  const totalPerLevel = new Map<number, number>();
  for (const l of allLessons) {
    totalPerLevel.set(l.levelId, (totalPerLevel.get(l.levelId) || 0) + 1);
    if (completedLessonIds.has(l.id)) {
      completedPerLevel.set(l.levelId, (completedPerLevel.get(l.levelId) || 0) + 1);
    }
  }

  // Date-based stats
  const completionTimestamps = completedRows.map(r => r.completedAt?.toISOString() ?? null);
  const completionDates = [...new Set(
    completedRows
      .filter(r => r.completedAt)
      .map(r => r.completedAt!.toISOString().slice(0, 10))
  )].sort().reverse();

  const completionsPerDay = new Map<string, number>();
  for (const r of completedRows) {
    if (r.completedAt) {
      const d = r.completedAt.toISOString().slice(0, 10);
      completionsPerDay.set(d, (completionsPerDay.get(d) || 0) + 1);
    }
  }

  // Streak (with 1-day grace period)
  const dateSet = new Set(completionDates);
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let graceUsed = false;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (dateSet.has(ds)) {
      streak++;
      if (i <= 1 || currentStreak > 0) currentStreak = streak;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      if (i === 0) continue;
      if (currentStreak === 0 && streak === 0) continue;
      if (!graceUsed && streak > 0) {
        graceUsed = true;
        continue;
      }
      streak = 0;
    }
  }

  const ctx: AchievementContext = {
    totalCompleted: completedRows.length,
    totalLessons: totalRow.count,
    completedLessonIds,
    completedPerLevel,
    totalPerLevel,
    completionDates,
    completionTimestamps,
    currentStreak,
    longestStreak,
    completionsPerDay,
  };

  const earned: { id: string; title: string; description: string; icon: string; category: string; earnedAt: string | null }[] = [];
  const available: { id: string; title: string; description: string; icon: string; category: string; progress: number }[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (ach.check(ctx)) {
      // For earnedAt, use the earliest timestamp that could satisfy the condition
      // Simplified: use the Nth completion timestamp based on achievement type
      let earnedAt: string | null = null;
      if (completionTimestamps.length > 0) {
        earnedAt = completionTimestamps[completionTimestamps.length - 1] ?? completionTimestamps[0];
      }
      earned.push({
        id: ach.id,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        category: ach.category,
        earnedAt,
      });
    } else {
      available.push({
        id: ach.id,
        title: ach.title,
        description: ach.description,
        icon: ach.icon,
        category: ach.category,
        progress: ach.progress ? ach.progress(ctx) : 0,
      });
    }
  }

  res.json({
    earned,
    available,
    totalEarned: earned.length,
    totalAvailable: ACHIEVEMENTS.length,
  });
});

// GET /api/progress/continue — smart continue data
progressRouter.get('/continue', async (req, res) => {
  const userId = req.user!.userId;

  // All progress rows
  const allProgress = await db.select({
    lessonId: progress.lessonId,
    sectionIndex: progress.sectionIndex,
    completed: progress.completed,
    completedAt: progress.completedAt,
    skipped: progress.skipped,
  }).from(progress)
    .where(eq(progress.userId, userId));

  const completedRows = allProgress.filter(r => r.completed);
  const completedIds = new Set(completedRows.map(r => r.lessonId));
  const inProgressRows = allProgress.filter(r => !r.completed);

  // All published lessons ordered
  const allLessons = await db.select({
    id: lessons.id,
    title: lessons.title,
    levelId: lessons.levelId,
    order: lessons.order,
  }).from(lessons)
    .where(eq(lessons.isPublished, true))
    .orderBy(asc(lessons.levelId), asc(lessons.order));

  const totalLessons = allLessons.length;
  const totalCompleted = completedIds.size;
  const completionPercent = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  // Level titles
  const levelRows = await db.select({
    id: levels.id,
    title: levels.title,
    emoji: levels.emoji,
  }).from(levels);
  const levelMap = new Map(levelRows.map(l => [l.id, l]));

  // In-progress lesson (most recent by sectionIndex > 0, not completed)
  let continueLesson: { lessonId: string; title: string; levelTitle: string; sectionIndex: number } | null = null;
  if (inProgressRows.length > 0) {
    // Pick the one with highest sectionIndex (furthest along)
    const best = inProgressRows.sort((a, b) => b.sectionIndex - a.sectionIndex)[0];
    const lessonData = allLessons.find(l => l.id === best.lessonId);
    if (lessonData) {
      const lv = levelMap.get(lessonData.levelId);
      continueLesson = {
        lessonId: best.lessonId,
        title: lessonData.title,
        levelTitle: lv ? `${lv.emoji} ${lv.title}` : `Level ${lessonData.levelId}`,
        sectionIndex: best.sectionIndex,
      };
    }
  }

  // Next recommended lesson (first uncompleted, not in progress, not skipped)
  let nextLesson: { lessonId: string; title: string; levelTitle: string } | null = null;
  const inProgressIds = new Set(inProgressRows.map(r => r.lessonId));
  const skippedIds = new Set(allProgress.filter(r => r.skipped).map(r => r.lessonId));
  const totalSkipped = skippedIds.size;
  for (const l of allLessons) {
    if (!completedIds.has(l.id) && !inProgressIds.has(l.id) && !skippedIds.has(l.id)) {
      const lv = levelMap.get(l.levelId);
      nextLesson = {
        lessonId: l.id,
        title: l.title,
        levelTitle: lv ? `${lv.emoji} ${lv.title}` : `Level ${l.levelId}`,
      };
      break;
    }
  }

  // Lessons per day pace (based on last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCompletions = completedRows.filter(
    r => r.completedAt && new Date(r.completedAt) >= thirtyDaysAgo
  );
  const activeDays = new Set(
    recentCompletions.map(r => new Date(r.completedAt!).toISOString().slice(0, 10))
  ).size;
  const lessonsPerDay = activeDays > 0 ? +(recentCompletions.length / activeDays).toFixed(1) : 0;

  // Estimated days to complete
  const remaining = totalLessons - totalCompleted;
  const estimatedDays = lessonsPerDay > 0 ? Math.ceil(remaining / lessonsPerDay) : null;

  res.json({
    continueLesson,
    nextLesson,
    lessonsPerDay,
    estimatedDays,
    totalCompleted,
    totalSkipped,
    totalLessons,
    completionPercent,
  });
});

const updateSchema = z.object({
  sectionIndex: z.number().int().min(0),
  completed: z.boolean(),
});

// PUT /api/progress/:lessonId — upsert progress
progressRouter.put('/:lessonId', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid progress data');
  }

  const { sectionIndex, completed } = parsed.data;
  const { lessonId } = req.params;
  const userId = req.user!.userId;

  // When impersonating, return success without persisting
  if (req.user!.impersonatedBy) {
    res.json({ lessonId, sectionIndex, completed });
    return;
  }

  // Upsert: insert or update
  const [existing] = await db.select({ id: progress.id })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.lessonId, lessonId)))
    .limit(1);

  if (existing) {
    await db.update(progress)
      .set({
        sectionIndex,
        completed,
        completedAt: completed ? new Date() : null,
        ...(completed ? { skipped: false, skippedAt: null } : {}),
      })
      .where(eq(progress.id, existing.id));
  } else {
    await db.insert(progress).values({
      userId,
      lessonId,
      sectionIndex,
      completed,
      completedAt: completed ? new Date() : null,
    });
  }

  res.json({ lessonId, sectionIndex, completed });
});

// POST /api/progress/:lessonId/skip — mark lesson as skipped
progressRouter.post('/:lessonId/skip', async (req, res) => {
  const { lessonId } = req.params;
  const userId = req.user!.userId;

  // When impersonating, return success without persisting
  if (req.user!.impersonatedBy) {
    res.json({ lessonId, skipped: true });
    return;
  }

  const [existing] = await db.select({ id: progress.id, completed: progress.completed })
    .from(progress)
    .where(and(eq(progress.userId, userId), eq(progress.lessonId, lessonId)))
    .limit(1);

  // If already completed, don't allow skipping
  if (existing?.completed) {
    res.json({ lessonId, skipped: false, completed: true });
    return;
  }

  if (existing) {
    await db.update(progress)
      .set({ skipped: true, skippedAt: new Date(), completed: false, completedAt: null })
      .where(eq(progress.id, existing.id));
  } else {
    await db.insert(progress).values({
      userId,
      lessonId,
      sectionIndex: 0,
      completed: false,
      completedAt: null,
      skipped: true,
      skippedAt: new Date(),
    });
  }

  res.json({ lessonId, skipped: true });
});
