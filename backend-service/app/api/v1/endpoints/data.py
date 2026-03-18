import csv
import io
import json
import math
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
import pathlib

from app.core.exceptions import PipelineError
from app.ml_core.data_engine.eda import run_full_eda
from app.schemas.exploration import EDAProfileResponse, PreprocessingReviewResponse
from app.schemas.request import (
    BasicCleaningStatsRequest,
    CertificateCreateRequest,
    ContextRequest,
    DataExplorationRequest,
    DatasetPatchRequest,
    DatasetUpsertRequest,
    EvaluationRequest,
    ExplainabilityLocalRequest,
    ExplainabilityRequest,
    FairnessRequest,
    FeatureImportanceRequest,
    MappingUpsertRequest,
    MissingStatsRequest,
    PipelineExecutionRequest,
    OutliersStatsRequest,
    PreprocessRequest,
    SessionCreateRequest,
    SessionPatchRequest,
    TrainRequest,
    TypeMismatchStatsRequest,
    ValidateMappingRequest,
    TransformationStatsRequest,
    EncodingStatsRequest,
    ScalingStatsRequest,
    DimensionalityStatsRequest,
    ImbalanceStatsRequest,
)
from app.services import (
    data_exploration_service,
    pipeline_service,
    session_service
)
# Modular data_prep package (replaces old monolithic data_preparation_service)
from app.services.data_prep.step01_basic_cleaning import calculate_basic_cleaning_stats
from app.services.data_prep.step01b_type_casting import calculate_type_mismatch_stats
from app.services.data_prep.step04_imputation import calculate_missing_statistics
from app.services.data_prep.step05_outliers import calculate_outlier_statistics
from app.services.data_prep.step06_transformation import analyze_transformation_candidates
from app.services.data_prep.step07_encoding import analyze_encoding_candidates
from app.services.data_prep.step08_scaling import analyze_scaling_candidates
from app.services.data_prep.step09_dimensionality import analyze_vif
from app.services.data_prep.step09_feature_selection import calculate_feature_importances
from app.services.data_prep.step10_imbalance import analyze_class_balance, summarize_class_balance
from app.services.data_prep.pipeline_execution import apply_full_pipeline, normalize_pipeline_config
# Legacy pipeline preview — migrated inline below once preview_pipeline is moved
from app.services.data_prep._dataframe_loader import load_dataframe

MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# Resolve the absolute path of the backend-service/core_datasets directory
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent.parent.parent.parent
CORE_DATASETS_DIR = BASE_DIR / "core_datasets"
SESSION_DATA_DIR = BASE_DIR / "temp_sessions"


def _sanitize_for_json(obj: Any) -> Any:
    """Recursively convert NumPy / Pandas scalars to native Python types
    and replace NaN / Inf with None so json.dumps never crashes."""
    if isinstance(obj, list):
        return [_sanitize_for_json(item) for item in obj]
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    # Catch numpy int / float variants that slipped through
    try:
        import numpy as np  # type: ignore[import-untyped]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            v = float(obj)
            return None if math.isnan(v) or math.isinf(v) else v
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (np.ndarray,)):
            return _sanitize_for_json(obj.tolist())
    except ImportError:
        pass
    return obj


router = APIRouter()

# ── EDA Explore Endpoint ─────────────────────────────────────────────

async def process_upload_for_eda(file: UploadFile, ignored_columns: list[str] | None) -> dict[str, Any]:
    """Helper function to process the uploaded file for EDA."""
    # Size guard — read content and check length
    content: bytes = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise PipelineError("CSV file exceeds 50 MB limit.", status_code=413)

    return await data_exploration_service.explore(content, ignored_columns=ignored_columns)


