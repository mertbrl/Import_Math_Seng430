"""Step 08 – Scaling (Post-Transformation)"""

from typing import Any

import numpy as np
import pandas as pd

from app.services.data_prep._dataframe_loader import load_dataframe


def analyze_scaling_candidates(session_id: str, ignored_columns: list[str] | None = None) -> dict[str, Any]:
    """
    Analyzes numerical columns and recommends the appropriate scaler.

    Rules:
    - If data has outliers (IQR-based), recommend StandardScaler (more robust)
    - If data has a known bounded range (0–1 check), recommend MinMaxScaler
    - Default: StandardScaler

    NOTE: Scaling must be fit on Train Set ONLY. This endpoint informs the user
    of recommendations; actual scaling is enforced in the pipeline executor.
    """
    df = load_dataframe(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    numerical_cols = df.select_dtypes(include=np.number).columns.tolist()
    results = []

    for col in numerical_cols:
        series = df[col].dropna()
        if len(series) < 5:
            continue

        col_min = float(series.min())
        col_max = float(series.max())
        col_mean = float(series.mean())
        col_std = float(series.std())

        # Simple outlier check (IQR)
        q1, q3 = float(series.quantile(0.25)), float(series.quantile(0.75))
        iqr = q3 - q1
        has_outliers = bool(((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).any())

        # If bounded [0, 1] exactly
        is_bounded_01 = col_min >= 0 and col_max <= 1

        if is_bounded_01:
            recommendation = "minmax"
        elif has_outliers:
            recommendation = "robust"  # RobustScaler uses IQR, not affected by outliers
        else:
            recommendation = "standard"

        results.append({
            "column": col,
            "min": round(col_min, 4),
            "max": round(col_max, 4),
            "mean": round(col_mean, 4),
            "std": round(col_std, 4),
            "has_outliers": has_outliers,
            "recommendation": recommendation,
        })

    return {"columns": results}
