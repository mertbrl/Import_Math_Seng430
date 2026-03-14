"""Exploratory Data Analysis engine.

All analytics live here — pure Pandas / NumPy with **no** HTTP or
FastAPI dependencies.  Each public function accepts a ``pd.DataFrame``
and returns plain dicts that map directly to the Pydantic schemas in
``app.schemas.exploration``.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


# ── helpers ──────────────────────────────────────────────────────────

def _classify_column(series: pd.Series) -> str:
    """Determine if a column is Numeric, Boolean, or Categorical.

    Rules
    -----
    * If the dtype is ``bool`` **or** the column contains exactly two
      unique non-null values that are a subset of common boolean pairs
      → ``'Boolean'``.
    * If the dtype is numeric (int / float) → ``'Numeric'``.
    * Everything else → ``'Categorical'``.
    """
    if pd.api.types.is_bool_dtype(series):
        return "Boolean"

    unique_vals = set(series.dropna().unique())
    if len(unique_vals) == 2:
        bool_pairs = [
            {0, 1}, {0.0, 1.0}, {"0", "1"},
            {True, False}, {"true", "false"}, {"yes", "no"},
        ]
        normalised = {str(v).lower() for v in unique_vals}
        for pair in bool_pairs:
            if normalised == {str(v).lower() for v in pair}:
                return "Boolean"

    if pd.api.types.is_numeric_dtype(series):
        return "Numeric"

    return "Categorical"


def _safe_round(val: float, decimals: int = 2) -> float:
    """Round a float, returning 0.0 for NaN / Inf."""
    if val is None or math.isnan(val) or math.isinf(val):
        return 0.0
    return round(val, decimals)


def _histogram_bins(series: pd.Series, max_bins: int = 8) -> list[dict[str, Any]]:
    """Create labelled histogram bins for a numeric series.

    Uses ``pd.cut`` with up to *max_bins* equal-width intervals.
    Returns ``[{"label": "18-25", "value": 89}, ...]``.
    """
    clean = series.dropna()
    if clean.empty:
        return []

    n_unique = clean.nunique()
    n_bins = min(max_bins, max(n_unique, 2))

    try:
        binned = pd.cut(clean, bins=n_bins, include_lowest=True)
    except ValueError:
        # Constant column — single bin
        return [{"label": str(clean.iloc[0]), "value": int(len(clean))}]

    counts = binned.value_counts(sort=False)
    result: list[dict[str, Any]] = []
    for interval, count in counts.items():
        left = _safe_round(interval.left)   # type: ignore[union-attr]
        right = _safe_round(interval.right)  # type: ignore[union-attr]
        # Use integers for labels when possible
        if left == int(left) and right == int(right):
            label = f"{int(left)}-{int(right)}"
        else:
            label = f"{left}-{right}"
        result.append({"label": label, "value": int(count)})
    return result


def _categorical_bins(series: pd.Series, top_n: int = 10) -> list[dict[str, Any]]:
    """Value-count bins for categorical / boolean columns."""
    counts = series.value_counts(dropna=True).head(top_n)
    return [{"label": str(k), "value": int(v)} for k, v in counts.items()]


# ── public API ───────────────────────────────────────────────────────

def compute_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Executive summary statistics for the entire DataFrame.

    Returns a dict with the same keys as
    ``SummaryStatsSchema`` (camelCase aliases).
    """
    total_cells = df.shape[0] * df.shape[1]
    missing_cells = int(df.isna().sum().sum())
    missing_pct = _safe_round(missing_cells / total_cells * 100, 1) if total_cells else 0.0
    dup_rows = int(df.duplicated().sum())
    dup_pct = _safe_round(dup_rows / len(df) * 100, 1) if len(df) else 0.0
    mem_bytes = df.memory_usage(deep=True).sum()
    mem_mib = _safe_round(mem_bytes / (1024 * 1024), 1)

    col_types = {"Numeric": 0, "Categorical": 0, "Boolean": 0}
    for col in df.columns:
        col_types[_classify_column(df[col])] += 1

    return {
        "numVariables": df.shape[1],
        "numObservations": df.shape[0],
        "missingCells": missing_cells,
        "missingCellsPct": missing_pct,
        "duplicateRows": dup_rows,
        "duplicateRowsPct": dup_pct,
        "totalMemory": f"{mem_mib} MiB",
        "variableTypes": col_types,
    }


