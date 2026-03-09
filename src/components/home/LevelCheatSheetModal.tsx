import { levels } from '../../data/levels';
import { LEVELS } from '../../lib/constants';
import { COMMAND_DESCRIPTIONS } from '../../data/commandDescriptions';

interface LevelCheatSheetModalProps {
  levelId: number;
  onClose: () => void;
}

export function LevelCheatSheetModal({ levelId, onClose }: LevelCheatSheetModalProps) {
  const levelData = levels.find(l => l.id === levelId);
  if (!levelData) return null;

  const levelTitle = LEVELS.find(l => l.id === levelId)?.title ?? '';

  // Collect unique commands across all lessons in this level
  const seen = new Set<string>();
  const entries: Array<{ command: string; description: string }> = [];
  for (const lesson of levelData.lessons) {
    for (const cmd of lesson.commandsIntroduced || []) {
      if (!seen.has(cmd) && COMMAND_DESCRIPTIONS[cmd]) {
        seen.add(cmd);
        entries.push({ command: cmd, description: COMMAND_DESCRIPTIONS[cmd] });
      }
    }
  }

  if (entries.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Level cheat sheet"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border rounded-2xl max-w-md w-[90vw] max-h-[80vh] flex flex-col animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold font-mono text-text-primary">Cheat Sheet</h2>
            <p className="text-[11px] text-text-muted mt-0.5">{levelTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Close cheat sheet"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-1">
          {entries.map((entry) => (
            <div key={entry.command} className="flex items-baseline gap-3 px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors">
              <code className="text-[13px] font-mono font-semibold text-purple flex-shrink-0">{entry.command}</code>
              <span className="text-[12px] text-text-muted leading-tight">{entry.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
