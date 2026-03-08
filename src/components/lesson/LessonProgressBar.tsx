import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SECTION_TYPE_LABELS } from './sectionLabels';

interface LessonProgressBarProps {
  current: number;
  total: number;
  onClose: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  lessonTitle?: string;
  onReportBug?: () => void;
  onSkip?: () => void;
  sectionType?: string;
}

export function LessonProgressBar({ current, total, onClose, onBack, canGoBack, lessonTitle, onReportBug, onSkip, sectionType }: LessonProgressBarProps) {
  const { user } = useAuth();
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex-shrink-0 px-4 py-3 md:px-8 lg:px-12 xl:px-16">
      <div className="flex items-center gap-3">
        {/* Home button — always visible */}
        <div className="relative flex-shrink-0 group">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Go home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
          </button>
          <span className="pointer-events-none absolute top-full left-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
            Home
          </span>
        </div>

        {/* Back button — shown when not on first section */}
        {canGoBack && onBack && (
          <div className="relative flex-shrink-0 group">
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="pointer-events-none absolute top-full left-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              Go back
            </span>
          </div>
        )}

        <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-purple rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, boxShadow: pct > 0 ? '0 0 8px rgba(255, 107, 53, 0.3)' : undefined }}
          />
        </div>

        <span className="text-[11px] font-mono font-semibold text-text-muted tabular-nums flex-shrink-0">
          <span className="hidden sm:inline">Section </span>{current + 1}<span className="text-text-muted/60"> of </span>{total}
        </span>

        {onSkip && (
          <div className="relative flex-shrink-0 group">
            <button
              onClick={onSkip}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-yellow hover:bg-bg-elevated transition-colors"
              aria-label="Skip this lesson"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
            <span className="pointer-events-none absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              Skip lesson
            </span>
          </div>
        )}

        {onReportBug && (
          <div className="relative flex-shrink-0 group">
            <button
              onClick={onReportBug}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              aria-label="Report a bug"
              title="Report a bug"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.97l-7-12a2 2 0 00-3.5 0l-7 12A2 2 0 005.07 19z" />
              </svg>
            </button>
            <span className="pointer-events-none absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              Report a bug
            </span>
          </div>
        )}

        {user && (
          <div className="relative flex-shrink-0 group">
            <Link
              to="/dashboard"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              aria-label="Dashboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </Link>
            <span className="pointer-events-none absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              Dashboard
            </span>
          </div>
        )}

      </div>

      {/* Lesson title + section type indicator */}
      <div className="flex items-center justify-center gap-2 mt-1.5">
        {sectionType && SECTION_TYPE_LABELS[sectionType] && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-soft border border-purple/10 text-[11px] font-mono font-semibold text-purple flex-shrink-0">
            <span>{SECTION_TYPE_LABELS[sectionType].icon}</span>
            {SECTION_TYPE_LABELS[sectionType].label}
          </span>
        )}
        {lessonTitle && (
          <p className="text-xs text-text-muted truncate">
            {lessonTitle}
          </p>
        )}
      </div>
    </div>
  );
}
