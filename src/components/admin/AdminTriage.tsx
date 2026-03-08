import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api.js';
import { AdminLoadingState } from './shared/AdminLoadingState.js';

interface TriageStats {
  totalRuns: number;
  totalIssues: number;
  totalAutoFixed: number;
  totalNeedsReview: number;
  totalNotABug: number;
  totalErrors: number;
  totalCostUsd: string;
  lastRunAt: string | null;
}

interface TriageIssue {
  id: string;
  issueNumber: number;
  issueUrl: string;
  title: string;
  decision: 'auto-fixed' | 'needs-review' | 'not-a-bug';
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  reporterEmail: string | null;
  reporterName: string | null;
  prNumber: number | null;
  prUrl: string | null;
  changedFiles: string[] | null;
  costUsd: string;
}

interface TriageRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  issuesProcessed: number;
  autoFixed: number;
  needsReview: number;
  notABug: number;
  errors: number;
  totalCostUsd: string;
  dryRun: boolean;
  createdAt: string;
  issues: TriageIssue[];
}

export function AdminTriage() {
  const useApi = import.meta.env.VITE_USE_API === 'true';

  if (!useApi) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-text-muted text-sm font-mono">Triage dashboard requires the backend API.</p>
        <p className="text-text-muted text-xs mt-2">Set VITE_USE_API=true and start the server.</p>
      </div>
    );
  }

  return <TriageDashboard />;
}

