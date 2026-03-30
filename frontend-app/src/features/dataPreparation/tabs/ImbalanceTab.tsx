import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { buildPipelineConfig } from '../../../store/pipelineConfig';
import { PREP_TABS } from '../DataPrepTabsConfig';
import { buildApiUrl } from '../../../config/apiConfig';
import { Shuffle, CheckCircle2, ChevronRight, Loader2, AlertCircle, ShieldAlert, Info, Sparkles, AlertTriangle } from 'lucide-react';
import WarningModal from '../../../components/common/WarningModal';

interface ClassEntry {
  class: string;
  count: number;
  percentage: number;
}

interface ImbalanceData {
  class_distribution: ClassEntry[];
  before_class_distribution?: ClassEntry[];
  after_smote_distribution?: ClassEntry[];
  imbalance_ratio: number;
  severity: 'balanced' | 'moderate' | 'severe';
  recommendation: string | null;
  recommended_algorithm?: string;
  is_recommended?: boolean;
  ui_message?: string;
  minority_class_ratio?: number;
  minority_sample_count?: number;
  categorical_feature_ratio?: number;
  working_set?: string;
  target_column?: string;
  error?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  balanced: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  moderate: 'border-amber-200 bg-amber-50 text-amber-900',
  severe: 'border-rose-200 bg-rose-50 text-rose-900',
};

const BAR_COLORS = [
  'from-rose-500 via-orange-400 to-amber-300',
  'from-fuchsia-500 via-violet-400 to-indigo-300',
  'from-sky-500 via-cyan-400 to-teal-300',
  'from-lime-500 via-emerald-400 to-green-300',
  'from-amber-500 via-yellow-400 to-orange-300',
];

const AFTER_BAR_COLORS = [
  'from-rose-600 via-pink-500 to-fuchsia-400',
  'from-violet-600 via-purple-500 to-fuchsia-400',
  'from-cyan-600 via-sky-500 to-blue-400',
  'from-emerald-600 via-teal-500 to-lime-400',
  'from-orange-600 via-amber-500 to-yellow-400',
];

