import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { useDomainStore } from '../../../store/useDomainStore';
import { buildApiUrl } from '../../../config/apiConfig';
import { Network, CheckCircle2, ChevronRight, Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface VIFColumn {
  column: string;
  vif: number | null;
  severity: string;
  flagged: boolean;
}

const DimensionalityTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, confirmAndInvalidateLaterSteps } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const sessionId = useDomainStore((s) => s.sessionId);
  const isComplete = completedSteps.includes('dimensionality_reduction');

  const [columns, setColumns] = useState<VIFColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dropPlan, setDropPlan] = useState<string[]>([]);
  const [protectedFeatures, setProtectedFeatures] = useState<string[]>([]);
  const [usePCA, setUsePCA] = useState(false);
  const [pcaVariance, setPcaVariance] = useState(95);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl('/dimensionality-stats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          excluded_columns: ignoredColumns ?? [],
          protected_columns: protectedFeatures,
        }),
      });
      const data = await res.json();
      if (data.warning) setWarning(data.warning);
      const cols: VIFColumn[] = data.columns ?? [];
      setColumns(cols);
      setDropPlan(data.iterative_drop_order ?? []);
      useDataPrepStore.getState().setTabSuggestions('dimensionality_reduction', data);
    } catch (e) {
      setError(`Failed to fetch VIF data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns, protectedFeatures, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = () => {
    if (!confirmAndInvalidateLaterSteps('dimensionality_reduction', 'Changing dimensionality reduction will remove all accepted work in the later steps. Do you want to continue?')) return;
    const actions = Object.fromEntries(protectedFeatures.map((column) => [column, 'keep']));
    addPipelineAction({ step: 'dimensionality_reduction', action: 'reduce_features', actions, use_pca: usePCA, pca_variance: pcaVariance });
    toggleStepComplete('dimensionality_reduction', true);
    setActiveTab('feature_selection');
  };

  const protectFeature = (column: string) => {
    setProtectedFeatures((prev) => (prev.includes(column) ? prev : [...prev, column]));
  };

  const unprotectFeature = (column: string) => {
    setProtectedFeatures((prev) => prev.filter((item) => item !== column));
  };

  const handleSkip = () => {
    if (!confirmAndInvalidateLaterSteps('dimensionality_reduction', 'Skipping this step now will remove all accepted work in the later steps. Do you want to continue?')) return;
    toggleStepComplete('dimensionality_reduction', true);
    setActiveTab('feature_selection');
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium text-slate-500">Computing Variance Inflation Factors...</p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
      <AlertCircle size={18} /><div><strong>Error:</strong> {error}</div>
    </div>
  );

  const flaggedCount = columns.filter(c => c.flagged).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600 shrink-0"><Network size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Feature Redundancy & Multicollinearity</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-purple-700">VIF (Variance Inflation Factor)</strong> measures multicollinearity. VIF &gt; 5 indicates high correlation with other features.
              VIF &gt; 10 is severe. Optionally use <strong className="text-purple-700">PCA</strong> to collapse correlated features into orthogonal components.
            </p>
          </div>
        </div>
      </div>

      {/* VIF Legend */}
      <div className="flex gap-3 flex-wrap text-xs font-semibold">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">VIF 1–5: No issue</span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700">VIF 5–10: Investigate</span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 text-rose-700">VIF &gt; 10: Severe</span>
      </div>

      {warning && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <Info size={16} className="shrink-0" /> {warning}
        </div>
      )}

      {flaggedCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">
          <AlertTriangle size={18} className="shrink-0" />
          <p><strong>{flaggedCount} feature{flaggedCount > 1 ? 's' : ''}</strong> currently exceed the VIF warning range. Choose iterative VIF dropping or PCA.</p>
        </div>
      )}

      <div className="bg-white border border-purple-200 rounded-xl p-5">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Dimensionality Strategy</h4>
            <p className="text-xs text-slate-500 mt-0.5">For this step, choose either automatic VIF-based dropping or PCA.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={() => setUsePCA(false)}
              className={`rounded-xl border px-4 py-4 text-left transition-all ${
                !usePCA ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-bold text-slate-900">Iterative VIF Drop</p>
              <p className="mt-1 text-xs text-slate-600">
                Drop the single worst VIF feature, recalculate, and repeat until all remaining features are below threshold.
              </p>
            </button>
            <button
              onClick={() => setUsePCA(true)}
              className={`rounded-xl border px-4 py-4 text-left transition-all ${
                usePCA ? 'border-purple-300 bg-purple-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-bold text-slate-900">PCA</p>
              <p className="mt-1 text-xs text-slate-600">
                Replace the correlated feature space with orthogonal principal components.
              </p>
            </button>
          </div>
        </div>
        {usePCA && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold">Target Explained Variance</span>
              <span className="font-bold text-purple-700">{pcaVariance}%</span>
            </div>
            <input
              type="range" min={80} max={99} value={pcaVariance}
              onChange={e => setPcaVariance(Number(e.target.value))}
              className="w-full h-2 bg-purple-200 rounded-full appearance-none cursor-pointer accent-purple-600"
            />
            <p className="text-[10px] text-slate-400">Select components that together explain {pcaVariance}% of the dataset variance.</p>
          </div>
        )}
      </div>

      {!usePCA && (
        <div className="max-h-[560px] overflow-y-auto pr-1">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Iterative VIF Drop Plan</h4>
                <p className="mt-1 text-xs text-slate-500">
                  The backend will iteratively remove the single worst feature until every remaining feature has VIF ≤ 10. You can protect must-keep features below.
                </p>
              </div>
              <span className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                {dropPlan.length} feature{dropPlan.length === 1 ? '' : 's'} to drop
              </span>
            </div>

            {protectedFeatures.length > 0 && (
              <p className="mt-4 text-xs text-slate-500">
                Kept features: <span className="font-semibold text-slate-700">{protectedFeatures.join(', ')}</span>
              </p>
            )}

            {dropPlan.length === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                No iterative VIF drops are needed. The current feature set is already within the threshold, or all high-VIF candidates are protected.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {dropPlan.map((column, index) => {
                  const vifMeta = columns.find((item) => item.column === column);
                  const severityColor =
                    vifMeta?.severity === 'severe' ? 'text-rose-700 bg-rose-100' :
                    vifMeta?.severity === 'high' ? 'text-amber-700 bg-amber-100' :
                    'text-emerald-700 bg-emerald-100';

                  return (
                    <div key={column} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{column}</p>
                          <p className="text-[11px] text-slate-500">Dropped at step {index + 1} of the iterative VIF cleanup.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${severityColor}`}>
                          VIF: {vifMeta?.vif ?? 'N/A'}
                        </span>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={protectedFeatures.includes(column)}
                            onChange={(e) => {
                              if (e.target.checked) protectFeature(column);
                              else unprotectFeature(column);
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          Keep
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} /> Multicollinearity Handled
          </div>
        ) : (
          <button onClick={handleSkip} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer underline-offset-2 hover:underline">
            Skip this step →
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm & Continue <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default DimensionalityTab;
