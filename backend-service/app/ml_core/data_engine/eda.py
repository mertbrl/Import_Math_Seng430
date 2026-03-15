"""Exploratory Data Analysis engine.

All analytics live here — pure Pandas / NumPy with **no** HTTP or
FastAPI dependencies.  Each public function accepts a ``pd.DataFrame``
and returns plain dicts that map directly to the Pydantic schemas in
``app.schemas.exploration``.
"""

from __future__ import annotations

import math
import re
from typing import Any, cast

import numpy as np  # type: ignore
import pandas as pd  # type: ignore


# ── helpers ──────────────────────────────────────────────────────────

_ID_PATTERNS = re.compile(
    r"^(id|index|row[\s_]?id|patient[\s_]?id|patient[\s_]?no|"
    r"record[\s_]?id|case[\s_]?id|subject[\s_]?id|sample[\s_]?id|"
    r"serial|uid|uuid|_id)$",
    re.IGNORECASE,
)


def _is_id_column(series: pd.Series, col_name: str, n_rows: int) -> bool:
    """Detect identifier / leakage columns.

    A column is treated as an ID if:
    * Its name matches common patterns (id, index, patient_no, …), **or**
    * It has 100 % unique non-null values AND is not obviously a feature.
    """
    if _ID_PATTERNS.match(col_name.strip()):
        return True
    n_unique = series.nunique(dropna=True)
    if n_rows > 10 and n_unique == n_rows:
        return True
    return False


def _classify_column(series: pd.Series) -> str:
    """Determine if a column is Numeric, Boolean, or Categorical."""
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


def _safe_round(val: float | None, decimals: int = 2) -> float:
    """Round a float, returning 0.0 for NaN / Inf."""
    if val is None or math.isnan(val) or math.isinf(val):
        return 0.0
    return float(f"{val:.{decimals}f}")


def _numeric_series(series: pd.Series) -> pd.Series:
    """Convert to numeric Series (pyright-friendly wrapper around pd.to_numeric)."""
    numeric = pd.to_numeric(series, errors="coerce")
    if isinstance(numeric, pd.Series):
        return numeric
    return pd.Series(numeric, index=series.index)


def _detect_distribution_shape(series: pd.Series) -> str:
    """Heuristic detection of Unimodal / Bimodal / Multimodal."""
    clean = _numeric_series(series).dropna()
    if len(clean) < 10:
        return "Unimodal"
    hist, _ = np.histogram(clean.to_numpy(), bins=10)
    threshold = hist.mean() * 0.5
    peaks = sum(
        1
        for i in range(1, len(hist) - 1)
        if hist[i] > hist[i - 1] and hist[i] > hist[i + 1] and hist[i] > threshold
    )
    if peaks >= 3:
        return "Multimodal"
    if peaks == 2:
        return "Bimodal"
    return "Unimodal"


def _skewness_direction(skew: float | None) -> str | None:
    """Human-readable skewness description."""
    if skew is None:
        return None
    if abs(skew) < 0.5:
        return "Approximately Symmetric"
    if skew > 0:
        return "Right Skewed"
    return "Left Skewed"


def _histogram_bins(series: pd.Series, max_bins: int = 8) -> list[dict[str, Any]]:
    """Create labelled histogram bins for a numeric series."""
    clean = series.dropna()
    if clean.empty:
        return []

    n_unique = clean.nunique()
    n_bins = min(max_bins, max(n_unique, 2))

    try:
        # retbins=False makes the return type unambiguous for pyright.
        binned = cast(pd.Series, pd.cut(clean, bins=n_bins, include_lowest=True, retbins=False))
    except ValueError:
        return [{"label": str(clean.iloc[0]), "value": int(len(clean))}]

    counts = binned.value_counts(dropna=True).sort_index()
    result: list[dict[str, Any]] = []
    for interval, count in counts.items():
        interval = cast(pd.Interval, interval)
        left = _safe_round(float(interval.left))
        right = _safe_round(float(interval.right))
        if left == int(left) and right == int(right):
            label = f"{int(left)}-{int(right)}"
        else:
            label = f"{left}-{right}"
        result.append({"label": label, "value": int(count)})
    return result


def _categorical_bins(series: pd.Series, top_n: int = 10) -> list[dict[str, Any]]:
    """Value-count bins for categorical / boolean columns."""
    counts = cast(pd.Series, series).value_counts(dropna=True).head(top_n)
    return [{"label": str(k), "value": int(v)} for k, v in counts.items()]