function TriageDashboard() {
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [runs, setRuns] = useState<TriageRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/triage/stats').then(r => {
        if (!r.ok) throw new Error('Failed to load triage stats');
        return r.json();
      }),
      apiFetch('/api/admin/triage/runs?limit=20').then(r => {
        if (!r.ok) throw new Error('Failed to load triage runs');
        return r.json();
      }),
    ])
      .then(([statsData, runsData]) => {
        setStats(statsData);
        setRuns(runsData);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <AdminLoadingState message="Loading triage data..." />;

  if (error) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-6">
        <p className="text-red text-sm font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary font-mono mb-6">Triage Agent</h1>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Runs" value={stats.totalRuns} />
          <StatCard label="Issues Processed" value={stats.totalIssues} />
          <StatCard label="Auto-Fixed" value={stats.totalAutoFixed} color="green" />
          <StatCard label="Needs Review" value={stats.totalNeedsReview} color="yellow" />
          <StatCard label="Not a Bug" value={stats.totalNotABug} color="muted" />
          <StatCard label="Errors" value={stats.totalErrors} color="red" />
          <StatCard label="Total Cost" value={`$${Number(stats.totalCostUsd).toFixed(2)}`} />
          <StatCard
            label="Last Run"
            value={stats.lastRunAt ? formatRelativeTime(stats.lastRunAt) : 'Never'}
          />
        </div>
      )}

      {/* Decision breakdown bar */}
      {stats && stats.totalIssues > 0 && (
        <div className="bg-bg-card rounded-xl border border-border p-4 mb-8">
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-3">Decision Breakdown</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-bg-elevated">
            {stats.totalAutoFixed > 0 && (
              <div
                className="h-full bg-green"
                style={{ width: `${(stats.totalAutoFixed / stats.totalIssues) * 100}%` }}
                title={`Auto-fixed: ${stats.totalAutoFixed}`}
              />
            )}
            {stats.totalNeedsReview > 0 && (
              <div
                className="h-full bg-yellow"
                style={{ width: `${(stats.totalNeedsReview / stats.totalIssues) * 100}%` }}
                title={`Needs review: ${stats.totalNeedsReview}`}
              />
            )}
            {stats.totalNotABug > 0 && (
              <div
                className="h-full bg-text-muted"
                style={{ width: `${(stats.totalNotABug / stats.totalIssues) * 100}%` }}
                title={`Not a bug: ${stats.totalNotABug}`}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2">
            <Legend color="bg-green" label={`Auto-fixed (${stats.totalAutoFixed})`} />
            <Legend color="bg-yellow" label={`Needs review (${stats.totalNeedsReview})`} />
            <Legend color="bg-text-muted" label={`Not a bug (${stats.totalNotABug})`} />
          </div>
        </div>
      )}

      {/* Run history */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary font-mono mb-4">Run History</h2>

        {runs.length === 0 ? (
          <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted text-sm font-mono">No triage runs recorded yet.</p>
            <p className="text-text-muted text-xs mt-2">The agent will report here after its first cycle.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map(run => (
              <RunCard
                key={run.id}
                run={run}
                isExpanded={expandedRun === run.id}
                onToggle={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RunCard({ run, isExpanded, onToggle }: { run: TriageRun; isExpanded: boolean; onToggle: () => void }) {
  const date = new Date(run.startedAt);

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-bg-elevated transition-colors"
      >
        <svg
          className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        <span className="text-xs font-mono text-text-muted w-36 flex-shrink-0">
          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        <span className="text-xs font-mono text-text-primary">
          {run.issuesProcessed} issue{run.issuesProcessed === 1 ? '' : 's'}
        </span>

        <div className="flex gap-1.5 flex-shrink-0">
          {run.autoFixed > 0 && <DecisionChip decision="auto-fixed" count={run.autoFixed} />}
          {run.needsReview > 0 && <DecisionChip decision="needs-review" count={run.needsReview} />}
          {run.notABug > 0 && <DecisionChip decision="not-a-bug" count={run.notABug} />}
          {run.errors > 0 && <DecisionChip decision="error" count={run.errors} />}
        </div>

        <span className="text-xs font-mono text-text-muted ml-auto flex-shrink-0">
          ${Number(run.totalCostUsd).toFixed(2)}
        </span>

        {run.dryRun && (
          <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-soft text-purple flex-shrink-0">
            dry run
          </span>
        )}
      </button>

      {isExpanded && run.issues.length > 0 && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-text-muted text-[10px] uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Issue</th>
                  <th className="text-left px-4 py-2">Title</th>
                  <th className="text-left px-4 py-2">Decision</th>
                  <th className="text-left px-4 py-2">Confidence</th>
                  <th className="text-left px-4 py-2">PR</th>
                  <th className="text-right px-4 py-2">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run.issues.map(issue => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: TriageIssue }) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-bg-elevated cursor-pointer transition-colors"
        onClick={() => setShowExplanation(!showExplanation)}
      >
        <td className="px-4 py-2">
          <a
            href={issue.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple hover:underline"
            onClick={e => e.stopPropagation()}
          >
            #{issue.issueNumber}
          </a>
        </td>
        <td className="px-4 py-2 text-text-primary max-w-[200px] truncate">{issue.title}</td>
        <td className="px-4 py-2">
          <DecisionBadge decision={issue.decision} />
        </td>
        <td className="px-4 py-2">
          <ConfidenceBadge confidence={issue.confidence} />
        </td>
        <td className="px-4 py-2">
          {issue.prUrl ? (
            <a
              href={issue.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple hover:underline"
              onClick={e => e.stopPropagation()}
            >
              #{issue.prNumber}
            </a>
          ) : (
            <span className="text-text-muted">-</span>
          )}
        </td>
        <td className="px-4 py-2 text-right text-text-muted">${Number(issue.costUsd).toFixed(2)}</td>
      </tr>
      {showExplanation && (
        <tr>
          <td colSpan={6} className="px-4 py-3 bg-bg-elevated">
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{issue.explanation}</p>
            {issue.changedFiles && issue.changedFiles.length > 0 && (
              <p className="text-[10px] text-text-muted mt-2">
                Changed: {(issue.changedFiles as string[]).join(', ')}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DecisionChip({ decision, count }: { decision: string; count: number }) {
  const colors: Record<string, string> = {
    'auto-fixed': 'bg-green/20 text-green',
    'needs-review': 'bg-yellow/20 text-yellow',
    'not-a-bug': 'bg-text-muted/20 text-text-muted',
    'error': 'bg-red/20 text-red',
  };
  const cls = colors[decision] || 'bg-text-muted/20 text-text-muted';

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${cls}`}>
      {count}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    'auto-fixed': { cls: 'bg-green/20 text-green', label: 'auto-fixed' },
    'needs-review': { cls: 'bg-yellow/20 text-yellow', label: 'needs review' },
    'not-a-bug': { cls: 'bg-text-muted/20 text-text-muted', label: 'not a bug' },
  };
  const { cls, label } = config[decision] || { cls: 'bg-text-muted/20 text-text-muted', label: decision };

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    high: 'text-green',
    medium: 'text-yellow',
    low: 'text-red',
  };
  return <span className={`${colors[confidence] || 'text-text-muted'}`}>{confidence}</span>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-[10px] font-mono text-text-muted">{label}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const textColor = color === 'green' ? 'text-green'
    : color === 'yellow' ? 'text-yellow'
    : color === 'red' ? 'text-red'
    : color === 'muted' ? 'text-text-muted'
    : 'text-text-primary';

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold font-mono mt-1 ${textColor}`}>{value}</p>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
