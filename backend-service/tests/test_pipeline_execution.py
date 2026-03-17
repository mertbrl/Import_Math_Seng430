from io import StringIO
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_prep.pipeline_execution import apply_full_pipeline
from app.services.session_service import session_service

TEMP_SESSION_DIR = Path(__file__).resolve().parents[1] / "temp_sessions"


def _raw_dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "id": [1, 1, 2, 3, 4],
            "feature_a": [1.0, 1.0, None, 100.0, 4.0],
            "feature_b": [10.0, 10.0, 20.0, 30.0, 40.0],
            "constant": [7, 7, 7, 7, 7],
            "category": ["x", "x", "y", "y", "y"],
            "target": [0, 0, 0, 0, 1],
        }
    )


def _pipeline_config(session_id: str) -> dict[str, object]:
    return {
        "session_id": session_id,
        "target_column": "target",
        "problem_type": "classification",
        "excluded_columns": ["id", "target"],
        "basic_cleaning": {
            "drop_duplicates": True,
            "drop_zero_variance": True,
            "zero_variance_columns": ["constant"],
            "cast_to_numeric": [],
        },
        "imputation": {
            "enabled": True,
            "strategies": {"feature_a": "median"},
        },
        "outliers": {
            "enabled": True,
            "strategies": {"feature_a": "drop_rows"},
        },
        "encoding": {
            "enabled": True,
            "strategies": {"category": "onehot"},
        },
        "scaling": {
            "enabled": True,
            "strategies": {"feature_b": "minmax"},
        },
        "feature_selection": {
            "enabled": True,
            "method": "manual",
            "selected_features": ["feature_a", "feature_b", "category_y"],
        },
        "imbalance": {
            "enabled": True,
            "strategy": "smote",
        },
    }


def _seed_session(session_id: str) -> None:
    session_service._sessions.clear()
    state = session_service.get_or_create(session_id)
    state.dataset = {
        "source": "upload",
        "file_name": "uploaded.csv",
        "target_column": "target",
    }

    session_dir = TEMP_SESSION_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    _raw_dataframe().to_csv(session_dir / "raw.csv", index=False)


def test_apply_full_pipeline_executes_the_complete_recipe() -> None:
    processed = apply_full_pipeline(_raw_dataframe(), _pipeline_config("unit-pipeline"))

    assert list(processed.columns) == ["feature_a", "feature_b", "target", "category_y"]
    assert "id" not in processed.columns
    assert "constant" not in processed.columns
    assert processed["feature_a"].isna().sum() == 0
    assert processed["feature_b"].between(0, 1).all()
    assert processed["target"].value_counts().to_dict() == {0: 2, 1: 2}


def test_download_preprocessed_endpoint_uses_pipeline_config() -> None:
    session_id = "download-pipeline"
    _seed_session(session_id)

    client = TestClient(app)
    response = client.post(
        "/api/v1/download-preprocessed",
        json={"pipeline_config": _pipeline_config(session_id)},
    )

    assert response.status_code == 200
    downloaded = pd.read_csv(StringIO(response.text))

    assert list(downloaded.columns) == ["feature_a", "feature_b", "target", "category_y"]
    assert downloaded["target"].value_counts().to_dict() == {0: 2, 1: 2}


def test_feature_importance_endpoint_ranks_processed_columns() -> None:
    session_id = "feature-importance-pipeline"
    _seed_session(session_id)

    client = TestClient(app)
    response = client.post(
        "/api/v1/feature-importance-stats",
        json={
            "session_id": session_id,
            "target_column": "target",
            "pipeline_config": _pipeline_config(session_id),
        },
    )

    assert response.status_code == 200
    ranked_features = response.json()

    assert any(item["feature"] == "category_y" for item in ranked_features)


def test_imbalance_stats_endpoint_returns_dynamic_before_and_after_smote_distributions() -> None:
    session_id = "imbalance-preview-pipeline"
    _seed_session(session_id)

    client = TestClient(app)
    response = client.post(
        "/api/v1/imbalance-stats",
        json={
            "session_id": session_id,
            "target_column": "target",
            "pipeline_config": {
                **_pipeline_config(session_id),
                "imbalance": {"enabled": False, "strategy": "none"},
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["working_set"] == "train"
    assert payload["recommendation"] == "smote"
    assert payload["before_class_distribution"] == [
        {"class": "0", "count": 2, "percentage": 66.67},
        {"class": "1", "count": 1, "percentage": 33.33},
    ]
    assert payload["after_smote_distribution"] == [
        {"class": "0", "count": 2, "percentage": 50.0},
        {"class": "1", "count": 2, "percentage": 50.0},
    ]
