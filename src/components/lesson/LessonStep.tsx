import { type ReactNode, useEffect } from 'react';
import { SECTION_TYPE_LABELS } from './sectionLabels';
import { useSectionType } from './SectionRenderer';

interface CtaAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface LessonStepProps {
  children: ReactNode;
  cta?: CtaAction;
  secondaryCta?: CtaAction;
}

export function LessonStep({ children, cta, secondaryCta }: LessonStepProps) {
  const sectionType = useSectionType();
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isDisabledInput = (tag === 'INPUT' || tag === 'TEXTAREA') && (target as HTMLInputElement).disabled;
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) && !isDisabledInput) return;

      if ((e.key === 'Enter' || e.key === 'n' || e.key === 'ArrowRight') && cta && !cta.disabled) {
        e.preventDefault();
        cta.onClick();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cta]);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pt-6 pb-8" style={{ paddingLeft: 'clamp(24px, 4vw, 112px)', paddingRight: 'clamp(24px, 4vw, 112px)' }}>
        <div className="max-w-[700px] mx-auto">
          {sectionType && SECTION_TYPE_LABELS[sectionType] && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-elevated text-[11px] font-mono font-medium text-text-muted">
                <span>{SECTION_TYPE_LABELS[sectionType].icon}</span>
                {SECTION_TYPE_LABELS[sectionType].label}
              </span>
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Bottom-fixed CTA bar */}
      {(cta || secondaryCta) && (
        <div className="flex-shrink-0 border-t border-border-strong bg-bg-primary/95 backdrop-blur-sm py-5 safe-bottom" style={{ paddingLeft: 'clamp(24px, 4vw, 112px)', paddingRight: 'clamp(24px, 4vw, 112px)', boxShadow: 'var(--shadow-cta-bar)' }}>
          <div className="max-w-[700px] mx-auto flex gap-3">
            {secondaryCta && (
              <button
                onClick={secondaryCta.onClick}
                className="flex-1 px-5 py-3.5 bg-bg-card text-text-primary border border-border rounded-lg text-[15px] lg:text-[16px] font-medium hover:border-border-strong active:scale-[0.98] transition-all"
              >
                {secondaryCta.label}
              </button>
            )}
            {cta && (
              <button
                onClick={cta.onClick}
                disabled={cta.disabled}
                className="flex-1 px-5 py-3.5 bg-purple text-white rounded-lg text-[15px] lg:text-[16px] font-semibold transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                style={!cta.disabled ? { boxShadow: 'var(--shadow-button)' } : undefined}
              >
                {cta.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