# ── public API ───────────────────────────────────────────────────────

def detect_id_columns(df: pd.DataFrame) -> list[str]:
    """Directive 1: ID Column Isolation — returns names of detected ID columns."""
    id_cols: list[str] = []
    n_rows = len(df)
    for col in df.columns:
        col_name = str(col)
        series = cast(pd.Series, df[col_name])
        if _is_id_column(series, col_name, n_rows):
            id_cols.append(col_name)
    return id_cols


def compute_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Directive 2: Variable Types (single source of truth) + exec summary."""
    total_cells = df.shape[0] * df.shape[1]
    missing_cells = int(df.isna().sum().sum())
    missing_pct = _safe_round(missing_cells / total_cells * 100, 1) if total_cells else 0.0
    dup_rows = int(df.duplicated().sum())
    dup_pct = _safe_round(dup_rows / len(df) * 100, 1) if len(df) else 0.0
    mem_bytes = df.memory_usage(deep=True).sum()
    mem_mib = _safe_round(mem_bytes / (1024 * 1024), 1)

    col_types = {"Numeric": 0, "Categorical": 0, "Boolean": 0}
    for col in df.columns:
        col_name = str(col)
        series = cast(pd.Series, df[col_name])
        col_types[_classify_column(series)] += 1

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
    """Directive 4: Per-column stats + advanced distribution & skewness."""
    results: list[dict[str, Any]] = []
    n_rows = len(df)

    for col in df.columns:
        col_name = str(col)
        series = cast(pd.Series, df[col_name])
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
            clean = _numeric_series(series).dropna()
            if not clean.empty:
                skew_val = float(clean.skew())
                entry["min"] = _safe_round(float(clean.min()))
                entry["max"] = _safe_round(float(clean.max()))
                entry["mean"] = _safe_round(float(clean.mean()))
                entry["stdDev"] = _safe_round(float(clean.std()))

                # Outliers (IQR method)
                q1 = clean.quantile(0.25)
                q3 = clean.quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                entry["outliersCount"] = int(((clean < lower_bound) | (clean > upper_bound)).sum())

                entry["skewness"] = _safe_round(skew_val)
                entry["kurtosis"] = _safe_round(float(clean.kurtosis()))
                entry["distributionShape"] = _detect_distribution_shape(series)
                entry["skewnessDirection"] = _skewness_direction(skew_val)
            else:
                entry.update({
                    "min": None, "max": None, "mean": None, "stdDev": None,
                    "outliersCount": None, "skewness": None, "kurtosis": None,
                    "distributionShape": "Unimodal", "skewnessDirection": None,
                })

            zeros = int((clean == 0).sum()) if not clean.empty else 0  # type: ignore
            negatives = int((clean < 0).sum()) if not clean.empty else 0  # type: ignore
            total = len(clean) or 1
            entry["zerosPct"] = _safe_round(zeros / total * 100, 1)
            entry["negativePct"] = _safe_round(negatives / total * 100, 1)
            entry["distribution"] = _histogram_bins(clean)
        else:
            entry.update({
                "min": None, "max": None, "mean": None, "stdDev": None,
                "zerosPct": None, "negativePct": None,
                "outliersCount": None, "skewness": None, "kurtosis": None,
                "distributionShape": None, "skewnessDirection": None,
            })
            entry["distribution"] = _categorical_bins(series)

        results.append(entry)

    return results


def compute_correlation_matrix(
    df: pd.DataFrame,
    ignored_columns: list[str] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Directive 1: Pearson correlations excluding ID columns.
    Computes Pearson correlation for numeric columns only.
    Excludes explicitly ignored columns (ID/Metadata).
    Returns a flattened list of {row, col, value} suitable for a React Heatmap.
    """
    exclude_set = set(ignored_columns or [])
    numeric_cols: list[str] = []
    for col in df.columns:
        col_name = str(col)
        if col_name in exclude_set:
            continue
        series = cast(pd.Series, df[col_name])
        if _classify_column(series) == "Numeric":
            numeric_cols.append(col_name)
    if not numeric_cols:
        return [], []

    corr = df.loc[:, numeric_cols].corr(method="pearson")
    entries: list[dict[str, Any]] = []
    for r in numeric_cols:
        for c in numeric_cols:
            val = corr.loc[r, c]
            entries.append({"row": r, "col": c, "value": _safe_round(float(val))})

    return entries, numeric_cols


