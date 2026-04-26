import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, RotateCcw, SunMoon, Sun, Moon } from 'lucide-react';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

const TOTAL_STEPS = 7;

export const TopNavbar: React.FC = () => {
  const {
    currentStep,
    selectedDomainId,
    userMode,
    theme,
    toggleHelp,
    resetApp,
    setUserMode,
    setTheme,
  } = useDomainStore();

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const currentDomain = domains.find((domain) => domain.id === selectedDomainId) ?? domains[0];
  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="ha-navbar">
      <div className="page-wrap-wide flex min-h-[72px] flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--trust),var(--clinical))] shadow-[0_16px_34px_rgba(26,86,219,0.18)]">
            <div className="relative flex h-5 w-5 items-center justify-center">
              <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-white/30" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-[var(--font-display)] text-[22px] font-bold tracking-[-0.05em] text-[var(--text)]">
                Health AI
              </h1>
              <span className="ha-pill">
                {currentDomain.domainName}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text3)]">
              {currentDomain.clinicalQuestion}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <div className="ha-navbar-mini-progress">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span key={index} data-done={index + 1 <= currentStep} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <div className="flex items-center gap-2 rounded-[999px] border border-[var(--border)] bg-white/80 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setUserMode('clinical')}
              className={userMode === 'clinical' ? 'ha-mode-pill' : 'ha-pill border-transparent bg-transparent py-2'}
            >
              Doctor Mode
            </button>
            <button
              type="button"
              onClick={() => setUserMode('data_scientist')}
              className={userMode === 'data_scientist' ? 'ha-mode-pill' : 'ha-pill border-transparent bg-transparent py-2'}
            >
              Data Scientist
            </button>
          </div>

          <div className="ha-pill">
            Step {currentStep} of {TOTAL_STEPS} · {progressPercent}%
          </div>

          <button
            type="button"
            onClick={toggleHelp}
            className="ha-button-secondary inline-flex h-11 w-11 items-center justify-center p-0"
            aria-label="Open help"
            title="Help"
          >
            <HelpCircle size={17} />
          </button>

          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="ha-button-secondary inline-flex h-11 w-11 items-center justify-center p-0"
              aria-label="Theme settings"
              title="Theme Settings"
            >
              <SunMoon size={17} />
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 flex w-32 flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => {
                    setTheme('light');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${theme === 'light' ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'text-[var(--text2)] hover:bg-[var(--surface2)]'}`}
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setIsThemeMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'text-[var(--text2)] hover:bg-[var(--surface2)]'}`}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              void resetApp();
            }}
            className="ha-button-danger inline-flex h-11 w-11 items-center justify-center p-0"
            aria-label="Reset workflow"
            title="Reset workflow"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
    </nav>
  );
};
