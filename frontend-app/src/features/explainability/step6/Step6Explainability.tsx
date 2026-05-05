import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Crown,
  Info,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDomainStore } from '../../../store/useDomainStore';
import { ModelResult, useModelStore } from '../../../store/useModelStore';
import { getModelCatalogEntry } from '../../modelTuning/modelCatalog';
import { buildRunLabel } from '../../modelTuning/runLabeling';
import { getExplainabilityWorkbench, simulateExplainability } from '../../../services/pipelineApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type HistogramBin = { start: number; end: number; count: number };
type GlobalFeature = {
  feature: string;
  importance: number;
  histogram: HistogramBin[];
  summary: { min: number; max: number; mean: number; median: number };
};
type RecordOption = {
  record_id: string;
  position: number;
  predicted_label: string;
  predicted_probability: number;
  predicted_value?: number | null;
  confidence_band: 'low' | 'moderate' | 'high';
  top_feature_values?: Record<string, number | string>;
};
type ControlFeature = {
  feature: string;
  control_type: 'binary' | 'integer' | 'continuous';
  min: number;
  max: number;
  step: number;
  default_value: number;
};
type ScenarioFeature = { feature: string; impact: number; value: number; direction: 'increase' | 'decrease' };
type ExplainabilityScenario = {
  record_id: string;
  prediction: {
    prediction_mode?: 'classification' | 'multiclass' | 'regression' | string;
    target_class_index: number;
    target_class_label: string;
    target_probability: number | null;
    baseline_probability: number | null;
    predicted_value?: number | null;
    baseline_value?: number | null;
    delta_from_baseline: number;
    confidence_band: 'low' | 'moderate' | 'high';
    class_probabilities: Array<{ label: string; probability: number }>;
  };
  feature_values: Record<string, number>;
  local_explanation: {
    computation_mode: string;
    base_value: number;
    predicted_value: number;
    top_features: ScenarioFeature[];
  };
};
type ExplainabilityWorkbench = {
  session_id: string;
  run_id: string;
  summary: {
    algorithm: string;
    model_id: string;
    problem_type?: 'classification' | 'multiclass' | 'regression' | string;
    class_count: number;
    cv_score: number;
    train_test_gap: number;
    stability_score: number;
    overfitting_risk: string;
    primary_metric_name?: string;
    primary_metric_direction?: 'higher_is_better' | 'lower_is_better' | string;
    selection_rationale: string;
  };
  global_explanation: {
    computation_mode: string;
    source: string;
    features: GlobalFeature[];
  };
  simulator: {
    debounce_ms: number;
    computation_mode: string;
    record_options: RecordOption[];
    default_record_id: string;
    control_features: ControlFeature[];
    selected_scenario: ExplainabilityScenario;
  };
};

const DOCTOR_SIMULATOR_FEATURE_LIMIT = 3;

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(id);
  }, [delay, value]);
  return debouncedValue;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatPercent(value?: number | null): string {
  if (value == null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value?: number | null, digits = 3): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return Number(value).toFixed(digits);
}

function formatSignedNumber(value?: number | null, digits = 3): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(digits)}`;
}

function formatPredictionLabel(value?: string | null): string {
  if (!value) return 'N/A';
  return formatFriendlyLabel(String(value));
}

function formatMetricValue(value?: number | null, metric?: string | null): string {
  const raw = String(metric ?? '').toLowerCase();
  if (raw === 'rmse' || raw === 'mae' || raw === 'r2') {
    return formatNumber(value);
  }
  return formatPercent(value);
}

function formatImpactValue(value: number, problemType: 'classification' | 'multiclass' | 'regression'): string {
  if (problemType === 'regression') {
    return formatSignedNumber(value);
  }
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function getGlobalExplainabilityCopy(
  source: string,
  problemType: 'classification' | 'multiclass' | 'regression',
): string {
  if (problemType === 'regression') {
    return `Source: ${source}. Higher bars show which features move the numeric prediction most across the sample.`;
  }
  if (problemType === 'multiclass') {
    return `Source: ${source}. Higher bars show which features separate class decisions most strongly across the sample.`;
  }
  return `Source: ${source}. Hover any bar to see feature distribution details.`;
}

function getLocalImpactLabels(
  problemType: 'classification' | 'multiclass' | 'regression',
): { title: string; increase: string; decrease: string; positiveTone: string; negativeTone: string } {
  if (problemType === 'regression') {
    return {
      title: 'Value Contributions',
      increase: 'Raises value',
      decrease: 'Lowers value',
      positiveTone: 'Prediction moved upward',
      negativeTone: 'Prediction moved downward',
    };
  }
  if (problemType === 'multiclass') {
    return {
      title: 'Class Support Contributions',
      increase: 'Raises class support',
      decrease: 'Lowers class support',
      positiveTone: 'Increases support for this class',
      negativeTone: 'Decreases support for this class',
    };
  }
  return {
    title: 'Feature Impacts',
    increase: 'Increases risk',
    decrease: 'Decreases risk',
    positiveTone: 'Increases risk',
    negativeTone: 'Decreases risk',
  };
}

function getExplainabilityProblemType(run?: ModelResult | null, workbench?: ExplainabilityWorkbench | null): 'classification' | 'multiclass' | 'regression' {
  const raw = String(run?.problem_type ?? workbench?.summary.problem_type ?? '').toLowerCase();
  if (raw === 'regression') return 'regression';
  if (raw === 'multiclass') return 'multiclass';
  return 'classification';
}

function compareExplainabilityRuns(left: ModelResult, right: ModelResult): number {
  const problemType = getExplainabilityProblemType(left);
  const leftMetrics = left.test_metrics ?? left.metrics;
  const rightMetrics = right.test_metrics ?? right.metrics;

  if (problemType === 'regression') {
    const rmseDiff = (leftMetrics.rmse ?? Number.POSITIVE_INFINITY) - (rightMetrics.rmse ?? Number.POSITIVE_INFINITY);
    if (rmseDiff !== 0) return rmseDiff;
    return (rightMetrics.r2 ?? Number.NEGATIVE_INFINITY) - (leftMetrics.r2 ?? Number.NEGATIVE_INFINITY);
  }

  const f1Diff = (rightMetrics.f1_score ?? 0) - (leftMetrics.f1_score ?? 0);
  return f1Diff !== 0 ? f1Diff : (rightMetrics.accuracy ?? 0) - (leftMetrics.accuracy ?? 0);
}

function clinicalRiskLabel(value?: string | null): string {
  if (value === 'high') return 'High caution';
  if (value === 'moderate') return 'Moderate caution';
  if (value === 'low') return 'Low caution';
  return 'Review pending';
}

function clinicalConsistencyGuidance(value?: number | null): string {
  if (value == null) return 'Safe range: 0-5%; review carefully above 12%';
  if (value <= 0.05) return 'Safe range: this is within the preferred 0-5% consistency gap.';
  if (value <= 0.12) return 'Watch range: acceptable, but closer review is useful above 5%.';
  return 'Caution range: above 12%, review the system output carefully.';
}

function clinicalReliabilityGuidance(value?: number | null): string {
  if (value == null) return 'Safe range: 85-100%; caution below 70%';
  if (value >= 0.85) return 'Safe range: reliability is in the preferred 85-100% band.';
  if (value >= 0.7) return 'Watch range: usable with review; preferred band starts at 85%.';
  return 'Caution range: below 70%, treat this support signal carefully.';
}

function clinicalDecisionBalanceGuidance(value?: number | null): string {
  if (value == null) return 'Safe range: 85-100%; caution below 70%';
  if (value >= 0.85) return 'Safe range: decision balance is in the preferred band.';
  if (value >= 0.7) return 'Watch range: acceptable, but not in the strongest band.';
  return 'Caution range: weaker balance between missed and false alerts.';
}

function confidenceBadgeClass(band: RecordOption['confidence_band']): string {
  if (band === 'high') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (band === 'moderate') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

/** Format a rich dropdown label using top_feature_values from the backend (Option B) */
function formatRecordLabel(record: RecordOption): string {
  const pct = (record.predicted_probability * 100).toFixed(0);
  const label = record.predicted_label;

  if (record.top_feature_values && Object.keys(record.top_feature_values).length > 0) {
    const featureParts = Object.entries(record.top_feature_values)
      .slice(0, 2)
      .map(([key, val]) => `${key}: ${val}`)
      .join(' · ');
    return `#${record.position} · ${featureParts} · Predicted: ${label} (${pct}%)`;
  }

  // Fallback when top_feature_values not available
  return `#${record.position} · ${record.confidence_band.toUpperCase()} confidence · Predicted: ${label} (${pct}%)`;
}

