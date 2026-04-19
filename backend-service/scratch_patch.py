import sys

file_path = "c:/Users/MertBrsl/Workspace/seng 430/Import_Math_Seng430/backend-service/app/api/v1/endpoints/data.py"

with open(file_path, "r", encoding="utf-8") as f:
    orig = f.read()

injection = """
@router.post("/download-preprocessed")
def download_preprocessed(
    payload: PipelineExecutionRequest,
) -> StreamingResponse:
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

class AutoPrepRequest(BaseModel):
    session_id: str
    imbalance_enabled: bool = True

@router.post("/auto-prep")
def auto_prep_pipeline(payload: AutoPrepRequest) -> list[dict[str, Any]]:
    try:
        actions = run_auto_prep(payload.session_id, payload.imbalance_enabled)
        return _sanitize_for_json(actions)
    except Exception as exc:
        raise PipelineError(f"Auto-prep failed: {exc}", status_code=500) from exc

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
        return _sanitize_for_json(result)
    except Exception as exc:
        raise PipelineError(f"Missing stats serialization failed: {exc}", status_code=500) from exc

@router.post("/outliers-stats")
def outliers_stats(payload: OutliersStatsRequest) -> list[dict[str, Any]]:
    try:
        result = calculate_outlier_statistics(payload.session_id, payload.excluded_columns)
        return _sanitize_for_json(result)
    except Exception as exc:
        raise PipelineError(f"Outlier stats serialization failed: {exc}", status_code=500) from exc

@router.post("/transformation-stats")
def transformation_stats(payload: TransformationStatsRequest) -> dict[str, Any]:
    try:
        return _sanitize_for_json(analyze_transformation_candidates(payload.session_id, payload.excluded_columns))
    except Exception as exc:
        raise PipelineError(f"Transformation stats failed: {exc}", status_code=500) from exc
"""

target = "# ── Step 07: Categorical Encoding"
idx = orig.find(target)
if idx != -1:
    new_content = orig[:idx] + injection + "\n" + orig[idx:]
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Injected successfully!")
else:
    print("Target not found!")
