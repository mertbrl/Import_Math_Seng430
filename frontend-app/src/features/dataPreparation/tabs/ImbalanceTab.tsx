import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { PREP_TABS } from '../DataPrepTabsConfig';
import { Shuffle, CheckCircle2, ChevronRight, Settings2, Loader2, AlertCircle, ShieldAlert, Info } from 'lucide-react';

interface ClassEntry {
  class: string;
  count: number;
  percentage: number;
}

interface ImbalanceData {
  class_distribution: ClassEntry[];
  imbalance_ratio: number;
  severity: string;
  recommendation: string | null;
  error?: string;
}

const API_BASE = 'http://localhost:5001/api/v1';

const SEVERITY_COLORS: Record<string, string> = {
  balanced: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  moderate: 'bg-amber-50 border-amber-200 text-amber-800',
  severe: 'bg-rose-50 border-rose-200 text-rose-800',
};

const ImbalanceTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, clearSubsequentProgress } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const isComplete = completedSteps.includes('imbalance_handling');

  const [data, setData] = useState<ImbalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<string>('none');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/imbalance-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'demo-session', target_column: 'DEATH_EVENT', excluded_columns: ignoredColumns ?? [] }),
      });
      const json: ImbalanceData = await res.json();
      setData(json);
      setStrategy(json.recommendation ?? 'none');
    } catch (e) {
      setError(`Failed to fetch imbalance data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = () => {
    const currentIndex = PREP_TABS.findIndex(t => t.id === 'imbalance_handling');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
    const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
    if (hasCompletedAhead) {
      if (!window.confirm('This will reset later steps. Continue?')) return;
      clearSubsequentProgress(stepsToReset);
    }
    addPipelineAction({ step: 'imbalance_handling', action: 'handle_imbalance', strategy });
    toggleStepComplete('imbalance_handling', true);
  };

  const handleSkip = () => {
    toggleStepComplete('imbalance_handling', true);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-sm font-medium text-slate-500">Analyzing class distribution...</p>
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
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0"><Shuffle size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Imbalance Handling</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Class imbalance causes models to learn biased decision boundaries.
              <strong className="text-rose-700"> SMOTE</strong> generates synthetic minority samples.
              <strong className="text-rose-700"> ADASYN</strong> focuses generation on hard-to-classify boundary regions.
            </p>
          </div>
        </div>
      </div>

      {/* Train-Only Critical */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900">
        <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <p><strong>CRITICAL:</strong> Oversampling (SMOTE/ADASYN) is applied ONLY to the Train Set. Applying to the Test Set would pollute evaluation with synthetic data and inflate performance metrics.</p>
      </div>

      {/* Severity Banner */}
      {data && (
        <div className={`p-4 border rounded-xl text-sm ${SEVERITY_COLORS[data.severity] ?? SEVERITY_COLORS.moderate}`}>
          <div className="font-bold text-base mb-1">
            {data.severity === 'balanced' && '✅ Class Distribution is Balanced'}
            {data.severity === 'moderate' && '⚠️ Moderate Imbalance Detected'}
            {data.severity === 'severe' && '🚨 Severe Imbalance Detected'}
          </div>
          <p>
            {data.severity === 'balanced' && 'No oversampling needed. The class ratio is within acceptable bounds.'}
            {data.severity === 'moderate' && `Majority-to-minority ratio is ${data.imbalance_ratio}:1. System suggests SMOTE for moderate synthetic oversampling.`}
            {data.severity === 'severe' && `Majority-to-minority ratio is ${data.imbalance_ratio}:1. Severe imbalance. System suggests ADASYN which adapts to complex boundaries.`}
          </p>
        </div>
      )}

      {/* Class Distribution */}
      {data?.class_distribution && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="font-bold text-sm text-slate-700 mb-4">Class Distribution</h4>
          <div className="space-y-3">
            {data.class_distribution.map(entry => (
              <div key={entry.class}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-700">Class {entry.class}</span>
                  <span className="text-xs text-slate-500">{entry.count} samples ({entry.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${entry.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="font-bold text-sm text-slate-700">Oversampling Strategy</label>
          {data?.recommendation && (
            <button
              onClick={() => {
                const recommended = data.recommendation!;
                setStrategy(recommended);

                const currentIndex = PREP_TABS.findIndex(t => t.id === 'imbalance_handling');
                const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
                const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
                if (hasCompletedAhead) {
                  if (!window.confirm('This will reset later steps. Continue?')) return;
                  clearSubsequentProgress(stepsToReset);
                }
                addPipelineAction({ step: 'imbalance_handling', action: 'handle_imbalance', strategy: recommended });
                toggleStepComplete('imbalance_handling', true);
              }}
              className="flex flex-col items-end gap-0.5 cursor-pointer"
            >
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
                <Settings2 size={14} /> Use System Suggestion
              </span>
              <span className="text-[10px] text-slate-400 pr-1">Applies suggestion &amp; finalizes pipeline</span>
            </button>
          )}
        </div>
        <select
          value={strategy}
          onChange={e => setStrategy(e.target.value)}
          className="w-full appearance-none border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer transition-all"
        >
          <option value="none">No Oversampling</option>
          <option value="smote">SMOTE – Synthetic Minority Oversampling {data?.recommendation === 'smote' ? '(System Suggestion)' : ''}</option>
          <option value="adasyn">ADASYN – Adaptive Synthetic Sampling {data?.recommendation === 'adasyn' ? '(System Suggestion)' : ''}</option>
        </select>
        <div className="mt-3 text-xs text-slate-500">
          {strategy === 'none' && <span className="flex items-center gap-1"><Info size={12} /> No synthetic data will be generated. Original class distribution is preserved.</span>}
          {strategy === 'smote' && <span className="flex items-center gap-1"><Info size={12} /> SMOTE generates minority samples by interpolating between existing examples using K-Nearest Neighbors.</span>}
          {strategy === 'adasyn' && <span className="flex items-center gap-1"><Info size={12} /> ADASYN generates more synthetic samples near the decision boundary where misclassification is most likely.</span>}
        </div>
      </div>

      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} /> Pipeline Complete 🎉
          </div>
        ) : (
          <button onClick={handleSkip} className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer underline-offset-2 hover:underline">
            Skip — No Oversampling →
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm & Finalize Pipeline <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default ImbalanceTab;
