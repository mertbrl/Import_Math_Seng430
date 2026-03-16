import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { PREP_TABS } from '../DataPrepTabsConfig';
import { Network, CheckCircle2, ChevronRight, Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface VIFColumn {
  column: string;
  vif: number | null;
  severity: string;
  flagged: boolean;
}

type DimAction = 'keep' | 'drop' | 'pca';

const API_BASE = 'http://localhost:5001/api/v1';

const DimensionalityTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, clearSubsequentProgress } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const isComplete = completedSteps.includes('dimensionality_reduction');

  const [columns, setColumns] = useState<VIFColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, DimAction>>({});
  const [usePCA, setUsePCA] = useState(false);
  const [pcaVariance, setPcaVariance] = useState(95);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/dimensionality-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'demo-session', excluded_columns: ignoredColumns ?? [] }),
      });
      const data = await res.json();
      if (data.warning) setWarning(data.warning);
      const cols: VIFColumn[] = data.columns ?? [];
      setColumns(cols);
      const init: Record<string, DimAction> = {};
      cols.forEach(c => { init[c.column] = c.flagged ? 'drop' : 'keep'; });
      setActions(init);
    } catch (e) {
      setError(`Failed to fetch VIF data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = () => {
    const currentIndex = PREP_TABS.findIndex(t => t.id === 'dimensionality_reduction');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
    const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
    if (hasCompletedAhead) {
      if (!window.confirm('Applying these changes will reset later steps. Are you sure?')) return;
      clearSubsequentProgress(stepsToReset);
    }
    addPipelineAction({ step: 'dimensionality_reduction', action: 'reduce_features', actions, use_pca: usePCA, pca_variance: pcaVariance });
    toggleStepComplete('dimensionality_reduction', true);
    setActiveTab('imbalance_handling');
  };

  const handleSkip = () => {
    toggleStepComplete('dimensionality_reduction', true);
    setActiveTab('imbalance_handling');
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
          <p><strong>{flaggedCount} feature{flaggedCount > 1 ? 's' : ''}</strong> flagged for multicollinearity. Consider dropping or using PCA.</p>
        </div>
      )}

      {/* PCA Option */}
      <div className="bg-white border border-purple-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Apply PCA Instead</h4>
            <p className="text-xs text-slate-500 mt-0.5">Replace all features with orthogonal principal components.</p>
          </div>
          <button
            onClick={() => setUsePCA(!usePCA)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usePCA ? 'bg-purple-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${usePCA ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
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

      {/* VIF Table */}
      {!usePCA && (
        <div className="space-y-2">
          {columns.map(col => {
            const currentAction = actions[col.column] ?? 'keep';
            const severityColor =
              col.severity === 'severe' ? 'text-rose-700 bg-rose-100' :
              col.severity === 'high' ? 'text-amber-700 bg-amber-100' :
              'text-emerald-700 bg-emerald-100';

            return (
              <div key={col.column} className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 ${col.flagged ? 'border-rose-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-bold text-slate-800 text-sm">{col.column}</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${severityColor}`}>
                    VIF: {col.vif !== null ? col.vif : 'N/A'}
                  </span>
                  {col.flagged && <AlertTriangle size={14} className="text-rose-500" />}
                </div>
                <div className="flex gap-2">
                  {(['keep', 'drop'] as DimAction[]).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setActions(prev => ({ ...prev, [col.column]: opt }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentAction === opt
                          ? (opt === 'drop' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white')
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt === 'keep' ? 'Keep' : 'Drop'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
