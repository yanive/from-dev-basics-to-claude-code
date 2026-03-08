import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLessonEngine } from '../../hooks/useLessonEngine';
import { validateLesson } from '../../core/lesson/LessonEngine';
import { useProgress } from '../../hooks/useProgress';
import { getLessonById, getLevelForLesson, levels as allLevels } from '../../data/levels';
import { LEVELS } from '../../lib/constants';
import { SectionRenderer } from './SectionRenderer';
import { LessonComplete } from './LessonComplete';
import { MilestoneScreen } from './MilestoneScreen';
import { LessonProgressBar } from './LessonProgressBar';
import { BugReportModal, type BugReportContext } from './BugReportModal';
import { TerminalProvider, useTerminal } from '../../core/terminal/TerminalContext';
import { pushCompletion, pushSkip } from '../../services/progressSync';
import { useAchievements } from '../../contexts/AchievementContext';
import { apiFetch } from '../../services/api';

/** Renders BugReportModal inside TerminalProvider scope so it can access terminal context */
function TerminalBugReport({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  sectionIndex,
  totalSections,
  currentSection,
}: {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  sectionIndex: number;
  totalSections: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentSection: any;
}) {
  const { history, vfs, lastCommand } = useTerminal();

  const context: BugReportContext = {
    lessonId,
    lessonTitle,
    sectionIndex,
    totalSections,
    instruction: currentSection?.instruction || currentSection?.prompt,
    validation: currentSection?.validation,
    terminalHistory: history.slice(-30).map((l) => ({ type: l.type, text: l.text })),
    lastCommand,
    vfsState: vfs.toJSON('/'),
    cwd: vfs.getCwd(),
  };

  return <BugReportModal isOpen={isOpen} onClose={onClose} context={context} />;
}

