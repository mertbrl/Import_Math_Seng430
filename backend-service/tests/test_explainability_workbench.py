import time

from fastapi.testclient import TestClient

from app.main import app
from app.services.session_service import session_service

CLIENT = TestClient(app)


def _seed_session(session_id: str) -> None:
    session_service._sessions.pop(session_id, None)
    state = session_service.get_or_create(session_id)
    state.dataset = {
        "source": "default",
        "file_name": "oncology-breast.csv",
        "target_column": "diagnosis",
        "row_count": 569,
        "column_count": 31,
    }
    state.mapping = {
        "problem_type": "binary_classification",
        "target_column": "diagnosis",
        "roles": {"diagnosis": "target"},
    }
    state.mapping_validated = True
    state.preprocessing_result = {"ready": True}
    state.preprocessing = {"ready": True}


def _pipeline_config(session_id: str) -> dict:
    return {
        "session_id": session_id,
        "target_column": "diagnosis",
        "problem_type": "classification",
        "excluded_columns": [],
        "basic_cleaning": {},
        "sampling": {},
        "data_split": {"enabled": True, "strategy": "2-way", "train": 0.8, "val": 0.0, "test": 0.2, "stratify": True},
        "imputation": {},
        "outliers": {},
        "transformation": {},
        "encoding": {},
        "scaling": {},
        "dimensionality_reduction": {},
        "feature_selection": {},
        "imbalance": {},
    }


def test_explainability_workbench_and_simulation_endpoints_return_dynamic_payload() -> None:
    session_id = "explainability-workbench"
    _seed_session(session_id)

    start = CLIENT.post(
        "/api/v1/models/train/start",
        json={
            "session_id": session_id,
            "model": "rf",
            "parameters": {"n_estimators": 60, "max_depth": 8},
            "pipeline_config": _pipeline_config(session_id),
        },
    )
    assert start.status_code == 200, start.text
    task_id = start.json()["task_id"]

    payload = None
    for _ in range(50):
        status = CLIENT.get(f"/api/v1/models/train/status/{task_id}")
        assert status.status_code == 200, status.text
        payload = status.json()
        if payload["status"] in {"completed", "failed"}:
            break
        time.sleep(0.1)

    assert payload is not None
    assert payload["status"] == "completed", payload

    run_id = payload["result"]["run_id"]
    workbench = CLIENT.post(
        "/api/v1/insights/explain/workbench",
        json={"session_id": session_id, "run_id": run_id},
    )
    assert workbench.status_code == 200, workbench.text

    workbench_payload = workbench.json()
    assert workbench_payload["summary"]["train_test_gap"] >= 0.0
    assert workbench_payload["summary"]["stability_score"] >= 0.0
    assert len(workbench_payload["global_explanation"]["features"]) > 0
    assert len(workbench_payload["simulator"]["control_features"]) > 0

    first_control = workbench_payload["simulator"]["control_features"][0]
    selected_scenario = workbench_payload["simulator"]["selected_scenario"]
    original_value = selected_scenario["feature_values"][first_control["feature"]]
    next_value = first_control["max"] if first_control["max"] != original_value else first_control["min"]

    simulate = CLIENT.post(
        "/api/v1/insights/explain/simulate",
        json={
            "session_id": session_id,
            "run_id": run_id,
            "record_id": selected_scenario["record_id"],
            "feature_overrides": {first_control["feature"]: next_value},
        },
    )
    assert simulate.status_code == 200, simulate.text

    simulation_payload = simulate.json()["scenario"]
    assert 0.0 <= simulation_payload["prediction"]["target_probability"] <= 1.0
    assert simulation_payload["feature_values"][first_control["feature"]] == next_value
    assert len(simulation_payload["local_explanation"]["top_features"]) > 0
