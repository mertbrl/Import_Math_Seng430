import React, { useMemo, useState } from 'react';
import { Brain, Loader2, Play, Settings2 } from 'lucide-react';
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

const SESSION_ID = 'demo-session';
const ACTIVE_TASK_STATUSES: TaskStatus[] = ['queued', 'running', 'cancelling'];

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

  const [requestFreshSplit, setRequestFreshSplit] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [queueingModelId, setQueueingModelId] = useState<ModelId | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const queueItems = useMemo(() => Object.values(tasks), [tasks]);
  const activeTasks = queueItems.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length;
  const completedRuns = Object.keys(results).length;
  const canOpenResults = completedRuns > 0;

  const queueModel = async (model: ModelId) => {
    setQueueError(null);
    setQueueingModelId(model);
    setPhase('training');

    const pipelineConfig = buildPipelineConfig(SESSION_ID);
    pipelineConfig.data_split = {
      ...pipelineConfig.data_split,
      force_resplit: requestFreshSplit,
    };

    try {
      const response = await fetch(buildApiUrl('/models/train/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: SESSION_ID,
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

  const handleStopRemaining = async () => {
    const activeQueue = Object.values(useModelStore.getState().tasks).filter((task) =>
      ACTIVE_TASK_STATUSES.includes(task.status)
    );
    if (activeQueue.length === 0) {
      return;
    }

    try {
      await cancelTrainingTasks({
        session_id: SESSION_ID,
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
    if (!canOpenResults) {
      return;
    }
    if (activeTasks > 0) {
      setStopModalOpen(true);
      return;
    }
    setCurrentStep(5);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_36%),linear-gradient(180deg,_#ffffff,_#f8fafc)] px-6 py-6">
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
            <Brain className="text-indigo-600" size={26} />
            Step 4: Model Queue
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Choose a model, tune it, and send that exact run to the queue. You can keep stacking new runs while earlier ones are still training.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
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
                        ? 'bg-slate-900 text-white'
                        : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div className="space-y-5">
            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Settings2 className="text-indigo-500" size={17} />
                <h3 className="text-sm font-bold text-slate-800">Current Model Setup</h3>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${MODEL_CATALOG[activeVizModel].accent}`}>
                  {MODEL_CATALOG[activeVizModel].short}
                </p>
                <h4 className="mt-1 text-lg font-black tracking-tight text-slate-900">{MODEL_CATALOG[activeVizModel].name}</h4>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{MODEL_CATALOG[activeVizModel].description}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Holdout Split</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Reuse the same split for fair comparison. Turn on a fresh split only when you intentionally want a new holdout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequestFreshSplit((current) => !current)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      requestFreshSplit ? 'bg-amber-100 text-amber-800' : 'border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {requestFreshSplit ? 'Fresh next run' : 'Reuse current split'}
                  </button>
                </div>
              </div>

              {queueError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {queueError}
                </div>
              )}

              <div className="mt-5 space-y-4">
                <ModelParamsPanel model={activeVizModel} />
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">
                  {activeTasks} active run{activeTasks === 1 ? '' : 's'}, {completedRuns} finished
                </p>
                <button
                  type="button"
                  onClick={() => void queueModel(activeVizModel)}
                  disabled={queueingModelId === activeVizModel}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {queueingModelId === activeVizModel ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  Queue current run
                </button>
              </div>
            </div>
            </div>

            <div>
              <TrainingQueuePanel
                catalogCount={MODEL_ORDER.length}
                onStopRemaining={() => {
                  void handleStopRemaining();
                }}
                onOpenResults={handleOpenResults}
                canOpenResults={canOpenResults}
              />
            </div>
          </div>
        </div>
      </div>

      <WarningModal
        isOpen={stopModalOpen}
        title="Open Step 5 with current results?"
        message="Some model runs are still in progress. If you continue now, queued work will stop immediately and any run already finishing will be ignored as soon as it can exit safely."
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
