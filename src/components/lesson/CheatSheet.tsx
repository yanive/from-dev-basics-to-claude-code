import { useState, useEffect, useRef } from 'react';

interface CheatSheetEntry {
  command: string;
  description: string;
}

interface CheatSheetProps {
  entries: CheatSheetEntry[];
}

export function CheatSheet({ entries }: CheatSheetProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div ref={panelRef} className="fixed bottom-6 left-6 z-40">
      {open && (
        <div className="mb-3 w-72 max-h-80 overflow-y-auto bg-bg-card border border-border rounded-xl shadow-float animate-fade-in-up">
          <div className="sticky top-0 bg-bg-card border-b border-border px-4 py-2.5 flex items-center justify-between">
            <span className="text-[13px] font-mono font-semibold text-text-primary">Cheat Sheet</span>
            <button
              onClick={() => setOpen(false)}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close cheat sheet"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-3 space-y-1.5">
            {entries.map((entry) => (
              <div key={entry.command} className="flex items-baseline gap-2.5 px-2 py-1.5 rounded-lg hover:bg-bg-elevated transition-colors">
                <code className="text-[13px] font-mono font-semibold text-purple flex-shrink-0">{entry.command}</code>
                <span className="text-[11px] text-text-muted leading-tight">{entry.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 flex items-center justify-center rounded-full border shadow-float transition-all active:scale-95 ${
          open
            ? 'bg-purple text-white border-purple/50'
            : 'bg-bg-card text-text-muted border-border hover:text-text-primary hover:border-border-strong'
        }`}
        aria-label={open ? 'Close cheat sheet' : 'Open cheat sheet'}
        title="Cheat Sheet"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      </button>
    </div>
  );
}