function formatClinicalRecordLabel(
  record: RecordOption,
  problemType: 'classification' | 'multiclass' | 'regression' = 'classification',
): string {
  if (problemType === 'regression') {
    return `Patient ${record.position} · Estimated value: ${formatNumber(record.predicted_value)}`;
  }

  const pct = (record.predicted_probability * 100).toFixed(0);
  const label = decodeClinicalClassLabel(record.predicted_label).full;
  return `Patient ${record.position} · Suggested: ${label} (${pct}%)`;
}

function buildRunLabels(resultsMap: Record<string, ModelResult>, tasks: Record<string, { createdAt?: string }>) {
  const ordered = Object.values(resultsMap).sort((l, r) =>
    new Date(tasks[l.taskId]?.createdAt ?? 0).getTime() - new Date(tasks[r.taskId]?.createdAt ?? 0).getTime()
  );
  const counters: Partial<Record<ModelResult['model'], number>> = {};
  return ordered.reduce<Record<string, string>>((acc, run) => {
    const n = (counters[run.model] ?? 0) + 1;
    counters[run.model] = n;
    acc[run.taskId] = buildRunLabel(run.model, run.parameters, n, run.problem_type ?? 'classification');
    return acc;
  }, {});
}

function diffFeatureValues(base: Record<string, number>, next: Record<string, number>) {
  return Object.entries(next).reduce<Record<string, number>>((acc, [feat, val]) => {
    const prev = base[feat];
    if (prev == null || Math.abs(prev - val) > 1e-6) acc[feat] = val;
    return acc;
  }, {});
}

function buildFallbackControlFeature(feature: GlobalFeature, activeValues: Record<string, number>): ControlFeature | null {
  const min = Number(feature.summary?.min);
  const max = Number(feature.summary?.max);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return null;
  }

  const isInteger = Number.isInteger(min) && Number.isInteger(max);
  const span = max - min;
  const step = isInteger ? 1 : Number(Math.max(span / 100, 0.001).toPrecision(2));
  const activeValue = activeValues[feature.feature];
  const defaultValue =
    typeof activeValue === 'number' && Number.isFinite(activeValue)
      ? activeValue
      : Number.isFinite(feature.summary.median)
        ? feature.summary.median
        : feature.summary.mean;

  return {
    feature: feature.feature,
    control_type: isInteger ? 'integer' : 'continuous',
    min,
    max,
    step,
    default_value: defaultValue,
  };
}

function buildDoctorTopImportanceControls(
  globalFeatures: GlobalFeature[],
  controlFeatures: ControlFeature[],
  activeValues: Record<string, number>,
): ControlFeature[] {
  const controlByFeature = new Map(controlFeatures.map((control) => [control.feature, control] as const));

  return [...globalFeatures]
    .sort((left, right) => right.importance - left.importance)
    .slice(0, DOCTOR_SIMULATOR_FEATURE_LIMIT)
    .map((feature) => controlByFeature.get(feature.feature) ?? buildFallbackControlFeature(feature, activeValues))
    .filter((control): control is ControlFeature => Boolean(control));
}

function getDisplayedImpactFeatures(
  scenario: ExplainabilityScenario,
  controlFeatures: ControlFeature[],
  clinicalMode?: boolean,
): ScenarioFeature[] {
  const features = scenario.local_explanation.top_features;
  if (!clinicalMode || controlFeatures.length === 0) return features;

  return controlFeatures.map((control) => {
    const existingFeature = features.find((feature) => feature.feature === control.feature);
    if (existingFeature) return existingFeature;

    return {
      feature: control.feature,
      impact: 0,
      value: scenario.feature_values[control.feature] ?? control.default_value,
      direction: 'decrease',
    };
  });
}

const CLINICAL_FEATURE_ALIASES: Record<string, string> = {
  radius_mean: 'Average Tumor Radius',
  texture_mean: 'Average Tumor Texture',
  perimeter_mean: 'Average Tumor Perimeter',
  area_mean: 'Average Tumor Area',
  smoothness_mean: 'Average Tissue Smoothness',
  compactness_mean: 'Average Tissue Compactness',
  concavity_mean: 'Average Tissue Concavity',
  concave_points_mean: 'Average Concave Points',
  symmetry_mean: 'Average Tissue Symmetry',
  fractal_dimension_mean: 'Average Fractal Dimension',
  radius_se: 'Tumor Radius Variation',
  texture_se: 'Tumor Texture Variation',
  perimeter_se: 'Tumor Perimeter Variation',
  area_se: 'Tumor Area Variation',
  smoothness_se: 'Tissue Smoothness Variation',
  compactness_se: 'Tissue Compactness Variation',
  concavity_se: 'Tissue Concavity Variation',
  concave_points_se: 'Concave Points Variation',
  symmetry_se: 'Tissue Symmetry Variation',
  fractal_dimension_se: 'Fractal Dimension Variation',
  radius_worst: 'Maximum Tumor Radius',
  texture_worst: 'Maximum Tumor Texture',
  perimeter_worst: 'Maximum Tumor Perimeter',
  area_worst: 'Maximum Tumor Area',
  smoothness_worst: 'Maximum Tissue Smoothness',
  compactness_worst: 'Maximum Tissue Compactness',
  concavity_worst: 'Maximum Tissue Concavity',
  concave_points_worst: 'Maximum Concave Points',
  symmetry_worst: 'Maximum Tissue Symmetry',
  fractal_dimension_worst: 'Maximum Fractal Dimension',
};

