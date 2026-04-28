import React, { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useDomainStore } from '../store/useDomainStore';

export interface TutorialStep {
  eyebrow: string;
  title: string;
  body: string;
  targetSelector?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  storageKey: string;
  startOpen?: boolean;
  reopenEventName?: string;
}

type TutorialTargetRect = Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>;

const SCROLL_KEYS = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);
const TARGET_VISIBILITY_MARGIN = 24;

function snapshotRect(rect: DOMRect): TutorialTargetRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function hasCompletedTutorial(storageKey: string) {
  try {
    return window.localStorage.getItem(storageKey) === 'done';
  } catch {
    return false;
  }
}

function saveTutorialState(storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, 'done');
  } catch {
    // Tutorial dismissal should never block the workflow.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveCardPosition(
  targetRect: TutorialTargetRect | null,
  placement: TutorialStep['placement'] = 'right',
  cardHeight = 320,
): CSSProperties {
  const cardWidth = Math.min(window.innerWidth - 32, 480);
  const gutter = 18;

  if (!targetRect) {
    return {
      right: '1.25rem',
      bottom: '1.25rem',
      width: `min(calc(100vw - 2.5rem), ${cardWidth}px)`,
    };
  }

  const positions: Record<NonNullable<TutorialStep['placement']>, { top: number; left: number }> = {
    right: {
      top: targetRect.top + targetRect.height / 2 - cardHeight / 2,
      left: targetRect.right + gutter,
    },
    left: {
      top: targetRect.top + targetRect.height / 2 - cardHeight / 2,
      left: targetRect.left - cardWidth - gutter,
    },
    bottom: {
      top: targetRect.bottom + gutter,
      left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
    },
    top: {
      top: targetRect.top - cardHeight - gutter,
      left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
    },
  };

  let { top, left } = positions[placement];

  if (left + cardWidth > window.innerWidth - 16 || left < 16) {
    left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    top = targetRect.bottom + gutter;
  }

  if (top + cardHeight > window.innerHeight - 16) {
    top = targetRect.top - cardHeight - gutter;
  }

  return {
    top: clamp(top, 16, Math.max(16, window.innerHeight - cardHeight - 16)),
    left: clamp(left, 16, Math.max(16, window.innerWidth - cardWidth - 16)),
    width: `min(calc(100vw - 2rem), ${cardWidth}px)`,
  };
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ steps, storageKey, startOpen = true, reopenEventName }) => {
  const [isOpen, setIsOpen] = useState(() => startOpen && !hasCompletedTutorial(storageKey));
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TutorialTargetRect | null>(null);
  const [cardHeight, setCardHeight] = useState(320);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const initialWindowScrollRef = useRef({ x: 0, y: 0 });

  const setTutorialActive = useDomainStore((state) => state.setTutorialActive);

  const closeTutorial = useCallback(() => {
    saveTutorialState(storageKey);
    setIsOpen(false);
    window.scrollTo(initialWindowScrollRef.current.x, initialWindowScrollRef.current.y);
  }, [storageKey]);

  // Sync isTutorialActive in the global store so toggleHelp can block chatbot opens.
  useEffect(() => {
    setTutorialActive(isOpen);
    return () => { if (isOpen) setTutorialActive(false); };
  }, [isOpen, setTutorialActive]);

  useEffect(() => {
    setIsOpen(startOpen && !hasCompletedTutorial(storageKey));
    setActiveIndex(0);
  }, [startOpen, storageKey]);

  useEffect(() => {
    if (!reopenEventName) return;

    const reopenTutorial = () => {
      setActiveIndex(0);
      setIsOpen(true);
    };

    window.addEventListener(reopenEventName, reopenTutorial);
    return () => window.removeEventListener(reopenEventName, reopenTutorial);
  }, [reopenEventName]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const activeStep = steps[activeIndex];
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const measureTarget = () => {
      if (!activeStep?.targetSelector) {
        setTargetRect(null);
        return;
      }

      const target = document.querySelector(activeStep.targetSelector);
      if (!target) {
        setTargetRect(null);
        return;
      }

      setTargetRect(snapshotRect(target.getBoundingClientRect()));
    };

    const queueMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measureTarget);
    };

    const alignTarget = () => {
      if (!activeStep?.targetSelector) {
        setTargetRect(null);
        return null;
      }

      const target = document.querySelector(activeStep.targetSelector);
      if (!target) {
        setTargetRect(null);
        return null;
      }

      const rect = target.getBoundingClientRect();
      const fullyVisible =
        rect.top >= TARGET_VISIBILITY_MARGIN &&
        rect.left >= TARGET_VISIBILITY_MARGIN &&
        rect.bottom <= window.innerHeight - TARGET_VISIBILITY_MARGIN &&
        rect.right <= window.innerWidth - TARGET_VISIBILITY_MARGIN;

      if (!fullyVisible) {
        target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      }

      return target;
    };

    const target = alignTarget();
    queueMeasure();

    if (target && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(queueMeasure);
      resizeObserver.observe(target);
    }

    window.addEventListener('resize', queueMeasure);
    window.addEventListener('scroll', queueMeasure, true);
    window.visualViewport?.addEventListener('resize', queueMeasure);
    window.visualViewport?.addEventListener('scroll', queueMeasure);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', queueMeasure);
      window.removeEventListener('scroll', queueMeasure, true);
      window.visualViewport?.removeEventListener('resize', queueMeasure);
      window.visualViewport?.removeEventListener('scroll', queueMeasure);
    };
  }, [activeIndex, isOpen, steps]);

  useLayoutEffect(() => {
    if (!isOpen || !cardRef.current) return;

    const updateCardSize = () => {
      if (!cardRef.current) return;
      setCardHeight(cardRef.current.getBoundingClientRect().height || 320);
    };

    updateCardSize();

    if (!('ResizeObserver' in window)) return;

    const observer = new ResizeObserver(updateCardSize);
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [activeIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    initialWindowScrollRef.current = { x: window.scrollX, y: window.scrollY };

    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    const preventScroll = (event: Event) => {
      event.preventDefault();
    };

    const preventScrollKeys = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const isTutorialControl = Boolean(target?.closest('.ha-tutorial-card button, .ha-tutorial-card a, .ha-tutorial-card input, .ha-tutorial-card textarea, .ha-tutorial-card select'));

      if (event.key === 'Escape') {
        closeTutorial();
        return;
      }

      if (SCROLL_KEYS.has(event.key) && !isTutorialControl) {
        event.preventDefault();
      }
    };

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener('wheel', preventScroll, listenerOptions);
    window.addEventListener('touchmove', preventScroll, listenerOptions);
    window.addEventListener('keydown', preventScrollKeys, true);

    return () => {
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      window.removeEventListener('wheel', preventScroll, listenerOptions);
      window.removeEventListener('touchmove', preventScroll, listenerOptions);
      window.removeEventListener('keydown', preventScrollKeys, true);
    };
  }, [closeTutorial, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    nextButtonRef.current?.focus();
  }, [activeIndex, isOpen]);

  if (!isOpen || steps.length === 0) return null;

  const activeStep = steps[activeIndex];
  const isLast = activeIndex === steps.length - 1;
  const paddedTarget = targetRect
    ? (() => {
        const top = Math.max(8, targetRect.top - 10);
        const left = Math.max(8, targetRect.left - 10);
        const right = Math.min(window.innerWidth - 8, targetRect.right + 10);
        const bottom = Math.min(window.innerHeight - 8, targetRect.bottom + 10);
        return {
          top,
          left,
          right,
          bottom,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        };
      })()
    : null;

  return (
    <div className="ha-tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="ha-tutorial-title">
      {paddedTarget && (
        <>
          <div className="ha-tutorial-scrim" style={{ top: 0, left: 0, right: 0, height: paddedTarget.top }} />
          <div className="ha-tutorial-scrim" style={{ top: paddedTarget.bottom, left: 0, right: 0, bottom: 0 }} />
          <div className="ha-tutorial-scrim" style={{ top: paddedTarget.top, left: 0, width: paddedTarget.left, height: paddedTarget.height }} />
          <div className="ha-tutorial-scrim" style={{ top: paddedTarget.top, left: paddedTarget.right, right: 0, height: paddedTarget.height }} />
          <div
            className="ha-tutorial-spotlight"
            style={{
              top: paddedTarget.top,
              left: paddedTarget.left,
              width: paddedTarget.right - paddedTarget.left,
              height: paddedTarget.bottom - paddedTarget.top,
            }}
          />
          {/* Transparent click-blocker — prevents accidental activation of the
              highlighted element (e.g. floating AI chat button opening the drawer)
              while the tutorial card is still visible. */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: paddedTarget.top,
              left: paddedTarget.left,
              width: paddedTarget.right - paddedTarget.left,
              height: paddedTarget.bottom - paddedTarget.top,
              zIndex: 9999,
              cursor: 'default',
            }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          />
        </>
      )}

      {!paddedTarget && <div className="ha-tutorial-scrim ha-tutorial-scrim-full" />}

      <div
        ref={cardRef}
        className="ha-tutorial-card"
        style={resolveCardPosition(targetRect, activeStep.placement, cardHeight)}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="ha-tutorial-eyebrow">{activeStep.eyebrow}</p>
            <h2 id="ha-tutorial-title" className="ha-tutorial-title">{activeStep.title}</h2>
          </div>
          <button type="button" className="ha-tutorial-close" onClick={closeTutorial} aria-label="Close tutorial">
            <X size={18} />
          </button>
        </div>

        <p className="ha-tutorial-body">{activeStep.body}</p>

        <div className="ha-tutorial-progress" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} data-active={index === activeIndex} />
          ))}
        </div>

        <div className="ha-tutorial-actions">
          <button type="button" className="ha-tutorial-skip" onClick={closeTutorial}>
            No thanks
          </button>
          <button
            ref={nextButtonRef}
            type="button"
            className="ha-tutorial-next"
            onClick={() => {
              if (isLast) {
                closeTutorial();
                return;
              }
              setActiveIndex((current) => current + 1);
            }}
          >
            {isLast ? 'Finish' : 'Continue'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
