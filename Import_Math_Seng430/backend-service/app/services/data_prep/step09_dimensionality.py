"""Step 09 – Feature Redundancy & Multicollinearity (VIF + PCA)"""

from typing import Any

import numpy as np
import pandas as pd
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.tools import add_constant

from app.services.data_prep._dataframe_loader import load_dataframe


def analyze_vif(session_id: str, ignored_columns: list[str] | None = None) -> dict[str, Any]:
    """
    Calculates Variance Inflation Factor (VIF) for all numerical features.
    Flags features with VIF > 5 as having significant multicollinearity.

    VIF Interpretation:
    - VIF = 1: No correlation
    - VIF 1-5: Moderate correlation (acceptable)
    - VIF > 5: High multicollinearity (investigate or drop)
    - VIF > 10: Severe multicollinearity (must address)
    """
    df = load_dataframe(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    numerical_df = df.select_dtypes(include=np.number).dropna()

    if numerical_df.shape[1] < 2:
        return {"columns": [], "warning": "Need at least 2 numerical columns to compute VIF."}

    # Add constant for VIF calculation
    X = add_constant(numerical_df, has_constant='add')

    results = []
    for i, col in enumerate(numerical_df.columns):
        try:
            vif_raw = variance_inflation_factor(X.values, i + 1)  # +1 to skip constant
            # Inf means perfect multicollinearity — cap at 999 for display
            vif = min(float(vif_raw), 999.0) if not np.isnan(vif_raw) else float('nan')
        except Exception:
            vif = float('nan')

        if np.isnan(vif):
            severity = "ok"
            flagged = False
        elif vif > 10:
            severity = "severe"
            flagged = True
        elif vif > 5:
            severity = "high"
            flagged = True
        else:
            severity = "ok"
            flagged = False

        results.append({
            "column": col,
            "vif": round(vif, 4) if not np.isnan(vif) else None,
            "severity": severity,
            "flagged": flagged,
        })

    # Sort by VIF descending (treat None as 0)
    results.sort(key=lambda r: r["vif"] or 0, reverse=True)

    return {"columns": results}