const ImbalanceTab: React.FC = () => {
  const {
    toggleStepComplete,
    addPipelineAction,
    completedSteps,
    setActiveTab,
    clearSubsequentProgress,
    cleaningPipeline,
  } = useDataPrepStore();
  const targetColumn = useEDAStore((s) => s.targetColumn);
  const isComplete = completedSteps.includes('imbalance_handling');
  const savedAction = cleaningPipeline.find((action) => action.action === 'handle_imbalance');

  const [data, setData] = useState<ImbalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<string>(savedAction?.strategy ?? 'none');
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [pendingStrategy, setPendingStrategy] = useState<string | null>(null);

  const effectiveTarget = targetColumn || 'DEATH_EVENT';
  const smoteSelected = strategy === 'smote';
  const recommendationTag = data?.recommended_algorithm ?? data?.recommendation ?? 'none';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pipelineConfig = buildPipelineConfig('demo-session');
      const res = await fetch(buildApiUrl('/imbalance-stats'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'demo-session',
          target_column: effectiveTarget,
          excluded_columns: pipelineConfig.excluded_columns,
          pipeline_config: pipelineConfig,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ImbalanceData = await res.json();
      setData(json);

      if (savedAction?.strategy) {
        setStrategy(savedAction.strategy);
      } else {
        setStrategy('none');
      }
    } catch (e) {
      setError(`Failed to fetch imbalance data: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTarget, savedAction?.strategy, cleaningPipeline]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyStrategyAndProceed = (selectedStrategy: string) => {
    const currentIndex = PREP_TABS.findIndex((t) => t.id === 'imbalance_handling');
    const stepsToReset = PREP_TABS.slice(currentIndex + 1).map((t) => t.id);
    const hasCompletedAhead = stepsToReset.some((id) => completedSteps.includes(id));
    if (hasCompletedAhead) {
      if (!window.confirm('This change will reset later steps. Continue?')) return;
      clearSubsequentProgress(stepsToReset);
    }
    addPipelineAction({ step: 'imbalance_handling', action: 'handle_imbalance', strategy: selectedStrategy });
    setStrategy(selectedStrategy);
    toggleStepComplete('imbalance_handling', true);
    setActiveTab('preprocessing_review');
  };

  const attemptApplyStrategy = (selectedStrategy: string) => {
    if (selectedStrategy !== 'none' && !completedSteps.includes('feature_selection')) {
      setPendingStrategy(selectedStrategy);
      setShowWarning(true);
      return;
    }
    applyStrategyAndProceed(selectedStrategy);
  };

  const handleKeepOriginal = () => {
    addPipelineAction({ step: 'imbalance_handling', action: 'handle_imbalance', strategy: 'none' });
    setStrategy('none');
    toggleStepComplete('imbalance_handling', true);
    setActiveTab('preprocessing_review');
  };

  const beforeDistribution = data?.before_class_distribution ?? data?.class_distribution ?? [];
  const afterDistribution = data?.after_smote_distribution ?? [];

  const chartRows = useMemo(() => {
    const beforeMap = new Map(beforeDistribution.map((entry) => [entry.class, entry]));
    const afterMap = new Map(afterDistribution.map((entry) => [entry.class, entry]));
    const orderedClasses = Array.from(
      new Set([...beforeDistribution.map((entry) => entry.class), ...afterDistribution.map((entry) => entry.class)])
    );

    return orderedClasses.map((classLabel, index) => {
      const before = beforeMap.get(classLabel) ?? { class: classLabel, count: 0, percentage: 0 };
      const after = afterMap.get(classLabel) ?? before;
      return {
        beforeColor: BAR_COLORS[index % BAR_COLORS.length],
        afterColor: AFTER_BAR_COLORS[index % AFTER_BAR_COLORS.length],
        classLabel,
        before,
        after,
        syntheticGain: Math.max(0, after.count - before.count),
      };
    });
  }, [beforeDistribution, afterDistribution]);

  const visualMaxCount = Math.max(
    1,
    ...chartRows.map((row) => row.before.count),
    ...chartRows.map((row) => row.after.count)
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Analyzing class balance on the current training set...</p>
      </div>
    );
  }

  if (error || data?.error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
        <AlertCircle size={18} />
        <div><strong>Error:</strong> {data?.error ?? error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <Shuffle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Step 10: Imbalance Handling</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This step checks the target distribution on the current training set and shows the actual impact of SMOTE before you finalize the pipeline.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900">
        <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <p><strong>Important:</strong> SMOTE is applied only to the training data. Validation and test sets stay untouched so evaluation remains honest.</p>
      </div>

      {data && (
        <div className={`rounded-2xl border p-5 ${SEVERITY_STYLES[data.severity] ?? SEVERITY_STYLES.moderate}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
                {data.working_set === 'train' ? 'Training Set Status' : 'Dataset Status'}
              </p>
              <h4 className="text-lg font-bold">
                {recommendationTag === 'smote' && data.severity === 'severe' && 'Severe imbalance detected: SMOTE is recommended'}
                {recommendationTag === 'smote' && data.severity !== 'severe' && 'SMOTE is recommended for this training set'}
                {recommendationTag === 'smotenc' && 'Imbalance detected: prefer SMOTENC over standard SMOTE'}
                {recommendationTag === 'class_weights' && 'Mild imbalance detected: prefer class weights'}
                {recommendationTag === 'none' && 'The target is already balanced'}
              </h4>
              <p className="text-sm leading-relaxed opacity-90">
                {data.ui_message ?? 'No oversampling is needed. The current class mix is within an acceptable range.'}
              </p>
            </div>

            {!isComplete && (
              <button
                onClick={() => attemptApplyStrategy('smote')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-rose-700 hover:shadow-md active:scale-[0.98] cursor-pointer"
              >
                <Sparkles size={16} />
                {recommendationTag === 'smote' ? 'Apply SMOTE' : 'Apply SMOTE Anyway'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h4 className="font-bold text-slate-900 text-base">Class Distribution</h4>
            <p className="text-sm text-slate-500 mt-1">
              Bars below use the real counts from your current dataset flow. The SMOTE panel is calculated from the backend, not mocked in the UI.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Target</p>
            <p className="text-sm font-bold text-slate-700">{effectiveTarget}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-slate-800">Balance Snapshot</h5>
                <p className="text-sm text-slate-500 mt-1">
                  Keep the decision context visible while comparing the charts.
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                data?.severity === 'balanced'
                  ? 'bg-emerald-100 text-emerald-700'
                  : data?.severity === 'severe'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {data?.severity ?? 'moderate'}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Imbalance Ratio</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{data?.imbalance_ratio}:1</p>
                <p className="mt-1 text-xs text-slate-500">Majority to minority class ratio on the active working set.</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Recommended Action</p>
                <p className="mt-2 text-base font-bold text-slate-900">
                  {recommendationTag === 'smote' && 'Apply SMOTE'}
                  {recommendationTag === 'smotenc' && 'Use SMOTENC'}
                  {recommendationTag === 'class_weights' && 'Use Class Weights'}
                  {recommendationTag === 'none' && 'Keep current distribution'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {smoteSelected
                    ? 'Preview and decision are aligned with the current pipeline.'
                    : data?.ui_message ?? 'Apply oversampling only if the minority class is being under-learned.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Working Set</p>
                <p className="mt-2 text-base font-bold text-slate-900">
                  {data?.working_set === 'train' ? 'Training split only' : 'Current dataset flow'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Validation and test samples stay untouched so model evaluation remains honest.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-bold text-slate-800">Before SMOTE</h5>
                <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                  {data?.working_set === 'train' ? 'Train split only' : 'Current data'}
                </span>
              </div>

              <div className="space-y-4">
                  {chartRows.map((row) => (
                    <div key={`before-${row.classLabel}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${row.beforeColor}`} />
                          Class {row.classLabel}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {row.before.count.toLocaleString()} samples · {row.before.percentage}%
                        </span>
                      </div>
                      <div className="h-4 rounded-full bg-white border border-slate-200 overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${row.beforeColor} transition-all duration-700`}
                          style={{ width: `${(row.before.count / visualMaxCount) * 100}%` }}
                        />
                      </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-bold text-slate-800">
                  {smoteSelected ? (isComplete ? 'After SMOTE' : 'SMOTE Preview') : 'After SMOTE'}
                </h5>
                <span className="text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 px-2.5 py-1 rounded-full">
                  {smoteSelected ? 'Dynamic backend preview' : 'Apply SMOTE to activate'}
                </span>
              </div>

              {smoteSelected ? (
                <div className="space-y-4">
                  {chartRows.map((row) => (
                    <div key={`after-${row.classLabel}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${row.afterColor}`} />
                          Class {row.classLabel}
                        </span>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span>{row.after.count.toLocaleString()} samples · {row.after.percentage}%</span>
                          {row.syntheticGain > 0 && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                              +{row.syntheticGain.toLocaleString()} synthetic
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-4 rounded-full bg-white border border-emerald-200 overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${row.afterColor} transition-all duration-700`}
                          style={{ width: `${(row.after.count / visualMaxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-emerald-300 bg-white/70 p-5 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <Info size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-slate-800">No oversampling preview yet</p>
                      <p className="mt-1">
                        Click <strong>Apply SMOTE</strong> to see how the minority classes are expanded in the training set using the current pipeline configuration.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Oversampling</p>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              {recommendationTag === 'smotenc'
                ? 'Standard SMOTE is not the best fit for this dataset because categorical features dominate. Consider adding SMOTENC support in the backend instead of forcing plain SMOTE.'
                : recommendationTag === 'class_weights'
                ? 'This imbalance is mild. In many cases, class weights are safer than synthetic oversampling because they reduce bias without inventing new rows.'
                : 'SMOTE is the active balancing method in this step. You can either keep the current distribution or apply SMOTE to the training set.'}
            </p>
            {!completedSteps.includes('feature_selection') && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                <AlertTriangle size={12} />
                Complete Feature Selection before SMOTE for a cleaner training set.
              </p>
            )}
          </div>
          {recommendationTag === 'smote' && !isComplete && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
              <AlertTriangle size={12} />
              Recommended action
            </span>
          )}
        </div>
      </div>

      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            {savedAction?.strategy === 'smote' ? 'SMOTE applied to the training set' : 'Original class distribution kept'}
          </div>
        ) : (
          <button
            onClick={handleKeepOriginal}
            className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer underline-offset-2 hover:underline"
          >
            Skip oversampling
          </button>
        )}

        {!isComplete && (
          <button
            onClick={() => attemptApplyStrategy('smote')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            {recommendationTag === 'smote' ? 'Apply SMOTE' : 'Apply SMOTE Anyway'}
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <WarningModal
        isOpen={showWarning}
        title="Apply SMOTE Before Feature Selection?"
        message="You are about to apply SMOTE without completing Feature Selection. This can amplify noisy or less useful columns in the training set. Do you want to continue anyway?"
        confirmText="Go to Feature Selection"
        cancelText="Apply SMOTE Anyway"
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
