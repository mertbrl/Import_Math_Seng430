import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { PREP_TABS } from '../DataPrepTabsConfig';
import { BarChart2, CheckCircle2, ChevronRight, Settings2, Loader2, AlertCircle, Info } from 'lucide-react';

interface ScalingColumn {
  column: string;
  min: number;
  max: number;
  mean: number;
  std: number;
  has_outliers: boolean;
  recommendation: string;
}

const API_BASE = 'http://localhost:5001/api/v1';

const ScalingTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, clearSubsequentProgress } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const isComplete = completedSteps.includes('scaling');

  const [columns, setColumns] = useState<ScalingColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/scaling-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'demo-session', excluded_columns: ignoredColumns ?? [] }),
      });
      const data = await res.json();
      const cols = data.columns ?? [];
      setColumns(cols);
      const init: Record<string, string> = {};
      cols.forEach((c: ScalingColumn) => { init[c.column] = c.recommendation; });
      setStrategies(init);
    } catch (e) {
      setError(`Failed to fetch scaling data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = () => {
    const currentIndex = PREP_TABS.findIndex(t => t.id === 'scaling');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
    const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
    if (hasCompletedAhead) {
      if (!window.confirm('Applying these changes will reset progress in later steps. Are you sure?')) return;
      clearSubsequentProgress(stepsToReset);
    }
    addPipelineAction({ step: 'scaling', action: 'apply_scaling', strategies });
    toggleStepComplete('scaling', true);
    setActiveTab('dimensionality_reduction');
  };

  const handleSkip = () => {
    toggleStepComplete('scaling', true);
    setActiveTab('dimensionality_reduction');
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium text-slate-500">Analyzing feature value ranges...</p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
      <AlertCircle size={18} /><div><strong>Error:</strong> {error}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-teal-100 text-teal-600 shrink-0"><BarChart2 size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Feature Scaling</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Scaling normalizes feature magnitudes to prevent large-range features from dominating.
              <strong className="text-teal-700"> StandardScaler</strong> (Z-score) is best for clean distributions.
              <strong className="text-teal-700"> RobustScaler</strong> (IQR-based) is immune to outliers.
              <strong className="text-teal-700"> MinMaxScaler</strong> is ideal for bounded [0, 1] ranges.
            </p>
          </div>
        </div>
      </div>

      {/* Critical Rule Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p><strong>Train-Only Rule:</strong> Scalers are fit on the Train Set only, then applied to both Train and Test. This prevents data leakage from Test statistics.</p>
      </div>

      {/* Use System Suggestions */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">{columns.length} numerical features to scale</span>
        <button
          onClick={() => {
            const s: Record<string, string> = {};
            columns.forEach(c => { s[c.column] = c.recommendation; });
            setStrategies(s);

            const currentIndex = PREP_TABS.findIndex(t => t.id === 'scaling');
            const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
            const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
            if (hasCompletedAhead) {
              if (!window.confirm('Applying these changes will reset progress in later steps. Are you sure?')) return;
              clearSubsequentProgress(stepsToReset);
            }
            addPipelineAction({ step: 'scaling', action: 'apply_scaling', strategies: s });
            toggleStepComplete('scaling', true);
            setActiveTab('dimensionality_reduction');
          }}
          className="flex flex-col items-end gap-0.5 cursor-pointer"
        >
          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
            <Settings2 size={14} /> Use System Suggestions
          </span>
          <span className="text-[10px] text-slate-400 pr-1">Applies suggestions &amp; advances to Feature Redundancy →</span>
        </button>
      </div>

      <div className="space-y-3">
        {columns.map(col => {
          const currentScaler = strategies[col.column] ?? col.recommendation;
          return (
            <div key={col.column} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-teal-200 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-900">{col.column}</span>
                    {col.has_outliers && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">Has Outliers</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[['Min', col.min], ['Max', col.max], ['Mean', col.mean], ['Std', col.std]].map(([label, val]) => (
                      <div key={label as string} className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">{label}</div>
                        <div className="text-xs font-bold text-slate-800 mt-0.5">{(val as number).toFixed(3)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:w-56 shrink-0">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Scaler</label>
                  <select
                    value={currentScaler}
                    onChange={e => setStrategies(prev => ({ ...prev, [col.column]: e.target.value }))}
                    className="w-full appearance-none border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 cursor-pointer transition-all"
                  >
                    <option value="none">No Scaling</option>
                    <option value="standard">StandardScaler (Z-score) {col.recommendation === 'standard' ? '(System Suggestion)' : ''}</option>
                    <option value="robust">RobustScaler (IQR) {col.recommendation === 'robust' ? '(System Suggestion)' : ''}</option>
                    <option value="minmax">MinMaxScaler [0, 1] {col.recommendation === 'minmax' ? '(System Suggestion)' : ''}</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-2 text-right">
                    {currentScaler === 'none' && 'Raw values passed to model.'}
                    {currentScaler === 'standard' && 'Centers data; sensitive to outliers.'}
                    {currentScaler === 'robust' && 'Uses IQR — unaffected by extreme outliers.'}
                    {currentScaler === 'minmax' && 'Squeezes all values into [0, 1].'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} /> Scaling Confirmed
          </div>
        ) : (
          <button onClick={handleSkip} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer underline-offset-2 hover:underline">
            Skip this step →
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Scaling <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default ScalingTab;