def generate_alerts(
    df: pd.DataFrame,
    summary: dict[str, Any],
    columns: list[dict[str, Any]],
    correlation_entries: list[dict[str, Any]],
    id_columns: list[str],
) -> list[dict[str, Any]]:
    """Directive 3: Actionable consultancy alerts (ISSUE / EXPLANATION / RECOMMENDATION)."""
    alerts: list[dict[str, Any]] = []
    id_set = set(id_columns)

    # ── 1. Class imbalance ────────────────────────────────────────────
    target_col = df.columns[-1]
    target_counts = df[target_col].value_counts(normalize=True)
    if not target_counts.empty and target_counts.iloc[0] > 0.75:
        majority_cls = str(target_counts.index[0])
        minority_cls = str(target_counts.index[-1]) if len(target_counts) > 1 else "—"
        majority_pct = int(round(target_counts.iloc[0] * 100))
        minority_pct = 100 - majority_pct
        alerts.append({
            "severity": "warning",
            "icon": "⚠️",
            "title": "Class Imbalance Detected",
            "message": (
                f"ISSUE: Severe class imbalance in target '{target_col}' — "
                f"class '{majority_cls}' = {majority_pct}%, class '{minority_cls}' = {minority_pct}%.\n\n"
                f"EXPLANATION: The model will suffer from majority-class bias, falsely achieving "
                f"high accuracy by ignoring minority cases. Precision and recall for the "
                f"minority class will be critically degraded.\n\n"
                f"STEP 3 RECOMMENDATION: Apply SMOTE to oversample the minority class, or use "
                f"class_weight='balanced' in the estimator. Evaluate with F1-Score and AUC-ROC "
                f"instead of raw Accuracy."
            ),
        })

    # ── 2. High missingness ───────────────────────────────────────────
    for col_stat in columns:
        if col_stat["name"] in id_set:
            continue
        if col_stat["missingPct"] > 40:
            alerts.append({
                "severity": "severe",
                "icon": "🚨",
                "title": f"Critical Missingness — {col_stat['name']}",
                "message": (
                    f"ISSUE: Column '{col_stat['name']}' has {col_stat['missingPct']}% missing data "
                    f"({col_stat['missing']}/{summary['numObservations']} cells).\n\n"
                    f"EXPLANATION: At >40% missing, simple imputation introduces massive bias. "
                    f"Models trained on poorly imputed columns will generalize poorly and may "
                    f"learn artefactual patterns.\n\n"
                    f"STEP 3 RECOMMENDATION: Consider dropping this column if it is non-critical, "
                    f"or apply KNN Imputation / MICE (Multiple Imputation by Chained Equations) "
                    f"with careful cross-validation."
                ),
            })

    # ── 3. Extreme skewness ───────────────────────────────────────────
    for col_stat in columns:
        if col_stat["name"] in id_set:
            continue
        skew = col_stat.get("skewness")
        if skew is not None and abs(skew) > 2:
            direction = "Right Skewed" if skew > 0 else "Left Skewed"
            alerts.append({
                "severity": "warning",
                "icon": "📊",
                "title": f"Extreme Skewness — {col_stat['name']}",
                "message": (
                    f"ISSUE: '{col_stat['name']}' is severely {direction} (skewness = {skew}).\n\n"
                    f"EXPLANATION: Non-normal distributions violate assumptions of linear models "
                    f"(Linear Regression, Logistic Regression, LDA). Distance-based models (KNN, "
                    f"SVM) will also be adversely affected by the tail, giving disproportionate "
                    f"weight to extreme values.\n\n"
                    f"STEP 3 RECOMMENDATION: Apply a log-transform (log1p) or Box-Cox transformation "
                    f"to normalize the distribution before training. For tree-based models, no "
                    f"transformation is required."
                ),
            })

    # ── 4. Massive outliers (>10% of rows) ────────────────────────────
    for col_stat in columns:
        if col_stat["name"] in id_set:
            continue
        outlier_count = col_stat.get("outliersCount")
        if outlier_count and outlier_count > summary["numObservations"] * 0.10:
            pct = _safe_round(outlier_count / summary["numObservations"] * 100, 1)
            alerts.append({
                "severity": "severe",
                "icon": "🔺",
                "title": f"Massive Outlier Presence — {col_stat['name']}",
                "message": (
                    f"ISSUE: '{col_stat['name']}' contains {outlier_count} outliers "
                    f"({pct}% of all rows), detected via the IQR method.\n\n"
                    f"EXPLANATION: At >10% outlier saturation, the mean and standard deviation "
                    f"are unreliable. Models relying on these moments (SVM, KNN, PCA) will be "
                    f"strongly biased toward the tails.\n\n"
                    f"STEP 3 RECOMMENDATION: Apply RobustScaler (uses IQR instead of mean/std) "
                    f"or winsorize the column by capping values at the 1st and 99th percentiles."
                ),
            })

    # ── 5. Multicollinearity ─────────────────────────────────────────
    seen_pairs: set[tuple[str, str]] = set()
    for entry in correlation_entries:
        r, c, v = entry["row"], entry["col"], entry["value"]
        if r == c or r in id_set or c in id_set:
            continue
        pair = tuple(sorted((r, c)))
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)  # type: ignore[arg-type]
        if abs(v) > 0.85:
            alerts.append({
                "severity": "info",
                "icon": "🔗",
                "title": f"Multicollinearity — {r} ↔ {c}",
                "message": (
                    f"ISSUE: '{r}' and '{c}' have a Pearson correlation of {v:.2f} "
                    f"(|r| > 0.85).\n\n"
                    f"EXPLANATION: Highly correlated features provide redundant information. "
                    f"Non-tree-based models (Logistic Regression, SVM) will have unstable "
                    f"coefficient estimates (variance inflation).\n\n"
                    f"STEP 3 RECOMMENDATION: Drop one of the two features, or apply PCA / "
                    f"Variance Inflation Factor (VIF) analysis to systematically reduce "
                    f"dimensionality. Tree-based models are largely unaffected."
                ),
            })

    # ── 6. ID column isolation notice ─────────────────────────────────
    if id_columns:
        id_col_str = ", ".join(f"'{c}'" for c in id_columns)
        alerts.append({
            "severity": "info",
            "icon": "🔒",
            "title": "ID Columns Isolated",
            "message": (
                f"ISSUE: {len(id_columns)} identifier column(s) detected: "
                f"{id_col_str}.\n\n"
                f"EXPLANATION: Identifier columns have near-100% cardinality and carry no "
                f"predictive signal. Including them in training would cause severe data leakage — "
                f"the model learns to memorize IDs instead of generalizing from features.\n\n"
                f"STEP 3 RECOMMENDATION: These columns have been automatically excluded from "
                f"correlations and distribution analysis. They MUST be dropped before model "
                f"training in Step 3."
            ),
        })

    return alerts


