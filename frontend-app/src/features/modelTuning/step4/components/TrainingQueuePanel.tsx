import React, { useEffect, useMemo } from 'react';
import { Check, ClipboardList, Loader2, X } from 'lucide-react';
import { buildApiUrl } from '../../../../config/apiConfig';
import { getModelCatalogEntry } from '../../modelCatalog';
import { ModelId, TaskStatus, useModelStore } from '../../../../store/useModelStore';

const ACTIVE_TASK_STATUSES: TaskStatus[] = ['queued', 'running', 'cancelling'];
const FINAL_TASK_STATUSES: TaskStatus[] = ['completed', 'failed', 'cancelled'];

function getTaskSortRank(task: { status: TaskStatus }): number {
  if (task.status === 'running') return 0;
  if (task.status === 'queued') return 1;
  if (task.status === 'cancelling') return 2;
  if (task.status === 'completed') return 3;
  if (task.status === 'failed') return 4;
  return 5;
}

const TrainingQueueItem: React.FC<{ model: ModelId; taskId: string }> = ({ model, taskId }) => {
  const tasks = useModelStore((state) => state.tasks);
  const results = useModelStore((state) => state.results);
  const task = tasks[taskId];
  const result = results[taskId];
  const problemType = result?.problem_type ?? 'classification';
  const meta = getModelCatalogEntry(model, problemType);
  const status = task?.status ?? 'queued';

  const icon =
    status === 'completed' ? (
      <Check size={15} className="ha-step4-queue-icon-ok text-emerald-600" />
    ) : status === 'failed' || status === 'cancelled' ? (
      <X size={15} className="ha-step4-queue-icon-error text-rose-600" />
    ) : (
      <Loader2 size={15} className="ha-step4-queue-icon-progress animate-spin text-[var(--accent)]" />
    );

  return (
    <div className="ha-step4-queue-item flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="ha-step4-queue-item-name min-w-0 truncate text-sm font-semibold text-slate-700">{meta.name}</p>
      <span className="shrink-0">{icon}</span>
    </div>
  );
};

export const TrainingQueuePanel: React.FC<{
  catalogCount: number;
  onStopRemaining: () => void;
  emptyMessage?: string;
}> = ({ onStopRemaining, emptyMessage }) => {
  const tasks = useModelStore((state) => state.tasks);
  const setTask = useModelStore((state) => state.setTask);
  const setResult = useModelStore((state) => state.setResult);
  const queueItems = useMemo(() => Object.values(tasks), [tasks]);
  const activeTasks = queueItems.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).length;
  const hasFinishedHistory = queueItems.some((item) => FINAL_TASK_STATUSES.includes(item.status));
  const pollableTaskIds = useMemo(
    () => queueItems.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).map((item) => item.taskId),
    [queueItems],
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
            if (disposed) return;

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
                problem_type: data.result.problem_type,
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
            // Keep polling quiet while page is open.
          }
        }),
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
    <div className="ha-step4-queue-panel rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <h3 className="ha-step4-queue-title flex items-center gap-2 text-sm font-bold text-slate-800">
          <ClipboardList size={16} className="text-[var(--accent)]" />
          Queue
        </h3>
      </div>

      <div className="mt-4 space-y-2">
        {queueItems.length === 0 ? (
          <div className="ha-step4-queue-empty rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            {emptyMessage ?? 'No training run has started yet.'}
          </div>
        ) : (
          queueItems
            .sort((left, right) => {
              const rankDelta = getTaskSortRank(left) - getTaskSortRank(right);
              if (rankDelta !== 0) return rankDelta;
              return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            })
            .map((task) => <TrainingQueueItem key={task.taskId} model={task.model} taskId={task.taskId} />)
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {activeTasks > 0 && (
          <button
            type="button"
            onClick={onStopRemaining}
            className="ha-step4-queue-stop-btn rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Stop remaining
          </button>
        )}
      </div>
    </div>
  );
};

export default TrainingQueuePanel;
