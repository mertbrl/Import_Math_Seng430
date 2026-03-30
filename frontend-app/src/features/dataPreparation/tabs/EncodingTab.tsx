import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { buildApiUrl } from '../../../config/apiConfig';
import { Tag, CheckCircle2, ChevronRight, Settings2, Loader2, AlertCircle } from 'lucide-react';

interface EncodingColumn {
  column: string;
  unique_count: number;
  sample_values: string[];
  recommendation: string;
}

const ENCODING_LABELS: Record<string, string> = {
  onehot: 'One-Hot Encoding (drop first)',
  label: 'Label Encoding',
  target: 'Target Encoding (with Smoothing)',
  none: 'No Encoding',
};

const EncodingTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, confirmAndInvalidateLaterSteps } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const targetColumn = useEDAStore(s => s.targetColumn);
  const isComplete = completedSteps.includes('encoding');

  const [columns, setColumns] = useState<EncodingColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl('/encoding-stats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'demo-session',
          excluded_columns: ignoredColumns ?? [],
          target_column: targetColumn || undefined,
        }),
      });
      const data = await res.json();
      const cols = data.columns ?? [];
      setColumns(cols);
      const init: Record<string, string> = {};
      cols.forEach((c: EncodingColumn) => { init[c.column] = c.recommendation; });
      setStrategies(init);
    } catch (e) {
      setError(`Failed to fetch encoding data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns, targetColumn]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = () => {
    if (!confirmAndInvalidateLaterSteps('encoding', 'Changing encoding will remove all accepted work in the later steps. Do you want to continue?')) return;
    addPipelineAction({ step: 'encoding', action: 'encode_categoricals', strategies });
    toggleStepComplete('encoding', true);
    setActiveTab('scaling');
  };

  const handleSkip = () => {
    if (!confirmAndInvalidateLaterSteps('encoding', 'Skipping this step now will remove all accepted work in the later steps. Do you want to continue?')) return;
    toggleStepComplete('encoding', true);
    setActiveTab('scaling');
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium text-slate-500">Scanning categorical columns...</p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
      <AlertCircle size={18} /><div><strong>Error:</strong> {error}</div>
    </div>
  );

  if (columns.length === 0) return (
    <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl">
      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
      <h3 className="font-bold text-emerald-800 text-lg mb-1">No Categorical Columns</h3>
      <p className="text-emerald-700 text-sm">All features are numerical. No encoding required.</p>
      <button onClick={handleSkip} className="mt-4 text-sm font-bold text-indigo-600 hover:underline cursor-pointer">
        Continue to Scaling →
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600 shrink-0"><Tag size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Feature Encoding</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              ML models require numerical input. Cardinality determines the best encoding strategy:
              <strong className="text-sky-700"> One-Hot</strong> for low cardinality (≤10 unique),
              <strong className="text-sky-700"> Label</strong> for binary,
              <strong className="text-sky-700"> Target</strong> for high cardinality (&gt;10 unique) with smoothing to prevent leakage.
            </p>
          </div>
        </div>
      </div>

      {/* Use System Suggestions */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{columns.length} categorical columns detected</span>
        <button
          onClick={() => {
            const s: Record<string, string> = {};
            columns.forEach(c => { s[c.column] = c.recommendation; });
            setStrategies(s);

            if (!confirmAndInvalidateLaterSteps('encoding', 'Applying these system suggestions will remove all accepted work in the later steps. Do you want to continue?')) return;
            addPipelineAction({ step: 'encoding', action: 'encode_categoricals', strategies: s });
            toggleStepComplete('encoding', true);
            setActiveTab('scaling');
          }}
          className="flex flex-col items-end gap-0.5 cursor-pointer"
        >
          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
            <Settings2 size={14} /> Use System Suggestions
          </span>
          <span className="text-[10px] text-slate-400 pr-1">Applies suggestions &amp; advances to Feature Scaling →</span>
        </button>
      </div>

      <div className="max-h-[560px] overflow-y-auto pr-1">
        <div className="space-y-3">
          {columns.map(col => {
          const currentStrategy = strategies[col.column] ?? col.recommendation;
          return (
            <div key={col.column} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-sky-200 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-900">{col.column}</span>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {col.unique_count} unique values
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Samples: <span className="font-mono text-slate-700">{col.sample_values.slice(0, 5).join(', ')}</span>
                    {col.sample_values.length > 5 && ' ...'}
                  </div>
                  <div className="text-xs p-3 rounded-lg bg-sky-50 border border-sky-100 text-sky-800">
                    <span className="font-bold uppercase text-[10px] tracking-wide flex items-center gap-1 mb-1"><Settings2 size={11} /> SYSTEM SUGGESTION</span>
                    {col.recommendation === 'label' && 'Binary column — Label Encoding assigns 0/1 without introducing multicollinearity.'}
                    {col.recommendation === 'onehot' && `Low cardinality (${col.unique_count} values) — One-Hot Encoding with drop='first' to avoid the dummy variable trap.`}
                    {col.recommendation === 'target' && `High cardinality (${col.unique_count} values) — Target Encoding with smoothing prevents overfitting on rare categories.`}
                  </div>
                </div>
                <div className="md:w-60 shrink-0">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Encoding Method</label>
                  <select
                    value={currentStrategy}
                    onChange={e => setStrategies(prev => ({ ...prev, [col.column]: e.target.value }))}
                    className="w-full appearance-none border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 cursor-pointer transition-all"
                  >
                    <option value="none">No Encoding</option>
                    <option value="label">Label Encoding {col.recommendation === 'label' ? '(System Suggestion)' : ''}</option>
                    <option value="onehot">One-Hot Encoding {col.recommendation === 'onehot' ? '(System Suggestion)' : ''}</option>
                    <option value="target">Target Encoding {col.recommendation === 'target' ? '(System Suggestion)' : ''}</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2 text-right">{ENCODING_LABELS[currentStrategy] ?? ''}</p>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </div>

      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} /> Encoding Confirmed
          </div>
        ) : (
          <button onClick={handleSkip} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer underline-offset-2 hover:underline">
            Skip this step →
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-sky-600 text-white hover:bg-sky-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Encoding <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default EncodingTab;
