"""Manages model training tasks and lets the UI stop unfinished work safely."""

from __future__ import annotations

import logging
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

from app.core.exceptions import PipelineError
from app.schemas.request import TrainRequest
from app.services.explainability_service import explainability_service
from app.services.model_training import TrainingCancelledError
from app.services.session_service import session_service
from app.services.training_service import TrainingService

logger = logging.getLogger(__name__)

FINAL_TASK_STATUSES = {"completed", "failed", "cancelled"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TrainTask:
    task_id: str
    session_id: str
    algorithm: str
    parameters: dict[str, Any]
    search_config: dict[str, Any]
    pipeline_config: dict[str, Any]
    status: str
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    cancelled_at: str | None = None
    run_id: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    cancel_requested: bool = False


class TrainTaskService:
    def __init__(self) -> None:
        self._tasks: dict[str, TrainTask] = {}
        self._futures: dict[str, Future[None]] = {}
        self._lock = Lock()
        self._executor = ThreadPoolExecutor(max_workers=6, thread_name_prefix="train-worker")
        self._training_service = TrainingService()

    def start(
        self,
        session_id: str,
        algorithm: str,
        parameters: dict[str, Any],
        search_config: dict[str, Any],
        pipeline_config: dict[str, Any] | None = None,
    ) -> TrainTask:
        task_id = f"task-{uuid4().hex[:10]}"
        task = TrainTask(
            task_id=task_id,
            session_id=session_id,
            algorithm=algorithm,
            parameters=parameters,
            search_config=search_config,
            pipeline_config=pipeline_config or {},
            status="queued",
            created_at=_utc_now(),
        )
        with self._lock:
            self._tasks[task_id] = task
        future = self._executor.submit(self._run_task, task_id)
        with self._lock:
            self._futures[task_id] = future
        logger.info("Queued training for %s (%s)", algorithm.upper(), task_id)
        return task

    def get(self, task_id: str) -> TrainTask:
        with self._lock:
            task = self._tasks.get(task_id)
        if not task:
            raise PipelineError(f"Task '{task_id}' not found.", status_code=404)
        return task

    def cancel(self, task_id: str) -> TrainTask:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                raise PipelineError(f"Task '{task_id}' not found.", status_code=404)

            if task.status in FINAL_TASK_STATUSES:
                return task

            task.cancel_requested = True
            future = self._futures.get(task_id)
            if task.status == "queued" and future is not None and future.cancel():
                self._finalize_cancelled(task)
            elif task.status == "queued":
                task.status = "cancelling"
            elif task.status == "running":
                task.status = "cancelling"
            return task

    def cancel_session(self, session_id: str, task_ids: list[str] | None = None) -> dict[str, Any]:
        with self._lock:
            candidate_tasks = [
                task
                for task in self._tasks.values()
                if task.session_id == session_id and task.status not in FINAL_TASK_STATUSES
            ]
            if task_ids:
                allowed = set(task_ids)
                candidate_tasks = [task for task in candidate_tasks if task.task_id in allowed]

        cancelled_tasks: list[TrainTask] = []
        for task in candidate_tasks:
            cancelled_tasks.append(self.cancel(task.task_id))

        return {
            "session_id": session_id,
            "cancelled_task_ids": [task.task_id for task in cancelled_tasks],
            "remaining_active": self._active_task_count(session_id),
        }

    def _active_task_count(self, session_id: str) -> int:
        with self._lock:
            return sum(
                1
                for task in self._tasks.values()
                if task.session_id == session_id and task.status not in FINAL_TASK_STATUSES
            )

    def _run_task(self, task_id: str) -> None:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return
            if task.cancel_requested:
                self._finalize_cancelled(task)
                return
            task.status = "running"
            task.started_at = _utc_now()

        try:
            request = TrainRequest(
                session_id=task.session_id,
                algorithm=task.algorithm,
                parameters=task.parameters,
                search_config=task.search_config,
                pipeline_config=task.pipeline_config,
            )
            result = self._training_service.train(
                request,
                should_cancel=lambda: self._is_cancel_requested(task_id),
            )

            with self._lock:
                task = self._tasks.get(task_id)
                if task is None:
                    return
                if task.cancel_requested:
                    self._finalize_cancelled(task)
                    return

            self._store_success(task_id, result)
        except TrainingCancelledError:
            with self._lock:
                task = self._tasks.get(task_id)
                if task is not None:
                    self._finalize_cancelled(task)
        except Exception as exc:  # noqa: BLE001
            logger.error("Training failed for %s: %s", task_id, exc)
            with self._lock:
                task = self._tasks.get(task_id)
                if task is None:
                    return
                if task.cancel_requested:
                    self._finalize_cancelled(task)
                    return
                task.status = "failed"
                task.error = str(exc)
                task.finished_at = _utc_now()

    def _store_success(self, task_id: str, result: dict[str, Any]) -> None:
        artifacts = result.pop("_artifacts", None)
        final_metrics = result.get("test_metrics") or result["metrics"]
        final_confusion_matrix = result.get("test_confusion_matrix") or result["confusion_matrix"]
        final_roc_curve = result.get("test_roc_curve") or result.get("roc_curve", {})

        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return
            if task.cancel_requested:
                self._finalize_cancelled(task)
                return

            run_id = f"run-{task.algorithm}-{task.task_id[-6:]}"
            resolved_model_id = f"{result['model_id']}-{run_id}"
            task.run_id = run_id

        task_result = {
            "run_id": run_id,
            "model_id": resolved_model_id,
            "model": result["model"],
            "parameters": result["parameters"],
            "metrics": result["metrics"],
            "confusion_matrix": result["confusion_matrix"],
            "roc_curve": result.get("roc_curve", {}),
            "feature_importance": result.get("feature_importance", []),
            "feature_importance_source": result.get("feature_importance_source"),
            "visualization": result.get("visualization", {}),
            "evaluation_split": result.get("evaluation_split", "test"),
            "search": result.get("search", {}),
            "train_metrics": result.get("train_metrics"),
            "test_metrics": result.get("test_metrics"),
            "test_confusion_matrix": result.get("test_confusion_matrix"),
            "test_roc_curve": result.get("test_roc_curve"),
            "test_visualization": result.get("test_visualization"),
        }

        state = session_service.get_or_create(task.session_id)
        evaluation = {
            "session_id": task.session_id,
            "run_id": run_id,
            "dataset_version": state.dataset_version,
            "metrics": final_metrics,
            "confusion_matrix": final_confusion_matrix,
            "roc_curve": final_roc_curve,
            "feature_importance": result.get("feature_importance", []),
        }
        run = {
            "run_id": run_id,
            "model_id": resolved_model_id,
            "model": result["model"],
            "parameters": result["parameters"],
            "dataset_version": state.dataset_version,
            "pipeline_revision": state.pipeline_revision,
        }
        state.training_runs[run_id] = run
        state.active_run_id = run_id
        state.training = run
        state.evaluations[run_id] = evaluation
        state.evaluation = evaluation
        session_service.touch(state, bump_revision=False)

        if artifacts:
            visualization = result.get("test_visualization") or result.get("visualization") or {}
            try:
                explainability_service.register_training_artifacts(
                    session_id=task.session_id,
                    run_id=run_id,
                    model_id=resolved_model_id,
                    algorithm=result["model"],
                    estimator=artifacts["estimator"],
                    data=artifacts["data"],
                    search_summary=result.get("search"),
                    train_metrics=result.get("train_metrics"),
                    final_metrics=final_metrics,
                    generalization=visualization.get("generalization"),
                    feature_importance=result.get("feature_importance"),
                    feature_importance_source=result.get("feature_importance_source"),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Explainability cache build failed for %s: %s", run_id, exc)

        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return
            if task.cancel_requested:
                self._finalize_cancelled(task)
                return
            task.status = "completed"
            task.result = task_result
            task.finished_at = _utc_now()
            task.error = None

    def _is_cancel_requested(self, task_id: str) -> bool:
        with self._lock:
            task = self._tasks.get(task_id)
            return bool(task and task.cancel_requested)

    def _finalize_cancelled(self, task: TrainTask) -> None:
        task.status = "cancelled"
        task.result = None
        task.error = None
        task.cancelled_at = _utc_now()
        task.finished_at = task.cancelled_at


train_task_service = TrainTaskService()
