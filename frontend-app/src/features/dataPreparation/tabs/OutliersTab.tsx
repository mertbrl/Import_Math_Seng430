import React, { useEffect, useState } from 'react';
import { useDataPrepStore } from '../../../store/useDataPrepStore';
import { useEDAStore } from '../../../store/useEDAStore';
import { useDomainStore } from '../../../store/useDomainStore';
import { ScanSearch, Activity, AlertTriangle, CheckCircle2, ChevronRight, Settings2, Loader2 } from 'lucide-react';
import type { OutlierColumnStat } from '../../../api/dataPrepAPI';

type OutlierDetector = 'zscore' | 'iqr' | 'isolation_forest' | 'lof' | 'dbscan';
type OutlierTreatment = 'ignore' | 'cap_1_99' | 'cap_5_95' | 'drop_rows';

const DETECTOR_OPTIONS: Array<{ value: OutlierDetector; label: string }> = [
  { value: 'zscore', label: 'Z-Score' },
  { value: 'iqr', label: 'IQR' },
  { value: 'isolation_forest', label: 'Isolation Forest' },
  { value: 'lof', label: 'LOF' },
  { value: 'dbscan', label: 'DBSCAN' },
];

const TREATMENT_OPTIONS: Array<{ value: OutlierTreatment; label: string }> = [
  { value: 'ignore', label: 'Keep' },
  { value: 'cap_1_99', label: 'Winsorize 1/99' },
  { value: 'cap_5_95', label: 'Winsorize 5/95' },
  { value: 'drop_rows', label: 'Drop Rows' },
];

const mapRecommendationToDetector = (recommendation: string | undefined): OutlierDetector => {
  if (!recommendation) return 'iqr';
  const normalized = recommendation.trim().toLowerCase();

  switch (normalized) {
    case 'z-score':
    case 'zscore':
      return 'zscore';
    case 'iqr':
      return 'iqr';
    case 'isolation forest':
      return 'isolation_forest';
    case 'lof':
      return 'lof';
    case 'dbscan':
      return 'dbscan';
    default:
      return 'iqr';
  }
};

const mapRecommendedTreatment = (treatment: string | undefined): OutlierTreatment => {
  switch ((treatment ?? '').trim().toLowerCase()) {
    case 'ignore':
      return 'ignore';
    case 'cap_1_99':
      return 'cap_1_99';
    case 'cap_5_95':
      return 'cap_5_95';
    case 'drop_rows':
      return 'drop_rows';
    default:
      return 'cap_1_99';
  }
};

const getRecommendedPlan = (column: OutlierColumnStat) => ({
  detector: mapRecommendationToDetector(column.recommended_detector ?? column.recommendation),
  treatment: mapRecommendedTreatment(column.recommended_treatment),
});

const detectorLabel = (value: string) =>
  DETECTOR_OPTIONS.find((option) => option.value === value)?.label ?? value;

const treatmentLabel = (value: string) =>
  TREATMENT_OPTIONS.find((option) => option.value === value)?.label ?? value;

