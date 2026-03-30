import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, BarChart3, Gauge, LineChart, Target, Trophy } from 'lucide-react';
import InfoPopover from '../../../components/common/InfoPopover';
import { useDomainStore } from '../../../store/useDomainStore';
import { ModelResult, useModelStore } from '../../../store/useModelStore';
import { MODEL_CATALOG } from '../../modelTuning/modelCatalog';
import { buildRunLabel } from '../../modelTuning/runLabeling';
import ModelDiagnosticsPanel from './ModelDiagnosticsPanel';
import { ConfusionHeatmap, NumericRocChart, percent, riskTone, RocLegend, SplitMetricBars } from './VisualizationPanels';

const EVAL_TABS = [
  { id: 'overview', title: 'Overview', icon: Trophy },
  { id: 'generalization', title: 'Generalization', icon: Gauge },
  { id: 'roc', title: 'ROC Curves', icon: LineChart },
  { id: 'confusion', title: 'Confusion', icon: Target },
  { id: 'features', title: 'Feature Signal', icon: Activity },
  { id: 'diagnostics', title: 'Diagnostics', icon: BarChart3 },
] as const;

type EvalTabId = (typeof EVAL_TABS)[number]['id'];

export const Step5Results: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EvalTabId>('overview');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRocTaskId, setSelectedRocTaskId] = useState<string | null>(null);

  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const resultsMap = useModelStore((state) => state.results);
  const tasks = useModelStore((state) => state.tasks);
  const bestResultTaskId = useModelStore((state) => state.bestResultTaskId);

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
      acc[run.taskId] = buildRunLabel(run.model, run.parameters, nextOccurrence);
      return acc;
    }, {});
  }, [sortedRunsByCreated]);

  const sortedRuns = useMemo(() => {
    return [...trainedRuns].sort((left, right) => {
      const f1Diff = (right.metrics?.f1_score || 0) - (left.metrics?.f1_score || 0);
      if (f1Diff !== 0) {
        return f1Diff;
      }
      return (right.metrics?.accuracy || 0) - (left.metrics?.accuracy || 0);
    });
  }, [trainedRuns]);

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

  const championLabel = champion ? runLabels[champion.taskId] ?? MODEL_CATALOG[champion.model].name : '';
  const rocCurves = rocResult?.roc_curve?.curves ?? [];

  return (
    <div className="space-y-6 px-4 py-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.05),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_40%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-8 py-8">
          <div className={`grid gap-6 ${activeTab === 'overview' ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]' : ''}`}>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 5</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Results & Evaluation</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                Compare finished runs, inspect real diagnostics, and check whether the best score is also the most trustworthy one.
              </p>
              {usesHeldOutTest && (
                <div className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
                  Final scores on this page come from the untouched test split.
                </div>
              )}
            </div>

            {activeTab === 'overview' ? (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-600">
                    <Trophy size={30} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">Champion Run</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">{championLabel}</h2>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${riskTone(champion.visualization?.generalization?.risk)}`}>
                      Overfit risk: {champion.visualization?.generalization?.risk ?? 'unknown'}
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Accuracy', value: champion.metrics.accuracy, avg: averageMetrics.accuracy },
                    { label: 'F1 Score', value: champion.metrics.f1_score, avg: averageMetrics.f1_score },
                    { label: 'Precision', value: champion.metrics.precision, avg: averageMetrics.precision },
                    { label: 'Recall', value: champion.metrics.recall, avg: averageMetrics.recall },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
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
                        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
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
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">Leaderboard</h3>
                    <p className="mt-1 text-sm text-slate-500">Runs are ranked by final F1 score, then accuracy.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-white text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-6 py-4">Rank</th>
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
                          <tr key={run.taskId} className={`border-b last:border-0 ${run.taskId === champion.taskId ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}>
                            <td className="px-6 py-4 font-black text-slate-800">{index === 0 ? '1st' : `#${index + 1}`}</td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900">{runLabels[run.taskId] ?? run.taskId}</p>
                              <p className="mt-1 text-xs text-slate-500">{MODEL_CATALOG[run.model].family}</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${riskTone(run.visualization?.generalization?.risk)}`}>
                                {run.visualization?.generalization?.risk ?? 'unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">{percent(run.metrics?.f1_score)}</td>
                            <td className="px-6 py-4 text-slate-600">{percent(run.metrics?.accuracy)}</td>
                            <td className="px-6 py-4 text-slate-600">{percent(run.metrics?.precision)}</td>
                            <td className="px-6 py-4 text-slate-600">{percent(run.metrics?.recall)}</td>
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

            {activeTab === 'features' && selectedResult && (
              <div className="space-y-6">
                <RunSelector
                  title="Feature Signal"
                  subtitle="Inspect feature importance for one concrete run."
                  helpTitle="Feature signal"
                  helpBody={
                    <>
                      <p>This summarizes which features the fitted model relied on most.</p>
                      <p>It helps with diagnostics and trust, but it should not be interpreted as proof of causation.</p>
                    </>
                  }
                  value={selectedTaskId || champion.taskId}
                  onChange={setSelectedTaskId}
                  runs={sortedRuns}
                  runLabels={runLabels}
                />

                {selectedResult.feature_importance && selectedResult.feature_importance.length > 0 ? (
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-slate-900">Top Features</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Source: {selectedResult.feature_importance_source ?? selectedResult.visualization?.feature_signal_source ?? 'unknown'}
                      </p>
                    </div>
                    <div className="mt-5 space-y-4">
                      {selectedResult.feature_importance.map((feature, index) => {
                        const maxValue = selectedResult.feature_importance?.[0]?.importance || 1;
                        return (
                          <div key={feature.feature} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">#{index + 1}</p>
                                <p className="mt-1 text-base font-bold text-slate-900">{feature.feature}</p>
                              </div>
                              <p className="text-sm font-black text-slate-900">{(feature.importance * 100).toFixed(2)}%</p>
                            </div>
                            <div className="mt-3 h-3 rounded-full bg-white">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600"
                                style={{ width: `${(feature.importance / maxValue) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyPanel message="Feature signal is not available for this run." />
                )}
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
                  runLabel={runLabels[selectedResult.taskId] ?? MODEL_CATALOG[selectedResult.model].name}
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

const EmptyPanel: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
    {message}
  </div>
);

export default Step5Results;
