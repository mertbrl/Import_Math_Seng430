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


def test_apply_full_pipeline_supports_structured_outlier_rules_without_dropping_rows() -> None:
    config = {
        "session_id": "unit-structured-outliers",
        "target_column": "target",
        "problem_type": "classification",
        "excluded_columns": ["id"],
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
            "strategies": {
                "feature_a": {"detector": "iqr", "treatment": "cap_1_99"},
            },
        },
    }

    processed = apply_full_pipeline(_raw_dataframe(), config, stop_before="transformation")

    assert len(processed) == 4
    assert processed["feature_a"].max() < 100.0


def test_apply_full_pipeline_respects_protected_features_during_iterative_vif_drop() -> None:
    df = pd.DataFrame(
        {
            "x1": [1, 2, 3, 4, 5, 6, 7, 8],
            "x2": [2, 4, 6, 8, 10, 12, 14, 16],
            "x3": [1, 1, 2, 3, 5, 8, 13, 21],
            "target": [0, 1, 0, 1, 0, 1, 0, 1],
        }
    )

    config = {
        "session_id": "protected-vif",
        "target_column": "target",
        "problem_type": "classification",
        "dimensionality_reduction": {
            "enabled": True,
            "actions": {"x1": "keep"},
            "use_pca": False,
            "pca_variance": 95,
        },
    }

    processed = apply_full_pipeline(df, config, stop_before="feature_selection")

    assert "x1" in processed.columns
    assert "x2" not in processed.columns


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
    assert payload["recommendation"] is None
    assert payload["recommended_algorithm"] == "none"
    assert payload["before_class_distribution"] == [
        {"class": "0", "count": 2, "percentage": 66.67},
        {"class": "1", "count": 1, "percentage": 33.33},
    ]
    assert payload["after_smote_distribution"] == [
        {"class": "0", "count": 2, "percentage": 50.0},
        {"class": "1", "count": 2, "percentage": 50.0},
    ]


def test_imbalance_stats_endpoint_resolves_mismatched_target_name_for_default_dataset() -> None:
    session_service._sessions.clear()
    state = session_service.get_or_create("breast-imbalance")
    state.dataset = {
        "source": "default",
        "file_name": "oncology-breast.csv",
        "target_column": "diagnosis",
    }

    client = TestClient(app)
    response = client.post(
        "/api/v1/imbalance-stats",
        json={
            "session_id": "breast-imbalance",
            "target_column": "diagnosis",
            "pipeline_config": {
                "session_id": "breast-imbalance",
                "target_column": "diagnosis",
                "problem_type": "classification",
                "feature_selection": {
                    "enabled": True,
                    "method": "manual",
                    "selected_features": ["radius_mean", "texture_mean"],
                },
                "imbalance": {"enabled": False, "strategy": "none"},
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["working_set"] == "train"
    assert payload["class_distribution"]


def test_preprocessing_review_endpoint_returns_before_and_after_eda_views() -> None:
    session_id = "preprocessing-review-pipeline"
    _seed_session(session_id)

    client = TestClient(app)
    response = client.post(
        "/api/v1/preprocessing-review",
        json={"pipeline_config": _pipeline_config(session_id)},
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["beforeShape"] == [5, 5]
    assert payload["afterShape"] == [4, 4]
    assert payload["removedColumns"] == ["constant", "category"]
    assert payload["addedColumns"] == ["category_y"]
    assert "constant" in payload["before"]["preview"]["headers"]
    assert "category" in payload["before"]["preview"]["headers"]
    assert "constant" not in payload["after"]["preview"]["headers"]
    assert "category" not in payload["after"]["preview"]["headers"]
    assert "category_y" in payload["after"]["preview"]["headers"]
