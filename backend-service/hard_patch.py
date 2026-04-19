import re

path = 'app/api/v1/endpoints/data.py'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# We need to find everything after `def preprocessing_review(...)` ... `except Exception as exc:\n        raise PipelineError(f"Preprocessing review failed: {exc}", status_code=400) from exc`
match = re.search(r'raise PipelineError\(f"Preprocessing review failed: \{exc\}", status_code=400\) from exc', text)
if match:
    idx_end = match.end()
    
    # We want to replace everything from idx_end up to `# ── Step 09: Feature Redundancy / VIF` with our clean block
    vif_match = re.search(r'# ── Step 09: Feature Redundancy / VIF ────────────────────────────────', text)
    if vif_match:
        end_idx = vif_match.start()
        
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
        return _sanitize_for_json(actions)  # type: ignore[return-value]
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
        return _sanitize_for_json(result)  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Missing stats serialization failed: {exc}", status_code=500) from exc


@router.post("/outliers-stats")
def outliers_stats(payload: OutliersStatsRequest) -> list[dict[str, Any]]:
    try:
        result = calculate_outlier_statistics(payload.session_id, payload.excluded_columns)
        return _sanitize_for_json(result)  # type: ignore[return-value]
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(f"Outlier stats serialization failed: {exc}", status_code=500) from exc


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


"""
        new_text = text[:idx_end] + injection + text[end_idx:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_text)
        print("Patched successfully!")
    else:
        print("VIF not found")
else:
    print("Preprocessing Review not found")
