import time

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

import app.services.model_training.dataset_builder as dataset_builder_module
from app.main import app
from app.schemas.request import TrainRequest
from app.services.model_training import sanitize_search_config
from app.services.session_service import session_service
from app.services.training_service import TrainingService

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


def _regression_pipeline_config(session_id: str) -> dict:
    return {
        "session_id": session_id,
        "target_column": "target_value",
        "problem_type": "regression",
        "excluded_columns": [],
        "basic_cleaning": {},
        "sampling": {},
        "data_split": {"enabled": True, "strategy": "2-way", "train": 0.8, "val": 0.0, "test": 0.2, "stratify": False},
        "imputation": {},
        "outliers": {},
        "transformation": {},
        "encoding": {},
        "scaling": {},
        "dimensionality_reduction": {},
        "feature_selection": {},
        "imbalance": {},
    }


def test_training_service_returns_real_metrics_and_feature_importance() -> None:
    session_id = "real-train-rf"
    _seed_session(session_id)

    result = TrainingService().train(
        TrainRequest(
            session_id=session_id,
            algorithm="rf",
            parameters={"n_estimators": 80, "max_depth": 8},
            pipeline_config=_pipeline_config(session_id),
        )
    )

    assert result["model_id"] == "rf-sklearn-v1"
    assert 0.0 <= float(result["metrics"]["accuracy"]) <= 1.0
    assert {"tn", "fp", "fn", "tp"} == set(result["confusion_matrix"].keys())
    assert len(result["feature_importance"]) > 0


def test_train_endpoint_completes_with_metrics_payload() -> None:
    session_id = "real-train-endpoint"
    _seed_session(session_id)

    start = CLIENT.post(
        "/api/v1/models/train/start",
        json={
            "session_id": session_id,
            "model": "lr",
            "parameters": {"c": 1.2, "max_iter": 800},
            "pipeline_config": _pipeline_config(session_id),
        },
    )
    assert start.status_code == 200, start.text

    task_id = start.json()["task_id"]
    latest = None

    for _ in range(40):
        latest = CLIENT.get(f"/api/v1/models/train/status/{task_id}")
        assert latest.status_code == 200, latest.text
        if latest.json()["status"] in {"completed", "failed"}:
            break
        time.sleep(0.1)

    assert latest is not None
    payload = latest.json()
    assert payload["status"] == "completed", payload
    assert 0.0 <= float(payload["result"]["metrics"]["accuracy"]) <= 1.0
    assert payload["result"]["parameters"]["max_iter"] == 800


def test_training_service_returns_validation_and_test_metrics_for_three_way_split() -> None:
    session_id = "real-train-three-way"
    _seed_session(session_id)
    config = _pipeline_config(session_id)
    config["data_split"] = {
        "enabled": True,
        "strategy": "3-way",
        "train": 0.7,
        "val": 0.15,
        "test": 0.15,
        "stratify": True,
    }

    result = TrainingService().train(
        TrainRequest(
            session_id=session_id,
            algorithm="rf",
            parameters={"n_estimators": 60, "max_depth": 6},
            pipeline_config=config,
        )
    )

    assert result["evaluation_split"] == "validation"
    assert 0.0 <= float(result["metrics"]["accuracy"]) <= 1.0
    assert 0.0 <= float(result["test_metrics"]["accuracy"]) <= 1.0
    assert {"tn", "fp", "fn", "tp"} == set(result["test_confusion_matrix"].keys())


def test_training_service_supports_grid_search_and_visualization_payload() -> None:
    session_id = "real-train-grid-search"
    _seed_session(session_id)

    result = TrainingService().train(
        TrainRequest(
            session_id=session_id,
            algorithm="lr",
            parameters={"c": 1.0, "max_iter": 1000, "class_weight": "none"},
            search_config={
                "enabled": True,
                "cv_folds": 4,
                "scoring": "auto",
                "parameter_space": {
                    "c": "0.25,1,4",
                    "max_iter": "500,1000,2000",
                    "class_weight": "none,balanced",
                },
            },
            pipeline_config=_pipeline_config(session_id),
        )
    )

    assert result["search"]["enabled"] is True
    assert result["search"]["mode"] == "custom"
    assert result["search"]["cv_folds"] == 4
    assert result["search"]["candidate_count"] >= 2
    assert result["search"]["best_score"] is not None
    assert "c" in result["search"]["parameter_space"]
    assert result["visualization"]["split_summary"]["train_rows"] > 0
    assert result["visualization"]["projection"]["method"] == "pca_train_fit"
    assert len(result["visualization"]["projection"]["explained_variance"]) == 2
    assert result["visualization"]["projection"]["sample_size"] > 0
    assert any(abs(point["x"]) > 0.000001 or abs(point["y"]) > 0.000001 for point in result["visualization"]["projection"]["points"])
    assert len(result["visualization"]["per_class_metrics"]) == 2


def test_sanitize_search_config_parses_custom_ranges() -> None:
    config = sanitize_search_config(
        "xgb",
        {
            "enabled": True,
            "cv_folds": 5,
            "scoring": "roc_auc",
            "parameter_space": {
                "n_estimators": "100:300:100",
                "learning_rate": "0.05,0.1,0.2",
                "subsample": "0.7:0.9:0.1",
            },
        },
    )

    assert config["mode"] == "custom"
    assert config["parameter_space"]["n_estimators"] == [100, 200, 300]
    assert config["parameter_space"]["learning_rate"] == [0.05, 0.1, 0.2]
    assert config["parameter_space"]["subsample"] == [0.7, 0.8, 0.9]


def test_training_service_supports_regression_models(monkeypatch) -> None:
    session_id = "real-train-regression"
    session_service._sessions.pop(session_id, None)
    state = session_service.get_or_create(session_id)
    state.dataset = {
        "source": "upload",
        "file_name": "synthetic-regression.csv",
        "target_column": "target_value",
        "row_count": 120,
        "column_count": 4,
    }
    state.mapping = {
        "problem_type": "regression",
        "target_column": "target_value",
        "roles": {"target_value": "target"},
    }
    state.mapping_validated = True
    state.preprocessing_result = {"ready": True}
    state.preprocessing = {"ready": True}

    df = pd.DataFrame(
        {
            "feature_a": np.linspace(0, 10, 120),
            "feature_b": np.sin(np.linspace(0, 8, 120)),
            "feature_c": np.tile([0, 1, 2], 40),
        }
    )
    df["target_value"] = 4.5 * df["feature_a"] - 2.0 * df["feature_b"] + 1.2 * df["feature_c"]
    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    result = TrainingService().train(
        TrainRequest(
            session_id=session_id,
            algorithm="lr",
            parameters={"fit_intercept": True},
            pipeline_config=_regression_pipeline_config(session_id),
        )
    )

    assert result["problem_type"] == "regression"
    assert result["metrics"]["rmse"] is not None
    assert result["metrics"]["mae"] is not None
    assert result["metrics"]["r2"] is not None
    assert result["confusion_matrix"] == {}
