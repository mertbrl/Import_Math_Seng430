import React, { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode;
  align?: 'auto' | 'left' | 'right';
  iconSize?: number;
  panelWidthClassName?: string;
}

const InfoPopover: React.FC<InfoPopoverProps> = ({
  title,
  children,
  align = 'auto',
  iconSize = 14,
  panelWidthClassName = 'w-80',
}) => {
  const [open, setOpen] = useState(false);
  const [resolvedAlign, setResolvedAlign] = useState<'left' | 'right'>('left');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (align !== 'auto') {
      setResolvedAlign(align);
      return;
    }

    const rootRect = rootRef.current?.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!rootRect || !panelRect) {
      return;
    }

    const spaceRight = window.innerWidth - rootRect.left;
    const spaceLeft = rootRect.right;
    if (panelRect.width <= spaceRight) {
      setResolvedAlign('left');
      return;
    }
    if (panelRect.width <= spaceLeft) {
      setResolvedAlign('right');
      return;
    }
    setResolvedAlign(spaceRight >= spaceLeft ? 'left' : 'right');
  }, [align, open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Learn more about ${title}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
          open
            ? 'border-indigo-300 bg-indigo-100 text-indigo-700'
            : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-200 hover:text-indigo-600'
        }`}
      >
        <CircleHelp size={iconSize} />
      </button>

      {open ? (
        <div
          id={popoverId}
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          className={`absolute top-full z-40 mt-2 max-w-[calc(100vw-2rem)] ${panelWidthClassName} rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl ${
            resolvedAlign === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black tracking-tight text-slate-900">{title}</p>
            </div>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
        </div>
      ) : null}
    </div>
  );
};

export default InfoPopover;
