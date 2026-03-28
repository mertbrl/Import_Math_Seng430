"""Step 09 – Feature Redundancy & Multicollinearity (VIF + PCA)"""

from typing import Any

import numpy as np
import pandas as pd
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.tools import add_constant

from app.services.data_prep._dataframe_loader import load_dataframe
from app.services.session_service import session_service


def _is_identifier_column(name: str, series: pd.Series) -> bool:
    lowered = name.strip().lower()
    if lowered not in {"id", "index"} and not lowered.endswith("_id"):
        return False

    non_null = series.dropna()
    if non_null.empty:
        return False

    return non_null.nunique() == len(non_null)


def _calculate_vif_scores(X: pd.DataFrame) -> pd.Series:
    if X.empty:
        return pd.Series(dtype=float)

    complete_cases = X.dropna()
    if complete_cases.shape[0] < 2:
        raise ValueError("VIF calculation requires at least 2 complete rows.")

    design_matrix = add_constant(complete_cases, has_constant="add")
    vif_scores: dict[str, float] = {}

    for index, column in enumerate(complete_cases.columns):
        try:
            vif_raw = variance_inflation_factor(design_matrix.values, index + 1)
            vif_scores[column] = float(vif_raw) if not np.isnan(vif_raw) else float("inf")
        except Exception:
            vif_scores[column] = float("inf")

    return pd.Series(vif_scores, dtype=float)


def drop_multicollinear_features_iteratively(
    X: pd.DataFrame,
    threshold: float = 10.0,
    protected_features: list[str] | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """
    Iteratively remove the single worst feature by VIF until all remaining
    features have VIF <= threshold.

    Returns
    -------
    tuple[pd.DataFrame, list[str]]
        The filtered dataframe and the ordered list of dropped feature names.
    """
    if not isinstance(X, pd.DataFrame):
        raise TypeError("X must be a pandas DataFrame.")

    if threshold <= 0:
        raise ValueError("threshold must be greater than 0.")

    non_numeric = [column for column in X.columns if not pd.api.types.is_numeric_dtype(X[column])]
    if non_numeric:
        raise ValueError(
            f"VIF can only be computed on numeric features. Non-numeric columns: {', '.join(non_numeric)}"
        )

    filtered = X.copy()
    dropped_features: list[str] = []
    protected = {feature for feature in (protected_features or []) if feature in filtered.columns}

    while filtered.shape[1] > 1:
        vif_scores = _calculate_vif_scores(filtered)
        if vif_scores.empty:
            break

        droppable_scores = vif_scores.drop(labels=list(protected), errors="ignore")
        if droppable_scores.empty:
            break

        max_feature = str(droppable_scores.idxmax())
        max_vif = float(droppable_scores.loc[max_feature])

        if max_vif <= threshold:
            break

        filtered = filtered.drop(columns=[max_feature])
        dropped_features.append(max_feature)

    return filtered, dropped_features


def analyze_vif(
    session_id: str,
    ignored_columns: list[str] | None = None,
    protected_columns: list[str] | None = None,
) -> dict[str, Any]:
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
    state = session_service.get(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    target_column = state.dataset.get("target_column")
    if target_column and target_column in df.columns and pd.api.types.is_numeric_dtype(df[target_column]):
        df = df.drop(columns=[target_column], errors="ignore")

    identifier_columns = [
        column
        for column in df.columns
        if pd.api.types.is_numeric_dtype(df[column]) and _is_identifier_column(column, df[column])
    ]
    if identifier_columns:
        df = df.drop(columns=identifier_columns, errors="ignore")

    numerical_df = df.select_dtypes(include=np.number).dropna()
    zero_variance_columns = [
        column
        for column in numerical_df.columns
        if numerical_df[column].nunique(dropna=True) <= 1
    ]
    if zero_variance_columns:
        numerical_df = numerical_df.drop(columns=zero_variance_columns, errors="ignore")

    if numerical_df.shape[1] < 2:
        return {"columns": [], "warning": "Need at least 2 numerical columns to compute VIF."}

    # Add constant for VIF calculation
    X = add_constant(numerical_df, has_constant='add')

    results = []
    for i, col in enumerate(numerical_df.columns):
        try:
            vif_raw = variance_inflation_factor(X.values, i + 1)  # +1 to skip constant
            vif = float(vif_raw) if not np.isnan(vif_raw) else float('nan')
        except Exception:
            vif = float('nan')

        if np.isnan(vif):
            severity = "ok"
            flagged = False
        elif np.isinf(vif):
            severity = "severe"
            flagged = True
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
            "vif": round(vif, 4) if np.isfinite(vif) else None,
            "severity": severity,
            "flagged": flagged,
            "note": "Perfect multicollinearity detected." if np.isinf(vif) else None,
        })

    # Sort by VIF descending (treat None as 0)
    results.sort(key=lambda r: r["vif"] or 0, reverse=True)

    filtered_df, dropped_features = drop_multicollinear_features_iteratively(
        numerical_df,
        threshold=10.0,
        protected_features=protected_columns,
    )

    return {
        "columns": results,
        "iterative_drop_order": dropped_features,
        "remaining_features": filtered_df.columns.tolist(),
        "protected_columns": [column for column in (protected_columns or []) if column in numerical_df.columns],
    }