const OutliersTab: React.FC = () => {
  const { 
    toggleStepComplete, 
    addPipelineAction, 
    completedSteps,
    setActiveTab,
    outlierColumns,
    isOutlierLoading,
    outlierError,
    fetchOutlierStats,
    outlierStrategies,
    setOutlierStrategy,
    confirmAndInvalidateLaterSteps
  } = useDataPrepStore();

  const userMode = useDomainStore((s) => s.userMode);
  const ignoredColumns = useEDAStore(s => s.ignoredColumns);
  const sessionId = useDomainStore((s) => s.sessionId);
  const [bulkDetector, setBulkDetector] = useState<OutlierDetector>('iqr');
  const [bulkTreatment, setBulkTreatment] = useState<OutlierTreatment>('cap_1_99');

  const isComplete = completedSteps.includes('outliers');

  // Fetch missing stats when the component mounts
  useEffect(() => {
    fetchOutlierStats(sessionId, ignoredColumns);
  }, [fetchOutlierStats, ignoredColumns, sessionId]);

  // Sync initial strategies when live data arrives
  useEffect(() => {
    if (outlierColumns.length > 0) {
      outlierColumns.forEach(col => {
        // Only set default if not already selected by user
        if (!outlierStrategies[col.column]) {
          setOutlierStrategy(col.column, getRecommendedPlan(col));
        }
      });
    }
  }, [outlierColumns, outlierStrategies, setOutlierStrategy]);

  const handleConfirm = () => {
    if (!confirmAndInvalidateLaterSteps('outliers', 'Changing outlier handling will remove all accepted work in the later steps. Do you want to continue?')) {
      return;
    }

    const plannedStrategies = Object.fromEntries(
      outlierColumns.map((col) => [col.column, outlierStrategies[col.column] ?? getRecommendedPlan(col)])
    );

    // Log the unified action to the pipeline
    addPipelineAction({
      step: 'outliers',
      action: 'handle_outliers',
      strategies: plannedStrategies
    });
    toggleStepComplete('outliers', true);
    setActiveTab('imputation');
  };

  const handleSkip = () => {
    if (!confirmAndInvalidateLaterSteps('outliers', 'Skipping this step now will remove all accepted work in the later steps. Do you want to continue?')) {
      return;
    }
    toggleStepComplete('outliers', true);
    setActiveTab('imputation'); // Step 5 is now Imputation
  };

  if (isOutlierLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-in fade-in">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Analyzing feature distributions for statistical anomalies...</p>
      </div>
    );
  }

  if (outlierError) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
        <strong>Error analyzing outliers:</strong> {outlierError}
      </div>
    );
  }

  // ─── Empty State (Zero Outliers Detected) ──────────────────────────────
  if (outlierColumns.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ScanSearch className="text-indigo-600" size={24} />
            Step 5: Outlier Handling
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Identify and handle extreme values intelligently based on the statistical distribution shape of your data.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Great News! No extreme outliers detected.</h3>
          <p className="text-sm text-emerald-700 mt-2 max-w-md">
            All numerical features in your dataset fit neatly within expected statistical distributions (Normal, Skewed, or Multimodal). You can safely proceed to Feature Engineering without applying any clipping or dropping algorithms.
          </p>
          <button
            onClick={handleSkip}
            className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md transition-all active:scale-[0.98]"
          >
            Continue to Step 6
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  const applyRecommendedPlans = () => {
    outlierColumns.forEach((col) => {
      setOutlierStrategy(col.column, getRecommendedPlan(col));
    });
  };

  const applyBulkPlan = () => {
    outlierColumns.forEach((col) => {
      setOutlierStrategy(col.column, {
        detector: bulkDetector,
        treatment: bulkTreatment,
      });
    });
  };

  const flaggedRows = outlierColumns.reduce((sum, col) => sum + col.outlier_count, 0);
  const recommendedKeepCount = outlierColumns.filter(
    (col) => getRecommendedPlan(col).treatment === 'ignore'
  ).length;
  const recommendedWinsorizeCount = outlierColumns.filter(
    (col) => getRecommendedPlan(col).treatment.startsWith('cap_')
  ).length;

  if (userMode === 'clinical') {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ScanSearch className="text-indigo-600" size={24} />
              Data Health Check-up: Outliers
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Checking patient data for extreme statistical anomalies that could skew results.
            </p>
          </div>

          <div className="space-y-4">
            {outlierColumns.map((col) => {
              const plan = getRecommendedPlan(col);
              return (
                <div key={col.column} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Feature: {col.column}</h4>
                        <p className="text-xs text-slate-600 mt-1 max-w-lg leading-relaxed">
                          System detected anomalies ({col.outlier_percentage}% of rows). Recommended action is to <span className="font-semibold text-slate-700">{treatmentLabel(plan.treatment).toLowerCase()}</span> using standard statistical adjustments to preserve data integrity.
                        </p>
                      </div>
                    </div>
                    <div className="group relative shrink-0">
                      <button className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                        [ Why? ] Details
                      </button>
                      <div className="absolute right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-slate-50 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 text-center pointer-events-none">
                        {col.suggestion_reason ?? 'System optimized based on feature distribution.'}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-t-8 border-t-slate-800 border-l-8 border-l-transparent border-r-8 border-r-transparent"></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => {
                applyRecommendedPlans();
                const strategies: Record<string, { detector: string; treatment: string }> = {};
                outlierColumns.forEach((col) => {
                  strategies[col.column] = getRecommendedPlan(col);
                });

                if (!confirmAndInvalidateLaterSteps('outliers', 'Applying these system suggestions will remove all accepted work in the later steps. Do you want to continue?')) return;
                addPipelineAction({ step: 'outliers', action: 'handle_outliers', strategies });
                toggleStepComplete('outliers', true);
                setActiveTab('imputation');
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
            >
              Apply Recommendations & Continue <ChevronRight size={18} />
            </button>
          </div>
        </div>
    );
  }

  // ─── Active Outlier Workspace ────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ScanSearch className="text-indigo-600" size={24} />
          Step 5: Outlier Handling
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Identify and handle extreme values intelligently based on the statistical distribution shape of your data.
        </p>
      </div>

      {/* Critical Leakage + Best Practice Banner */}
      <div className="border-l-4 border-amber-500 bg-amber-50 rounded-r-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-bold text-amber-900">
              Rule of Thumb: True Errors vs. Natural Extremes
            </h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Outliers should be handled because they can distort the mean, inflate variance, destabilize linear models, and make scaling less reliable.
              <strong> Drop rows</strong> only when the value is clearly wrong or impossible, because deletion shrinks the dataset and can damage class balance.
              <strong> Winsorization</strong> is usually better when the value is plausible but too extreme, since it reduces harmful leverage while keeping the patient record in the training set.
              In practice: remove obvious errors, cap extreme but believable values, and keep rare clinically meaningful cases when they may contain signal.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Affected Features</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{outlierColumns.length}</p>
          <p className="mt-1 text-xs text-slate-500">Columns that currently have detected outlier candidates.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Flagged Values</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{flaggedRows}</p>
          <p className="mt-1 text-xs text-slate-500">Detector-specific flagged points across the visible numeric features.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Recommended Actions</p>
          <p className="mt-2 text-base font-bold text-slate-900">
            {recommendedWinsorizeCount} winsorize, {recommendedKeepCount} keep
          </p>
          <p className="mt-1 text-xs text-slate-500">The system avoids row drops by default unless you explicitly choose them.</p>
        </div>
      </div>

      {/* Columns List */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:justify-between lg:items-center">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Settings2 size={16} className="text-indigo-500" />
            Feature-by-Feature Outlier Plan
          </h3>
          <button
            onClick={() => {
              applyRecommendedPlans();
              const strategies: Record<string, { detector: string; treatment: string }> = {};
              outlierColumns.forEach((col) => {
                strategies[col.column] = getRecommendedPlan(col);
              });

              if (!confirmAndInvalidateLaterSteps('outliers', 'Applying these system suggestions will remove all accepted work in the later steps. Do you want to continue?')) return;
              addPipelineAction({ step: 'outliers', action: 'handle_outliers', strategies });
              toggleStepComplete('outliers', true);
              setActiveTab('imputation');
            }}
            className="flex flex-col items-end gap-0.5 cursor-pointer"
          >
            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
              <Settings2 size={14} /> Accept Recommended Plans
            </span>
            <span className="text-[10px] text-slate-400 pr-1">Loads detector + treatment and advances to Missing Value Handling →</span>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Bulk Apply to All Features</h4>
              <p className="mt-1 text-xs text-slate-500">
                Choose one detector and one treatment, then apply the same plan to every feature. You can still fine-tune individual rows afterward.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[560px]">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Detector
                </label>
                <select
                  value={bulkDetector}
                  onChange={(e) => setBulkDetector(e.target.value as OutlierDetector)}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                >
                  {DETECTOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Treatment
                </label>
                <select
                  value={bulkTreatment}
                  onChange={(e) => setBulkTreatment(e.target.value as OutlierTreatment)}
                  className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                >
                  {TREATMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Current bulk plan: <strong className="text-slate-700">{detectorLabel(bulkDetector)}</strong> + <strong className="text-slate-700">{treatmentLabel(bulkTreatment)}</strong>
            </p>
            <button
              onClick={applyBulkPlan}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98]"
            >
              Apply to All Features
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="max-h-[560px] overflow-auto">
            <div className="min-w-[1040px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-[0.12em] text-[11px]">Feature</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-[0.12em] text-[11px]">Shape</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-[0.12em] text-[11px]">Flagged</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-[0.12em] text-[11px]">Detector</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-[0.12em] text-[11px]">Treatment</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-[0.12em] text-[11px]">Recommended Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outlierColumns.map((col) => {
                    const recommendedPlan = getRecommendedPlan(col);
                    const currentPlan = outlierStrategies[col.column] ?? recommendedPlan;
                    const isNormal = col.distribution === 'Normal';
                    const isSkewed = col.distribution === 'Highly Skewed' || col.distribution === 'Non-Gaussian';

                    return (
                      <tr key={col.column} className="align-top hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">{col.column}</div>
                          <div className="mt-1 text-xs text-slate-500">{col.type} feature</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isNormal
                              ? 'bg-sky-100 text-sky-700'
                              : isSkewed
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            <Activity size={12} />
                            {col.distribution}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-bold text-slate-900">{col.outlier_count}</div>
                          <div className="mt-1 text-xs text-slate-500">{col.outlier_percentage}% of rows</div>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={currentPlan.detector}
                            onChange={(e) => setOutlierStrategy(col.column, { detector: e.target.value as OutlierDetector })}
                            className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                          >
                            {DETECTOR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={currentPlan.treatment}
                            onChange={(e) => setOutlierStrategy(col.column, { treatment: e.target.value as OutlierTreatment })}
                            className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                          >
                            {TREATMENT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <p className="mt-2 text-[10px] text-slate-500">
                            {currentPlan.treatment === 'ignore' && 'Keep values as they are.'}
                            {currentPlan.treatment === 'drop_rows' && 'Detected rows will be removed from the training data.'}
                            {currentPlan.treatment === 'cap_1_99' && 'Only detected values will be clipped to the 1st/99th percentiles.'}
                            {currentPlan.treatment === 'cap_5_95' && 'Only detected values will be clipped to the 5th/95th percentiles.'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-bold text-slate-700">
                              {detectorLabel(recommendedPlan.detector)} + {treatmentLabel(recommendedPlan.treatment)}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                              {col.suggestion_reason ?? 'The recommendation is chosen from the feature shape and the proportion of flagged values.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between">
        {isComplete ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={16} />
            Outlier Handling Confirmed
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          Confirm Outlier Plan
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default OutliersTab;
