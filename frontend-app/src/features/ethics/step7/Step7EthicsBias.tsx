import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Download,
  FileText,
  Loader2,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { useDomainStore } from '../../../store/useDomainStore';
import { useModelStore } from '../../../store/useModelStore';
import { MODEL_CATALOG } from '../../modelTuning/modelCatalog';
import { checkFairness, downloadCertificatePdf } from '../../../services/pipelineApi';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubgroupMetric {
  group: string;
  n: number;
  accuracy: number | null;
  sensitivity: number | null;
  specificity: number | null;
}

interface FairnessResult {
  subgroup_metrics: SubgroupMetric[];
  warnings: string[];
  bias_detected: boolean;
  bias_threshold: number;
}

interface ChecklistItem {
  id: string;
  label: string;
  autoChecked: boolean; // driven by pipeline state
  manuallyChecked?: boolean;
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function isDegraded(value: number | null, best: number, threshold: number): boolean {
  if (value == null || best == null) return false;
  return (best - value) > threshold;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
);

// ─── Sub-components ───────────────────────────────────────────────────────────

const BiasStatusBanner: React.FC<{ fairness: FairnessResult }> = ({ fairness }) => {
  if (fairness.bias_detected) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-rose-300 bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 shadow-sm">
        <div className="flex items-start gap-5 px-8 py-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 shadow-lg">
            <ShieldAlert size={28} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600">Fairness Status</p>
              <span className="rounded-full border border-rose-300 bg-rose-100 px-3 py-0.5 text-xs font-black text-rose-700">
                ⚠ BIAS DETECTED
              </span>
            </div>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900">
              Significant bias found in subgroup performance
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Sensitivity gap exceeds the {pct(fairness.bias_threshold)} clinical threshold between subgroups.
              Human review and bias mitigation are required before deployment.
            </p>
            {fairness.warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {fairness.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-rose-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 shadow-sm">
      <div className="flex items-start gap-5 px-8 py-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg">
          <ShieldCheck size={28} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Fairness Status</p>
            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-700">
              ✓ FAIRNESS OK
            </span>
          </div>
          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900">
            No significant bias detected across demographic subgroups
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            All subgroup sensitivity gaps are within the {pct(fairness.bias_threshold)} clinical threshold.
            The model meets baseline fairness requirements for deployment consideration.
          </p>
        </div>
      </div>
    </div>
  );
};


const SubgroupTable: React.FC<{ metrics: SubgroupMetric[]; threshold: number }> = ({
  metrics,
  threshold,
}) => {
  if (metrics.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500">
        <AlertCircle size={16} className="shrink-0" />
        No demographic subgroup data available for this dataset. Run explainability (Step 6) first to enable this analysis.
      </div>
    );
  }

  const bestSens = Math.max(...metrics.map((m) => m.sensitivity ?? 0));
  const bestAcc = Math.max(...metrics.map((m) => m.accuracy ?? 0));
  const bestSpec = Math.max(...metrics.map((m) => m.specificity ?? 0));

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-900">
            <th className="px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-[0.15em] text-slate-300">
              Subgroup
            </th>
            <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-300">N</th>
            <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-300">Accuracy</th>
            <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-300">
              Sensitivity
              <span className="ml-1 text-rose-400">★</span>
            </th>
            <th className="px-4 py-3.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-300">Specificity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {metrics.map((m, i) => {
            const sensDegraded = isDegraded(m.sensitivity, bestSens, threshold);
            const accDegraded = isDegraded(m.accuracy, bestAcc, threshold);
            const specDegraded = isDegraded(m.specificity, bestSpec, threshold);
            return (
              <tr key={i} className="transition-colors hover:bg-slate-50">
                <td className="px-5 py-3.5 font-semibold text-slate-900">{m.group}</td>
                <td className="px-4 py-3.5 text-center text-slate-500">{m.n}</td>
                {/* Accuracy */}
                <td className={`px-4 py-3.5 text-center font-bold ${accDegraded ? 'text-amber-700 bg-amber-50' : 'text-slate-800'}`}>
                  {pct(m.accuracy)}
                </td>
                {/* Sensitivity — primary clinical metric */}
                <td className={`px-4 py-3.5 text-center font-black ${sensDegraded ? 'bg-rose-50 text-rose-700' : 'text-emerald-700'}`}>
                  {pct(m.sensitivity)}
                  {sensDegraded && <span className="ml-1 text-[10px]">▼</span>}
                </td>
                {/* Specificity */}
                <td className={`px-4 py-3.5 text-center font-bold ${specDegraded ? 'text-amber-700 bg-amber-50' : 'text-slate-800'}`}>
                  {pct(m.specificity)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] text-slate-500">
        <span className="text-rose-500">★</span> Sensitivity (true positive rate) is the primary fairness metric in clinical contexts.
        Cells highlighted red deviate by more than {pct(threshold)} from the best-performing group.
      </div>
    </div>
  );
};


const ComplianceChecklist: React.FC<{
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}> = ({ items, onToggle }) => (
  <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-start gap-3 mb-6">
      <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
        <Scale size={24} />
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">Regulatory Compliance</p>
        <h3 className="text-lg font-black tracking-tight text-slate-900">EU AI Act Checklist</h3>
        <p className="mt-1 text-sm text-slate-500">
          Auto-checked items are derived from completed pipeline steps. Manual items require human review.
        </p>
      </div>
    </div>
    <div className="space-y-2">
      {items.map((item) => {
        const checked = item.autoChecked || (item.manuallyChecked ?? false);
        return (
          <button
            key={item.id}
            onClick={() => !item.autoChecked && onToggle(item.id)}
            disabled={item.autoChecked}
            className={`w-full flex items-start gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all ${
              checked
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
            } ${item.autoChecked ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <div className="shrink-0 mt-0.5">
              {checked ? (
                <CheckSquare size={18} className="text-emerald-600" />
              ) : (
                <Square size={18} className="text-slate-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-bold ${checked ? 'text-emerald-900' : 'text-slate-700'}`}>
                {item.label}
                {item.autoChecked && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 uppercase tracking-wide">
                    Auto
                  </span>
                )}
              </span>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
            </div>
          </button>
        );
      })}
    </div>
    <div className="mt-4 text-center text-xs text-slate-400">
      {items.filter((i) => i.autoChecked || i.manuallyChecked).length} of {items.length} items completed
    </div>
  </div>
);


const DownloadButton: React.FC<{
  onClick: () => void;
  isDownloading: boolean;
  size?: 'sm' | 'lg';
}> = ({ onClick, isDownloading, size = 'lg' }) => (
  <button
    id={`download-audit-report-btn-${size}`}
    onClick={onClick}
    disabled={isDownloading}
    className={`flex items-center gap-3 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
      size === 'lg' ? 'px-6 py-4 text-sm font-black' : 'px-4 py-2.5 text-xs font-bold'
    }`}
  >
    {isDownloading ? (
      <Loader2 size={size === 'lg' ? 18 : 14} className="animate-spin" />
    ) : (
      <Download size={size === 'lg' ? 18 : 14} />
    )}
    {isDownloading ? 'Generating PDF…' : 'Download Audit Report (.pdf)'}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const Step7EthicsBias: React.FC = () => {
  const sessionId = useDomainStore((s) => s.sessionId);
  const step5Completed = useDomainStore((s) => s.step5Completed);
  const step6Completed = useDomainStore((s) => s.step6Completed);
  const resultsMap = useModelStore((s) => s.results);
  const bestResultTaskId = useModelStore((s) => s.bestResultTaskId);
  const tasks = useModelStore((s) => s.tasks);

  // Determine champion run
  const runs = Object.values(resultsMap);
  const champion = bestResultTaskId
    ? runs.find((r) => r.taskId === bestResultTaskId) ?? runs[0]
    : runs[0];
  const championName = champion
    ? MODEL_CATALOG[champion.model]?.name ?? champion.model
    : 'Champion Model';

  // Fairness data
  const [fairness, setFairness] = useState<FairnessResult | null>(null);
  const [isLoadingFairness, setIsLoadingFairness] = useState(false);
  const [fairnessError, setFairnessError] = useState<string | null>(null);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Manual checklist toggles
  const [manualChecked, setManualChecked] = useState<Record<string, boolean>>({});

  // EU AI Act checklist definition
  const checklistItems: ChecklistItem[] = [
    {
      id: 'data_documented',
      label: 'Training data documented',
      autoChecked: true,
      description: 'Dataset uploaded and column mapping completed in Step 2.',
    },
    {
      id: 'perf_metrics',
      label: 'Performance metrics available',
      autoChecked: step5Completed,
      description: 'Accuracy, sensitivity, specificity and AUC computed in Step 5.',
    },
    {
      id: 'explainable',
      label: 'Model is explainable (SHAP/LIME)',
      autoChecked: step6Completed,
      description: 'Global and local SHAP explanations generated in Step 6.',
    },
    {
      id: 'bias_audit',
      label: 'Bias audit completed',
      autoChecked: fairness !== null,
      description: 'Subgroup fairness analysis completed in Step 7 (this step).',
    },
    {
      id: 'human_oversight',
      label: 'Human oversight plan approved',
      autoChecked: false,
      manuallyChecked: manualChecked['human_oversight'],
      description: 'A qualified clinician has reviewed model outputs and approved the oversight protocol.',
    },
    {
      id: 'risk_class',
      label: 'Risk classification assigned (EU AI Act Art. 6)',
      autoChecked: false,
      manuallyChecked: manualChecked['risk_class'],
      description: 'The system has been classified under the EU AI Act risk tiers (High / Limited / Minimal).',
    },
    {
      id: 'incident_reporting',
      label: 'Incident reporting plan in place',
      autoChecked: false,
      manuallyChecked: manualChecked['incident_reporting'],
      description: 'A documented procedure exists for reporting serious incidents involving this model.',
    },
    {
      id: 'post_deployment',
      label: 'Post-deployment monitoring defined',
      autoChecked: false,
      manuallyChecked: manualChecked['post_deployment'],
      description: 'A monitoring plan covering model drift, fairness drift, and performance degradation has been defined.',
    },
    {
      id: 'data_anonymised',
      label: 'Patient data anonymised / pseudonymised',
      autoChecked: false,
      manuallyChecked: manualChecked['data_anonymised'],
      description: 'All training and test data has been de-identified in accordance with GDPR Article 4(5).',
    },
  ];

  // Load fairness data on mount / when champion run changes
  useEffect(() => {
    if (!champion?.runId) return;
    let disposed = false;
    setIsLoadingFairness(true);
    setFairnessError(null);
    checkFairness({ session_id: sessionId, run_id: champion.runId })
      .then((data: FairnessResult) => {
        if (!disposed) setFairness(data);
      })
      .catch((err: any) => {
        if (!disposed)
          setFairnessError(err?.response?.data?.detail ?? err?.message ?? 'Fairness analysis could not be loaded.');
      })
      .finally(() => {
        if (!disposed) setIsLoadingFairness(false);
      });
    return () => { disposed = true; };
  }, [champion?.runId, sessionId]);

  const handleDownload = async () => {
    if (!champion?.runId) return;
    setIsDownloading(true);
    setDownloadError(null);

    // Resolve the best metrics (test_metrics preferred, then metrics)
    const metrics = champion.test_metrics ?? champion.metrics ?? {};
    const trainMetrics = champion.train_metrics ?? {};

    // Build checklist payload from current UI state
    const checklistPayload = checklistItems.map((item) => ({
      label: item.label,
      done: item.autoChecked || (manualChecked[item.id] ?? false),
    }));

    // Build subgroup payload from fairness state
    const subgroupPayload = fairness?.subgroup_metrics ?? [];

    // Top features from champion feature_importance (already in right shape)
    const topFeatures = (
      champion.feature_importance ?? []
    ).slice(0, 8).map((f) => ({ feature: f.feature, importance: f.importance }));

    try {
      await downloadCertificatePdf({
        session_id: sessionId,
        run_id: champion.runId,
        participant: 'ML Practitioner',
        organization: 'Clinical Institution',

        // Step 5 — model & metrics
        champion_name: championName,
        model_id: champion.modelId ?? champion.taskId,
        cv_score: champion.search?.best_score ?? null,
        train_test_gap:
          typeof metrics.accuracy === 'number' && typeof (trainMetrics.accuracy) === 'number'
            ? Math.max(0, (trainMetrics.accuracy ?? 0) - (metrics.accuracy ?? 0))
            : null,
        overfitting_risk: champion.visualization?.generalization?.risk ?? 'unknown',
        accuracy: metrics.accuracy ?? null,
        precision: metrics.precision ?? null,
        sensitivity: metrics.sensitivity ?? metrics.recall ?? null,
        specificity: metrics.specificity ?? null,
        f1_score: metrics.f1_score ?? null,
        auc: metrics.auc ?? null,

        // Step 6 — SHAP features
        top_features: topFeatures,

        // Step 7 — fairness
        bias_detected: fairness?.bias_detected ?? false,
        bias_threshold: fairness?.bias_threshold ?? 0.10,
        subgroup_metrics: subgroupPayload,
        fairness_warnings: fairness?.warnings ?? [],

        // EU AI Act checklist
        checklist: checklistPayload,

        // Demographics: empty unless Step 2 profile exposes them
        demographics: [],
      });
    } catch (err: any) {
      setDownloadError(err?.message ?? 'Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleChecklistToggle = (id: string) => {
    setManualChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!champion) {
    return (
      <div className="space-y-6 px-4 py-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <div className="mb-2 flex items-center gap-3 font-bold">
            <AlertCircle size={20} />
            No trained model found
          </div>
          <p className="text-sm">Complete Steps 4–6 before accessing the Ethics &amp; Bias dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">

        {/* ── Page header ── */}
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(239,68,68,0.1),_transparent_40%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-8 py-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 7</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Ethics &amp; Bias Dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                Subgroup performance analysis, bias detection, and EU AI Act compliance assessment for{' '}
                <strong>{championName}</strong>.
              </p>
            </div>
            <DownloadButton onClick={handleDownload} isDownloading={isDownloading} size="lg" />
          </div>
          {downloadError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-rose-700">
              <AlertCircle size={14} />
              {downloadError}
            </div>
          )}
        </div>

        <div className="space-y-6 p-6">
          {/* ── Bias Status Banner ── */}
          {isLoadingFairness ? (
            <div className="flex items-center gap-3 rounded-[28px] border border-slate-200 bg-slate-50 px-8 py-8">
              <Loader2 size={20} className="animate-spin text-slate-400" />
              <span className="text-sm font-semibold text-slate-500">Running subgroup fairness analysis…</span>
            </div>
          ) : fairnessError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {fairnessError}
            </div>
          ) : fairness ? (
            <BiasStatusBanner fairness={fairness} />
          ) : null}

          {/* ── Two-column layout: table + checklist ── */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">

            {/* Subgroup Performance Table */}
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-5">
                <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">Fairness Analysis</p>
                  <h3 className="text-lg font-black tracking-tight text-slate-900">Subgroup Performance Breakdown</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Metrics computed from the actual test split using the champion model.
                    Only protected demographic attributes are shown.
                  </p>
                </div>
              </div>

              {isLoadingFairness ? (
                <div className="space-y-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : fairness ? (
                <SubgroupTable
                  metrics={fairness.subgroup_metrics}
                  threshold={fairness.bias_threshold}
                />
              ) : (
                <div className="flex items-center gap-3 text-sm text-slate-500 py-4">
                  <AlertCircle size={16} />
                  Fairness data not yet available.
                </div>
              )}
            </div>

            {/* EU AI Act Compliance Checklist */}
            {isLoadingFairness ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                <Skeleton className="h-8 w-48" />
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : (
              <ComplianceChecklist items={checklistItems} onToggle={handleChecklistToggle} />
            )}
          </div>

          {/* ── Summary stats row ── */}
          {fairness && (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Subgroups Analysed"
                value={String(fairness.subgroup_metrics.length)}
                tone="text-slate-900"
              />
              <StatCard
                label="Bias Threshold"
                value={pct(fairness.bias_threshold)}
                subtext="Maximum allowed sensitivity gap"
                tone="text-slate-700"
              />
              <StatCard
                label="Compliance Items"
                value={`${checklistItems.filter((i) => i.autoChecked || i.manuallyChecked).length} / ${checklistItems.length}`}
                subtext="EU AI Act checklist"
                tone={checklistItems.every((i) => i.autoChecked || i.manuallyChecked) ? 'text-emerald-700' : 'text-amber-700'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  tone?: string;
  subtext?: string;
}> = ({ label, value, tone = 'text-slate-900', subtext }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    {subtext && <p className="mt-1 text-[11px] font-semibold text-slate-400">{subtext}</p>}
  </div>
);

export default Step7EthicsBias;
