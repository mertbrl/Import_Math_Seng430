import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Brain,
  Loader2,
  Play,
  Scale,
  Settings2,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import WarningModal from '../../../components/common/WarningModal';
import { buildApiUrl } from '../../../config/apiConfig';
import {
  DOCTOR_CLASSIFICATION_MODEL_ORDER,
  getModelCatalogEntry,
  MODEL_ORDER,
  REGRESSION_MODEL_ORDER,
} from '../modelCatalog';
import { useDomainStore } from '../../../store/useDomainStore';
import { buildPipelineConfig } from '../../../store/pipelineConfig';
import { useEDAStore } from '../../../store/useEDAStore';
import { ChampionPreference, ModelId, TaskStatus, useModelStore } from '../../../store/useModelStore';
import { cancelTrainingTasks } from '../../../services/pipelineApi';
import ModelParamsPanel from './components/ModelParamsPanel';
import TrainingQueuePanel from './components/TrainingQueuePanel';
import { buildResolvedSearchConfig } from './searchSpace';
import {
  buildClassificationAutoPlan,
  buildRegressionAutoPlan,
} from './standardTrainingProfiles';


const ACTIVE_TASK_STATUSES: TaskStatus[] = ['queued', 'running', 'cancelling'];

const CLINICAL_GOALS = [
  {
    value: 'high_sensitivity' as const,
    title: 'Miss as few real patients as possible',
    description: 'Best when missing a true case is the main risk. Step 5 will favor models that catch more real positives, then filter out overfit-heavy runs.',
    icon: Siren,
  },
  {
    value: 'high_precision' as const,
    title: 'Alert only when the case is likely real',
    description: 'Best when false alarms create unnecessary follow-up. Step 5 will favor models that are more often correct when they flag a patient.',
    icon: ShieldCheck,
  },
  {
    value: 'balanced' as const,
    title: 'Balance missed cases and false alarms',
    description: 'Best when both types of error matter. Step 5 will favor models that keep the tradeoff balanced and still generalize well.',
    icon: Scale,
  },
] as const;

type ClinicalGoal = (typeof CLINICAL_GOALS)[number]['value'];

function goalToPreference(goal: ClinicalGoal): ChampionPreference {
  if (goal === 'high_sensitivity') return 'recall';
  if (goal === 'high_precision') return 'precision';
  return 'f1';
}

