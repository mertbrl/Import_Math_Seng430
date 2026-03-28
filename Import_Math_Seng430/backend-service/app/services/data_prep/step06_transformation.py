"""Step 06 – Feature Transformation (Distribution Normalization)"""

from typing import Any

import numpy as np
import pandas as pd
from sklearn.preprocessing import PowerTransformer

from app.services.data_prep._dataframe_loader import load_dataframe


def analyze_transformation_candidates(session_id: str, ignored_columns: list[str] | None = None) -> dict[str, Any]:
    """
    Analyzes numerical columns from the dataset and determines which ones
    need distribution normalization and which transformer is best.

    Returns a list of columns with their current skewness and recommended method.
    """
    df = load_dataframe(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    numerical_cols = df.select_dtypes(include=np.number).columns.tolist()
    results = []

    for col in numerical_cols:
        series = df[col].dropna()
        if len(series) < 10:
            continue

        skewness = float(series.skew())
        abs_skew = abs(skewness)

        # Determine recommendation
        has_negatives = (series <= 0).any()

        if abs_skew < 0.5:
            recommendation = None  # Already normal
            needs_transform = False
        elif has_negatives:
            recommendation = "yeo_johnson"
            needs_transform = True
        elif abs_skew >= 0.5 and not has_negatives:
            recommendation = "box_cox"
            needs_transform = True
        else:
            recommendation = "yeo_johnson"
            needs_transform = True

        results.append({
            "column": col,
            "current_skewness": round(skewness, 4),
            "abs_skewness": round(abs_skew, 4),
            "has_negatives": bool(has_negatives),
            "needs_transform": needs_transform,
            "recommendation": recommendation,
        })

    return {"columns": results}
