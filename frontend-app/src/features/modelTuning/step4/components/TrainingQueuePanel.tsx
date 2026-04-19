import React, { useEffect, useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { buildApiUrl } from '../../../../config/apiConfig';
import { MODEL_CATALOG } from '../../modelCatalog';
import { ModelId, ModelResult, TaskStatus, useModelStore } from '../../../../store/useModelStore';

const ACTIVE_TASK_STATUSES: TaskStatus[] = ['queued', 'running', 'cancelling'];
const FINAL_TASK_STATUSES: TaskStatus[] = ['completed', 'failed', 'cancelled'];

function formatPercent(value?: number | null): string {
  if (value == null) {
    return 'N/A';
  }
  return `${(value * 100).toFixed(1)}%`;
}

const TrainingQueueItem: React.FC<{ model: ModelId; taskId: string }> = ({ model, taskId }) => {
  const tasks = useModelStore((state) => state.tasks);
  const results = useModelStore((state) => state.results);
  const task = tasks[taskId];
  const result = results[taskId] as ModelResult | undefined;
  const meta = MODEL_CATALOG[model];

  const status = task?.status ?? 'queued';
  const statusLabel: Record<TaskStatus, string> = {
    queued: 'Waiting',
    running: 'Training',
    cancelling: 'Stopping',
    cancelled: 'Stopped',
    completed: 'Done',
    failed: 'Failed',
  };
  const statusTone: Record<TaskStatus, string> = {
    queued: 'bg-slate-100 text-slate-700',
    running: 'bg-indigo-100 text-indigo-700',
    cancelling: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-slate-200 text-slate-700',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
  };

  const progressTone =
    status === 'completed'
      ? 'bg-emerald-500 w-full'
      : status === 'failed'
      ? 'bg-rose-500 w-full'
      : status === 'cancelled'
      ? 'bg-slate-400 w-full'
      : status === 'cancelling'
      ? 'bg-amber-500 w-3/4 animate-pulse'
      : 'bg-indigo-500 w-3/4 animate-pulse';

  return (
    <div className={`rounded-2xl border p-4 ${meta.soft}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-bold ${meta.accent}`}>{meta.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {status === 'completed' && result
              ? `Ready for Step 5, F1 ${formatPercent((result.test_metrics ?? result.metrics).f1_score)}, Accuracy ${formatPercent((result.test_metrics ?? result.metrics).accuracy)}`
              : status === 'failed'
              ? task?.error || 'Training could not finish.'
              : status === 'cancelled'
              ? 'This run was stopped before being used.'
              : status === 'cancelling'
              ? 'Stop requested. This run will be ignored as soon as it exits safely.'
              : 'Queued in the training list.'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[status]}`}>{statusLabel[status]}</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/70">
        <div className={`h-full rounded-full transition-all duration-700 ${progressTone}`} />
      </div>
    </div>
  );
};

export const TrainingQueuePanel: React.FC<{
  catalogCount: number;
  onStopRemaining: () => void;
  onOpenResults: () => void;
  canOpenResults: boolean;
}> = ({ catalogCount, onStopRemaining, onOpenResults, canOpenResults }) => {
  const tasks = useModelStore((state) => state.tasks);
  const results = useModelStore((state) => state.results);
  const setTask = useModelStore((state) => state.setTask);
  const setResult = useModelStore((state) => state.setResult);
  const clearFinishedHistory = useModelStore((state) => state.clearFinishedHistory);
  const queueItems = useMemo(() => Object.values(tasks), [tasks]);
  const activeTasks = queueItems.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).length;
  const completedRuns = Object.keys(results).length;
  const hasFinishedHistory = queueItems.some((item) => FINAL_TASK_STATUSES.includes(item.status));
  const pollableTaskIds = useMemo(
    () => queueItems.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).map((item) => item.taskId),
    [queueItems]
  );

  const summary = useMemo(
    () => ({
      waiting: queueItems.filter((item) => item.status === 'queued').length,
      training: queueItems.filter((item) => item.status === 'running').length,
      stopping: queueItems.filter((item) => item.status === 'cancelling').length,
      done: queueItems.filter((item) => item.status === 'completed').length,
      stopped: queueItems.filter((item) => item.status === 'cancelled').length,
      failed: queueItems.filter((item) => item.status === 'failed').length,
    }),
    [queueItems]
  );

  useEffect(() => {
    if (pollableTaskIds.length === 0) {
      return;
    }

    let disposed = false;
    const pollActiveTasks = async () => {
      const latestTasks = useModelStore.getState().tasks;
      const activeItems = pollableTaskIds
        .map((taskId) => latestTasks[taskId])
        .filter((task): task is NonNullable<typeof task> => Boolean(task));

      await Promise.all(
        activeItems.map(async (task) => {
          try {
            const response = await fetch(buildApiUrl(`/models/train/status/${task.taskId}`));
            const data = await response.json();
            if (disposed) {
              return;
            }

            setTask(task.taskId, {
              taskId: task.taskId,
              model: task.model,
              status: data.status,
              createdAt: data.created_at,
              startedAt: data.started_at,
              finishedAt: data.finished_at,
              error: data.error,
            });

            if (data.status === 'completed' && data.result) {
              setResult(task.taskId, {
                runId: data.result.run_id,
                modelId: data.result.model_id,
                model: task.model,
                taskId: task.taskId,
                metrics: data.result.metrics ?? {},
                confusion_matrix: data.result.confusion_matrix ?? {},
                evaluation_split: data.result.evaluation_split ?? 'test',
                search: data.result.search,
                visualization: data.result.visualization,
                train_metrics: data.result.train_metrics,
                test_metrics: data.result.test_metrics,
                test_confusion_matrix: data.result.test_confusion_matrix,
                test_roc_curve: data.result.test_roc_curve,
                test_visualization: data.result.test_visualization,
                roc_curve: data.result.roc_curve,
                feature_importance: data.result.feature_importance,
                feature_importance_source: data.result.feature_importance_source,
                parameters: data.result.parameters ?? {},
              });
            }
          } catch {
            // Polling stays tolerant while the page is open.
          }
        })
      );
    };

    void pollActiveTasks();
    const intervalId = setInterval(() => {
      void pollActiveTasks();
    }, 1200);

    return () => {
      disposed = true;
      clearInterval(intervalId);
    };
  }, [pollableTaskIds, setResult, setTask]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <ClipboardList size={16} className="text-indigo-500" />
            Training Queue
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Add the models you want to try, let them run in the background, then open Step 5 when you are ready to compare results.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {hasFinishedHistory && (
            <button
              type="button"
              onClick={clearFinishedHistory}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Clear finished
            </button>
          )}
          {activeTasks > 0 && (
            <button
              type="button"
              onClick={onStopRemaining}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Stop remaining
            </button>
          )}
          <button
            type="button"
            disabled={!canOpenResults}
            onClick={onOpenResults}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open Step 5
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3"> 
        {[
          { label: 'Models', value: catalogCount },
          { label: 'Waiting', value: summary.waiting },
          { label: 'Training', value: summary.training },
          { label: 'Stopping', value: summary.stopping },
          { label: 'Done', value: summary.done },
          { label: 'Stopped/Failed', value: summary.stopped + summary.failed },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 flex-1 min-w-[60px] text-center"> 
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-ellipsis whitespace-nowrap overflow-hidden">{item.label}</p> 
            <p className="mt-1 text-2xl font-black text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      {queueItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
          The queue is empty. Pick one or more models on the left, then start training.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {queueItems
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
            .map((task) => (
              <TrainingQueueItem key={task.taskId} model={task.model} taskId={task.taskId} />
            ))}
        </div>
      )}

      {completedRuns > 0 && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {completedRuns} finished run{completedRuns === 1 ? '' : 's'} already reached Step 5. You can keep waiting, or open results now.
        </div>
      )}
    </div>
  );
};

export default TrainingQueuePanel;
