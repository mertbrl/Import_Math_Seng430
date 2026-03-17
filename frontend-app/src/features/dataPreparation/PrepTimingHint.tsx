import React from 'react';
import { Clock3, Sparkles } from 'lucide-react';
import { getPrepTabSpec } from './DataPrepTabsConfig';

interface PrepTimingHintProps {
  tabId: string;
  compact?: boolean;
}

const pillBase =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold';

const PrepTimingHint: React.FC<PrepTimingHintProps> = ({ tabId, compact = false }) => {
  const tab = getPrepTabSpec(tabId);

  if (!tab) return null;

  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`${pillBase} border-slate-200 bg-slate-50 text-[10px] text-slate-600`}>
          <Clock3 size={11} />
          Est. {tab.estimatedTime}
        </span>
        {tab.suggestedTime && (
          <span className={`${pillBase} border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700`}>
            <Sparkles size={11} />
            Quick path {tab.suggestedTime}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className={`${pillBase} border-slate-200 bg-white text-xs text-slate-700`}>
        <Clock3 size={14} />
        Estimated time: {tab.estimatedTime}
      </span>
      {tab.suggestedTime && (
        <span className={`${pillBase} border-emerald-200 bg-emerald-50 text-xs text-emerald-700`}>
          <Sparkles size={14} />
          With system suggestions: {tab.suggestedTime}
        </span>
      )}
    </div>
  );
};

export default PrepTimingHint;
