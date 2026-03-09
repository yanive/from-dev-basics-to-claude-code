import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { levels, getLessonById } from '../../data/levels';
import { useProgress } from '../../hooks/useProgress';
import { useAuth } from '../../contexts/AuthContext';
import { LEVELS } from '../../lib/constants';
import { ClaudeIcon } from '../icons/ClaudeIcon';
import { ThemeToggle } from '../shared/ThemeToggle';
import { WelcomeOverlay, useOnboardingSeen } from './WelcomeOverlay';
import { LevelAssessment } from './LevelAssessment';
import { LEVEL_ASSESSMENTS } from '../../data/assessments';
import { useOnboardingPlan } from '../../hooks/useOnboardingPlan';
import { LevelCheatSheetModal } from './LevelCheatSheetModal';

const AI_ONBOARDING_MODAL_KEY = 'ai-onboarding-modal-dismissed';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function UserAvatar({ user, size = 'sm' }: { user: { displayName: string; profileImage?: string | null }; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';

  if (user.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={user.displayName}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <span className={`${dim} rounded-full bg-purple text-white flex items-center justify-center font-mono font-bold flex-shrink-0`}>
      {getInitials(user.displayName) || '?'}
    </span>
  );
}

const LEVEL_EMOJI: Record<number, string> = {
  0: '\u{1F4BB}', // laptop
  1: '\u{1F4DF}', // terminal/pager
  2: '\u{1F4D6}', // open book
  3: '\u{1F500}', // shuffle/git
  4: '\u{2601}\uFE0F',  // cloud
  45: '\u{1F4E1}', // satellite antenna — curl/HTTP requests
  5: '\u{1F528}', // hammer
  6: '\u{1F916}', // robot
  7: '\u{1F680}', // rocket
};

function hasCompletionToday(completionDates?: Record<string, string>): boolean {
  if (!completionDates) return false;
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(completionDates).some(d => d.slice(0, 10) === today);
}

function getCurrentStreak(completionDates?: Record<string, string>): number {
  if (!completionDates) return 0;
  const dates = new Set(Object.values(completionDates).map(d => d.slice(0, 10)));
  if (dates.size === 0) return 0;
  let streak = 0;
  const now = new Date();
  // Start from yesterday (today might not be done yet)
  for (let i = 0; i <= 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (dates.has(dateStr)) {
      streak++;
    } else if (i === 0) {
      // Today doesn't count yet, skip
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const { isLessonComplete, isLessonSkipped, completedLessons, skippedLessons, getLevelCompletedCount, getReviewLessons, currentSectionIndex, currentLessonId, completionDates } = useProgress();
  const { user, logout } = useAuth();
  const { plan: onboardingPlan, loading: planLoading, enabled: planEnabled, recommendedLessons } = useOnboardingPlan();

  // Smart expand: auto-expand current in-progress level + next level; for new users just level 0
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(() => {
    const availableLevels = LEVELS.filter(lm => levels.find(l => l.id === lm.id) != null);
    if (completedLessons.length === 0) {
      // New user: expand only the first level
      return new Set(availableLevels.length > 0 ? [availableLevels[0].id] : []);
    }
    // Find the current in-progress level (first level that isn't fully complete)
    const expanded = new Set<number>();
    let foundCurrent = false;
    for (const lm of availableLevels) {
      const done = getLevelCompletedCount(lm.id);
      const total = lm.lessonCount;
      if (!foundCurrent && done < total) {
        expanded.add(lm.id);
        foundCurrent = true;
      } else if (foundCurrent && expanded.size < 2) {
        // Also expand the next level
        expanded.add(lm.id);
        break;
      }
    }
    // If all levels complete, expand the last one
    if (!foundCurrent && availableLevels.length > 0) {
      expanded.add(availableLevels[availableLevels.length - 1].id);
    }
    return expanded;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [testOutLevel, setTestOutLevel] = useState<number | null>(null);
  const [cheatSheetLevel, setCheatSheetLevel] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { seen: onboardingSeen, markSeen: markOnboardingSeen } = useOnboardingSeen();
  const [showWelcome, setShowWelcome] = useState(!onboardingSeen && completedLessons.length === 0);

  // Show AI onboarding modal for logged-in users who haven't dismissed it and have no plan
  const [showAiModal, setShowAiModal] = useState(() => {
    if (!user) return false;
    if (localStorage.getItem(AI_ONBOARDING_MODAL_KEY) === 'true') return false;
    return true;
  });
  // Only show once plan loading resolves and conditions are met
  const aiModalVisible = showAiModal && !showWelcome && !planLoading && planEnabled && !onboardingPlan;

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  const toggleLevel = (levelId: number) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(levelId)) {
        next.delete(levelId);
      } else {
        next.add(levelId);
      }
      return next;
    });
  };

  const totalLessons = LEVELS.reduce((sum, l) => sum + l.lessonCount, 0);
  const totalCompleted = completedLessons.length;
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-bg-primary relative">
      {/* Onboarding overlay for first-time users */}
      {showWelcome && (
        <WelcomeOverlay onDismiss={() => { setShowWelcome(false); markOnboardingSeen(); }} />
      )}

      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'rgba(255, 107, 53, 0.03)', filter: 'blur(100px)' }}
      />

      <div className="relative max-w-6xl mx-auto px-5 py-6 sm:px-6 md:px-10 md:py-12 lg:px-14 xl:px-16 safe-bottom">
        {/* Hero */}
        <div className="mb-12 md:mb-16 animate-stagger-in">
          <div className="flex items-center gap-2 sm:gap-4 mb-4">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg bg-purple-soft border border-purple/20 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: 'var(--shadow-glow)' }}
            >
              <ClaudeIcon className="w-6 h-6 md:w-7 md:h-7 text-purple" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold text-text-primary tracking-tight font-mono">
                From Zero to Claude Code
              </h1>
              <p className="text-xs md:text-sm lg:text-base text-text-muted mt-0.5">
                Learn the command line from zero
              </p>
            </div>

            {/* Theme toggle + Auth section */}
            <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
              <ThemeToggle />

              {user ? (
                <>
                  {/* Desktop: dashboard button + logout icon */}
                  <Link
                    to="/dashboard"
                    className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-elevated/60 border border-border hover:border-purple/30 hover:bg-bg-elevated transition-colors"
                  >
                    <UserAvatar user={user} size="sm" />
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-text-primary leading-tight">{user.displayName}</span>
                      <span className="text-[10px] font-mono text-text-muted leading-tight">Dashboard</span>
                    </div>
                  </Link>
                  <div className="hidden md:block relative group">
                    <button
                      onClick={() => logout()}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                      aria-label="Logout"
                      title="Logout"
                    >
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                    <span className="pointer-events-none absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                      Logout
                    </span>
                  </div>

                  {/* Mobile: hamburger menu */}
                  <div className="relative md:hidden" ref={menuRef}>
                    <div className="relative group">
                      <button
                        onClick={() => setMobileMenuOpen(v => !v)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        aria-label="Menu"
                      >
                        {mobileMenuOpen ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                        )}
                      </button>
                      <span className="pointer-events-none absolute top-full right-0 mt-1.5 px-2 py-1 rounded-md bg-bg-card border border-border text-[10px] font-mono text-text-primary whitespace-nowrap opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                        {mobileMenuOpen ? 'Close menu' : 'Open menu'}
                      </span>
                    </div>

                    {/* Dropdown menu */}
                    {mobileMenuOpen && (
                      <div className="absolute right-0 top-11 w-48 bg-bg-card border border-border rounded-xl shadow-lg py-1 z-50 animate-fade-in">
                        <Link
                          to="/dashboard"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-mono text-text-primary hover:bg-bg-elevated transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <UserAvatar user={user} size="md" />
                          <div className="min-w-0">
                            <p className="text-sm font-mono text-text-primary truncate">{user.displayName}</p>
                            <p className="text-[11px] text-text-muted">Dashboard</p>
                          </div>
                        </Link>
                        <button
                          onClick={() => { logout(); setMobileMenuOpen(false); }}
                          className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm font-mono text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  to="/login"
                  className="text-xs font-mono text-purple hover:underline"
                >
                  Log in
                </Link>
              )}
            </div>
          </div>

          {/* Overall progress — desktop */}
          {totalCompleted > 0 && (
            <div className="hidden md:flex items-center gap-3 mt-5 pl-[60px]">
              <span className="text-sm lg:text-base font-mono text-text-muted">
                <span className="text-purple font-semibold">{totalCompleted}</span>
                <span className="opacity-50"> / {totalLessons} completed</span>
              </span>
              <div className="w-32 h-1 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple rounded-full transition-all duration-700"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Continue Learning banner for logged-in users with progress */}
        {user && currentLessonId && (
          <Link
            to={`/lesson/${currentLessonId}`}
            className="block mb-6 lg:mb-8 bg-bg-card border border-purple/20 rounded-xl p-4 md:p-5 hover:border-purple/40 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-soft border border-purple/20 flex items-center justify-center flex-shrink-0">
                <span className="text-purple font-mono font-bold text-sm">&gt;</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-purple uppercase tracking-wider">Continue learning</p>
                <p className="text-sm font-mono font-medium text-text-primary group-hover:text-purple transition-colors truncate">
                  Lesson {currentLessonId}
                </p>
              </div>
              <span className="text-xs font-mono text-purple bg-purple-soft px-2 py-1 rounded hidden sm:inline">
                Resume &rarr;
              </span>
            </div>
          </Link>
        )}

        {/* AI onboarding CTA for users without a plan */}
        {user && planEnabled && !onboardingPlan && !planLoading && (
          <Link
            to="/onboarding/ai"
            className="block mb-6 lg:mb-8 bg-bg-card border border-purple/15 rounded-xl p-4 md:p-5 hover:border-purple/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-soft border border-purple/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-mono font-medium text-text-primary group-hover:text-purple transition-colors flex items-center gap-1.5">
                  Generate a Personal Training Plan
                  <span className="text-[9px] font-bold text-purple bg-purple/10 px-1.5 py-0.5 rounded">AI</span>
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Tell us about your background, and AI will recommend the best path through the curriculum
                </p>
              </div>
              <span className="text-xs font-mono text-purple hidden sm:inline">Try it &rarr;</span>
            </div>
          </Link>
        )}

        {/* Daily goal & streak alert */}
        {user && completedLessons.length > 0 && (() => {
          const doneToday = hasCompletionToday(completionDates);
          const streak = getCurrentStreak(completionDates);

          return (
            <div className="mb-6 lg:mb-8 flex flex-col gap-2">
              {/* Daily goal */}
              {doneToday ? (
                <div className="flex items-center gap-3 bg-green-soft border border-green/20 rounded-xl px-4 py-3">
                  <span className="text-lg">&#x2705;</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-mono font-medium text-green">Daily goal reached!</p>
                    {streak > 0 && (
                      <p className="text-[11px] font-mono text-text-muted mt-0.5">
                        &#x1F525; Day {streak + 1} streak
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 py-3">
                  <span className="text-lg">&#x1F3AF;</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-mono font-medium text-text-primary">Daily goal: Complete 1 lesson</p>
                    {streak > 0 && (
                      <p className="text-[11px] font-mono text-yellow mt-0.5">
                        &#x26A0;&#xFE0F; Complete a lesson to keep your {streak}-day streak!
                      </p>
                    )}
                  </div>
                  {currentLessonId && (
                    <Link
                      to={`/lesson/${currentLessonId}`}
                      className="text-[12px] font-mono text-purple bg-purple-soft px-2.5 py-1 rounded hover:bg-purple/20 transition-colors flex-shrink-0"
                    >
                      Go &rarr;
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Spaced review recommendations */}
        {(() => {
          const reviewIds = getReviewLessons();
          if (reviewIds.length === 0) return null;
          const reviewLessons = reviewIds.map(id => getLessonById(id)).filter(Boolean);
          if (reviewLessons.length === 0) return null;
          return (
            <div className="mb-6 lg:mb-8">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-mono font-semibold text-text-primary">Review these lessons</h3>
                <span className="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">Spaced repetition</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {reviewLessons.map(lesson => lesson && (
                  <Link
                    key={lesson.id}
                    to={`/lesson/${lesson.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-bg-card border border-yellow/15 rounded-lg hover:border-yellow/30 transition-colors group"
                  >
                    <span className="text-[13px] font-mono text-text-primary group-hover:text-purple transition-colors">{lesson.title}</span>
                    <svg className="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Available level cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {LEVELS.filter(lm => levels.find(l => l.id === lm.id) != null).map((levelMeta, levelIdx) => {
            const levelData = levels.find(l => l.id === levelMeta.id)!;
            const completedCount = getLevelCompletedCount(levelMeta.id);
            const totalCount = levelMeta.lessonCount;
            const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const allLevelComplete = completedCount >= totalCount;
            const isCurrentLevel = !allLevelComplete && completedCount > 0;
            const isNotStarted = completedCount === 0 && !allLevelComplete;

            return (
              <div
                key={levelMeta.id}
                className={`animate-stagger-in bg-bg-card rounded-xl border transition-colors p-4 md:p-5 lg:p-6 ${
                  isCurrentLevel
                    ? 'border-purple/30 hover:border-purple/50'
                    : isNotStarted
                      ? 'border-border/60 opacity-70 hover:opacity-100 hover:border-border-strong'
                      : 'border-border hover:border-border-strong'
                }`}
                style={{ animationDelay: `${levelIdx * 60}ms`, boxShadow: 'var(--shadow-card)' }}
              >
                {/* Level header — clickable to expand/collapse */}
                <div
                  className="flex items-center gap-3 mb-3 cursor-pointer rounded-lg -mx-1 px-1 hover:bg-bg-elevated/30 transition-colors"
                  onClick={() => toggleLevel(levelMeta.id)}
                  role="button"
                  aria-expanded={expandedLevels.has(levelMeta.id)}
                >
                  <span className="text-lg">{LEVEL_EMOJI[levelMeta.id] ?? '\u{1F4DA}'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm lg:text-base font-semibold text-text-primary truncate font-mono">
                        {levelMeta.title}
                      </h2>
                      {allLevelComplete && (
                        <span className="flex-shrink-0 text-[10px] font-bold font-mono text-green bg-green-soft px-1.5 py-0.5 rounded">Done</span>
                      )}
                      {!allLevelComplete && onboardingPlan && (() => {
                        const ln = onboardingPlan.levelNotes.find(n => n.levelId === levelMeta.id);
                        if (!ln || ln.priority === 'low' || ln.priority === 'skip') return null;
                        return (
                          <span className={`flex-shrink-0 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                            ln.priority === 'high' ? 'text-purple bg-purple/10' : 'text-blue bg-blue/10'
                          }`}>
                            {ln.priority === 'high' ? 'Priority' : 'Useful'}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs lg:text-sm text-text-muted truncate mt-0.5">{levelMeta.subtitle}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform duration-200 flex-shrink-0 ${
                      expandedLevels.has(levelMeta.id) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Test Out + Cheat Sheet buttons */}
                {(isNotStarted && LEVEL_ASSESSMENTS.some(a => a.levelId === levelMeta.id) || levelData.lessons.some(l => l.commandsIntroduced?.length)) && (
                  <div className="flex items-center gap-3 mb-2">
                    {isNotStarted && LEVEL_ASSESSMENTS.some(a => a.levelId === levelMeta.id) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setTestOutLevel(levelMeta.id); }}
                        className="text-[11px] font-mono text-purple hover:underline"
                      >
                        Already know this? Test out &rarr;
                      </button>
                    )}
                    {levelData.lessons.some(l => l.commandsIntroduced?.length) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setCheatSheetLevel(levelMeta.id); }}
                        className="text-[11px] font-mono text-purple/70 hover:text-purple hover:underline flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Cheat sheet
                      </button>
                    )}
                  </div>
                )}

                {/* Progress bar */}
                {(() => {
                  const skippedInLevel = skippedLessons.filter(id => id.startsWith(`${levelMeta.id}.`)).length;
                  const skippedPct = totalCount > 0 ? Math.round((skippedInLevel / totalCount) * 100) : 0;
                  return (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden relative">
                        <div
                          className="absolute left-0 top-0 h-full bg-purple rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        {skippedInLevel > 0 && (
                          <div
                            className="absolute top-0 h-full rounded-full transition-all duration-500 opacity-40"
                            style={{
                              left: `${pct}%`,
                              width: `${skippedPct}%`,
                              background: 'repeating-linear-gradient(45deg, var(--color-yellow), var(--color-yellow) 2px, transparent 2px, transparent 4px)',
                            }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] lg:text-xs font-mono font-semibold text-text-muted tabular-nums">
                        {completedCount}/{totalCount}
                        {skippedInLevel > 0 && <span className="text-yellow ml-0.5">({skippedInLevel} skipped)</span>}
                      </span>
                    </div>
                  );
                })()}

                {/* Lessons — collapsible */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                    expandedLevels.has(levelMeta.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-0.5 pt-2">
                      {levelData.lessons.map((lesson) => {
                        const isDone = isLessonComplete(lesson.id);
                        const isSkipped = isLessonSkipped(lesson.id);
                        const isCurrent = lesson.id === currentLessonId;

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => navigate(`/lesson/${lesson.id}`)}
                            className={`
                              w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all
                              border border-transparent
                              hover:bg-bg-elevated/50 active:scale-[0.98]
                            `}
                          >
                            {/* Status indicator */}
                            <span className="flex-shrink-0">
                              {isDone ? (
                                <span className="w-5 h-5 rounded-full bg-green-soft flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              ) : isSkipped ? (
                                <span className="w-5 h-5 rounded-full bg-yellow/10 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                  </svg>
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-bg-elevated flex items-center justify-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                                </span>
                              )}
                            </span>

                            {/* Text */}
                            <div className="min-w-0 flex-1">
                              <p className={`text-[13px] lg:text-[15px] font-medium truncate ${
                                isDone ? 'text-text-secondary' : isSkipped ? 'text-text-muted' : 'text-text-primary'
                              }`}>
                                {lesson.title}
                              </p>
                              <p className="text-[11px] lg:text-xs text-text-muted truncate">{lesson.subtitle}</p>
                              {isSkipped && (
                                <span className="inline-flex items-center text-[9px] font-mono font-bold text-yellow bg-yellow/10 px-1.5 py-0.5 rounded mt-1">
                                  Skipped
                                </span>
                              )}
                              {!isDone && !isSkipped && recommendedLessons.has(lesson.id) && (
                                <span className="inline-flex items-center text-[9px] font-mono font-bold text-purple bg-purple/10 px-1.5 py-0.5 rounded mt-1">
                                  Recommended
                                </span>
                              )}
                              {isCurrent && !isDone && !isSkipped && currentSectionIndex > 0 && lesson.sections.length > 0 && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden max-w-[100px]">
                                    <div
                                      className="h-full bg-purple rounded-full transition-all duration-300"
                                      style={{ width: `${(currentSectionIndex / lesson.sections.length) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-text-muted tabular-nums">{currentSectionIndex}/{lesson.sections.length}</span>
                                </div>
                              )}
                            </div>

                            {/* Arrow */}
                            {!isDone && !isSkipped && (
                              <svg className="w-3.5 h-3.5 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming next — minimal roadmap for locked levels */}
        {LEVELS.filter(lm => levels.find(l => l.id === lm.id) == null).length > 0 && (
          <div className="mt-10 lg:mt-14 animate-stagger-in" style={{ animationDelay: '400ms' }}>
            <h3 className="text-sm font-mono font-semibold text-text-muted mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Coming soon
            </h3>
            <div className="flex flex-wrap gap-2">
              {LEVELS.filter(lm => levels.find(l => l.id === lm.id) == null).map((levelMeta) => (
                <span
                  key={levelMeta.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card/40 border border-border/40 text-xs font-mono text-text-muted"
                >
                  <span>{LEVEL_EMOJI[levelMeta.id] ?? '\u{1F4DA}'}</span>
                  {levelMeta.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Onboarding modal for first-time login */}
      {aiModalVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Get a personalized learning plan"
        >
          <div className="bg-bg-card border border-border rounded-2xl max-w-md w-[90vw] p-6 md:p-8 animate-pop-in text-center">
            <div className="w-14 h-14 rounded-xl bg-purple-soft border border-purple/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold font-mono text-text-primary mb-1">
              Want a Personalized Plan?
            </h2>
            <span className="inline-block text-[10px] font-bold font-mono text-purple bg-purple/10 px-2 py-0.5 rounded mb-3">AI-Powered</span>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              Tell us about your background and goals, and our AI will create a custom learning path — highlighting the lessons that matter most for you.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  localStorage.setItem(AI_ONBOARDING_MODAL_KEY, 'true');
                  setShowAiModal(false);
                }}
                className="flex-1 px-4 py-3 text-sm font-mono text-text-muted hover:text-text-primary transition-colors rounded-xl"
              >
                Maybe later
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(AI_ONBOARDING_MODAL_KEY, 'true');
                  setShowAiModal(false);
                  navigate('/onboarding/ai');
                }}
                className="flex-1 px-4 py-3 bg-purple text-white rounded-xl text-sm font-semibold font-mono transition-all active:scale-[0.98]"
                style={{ boxShadow: 'var(--shadow-button)' }}
              >
                Let's Go
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Out modal */}
      {testOutLevel !== null && (
        <LevelAssessment levelId={testOutLevel} onClose={() => setTestOutLevel(null)} />
      )}

      {/* Cheat Sheet modal */}
      {cheatSheetLevel !== null && (
        <LevelCheatSheetModal levelId={cheatSheetLevel} onClose={() => setCheatSheetLevel(null)} />
      )}
    </div>
  );
}
