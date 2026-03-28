"""Step 07 – Categorical Encoding"""

from typing import Any

import pandas as pd
import numpy as np

from app.services.data_prep._dataframe_loader import load_dataframe


def analyze_encoding_candidates(session_id: str, ignored_columns: list[str] | None = None, target_column: str | None = None) -> dict[str, Any]:
    """
    Analyzes categorical columns and suggests the best encoding strategy
    based on cardinality (unique value count).

    Rules:
    - cardinality <= 2: Label Encoding
    - cardinality 3-10: One-Hot Encoding (drop='first')
    - cardinality > 10: Target Encoding (requires target column)
    """
    df = load_dataframe(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    if target_column and target_column in categorical_cols:
        categorical_cols = [c for c in categorical_cols if c != target_column]

    results = []
    for col in categorical_cols:
        unique_count = df[col].nunique()
        sample_values = df[col].dropna().unique()[:5].tolist()

        if unique_count <= 2:
            recommendation = "label"
        elif unique_count <= 10:
            recommendation = "onehot"
        else:
            recommendation = "target"

        results.append({
            "column": col,
            "unique_count": int(unique_count),
            "sample_values": [str(v) for v in sample_values],
            "recommendation": recommendation,
        })

    return {"columns": results}