def compute_column_stats(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Per-column statistics and distribution bins.

    For **numeric** columns the output includes min, max, mean, stdDev,
    zerosPct, negativePct, and histogram bins produced by
    ``_histogram_bins``.

    For **categorical / boolean** columns the output includes
    value-count bins from ``_categorical_bins``.
    """
    results: list[dict[str, Any]] = []
    n_rows = len(df)

    for col_name in df.columns:
        series = df[col_name]
        col_type = _classify_column(series)
        missing = int(series.isna().sum())
        missing_pct = _safe_round(missing / n_rows * 100, 1) if n_rows else 0.0
        distinct = int(series.nunique(dropna=True))

        entry: dict[str, Any] = {
            "name": col_name,
            "type": col_type,
            "distinct": distinct,
            "missing": missing,
            "missingPct": missing_pct,
        }

        if col_type == "Numeric":
            clean = pd.to_numeric(series, errors="coerce").dropna()
            if not clean.empty:
                entry["min"] = _safe_round(float(clean.min()))
                entry["max"] = _safe_round(float(clean.max()))
                entry["mean"] = _safe_round(float(clean.mean()))
                entry["stdDev"] = _safe_round(float(clean.std()))
                
                # Outliers using IQR
                q1 = clean.quantile(0.25)
                q3 = clean.quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                entry["outliersCount"] = int(((clean < lower_bound) | (clean > upper_bound)).sum())
                
                entry["skewness"] = _safe_round(float(clean.skew()))
                entry["kurtosis"] = _safe_round(float(clean.kurtosis()))
            else:
                entry["min"] = None
                entry["max"] = None
                entry["mean"] = None
                entry["stdDev"] = None
                entry["outliersCount"] = None
                entry["skewness"] = None
                entry["kurtosis"] = None

            zeros = int((clean == 0).sum())
            negatives = int((clean < 0).sum())
            total = len(clean) or 1
            entry["zerosPct"] = _safe_round(zeros / total * 100, 1)
            entry["negativePct"] = _safe_round(negatives / total * 100, 1)
            entry["distribution"] = _histogram_bins(clean)
        else:
            entry["min"] = None
            entry["max"] = None
            entry["mean"] = None
            entry["stdDev"] = None
            entry["zerosPct"] = None
            entry["negativePct"] = None
            entry["outliersCount"] = None
            entry["skewness"] = None
            entry["kurtosis"] = None
            entry["distribution"] = _categorical_bins(series)

        results.append(entry)

    return results


def compute_correlation_matrix(df: pd.DataFrame) -> tuple[list[dict[str, Any]], list[str]]:
    """Pearson correlation matrix for all numeric columns.

    Returns
    -------
    entries : list[dict]
        Flat list of ``{"row": ..., "col": ..., "value": ...}`` for every
        cell in the N×N matrix (including the diagonal).
    numeric_names : list[str]
        Ordered list of numeric column names used as axes.
    """
    numeric_cols = [
        c for c in df.columns if _classify_column(df[c]) == "Numeric"
    ]
    if not numeric_cols:
        return [], []

    corr = df[numeric_cols].corr(method="pearson")

    entries: list[dict[str, Any]] = []
    for r in numeric_cols:
        for c in numeric_cols:
            val = corr.loc[r, c]
            entries.append({
                "row": r,
                "col": c,
                "value": _safe_round(float(val)),
            })

    return entries, numeric_cols


def generate_alerts(
    df: pd.DataFrame,
    summary: dict[str, Any],
    columns: list[dict[str, Any]],
    correlation_entries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Rule-based alert generator.

    Checks three conditions:

    1. **Class Imbalance** — the last column's majority class exceeds 75 %
       of observations.
    2. **High Missingness** — any column has > 40 % missing values.
    3. **Multicollinearity** — any pair of distinct numeric features has
       a Pearson |r| > 0.85.
    """
    alerts: list[dict[str, Any]] = []

    # ── 1. Class imbalance (last column is the assumed target) ────────
    target_col = df.columns[-1]
    target_counts = df[target_col].value_counts(normalize=True)
    if not target_counts.empty and target_counts.iloc[0] > 0.75:
        majority_pct = int(round(target_counts.iloc[0] * 100))
        minority_pct = 100 - majority_pct
        alerts.append({
            "severity": "warning",
            "icon": "⚠️",
            "title": "Class Imbalance Detected",
            "message": (
                f"Target variable is imbalanced ({majority_pct}/{minority_pct} split). "
                "Consider using SMOTE oversampling in Step 3 to prevent the "
                "model from favoring the majority class."
            ),
        })

    # ── 2. High missingness ──────────────────────────────────────────
    for col_stat in columns:
        if col_stat["missingPct"] > 40:
            alerts.append({
                "severity": "severe",
                "icon": "⚠️",
                "title": "High Missingness",
                "message": (
                    f"Column '{col_stat['name']}' has {col_stat['missingPct']}% "
                    "missing data. Dropping or imputing this column is required "
                    "before training. Median imputation is recommended for "
                    "skewed distributions."
                ),
            })

    # ── 3. Multicollinearity ─────────────────────────────────────────
    seen_pairs: set[tuple[str, str]] = set()
    for entry in correlation_entries:
        r, c, v = entry["row"], entry["col"], entry["value"]
        if r == c:
            continue
        pair = tuple(sorted((r, c)))
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)  # type: ignore[arg-type]
        if abs(v) > 0.85:
            alerts.append({
                "severity": "info",
                "icon": "ℹ️",
                "title": "High Correlation (Multicollinearity)",
                "message": (
                    f"'{r}' and '{c}' have a Pearson correlation of "
                    f"{v:.2f}. Variables with >85% correlation can cause "
                    "Multicollinearity, confusing non-tree-based models. "
                    "Consider dropping one of these features in Step 3."
                ),
            })

    return alerts


# ── orchestrator ─────────────────────────────────────────────────────

def run_full_eda(df: pd.DataFrame) -> dict[str, Any]:
    """Run the complete EDA pipeline on a DataFrame.

    Returns a dict whose structure matches ``EDAProfileResponse``
    (and the frontend ``MockEDADataset`` interface).
    """
    summary = compute_summary(df)
    columns = compute_column_stats(df)
    corr_entries, numeric_names = compute_correlation_matrix(df)
    alerts = generate_alerts(df, summary, columns, corr_entries)

    return {
        "summary": summary,
        "alerts": alerts,
        "columns": columns,
        "correlationMatrix": corr_entries,
        "numericColumnNames": numeric_names,
    }