@router.post("/explore", response_model=EDAProfileResponse, summary="Automated Data Exploration (EDA)")
async def explore_data(
    file: UploadFile = File(...),
    ignored_columns: str | None = Form(
        default=None,
        description="JSON string array of column names to ignore in correlations",
    ),
    session_id: str = Form(default="demo-session"),
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

    # To support the frontend which only calls /explore but requires the session to be hydrated
    content: bytes = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise PipelineError("CSV file exceeds 50 MB limit.", status_code=413)

    session_dir = SESSION_DATA_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    raw_path = session_dir / "raw.csv"
    raw_path.write_bytes(content)

    profile = _profile_csv(content, "target_unknown")
    session_service.get_or_create(session_id)
    pipeline_service.create_dataset(
        session_id,
        DatasetUpsertRequest(
            source="upload",
            target_column="target_unknown",
            file_name=file.filename or "uploaded.csv",
            row_count=profile["rows"],
            column_count=profile["columns"],
        ),
    )
    
    # We must reset the file cursor since it was already read by await file.read()
    await file.seek(0)
    return await process_upload_for_eda(file, ignored)


DEFAULT_DATASETS = [
    {"code": "cardiology_hf", "domain": "Cardiology", "target_column": "DEATH_EVENT"},
    {"code": "radiology_pneumonia", "domain": "Radiology", "target_column": "Finding Labels"},
    {"code": "nephrology_ckd", "domain": "Nephrology", "target_column": "classification"},
    {"code": "oncology_breast", "domain": "Oncology", "target_column": "Diagnosis"},
    {"code": "neurology_parkinson", "domain": "Neurology", "target_column": "status"},
    {"code": "endocrinology_diabetes", "domain": "Endocrinology", "target_column": "Outcome"},
    {"code": "hepatology_liver", "domain": "Hepatology", "target_column": "Selector"},
    {"code": "stroke_risk", "domain": "Stroke Risk", "target_column": "stroke"},
    {"code": "mental_health_depression", "domain": "Mental Health", "target_column": "severity_class"},
    {"code": "pulmonology_copd", "domain": "Pulmonology", "target_column": "class"},
    {"code": "haematology_anaemia", "domain": "Haematology", "target_column": "anemia_type"},
    {"code": "dermatology_skin", "domain": "Dermatology", "target_column": "dx_type"},
    {"code": "ophthalmology_retinopathy", "domain": "Ophthalmology", "target_column": "class"},
    {"code": "orthopaedics_spine", "domain": "Orthopaedics", "target_column": "class"},

    {"code": "obstetrics_fetal", "domain": "Obstetrics", "target_column": "fetal_health"},
    {"code": "cardiology_arrhythmia", "domain": "Cardiology Arrhythmia", "target_column": "Class"},
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

@router.get("/datasets/{filename}")
def get_default_dataset(filename: str) -> FileResponse:
    """Streams a requested predefined default dataset CSV from the backend disk."""
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files can be requested.")
    
    # Secure the path using safe_join essentially or strictly checking bounds
    file_path = (CORE_DATASETS_DIR / filename).resolve()
    
    # Path Traversal Prevention: ensure the resolved file_path is strictly inside CORE_DATASETS_DIR
    if not str(file_path).startswith(str(CORE_DATASETS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied.")
        
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Dataset not found or unavailable.")
        
    return FileResponse(
        path=file_path, 
        media_type="text/csv", 
        filename=filename
    )


@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    session_id: str = Form(default="demo-session"),
    target_column: str = Form(default="DEATH_EVENT"),
) -> dict[str, Any]:
    content: bytes = await file.read()
    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise PipelineError("CSV file exceeds 50 MB limit.", status_code=413)

    # Persist the immutable source dataset for future pipeline execution
    session_dir = SESSION_DATA_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    raw_path = session_dir / "raw.csv"
    raw_path.write_bytes(content)

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


@router.post("/preview-cleaned-data")
def preview_cleaned_data(payload: PipelineExecutionRequest) -> dict[str, Any]:
    """Preview the fully processed working dataframe without mutating the raw source CSV."""
    pipeline_config = normalize_pipeline_config(payload.model_dump())
    df = load_dataframe(pipeline_config["session_id"])
    try:
        df_processed = apply_full_pipeline(df, pipeline_config)
        preview = _sanitize_for_json(df_processed.head(10).to_dict(orient="records"))
        return {
            "session_id": pipeline_config["session_id"],
            "shape": list(df_processed.shape),
            "preview": preview,
        }
    except Exception as exc:
        raise PipelineError(f"Pipeline execution failed: {exc}", status_code=400) from exc


@router.post(
    "/preprocessing-review",
    response_model=PreprocessingReviewResponse,
    summary="Compare dataset diagnostics before and after preprocessing",
)
def preprocessing_review(payload: PipelineExecutionRequest) -> dict[str, Any]:
    """Return reusable EDA profiles for the current working set before and after preprocessing."""
    pipeline_config = normalize_pipeline_config(payload.model_dump())
    df = load_dataframe(pipeline_config["session_id"])

    try:
        before_df = apply_full_pipeline(df, pipeline_config, stop_before="basic_cleaning")
        after_df = apply_full_pipeline(df, pipeline_config)

        before_profile = _sanitize_for_json(run_full_eda(before_df))
        after_profile = _sanitize_for_json(run_full_eda(after_df))

        before_columns = list(before_df.columns)
        after_columns = list(after_df.columns)

        return {
            "before": before_profile,
            "after": after_profile,
            "beforeShape": list(before_df.shape),
            "afterShape": list(after_df.shape),
            "removedColumns": [column for column in before_columns if column not in after_columns],
            "addedColumns": [column for column in after_columns if column not in before_columns],
        }
    except Exception as exc:
        raise PipelineError(f"Preprocessing review failed: {exc}", status_code=400) from exc


@router.post("/download-preprocessed")
def download_preprocessed(
    payload: PipelineExecutionRequest,
) -> StreamingResponse:
    """
    Execute the centralized pipeline engine on the immutable source CSV
    and return the resulting working dataframe as a downloadable CSV.
    """
    import io as _io

    pipeline_config = normalize_pipeline_config(payload.model_dump())
    df = load_dataframe(pipeline_config["session_id"])
    try:
        df_processed = apply_full_pipeline(df, pipeline_config)
        buffer = _io.StringIO()
        df_processed.to_csv(buffer, index=False)
        buffer.seek(0)

        return StreamingResponse(
            content=iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=preprocessed_data.csv"},
        )
    except Exception as exc:
        raise PipelineError(f"Download pipeline failed: {exc}", status_code=400) from exc


@router.post("/basic-cleaning-stats")
def basic_cleaning_stats(payload: BasicCleaningStatsRequest) -> dict[str, Any]:
    return calculate_basic_cleaning_stats(payload.session_id, payload.excluded_columns)


@router.post("/type-mismatch-stats")
def type_mismatch_stats(payload: TypeMismatchStatsRequest) -> dict[str, Any]:
    return calculate_type_mismatch_stats(payload.session_id, payload.excluded_columns)


@router.post("/missing-stats")
def missing_stats(payload: MissingStatsRequest) -> list[dict[str, Any]]:
    try:
        result = calculate_missing_statistics(payload.session_id, payload.excluded_columns)
        # Final safety net: ensure every value is JSON-serializable
        return _sanitize_for_json(result)  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(
            f"Missing stats serialization failed: {exc}", status_code=500
        ) from exc


@router.post("/outliers-stats")
def outliers_stats(payload: OutliersStatsRequest) -> list[dict[str, Any]]:
    try:
        result = calculate_outlier_statistics(payload.session_id, payload.excluded_columns)
        return _sanitize_for_json(result)  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(
            f"Outlier stats serialization failed: {exc}", status_code=500
        ) from exc


# ── Step 06: Feature Transformation ──────────────────────────────────
@router.post("/transformation-stats")
def transformation_stats(payload: TransformationStatsRequest) -> dict[str, Any]:
    try:
        return _sanitize_for_json(analyze_transformation_candidates(payload.session_id, payload.excluded_columns))  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Transformation stats failed: {exc}", status_code=500) from exc


# ── Step 07: Categorical Encoding ─────────────────────────────────────
@router.post("/encoding-stats")
def encoding_stats(payload: EncodingStatsRequest) -> dict[str, Any]:
    try:
        return _sanitize_for_json(analyze_encoding_candidates(payload.session_id, payload.excluded_columns, payload.target_column))  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Encoding stats failed: {exc}", status_code=500) from exc


# ── Step 08: Scaling ──────────────────────────────────────────────────
@router.post("/scaling-stats")
def scaling_stats(payload: ScalingStatsRequest) -> dict[str, Any]:
    try:
        return _sanitize_for_json(analyze_scaling_candidates(payload.session_id, payload.excluded_columns))  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Scaling stats failed: {exc}", status_code=500) from exc


# ── Step 09: Feature Redundancy / VIF ────────────────────────────────
@router.post("/dimensionality-stats")
def dimensionality_stats(payload: DimensionalityStatsRequest) -> dict[str, Any]:
    try:
        return _sanitize_for_json(
            analyze_vif(payload.session_id, payload.excluded_columns, payload.protected_columns)
        )  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"VIF stats failed: {exc}", status_code=500) from exc


# ── Step 10: Imbalance Handling ───────────────────────────────────────
@router.post("/imbalance-stats")
def imbalance_stats(payload: ImbalanceStatsRequest) -> dict[str, Any]:
    try:
        if payload.pipeline_config is not None:
            pipeline_config = normalize_pipeline_config(payload.model_dump())
            df = load_dataframe(pipeline_config["session_id"])

            before_df = apply_full_pipeline(df, pipeline_config, stop_before="imbalance")
            before_summary = summarize_class_balance(before_df, payload.target_column)

            after_config = dict(pipeline_config)
            after_config["imbalance"] = {"enabled": True, "strategy": "smote"}
            after_df = apply_full_pipeline(df, after_config)
            after_summary = summarize_class_balance(after_df, payload.target_column)

            response = {
                **before_summary,
                "class_distribution": before_summary.get("class_distribution", []),
                "before_class_distribution": before_summary.get("class_distribution", []),
                "after_smote_distribution": after_summary.get("class_distribution", []),
                "working_set": "train",
                "target_column": payload.target_column,
            }
            return _sanitize_for_json(response)  # type: ignore[return-value]

        return _sanitize_for_json(analyze_class_balance(payload.session_id, payload.target_column, payload.excluded_columns))  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Imbalance stats failed: {exc}", status_code=500) from exc


@router.post("/feature-importance-stats")
def feature_importance_stats(payload: FeatureImportanceRequest) -> list[dict[str, Any]]:
    try:
        pipeline_config = normalize_pipeline_config(payload.model_dump())
        df = load_dataframe(pipeline_config["session_id"])
        state = session_service.get_or_create(pipeline_config["session_id"])
        problem_type = pipeline_config.get("problem_type") or state.mapping.get("problem_type") or "classification"
        if problem_type == "binary_classification":
            problem_type = "classification"
        elif problem_type == "multi_class_classification":
            problem_type = "multiclass"

        df_for_ranking = apply_full_pipeline(df, pipeline_config, stop_before="feature_selection")
        target_column = (
            pipeline_config.get("target_column")
            or payload.target_column
            or state.mapping.get("target_column")
            or state.dataset.get("target_column")
        )
        importances = calculate_feature_importances(df_for_ranking, target_column, problem_type)
        return _sanitize_for_json(importances)
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Feature importance stats failed: {exc}", status_code=500) from exc


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
