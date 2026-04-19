import React, { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Compass,
  Loader2,
  Play,
  Scale,
  Settings2,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import WarningModal from '../../../components/common/WarningModal';
import { buildApiUrl } from '../../../config/apiConfig';
import { MODEL_CATALOG, MODEL_ORDER } from '../modelCatalog';
import { useDomainStore } from '../../../store/useDomainStore';
import { buildPipelineConfig } from '../../../store/pipelineConfig';
import { ModelId, TaskStatus, useModelStore } from '../../../store/useModelStore';
import { cancelTrainingTasks } from '../../../services/pipelineApi';
import ModelParamsPanel from './components/ModelParamsPanel';
import TrainingQueuePanel from './components/TrainingQueuePanel';
import { buildResolvedSearchConfig } from './searchSpace';

const ACTIVE_TASK_STATUSES: TaskStatus[] = ['queued', 'running', 'cancelling'];

const CLINICAL_GOALS = [
  {
    value: 'high_sensitivity' as const,
    title: 'Avoid Missed Cases',
    subtitle: 'Recall / sensitivity focus',
    description:
      'Prioritises catching as many risky patients as possible, even if the system raises more follow-up alerts.',
    icon: Siren,
    activeClasses: 'border-trust-500 bg-trust-50 shadow-card',
    badgeClasses: 'border-trust-200 bg-white text-trust-700',
    iconClasses: 'bg-trust-500 text-white',
  },
  {
    value: 'high_precision' as const,
    title: 'Reduce False Alarms',
    subtitle: 'Precision focus',
    description:
      'Prioritises cleaner alerts and reduces unnecessary escalations when downstream review is expensive or invasive.',
    icon: ShieldCheck,
    activeClasses: 'border-danger-400 bg-danger-50 shadow-card',
    badgeClasses: 'border-danger-200 bg-white text-danger-700',
    iconClasses: 'bg-danger-500 text-white',
  },
  {
    value: 'balanced' as const,
    title: 'Balanced Approach',
    subtitle: 'F1-score focus',
    description:
      'Balances sensitivity and precision for a steadier clinical recommendation profile across typical outpatient workflows.',
    icon: Scale,
    activeClasses: 'border-clinical-500 bg-clinical-50 shadow-card',
    badgeClasses: 'border-clinical-200 bg-white text-clinical-700',
    iconClasses: 'bg-clinical-500 text-white',
  },
] as const;

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
  } = useModelStore();
  const setCurrentStep = useDomainStore((state) => state.setCurrentStep);
  const currentStep = useDomainStore((state) => state.currentStep);
  const sessionId = useDomainStore((state) => state.sessionId);
  const userMode = useDomainStore((state) => state.userMode);

  const [requestFreshSplit, setRequestFreshSplit] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [queueingModelId, setQueueingModelId] = useState<ModelId | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [clinicalGoal, setClinicalGoal] = useState<'high_sensitivity' | 'high_precision' | 'balanced'>('balanced');

  const queueItems = useMemo(() => Object.values(tasks), [tasks]);
  const activeTasks = queueItems.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length;
  const completedRuns = Object.keys(results).length;
  const canOpenResults = completedRuns > 0;

  const queueModel = async (model: ModelId) => {
    setQueueError(null);
    setQueueingModelId(model);
    setPhase('training');

    const pipelineConfig = buildPipelineConfig(sessionId);
    pipelineConfig.data_split = {
      ...pipelineConfig.data_split,
      force_resplit: requestFreshSplit,
    };

    try {
      const response = await fetch(buildApiUrl('/models/train/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          model,
          parameters: modelParams[model],
          search_config: buildResolvedSearchConfig(model, searchConfigs[model], modelParams[model]),
          pipeline_config: pipelineConfig,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || `Could not queue ${MODEL_CATALOG[model].name}.`);
      }

      const data = await response.json();
      setTask(data.task_id, {
        taskId: data.task_id,
        model,
        status: data.status,
        createdAt: data.created_at,
      });
      setRequestFreshSplit(false);
    } catch (error) {
      console.error(error);
      setQueueError(error instanceof Error ? error.message : 'The model could not be queued.');
      setPhase('selection');
    } finally {
      setQueueingModelId(null);
    }
  };

  const queueClinicalModel = async () => {
    setQueueError(null);
    setQueueingModelId('rf');
    setPhase('training');

    const pipelineConfig = buildPipelineConfig(sessionId);
    pipelineConfig.data_split = {
      ...pipelineConfig.data_split,
      force_resplit: requestFreshSplit,
    };

    const scoringMap: Record<string, string> = {
      high_sensitivity: 'recall',
      high_precision: 'precision',
      balanced: 'f1',
    };

    const clinicalSearchConfig = {
      enabled: true,
      mode: 'random',
      n_iter: 10,
      cv_folds: 3,
      scoring: scoringMap[clinicalGoal],
      parameter_space: {
        n_estimators: '100, 150, 200',
        max_depth: '6, 10, 14',
        min_samples_leaf: '1, 2, 4',
        max_features: 'sqrt, log2',
      },
    };

    try {
      const response = await fetch(buildApiUrl('/models/train/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          model: 'rf',
          parameters: modelParams.rf,
          search_config: clinicalSearchConfig,
          pipeline_config: pipelineConfig,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.detail || 'Could not queue the clinical model optimisation.');
      }

      const data = await response.json();
      setTask(data.task_id, {
        taskId: data.task_id,
        model: 'rf',
        status: data.status,
        createdAt: data.created_at,
      });
      setRequestFreshSplit(false);
    } catch (error) {
      console.error(error);
      setQueueError(error instanceof Error ? error.message : 'The model could not be queued.');
      setPhase('selection');
    } finally {
      setQueueingModelId(null);
    }
  };

  const handleStopRemaining = async () => {
    const activeQueue = Object.values(useModelStore.getState().tasks).filter((task) =>
      ACTIVE_TASK_STATUSES.includes(task.status)
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

  const handleOpenResults = () => {
    if (!canOpenResults) return;
    if (activeTasks > 0) {
      setStopModalOpen(true);
      return;
    }
    setCurrentStep(5);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="card-clinical overflow-hidden">
        <div className="border-b border-clinical-100 bg-[radial-gradient(circle_at_top_left,_rgba(66,149,245,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(47,157,152,0.14),_transparent_34%),linear-gradient(180deg,_#ffffff,_#f4fbfb)] px-6 py-7">
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-ink-900">
            <Brain className="text-trust-600" size={26} />
            Step 4: Model Training Goal
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-600">
            Choose the clinical outcome you care about most, then let the assistant optimise the model queue around that goal.
          </p>
        </div>

        {userMode === 'clinical' ? (
          <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}> 
                {CLINICAL_GOALS.map((goal) => {
                  const Icon = goal.icon;
                  const active = clinicalGoal === goal.value;
                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => setClinicalGoal(goal.value)}
                      className={`rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card break-words min-w-[200px] flex-1 ${ 
                        active
                          ? goal.activeClasses
                          : 'border-ink-200 bg-white hover:border-clinical-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${active ? goal.iconClasses : 'bg-ink-100 text-ink-500'}`}>
                          <Icon size={20} />
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${goal.badgeClasses}`}>
                          {goal.subtitle}
                        </span>
                      </div>

                      <h3 className="mt-5 text-lg font-black tracking-tight text-ink-900">
                        {goal.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-ink-600">
                        {goal.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                <div className="card-clinical-muted p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-clinical-500 text-white">
                      <Compass size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-clinical-700">Optimization Strategy</p>
                      <p className="mt-3 text-sm leading-7 text-ink-600">
                        The clinical workflow uses automated Random Forest tuning with a scoring target matched to the selected goal. You do not need to manage hyperparameters manually.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-clinical p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-500">Training Status</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
                      <span className="text-sm font-semibold text-ink-700">Active runs</span>
                      <span className="text-lg font-black text-ink-900">{activeTasks}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
                      <span className="text-sm font-semibold text-ink-700">Finished runs</span>
                      <span className="text-lg font-black text-ink-900">{completedRuns}</span>
                    </div>
                    {phase === 'training' && (
                      <div className="rounded-xl border border-trust-200 bg-trust-50 px-4 py-3 text-sm text-trust-800">
                        Your model queue is active. Results will appear as soon as each optimisation run completes.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {queueError && (
                <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
                  {queueError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestFreshSplit((current) => !current)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    requestFreshSplit
                      ? 'bg-warning-100 text-warning-900'
                      : 'border border-ink-200 bg-white text-ink-700'
                  }`}
                >
                  {requestFreshSplit ? 'Fresh split on next run' : 'Reuse current split'}
                </button>

                <button
                  type="button"
                  onClick={() => void queueClinicalModel()}
                  disabled={queueingModelId !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-trust-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-trust-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {queueingModelId !== null ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  Start Clinical Optimisation
                </button>
              </div>
            </div>

            <TrainingQueuePanel
              catalogCount={3}
              onStopRemaining={() => { void handleStopRemaining(); }}
              onOpenResults={handleOpenResults}
              canOpenResults={canOpenResults}
            />
          </div>
        ) : (
          <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="card-clinical p-4">
                <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
                  {MODEL_ORDER.map((modelId) => {
                    const model = MODEL_CATALOG[modelId];
                    const isActive = activeVizModel === modelId;
                    return (
                      <button
                        key={modelId}
                        type="button"
                        onClick={() => setActiveVizModel(modelId)}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                          isActive
                            ? 'bg-trust-500 text-white shadow-soft'
                            : 'bg-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                        }`}
                      >
                        {model.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card-clinical p-6">
                <div className="flex items-center gap-2">
                  <Settings2 className="text-trust-500" size={18} />
                  <h3 className="text-sm font-bold text-ink-800">Current Model Setup</h3>
                </div>

                <div className="mt-4 rounded-2xl border border-clinical-100 bg-clinical-50 px-4 py-4">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${MODEL_CATALOG[activeVizModel].accent}`}>
                    {MODEL_CATALOG[activeVizModel].short}
                  </p>
                  <h4 className="mt-1 text-lg font-black tracking-tight text-ink-900">{MODEL_CATALOG[activeVizModel].name}</h4>
                  <p className="mt-2 text-sm leading-7 text-ink-600">{MODEL_CATALOG[activeVizModel].description}</p>
                </div>

                <div className="mt-4 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-bold text-ink-800">Holdout Split</p>
                      <p className="mt-1 text-xs leading-6 text-ink-500">
                        Reuse the same split for fair comparison. Turn on a fresh split only when you intentionally want a new holdout.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequestFreshSplit((current) => !current)}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        requestFreshSplit ? 'bg-warning-100 text-warning-900' : 'border border-ink-200 bg-white text-ink-700'
                      }`}
                    >
                      {requestFreshSplit ? 'Fresh next run' : 'Reuse current split'}
                    </button>
                  </div>
                </div>

                {queueError && (
                  <div className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
                    {queueError}
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <ModelParamsPanel model={activeVizModel} />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4">
                  <p className="text-sm text-ink-500">
                    {activeTasks} active run{activeTasks === 1 ? '' : 's'}, {completedRuns} finished
                  </p>
                  <button
                    type="button"
                    onClick={() => void queueModel(activeVizModel)}
                    disabled={queueingModelId === activeVizModel}
                    className="inline-flex items-center gap-2 rounded-xl bg-trust-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-trust-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {queueingModelId === activeVizModel ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
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
              onOpenResults={handleOpenResults}
              canOpenResults={canOpenResults}
            />
          </div>
        )}
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
