import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { useDomainStore } from '../../../store/useDomainStore';
import { buildApiUrl } from '../../../config/apiConfig';
import { CheckCircle2, ChevronRight, Settings2, Loader2, AlertCircle, TrendingUp } from 'lucide-react';

interface TransformColumn {
  column: string;
  current_skewness: number;
  abs_skewness: number;
  has_negatives: boolean;
  needs_transform: boolean;
  recommendation: string | null;
}

const TransformationTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, confirmAndInvalidateLaterSteps } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const sessionId = useDomainStore((s) => s.sessionId);
  const isComplete = completedSteps.includes('transformation');

  const [columns, setColumns] = useState<TransformColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl('/transformation-stats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, excluded_columns: ignoredColumns ?? [] }),
      });
      const data = await res.json();
      setColumns(data.columns ?? []);
      useDataPrepStore.getState().setTabSuggestions('transformation', data.columns);
      // Set default strategies from recommendation
      const initStrategies: Record<string, string> = {};
      (data.columns ?? []).forEach((col: TransformColumn) => {
        initStrategies[col.column] = col.recommendation ?? 'none';
      });
      setStrategies(initStrategies);
    } catch (e) {
      setError(`Failed to fetch transformation data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = () => {
    if (!confirmAndInvalidateLaterSteps('transformation', 'Changing feature transformation will remove all accepted work in the later steps. Do you want to continue?')) return;
    addPipelineAction({ step: 'transformation', action: 'apply_transformation', strategies });
    toggleStepComplete('transformation', true);
    setActiveTab('encoding');
  };

  const handleSkip = () => {
    if (!confirmAndInvalidateLaterSteps('transformation', 'Skipping this step now will remove all accepted work in the later steps. Do you want to continue?')) return;
    toggleStepComplete('transformation', true);
    setActiveTab('encoding');
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-in fade-in">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium text-slate-500">Analyzing feature distributions for skewness...</p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
      <AlertCircle size={18} />
      <div><strong>Error loading transformation data:</strong> {error}</div>
    </div>
  );

  const needsTransform = columns.filter(c => c.needs_transform);
  const alreadyNormal = columns.filter(c => !c.needs_transform);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600 shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Feature Transformation</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Normalizing skewed distributions is critical before scaling and model fitting. 
              <strong className="text-violet-700"> Box-Cox</strong> requires positive values; 
              <strong className="text-violet-700"> Yeo-Johnson</strong> handles zero and negative values.
              <strong className="text-violet-700"> Log Transform</strong> is ideal for heavy right skew.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-black text-slate-900">{columns.length}</div>
          <div className="text-xs text-slate-500 mt-1">Numerical Features</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <div className="text-2xl font-black text-amber-700">{needsTransform.length}</div>
          <div className="text-xs text-amber-600 mt-1">Need Transformation</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
          <div className="text-2xl font-black text-emerald-700">{alreadyNormal.length}</div>
          <div className="text-xs text-emerald-600 mt-1">Already Normal</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{needsTransform.length} columns flagged for transformation</span>
        <button
          onClick={() => {
            const suggestions: Record<string, string> = {};
            columns.forEach(col => { suggestions[col.column] = col.recommendation ?? 'none'; });
            setStrategies(suggestions);

            if (!confirmAndInvalidateLaterSteps('transformation', 'Applying these system suggestions will remove all accepted work in the later steps. Do you want to continue?')) return;
            addPipelineAction({ step: 'transformation', action: 'apply_transformation', strategies: suggestions });
            toggleStepComplete('transformation', true);
            setActiveTab('encoding');
          }}
          className="flex flex-col items-end gap-0.5 cursor-pointer"
        >
          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
            <Settings2 size={14} /> Use System Suggestions
          </span>
          <span className="text-[10px] text-slate-400 pr-1">Applies suggestions &amp; advances to Feature Encoding →</span>
        </button>
      </div>

      <div className="max-h-[560px] overflow-y-auto pr-1">
        <div className="space-y-3">
          {columns.map(col => {
          const currentMethod = strategies[col.column] ?? 'none';
          const isFlagged = col.needs_transform;
          return (
            <div key={col.column} className={`bg-white border rounded-xl p-5 shadow-sm hover:border-indigo-200 transition-colors ${isFlagged ? 'border-amber-200' : 'border-slate-200'}`}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-900">{col.column}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${isFlagged ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      Skewness: {col.current_skewness > 0 ? '+' : ''}{col.current_skewness}
                    </span>
                    {col.has_negatives && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-rose-100 text-rose-700">Has Negatives → Box-Cox N/A</span>
                    )}
                  </div>
                  {col.needs_transform && (
                    <div className="text-xs p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800">
                      <span className="font-bold uppercase text-[10px] tracking-wide flex items-center gap-1 mb-1">
                        <Settings2 size={11} /> SYSTEM SUGGESTION
                      </span>
                      {col.recommendation === 'box_cox'
                        ? 'Distribution is skewed and strictly positive. Box-Cox is the most statistically rigorous choice.'
                        : col.recommendation === 'yeo_johnson'
                          ? 'Distribution contains zero/negative values. Yeo-Johnson handles any value range safely.'
                          : 'No transformation recommended.'}
                    </div>
                  )}
                  {!col.needs_transform && (
                    <div className="text-xs p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800">
                      Skewness is within acceptable range (|skew| &lt; 0.5). No transformation needed.
                    </div>
                  )}
                </div>
                <div className="md:w-60 shrink-0">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Transformation Method</label>
                  <select
                    value={currentMethod}
                    onChange={e => setStrategies(prev => ({ ...prev, [col.column]: e.target.value }))}
                    className="w-full appearance-none border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer transition-all"
                  >
                    <option value="none">No Transformation</option>
                    <option value="log">Log Transform (ln)</option>
                    <option value="box_cox">Box-Cox Transform {col.recommendation === 'box_cox' ? '(System Suggestion)' : ''}</option>
                    <option value="yeo_johnson">Yeo-Johnson Transform {col.recommendation === 'yeo_johnson' ? '(System Suggestion)' : ''}</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    {currentMethod === 'none' && 'Distribution unchanged.'}
                    {currentMethod === 'log' && 'Best for right-skewed, strictly positive data.'}
                    {currentMethod === 'box_cox' && 'Optimal for positive-only feature distributions.'}
                    {currentMethod === 'yeo_johnson' && 'Handles negatives and zeros safely.'}
                  </p>
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
            <CheckCircle2 size={16} /> Transformation Confirmed
          </div>
        ) : (
          <button onClick={handleSkip} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer underline-offset-2 hover:underline">
            Skip this step →
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Transformations <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default TransformationTab;
