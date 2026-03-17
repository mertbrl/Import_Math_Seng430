import React, { useState, useEffect, useCallback } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { PREP_TABS } from '../DataPrepTabsConfig';
import { Shuffle, CheckCircle2, ChevronRight, Settings2, Loader2, AlertCircle, ShieldAlert, Info } from 'lucide-react';
import WarningModal from '../../../components/common/WarningModal';

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

const API_BASE = 'http://localhost:8000/api/v1';

const SEVERITY_COLORS: Record<string, string> = {
  balanced: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  moderate: 'bg-amber-50 border-amber-200 text-amber-800',
  severe: 'bg-rose-50 border-rose-200 text-rose-800',
};

const ImbalanceTab: React.FC = () => {
  const { toggleStepComplete, addPipelineAction, completedSteps, setActiveTab, clearSubsequentProgress } = useDataPrepStore();
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const targetColumn = useEDAStore(s => s.targetColumn);
  const isComplete = completedSteps.includes('imbalance_handling');

  const [data, setData] = useState<ImbalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default to smote so visuals show by default
  const [strategy, setStrategy] = useState<string>('smote');
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [pendingStrategy, setPendingStrategy] = useState<string | null>(null);

  const effectiveTarget = targetColumn || 'DEATH_EVENT';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/imbalance-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'demo-session',
          target_column: effectiveTarget,
          excluded_columns: ignoredColumns ?? [],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ImbalanceData = await res.json();
      setData(json);
      // If backend recommends smote (or nothing), keep our default of smote
      if (json.recommendation) setStrategy(json.recommendation);
    } catch (e) {
      setError(`Failed to fetch imbalance data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [ignoredColumns, effectiveTarget]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyStrategyAndProceed = (selectedStrategy: string) => {
    const currentIndex = PREP_TABS.findIndex(t => t.id === 'imbalance_handling');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map(t => t.id);
    const hasCompletedAhead = stepsToReset.some(id => completedSteps.includes(id));
    if (hasCompletedAhead) {
      if (!window.confirm('This will reset later steps. Continue?')) return;
      clearSubsequentProgress(stepsToReset);
    }
    addPipelineAction({ step: 'imbalance_handling', action: 'handle_imbalance', strategy: selectedStrategy });
    toggleStepComplete('imbalance_handling', true);
  };

  const attemptApplyStrategy = (selectedStrategy: string) => {
    if (selectedStrategy !== 'none' && !completedSteps.includes('feature_selection')) {
      setPendingStrategy(selectedStrategy);
      setShowWarning(true);
      return;
    }
    applyStrategyAndProceed(selectedStrategy);
  };

  const handleConfirm = () => attemptApplyStrategy(strategy);

  const handleSkip = () => {
    addPipelineAction({ step: 'imbalance_handling', action: 'handle_imbalance', strategy: 'none' });
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
            <h3 className="font-bold text-slate-900 text-base mb-1">Step 10: Imbalance Handling (SMOTE)</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Class imbalance causes models to learn biased decision boundaries.
              <strong className="text-rose-700"> SMOTE</strong> generates synthetic minority samples by interpolating between real examples using K-Nearest Neighbors.
            </p>
          </div>
        </div>
      </div>

      {/* Train-Only Warning */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900">
        <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <p><strong>CRITICAL:</strong> SMOTE is applied ONLY to the <strong>Train Set</strong>. Applying synthetic oversampling to the Test Set would pollute evaluation metrics with non-real data.</p>
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
            {data.severity === 'moderate' && `Majority-to-minority ratio is ${data.imbalance_ratio}:1. SMOTE is recommended.`}
            {data.severity === 'severe' && `Majority-to-minority ratio is ${data.imbalance_ratio}:1. Severe imbalance — SMOTE will correct this.`}
          </p>
        </div>
      )}

      {/* Before & After Class Distribution */}
      {data?.class_distribution && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* BEFORE */}
            <div>
              <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                Before SMOTE
              </h4>
              <div className="space-y-3">
                {data.class_distribution.map(entry => (
                  <div key={`before-${entry.class}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-700">Class {entry.class}</span>
                      <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{entry.count.toLocaleString()} samples · {entry.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full bg-rose-400 transition-all duration-700"
                        style={{ width: `${entry.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="relative">
              <div className="hidden md:block absolute left-[-16px] top-4 bottom-4 w-px bg-slate-100"></div>

              {/* AFTER */}
              <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                After SMOTE {strategy === 'none' ? <span className="text-slate-400 font-normal text-xs">(select SMOTE to preview)</span> : ''}
              </h4>
              <div className="space-y-3">
                {data.class_distribution.map((entry, _, arr) => {
                  let afterCount = entry.count;
                  let afterPercentage = entry.percentage;

                  if (strategy === 'smote') {
                    const maxCount = Math.max(...arr.map(c => c.count));
                    afterCount = maxCount;
                    afterPercentage = parseFloat((100 / arr.length).toFixed(1));
                  }

                  return (
                    <div key={`after-${entry.class}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-slate-700">Class {entry.class}</span>
                        <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{afterCount.toLocaleString()} samples · {afterPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-700 ${strategy === 'smote' ? 'bg-emerald-400' : 'bg-slate-300'}`}
                          style={{ width: `${afterPercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
                setStrategy('smote');
                attemptApplyStrategy('smote');
              }}
              className="flex flex-col items-end gap-0.5 cursor-pointer"
            >
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
                <Settings2 size={14} /> Use System Suggestion
              </span>
              <span className="text-[10px] text-slate-400 pr-1">Applies SMOTE & finalizes pipeline</span>
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
        </select>
        <div className="mt-3 text-xs text-slate-500">
          {strategy === 'none' && <span className="flex items-center gap-1"><Info size={12} /> No synthetic data will be generated. Original class distribution is preserved.</span>}
          {strategy === 'smote' && <span className="flex items-center gap-1"><Info size={12} /> SMOTE generates synthetic minority samples by interpolating between real neighbors using K-Nearest Neighbors (k=5).</span>}
        </div>
      </div>

      {/* Footer Actions */}
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

      <WarningModal
        isOpen={showWarning}
        title="Feature Selection Skipped"
        message="You are about to apply SMOTE on high-dimensional data without Feature Selection. This can introduce noise and degrade model performance. Are you sure?"
        confirmText="Go Back to Feature Selection"
        cancelText="Proceed Anyway"
        onConfirm={() => {
          setShowWarning(false);
          setActiveTab('feature_selection');
        }}
        onCancel={() => {
          setShowWarning(false);
          if (pendingStrategy) {
            applyStrategyAndProceed(pendingStrategy);
            setPendingStrategy(null);
          }
        }}
      />
    </div>
  );
};

export default ImbalanceTab;
