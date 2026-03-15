"""Step 10 – Imbalance Handling (SMOTE / ADASYN)"""

from typing import Any

import numpy as np
import pandas as pd

from app.services.data_prep._dataframe_loader import load_dataframe


def analyze_class_balance(session_id: str, target_column: str, ignored_columns: list[str] | None = None) -> dict[str, Any]:
    """
    Analyzes the class distribution of the target column to detect imbalance.

    Imbalance Rules:
    - Majority/Minority ratio > 3: Moderate imbalance → Suggest SMOTE
    - Majority/Minority ratio > 10: Severe imbalance → Suggest ADASYN
    - Balanced: No action required

    NOTE: SMOTE/ADASYN must ONLY be applied to the Train Set.
    This endpoint returns analysis for the full dataset (for display purposes).
    The pipeline executor enforces train-only oversampling.
    """
    df = load_dataframe(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    if target_column not in df.columns:
        return {"error": f"Target column '{target_column}' not found in dataset."}

    value_counts = df[target_column].value_counts()
    total = len(df)

    class_distribution = [
        {
            "class": str(label),
            "count": int(count),
            "percentage": round(count / total * 100, 2)
        }
        for label, count in value_counts.items()
    ]

    if len(value_counts) < 2:
        return {
            "class_distribution": class_distribution,
            "imbalance_ratio": 1.0,
            "severity": "balanced",
            "recommendation": None,
        }

    majority = int(value_counts.iloc[0])
    minority = int(value_counts.iloc[-1])
    ratio = round(majority / minority, 2)

    if ratio > 10:
        severity = "severe"
        recommendation = "adasyn"
    elif ratio > 3:
        severity = "moderate"
        recommendation = "smote"
    else:
        severity = "balanced"
        recommendation = None

    return {
        "class_distribution": class_distribution,
        "imbalance_ratio": ratio,
        "severity": severity,
        "recommendation": recommendation,
    }
