"""
Sprint 3 – Performance timing tests.
Verifies that all 6 model training calls complete within 3 000 ms
as required by the Sprint 3 acceptance criteria.
"""
import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.session_service import session_service

CLIENT = TestClient(app)
ALGORITHMS = ["knn", "svm", "dt", "rf", "lr", "nb"]
MAX_TRAIN_MS = 3_000


def _make_session(session_id: str) -> None:
    """Seed a minimal session so training can run."""
    session_service._sessions.pop(session_id, None)
    state = session_service.get_or_create(session_id)
    state.dataset = {
        "source": "default",
        "file_name": "oncology-breast.csv",
        "target_column": "diagnosis",
        "row_count": 569,
        "column_count": 30,
    }
    state.mapping = {
        "problem_type": "classification",
        "target_column": "diagnosis",
        "roles": {},
    }
    state.mapping_validated = True
    state.preprocessing_result = {"steps": ["scaled"]}
    state.preprocessing = {"steps": ["scaled"]}


@pytest.mark.parametrize("algo", ALGORITHMS)
def test_training_latency_under_3000ms(algo: str) -> None:
    """POST /api/v1/models/train/start must return within 3 000 ms for each algorithm."""
    session_id = f"perf-test-{algo}"
    _make_session(session_id)

    start = time.monotonic()
    response = CLIENT.post(
        "/api/v1/models/train/start",
        json={"session_id": session_id, "model": algo, "parameters": {}},
    )
    elapsed_ms = (time.monotonic() - start) * 1000

    assert response.status_code == 200, f"Expected 200 for {algo}, got {response.status_code}: {response.text}"
    assert elapsed_ms < MAX_TRAIN_MS, (
        f"{algo} training took {elapsed_ms:.1f} ms which exceeds the {MAX_TRAIN_MS} ms threshold"
    )


def test_all_six_models_train_successfully() -> None:
    """Smoke test: every algorithm must train and return a task_id."""
    for algo in ALGORITHMS:
        session_id = f"smoke-{algo}"
        _make_session(session_id)
        response = CLIENT.post(
            "/api/v1/models/train/start",
            json={"session_id": session_id, "model": algo, "parameters": {}},
        )
        assert response.status_code == 200, f"{algo} failed: {response.text}"
        data = response.json()
        assert "task_id" in data or "status" in data, f"No task_id in response for {algo}"
