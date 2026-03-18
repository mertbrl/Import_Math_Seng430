"""Step 05 – Outlier Handling (Dynamic Distribution-Aware)."""

from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import normaltest, skew
from sklearn.ensemble import IsolationForest

from app.services.data_prep._dataframe_loader import load_dataframe


def _detect_modality(clean_series: pd.Series) -> str:
    """Heuristically classify a numeric series as uni/bi/multimodal."""
    if len(clean_series) < 20:
        return "Unimodal"

    values = clean_series.to_numpy(dtype=float)
    bin_count = min(12, max(6, int(np.sqrt(len(values)))))
    hist, _ = np.histogram(values, bins=bin_count)

    if len(hist) < 3:
        return "Unimodal"

    threshold = max(hist.mean() * 0.5, 1.0)
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


def _normality_pvalue(clean_series: pd.Series) -> float | None:
    """Return a normality-test p-value when it can be computed safely."""
    if len(clean_series) < 8:
        return None

    try:
        _, p_value = normaltest(clean_series.to_numpy(dtype=float), nan_policy="omit")
    except Exception:
        return None

    if not np.isfinite(p_value):
        return None
    return float(p_value)


def _recommended_treatment(distribution: str, outlier_percentage: float) -> str:
    """Choose a safe default treatment after detection."""
    if distribution in {"Bimodal", "Multimodal"}:
        return "ignore"
    if outlier_percentage >= 5:
        return "cap_5_95"
    return "cap_1_99"


def _suggestion_reason(distribution: str, detector: str, treatment: str) -> str:
    """Short human-readable reason for the recommended plan."""
    if distribution == "Normal":
        return "Approximately Gaussian data supports Z-Score detection; winsorization preserves rows better than deletion."
    if distribution in {"Highly Skewed", "Non-Gaussian"}:
        return "The feature is not Gaussian enough for Z-Score, so IQR is safer and capping is preferred over dropping."
    if distribution in {"Bimodal", "Multimodal"}:
        return "Multiple peaks may represent real clinical subgroups, so detect with Isolation Forest but keep values unless manually reviewed."
    return f"Use {detector} for detection and {treatment} as the safest automatic action."


def detect_distribution_and_outliers(series: pd.Series) -> dict[str, Any]:
    """
    Analyzes a numerical pandas Series to determine its distribution shape,
    provides a handling recommendation, and calculates the outlier count.
    
    Distribution Rules:
    - Approximately Gaussian (Low Skew, Unimodal, passes normality): Recommend Z-Score
    - Unimodal but non-Gaussian / skewed: Recommend IQR
    - Bimodal / Multimodal: Recommend Isolation Forest
    """
    # Drop NaNs for statistical calculations
    clean_series = pd.to_numeric(series, errors="coerce").dropna()
    
    if len(clean_series) < 10:
        return {
            "distribution": "Too little data",
            "outlier_count": 0,
            "outlier_percentage": 0.0,
            "recommendation": "Ignore"
        }

    skew_value = float(skew(clean_series, bias=False))
    if not np.isfinite(skew_value):
        skew_value = 0.0

    abs_skew = abs(skew_value)
    modality = _detect_modality(clean_series)
    normality_p = _normality_pvalue(clean_series)
    is_approximately_normal = (
        modality == "Unimodal"
        and abs_skew < 0.5
        and normality_p is not None
        and normality_p >= 0.05
    )

    outlier_idx = pd.Series(False, index=clean_series.index)
    total_len = len(clean_series)
    
    if modality in {"Bimodal", "Multimodal"}:
        distribution = modality
        recommendation = "Isolation Forest"
        try:
            iso = IsolationForest(contamination=0.05, random_state=42)
            preds = iso.fit_predict(clean_series.values.reshape(-1, 1))
            outlier_idx.iloc[:] = (preds == -1)
        except Exception:
            pass

    elif is_approximately_normal:
        distribution = "Normal"
        recommendation = "Z-Score"
        mean = clean_series.mean()
        std = clean_series.std()
        if std > 0:
            z_scores = (clean_series - mean) / std
            outlier_idx = abs(z_scores) >= 3

    else:
        distribution = "Highly Skewed" if abs_skew >= 0.5 else "Non-Gaussian"
        recommendation = "IQR"
        q1 = clean_series.quantile(0.25)
        q3 = clean_series.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        outlier_idx = (clean_series < lower_bound) | (clean_series > upper_bound)

    outlier_count = int(outlier_idx.sum())
    outlier_percentage = round((outlier_count / total_len) * 100, 2) if total_len > 0 else 0.0
    recommended_treatment = _recommended_treatment(distribution, outlier_percentage)
    suggestion_reason = _suggestion_reason(distribution, recommendation, recommended_treatment)
    
    return {
        "distribution": distribution,
        "outlier_count": outlier_count,
        "outlier_percentage": outlier_percentage,
        "recommendation": recommendation,
        "recommended_detector": recommendation,
        "recommended_treatment": recommended_treatment,
        "suggestion_reason": suggestion_reason,
    }

def calculate_outlier_statistics(session_id: str, excluded_columns: list[str]) -> list[dict[str, Any]]:
    """
    Loads the session dataframe, filters to numerical columns only (excluding specified ones),
    and computes the smart outlier statistics for the frontend outliertab rendering.
    """
    df = load_dataframe(session_id)
    
    # Select only numeric types
    num_cols = df.select_dtypes(include=[np.number]).columns
    
    # Remove explicitly excluded columns (like ID, Target, or user-selected ignores)
    eligible_cols = [c for c in num_cols if c not in excluded_columns]
    
    results = []
    
    for col in eligible_cols:
        series = df[col]
        
        # Guard against fully null columns
        if series.isna().all():
            continue
            
        stats = detect_distribution_and_outliers(series)
        
        # Only include columns that *have* outliers or are somehow notable
        if stats["outlier_count"] > 0:
            results.append({
                "column": col,
                "type": "Numeric",
                "distribution": stats["distribution"],
                "outlier_count": stats["outlier_count"],
                "outlier_percentage": stats["outlier_percentage"],
                "recommendation": stats["recommendation"],
                "recommended_detector": stats["recommended_detector"],
                "recommended_treatment": stats["recommended_treatment"],
                "suggestion_reason": stats["suggestion_reason"],
            })
            
    # Sort with highest amount of outliers first
    results.sort(key=lambda x: x["outlier_percentage"], reverse=True)
    
    return results