export const Step4ModelTraining: React.FC = () => {
  const {
    phase,
    activeVizModel,
    modelParams,
    searchConfigs,
    tasks,
    results,
    setPhase,
    setActiveVizModel,
    setTask,
    setChampionPreference,
  } = useModelStore();
  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const sessionId = useDomainStore((state) => state.sessionId);
  const userMode = useDomainStore((state) => state.userMode);
  const mlTask = useEDAStore((state) => state.mlTask);
  const totalRows = useEDAStore((state) => state.totalRows);

  const [requestFreshSplit, setRequestFreshSplit] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [queueingKey, setQueueingKey] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [clinicalGoal, setClinicalGoal] = useState<ClinicalGoal>('balanced');
  const [excludedModels, setExcludedModels] = useState<ModelId[]>([]);

  const isRegression = mlTask === 'regression';
  const isAutoMode = userMode === 'clinical' || isRegression;
  const queueItems = useMemo(() => Object.values(tasks), [tasks]);
  const activeTasks = queueItems.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length;
  const completedRuns = Object.keys(results).length;

  const autoModels = useMemo(
    () => (isRegression ? REGRESSION_MODEL_ORDER : DOCTOR_CLASSIFICATION_MODEL_ORDER),
    [isRegression],
  );
  const selectedAutoModels = useMemo(
    () => autoModels.filter((modelId) => !excludedModels.includes(modelId)),
    [autoModels, excludedModels],
  );
  const hasQueuedBatch = queueItems.length > 0;

  const queueSingleRun = async (
    model: ModelId,
    parameters: Record<string, unknown>,
    searchConfig: Record<string, unknown>,
  ) => {
    const pipelineConfig = buildPipelineConfig(sessionId);
    pipelineConfig.data_split = {
      ...pipelineConfig.data_split,
      force_resplit: requestFreshSplit,
    };

    const response = await fetch(buildApiUrl('/models/train/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        model,
        parameters,
        search_config: searchConfig,
        pipeline_config: pipelineConfig,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.detail || `Could not queue ${getModelCatalogEntry(model, isRegression ? 'regression' : 'classification').name}.`);
    }

    const data = await response.json();
    setTask(data.task_id, {
      taskId: data.task_id,
      model,
      status: data.status,
      createdAt: data.created_at,
    });
  };

  const queueModel = async (model: ModelId) => {
    setQueueError(null);
    setQueueingKey(model);
    setPhase('training');
    setChampionPreference('f1');

    try {
      await queueSingleRun(
        model,
        modelParams[model],
        buildResolvedSearchConfig(model, searchConfigs[model], modelParams[model]),
      );
      setRequestFreshSplit(false);
    } catch (error) {
      console.error(error);
      setQueueError(error instanceof Error ? error.message : 'The model could not be queued.');
      setPhase('selection');
    } finally {
      setQueueingKey(null);
    }
  };

  const queueAutoPlan = async () => {
    if (selectedAutoModels.length === 0) {
      setQueueError('Select at least one model before starting the batch.');
      return;
    }

    setQueueError(null);
    setQueueingKey('auto-plan');
    setPhase('training');
    setChampionPreference(isRegression ? 'rmse' : goalToPreference(clinicalGoal));

    const plan = (isRegression
      ? buildRegressionAutoPlan(totalRows)
      : buildClassificationAutoPlan(goalToPreference(clinicalGoal) as 'recall' | 'precision' | 'f1', totalRows)).filter(
      (item) => selectedAutoModels.includes(item.model),
    );

    let successCount = 0;

    try {
      for (const item of plan) {
        await queueSingleRun(item.model, item.parameters, item.search_config);
        successCount += 1;
      }
      setRequestFreshSplit(false);
    } catch (error) {
      console.error(error);
      const prefix = successCount > 0 ? `${successCount} models were queued before the error. ` : '';
      setQueueError(`${prefix}${error instanceof Error ? error.message : 'The auto-training plan could not be started.'}`);
      if (successCount === 0) {
        setPhase('selection');
      }
    } finally {
      setQueueingKey(null);
    }
  };

  const handleStopRemaining = async () => {
    const activeQueue = Object.values(useModelStore.getState().tasks).filter((task) =>
      ACTIVE_TASK_STATUSES.includes(task.status),
    );
    if (activeQueue.length === 0) return;

    try {
      await cancelTrainingTasks({
        session_id: sessionId,
        task_ids: activeQueue.map((task) => task.taskId),
      });

      activeQueue.forEach((task) => {
        setTask(task.taskId, {
          taskId: task.taskId,
          model: task.model,
          status: task.status === 'queued' ? 'cancelled' : 'cancelling',
        });
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (isRegression) {
      setChampionPreference('rmse');
      return;
    }
    if (userMode === 'clinical') {
      setChampionPreference(goalToPreference(clinicalGoal));
    }
  }, [clinicalGoal, isRegression, setChampionPreference, userMode]);

  useEffect(() => {
    setExcludedModels((current) => current.filter((modelId) => autoModels.includes(modelId)));
  }, [autoModels]);

  if (isAutoMode) {
    const pageTitle = isRegression ? 'Step 4: Regression Training' : 'Step 4: Model Training';
    const pageCopy = isRegression
      ? 'Queue the full 11-model regression pack with stable default settings tuned for solid baseline performance without long searches.'
      : 'Choose the clinical decision style once, then queue the selected models in one click with standard defaults.';
    const selectedCount = selectedAutoModels.length;
    const toggleModelExclusion = (modelId: ModelId) => {
      setExcludedModels((current) =>
        current.includes(modelId) ? current.filter((item) => item !== modelId) : [...current, modelId],
      );
    };

    return (
      <div className="space-y-6">
        <div className="ha-card-muted p-6 sm:p-8">
          <div className="max-w-3xl">
            <p className="ha-section-label" style={{ color: 'var(--accent-ink)' }}>
              Guided Training
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-[30px] font-bold tracking-[-0.05em] text-[var(--text)]">
              {pageTitle}
            </h2>
            <p className="mt-3 text-sm leading-8 text-[var(--text2)]">{pageCopy}</p>
          </div>
        </div>

        {!isRegression ? (
          <div className="grid gap-4 lg:grid-cols-3" data-tutorial="step4-goals">
            {CLINICAL_GOALS.map((goal) => {
              const Icon = goal.icon;
              const active = clinicalGoal === goal.value;
              return (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() => setClinicalGoal(goal.value)}
                  className={`ha-card text-left transition-all ${
                    active
                      ? 'border-[rgba(0,89,62,0.4)] bg-[linear-gradient(180deg,#ffffff,#e8f6ee)] ring-2 ring-[rgba(0,89,62,0.16)] shadow-[0_18px_40px_rgba(0,89,62,0.14)]'
                      : 'border-[rgba(190,201,193,0.48)] bg-white hover:border-[rgba(0,89,62,0.22)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl ${active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                      <Icon size={22} />
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${active ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-slate-100 text-slate-600'}`}>
                      {active ? 'Selected Mode' : 'Champion Rule'}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-black tracking-tight text-[var(--text)]">{goal.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text2)]">{goal.description}</p>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="space-y-6">
          <div className="ha-card p-6" data-tutorial="step4-split">
            <div className="rounded-[18px] border border-[rgba(190,201,193,0.48)] bg-white/80 px-4 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--text)]">Holdout Split Strategy</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--text2)]">
                    Reuse the same split for fair model comparison. Turn on a fresh split only when you intentionally want a new holdout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestFreshSplit((current) => !current)}
                  className={requestFreshSplit ? 'ha-button-secondary text-[var(--warning)]' : 'ha-button-secondary'}
                >
                  {requestFreshSplit ? 'Fresh split on next batch' : 'Reuse current split'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="ha-card p-6" data-tutorial="step4-models">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm font-bold text-[var(--text)]">Models</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExcludedModels([])}
                    className="ha-button-secondary"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcludedModels([...autoModels])}
                    className="ha-button-secondary"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {autoModels.map((modelId) => {
                  const meta = getModelCatalogEntry(modelId, isRegression ? 'regression' : 'classification');
                  const included = selectedAutoModels.includes(modelId);
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => toggleModelExclusion(modelId)}
                      className={`rounded-[18px] border px-4 py-4 text-left transition-all ${
                        included
                          ? 'border-[rgba(0,89,62,0.24)] bg-[linear-gradient(180deg,#ffffff,#f3faf5)] shadow-[0_10px_24px_rgba(0,89,62,0.08)]'
                          : 'border-[rgba(190,201,193,0.48)] bg-slate-50/90 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className={`text-sm font-black ${included ? 'text-[var(--text)]' : 'text-slate-500'}`}>{meta.name}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                          included ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {included ? 'Included' : 'Excluded'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {queueError ? (
                <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {queueError}
                </div>
              ) : null}
            </div>

            <TrainingQueuePanel
              catalogCount={selectedCount}
              onStopRemaining={() => {
                void handleStopRemaining();
              }}
              emptyMessage="No training run has started yet."
            />
          </div>

          <div className="flex border-t border-[var(--border)] pt-5">
            <button
              type="button"
              data-tutorial="step4-train-btn"
              onClick={() => void queueAutoPlan()}
              disabled={queueingKey !== null || hasQueuedBatch}
              className="ha-button-primary inline-flex items-center justify-center gap-3"
            >
              {queueingKey === 'auto-plan' ? <Loader2 size={18} className="animate-spin" /> : hasQueuedBatch ? <Activity size={18} /> : <Play size={18} />}
              {hasQueuedBatch
                ? 'Batch Started'
                : `Train ${selectedCount} Selected Model${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>

        <WarningModal
          isOpen={stopModalOpen}
          title="Open Step 5 with current results?"
          message="Some model runs are still in progress. If you continue now, queued work will stop and Step 5 will open with the finished results already available."
          onConfirm={() => {
            setStopModalOpen(false);
            void (async () => {
              await handleStopRemaining();
              setCurrentStep(5);
            })();
          }}
          onCancel={() => setStopModalOpen(false)}
          confirmText="Stop And Open Results"
          cancelText="Keep Training"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="ha-card overflow-hidden p-0">
        <div className="border-b border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(var(--accent-rgb),0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(var(--accent-rgb),0.08),_transparent_34%),linear-gradient(180deg,_#ffffff,_#f4fbfb)] px-6 py-7">
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[var(--text)]">
            <Brain className="text-[var(--accent)]" size={26} />
            Step 4: Model Training Goal
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text2)]">
            Inspect one model at a time, adjust its parameters, and queue the runs you want to compare.
          </p>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="ha-card p-4" data-tutorial="step4-ds-tabs">
              <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
                {MODEL_ORDER.map((modelId) => {
                  const model = getModelCatalogEntry(modelId, 'classification');
                  const isActive = activeVizModel === modelId;
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => setActiveVizModel(modelId)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                        isActive
                          ? 'bg-[var(--accent)] text-white shadow-soft'
                          : 'bg-transparent text-[var(--text2)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)]'
                      }`}
                    >
                      {model.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ha-card p-6">
              <div className="flex items-center gap-2">
                <Settings2 className="text-[var(--accent)]" size={18} />
                <h3 className="text-sm font-bold text-[var(--text)]">Current Model Setup</h3>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)]/60 px-4 py-4">
                <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${getModelCatalogEntry(activeVizModel, 'classification').accent}`}>
                  {getModelCatalogEntry(activeVizModel, 'classification').short}
                </p>
                <h4 className="mt-1 text-lg font-black tracking-tight text-[var(--text)]">{getModelCatalogEntry(activeVizModel, 'classification').name}</h4>
                <p className="mt-2 text-sm leading-7 text-[var(--text2)]">{getModelCatalogEntry(activeVizModel, 'classification').description}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--text)]">Holdout Split</p>
                    <p className="mt-1 text-xs leading-6 text-[var(--text2)]">
                      Reuse the same split for fair comparison. Turn on a fresh split only when you intentionally want a new holdout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequestFreshSplit((current) => !current)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      requestFreshSplit ? 'bg-warning-100 text-warning-900' : 'border border-[var(--border)] bg-white text-[var(--text)]'
                    }`}
                  >
                    {requestFreshSplit ? 'Fresh next run' : 'Reuse current split'}
                  </button>
                </div>
              </div>

              {queueError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {queueError}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <ModelParamsPanel model={activeVizModel} />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4">
                <p className="text-sm text-[var(--text2)]">
                  {activeTasks} active run{activeTasks === 1 ? '' : 's'}, {completedRuns} finished
                </p>
                <button
                  type="button"
                  onClick={() => void queueModel(activeVizModel)}
                  disabled={queueingKey === activeVizModel}
                  className="ha-button-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {queueingKey === activeVizModel ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  Queue current run
                </button>
              </div>
            </div>
          </div>

          <TrainingQueuePanel
            catalogCount={MODEL_ORDER.length}
            onStopRemaining={() => {
              void handleStopRemaining();
            }}
          />
        </div>
      </div>

      <WarningModal
        isOpen={stopModalOpen}
        title="Open Step 5 with current results?"
        message="Some model runs are still in progress. If you continue now, queued work will stop and Step 5 will open with the finished results already available."
        onConfirm={() => {
          setStopModalOpen(false);
          void (async () => {
            await handleStopRemaining();
            setCurrentStep(5);
          })();
        }}
        onCancel={() => setStopModalOpen(false)}
        confirmText="Stop And Open Results"
        cancelText="Keep Training"
      />
    </div>
  );
};

export default Step4ModelTraining;