# ── preview ───────────────────────────────────────────────────────────

def compute_preview(df: pd.DataFrame, n_rows: int = 10) -> dict[str, Any]:
    """Directive 6: Excel-style data preview (first n rows)."""
    preview_df = df.head(n_rows)
    headers = list(preview_df.columns)
    rows: list[dict[str, Any]] = []
    for _, row in preview_df.iterrows():
        row_dict: dict[str, Any] = {}
        row_data = dict(row)  # type: ignore
        for col in headers:
            val = row_data.get(col)
            if isinstance(val, float) and math.isnan(val):
                row_dict[col] = None
            elif hasattr(val, "item") and callable(getattr(val, "item")):
                func: Any = getattr(val, "item")
                row_dict[col] = func()
            else:
                row_dict[col] = val
        rows.append(row_dict)
    return {"headers": headers, "rows": rows}


# ── missing-data mechanism analysis ──────────────────────────────────

def compute_missing_analysis(
    df: pd.DataFrame,
    id_columns: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Directive 5: Missing Values & Statistical Mechanisms (MCAR / MAR / MNAR).

    Also computes co-occurrence insights for Missingno Matrix visualization.
    """
    results: list[dict[str, Any]] = []
    id_set = set(id_columns or [])
    n_rows = len(df)
    numeric_df = df.select_dtypes(include=[np.number])

    # Build co-occurrence pairs for Missingno-style insight
    missing_cols = [c for c in df.columns if c not in id_set and df[c].isna().sum() > 0]  # type: ignore
    cooccurrence: dict[str, list[str]] = {}
    for i, ci in enumerate(missing_cols):
        mi = df[ci].isna()  # type: ignore
        for cj in missing_cols[i + 1:]:
            mj = df[cj].isna()  # type: ignore
            overlap = int((mi & mj).sum())
            if overlap > 0:
                cooccurrence.setdefault(ci, []).append(cj)
                cooccurrence.setdefault(cj, []).append(ci)

    for raw_col in df.columns:
        col = str(raw_col)
        if col in id_set:
            continue
        series = cast(pd.Series, df[col])
        missing_count = int(series.isna().sum())
        if missing_count == 0:
            continue

        missing_pct = _safe_round(missing_count / n_rows * 100, 2)
        col_type = _classify_column(series)
        miss_mask = series.isna().astype(int)

        # Check correlation of missingness with other numeric columns
        max_corr = 0.0
        corr_col = ""
        for other in numeric_df.columns:
            other_name = str(other)
            if other_name == col or other_name in id_set:
                continue
            other_series = cast(pd.Series, numeric_df[other_name])
            filled = other_series.fillna(other_series.median())
            corr_val = miss_mask.corr(filled)  # type: ignore
            if corr_val is None or math.isnan(corr_val):
                continue
            c = abs(float(corr_val))
            if c > max_corr:
                max_corr = c
                corr_col = other_name

        # MNAR heuristic: if missing_pct > 15% and skewness of non-missing is extreme
        is_mnar = False
        if col_type == "Numeric" and missing_pct > 15:
            clean = _numeric_series(series).dropna()
            if len(clean) > 10:
                skew = abs(float(clean.skew()))
                if skew > 2:
                    is_mnar = True

        # Classify mechanism
        if is_mnar:
            mechanism = "MNAR"
            mechanism_detail = (
                f"High missingness ({missing_pct}%) combined with extreme skewness in "
                f"non-missing values suggests the missing values themselves are extreme "
                f"(too high or too low to measure). Missingness likely depends on the "
                f"unobserved value."
            )
        elif max_corr > 0.15:
            mechanism = "MAR"
            mechanism_detail = (
                f"Correlated with '{corr_col}' (r={round(max_corr, 2)}). Missingness is "  # type: ignore
                f"predictable from other observed variables — data is Missing At Random."
            )
        else:
            mechanism = "MCAR"
            mechanism_detail = (
                "No strong predictor of missingness found across all observed variables. "
                "Data appears to be Missing Completely At Random."
            )

        # Co-occurrence insight
        co_cols = cooccurrence.get(col)
        if co_cols:
            mechanism_detail += (
                f"\n\nMissingno Insight: Missing values in '{col}' co-occur with "
                f"missing values in {', '.join(repr(co_cols[idx]) for idx in range(min(3, len(co_cols))))}. "
                f"This pattern should be visible as aligned gaps in the matrix."
            )

        # Collect missing row indices without relying on pandas __getitem__ overloads.
        missing_rows: list[Any] = []
        for idx, is_missing in zip(series.index, series.isna()):
            if bool(is_missing):
                missing_rows.append(idx)
                if len(missing_rows) >= 50:
                    break

        results.append({
            "column": col,
            "type": col_type,
            "missingCount": missing_count,
            "missingPct": missing_pct,
            "mechanism": mechanism,
            "mechanismDetail": mechanism_detail,
            "missingRows": missing_rows,
        })

    return results


# ── orchestrator ──────────────────────────────────────────────────────

def run_full_eda(df: pd.DataFrame, ignored_columns: list[str] | None = None) -> dict[str, Any]:
    """Run the complete AutoEDA pipeline implementing all 6 directives.

    Returns a dict whose structure matches ``EDAProfileResponse``
    (and the frontend ``MockEDADataset`` interface).
    """
    if df.empty:
        raise ValueError("Cannot perform EDA on an empty DataFrame.")

    # Directive 1: isolate ID columns
    # Note: id_columns are a subset of ignored_columns, but we detect them specifically
    # for the ID column alert and to ensure they are always excluded from correlations.
    id_columns = detect_id_columns(df)
    all_ignored = list(set(id_columns + (ignored_columns or [])))

    # Directive 2: variable types (single source of truth)
    summary = compute_summary(df)

    # Directive 4: column stats with distribution shape + skewness direction
    columns = compute_column_stats(df)

    # Directive 1: exclude ID columns from correlations
    corr_entries, numeric_names = compute_correlation_matrix(df, ignored_columns=all_ignored)

    # Directive 3: actionable 3-part consultancy alerts
    alerts = generate_alerts(df, summary, columns, corr_entries, id_columns)

    # Directive 6: Excel-style preview
    preview = compute_preview(df)

    # Directive 5: missing-value mechanism analysis
    missing_analysis = compute_missing_analysis(df, id_columns)

    return {
        "summary": summary,
        "alerts": alerts,
        "columns": columns,
        "correlationMatrix": corr_entries,
        "numericColumnNames": numeric_names,
        "preview": preview,
        "missingAnalysis": missing_analysis,
        "isolatedColumns": id_columns,
    }
