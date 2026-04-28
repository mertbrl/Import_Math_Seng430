import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, BarChart3, Gauge, LineChart, ShieldCheck, Target, Trophy } from 'lucide-react';
import InfoPopover from '../../../components/common/InfoPopover';
import { useDomainStore } from '../../../store/useDomainStore';
import { ModelResult, useModelStore } from '../../../store/useModelStore';
import { getModelCatalogEntry } from '../../modelTuning/modelCatalog';
import { buildRunLabel } from '../../modelTuning/runLabeling';
import ModelDiagnosticsPanel from './ModelDiagnosticsPanel';
import { ConfusionHeatmap, NumericRocChart, percent, riskTone, RocLegend, SplitMetricBars } from './VisualizationPanels';

const EVAL_TABS = [
  { id: 'overview', title: 'Overview', icon: Trophy },
  { id: 'generalization', title: 'Generalization', icon: Gauge },
  { id: 'roc', title: 'ROC Curves', icon: LineChart },
  { id: 'confusion', title: 'Confusion', icon: Target },
  { id: 'diagnostics', title: 'Diagnostics', icon: BarChart3 },
] as const;

type EvalTabId = (typeof EVAL_TABS)[number]['id'];

function getRunMetrics(run: ModelResult) {
  return run.test_metrics ?? run.metrics;
}

function getRunGeneralization(run: ModelResult) {
  return run.test_visualization?.generalization ?? run.visualization?.generalization;
}

function getChampionPenalty(run: ModelResult): number {
  const generalization = getRunGeneralization(run);
  const riskPenalty =
    generalization?.risk === 'high'
      ? 0.08
      : generalization?.risk === 'moderate'
        ? 0.035
        : 0;
  const gap =
    generalization?.train_minus_test ??
    generalization?.train_minus_selection ??
    generalization?.train_minus_test_f1 ??
    generalization?.train_minus_selection_f1 ??
    0;
  return riskPenalty + Math.max(0, gap) * 0.6;
}

function sortRunsByPreference(runs: ModelResult[], preference: 'recall' | 'precision' | 'f1' | 'rmse') {
  return [...runs].sort((left, right) => {
    const leftMetrics = getRunMetrics(left);
    const rightMetrics = getRunMetrics(right);
    const leftPenalty = getChampionPenalty(left);
    const rightPenalty = getChampionPenalty(right);

    if (preference === 'rmse') {
      const leftScore = (leftMetrics.rmse ?? Number.POSITIVE_INFINITY) + leftPenalty;
      const rightScore = (rightMetrics.rmse ?? Number.POSITIVE_INFINITY) + rightPenalty;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }
      return (rightMetrics.r2 ?? Number.NEGATIVE_INFINITY) - (leftMetrics.r2 ?? Number.NEGATIVE_INFINITY);
    }

    const metricKey = preference === 'recall' ? 'recall' : preference === 'precision' ? 'precision' : 'f1_score';
    const leftScore = (leftMetrics[metricKey] ?? 0) - leftPenalty;
    const rightScore = (rightMetrics[metricKey] ?? 0) - rightPenalty;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    const fallbackF1 = (rightMetrics.f1_score ?? 0) - (leftMetrics.f1_score ?? 0);
    if (fallbackF1 !== 0) {
      return fallbackF1;
    }
    return (rightMetrics.accuracy ?? 0) - (leftMetrics.accuracy ?? 0);
  });
}

