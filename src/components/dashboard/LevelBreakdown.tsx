interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  completed: number;
  skipped?: number;
  total: number;
}

export function LevelBreakdown({ levels }: { levels: LevelInfo[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {levels.map(lv => {
        const pct = lv.total > 0 ? Math.round((lv.completed / lv.total) * 100) : 0;
        const isDone = lv.completed === lv.total && lv.total > 0;

        return (
          <div
            key={lv.level}
            className={`bg-bg-elevated rounded-lg p-4 border ${
              isDone ? 'border-green/20' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{lv.emoji}</span>
              <p className="text-xs font-mono text-text-primary font-medium truncate flex-1">
                {lv.title}
              </p>
              {isDone && <span className="text-green text-xs">&#10003;</span>}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-bg-card rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isDone ? 'var(--color-green)' : 'var(--color-purple)',
                }}
              />
            </div>

            <p className="text-[10px] font-mono text-text-muted">
              {lv.completed}/{lv.total} lessons
              {(lv.skipped ?? 0) > 0 && <span className="text-yellow ml-1">({lv.skipped} skipped)</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
