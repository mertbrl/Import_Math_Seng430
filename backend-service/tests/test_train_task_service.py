from __future__ import annotations

import threading
import time

from app.services.ddata_model.train_task_service import TrainTaskService
from app.services.model_training import TrainingCancelledError


def _result_payload(model: str) -> dict:
    return {
        "model_id": f"{model}-sklearn-v1",
        "model": model,
        "parameters": {"c": 1.0},
        "metrics": {"accuracy": 0.91, "f1_score": 0.9},
        "confusion_matrix": {"tn": 8, "fp": 1, "fn": 1, "tp": 10},
        "roc_curve": {"fpr": [0.0, 1.0], "tpr": [0.0, 1.0]},
        "feature_importance": [],
        "visualization": {},
    }


def _wait_for_status(service: TrainTaskService, task_id: str, statuses: set[str], timeout: float = 2.0) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        status = service.get(task_id).status
        if status in statuses:
            return status
        time.sleep(0.02)
    raise AssertionError(f"Task {task_id} did not reach {statuses}. Last status={service.get(task_id).status}")


def test_train_task_service_runs_jobs_in_parallel() -> None:
    service = TrainTaskService()
    started = threading.Barrier(2)
    release = threading.Event()
    entered: list[str] = []
    lock = threading.Lock()

    def fake_train(payload, *, should_cancel=None):  # noqa: ANN001
        with lock:
            entered.append(payload.algorithm)
        started.wait(timeout=1.0)
        release.wait(timeout=1.0)
        return _result_payload(payload.algorithm)

    service._training_service.train = fake_train  # type: ignore[method-assign]

    first = service.start("parallel-session", "lr", {"c": 1.0}, {}, {})
    second = service.start("parallel-session", "rf", {"n_estimators": 10}, {}, {})

    deadline = time.time() + 1.0
    while time.time() < deadline:
        with lock:
            if len(entered) == 2:
                break
        time.sleep(0.02)

    with lock:
        assert set(entered) == {"lr", "rf"}

    release.set()
    assert _wait_for_status(service, first.task_id, {"completed"}) == "completed"
    assert _wait_for_status(service, second.task_id, {"completed"}) == "completed"


def test_cancel_session_marks_running_task_cancelled_and_ignores_result() -> None:
    service = TrainTaskService()
    release = threading.Event()

    def fake_train(payload, *, should_cancel=None):  # noqa: ANN001
        while not release.is_set():
            if should_cancel and should_cancel():
                raise TrainingCancelledError("cancelled")
            time.sleep(0.02)
        return _result_payload(payload.algorithm)

    service._training_service.train = fake_train  # type: ignore[method-assign]

    task = service.start("cancel-session", "lr", {"c": 1.0}, {}, {})
    _wait_for_status(service, task.task_id, {"running", "cancelling"})

    response = service.cancel_session("cancel-session")
    release.set()

    assert task.task_id in response["cancelled_task_ids"]
    assert _wait_for_status(service, task.task_id, {"cancelled"}) == "cancelled"
    assert service.get(task.task_id).result is None
