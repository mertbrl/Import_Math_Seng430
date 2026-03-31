"""
Step 01 – Basic Cleaning
Single Responsibility: Detect structural garbage (duplicate rows, zero-variance columns).
The exclusion mask is applied FIRST so ID/metadata columns never interfere with counts.
"""
from typing import Any

from app.core.exceptions import PipelineError
from app.services.data_prep._dataframe_loader import load_dataframe


def calculate_basic_cleaning_stats(
    session_id: str,
    excluded_columns: list[str],
) -> dict[str, Any]:
    """
    Returns:
        duplicates_count         – rows that are exact duplicates after the mask
        zero_variance_columns    – column names where nunique() <= 1
        excluded_columns_applied – how many excluded cols were actually present
    """
    try:
        df = load_dataframe(session_id)
        existing_excludes = [col for col in excluded_columns if col in df.columns]
        df_working = df.drop(columns=existing_excludes) if existing_excludes else df.copy()

        duplicates_count = int(df_working.duplicated().sum())
        zero_variance_cols = [
            col for col in df_working.columns if df_working[col].nunique() <= 1
        ]

        return {
            "session_id": session_id,
            "duplicates_count": duplicates_count,
            "zero_variance_columns": zero_variance_cols,
            "excluded_columns_applied": len(existing_excludes),
        }
    except Exception as exc:
        raise PipelineError(f"Basic cleaning stats failed: {exc}", status_code=400) from exc
