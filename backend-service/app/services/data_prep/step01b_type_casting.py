"""
Step 01b – Type Casting / Type Mismatch Detection
Single Responsibility: Scan object-typed columns and flag those that can be
coerced to a numeric type at high confidence, even when values contain currency
symbols, commas, percentage signs, or other common noise.
"""
import re
from typing import Any

import pandas as pd

from app.core.exceptions import PipelineError
from app.services.data_prep._dataframe_loader import load_dataframe

# A column is flagged if at least this fraction of non-null values coerce cleanly.
COERCE_THRESHOLD = 0.50

# Characters to strip before attempting numeric coercion
_NOISE_PATTERN = re.compile(r"[$€£¥₺,\s%]")


def _clean_series_for_coerce(series: pd.Series) -> pd.Series:
    """Strip noise characters so '$1,200.50' becomes '1200.50'."""
    return series.astype(str).str.strip().apply(
        lambda v: _NOISE_PATTERN.sub("", v)
    )


def detect_type_mismatches(df: pd.DataFrame) -> list[dict[str, str]]:
    """
    Iterate over object/string columns and attempt numeric coercion.
    Returns a list of mismatch descriptors for columns that *should* be numeric
    but are stored as strings.

    Example return value:
        [
            {
                "column":       "Blood_Pressure",
                "current_type": "object",
                "suggested_type": "float64",
            },
        ]
    """
    flagged: list[dict[str, str]] = []

    for col in df.columns:
        if df[col].dtype not in (object, "string"):
            continue  # already numeric / boolean / datetime — skip

        non_null = df[col].dropna()
        if non_null.empty:
            continue

        cleaned = _clean_series_for_coerce(non_null)
        coerced = pd.to_numeric(cleaned, errors="coerce")
        success_rate = coerced.notna().sum() / len(non_null)

        if success_rate >= COERCE_THRESHOLD:
            # Decide suggested dtype
            if (coerced.dropna() % 1 == 0).all():
                suggested = "int64"
            else:
                suggested = "float64"

            flagged.append(
                {
                    "column": col,
                    "current_type": str(df[col].dtype),
                    "suggested_type": suggested,
                    "coerce_rate": round(float(success_rate), 4),
                }
            )

    return flagged


def calculate_type_mismatch_stats(
    session_id: str,
    excluded_columns: list[str],
) -> dict[str, Any]:
    """
    Load the immutable dataset, apply the exclusion mask, and run
    `detect_type_mismatches` on the working subset.
    """
    try:
        df = load_dataframe(session_id)
        existing_excludes = [col for col in excluded_columns if col in df.columns]
        df_working = df.drop(columns=existing_excludes) if existing_excludes else df.copy()

        mismatches = detect_type_mismatches(df_working)

        return {
            "session_id": session_id,
            "mismatched_columns": mismatches,
            "total_mismatches": len(mismatches),
        }
    except Exception as exc:
        raise PipelineError(f"Type mismatch detection failed: {exc}", status_code=400) from exc
