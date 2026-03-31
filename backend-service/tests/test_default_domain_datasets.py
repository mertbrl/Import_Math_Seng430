from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.services.data_prep.step01_basic_cleaning import calculate_basic_cleaning_stats
from app.services.data_prep.step04_imputation import calculate_missing_statistics
from app.services.data_prep.step05_outliers import calculate_outlier_statistics
from app.services.model_training.dataset_builder import TrainingDatasetBuilder
from app.services.session_service import session_service

DATASET_TARGETS: list[tuple[str, str]] = [
    ("cardiology-arrhythmia.csv", "Class"),
    ("cardiology-readmission.csv", "DEATH_EVENT"),
    ("cardiology-stroke.csv", "stroke"),
    ("dermatology-skin-lesion.csv", "dx_type"),
    ("endocrinology-diabetes.csv", "Outcome"),
    ("haematology-anaemia.csv", "Result"),
    ("hepatology-liver.csv", "Selector"),
    ("mental-health-depression.csv", "severity_class"),
    ("nephrology-ckd.csv", "classification"),
    ("neurology-parkinsons.csv", "status"),
    ("obstetrics-fetal-health.csv", "fetal_health"),
    ("oncology-breast.csv", "Diagnosis"),
    ("oncology-cervical.csv", "Biopsy"),
    ("ophthalmology-retinopathy.csv", "class"),
    ("orthopaedics-spine.csv", "class"),
    ("pharmacy-readmission.csv", "readmitted"),
    ("pulmonology-copd.csv", "class"),
    ("radiology-pneumonia.csv", "Finding Labels"),
    ("thyroid-endocrinology.csv", "target"),
]

CORE_DATASETS_DIR = Path(__file__).resolve().parent.parent / "core_datasets"


def _seed_default_session(session_id: str, file_name: str, target_column: str, problem_type: str) -> None:
    session_service._sessions.pop(session_id, None)
    state = session_service.get_or_create(session_id)
    df = pd.read_csv(CORE_DATASETS_DIR / file_name)
    state.dataset = {
        "source": "default",
        "file_name": file_name,
        "target_column": target_column,
        "row_count": len(df),
        "column_count": len(df.columns),
        "column_names": df.columns.tolist(),
    }
    state.mapping = {
        "problem_type": "multi_class_classification" if problem_type == "multiclass" else "binary_classification",
        "target_column": target_column,
        "roles": {target_column: "target"},
    }
    state.mapping_validated = True
    state.preprocessing_result = {"ready": True}
    state.preprocessing = {"ready": True}
    state.training_split_cache = {}


def _minimal_pipeline_config(session_id: str, target_column: str, problem_type: str) -> dict:
    return {
        "session_id": session_id,
        "target_column": target_column,
        "problem_type": problem_type,
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


def _infer_problem_type(file_name: str, target_column: str) -> str:
    df = pd.read_csv(CORE_DATASETS_DIR / file_name)
    unique_values = df[target_column].dropna().astype(str).nunique()
    return "multiclass" if unique_values > 2 else "classification"


def test_all_default_domain_targets_exist() -> None:
    for file_name, target_column in DATASET_TARGETS:
        df = pd.read_csv(CORE_DATASETS_DIR / file_name, nrows=2)
        assert target_column in df.columns, f"{file_name} is missing mapped target column '{target_column}'"


def test_all_default_domain_datasets_support_core_preprocessing_stats() -> None:
    for file_name, target_column in DATASET_TARGETS:
        problem_type = _infer_problem_type(file_name, target_column)
        session_id = f"dataset-audit-{file_name.replace('.csv', '')}"
        _seed_default_session(session_id, file_name, target_column, problem_type)

        basic = calculate_basic_cleaning_stats(session_id, [])
        missing = calculate_missing_statistics(session_id, [])
        outliers = calculate_outlier_statistics(session_id, [])

        assert basic["session_id"] == session_id
        assert isinstance(missing, list)
        assert isinstance(outliers, list)


def test_all_default_domain_datasets_prepare_training_data() -> None:
    builder = TrainingDatasetBuilder()

    for file_name, target_column in DATASET_TARGETS:
        problem_type = _infer_problem_type(file_name, target_column)
        session_id = f"dataset-train-{file_name.replace('.csv', '')}"
        _seed_default_session(session_id, file_name, target_column, problem_type)

        prepared = builder.prepare(
            session_id,
            _minimal_pipeline_config(session_id, target_column, problem_type),
        )

        assert prepared.target_column == target_column
        assert prepared.X_train.shape[0] > 0
        assert prepared.X_test.shape[0] > 0
        assert len(prepared.feature_names) > 0
