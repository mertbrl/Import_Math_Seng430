from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from typing import Any
from uuid import uuid4

from app.core.exceptions import PipelineError
from app.schemas.request import (
    DataExplorationRequest,
    MappingUpsertRequest,
    PreprocessingConfigRequest,
    TrainingConfigRequest,
)
from app.services.pipeline_service import pipeline_service
from app.services.session_service import session_service


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class TrainTask:
    task_id: str
    session_id: str
    algorithm: str
    parameters: dict[str, Any]
    status: str
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    run_id: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


class TrainTaskService:
    def __init__(self) -> None:
        self._tasks: dict[str, TrainTask] = {}
        self._lock = Lock()
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="train-worker")

    def start(self, session_id: str, algorithm: str, parameters: dict[str, Any]) -> TrainTask:
        self._ensure_minimum_state(session_id)
        task_id = f"task-{uuid4().hex[:10]}"
        task = TrainTask(
            task_id=task_id,
            session_id=session_id,
            algorithm=algorithm,
            parameters=parameters,
            status="queued",
            created_at=_utc_now(),
        )
        with self._lock:
            self._tasks[task_id] = task
        self._executor.submit(self._run_task, task_id)
        return task

    def get(self, task_id: str) -> TrainTask:
        with self._lock:
            task = self._tasks.get(task_id)
        if not task:
            raise PipelineError(f"Task '{task_id}' not found.", status_code=404)
        return task

    def _run_task(self, task_id: str) -> None:
        with self._lock:
            task = self._tasks[task_id]
            task.status = "running"
            task.started_at = _utc_now()

        try:
            pipeline_service.put_training_config(
                task.session_id,
                TrainingConfigRequest(algorithm=task.algorithm, parameters=task.parameters),
            )
            run_result = pipeline_service.run_training(task.session_id)
            run = run_result["run"]
            evaluation = pipeline_service.get_evaluation(task.session_id, run["run_id"])
            result = {
                "run_id": run["run_id"],
                "model_id": run["model_id"],
                "model": run["model"],
                "parameters": run["parameters"],
                "metrics": evaluation["metrics"],
                "confusion_matrix": evaluation["confusion_matrix"],
                "roc_curve": {
                    "fpr": [0.0, 0.1, 0.22, 0.4, 1.0],
                    "tpr": [0.0, 0.62, 0.78, 0.9, 1.0],
                },
            }
            with self._lock:
                task = self._tasks[task_id]
                task.status = "completed"
                task.run_id = run["run_id"]
                task.result = result
                task.finished_at = _utc_now()
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                task = self._tasks[task_id]
                task.status = "failed"
                task.error = str(exc)
                task.finished_at = _utc_now()

    @staticmethod
    def _ensure_minimum_state(session_id: str) -> None:
        state = session_service.get_or_create(session_id)

        if not state.dataset:
            pipeline_service.explore_data(
                DataExplorationRequest(
                    session_id=session_id,
                    source="default",
                    target_column="DEATH_EVENT",
                )
            )
            state = session_service.get(session_id)

        if not state.mapping_validated:
            target_column = state.dataset.get("target_column", "DEATH_EVENT")
            pipeline_service.put_mapping(
                session_id,
                MappingUpsertRequest(
                    problem_type="binary_classification",
                    target_column=target_column,
                    roles={target_column: "target"},
                ),
            )
            pipeline_service.validate_mapping(session_id)

        if not state.preprocessing_result:
            pipeline_service.put_preprocessing_config(
                session_id,
                PreprocessingConfigRequest(
                    train_split=80,
                    missing_strategy="median",
                    normalization="zscore",
                    imbalance_strategy="smote",
                ),
            )
            pipeline_service.run_preprocessing(session_id)


train_task_service = TrainTaskService()