export const Step5Results: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EvalTabId>('overview');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRocTaskId, setSelectedRocTaskId] = useState<string | null>(null);

  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const completeStep5 = useDomainStore((state) => state.completeStep5);
  const userMode = useDomainStore((state) => state.userMode);
  const resultsMap = useModelStore((state) => state.results);
  const tasks = useModelStore((state) => state.tasks);
  const bestResultTaskId = useModelStore((state) => state.bestResultTaskId);
  const championPreference = useModelStore((state) => state.championPreference);
  const preferenceLabel =
    championPreference === 'recall'
      ? 'recall'
      : championPreference === 'precision'
        ? 'precision'
        : championPreference === 'rmse'
          ? 'RMSE'
          : 'F1';

  const trainedRuns = useMemo(() => {
    return Object.values(resultsMap).map((result) => ({
      ...result,
      metrics: result.test_metrics ?? result.metrics,
      confusion_matrix: result.test_confusion_matrix ?? result.confusion_matrix,
      roc_curve: result.test_roc_curve ?? result.roc_curve,
      visualization: result.test_visualization ?? result.visualization,
    }));
  }, [resultsMap]);

  const sortedRunsByCreated = useMemo(() => {
    return [...trainedRuns].sort((left, right) => {
      return new Date(tasks[left.taskId]?.createdAt ?? 0).getTime() - new Date(tasks[right.taskId]?.createdAt ?? 0).getTime();
    });
  }, [tasks, trainedRuns]);

  const runLabels = useMemo(() => {
    const counters: Partial<Record<ModelResult['model'], number>> = {};
    return sortedRunsByCreated.reduce<Record<string, string>>((acc, run) => {
      const nextOccurrence = (counters[run.model] ?? 0) + 1;
      counters[run.model] = nextOccurrence;
      acc[run.taskId] = buildRunLabel(run.model, run.parameters, nextOccurrence, run.problem_type ?? 'classification');
      return acc;
    }, {});
  }, [sortedRunsByCreated]);

  const sortedRuns = useMemo(() => {
    return sortRunsByPreference(trainedRuns, championPreference);
  }, [championPreference, trainedRuns]);

  const champion = useMemo(() => {
    if (!bestResultTaskId) {
      return sortedRuns[0];
    }
    return trainedRuns.find((result) => result.taskId === bestResultTaskId) ?? sortedRuns[0];
  }, [bestResultTaskId, trainedRuns, sortedRuns]);

  useEffect(() => {
    if (!selectedTaskId && champion) {
      setSelectedTaskId(champion.taskId);
    }
    if (!selectedRocTaskId && champion) {
      setSelectedRocTaskId(champion.taskId);
    }
  }, [champion, selectedRocTaskId, selectedTaskId]);

  const selectedResult = trainedRuns.find((run) => run.taskId === selectedTaskId) ?? champion;
  const rocResult = trainedRuns.find((run) => run.taskId === selectedRocTaskId) ?? champion;
  const usesHeldOutTest = Object.values(resultsMap).some((result) => Boolean(result?.test_metrics));
  const problemType = champion?.problem_type ?? 'classification';

  if (trainedRuns.length === 0) {
    return (
      <div className="space-y-6 px-4 py-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <div className="mb-2 flex items-center gap-3 font-bold">
            <AlertCircle size={20} />
            No model results found
          </div>
          <p className="text-sm">Return to Step 4, send one or more runs to the queue, and open Step 5 again once at least one run has finished.</p>
          <button
            onClick={() => setCurrentStep(4)}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm transition-colors hover:bg-slate-50"
          >
            Return to Step 4
          </button>
        </div>
      </div>
    );
  }

  const averageMetrics = {
    accuracy: trainedRuns.reduce((sum, run) => sum + (run.metrics?.accuracy || 0), 0) / trainedRuns.length,
    precision: trainedRuns.reduce((sum, run) => sum + (run.metrics?.precision || 0), 0) / trainedRuns.length,
    recall: trainedRuns.reduce((sum, run) => sum + (run.metrics?.recall || 0), 0) / trainedRuns.length,
    f1_score: trainedRuns.reduce((sum, run) => sum + (run.metrics?.f1_score || 0), 0) / trainedRuns.length,
  };

  const championLabel = champion ? runLabels[champion.taskId] ?? getModelCatalogEntry(champion.model, problemType).name : '';
  const rocCurves = rocResult?.roc_curve?.curves ?? [];

  if (problemType === 'regression' && champion) {
    const championMetrics = getRunMetrics(champion);
    const championGeneralization = getRunGeneralization(champion);
    const regressionRuns = sortedRuns;
    const selectedRegressionRun = trainedRuns.find((run) => run.taskId === selectedTaskId) ?? champion;
    const selectedRegressionMetrics = getRunMetrics(selectedRegressionRun);

    return (
      <div className="space-y-6 px-4 py-8">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(0,89,62,0.08),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,116,82,0.12),_transparent_36%),linear-gradient(180deg,_#ffffff,_#f7fbf8)] px-8 py-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 5</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Regression Results & Evaluation</h1>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Compare all 11 regression runs, then keep the model with the lowest RMSE and the smallest generalization penalty.
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <Trophy size={30} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Champion Run</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{championLabel}</h2>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${riskTone(championGeneralization?.risk)}`}>
                      Overfit risk: {championGeneralization?.risk ?? 'unknown'}
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">RMSE</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{championMetrics.rmse ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">MAE</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{championMetrics.mae ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">R²</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{percent(championMetrics.r2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <h3 className="text-lg font-black tracking-tight text-slate-900">Regression Leaderboard</h3>
                <p className="mt-1 text-sm text-slate-500">Runs are ranked by lower RMSE, then lower overfit risk, then higher R².</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-white text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4 sticky left-0 z-10 bg-white shadow-[1px_0_0_0_var(--border)]">Rank</th>
                      <th className="px-6 py-4">Run</th>
                      <th className="px-6 py-4">Overfit Risk</th>
                      <th className="px-6 py-4">RMSE</th>
                      <th className="px-6 py-4">MAE</th>
                      <th className="px-6 py-4">R²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regressionRuns.map((run, index) => {
                      const metrics = getRunMetrics(run);
                      const generalization = getRunGeneralization(run);
                      return (
                        <tr key={run.taskId} className="group border-b last:border-0 hover:bg-slate-50/70">
                          <td className={`px-6 py-4 font-black text-slate-800 sticky left-0 z-10 shadow-[1px_0_0_0_var(--border)] ${run.taskId === champion.taskId ? 'bg-slate-50' : 'bg-white group-hover:bg-slate-50'}`}>
                            {index === 0 ? '1st' : `#${index + 1}`}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{runLabels[run.taskId] ?? getModelCatalogEntry(run.model, 'regression').name}</p>
                            <p className="mt-1 text-xs text-slate-500">{getModelCatalogEntry(run.model, 'regression').family}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${riskTone(generalization?.risk)}`}>
                              {generalization?.risk ?? 'unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">{metrics.rmse ?? 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-600">{metrics.mae ?? 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-600">{percent(metrics.r2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <RunSelector
              title="Regression Diagnostics"
              subtitle="Inspect train, validation, and test behaviour for one finished run."
              value={selectedTaskId || champion.taskId}
              onChange={setSelectedTaskId}
              runs={regressionRuns}
              runLabels={runLabels}
            />

            <div className="grid gap-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-black tracking-tight text-slate-900">Generalization Check</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">RMSE</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{selectedRegressionMetrics.rmse ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">MAE</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{selectedRegressionMetrics.mae ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">R²</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{percent(selectedRegressionMetrics.r2)}</p>
                  </div>
                </div>
                <div className={`mt-5 rounded-2xl border p-4 ${riskTone(getRunGeneralization(selectedRegressionRun)?.risk)}`}>
                  <p className="text-sm font-bold">Generalization notes</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {(getRunGeneralization(selectedRegressionRun)?.notes ?? []).map((note) => (
                      <div key={note} className="rounded-xl bg-white/80 px-3 py-2 text-slate-700">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 shadow-sm">
          <div className="flex flex-col items-center gap-6 px-8 py-8 text-center sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
              <Trophy size={26} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Evaluation Complete</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Ready to continue with the champion regression model?</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Step 6 will open with <strong>{championLabel}</strong> as the selected run.
              </p>
            </div>
            <button
              id="proceed-to-explainability-btn"
              onClick={completeStep5}
              className="flex shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-sm font-black text-white shadow-lg transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
            >
              Complete Training &amp; Proceed
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userMode === 'clinical' && champion) {
    const metrics = getRunMetrics(champion);
    const interpretation =
      (metrics.recall ?? 0) >= 0.85
        ? 'The model is catching most positive cases and suits a triage-first workflow where missed cases are costly.'
        : (metrics.precision ?? 0) >= 0.85
        ? 'The model is conservative and reduces false alarms, which helps when downstream workups are expensive or invasive.'
        : 'The model offers a balanced screening profile that can support review without leaning too heavily toward either false positives or false negatives.';

    return (
      <div className="space-y-6">
        <div className="ha-card-muted p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-white text-[var(--success)] shadow-sm">
                <Trophy size={30} />
              </div>
              <div>
                <p className="ha-section-label" style={{ color: 'var(--success)' }}>
                  Winning Model
                </p>
                <h2 className="mt-2 font-[var(--font-display)] text-[34px] font-bold tracking-[-0.06em] text-[var(--text)]">
                  Best Model: {getModelCatalogEntry(champion.model, problemType).name}
                </h2>
                <p className="mt-2 text-lg font-semibold text-[var(--success)]">
                  {percent(metrics.accuracy)} Accuracy
                </p>
              </div>
            </div>

            <div className="rounded-[18px] border border-[var(--border)] bg-white/88 px-5 py-4">
              <p className="ha-section-label">Recommended Run</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text)]">{championLabel}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <DoctorMetric label="Accuracy" value={percent(metrics.accuracy)} />
          <DoctorMetric label="AUC-ROC" value={percent(metrics.auc)} />
          <DoctorMetric label="F1 Score" value={percent(metrics.f1_score)} />
        </div>

        <DoctorConfusionPanel result={champion} />

        <div className="ha-card p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--clinical-light)] text-[var(--clinical)]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="ha-section-label">What this means for your workflow</p>
              <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Clinical interpretation</h3>
              <p className="mt-3 text-sm leading-8 text-[var(--text2)]">{interpretation}</p>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-8">
      <div className="ha-card overflow-hidden p-0">
        <div className="ha-step5-hero border-b border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(var(--accent-rgb),0.08),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(var(--accent-rgb),0.14),_transparent_40%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-8 py-8">
          <div className={`grid gap-6 ${activeTab === 'overview' ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]' : ''}`}>
            <div>
              <p className="ha-step5-hero-kicker text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 5</p>
              <h1 className="ha-step5-hero-title mt-2 text-3xl font-black tracking-tight text-slate-900">Results & Evaluation</h1>
              <p className="ha-step5-hero-copy mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                Compare finished runs, inspect real diagnostics, and check whether the best score is also the most trustworthy one.
              </p>
              {usesHeldOutTest && (
                <div className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
                  Final scores on this page come from the untouched test split.
                </div>
              )}
            </div>

            {activeTab === 'overview' ? (
              <div className="rounded-[28px] border border-[var(--border)] bg-white/90 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
                    <Trophy size={30} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Champion Run</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{championLabel}</h2>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${riskTone(getRunGeneralization(champion)?.risk)}`}>
                      Overfit risk: {getRunGeneralization(champion)?.risk ?? 'unknown'}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2"> 
                  {[
                    { label: 'Accuracy', value: getRunMetrics(champion).accuracy, avg: averageMetrics.accuracy },
                    { label: 'F1 Score', value: getRunMetrics(champion).f1_score, avg: averageMetrics.f1_score },
                    { label: 'Precision', value: getRunMetrics(champion).precision, avg: averageMetrics.precision },
                    { label: 'Recall', value: getRunMetrics(champion).recall, avg: averageMetrics.recall },
                  ].map((item) => (
                    <div key={item.label} className="flex-1 min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 p-4"> 
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-black text-slate-900">{percent(item.value)}</p>
                      <p className={`mt-1 text-[11px] font-semibold ${(item.value ?? 0) >= item.avg ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {((item.value ?? 0) - item.avg) >= 0 ? '+' : ''}
                        {(((item.value ?? 0) - item.avg) * 100).toFixed(1)} vs average
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-6 p-6 xl:flex-row xl:items-start">
          <aside className="w-full shrink-0 xl:w-72">
            <div className="ha-card p-4">
              <h3 className="px-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Evaluation Views</h3>
              <div className="mt-3 space-y-1">
                {EVAL_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
                        active ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
                      <span className="text-sm font-bold">{tab.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-6">
            {activeTab === 'overview' && (
              <>
                <div className="ha-card overflow-hidden p-0">
                  <div className="border-b border-[var(--border)] bg-slate-50 px-6 py-4">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">Leaderboard</h3>
                    <p className="mt-1 text-sm text-slate-500">Runs are ranked by final {preferenceLabel}, then lower overfit risk.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-white text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-6 py-4 sticky left-0 z-10 bg-white shadow-[1px_0_0_0_var(--border)]">Rank</th> 
                          <th className="px-6 py-4">Run</th>
                          <th className="px-6 py-4">Overfit Risk</th>
                          <th className="px-6 py-4">F1</th>
                          <th className="px-6 py-4">Accuracy</th>
                          <th className="px-6 py-4">Precision</th>
                          <th className="px-6 py-4">Recall</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRuns.map((run, index) => (
                          <tr key={run.taskId} className="group border-b last:border-0 hover:bg-slate-50/70">
                            <td className={`px-6 py-4 font-black text-slate-800 sticky left-0 z-10 shadow-[1px_0_0_0_var(--border)] ${run.taskId === champion.taskId ? 'bg-slate-50' : 'bg-white group-hover:bg-slate-50'}`}> 
                              {index === 0 ? '1st' : `#${index + 1}`}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{runLabels[run.taskId] ?? run.taskId}</p>
                              <p className="mt-1 text-xs text-slate-500">{getModelCatalogEntry(run.model, run.problem_type ?? 'classification').family}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${riskTone(run.visualization?.generalization?.risk)}`}>
                                {getRunGeneralization(run)?.risk ?? 'unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">{percent(getRunMetrics(run)?.f1_score)}</td>
                            <td className="px-6 py-4 text-slate-600">{percent(getRunMetrics(run)?.accuracy)}</td>
                            <td className="px-6 py-4 text-slate-600">{percent(getRunMetrics(run)?.precision)}</td>
                            <td className="px-6 py-4 text-slate-600">{percent(getRunMetrics(run)?.recall)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'generalization' && selectedResult && (
              <div className="space-y-6">
                <RunSelector
                  title="Generalization Check"
                  subtitle="Inspect train, validation, and test behaviour for one concrete run."
                  helpTitle="Generalization check"
                  helpBody={
                    <>
                      <p>Generalization means the model still performs well on data it never trained on.</p>
                      <p>If training is much stronger than validation or test, that gap is one of the clearest overfitting signals.</p>
                    </>
                  }
                  value={selectedTaskId || champion.taskId}
                  onChange={setSelectedTaskId}
                  runs={sortedRuns}
                  runLabels={runLabels}
                />

                <SplitMetricBars result={selectedResult} />

                <div className={`rounded-[28px] border p-5 shadow-sm ${riskTone(selectedResult.visualization?.generalization?.risk)}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-black tracking-tight">Overfit Risk</span>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                      {selectedResult.visualization?.generalization?.risk ?? 'unknown'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <MetricCard label="Train minus selection F1" value={selectedResult.visualization?.generalization?.train_minus_selection_f1} />
                    <MetricCard label="Train minus test F1" value={selectedResult.visualization?.generalization?.train_minus_test_f1} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {(selectedResult.visualization?.generalization?.notes ?? []).map((note) => (
                      <div key={note} className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-slate-700">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roc' && rocResult && (
              <div className="space-y-6">
                <RunSelector
                  title="ROC Curves"
                  subtitle="Select a run and inspect its real ROC payload."
                  helpTitle="ROC curves"
                  helpBody={
                    <>
                      <p>ROC compares sensitivity and false positive rate across thresholds.</p>
                      <p>It is most useful when the model exposes real scores or probabilities and you want threshold-aware comparison.</p>
                    </>
                  }
                  value={selectedRocTaskId || champion.taskId}
                  onChange={setSelectedRocTaskId}
                  runs={sortedRuns}
                  runLabels={runLabels}
                />

                {rocCurves.length > 0 ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <NumericRocChart curves={rocCurves} />
                    <RocLegend curves={rocCurves} />
                  </div>
                ) : (
                  <EmptyPanel message="ROC curves are not available for this run. That usually means the estimator does not expose usable score probabilities for the current setup." />
                )}
              </div>
            )}

            {activeTab === 'confusion' && selectedResult && (
              <div className="space-y-6">
                <RunSelector
                  title="Confusion Analysis"
                  subtitle="Inspect prediction breakdown for one finished run."
                  helpTitle="Confusion analysis"
                  helpBody={
                    <>
                      <p>This view shows which actual classes are being mistaken for which predicted classes.</p>
                      <p>It is often the fastest way to see whether one class is being ignored or confused with a specific neighbor.</p>
                    </>
                  }
                  value={selectedTaskId || champion.taskId}
                  onChange={setSelectedTaskId}
                  runs={sortedRuns}
                  runLabels={runLabels}
                />
                <ConfusionHeatmap result={selectedResult} />
              </div>
            )}

            {activeTab === 'diagnostics' && selectedResult && (
              <div className="space-y-6">
                <RunSelector
                  title="Full Diagnostics"
                  subtitle="Grid search, split integrity, projection, confidence, confusion, and class-wise behaviour."
                  helpTitle="Diagnostics"
                  helpBody={
                    <>
                      <p>This tab collects the raw diagnostic evidence behind the headline score.</p>
                      <p>It is the best place to check whether a strong result also looks trustworthy and stable.</p>
                    </>
                  }
                  value={selectedTaskId || champion.taskId}
                  onChange={setSelectedTaskId}
                  runs={sortedRuns}
                  runLabels={runLabels}
                />
                <ModelDiagnosticsPanel
                  result={selectedResult}
                  runLabel={runLabels[selectedResult.taskId] ?? getModelCatalogEntry(selectedResult.model, selectedResult.problem_type ?? 'classification').name}
                />
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

const RunSelector: React.FC<{
  title: string;
  subtitle: string;
  helpTitle?: string;
  helpBody?: React.ReactNode;
  value: string;
  onChange: (taskId: string) => void;
  runs: ModelResult[];
  runLabels: Record<string, string>;
}> = ({ title, subtitle, helpTitle, helpBody, value, onChange, runs, runLabels }) => (
  <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-black tracking-tight text-slate-900">{title}</h3>
        {helpTitle && helpBody ? (
          <InfoPopover title={helpTitle} panelWidthClassName="w-[24rem]">
            {helpBody}
          </InfoPopover>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-[340px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800"
    >
      {runs.map((run) => (
        <option key={run.taskId} value={run.taskId}>
          {runLabels[run.taskId] ?? run.taskId}
        </option>
      ))}
    </select>
  </div>
);

const MetricCard: React.FC<{ label: string; value?: number | null }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white/75 p-4">
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-slate-900">{percent(value)}</p>
  </div>
);

const DoctorMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="ha-card p-5">
    <p className="ha-section-label">{label}</p>
    <p className="mt-4 font-[var(--font-display)] text-[36px] font-bold tracking-[-0.05em] text-[var(--accent)]">
      {value}
    </p>
  </div>
);

const DoctorConfusionPanel: React.FC<{ result: ModelResult }> = ({ result }) => {
  const summary = result.confusion_matrix;
  const fullMatrix = result.visualization?.confusion_matrix_full;

  if (summary?.tn == null || summary.fp == null || summary.fn == null || summary.tp == null) {
    if (!fullMatrix) {
      return null;
    }

    return (
      <div className="ha-card p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--clinical-light)] text-[var(--clinical)]">
            <Target size={22} />
          </div>
          <div className="min-w-0">
            <p className="ha-section-label">Prediction Breakdown</p>
            <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Confusion matrix</h3>
            <p className="mt-3 text-sm leading-8 text-[var(--text2)]">
              Rows show the real class. Columns show what the model predicted. The diagonal cells are the correct predictions.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <ConfusionHeatmap result={result} />
        </div>
      </div>
    );
  }

  const cells = [
    {
      title: 'Real patient, predicted positive',
      value: summary.tp,
      description: 'The patient truly had the condition and the model correctly flagged it.',
      tone: 'border-emerald-200 bg-emerald-50',
      toneClass: 'ha-step5-confusion-cell-tp',
    },
    {
      title: 'Real patient, predicted negative',
      value: summary.fn,
      description: 'The patient had the condition but the model missed it.',
      tone: 'border-rose-200 bg-rose-50',
      toneClass: 'ha-step5-confusion-cell-fn',
    },
    {
      title: 'Healthy patient, predicted positive',
      value: summary.fp,
      description: 'The patient did not have the condition but the model raised an alert.',
      tone: 'border-amber-200 bg-amber-50',
      toneClass: 'ha-step5-confusion-cell-fp',
    },
    {
      title: 'Healthy patient, predicted negative',
      value: summary.tn,
      description: 'The patient did not have the condition and the model stayed negative.',
      tone: 'border-sky-200 bg-sky-50',
      toneClass: 'ha-step5-confusion-cell-tn',
    },
  ];

  return (
    <div className="ha-card p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--clinical-light)] text-[var(--clinical)]">
          <Target size={22} />
        </div>
        <div className="min-w-0">
          <p className="ha-section-label">Prediction Breakdown</p>
          <h3 className="mt-2 text-xl font-bold text-[var(--text)]">Confusion matrix</h3>
          <p className="mt-3 text-sm leading-8 text-[var(--text2)]">
            This tells you what was real and what the model predicted, so you can see whether the model mostly misses patients or mostly raises extra alerts.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {cells.map((cell) => (
          <div key={cell.title} className={`ha-step5-confusion-cell rounded-2xl border p-5 ${cell.tone} ${cell.toneClass}`}>
            <p className="ha-step5-confusion-label text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{cell.title}</p>
            <p className="ha-step5-confusion-value mt-3 font-[var(--font-display)] text-[36px] font-bold tracking-[-0.05em] text-[var(--text)]">{cell.value}</p>
            <p className="ha-step5-confusion-copy mt-3 text-sm leading-7 text-slate-700">{cell.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
    {message}
  </div>
);

export default Step5Results;
