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
import { MODEL_CATALOG } from '../../modelTuning/modelCatalog';
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
    target_class_index: number;
    target_class_label: string;
    target_probability: number;
    baseline_probability: number;
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
    class_count: number;
    cv_score: number;
    train_test_gap: number;
    stability_score: number;
    overfitting_risk: string;
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

function buildRunLabels(resultsMap: Record<string, ModelResult>, tasks: Record<string, { createdAt?: string }>) {
  const ordered = Object.values(resultsMap).sort((l, r) =>
    new Date(tasks[l.taskId]?.createdAt ?? 0).getTime() - new Date(tasks[r.taskId]?.createdAt ?? 0).getTime()
  );
  const counters: Partial<Record<ModelResult['model'], number>> = {};
  return ordered.reduce<Record<string, string>>((acc, run) => {
    const n = (counters[run.model] ?? 0) + 1;
    counters[run.model] = n;
    acc[run.taskId] = buildRunLabel(run.model, run.parameters, n);
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
  const resultsMap = useModelStore((state) => state.results);
  const tasks = useModelStore((state) => state.tasks);
  const bestResultTaskId = useModelStore((state) => state.bestResultTaskId);

  const runs = useMemo(() => Object.values(resultsMap), [resultsMap]);
  const runLabels = useMemo(() => buildRunLabels(resultsMap, tasks), [resultsMap, tasks]);
  const sortedRuns = useMemo(() => {
    return [...runs].sort((l, r) => {
      const lm = l.test_metrics ?? l.metrics;
      const rm = r.test_metrics ?? r.metrics;
      const d = (rm.f1_score ?? 0) - (lm.f1_score ?? 0);
      return d !== 0 ? d : (rm.accuracy ?? 0) - (lm.accuracy ?? 0);
    });
  }, [runs]);

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

  return (
    <div className="space-y-6 px-4 py-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">

        {/* ── Page header ── */}
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_40%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-8 py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 6</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Model Explainability</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                Inspect why the champion model won, which features drive the global pattern, and how a single record shifts when you change its values.
              </p>
            </div>

            {/* Active run selector with 👑 badge */}
            <div className="min-w-[300px]">
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Active Run</label>
              <select
                value={selectedTaskId ?? champion.taskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm"
              >
                {sortedRuns.map((run) => {
                  const isChamp = run.taskId === champion.taskId;
                  const label = runLabels[run.taskId] ?? MODEL_CATALOG[run.model].name;
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
                <strong>Note:</strong> This model has a higher overfitting risk. The{' '}
                <button
                  className="font-black underline underline-offset-2 hover:text-amber-700"
                  onClick={() => setSelectedTaskId(champion.taskId)}
                >
                  Champion model
                </button>{' '}
                is recommended for final decisions.
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
              <GlobalFeaturePanel globalExplanation={workbench.global_explanation} />
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
              />
            </div>
          )}

          {/* ── Step 6 → Step 7 Transition CTA ── */}
          {!isLoading && workbench && scenario && (
            <div className="overflow-hidden rounded-[32px] border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 shadow-sm">
              <div className="flex flex-col items-center gap-6 px-8 py-8 text-center sm:flex-row sm:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg">
                  <ShieldCheck size={26} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600">Explainability Complete</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                    Ready for the Ethics &amp; Bias audit?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Step 7 runs a full EU AI Act compliance check, subgroup fairness analysis, and generates a downloadable audit certificate.
                  </p>
                </div>
                <button
                  id="proceed-to-ethics-btn"
                  onClick={completeStep6}
                  className="flex shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 text-sm font-black text-white shadow-lg transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                >
                  Complete Explainability &amp; Proceed to Ethics &amp; Bias
                  <ArrowRight size={18} />
                </button>
              </div>
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
}> = ({ champion, selectedRun, runLabels, summary, runnerUp }) => {
  const championLabel = runLabels[champion.taskId] ?? MODEL_CATALOG[champion.model].name;
  const selectedLabel = runLabels[selectedRun.taskId] ?? MODEL_CATALOG[selectedRun.model].name;
  const selectedMetrics = selectedRun.test_metrics ?? selectedRun.metrics;
  const runnerUpMetrics = runnerUp ? runnerUp.test_metrics ?? runnerUp.metrics : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
      {/* Left: champion identity + rationale */}
      <div className="rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <ShieldCheck size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Champion Model · Justification</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{championLabel}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {summary?.selection_rationale
                ? summary.selection_rationale
                : `${championLabel} was selected based on the lowest overfitting risk — the smallest gap detected between training and test performance across all trained runs.`}
            </p>
          </div>
        </div>

        {/* Metric pills */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryMetric
            label="CV Score"
            value={summary ? formatPercent(summary.cv_score) : '…'}
            subtext="Cross-validation"
            tone="text-slate-900"
          />
          <SummaryMetric
            label="Train-Test Gap ↓"
            value={summary ? formatPercent(summary.train_test_gap) : '…'}
            subtext="Lower is better"
            tone={summary && summary.train_test_gap <= 0.05 ? 'text-emerald-700' : summary && summary.train_test_gap >= 0.15 ? 'text-rose-700' : 'text-amber-700'}
          />
          <SummaryMetric
            label="Stability"
            value={summary ? formatPercent(summary.stability_score) : '…'}
            subtext="Generalisation score"
            tone={summary && summary.stability_score >= 0.8 ? 'text-emerald-700' : 'text-amber-700'}
          />
        </div>
      </div>

      {/* Right: current view metrics */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">Current View</p>
            <h3 className="text-lg font-black tracking-tight text-slate-900">{selectedLabel}</h3>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <ComparisonRow label="F1 Score" current={selectedMetrics.f1_score} baseline={runnerUpMetrics?.f1_score} />
          <ComparisonRow label="Accuracy" current={selectedMetrics.accuracy} baseline={runnerUpMetrics?.accuracy} />
          <ComparisonRow
            label="Overfit Risk"
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
                {summary?.overfitting_risk ?? 'computing…'}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
};

// ─── Global Feature Panel ─────────────────────────────────────────────────────

const GlobalFeaturePanel: React.FC<{ globalExplanation: ExplainabilityWorkbench['global_explanation'] }> = ({
  globalExplanation,
}) => (
  <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
        <BrainCircuit size={24} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">Global Explainability</p>
        <h3 className="text-lg font-black tracking-tight text-slate-900">Most influential features</h3>
        <p className="mt-1 text-sm text-slate-500">
          Source: {globalExplanation.source}. Hover any bar to see feature distribution details.
        </p>
      </div>
    </div>

    <div className="mt-6 h-[540px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[...globalExplanation.features].reverse()}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 20, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v) => Number(v).toFixed(3)} stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis dataKey="feature" type="category" width={160} stroke="#64748b" tick={{ fontSize: 12, fontWeight: 600 }} />
          <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={<FeatureTooltip />} />
          <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
            {globalExplanation.features.map((item, i) => (
              <Cell
                key={item.feature}
                fill={`hsl(${226 + i * 4}, 84%, ${58 - i * 2}%)`}
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
}) => (
  <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
          <SlidersHorizontal size={24} />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">What-If Simulator</p>
          <h3 className="text-lg font-black tracking-tight text-slate-900">Local explanation &amp; live prediction shift</h3>
          <p className="mt-1 text-sm text-slate-500">
            Mode: {simulatorMode}. Slider changes debounce before firing the inference API.
          </p>
        </div>
      </div>

      {/* Rich record dropdown */}
      <div className="min-w-[260px] xl:min-w-[320px]">
        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          Select a Test Patient
        </label>
        <select
          value={selectedRecordId}
          onChange={(e) => void onRecordChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
        >
          {recordOptions.map((record) => (
            <option key={record.record_id} value={record.record_id}>
              {formatRecordLabel(record)}
            </option>
          ))}
        </select>
        {/* Confidence band badge for selected record */}
        {(() => {
          const sel = recordOptions.find((r) => r.record_id === selectedRecordId);
          if (!sel) return null;
          return (
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${confidenceBadgeClass(sel.confidence_band)}`}>
                {sel.confidence_band} confidence
              </span>
              <span className="text-xs text-slate-500">
                Predicted: <strong>{sel.predicted_label}</strong> ({(sel.predicted_probability * 100).toFixed(1)}%)
              </span>
            </div>
          );
        })()}
      </div>
    </div>

    {/* Prediction summary metrics */}
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <SummaryMetric
        label="Predicted Class"
        value={scenario.prediction.target_class_label}
        tone={scenario.prediction.target_class_index === 0 ? 'text-emerald-700' : 'text-rose-700'}
      />
      <SummaryMetric
        label="Risk Probability"
        value={formatPercent(scenario.prediction.target_probability)}
        tone={scenario.prediction.target_probability >= 0.65 ? 'text-rose-700' : scenario.prediction.target_probability >= 0.4 ? 'text-amber-700' : 'text-emerald-700'}
      />
      <SummaryMetric
        label="Delta From Baseline"
        value={`${scenario.prediction.delta_from_baseline >= 0 ? '+' : ''}${formatPercent(scenario.prediction.delta_from_baseline)}`}
        tone={scenario.prediction.delta_from_baseline >= 0 ? 'text-rose-700' : 'text-emerald-700'}
        subtext={scenario.prediction.delta_from_baseline >= 0 ? '↑ Risk increased' : '↓ Risk decreased'}
      />
    </div>

    {/* Waterfall / Tornado chart */}
    <div className="relative mt-6">
      {isSimulating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
            <Loader2 size={14} className="animate-spin" />
            Updating prediction…
          </div>
        </div>
      )}
      <div className="mb-3 flex items-center gap-3">
        <h4 className="text-sm font-black text-slate-800">Feature Impacts</h4>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Increases risk</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Decreases risk</span>
        </div>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...scenario.local_explanation.top_features].reverse()}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis dataKey="feature" type="category" width={150} stroke="#64748b" tick={{ fontSize: 12, fontWeight: 600 }} />
            <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} label={{ value: 'baseline', position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip content={<ImpactTooltip />} />
            <Bar dataKey="impact" radius={[0, 6, 6, 0]}>
              {scenario.local_explanation.top_features.map((item) => (
                <Cell
                  key={item.feature}
                  fill={item.impact >= 0 ? '#dc2626' : '#059669'}
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
        <h4 className="text-sm font-black text-slate-800">Adjust Feature Values</h4>
        {controlFeatures.map((control, idx) => {
          const value = activeValues[control.feature] ?? control.default_value;
          const impact = scenario.local_explanation.top_features.find((f) => f.feature === control.feature);
          const isRisky = impact ? impact.impact >= 0 : false;
          // Slider fill percentage
          const pct = control.max > control.min
            ? ((value - control.min) / (control.max - control.min)) * 100
            : 0;
          return (
            <div key={control.feature} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-black text-indigo-700">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{control.feature}</p>
                    <p className="text-xs text-slate-500">Range {control.min} – {control.max}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {impact && (
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isRisky ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isRisky ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {isRisky ? '+' : ''}{(impact.impact * 100).toFixed(2)}%
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
                  className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none"
                  style={{
                    background: `linear-gradient(to right, ${isRisky ? '#dc2626' : '#059669'} ${pct}%, #e2e8f0 ${pct}%)`,
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
    )}
  </div>
);

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
}> = ({ label, current, baseline, currentLabel }) => (
  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <span className="text-sm font-semibold text-slate-600">{label}</span>
    <span className="text-sm font-black text-slate-900">
      {currentLabel ?? `${formatPercent(current)}${baseline != null ? ` vs ${formatPercent(baseline)}` : ''}`}
    </span>
  </div>
);

const FeatureTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const feature: GlobalFeature = payload[0].payload;
  const maxCount = Math.max(...feature.histogram.map((b) => b.count), 1);
  return (
    <div className="w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="text-sm font-bold text-slate-900">{feature.feature}</p>
      <p className="mt-1 text-xs text-slate-500">Importance: {feature.importance.toFixed(4)}</p>
      <div className="mt-3 flex h-16 items-end gap-1">
        {feature.histogram.map((bin) => (
          <div
            key={`${bin.start}-${bin.end}`}
            className="flex-1 rounded-t bg-indigo-500/80"
            style={{ height: `${Math.max((bin.count / maxCount) * 100, 8)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
        <span>Min {feature.summary.min}</span>
        <span>Max {feature.summary.max}</span>
        <span>Mean {feature.summary.mean}</span>
        <span>Median {feature.summary.median}</span>
      </div>
    </div>
  );
};

const ImpactTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const feat: ScenarioFeature = payload[0].payload;
  const isPositive = feat.impact >= 0;
  return (
    <div className="w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <p className="text-sm font-bold text-slate-900">{feat.feature}</p>
      <p className="mt-1 text-xs text-slate-500">Current value: <strong>{feat.value}</strong></p>
      <div className={`mt-2 flex items-center gap-1 text-sm font-black ${isPositive ? 'text-rose-700' : 'text-emerald-700'}`}>
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {isPositive ? '+' : ''}{feat.impact.toFixed(4)} impact
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${isPositive ? 'text-rose-500' : 'text-emerald-500'}`}>
        {isPositive ? '▲ Increases risk' : '▼ Decreases risk'}
      </p>
    </div>
  );
};

export default Step6Explainability;
