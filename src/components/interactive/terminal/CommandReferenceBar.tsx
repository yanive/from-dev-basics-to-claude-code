import { COMMAND_DESCRIPTIONS } from '../../../data/commandDescriptions';

interface CommandReferenceBarProps {
  commands: string[];
}

export function CommandReferenceBar({ commands }: CommandReferenceBarProps) {
  if (commands.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2.5 overflow-x-auto pb-1.5 scrollbar-none">
        {commands.map((cmd) => (
          <div
            key={cmd}
            className="flex-shrink-0 flex items-center gap-2.5 bg-bg-elevated rounded-lg px-3.5 py-2.5 border border-border"
          >
            <code className="text-[13px] font-mono font-semibold text-purple">{cmd}</code>
            {COMMAND_DESCRIPTIONS[cmd] && (
              <span className="text-[11px] text-text-muted">{COMMAND_DESCRIPTIONS[cmd]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