export function LessonView() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const lesson = lessonId ? getLessonById(lessonId) : null;
  const level = lessonId ? getLevelForLesson(lessonId) : null;
  const { currentSectionIndex, markLessonComplete, markLessonSkipped, isLessonComplete: isProgressComplete, setCurrentLesson, setCurrentSection } = useProgress();
  const engine = useLessonEngine(lesson, currentSectionIndex);
  const { checkForNewAchievements } = useAchievements();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // Dev-time content validation
  useEffect(() => {
    if (import.meta.env.DEV && lesson) {
      const warnings = validateLesson(lesson);
      warnings.forEach(w => console.warn(`[LessonValidation] ${w}`));
    }
  }, [lesson]);

  const isComplete = engine?.isLessonComplete() ?? false;
  const isLastLesson = level ? level.lessons[level.lessons.length - 1].id === lessonId : false;
  const showMilestone = isComplete && isLastLesson && lesson?.milestone;
  const showCompletion = isComplete && !showMilestone;

  // Set current lesson on mount
  useEffect(() => {
    if (lessonId) {
      setCurrentLesson(lessonId, 0);
    }
  }, [lessonId, setCurrentLesson]);

  const handleExitLesson = useCallback(() => {
    const idx = engine?.getCurrentSectionIndex() ?? 0;
    const complete = engine?.isLessonComplete() ?? false;
    if (idx > 0 && !complete) {
      setShowSavedToast(true);
      setTimeout(() => navigate('/'), 1200);
    } else {
      navigate('/');
    }
  }, [navigate, engine]);

  const handleGoBack = useCallback(() => {
    if (!engine) return;
    setIsTransitioning(true);
    setTimeout(() => {
      engine.goBack();
      const newIndex = engine.getCurrentSectionIndex();
      setCurrentSection(newIndex);
      setIsTransitioning(false);
    }, 200);
  }, [engine, setCurrentSection]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'Escape') {
        handleExitLesson();
      }
      if ((e.key === 'p' || e.key === 'ArrowLeft') && engine && engine.getCurrentSectionIndex() > 0) {
        handleGoBack();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExitLesson, engine, handleGoBack]);

  const alreadyCompleted = lessonId ? isProgressComplete(lessonId) : false;

  function handleSkipLesson() {
    if (lessonId) {
      markLessonSkipped(lessonId);
      pushSkip(lessonId);
    }
    navigate('/');
  }

  if (!lesson || !engine || !level || !lessonId) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        Lesson not found.
      </div>
    );
  }

  const eng = engine;
  const les = lesson;

  const currentSection = eng.getCurrentSection();
  const sectionIndex = eng.getCurrentSectionIndex();
  const totalSections = les.sections.length;

  function handleSectionComplete() {
    setIsTransitioning(true);
    setTimeout(async () => {
      eng.advance();
      const newIndex = eng.getCurrentSectionIndex();
      setCurrentSection(newIndex);

      if (eng.isLessonComplete()) {
        // Snapshot current achievements before marking complete
        const beforeIds: string[] = [];
        if (import.meta.env.VITE_USE_API === 'true') {
          try {
            const snap = await apiFetch('/api/progress/achievements');
            if (snap.ok) {
              const d = await snap.json();
              beforeIds.push(...d.earned.map((a: { id: string }) => a.id));
            }
          } catch { /* ignore */ }
        }

        markLessonComplete(lessonId!, les.level);
        await pushCompletion(lessonId!, totalSections - 1);

        // Check for newly earned achievements
        if (import.meta.env.VITE_USE_API === 'true') {
          checkForNewAchievements(beforeIds);
        }
      }
      setIsTransitioning(false);
    }, 200);
  }

  function handleNextLesson() {
    if (les.nextLesson && getLessonById(les.nextLesson)) {
      setCurrentLesson(les.nextLesson, 0);
      navigate(`/lesson/${les.nextLesson}`);
    }
  }

  // Find the next level by array position (supports non-sequential IDs like 4B = 45)
  const currentLevelIndex = allLevels.findIndex(l => l.id === level.id);
  const nextLevelData = currentLevelIndex >= 0 ? allLevels[currentLevelIndex + 1] : null;
  const nextLevelFirstLessonId = nextLevelData?.lessons[0]?.id ?? null;

  function handleNextLevel() {
    if (nextLevelFirstLessonId) {
      setCurrentLesson(nextLevelFirstLessonId, 0);
      navigate(`/lesson/${nextLevelFirstLessonId}`);
    }
  }

  // Derive next level info for milestone screen
  const nextLevelMeta = nextLevelData ? LEVELS.find(l => l.id === nextLevelData.id) : undefined;
  const nextLevelFirstLesson = nextLevelFirstLessonId ? getLessonById(nextLevelFirstLessonId) : null;
  const hasNextLevel = !!nextLevelMeta && !!nextLevelFirstLesson;

  // Milestone screen
  if (showMilestone && les.milestone) {
    return (
      <MilestoneScreen
        milestone={les.milestone}
        levelId={les.level}
        onContinue={handleExitLesson}
        onNextLevel={hasNextLevel ? handleNextLevel : undefined}
        nextLevelTitle={nextLevelMeta?.title}
      />
    );
  }

  // Lesson complete
  if (showCompletion) {
    return (
      <LessonComplete
        message={les.completionMessage || 'Great work! You completed this lesson.'}
        onNext={handleNextLesson}
        onHome={handleExitLesson}
        hasNext={!!les.nextLesson && !!getLessonById(les.nextLesson)}
      />
    );
  }

  // Active lesson
  const isTerminalLesson = les.type === 'terminal';
  const sectionContent = (
    <div className={`flex-1 overflow-hidden ${isTransitioning ? 'animate-slide-out-left' : 'animate-slide-in-right'}`}>
      {currentSection && (
        <SectionRenderer
          key={`${lessonId}-${sectionIndex}`}
          section={currentSection}
          onComplete={handleSectionComplete}
          commands={les.commandsIntroduced}
        />
      )}
    </div>
  );

  return (
    <div className="lesson-surface h-full flex flex-col bg-bg-primary">
      <LessonProgressBar
        current={sectionIndex}
        total={totalSections}
        onClose={handleExitLesson}
        onBack={handleGoBack}
        canGoBack={sectionIndex > 0}
        lessonTitle={les.title}
        onReportBug={import.meta.env.VITE_USE_API === 'true' ? () => setShowBugReport(true) : undefined}
        onSkip={!alreadyCompleted && !isComplete ? () => setShowSkipConfirm(true) : undefined}
        sectionType={currentSection?.type}
      />

      {/* Progress saved toast */}
      {showSavedToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-saved-toast" role="status">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-card border border-green/20 rounded-xl shadow-float">
            <svg className="w-4 h-4 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-mono text-text-primary">Progress saved</span>
          </div>
        </div>
      )}

      {/* Skip confirmation dialog */}
      {showSkipConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
          <div className="bg-bg-card border border-border rounded-2xl max-w-sm w-[90vw] p-6 animate-pop-in text-center">
            <span className="text-3xl mb-3 block">&#x23ED;&#xFE0F;</span>
            <h2 className="text-lg font-bold font-mono text-text-primary mb-2">Skip this lesson?</h2>
            <p className="text-sm text-text-secondary mb-5">
              You can always come back and complete it later. Skipped lessons don't count toward achievements.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="flex-1 px-4 py-3 text-sm font-mono text-text-muted hover:text-text-primary transition-colors rounded-xl border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSkipLesson}
                className="flex-1 px-4 py-3 bg-yellow/90 text-black rounded-xl text-sm font-semibold font-mono transition-all active:scale-[0.98]"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {isTerminalLesson ? (
        <TerminalProvider key={lessonId} initialFs={les.initialFs} initialDir={les.initialDir} curlMocks={les.curlMocks}>
          {sectionContent}
          <TerminalBugReport
            isOpen={showBugReport}
            onClose={() => setShowBugReport(false)}
            lessonId={lessonId}
            lessonTitle={les.title}
            sectionIndex={sectionIndex}
            totalSections={totalSections}
            currentSection={currentSection}
          />
        </TerminalProvider>
      ) : (
        <>
          {sectionContent}
          <BugReportModal
            isOpen={showBugReport}
            onClose={() => setShowBugReport(false)}
            context={{
              lessonId,
              lessonTitle: les.title,
              sectionIndex,
              totalSections,
              instruction: currentSection?.type === 'narrative' ? undefined : (currentSection as { instruction?: string })?.instruction,
            }}
          />
        </>
      )}
    </div>
  );
}
