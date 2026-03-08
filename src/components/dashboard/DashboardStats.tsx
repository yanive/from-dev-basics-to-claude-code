import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { ActivityTimeline } from './ActivityTimeline';
import { LevelBreakdown } from './LevelBreakdown';
import { StreakHeatmap } from './StreakHeatmap';

interface Stats {
  totalCompleted: number;
  totalSkipped: number;
  totalLessons: number;
  completionPercent: number;
  currentStreak: number;
  longestStreak: number;
  levelBreakdown: {
    level: number;
    title: string;
    emoji: string;
    completed: number;
    skipped: number;
    total: number;
  }[];
  recentActivity: {
    lessonId: string;
    lessonTitle: string;
    completedAt: string | null;
  }[];
  activityMap?: Record<string, number>;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/progress/stats');
        if (!res.ok) throw new Error('Failed to load stats');
        setStats(await res.json());
      } catch {
        setError('Failed to load stats.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-text-muted text-sm font-mono animate-pulse">Loading stats...</p>;
  }

  if (error || !stats) {
    return <p className="text-text-muted text-sm font-mono">{error || 'No data.'}</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary font-mono mb-6">Progress Stats</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Lessons Completed"
          value={`${stats.totalCompleted}`}
          sub={`/ ${stats.totalLessons}`}
        />
        <StatCard
          label="Completion"
          value={`${stats.completionPercent}%`}
        />
        <StatCard
          label="Skipped"
          value={`${stats.totalSkipped}`}
        />
        <StatCard
          label="Current Streak"
          value={`${stats.currentStreak}`}
          sub={stats.currentStreak === 1 ? 'day' : 'days'}
          detail={stats.longestStreak > stats.currentStreak ? `Best: ${stats.longestStreak}` : undefined}
        />
      </div>

      {/* Activity heatmap */}
      {stats.activityMap && Object.keys(stats.activityMap).length > 0 && (
        <div className="mb-8 bg-bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-primary font-mono mb-4">Activity</h2>
          <StreakHeatmap activityMap={stats.activityMap} />
        </div>
      )}

      {/* Level breakdown */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary font-mono mb-4">Progress by Level</h2>
        <LevelBreakdown levels={stats.levelBreakdown} />
      </div>

      {/* Recent activity */}
      <div className="bg-bg-card rounded-xl border border-border p-6">
        <h2 className="text-sm font-semibold text-text-primary font-mono mb-4">Recent Activity</h2>
        <ActivityTimeline items={stats.recentActivity} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, detail }: {
  label: string;
  value: string;
  sub?: string;
  detail?: string;
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold font-mono text-purple">{value}</span>
        {sub && <span className="text-sm font-mono text-text-muted">{sub}</span>}
      </div>
      {detail && (
        <p className="text-[10px] font-mono text-text-muted mt-1">{detail}</p>
      )}
    </div>
  );
}
