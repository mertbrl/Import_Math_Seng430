import csv
import io
import json
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

from app.core.exceptions import PipelineError
from app.schemas.exploration import EDAProfileResponse
from app.schemas.request import (
    DatasetUpsertRequest,
    MappingUpsertRequest,
    PreprocessRequest,
)
from app.services import (
    data_exploration_service,
    pipeline_service,
    session_service
)

MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

router = APIRouter()

# ── EDA Explore Endpoint ─────────────────────────────────────────────

async def process_upload_for_eda(file: UploadFile, ignored_columns: list[str] | None) -> dict[str, Any]:
    """Helper function to process the uploaded file for EDA."""
    # Size guard — read content and check length
    content: bytes = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise PipelineError("CSV file exceeds 50 MB limit.", status_code=413)

    # Reset the file cursor so the service can re-read
    await file.seek(0)

    return await data_exploration_service.explore(file, ignored_columns=ignored_columns)


@router.post("/explore", response_model=EDAProfileResponse, summary="Automated Data Exploration (EDA)")
async def explore_data(
    file: UploadFile = File(...),
    ignored_columns: str | None = Form(
        default=None,
        description="JSON string array of column names to ignore in correlations",
    ),
) -> dict[str, Any]:
    """
    Accepts a dataset (CSV) and returns a comprehensive EDA profile matching the React frontend's required JSON structure.

    Raises
    ------
    HTTPException (400)
        If the file is not a CSV.
    PipelineError (400)
        If the file is empty or cannot be parsed.
    PipelineError (413)
        If the file exceeds the 50 MB size limit.
    """
    ignored: list[str] = []
    if ignored_columns:
        try:
            decoded = json.loads(ignored_columns)
        except json.JSONDecodeError as exc:
            raise PipelineError(
                "ignored_columns must be a JSON array of strings.",
                status_code=400,
            ) from exc

        if not isinstance(decoded, list) or not all(isinstance(item, str) for item in decoded):
            raise PipelineError(
                "ignored_columns must be a JSON array of strings.",
                status_code=400,
            )
        ignored = [item.strip() for item in decoded if item.strip()]

    return await process_upload_for_eda(file, ignored)


DEFAULT_DATASETS = [
    {"code": "cardiology_hf", "domain": "Cardiology", "target_column": "DEATH_EVENT"},
    {"code": "radiology_pneumonia", "domain": "Radiology", "target_column": "Finding_Label"},
    {"code": "nephrology_ckd", "domain": "Nephrology", "target_column": "classification"},
    {"code": "oncology_breast", "domain": "Oncology", "target_column": "diagnosis"},
    {"code": "neurology_parkinson", "domain": "Neurology", "target_column": "status"},
    {"code": "endocrinology_diabetes", "domain": "Endocrinology", "target_column": "Outcome"},
    {"code": "hepatology_liver", "domain": "Hepatology", "target_column": "Dataset"},
    {"code": "stroke_risk", "domain": "Stroke Risk", "target_column": "stroke"},
    {"code": "mental_health_depression", "domain": "Mental Health", "target_column": "severity_class"},
    {"code": "pulmonology_copd", "domain": "Pulmonology", "target_column": "exacerbation"},
    {"code": "haematology_anaemia", "domain": "Haematology", "target_column": "anemia_type"},
    {"code": "dermatology_skin", "domain": "Dermatology", "target_column": "dx_type"},
    {"code": "ophthalmology_retinopathy", "domain": "Ophthalmology", "target_column": "severity_grade"},
    {"code": "orthopaedics_spine", "domain": "Orthopaedics", "target_column": "class"},
    {"code": "icu_sepsis", "domain": "ICU / Sepsis", "target_column": "SepsisLabel"},
    {"code": "obstetrics_fetal", "domain": "Obstetrics", "target_column": "fetal_health"},
    {"code": "cardiology_arrhythmia", "domain": "Cardiology Arrhythmia", "target_column": "arrhythmia"},
    {"code": "oncology_cervical", "domain": "Oncology Cervical", "target_column": "Biopsy"},
    {"code": "thyroid_endocrinology", "domain": "Thyroid", "target_column": "class"},
    {"code": "pharmacy_readmission", "domain": "Pharmacy", "target_column": "readmitted"},
]


class ValidateMappingRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    problem_type: str = Field(default="binary_classification")
    target_column: str = Field(default="DEATH_EVENT")
    roles: dict[str, str] = Field(default_factory=dict)


class DataPrepareRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    train_split: int = Field(default=80, ge=60, le=90)
    missing_strategy: str = Field(default="median")
    normalization: str = Field(default="zscore")
    imbalance_strategy: str = Field(default="smote")


