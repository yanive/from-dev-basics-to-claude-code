import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';

interface ContinueData {
  continueLesson: { lessonId: string; title: string; levelTitle: string; sectionIndex: number } | null;
  nextLesson: { lessonId: string; title: string; levelTitle: string } | null;
  lessonsPerDay: number;
  estimatedDays: number | null;
  totalCompleted: number;
  totalSkipped: number;
  totalLessons: number;
  completionPercent: number;
}

export function DashboardOverview() {
  const [data, setData] = useState<ContinueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/progress/continue')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-text-muted text-sm">Failed to load dashboard data.</p>;
  }

  const { continueLesson, nextLesson, lessonsPerDay, estimatedDays, totalCompleted, totalSkipped, totalLessons, completionPercent } = data;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-bold font-mono text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Your learning overview</p>
      </div>

      {/* Continue Learning Hero */}
      {continueLesson && (
        <Link
          to={`/lesson/${continueLesson.lessonId}`}
          className="block bg-bg-card border border-purple/20 rounded-xl p-6 hover:border-purple/40 transition-colors group"
        >
          <p className="text-[10px] font-mono text-purple uppercase tracking-wider mb-2">Continue where you left off</p>
          <p className="text-lg font-mono font-bold text-text-primary group-hover:text-purple transition-colors">
            {continueLesson.title}
          </p>
          <p className="text-xs text-text-muted mt-1">{continueLesson.levelTitle}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-mono text-purple bg-purple-soft px-2 py-1 rounded">
              Resume &rarr;
            </span>
          </div>
        </Link>
      )}

      {/* Up Next */}
      {!continueLesson && nextLesson && (
        <Link
          to={`/lesson/${nextLesson.lessonId}`}
          className="block bg-bg-card border border-border rounded-xl p-6 hover:border-purple/30 transition-colors group"
        >
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">Up next</p>
          <p className="text-lg font-mono font-bold text-text-primary group-hover:text-purple transition-colors">
            {nextLesson.title}
          </p>
          <p className="text-xs text-text-muted mt-1">{nextLesson.levelTitle}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-mono text-purple bg-purple-soft px-2 py-1 rounded">
              Start &rarr;
            </span>
          </div>
        </Link>
      )}

      {nextLesson && continueLesson && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">Up next</p>
          <Link
            to={`/lesson/${nextLesson.lessonId}`}
            className="text-sm font-mono text-text-primary hover:text-purple transition-colors"
          >
            {nextLesson.title}
          </Link>
          <p className="text-xs text-text-muted mt-1">{nextLesson.levelTitle}</p>
        </div>
      )}

      {/* All complete */}
      {!continueLesson && !nextLesson && totalCompleted === totalLessons && (
        <div className="bg-bg-card border border-purple/20 rounded-xl p-6 text-center">
          <p className="text-3xl mb-2">🎓</p>
          <p className="text-lg font-mono font-bold text-text-primary">Course Complete!</p>
          <p className="text-sm text-text-muted mt-1">
            You've completed all {totalLessons} lessons. Amazing work!
          </p>
        </div>
      )}

      {/* Progress + Pace Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Completed" value={`${totalCompleted}/${totalLessons}`} />
        <StatCard label="Progress" value={`${completionPercent}%`} />
        <StatCard label="Skipped" value={`${totalSkipped}`} />
        <StatCard label="Pace" value={lessonsPerDay > 0 ? `${lessonsPerDay}/day` : '—'} />
        <StatCard label="Est. remaining" value={estimatedDays !== null ? `${estimatedDays}d` : '—'} />
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span className="font-mono">Overall progress</span>
          <span className="font-mono">{completionPercent}%</span>
        </div>
        <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-purple rounded-full transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 text-xs">
        <Link to="/dashboard/stats" className="text-purple hover:underline font-mono">View detailed stats &rarr;</Link>
        <Link to="/dashboard/achievements" className="text-purple hover:underline font-mono">View achievements &rarr;</Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{label}</p>
      <p className="text-lg font-mono font-bold text-text-primary mt-1">{value}</p>
    </div>
  );
}
