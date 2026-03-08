export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  'pwd': 'location',
  'ls': 'list files',
  'ls -l': 'detailed list',
  'ls -a': 'show hidden',
  'cd': 'change folder',
  'cd ..': 'go up',
  'cd ~': 'go home',
  'mkdir': 'create folder',
  'mkdir -p': 'create nested',
  'touch': 'create file',
  'rm': 'delete file',
  'rm -r': 'delete folder',
  'cp': 'copy file',
  'mv': 'move/rename',
  'cat': 'read file',
  'head': 'first lines',
  'head -n': 'first N lines',
  'tail': 'last lines',
  'tail -n': 'last N lines',
  'echo': 'print text',
  '> file': 'write to file',
  '>> file': 'append to file',
  'grep': 'search text',
  'grep -i': 'case-insensitive',
  'grep -r': 'recursive search',
  'grep -c': 'count matches',
  'wc -l': 'count lines',
  '|': 'pipe output',
  'export': 'set variable',
  'git init': 'start repo',
  'git status': 'check changes',
  'git add': 'stage files',
  'git add .': 'stage all',
  'git commit -m': 'save snapshot',
  'git log': 'view history',
  'git log --oneline': 'short history',
  'git diff': 'see changes',
  'git checkout': 'switch branch',
  'git checkout -b': 'new branch',
  'git branch': 'list branches',
  'git merge': 'combine branches',
  'git remote add': 'add remote',
  'git push': 'upload to remote',
  'git pull': 'download updates',
  'git clone': 'copy repository',
};

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