def _profile_csv(content: bytes, target_column: str) -> dict[str, Any]:
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames
    if not fieldnames:
        raise PipelineError("CSV header is missing or invalid.")

    columns = [col.strip() for col in fieldnames]
    missing_count: dict[str, int] = {col: 0 for col in columns}
    class_counts: dict[str, int] = {}
    rows = 0

    for row in reader:
        rows += 1
        for col in columns:
            value = (row.get(col) or "").strip()
            if value == "":
                missing_count[col] = missing_count.get(col, 0) + 1
        if target_column in row:
            label = (row.get(target_column) or "").strip()
            if label:
                class_counts[label] = class_counts.get(label, 0) + 1

    if rows == 0:
        raise PipelineError("CSV file must include at least one data row.")

    column_summary = [
        {
            "column": col,
            "missing_count": missing_count[col],
            "missing_ratio": float(f"{missing_count[col] / rows:.4f}"),
        }
        for col in columns
    ]
    class_balance = {
        label: float(f"{count / rows:.4f}")
        for label, count in class_counts.items()
    }

    return {
        "rows": rows,
        "columns": len(columns),
        "column_names": columns,
        "column_summary": column_summary,
        "class_balance": class_balance,
        "missing_ratio_overall": float(f"{sum(missing_count.values()) / (rows * len(columns)):.4f}"),
    }


@router.get("/datasets")
def datasets() -> dict[str, list[dict[str, Any]]]:
    return {"datasets": DEFAULT_DATASETS}


@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    session_id: str = Form(default="demo-session"),
    target_column: str = Form(default="DEATH_EVENT"),
) -> dict[str, Any]:
    content: bytes = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise PipelineError("CSV file exceeds 50 MB limit.", status_code=413)

    profile = _profile_csv(content, target_column)
    session_service.get_or_create(session_id)
    result = pipeline_service.create_dataset(
        session_id,
        DatasetUpsertRequest(
            source="upload",
            target_column=target_column,
            file_name=file.filename or "uploaded.csv",
            row_count=profile["rows"],
            column_count=profile["columns"],
        ),
    )
    state = session_service.get(session_id)
    state.dataset["column_names"] = profile["column_names"]
    state.data_profile["column_summary"] = profile["column_summary"]
    state.data_profile["class_balance"] = profile["class_balance"]
    state.data_profile["missing_ratio_overall"] = profile["missing_ratio_overall"]
    session_service.touch(state, bump_revision=False)

    return {
        "session_id": session_id,
        "dataset_id": f"{session_id}:v{result['dataset_version']}",
        "dataset_version": result["dataset_version"],
        "summary": state.data_profile,
    }


@router.post("/validate-mapping")
def validate_mapping(payload: ValidateMappingRequest) -> dict[str, Any]:
    state = session_service.get_or_create(payload.session_id)
    if not state.dataset:
        raise PipelineError("Dataset must be uploaded or selected before mapping validation.")

    errors: list[str] = []
    warnings: list[str] = []
    columns = state.dataset.get("column_names", [])
    if columns and payload.target_column not in columns:
        errors.append(f"Target column '{payload.target_column}' not found in dataset.")
    if payload.roles.get(payload.target_column) != "target":
        warnings.append(f"Role for '{payload.target_column}' should be set to 'target'.")

    if errors:
        return {
            "session_id": payload.session_id,
            "mapping_valid": False,
            "errors": errors,
            "warnings": warnings,
        }

    mapping_payload = MappingUpsertRequest(
        problem_type=payload.problem_type,
        target_column=payload.target_column,
        roles=payload.roles or {payload.target_column: "target"},
    )
    pipeline_service.put_mapping(payload.session_id, mapping_payload)
    validation = pipeline_service.validate_mapping(payload.session_id)
    return {
        "session_id": payload.session_id,
        "mapping_valid": validation["mapping_validated"],
        "errors": [],
        "warnings": warnings,
    }


@router.post("/prepare")
def prepare_data(payload: DataPrepareRequest) -> dict[str, Any]:
    state = session_service.get_or_create(payload.session_id)
    before = {
        "rows": state.data_profile.get("rows", state.dataset.get("row_count", 304)),
        "columns": state.data_profile.get("columns", state.dataset.get("column_count", 12)),
        "class_balance": state.data_profile.get("class_balance", {}),
        "missing_ratio_overall": state.data_profile.get("missing_ratio_overall", 0.0),
    }
    recipe = pipeline_service.apply_preprocessing(
        PreprocessRequest(
            session_id=payload.session_id,
            train_split=payload.train_split,
            missing_strategy=payload.missing_strategy,
            normalization=payload.normalization,
            imbalance_strategy=payload.imbalance_strategy,
        )
    )
    after_class_balance = before["class_balance"]
    if payload.imbalance_strategy.lower() == "smote" and before["class_balance"]:
        labels = list(before["class_balance"].keys())
        if len(labels) == 2:
            after_class_balance = {labels[0]: 0.5, labels[1]: 0.5}

    return {
        "session_id": payload.session_id,
        "dataset_version": state.dataset_version,
        "before": before,
        "after": {
            "train_rows": recipe["train_rows"],
            "test_rows": recipe["test_rows"],
            "class_balance": after_class_balance,
        },
        "recipe": recipe,
    }
