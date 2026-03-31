from __future__ import annotations

from copy import deepcopy

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

import app.services.model_training.dataset_builder as dataset_builder_module
from app.services.model_training.dataset_builder import TrainingDatasetBuilder
from app.services.session_service import session_service


def _seed_session(session_id: str, target_column: str = "target") -> None:
    session_service._sessions.pop(session_id, None)
    state = session_service.get_or_create(session_id)
    state.dataset = {
        "source": "upload",
        "file_name": "synthetic.csv",
        "target_column": target_column,
        "row_count": 0,
        "column_count": 0,
    }
    state.mapping = {
        "problem_type": "binary_classification",
        "target_column": target_column,
        "roles": {target_column: "target"},
    }
    state.mapping_validated = True
    state.preprocessing_result = {"ready": True}
    state.preprocessing = {"ready": True}
    state.training_split_cache = {}


def _base_pipeline_config(session_id: str, target_column: str = "target") -> dict:
    return {
        "session_id": session_id,
        "target_column": target_column,
        "problem_type": "classification",
        "excluded_columns": [],
        "basic_cleaning": {},
        "sampling": {},
        "data_split": {"enabled": False},
        "imputation": {},
        "outliers": {},
        "transformation": {},
        "encoding": {},
        "scaling": {},
        "dimensionality_reduction": {},
        "feature_selection": {},
        "imbalance": {},
    }


def test_scaling_uses_train_statistics_only(monkeypatch) -> None:
    session_id = "split-safe-scaling"
    _seed_session(session_id)

    row_ids = list(range(20))
    target = np.array([0, 1] * 10)
    _, test_ids = train_test_split(row_ids, train_size=0.8, stratify=target, random_state=42)

    values = np.arange(20, dtype=float)
    values[test_ids] = 1000.0
    df = pd.DataFrame({"x": values, "target": target})

    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    config = _base_pipeline_config(session_id)
    config["scaling"] = {"enabled": True, "strategies": {"x": "standard"}}

    data = TrainingDatasetBuilder().prepare(session_id, config)

    assert abs(float(data.X_train["x"].mean())) < 1e-9
    assert float(data.X_test["x"].mean()) > 100.0


def test_test_only_categories_do_not_leak_into_train_features(monkeypatch) -> None:
    session_id = "split-safe-categories"
    _seed_session(session_id)

    row_ids = list(range(20))
    target = np.array([0, 1] * 10)
    _, test_ids = train_test_split(row_ids, train_size=0.8, stratify=target, random_state=42)

    categories = np.array(["shared"] * 20, dtype=object)
    categories[test_ids[0]] = "test_only"
    df = pd.DataFrame({"signal": np.arange(20, dtype=float), "category": categories, "target": target})

    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    data = TrainingDatasetBuilder().prepare(session_id, _base_pipeline_config(session_id))

    assert "category_test_only" not in data.feature_names
    assert data.X_train.shape[1] == data.X_test.shape[1]


def test_identifier_like_high_cardinality_columns_are_dropped_from_training_features(monkeypatch) -> None:
    session_id = "split-safe-high-cardinality-id"
    _seed_session(session_id)

    df = pd.DataFrame(
        {
            "patient_id": [f"patient-{index:04d}" for index in range(40)],
            "signal": np.linspace(0, 1, 40),
            "target": [0, 1] * 20,
        }
    )
    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    data = TrainingDatasetBuilder().prepare(session_id, _base_pipeline_config(session_id))

    assert "patient_id" not in data.feature_names
    assert "signal" in data.feature_names


def test_split_reserves_one_example_per_class_for_training(monkeypatch) -> None:
    session_id = "split-safe-class-anchor"
    _seed_session(session_id)

    df = pd.DataFrame(
        {
            "feature": np.linspace(0, 1, 12),
            "target": ["common"] * 10 + ["rare_a", "rare_b"],
        }
    )
    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    data = TrainingDatasetBuilder().prepare(session_id, _base_pipeline_config(session_id))

    assert set(data.class_names) == {"common", "rare_a", "rare_b"}


def test_split_is_reused_until_force_resplit(monkeypatch) -> None:
    session_id = "split-cache-reuse"
    _seed_session(session_id)

    df = pd.DataFrame(
        {
            "x": np.linspace(0, 1, 40),
            "y": np.linspace(10, 50, 40),
            "target": [0, 1] * 20,
        }
    )
    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    real_split = dataset_builder_module.train_test_split
    split_calls = 0

    def counting_split(*args, **kwargs):
        nonlocal split_calls
        split_calls += 1
        return real_split(*args, **kwargs)

    monkeypatch.setattr(dataset_builder_module, "train_test_split", counting_split)

    builder = TrainingDatasetBuilder()
    config = _base_pipeline_config(session_id)

    builder.prepare(session_id, config)
    first_cache = deepcopy(session_service.get(session_id).training_split_cache)
    assert split_calls == 1

    config_with_scaling = deepcopy(config)
    config_with_scaling["scaling"] = {"enabled": True, "strategies": {"x": "standard"}}
    builder.prepare(session_id, config_with_scaling)
    second_cache = deepcopy(session_service.get(session_id).training_split_cache)

    assert split_calls == 1
    assert second_cache["train_row_ids"] == first_cache["train_row_ids"]
    assert second_cache["test_row_ids"] == first_cache["test_row_ids"]

    force_config = deepcopy(config)
    force_config["data_split"] = {"enabled": False, "force_resplit": True}
    builder.prepare(session_id, force_config)
    third_cache = deepcopy(session_service.get(session_id).training_split_cache)

    assert split_calls == 2
    assert int(third_cache["seed"]) == int(first_cache["seed"]) + 1
    assert third_cache["train_row_ids"] != first_cache["train_row_ids"]


def test_three_way_split_keeps_validation_set_separate(monkeypatch) -> None:
    session_id = "split-three-way-validation"
    _seed_session(session_id)

    df = pd.DataFrame(
        {
            "x": np.linspace(0, 1, 60),
            "y": np.linspace(10, 70, 60),
            "target": [0, 1] * 30,
        }
    )
    monkeypatch.setattr(dataset_builder_module, "load_dataframe", lambda _: df.copy())

    config = _base_pipeline_config(session_id)
    config["data_split"] = {
        "enabled": True,
        "strategy": "3-way",
        "train": 0.7,
        "val": 0.15,
        "test": 0.15,
        "stratify": True,
    }

    data = TrainingDatasetBuilder().prepare(session_id, config)

    assert data.selection_split == "validation"
    assert data.X_validation is not None
    assert data.y_validation is not None
    assert not data.X_validation.empty
    assert len(data.X_validation) == len(data.y_validation)