function toClinicalFeatureLabel(feature: string): string {
  if (CLINICAL_FEATURE_ALIASES[feature]) {
    return CLINICAL_FEATURE_ALIASES[feature];
  }

  const normalized = feature.replace(/_/g, ' ').trim();
  if (!normalized) return feature;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildClinicalReason(
  feature: ScenarioFeature,
  referenceFeature?: GlobalFeature,
  riskDirection: 'increase' | 'decrease' = 'increase',
): string {
  const label = toClinicalFeatureLabel(feature.feature);
  const summary = referenceFeature?.summary;

  if (!summary) {
    return riskDirection === 'increase'
      ? `${label} is outside the usual clinical range.`
      : `${label} stays within a reassuring clinical range.`;
  }

  const value = feature.value;
  const mean = summary.mean;
  const upperSpread = Math.max(summary.max - mean, 0.0001);
  const lowerSpread = Math.max(mean - summary.min, 0.0001);

  if (riskDirection === 'increase') {
    if (value >= mean + upperSpread * 0.35) {
      return `${label} is significantly higher than normal.`;
    }
    if (value > mean) {
      return `${label} is above the risk threshold.`;
    }
    return `${label} remains clinically relevant in this decision.`;
  }

  if (value <= mean - lowerSpread * 0.35) {
    return `${label} is comfortably below the concerning range.`;
  }
  if (value < mean) {
    return `${label} stays below the higher-risk range.`;
  }
  return `${label} remains stable and does not increase concern.`;
}

function formatFriendlyLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function decodeClinicalClassLabel(rawLabel?: string | null, targetClassIndex?: number | null) {
  const label = String(rawLabel ?? '').trim();
  const lowered = label.toLowerCase();

  if (label === '1' || lowered === 'm' || lowered === 'malignant' || lowered === 'positive') {
    return { short: 'M', full: 'Malignant' };
  }
  if (label === '0' || lowered === 'b' || lowered === 'benign' || lowered === 'negative') {
    return { short: 'B', full: 'Benign' };
  }

  if (!label && targetClassIndex != null) {
    if (targetClassIndex === 1) return { short: 'M', full: 'Malignant' };
    if (targetClassIndex === 0) return { short: 'B', full: 'Benign' };
  }

  if (/^[0-9]+$/.test(label)) {
    return { short: label, full: `Class ${label}` };
  }

  if (label.length === 1) {
    return { short: label.toUpperCase(), full: formatFriendlyLabel(label) };
  }

  return { short: label.charAt(0).toUpperCase(), full: formatFriendlyLabel(label) };
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-100 ${className}`} />
);

const WorkbenchSkeleton: React.FC = () => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <SkeletonBlock className="h-5 w-40" />
      <SkeletonBlock className="h-[480px]" />
    </div>
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <SkeletonBlock className="h-5 w-48" />
      <SkeletonBlock className="h-12 w-full" />
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonBlock className="h-[280px]" />
      <SkeletonBlock className="h-20" />
      <SkeletonBlock className="h-20" />
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const Step6Explainability: React.FC = () => {
  const sessionId = useDomainStore((state) => state.sessionId);
  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const completeStep6 = useDomainStore((state) => state.completeStep6);
  const userMode = useDomainStore((state) => state.userMode);
  const resultsMap = useModelStore((state) => state.results);
  const tasks = useModelStore((state) => state.tasks);
  const bestResultTaskId = useModelStore((state) => state.bestResultTaskId);

  const runs = useMemo(() => Object.values(resultsMap), [resultsMap]);
  const runLabels = useMemo(() => buildRunLabels(resultsMap, tasks), [resultsMap, tasks]);
  const sortedRuns = useMemo(() => [...runs].sort(compareExplainabilityRuns), [runs]);

  const champion = useMemo(() => {
    if (!bestResultTaskId) return sortedRuns[0];
    return runs.find((r) => r.taskId === bestResultTaskId) ?? sortedRuns[0];
  }, [bestResultTaskId, runs, sortedRuns]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [workbench, setWorkbench] = useState<ExplainabilityWorkbench | null>(null);
  const [scenario, setScenario] = useState<ExplainabilityScenario | null>(null);
  const [baseFeatureValues, setBaseFeatureValues] = useState<Record<string, number>>({});
  const [activeFeatureValues, setActiveFeatureValues] = useState<Record<string, number>>({});
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  // Auto-select champion on load
  useEffect(() => {
    if (champion && !selectedTaskId) setSelectedTaskId(champion.taskId);
  }, [champion, selectedTaskId]);

  const selectedRun = runs.find((r) => r.taskId === selectedTaskId) ?? champion;
  const isNonChampion = Boolean(selectedRun && champion && selectedRun.taskId !== champion.taskId);
  const problemType = getExplainabilityProblemType(selectedRun, workbench);
  const isRegression = problemType === 'regression';
  const isMulticlass = problemType === 'multiclass' || (!isRegression && (workbench?.summary.class_count ?? 0) > 2);

  // Fetch workbench when run changes
  useEffect(() => {
    if (!selectedRun?.runId) return;
    let disposed = false;
    setIsLoading(true);
    setError(null);
    setWorkbench(null);
    void getExplainabilityWorkbench({ session_id: sessionId, run_id: selectedRun.runId })
      .then((data: ExplainabilityWorkbench) => {
        if (disposed) return;
        setWorkbench(data);
        setScenario(data.simulator.selected_scenario);
        setBaseFeatureValues(data.simulator.selected_scenario.feature_values);
        setActiveFeatureValues(data.simulator.selected_scenario.feature_values);
        setSelectedRecordId(data.simulator.selected_scenario.record_id);
      })
      .catch((err: any) => {
        if (!disposed)
          setError(err?.response?.data?.detail ?? err?.message ?? 'Explainability workbench could not be loaded.');
      })
      .finally(() => {
        if (!disposed) setIsLoading(false);
      });
    return () => { disposed = true; };
  }, [selectedRun?.runId, sessionId]);

  // Debounced What-If simulation
  const debounceMs = workbench?.simulator.debounce_ms ?? 500;
  const debouncedOverrides = useDebouncedValue(diffFeatureValues(baseFeatureValues, activeFeatureValues), debounceMs);

  useEffect(() => {
    if (!workbench || !selectedRun?.runId || Object.keys(debouncedOverrides).length === 0) return;
    const reqId = ++requestRef.current;
    setIsSimulating(true);
    void simulateExplainability({
      session_id: sessionId,
      run_id: selectedRun.runId,
      record_id: selectedRecordId,
      feature_overrides: debouncedOverrides,
    })
      .then((data: { scenario: ExplainabilityScenario }) => {
        if (reqId !== requestRef.current) return;
        setScenario(data.scenario);
        setBaseFeatureValues(data.scenario.feature_values);
        setActiveFeatureValues(data.scenario.feature_values);
      })
      .catch(() => {
        if (reqId === requestRef.current)
          setError('Simulation update failed. The last confirmed explanation is still shown.');
      })
      .finally(() => {
        if (reqId === requestRef.current) setIsSimulating(false);
      });
  }, [debouncedOverrides, selectedRecordId, selectedRun?.runId, sessionId, workbench]);

  const runnerUp = sortedRuns.find((r) => r.taskId !== champion?.taskId);

  if (!champion) {
    return (
      <div className="space-y-6 px-4 py-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <div className="mb-2 flex items-center gap-3 font-bold">
            <AlertCircle size={20} />
            Explainability needs at least one trained model
          </div>
          <p className="text-sm">Complete Step 4 and Step 5 first, then click "Complete Training &amp; Proceed to Explainability".</p>
          <button
            onClick={() => setCurrentStep(5)}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm transition-colors hover:bg-slate-50"
          >
            Return to Step 5
          </button>
        </div>
      </div>
    );
  }

  if (userMode === 'clinical') {
    return (
      <div className="space-y-6 px-4 py-8">
        <div className="ha-step6-shell overflow-hidden rounded-[32px] border border-[#d7e5de] bg-[#edf3ef] shadow-sm">
          <div className="ha-step6-hero border-b border-[#d7e5de] bg-[#edf3ef] px-8 py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] font-mono text-slate-500">Step 6</p>
                <h1 className="ha-step6-hero-title mt-2 text-3xl font-black tracking-tight text-slate-900">Clinical Review Summary</h1>
                <p className="ha-step6-hero-copy mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                  {problemType === 'regression'
                    ? 'Review the recommended system version, the main patient findings, and how the estimated value changes when key findings are adjusted.'
                    : 'Review the recommended system version, the main patient findings, and how the decision changes when key findings are adjusted.'}
                </p>
              </div>

              <div className="min-w-[300px]">
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] font-mono text-slate-500">System Version</label>
                <select
                  value={selectedTaskId ?? champion.taskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full rounded-2xl border border-[#d7e5de] bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm"
                >
                  {sortedRuns.map((run) => {
                    const isChamp = run.taskId === champion.taskId;
                    const label = getModelCatalogEntry(run.model, run.problem_type ?? 'classification').name;
                    return (
                      <option key={run.taskId} value={run.taskId}>
                        {isChamp ? `${label} (Recommended)` : label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {isNonChampion && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <span>
                  <strong>Note:</strong> This version needs more caution than the recommended one. For routine review, the{' '}
                  <button
                    className="font-black underline underline-offset-2 hover:text-amber-700"
                    onClick={() => setSelectedTaskId(champion.taskId)}
                  >
                    recommended version
                  </button>{' '}
                  remains the safer choice.
                </span>
              </div>
            )}

            <ChampionJustificationBanner
              champion={champion}
              selectedRun={selectedRun}
              runLabels={runLabels}
              summary={workbench?.summary}
              runnerUp={runnerUp}
              clinicalMode
              problemType={problemType}
            />

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <Info size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {isLoading || !workbench || !scenario ? (
              <WorkbenchSkeleton />
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <GlobalFeaturePanel globalExplanation={workbench.global_explanation} clinicalMode problemType={problemType} />
                <LocalExplainabilityPanel
                  simulatorMode={workbench.simulator.computation_mode}
                  recordOptions={workbench.simulator.record_options}
                  selectedRecordId={selectedRecordId}
                  onRecordChange={async (recordId) => {
                    if (!selectedRun?.runId) return;
                    const reqId = ++requestRef.current;
                    setSelectedRecordId(recordId);
                    setIsSimulating(true);
                    setError(null);
                    try {
                      const data = await simulateExplainability({
                        session_id: sessionId,
                        run_id: selectedRun.runId,
                        record_id: recordId,
                        feature_overrides: {},
                      });
                      if (reqId !== requestRef.current) return;
                      setScenario(data.scenario);
                      setBaseFeatureValues(data.scenario.feature_values);
                      setActiveFeatureValues(data.scenario.feature_values);
                    } catch {
                      if (reqId === requestRef.current) setError('The selected patient record could not be loaded.');
                    } finally {
                      if (reqId === requestRef.current) setIsSimulating(false);
                    }
                  }}
                  scenario={scenario}
                  controlFeatures={buildDoctorTopImportanceControls(
                    workbench.global_explanation.features,
                    workbench.simulator.control_features,
                    activeFeatureValues,
                  )}
                  activeValues={activeFeatureValues}
                  onFeatureChange={(feat, val) => setActiveFeatureValues((cur) => ({ ...cur, [feat]: val }))}
                  isSimulating={isSimulating}
                  clinicalMode
                  problemType={problemType}
                />
              </div>
            )}

          </div>
        </div>
      </div>
    );

    const topFactors = scenario?.local_explanation.top_features?.slice(0, 5) ?? [];
    const successRate = formatPercent((champion.test_metrics ?? champion.metrics)?.accuracy);
    const reliabilityRisk =
      champion.test_visualization?.generalization?.risk ??
      champion.visualization?.generalization?.risk ??
      workbench?.summary.overfitting_risk ??
      'low';
    const isHighRiskDecision =
      (scenario?.prediction.target_probability ?? 0) >= 0.5 ||
      /malignant|positive|high/i.test(scenario?.prediction.target_class_label ?? '');
    const globalFeatureLookup = new Map(
      (workbench?.global_explanation.features ?? []).map((feature) => [feature.feature, feature] as const),
    );
    const primaryClinicalFactors = (workbench?.global_explanation.features ?? []).slice(0, 6).map((feature) => ({
      ...feature,
      clinicalLabel: toClinicalFeatureLabel(feature.feature),
    }));
    const drivingFactors =
      scenario?.local_explanation.top_features
        ?.filter((feature) => (isHighRiskDecision ? feature.impact >= 0 : feature.impact < 0))
        .slice(0, 3) ?? [];
    const displayedReasons =
      drivingFactors.length > 0 ? drivingFactors : (scenario?.local_explanation.top_features?.slice(0, 3) ?? []);

    return (
      <div className="space-y-6">
        <div className="ha-card-muted p-6 sm:p-8">
          <div>
            <p className="ha-section-label">Step 6 · Clinical Explanation</p>
            <h2 className="mt-2 font-[var(--font-display)] text-[34px] font-bold tracking-[-0.06em] text-[var(--text)]">
              Clinical AI Explanation Summary
            </h2>
            <p className="ha-body mt-3 max-w-3xl">
              This page is designed for clinical review. It summarizes how reliable the system is, which medical factors matter most, and why this decision was made.
            </p>
          </div>
        </div>

        {isLoading || !workbench || !scenario ? (
          <WorkbenchSkeleton />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-6">
              <div className="ha-card p-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-emerald-100 text-emerald-700">
                    <ShieldCheck size={28} />
                  </div>
                  <div className="min-w-0">
                    <p className="ha-section-label">System Reliability Summary</p>
                    <h3 className="mt-2 text-2xl font-bold text-[var(--text)]">Safe to review in clinical context</h3>
                    <p className="mt-3 text-sm leading-8 text-[var(--text2)]">
                      The system has learned the patterns in this dataset with a <strong>{successRate}</strong> success rate and is{' '}
                      {reliabilityRisk === 'high' ? 'best used with closer clinical review.' : 'suitable for clinical use.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                        <ShieldCheck size={16} />
                        Reliability confirmed
                      </span>
                      <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold ${
                        reliabilityRisk === 'high'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : reliabilityRisk === 'moderate'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}>
                        Risk: {reliabilityRisk === 'high' ? 'High' : reliabilityRisk === 'moderate' ? 'Moderate' : 'Low'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ha-card p-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <BrainCircuit size={28} />
                  </div>
                  <div className="min-w-0">
                    <p className="ha-section-label">Key Clinical Factors</p>
                    <h3 className="mt-2 text-2xl font-bold text-[var(--text)]">
                      Primary Clinical Factors Influencing the Disease
                    </h3>
                    <p className="mt-3 text-sm leading-8 text-[var(--text2)]">
                      These are the strongest clinical patterns the system relied on across the dataset.
                    </p>
                  </div>
                </div>

                <div className="mt-6 h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...primaryClinicalFactors].reverse()}
                      layout="vertical"
                      margin={{ top: 8, right: 12, left: 16, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d7e6dd" />
                      <XAxis type="number" tickFormatter={(value) => Number(value).toFixed(2)} stroke="#6b7c72" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="clinicalLabel" type="category" width={210} stroke="#6b7c72" tick={{ fontSize: 12, fontWeight: 600 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0,89,62,0.05)' }}
                        formatter={(value: number) => [Number(value).toFixed(3), 'Influence']}
                        labelFormatter={(_, payload) => {
                          const current = payload?.[0]?.payload as { clinicalLabel?: string } | undefined;
                          return current?.clinicalLabel ?? '';
                        }}
                      />
                      <Bar dataKey="importance" radius={[0, 8, 8, 0]}>
                        {primaryClinicalFactors.map((feature, index) => (
                          <Cell key={feature.feature} fill={index % 2 === 0 ? '#70b79a' : '#9dcfb8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="ha-card p-6">
              <div className="flex items-start gap-4">
                <div className={`grid h-14 w-14 place-items-center rounded-[18px] ${
                  isHighRiskDecision ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isHighRiskDecision ? <AlertTriangle size={28} /> : <ShieldCheck size={28} />}
                </div>
                <div className="min-w-0">
                  <p className="ha-section-label">AI Diagnosis Summary</p>
                  <h3 className="mt-2 text-2xl font-bold text-[var(--text)]">System decision</h3>
                  <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff,#f5faf6)] px-5 py-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text3)]">Decision</p>
                    <p className={`mt-2 font-[var(--font-display)] text-[34px] font-bold tracking-[-0.05em] ${
                      isHighRiskDecision ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      {scenario.prediction.target_class_label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text2)]">
                      Confidence: {formatPercent(scenario.prediction.target_probability)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-bold text-[var(--text)]">Primary reasons for this decision</p>
                <div className="mt-4 space-y-3">
                  {displayedReasons.map((feature, index) => {
                    const riskIncreasing = isHighRiskDecision ? feature.impact >= 0 : feature.impact < 0;
                    const referenceFeature = globalFeatureLookup.get(feature.feature);
                    return (
                      <div
                        key={`${feature.feature}-${index}`}
                        className={`rounded-[18px] border px-4 py-4 ${
                          riskIncreasing
                            ? 'border-rose-200 bg-rose-50'
                            : 'border-emerald-200 bg-emerald-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-base">{riskIncreasing ? '🔴' : '🟢'}</span>
                          <div className="min-w-0">
                            <p className={`text-sm font-bold ${riskIncreasing ? 'text-rose-800' : 'text-emerald-800'}`}>
                              {riskIncreasing ? 'Risk Increasing' : 'Risk Reducing'}
                            </p>
                            <p className="mt-1 text-sm leading-7 text-[var(--text)]">
                              {buildClinicalReason(
                                feature,
                                referenceFeature,
                                riskIncreasing ? 'increase' : 'decrease',
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 rounded-[20px] border border-[var(--border)] bg-slate-50 px-5 py-5">
                <p className="text-sm font-semibold text-[var(--text)]">Clinical note</p>
                <p className="mt-2 text-sm leading-8 text-[var(--text2)]">
                  This explanation supports clinical review by showing the major medical signals behind the system output. Final patient decisions should still follow clinical judgment and local protocols.
                </p>
              </div>

              <div className="mt-6">
                <button
                  id="proceed-to-ethics-btn"
                  onClick={completeStep6}
                  className="ha-button-primary flex w-full items-center justify-center gap-3 py-4 text-base font-bold"
                >
                  Approve System Explanation &amp; Continue
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="ha-card-muted p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="ha-section-label">Step 6 · Explainability</p>
              <h2 className="mt-2 font-[var(--font-display)] text-[34px] font-bold tracking-[-0.06em] text-[var(--text)]">
                Top factors influencing this prediction
              </h2>
              <p className="ha-body mt-3 max-w-2xl">
                This view translates the champion model into plain-language drivers so you can see which features pushed the recommendation higher or lower.
              </p>
            </div>

            <div className="rounded-[18px] border border-[var(--border)] bg-white/88 px-5 py-4">
              <p className="ha-section-label">Champion Model</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                {runLabels[champion.taskId] ?? getModelCatalogEntry(champion.model, champion.problem_type ?? 'classification').name}
              </p>
            </div>
          </div>
        </div>

        {isLoading || !workbench || !scenario ? (
          <WorkbenchSkeleton />
        ) : (
          <>
            <div className="ha-card p-6">
              <div className="space-y-5">
                {topFactors.map((feature, index) => {
                  const positive = feature.direction === 'increase' || feature.impact >= 0;
                  const width = `${Math.min(100, Math.abs(feature.impact) * 100)}%`;
                  return (
                    <div key={`${feature.feature}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1"> 
                          <p className="text-sm font-semibold text-[var(--text)] break-words">{feature.feature}</p> 
                          <p className="text-sm text-[var(--text2)] break-words"> 
                            {positive
                              ? 'This feature increases the predicted risk signal.'
                              : 'This feature reduces the predicted risk signal.'}
                          </p>
                        </div>
                        <span className={`ha-badge ${positive ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-800'}`}>
                          {feature.impact >= 0 ? '+' : ''}
                          {feature.impact.toFixed(3)}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-[999px] bg-[var(--surface2)]">
                        <div
                          className={`h-full rounded-[999px] ${positive ? 'bg-[linear-gradient(90deg,var(--clinical),#14b8a6)]' : 'bg-[linear-gradient(90deg,#f97316,#dc2626)]'}`}
                          style={{ width }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ha-card p-6">
              <p className="ha-section-label">Clinical Takeaway</p>
              <h3 className="mt-2 text-xl font-bold text-[var(--text)]">What to keep in mind</h3>
              <p className="mt-3 text-sm leading-8 text-[var(--text2)]">
                {workbench.summary.selection_rationale}
              </p>
              <p className="mt-3 text-sm leading-8 text-[var(--text2)]">
                Use this explanation as context for review and prioritization, not as a stand-alone clinical decision.
              </p>
            </div>

            <div className="ha-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="ha-section-label">Next Step</p>
                  <p className="mt-2 text-sm text-[var(--text2)]">
                    Finalize the workflow with the export and safety review step.
                  </p>
                </div>
                <button
                  id="proceed-to-ethics-btn"
                  onClick={completeStep6}
                  className="ha-button-primary inline-flex items-center justify-center gap-3"
                >
                  Continue to Final Results
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-8">
      <div className="ha-step6-shell overflow-hidden rounded-[32px] border border-[#d7e5de] bg-[#edf3ef] shadow-sm">

        {/* ── Page header ── */}
        <div className="ha-step6-hero border-b border-[#d7e5de] bg-[#edf3ef] px-8 py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] font-mono text-slate-500">Step 6</p>
              <h1 className="ha-step6-hero-title mt-2 text-3xl font-black tracking-tight text-slate-900">Model Explainability</h1>
              <p className="ha-step6-hero-copy mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                {isRegression
                  ? 'Inspect why the champion model stayed stable, which features move the predicted value most, and how a single record changes when you adjust its inputs.'
                  : isMulticlass
                    ? 'Inspect why the champion model won, which features support each class decision, and how a single record shifts when you change its values.'
                    : 'Inspect why the champion model won, which features drive the global pattern, and how a single record shifts when you change its values.'}
              </p>
            </div>

            {/* Active run selector with 👑 badge */}
            <div className="min-w-[300px]">
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] font-mono text-slate-500">Active Run</label>
              <select
                value={selectedTaskId ?? champion.taskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full rounded-2xl border border-[#d7e5de] bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm"
              >
                {sortedRuns.map((run) => {
                  const isChamp = run.taskId === champion.taskId;
                  const label = runLabels[run.taskId] ?? getModelCatalogEntry(run.model, run.problem_type ?? 'classification').name;
                  return (
                    <option key={run.taskId} value={run.taskId}>
                      {isChamp ? `👑 ${label} (Champion)` : label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* ── Non-champion warning ── */}
          {isNonChampion && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <strong>Note:</strong> {isRegression
                  ? 'This model is less stable on holdout regression performance. The '
                  : 'This model has a higher overfitting risk. The '}
                <button
                  className="font-black underline underline-offset-2 hover:text-amber-700"
                  onClick={() => setSelectedTaskId(champion.taskId)}
                >
                  Champion model
                </button>{' '}
                {isRegression ? 'is recommended for the clearest explanation view.' : 'is recommended for final decisions.'}
              </span>
            </div>
          )}

          {/* ── Champion Justification Banner ── */}
          <ChampionJustificationBanner
            champion={champion}
            selectedRun={selectedRun}
            runLabels={runLabels}
            summary={workbench?.summary}
            runnerUp={runnerUp}
            problemType={problemType}
          />

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Main workbench panels ── */}
          {isLoading || !workbench || !scenario ? (
            <WorkbenchSkeleton />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <GlobalFeaturePanel globalExplanation={workbench.global_explanation} problemType={problemType} />
              <LocalExplainabilityPanel
                simulatorMode={workbench.simulator.computation_mode}
                recordOptions={workbench.simulator.record_options}
                selectedRecordId={selectedRecordId}
                onRecordChange={async (recordId) => {
                  if (!selectedRun?.runId) return;
                  const reqId = ++requestRef.current;
                  setSelectedRecordId(recordId);
                  setIsSimulating(true);
                  setError(null);
                  try {
                    const data = await simulateExplainability({
                      session_id: sessionId,
                      run_id: selectedRun.runId,
                      record_id: recordId,
                      feature_overrides: {},
                    });
                    if (reqId !== requestRef.current) return;
                    setScenario(data.scenario);
                    setBaseFeatureValues(data.scenario.feature_values);
                    setActiveFeatureValues(data.scenario.feature_values);
                  } catch {
                    if (reqId === requestRef.current) setError('The selected record could not be loaded.');
                  } finally {
                    if (reqId === requestRef.current) setIsSimulating(false);
                  }
                }}
                scenario={scenario}
                controlFeatures={workbench.simulator.control_features}
                activeValues={activeFeatureValues}
                onFeatureChange={(feat, val) =>
                  setActiveFeatureValues((cur) => ({ ...cur, [feat]: val }))
                }
                isSimulating={isSimulating}
                problemType={problemType}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ─── Champion Justification Banner ────────────────────────────────────────────

const ChampionJustificationBanner: React.FC<{
  champion: ModelResult;
  selectedRun: ModelResult;
  runLabels: Record<string, string>;
  summary?: ExplainabilityWorkbench['summary'];
  runnerUp?: ModelResult;
  clinicalMode?: boolean;
  problemType?: 'classification' | 'multiclass' | 'regression';
}> = ({ champion, selectedRun, runLabels, summary, clinicalMode, problemType = 'classification' }) => {
  const championLabel = runLabels[champion.taskId] ?? getModelCatalogEntry(champion.model, champion.problem_type ?? 'classification').name;
  const selectedLabel = runLabels[selectedRun.taskId] ?? getModelCatalogEntry(selectedRun.model, selectedRun.problem_type ?? 'classification').name;
  const selectedMetrics = selectedRun.test_metrics ?? selectedRun.metrics;
  const isRegression = problemType === 'regression';
  const isMulticlass = problemType === 'multiclass';
  const isClinicalRegression = clinicalMode && isRegression;
  const primaryMetricLabel = isRegression ? 'Holdout RMSE' : isMulticlass ? 'CV F1 Score' : 'CV Score';
  const primaryMetricValue = summary
    ? formatMetricValue(summary.cv_score, isRegression ? 'rmse' : summary.primary_metric_name)
    : '…';
  const gapValue = summary
    ? isRegression
      ? formatNumber(summary.train_test_gap)
      : formatPercent(summary.train_test_gap)
    : '…';
  const gapTone = isRegression
    ? summary && summary.train_test_gap <= 0.1
      ? 'text-emerald-700'
      : summary && summary.train_test_gap >= 0.25
        ? 'text-rose-700'
        : 'text-amber-700'
    : summary && summary.train_test_gap <= 0.05
      ? 'text-emerald-700'
      : summary && summary.train_test_gap >= 0.15
        ? 'text-rose-700'
        : 'text-amber-700';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      {/* Left: champion identity + rationale */}
      <div
        className={`ha-step6-justification-card rounded-[28px] border p-6 shadow-sm ${
        clinicalMode ? 'border-[#d7e5de] bg-[#f7fbf8]' : 'border-[#d7e5de] bg-[#f7fbf8]'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`rounded-2xl p-3 ${clinicalMode ? 'bg-[#e7f1ec] text-[#0f7a64]' : 'bg-[#e7f1ec] text-[#0f7a64]'}`}>
            <ShieldCheck size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${clinicalMode ? 'font-mono text-[#5f766b]' : 'text-emerald-600'}`}>{clinicalMode ? 'Recommended Support View' : 'Champion Model Justification'}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{clinicalMode ? 'Most reliable version for review' : championLabel}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {clinicalMode ? 'This version is recommended because it stayed consistent across reviewed cases and produced the most dependable support signal in validation.' : summary?.selection_rationale ? summary.selection_rationale : `${championLabel} was selected based on the lowest overfitting risk and the smallest gap detected between training and test performance across all trained runs.`}
            </p>
          </div>
        </div>

        {/* Metric pills */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric
            label={clinicalMode ? isRegression ? 'Holdout RMSE' : 'Overall Success' : primaryMetricLabel}
            value={primaryMetricValue}
            subtext={clinicalMode ? isRegression ? 'Lower error is better for patient-level estimates.' : 'Across reviewed cases' : isRegression ? 'Lower holdout error is better' : 'Cross-validation'}
            tone="text-slate-900"
          />
          <SummaryMetric
            label={clinicalMode ? isRegression ? 'Error Gap' : 'Consistency' : isRegression ? 'Error Gap' : 'Train-Test Gap'}
            value={gapValue}
            subtext={clinicalMode ? isRegression ? 'Lower drift between training and holdout error is preferred.' : clinicalConsistencyGuidance(summary?.train_test_gap) : isRegression ? 'Lower error drift is better' : 'Lower is better'}
            tone={gapTone}
          />
          <SummaryMetric
            label={clinicalMode ? isRegression ? 'Stability' : 'Reliability' : 'Stability'}
            value={summary ? formatPercent(summary.stability_score) : '…'}
            subtext={clinicalMode ? isRegression ? 'Generalisation score for the estimated value.' : clinicalReliabilityGuidance(summary?.stability_score) : 'Generalisation score'}
            tone={summary && summary.stability_score >= 0.8 ? 'text-emerald-700' : 'text-amber-700'}
          />
        </div>
      </div>

      {/* Right: current view metrics */}
      <div className={`ha-step6-current-card rounded-[28px] border p-6 shadow-sm ${
        clinicalMode ? 'border-[#d7e5de] bg-[#f7fbf8]' : 'border-[#d7e5de] bg-[#f7fbf8]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl p-3 ${clinicalMode ? 'bg-[#e7f1ec] text-[#0f7a64]' : 'bg-[#e7f1ec] text-[#0f7a64]'}`}>
            <Sparkles size={24} />
          </div>
          <div>
            <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${clinicalMode ? 'font-mono text-[#5f766b]' : 'text-sky-600'}`}>{clinicalMode ? 'Current Review' : 'Current View'}</p>
            <h3 className="text-lg font-black tracking-tight text-slate-900">{clinicalMode ? isClinicalRegression ? 'Estimate quality snapshot' : 'Support quality snapshot' : selectedLabel}</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {isRegression ? (
            <>
              <ComparisonRow
                label="RMSE"
                currentLabel={formatMetricValue(selectedMetrics.rmse, 'rmse')}
                subtext="Lower holdout error is better."
              />
              <ComparisonRow
                label="MAE"
                currentLabel={formatMetricValue(selectedMetrics.mae, 'mae')}
                subtext="Average absolute error on the selected split."
              />
              <ComparisonRow
                label="R² Score"
                currentLabel={formatMetricValue(selectedMetrics.r2, 'r2')}
                subtext="Higher values mean the model explains more variance."
              />
            </>
          ) : (
            <>
              <ComparisonRow
                label={clinicalMode ? 'Decision Balance' : isMulticlass ? 'Macro F1' : 'F1 Score'}
                current={selectedMetrics.f1_score}
                baseline={null}
                currentLabel={undefined}
                subtext={clinicalMode ? clinicalDecisionBalanceGuidance(selectedMetrics.f1_score) : undefined}
              />
              <ComparisonRow
                label={clinicalMode ? 'Successful Reviews' : 'Accuracy'}
                current={selectedMetrics.accuracy}
                baseline={null}
              />
              <ComparisonRow
                label={clinicalMode ? 'Caution Level' : 'Overfit Risk'}
                currentLabel={
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      summary?.overfitting_risk === 'low'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : summary?.overfitting_risk === 'high'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {clinicalMode ? clinicalRiskLabel(summary?.overfitting_risk) : summary?.overfitting_risk ?? 'computing…'}
                  </span>
                }
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Global Feature Panel ─────────────────────────────────────────────────────

const GlobalFeaturePanel: React.FC<{
  globalExplanation: ExplainabilityWorkbench['global_explanation'];
  problemType?: 'classification' | 'multiclass' | 'regression';
}> = ({
  globalExplanation,
  clinicalMode,
  problemType = 'classification',
}: {
  globalExplanation: ExplainabilityWorkbench['global_explanation'];
  clinicalMode?: boolean;
  problemType?: 'classification' | 'multiclass' | 'regression';
}) => (
  <div className={`ha-step6-global-panel rounded-[28px] border p-6 shadow-sm min-w-0 overflow-x-auto min-h-[200px] ${
    clinicalMode ? 'border-emerald-100 bg-[#f7fbf8]' : 'border-emerald-100 bg-[#f7fbf8]'
  }`}>
    <div className="flex items-start gap-3">
      <div className={`rounded-2xl p-3 ${clinicalMode ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
        <BrainCircuit size={24} />
      </div>
      <div>
        <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${clinicalMode ? 'font-mono text-[#5f766b]' : 'font-mono text-[#5f766b]'}`}>
          {clinicalMode ? 'Clinical Factors' : 'Global Explainability'}
        </p>
        <h3 className="ha-step6-panel-title text-lg font-black tracking-tight text-slate-900">
          {clinicalMode
            ? 'Most relevant patient findings'
            : problemType === 'regression'
              ? 'Features with the strongest effect on predictions'
              : problemType === 'multiclass'
                ? 'Features that separate class decisions most'
                : 'Most influential features'}
        </h3>
        <p className={`ha-step6-panel-copy mt-1 text-sm ${clinicalMode ? 'text-slate-600' : 'text-slate-500'}`}>
          {clinicalMode
            ? 'These findings had the strongest influence across similar reviewed patients.'
            : getGlobalExplainabilityCopy(globalExplanation.source, problemType)}
        </p>
      </div>
    </div>

    <div className="mt-6 h-[540px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[...globalExplanation.features]
            .map((feature) => ({
              ...feature,
              displayFeature: clinicalMode ? toClinicalFeatureLabel(feature.feature) : feature.feature,
            }))
            .reverse()}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 20, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={clinicalMode ? '#dbe8e1' : '#dbe8e1'} />
          <XAxis type="number" tickFormatter={(v) => Number(v).toFixed(3)} stroke={clinicalMode ? '#5f766b' : '#5f766b'} tick={{ fontSize: 11 }} />
          <YAxis dataKey="displayFeature" type="category" width={210} stroke={clinicalMode ? '#5f766b' : '#5f766b'} tick={{ fontSize: 12, fontWeight: 600 }} />
          <Tooltip cursor={{ fill: clinicalMode ? 'rgba(0,89,62,0.05)' : 'rgba(0,89,62,0.05)' }} content={<FeatureTooltip clinicalMode={clinicalMode} />} />
          <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
            {globalExplanation.features.map((item, i) => (
              <Cell
                key={item.feature}
                fill={clinicalMode ? (i % 2 === 0 ? '#0d7b61' : '#4f9e86') : (i % 2 === 0 ? '#0d7b61' : '#4f9e86')}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

// ─── Local Explainability / What-If Panel ──────────────────────────────────────

const LocalExplainabilityPanel: React.FC<{
  simulatorMode: string;
  recordOptions: RecordOption[];
  selectedRecordId: string;
  onRecordChange: (recordId: string) => void | Promise<void>;
  scenario: ExplainabilityScenario;
  controlFeatures: ControlFeature[];
  activeValues: Record<string, number>;
  onFeatureChange: (feature: string, value: number) => void;
  isSimulating: boolean;
  clinicalMode?: boolean;
  problemType?: 'classification' | 'multiclass' | 'regression';
}> = ({
  simulatorMode,
  recordOptions,
  selectedRecordId,
  onRecordChange,
  scenario,
  controlFeatures,
  activeValues,
  onFeatureChange,
  isSimulating,
  clinicalMode,
  problemType = 'classification',
}) => {
  const impactLabels = getLocalImpactLabels(problemType);
  const isClinicalRegression = clinicalMode && problemType === 'regression';

  return (
    <div className={`ha-step6-local-panel rounded-[28px] border p-6 shadow-sm ${
      clinicalMode ? 'border-emerald-100 bg-[#f8fbf9]' : 'border-emerald-100 bg-[#f8fbf9]'
    }`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-3 ${clinicalMode ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
          <SlidersHorizontal size={24} />
        </div>
        <div>
          <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${clinicalMode ? 'font-mono text-[#5f766b]' : 'font-mono text-[#5f766b]'}`}>
            {clinicalMode ? isClinicalRegression ? 'Patient Estimate' : 'Patient Review' : 'What-If Simulator'}
          </p>
          <h3 className="ha-step6-panel-title text-lg font-black tracking-tight text-slate-900">
            {clinicalMode
              ? isClinicalRegression ? 'Patient-specific outcome summary' : 'Patient-specific decision summary'
              : problemType === 'regression'
                ? 'Local explanation & live value shift'
                : problemType === 'multiclass'
                  ? 'Local explanation & class support shift'
                  : 'Local explanation & live prediction shift'}
          </h3>
          <p className="ha-step6-panel-copy mt-1 text-sm text-slate-500">
            {clinicalMode
              ? isClinicalRegression
                ? 'Adjust the strongest clinical factors to see how the patient-level estimated value moves.'
                : 'Adjust the three strongest clinical factors to see whether the patient-level estimate moves.'
              : problemType === 'regression'
                ? `Mode: ${simulatorMode}. Slider changes debounce before firing the inference API and update the predicted numeric value.`
                : problemType === 'multiclass'
                  ? `Mode: ${simulatorMode}. Slider changes debounce before firing the inference API and update support for the selected class.`
                  : `Mode: ${simulatorMode}. Slider changes debounce before firing the inference API.`}
          </p>
        </div>
      </div>

      {/* Rich record dropdown */}
      <div className="min-w-[260px] xl:min-w-[320px]">
        <label className="ha-step6-field-label mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          {clinicalMode ? 'Patient' : 'Select a Test Patient'}
        </label>
        <select
          value={selectedRecordId}
          onChange={(e) => void onRecordChange(e.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold text-slate-800 ${
            clinicalMode ? 'border-emerald-100 bg-white' : 'border-emerald-100 bg-white'
          }`}
        >
          {recordOptions.map((record) => (
            <option key={record.record_id} value={record.record_id}>
              {clinicalMode
                ? formatClinicalRecordLabel(record, problemType)
                : problemType === 'regression'
                  ? `#${record.position} · ${record.top_feature_values ? Object.entries(record.top_feature_values).slice(0, 2).map(([key, val]) => `${key}: ${val}`).join(' · ') : 'Regression sample'} · Predicted value: ${formatNumber(record.predicted_value)}`
                  : formatRecordLabel(record)}
            </option>
          ))}
        </select>
        {/* Confidence band badge for selected record */}
        {(() => {
          const sel = recordOptions.find((r) => r.record_id === selectedRecordId);
          if (!sel) return null;
          return (
            <div className="mt-2 flex items-center gap-2">
              <span className={`ha-step6-confidence-pill rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${confidenceBadgeClass(sel.confidence_band)}`}>
                {isClinicalRegression
                  ? `${sel.confidence_band} estimate band`
                  : clinicalMode
                  ? `${sel.confidence_band} review confidence`
                  : problemType === 'regression'
                    ? `${sel.confidence_band} value range`
                    : `${sel.confidence_band} confidence`}
              </span>
              <span className="ha-step6-predicted-copy text-xs text-slate-500">
                {isClinicalRegression
                  ? <>Estimated value: <strong>{formatNumber(sel.predicted_value)}</strong></>
                  : problemType === 'regression'
                  ? <>Predicted value: <strong>{formatNumber(sel.predicted_value)}</strong></>
                  : <>{clinicalMode ? 'Suggested class' : 'Predicted'}: <strong>{clinicalMode ? decodeClinicalClassLabel(sel.predicted_label).full : formatPredictionLabel(sel.predicted_label)}</strong> ({(sel.predicted_probability * 100).toFixed(1)}%)</>}
              </span>
            </div>
          );
        })()}
      </div>
    </div>

    {/* Prediction summary metrics */}
    {isClinicalRegression ? (
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] font-mono text-slate-500">Estimated Value</p>
              <p className="mt-1 text-5xl font-black tracking-tight text-emerald-700">
                {formatNumber(scenario.prediction.predicted_value)}
              </p>
            </div>
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] font-mono text-emerald-700">Estimate Shift</p>
              <p className={`text-2xl font-black ${scenario.prediction.delta_from_baseline >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatSignedNumber(scenario.prediction.delta_from_baseline)}
              </p>
            </div>
          </div>
        </div>
        <SummaryMetric
          label="Baseline Value"
          value={formatNumber(scenario.prediction.baseline_value)}
          tone="text-sky-700"
          subtext={scenario.prediction.delta_from_baseline >= 0 ? 'Current estimate is above baseline.' : 'Current estimate is below baseline.'}
        />
      </div>
    ) : clinicalMode ? (
      <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] font-mono text-slate-500">Suggested Class</p>
            <p className={`mt-1 text-5xl font-black tracking-tight ${
              scenario.prediction.target_class_index === 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {decodeClinicalClassLabel(scenario.prediction.target_class_label, scenario.prediction.target_class_index).short}
              <span className="ml-2 text-base font-semibold text-slate-600">
                ({decodeClinicalClassLabel(scenario.prediction.target_class_label, scenario.prediction.target_class_index).full})
              </span>
            </p>
          </div>
          <div className="ha-step6-review-confidence rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
            <p className="ha-step6-review-confidence-label text-[10px] font-black uppercase tracking-[0.14em] font-mono text-emerald-700">Review Confidence</p>
            <p className="ha-step6-review-confidence-value text-2xl font-black text-emerald-700">{formatPercent(scenario.prediction.target_probability)}</p>
          </div>
        </div>
      </div>
    ) : problemType === 'regression' ? (
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryMetric
          label="Predicted Value"
          value={formatNumber(scenario.prediction.predicted_value)}
          tone="text-slate-900"
        />
        <SummaryMetric
          label="Baseline Estimate"
          value={formatNumber(scenario.prediction.baseline_value)}
          tone="text-sky-700"
        />
        <SummaryMetric
          label="Delta From Baseline"
          value={formatSignedNumber(scenario.prediction.delta_from_baseline)}
          tone={scenario.prediction.delta_from_baseline >= 0 ? 'text-rose-700' : 'text-emerald-700'}
          subtext={scenario.prediction.delta_from_baseline >= 0 ? 'Prediction moved upward' : 'Prediction moved downward'}
        />
      </div>
    ) : (
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryMetric
          label={clinicalMode ? 'Predicted Condition' : 'Predicted Class'}
          value={
            clinicalMode
              ? `${decodeClinicalClassLabel(scenario.prediction.target_class_label, scenario.prediction.target_class_index).short} (${decodeClinicalClassLabel(scenario.prediction.target_class_label, scenario.prediction.target_class_index).full})`
              : formatPredictionLabel(scenario.prediction.target_class_label)
          }
          tone={problemType === 'multiclass' ? 'text-sky-700' : scenario.prediction.target_class_index === 0 ? 'text-emerald-700' : 'text-rose-700'}
        />
        <SummaryMetric
          label={clinicalMode ? 'Confidence' : problemType === 'multiclass' ? 'Prediction Confidence' : 'Risk Probability'}
          value={formatPercent(scenario.prediction.target_probability)}
          tone={problemType === 'multiclass'
            ? (scenario.prediction.target_probability ?? 0) >= 0.65 ? 'text-sky-700' : (scenario.prediction.target_probability ?? 0) >= 0.4 ? 'text-amber-700' : 'text-slate-700'
            : (scenario.prediction.target_probability ?? 0) >= 0.65 ? 'text-rose-700' : (scenario.prediction.target_probability ?? 0) >= 0.4 ? 'text-amber-700' : 'text-emerald-700'}
        />
        <SummaryMetric
          label={clinicalMode ? 'Change From Baseline' : 'Delta From Baseline'}
          value={`${scenario.prediction.delta_from_baseline >= 0 ? '+' : ''}${formatPercent(scenario.prediction.delta_from_baseline)}`}
          tone={problemType === 'multiclass'
            ? scenario.prediction.delta_from_baseline >= 0 ? 'text-sky-700' : 'text-amber-700'
            : scenario.prediction.delta_from_baseline >= 0 ? 'text-rose-700' : 'text-emerald-700'}
          subtext={clinicalMode ? scenario.prediction.delta_from_baseline >= 0 ? 'Clinical concern increased' : 'Clinical concern decreased' : problemType === 'multiclass' ? scenario.prediction.delta_from_baseline >= 0 ? 'Support for this class increased' : 'Support for this class decreased' : scenario.prediction.delta_from_baseline >= 0 ? 'Risk increased' : 'Risk decreased'}
        />
      </div>
    )}

    {/* Waterfall / Tornado chart */}
    <div className="relative mt-6">
      {isSimulating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
            <Loader2 size={14} className="animate-spin" />
            {clinicalMode ? isClinicalRegression ? 'Updating estimate...' : 'Updating review...' : 'Updating prediction...'}
          </div>
        </div>
      )}
      <div className="mb-3 flex items-center gap-3">
        <h4 className="ha-step6-impact-title text-sm font-black text-slate-800">{clinicalMode ? isClinicalRegression ? impactLabels.title : 'Patient-specific drivers' : impactLabels.title}</h4>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> {clinicalMode ? isClinicalRegression ? impactLabels.increase : 'Raises concern' : impactLabels.increase}</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {clinicalMode ? isClinicalRegression ? impactLabels.decrease : 'Lowers concern' : impactLabels.decrease}</span>
        </div>
      </div>
      <div className={`ha-step6-impact-chart h-[300px] rounded-2xl border p-3 ${clinicalMode ? 'border-emerald-100 bg-[#f3f8f5]' : 'border-emerald-100 bg-[#f3f8f5]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...getDisplayedImpactFeatures(scenario, controlFeatures, clinicalMode)]
              .map((item) => ({
                ...item,
                displayFeature: clinicalMode ? toClinicalFeatureLabel(item.feature) : item.feature,
              }))
              .reverse()}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={clinicalMode ? '#dbe8e1' : '#dbe8e1'} />
            <XAxis type="number" stroke={clinicalMode ? '#5f766b' : '#5f766b'} tick={{ fontSize: 11 }} />
            <YAxis dataKey="displayFeature" type="category" width={190} stroke={clinicalMode ? '#5f766b' : '#5f766b'} tick={{ fontSize: 12, fontWeight: 600 }} />
            <ReferenceLine x={0} stroke={clinicalMode ? '#7f948a' : '#94a3b8'} strokeWidth={1.5} label={{ value: clinicalMode ? 'typical patient' : 'baseline', position: 'insideTopLeft', fontSize: 10, fill: clinicalMode ? '#7f948a' : '#94a3b8' }} />
            <Tooltip content={<ImpactTooltip clinicalMode={clinicalMode} problemType={problemType} />} />
            <Bar dataKey="impact" radius={[0, 6, 6, 0]}>
              {[...getDisplayedImpactFeatures(scenario, controlFeatures, clinicalMode)].reverse().map((item) => (
                <Cell
                  key={item.feature}
                  fill={item.direction === 'increase' ? (clinicalMode ? '#b65c58' : '#b65c58') : (clinicalMode ? '#0f7a64' : '#0f7a64')}
                  opacity={0.88}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Interactive sliders */}
    {controlFeatures.length > 0 && (
      <div className="mt-6 space-y-3">
        <h4 className="text-sm font-black text-slate-800">{clinicalMode ? 'Scenario Review' : 'Adjust Feature Values'}</h4>
        <div className={`space-y-3 ${clinicalMode ? '' : 'max-h-[520px] overflow-y-auto pr-2'}`}>
        {controlFeatures.map((control, idx) => {
          const value = activeValues[control.feature] ?? control.default_value;
          const impact = scenario.local_explanation.top_features.find((f) => f.feature === control.feature);
          // Use the explicit `direction` field: 'increase' → red (risk up), 'decrease' → green (risk down)
          const isRisky = impact ? impact.direction === 'increase' : false;
          // Slider fill percentage
          const pct = control.max > control.min
            ? Math.min(100, Math.max(0, ((value - control.min) / (control.max - control.min)) * 100))
            : 0;
          return (
            <div key={control.feature} className={`rounded-2xl border p-4 ${
              clinicalMode ? 'border-emerald-100 bg-white' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="ha-step6-slider-index flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-black text-indigo-700">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{clinicalMode ? toClinicalFeatureLabel(control.feature) : control.feature}</p>
                    <p className="text-xs text-slate-500">{clinicalMode ? 'Observed range' : 'Range'} {control.min} to {control.max}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {impact && (
                    <span className={`ha-step6-slider-delta flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isRisky ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isRisky ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {clinicalMode ? isClinicalRegression ? formatImpactValue(impact.impact, problemType) : (isRisky ? 'Raises concern' : 'Lowers concern') : formatImpactValue(impact.impact, problemType)}
                    </span>
                  )}
                  <input
                    type="number"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value}
                    onChange={(e) => onFeatureChange(control.feature, Number(e.target.value))}
                    className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>
              {/* Styled range slider */}
              <div className="relative mt-4">
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  onChange={(e) => onFeatureChange(control.feature, Number(e.target.value))}
                  className="ha-range-slider h-2 w-full cursor-pointer appearance-none rounded-full outline-none"
                  style={{
                    ['--ha-slider-fill-color' as any]: isRisky ? '#dc2626' : '#059669',
                    ['--ha-slider-fill-percent' as any]: `${pct}%`,
                  }}
                />
                {/* Current value badge */}
                <div
                  className="pointer-events-none absolute -top-7 flex -translate-x-1/2 items-center rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
                  style={{ left: `clamp(16px, ${pct}%, calc(100% - 16px))` }}
                >
                  {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    )}
  </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryMetric: React.FC<{
  label: string;
  value: string;
  tone?: string;
  subtext?: string;
}> = ({ label, value, tone = 'text-slate-900', subtext }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    {subtext && <p className="mt-1 text-[11px] font-semibold text-slate-400">{subtext}</p>}
  </div>
);

const ComparisonRow: React.FC<{
  label: string;
  current?: number | null;
  baseline?: number | null;
  currentLabel?: React.ReactNode;
  subtext?: string;
}> = ({ label, current, baseline, currentLabel, subtext }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-900">
        {currentLabel ?? `${formatPercent(current)}${baseline != null ? ` vs ${formatPercent(baseline)}` : ''}`}
      </span>
    </div>
    {subtext && <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">{subtext}</p>}
  </div>
);

const FeatureTooltip: React.FC<any> = ({ active, payload, clinicalMode }) => {
  if (!active || !payload?.length) return null;
  const feature: GlobalFeature = payload[0].payload;
  const maxCount = Math.max(...feature.histogram.map((b) => b.count), 1);
  return (
    <div className="w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="text-sm font-bold text-slate-900">{clinicalMode ? toClinicalFeatureLabel(feature.feature) : feature.feature}</p>
      <p className="mt-1 text-xs text-slate-500">
        {clinicalMode ? 'Relative influence' : 'Importance'}: {feature.importance.toFixed(4)}
      </p>
      <div className="mt-3 flex h-16 items-end gap-1">
        {feature.histogram.map((bin) => (
          <div
            key={`${bin.start}-${bin.end}`}
            className={`flex-1 rounded-t ${clinicalMode ? 'bg-emerald-600/75' : 'bg-indigo-500/80'}`}
            style={{ height: `${Math.max((bin.count / maxCount) * 100, 8)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
        <span>{clinicalMode ? 'Low' : 'Min'} {feature.summary.min}</span>
        <span>{clinicalMode ? 'High' : 'Max'} {feature.summary.max}</span>
        <span>{clinicalMode ? 'Average' : 'Mean'} {feature.summary.mean}</span>
        <span>{clinicalMode ? 'Middle' : 'Median'} {feature.summary.median}</span>
      </div>
    </div>
  );
};

const ImpactTooltip: React.FC<any> = ({ active, payload, clinicalMode, problemType = 'classification' }) => {
  if (!active || !payload?.length) return null;
  const feat: ScenarioFeature = payload[0].payload;
  // Use the explicit direction field — not the sign of impact — for semantic color coding
  const increasesRisk = feat.direction === 'increase';
  const impactLabels = getLocalImpactLabels(problemType);
  const isClinicalRegression = clinicalMode && problemType === 'regression';
  return (
    <div className={`w-56 rounded-2xl border p-4 shadow-xl ${
      increasesRisk
        ? 'border-rose-200 bg-rose-50'
        : 'border-emerald-200 bg-emerald-50'
    }`}>
      <p className="text-sm font-bold text-slate-900">{clinicalMode ? toClinicalFeatureLabel(feat.feature) : feat.feature}</p>
      <p className="mt-1 text-xs text-slate-500">{clinicalMode ? 'Patient value' : 'Current value'}: <strong>{feat.value}</strong></p>
      <div className={`mt-2 flex items-center gap-1 text-sm font-black ${
        increasesRisk ? 'text-rose-700' : 'text-emerald-700'
      }`}>
        {increasesRisk ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {clinicalMode
          ? isClinicalRegression ? formatImpactValue(feat.impact, problemType) : (increasesRisk ? 'Raises concern' : 'Lowers concern')
          : formatImpactValue(feat.impact, problemType)}
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${
        increasesRisk ? 'text-rose-500' : 'text-emerald-500'
      }`}>
        {clinicalMode
          ? isClinicalRegression ? (increasesRisk ? impactLabels.positiveTone : impactLabels.negativeTone) : (increasesRisk ? 'Moves estimate upward' : 'Moves estimate downward')
          : increasesRisk
            ? `▲ ${impactLabels.positiveTone}`
            : `▼ ${impactLabels.negativeTone}`}
      </p>
    </div>
  );
};

export default Step6Explainability;




