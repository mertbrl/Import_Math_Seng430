"""Step 05 – Outlier Handling (Dynamic Distribution-Aware)"""

import warnings
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import skew, kurtosis
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.cluster import DBSCAN

from app.core.exceptions import PipelineError
from app.services.data_prep._dataframe_loader import load_dataframe

def detect_distribution_and_outliers(series: pd.Series) -> dict[str, Any]:
    """
    Analyzes a numerical pandas Series to determine its distribution shape,
    provides a handling recommendation, and calculates the outlier count.
    
    Distribution Rules:
    - Normal/Gaussian (Low Skew, Unimodal): Recommend Z-Score
    - Highly Skewed (Left/Right): Recommend IQR
    - Bimodal / Multimodal: Recommend Isolation Forest
    """
    # Drop NaNs for statistical calculations
    clean_series = series.dropna()
    
    if len(clean_series) < 10:
        return {
            "distribution": "Too little data",
            "outlier_count": 0,
            "outlier_percentage": 0.0,
            "recommendation": "Ignore"
        }

    # 1. Calculate Skewness to check for Gaussian vs Highly Skewed
    s = skew(clean_series)
    abs_skew = abs(s)
    
    # 2. Heuristic for Multimodality using Bimodality Coefficient (BC)
    # BC = (skew^2 + 1) / (kurtosis + 3*(n-1)^2 / ((n-2)*(n-3)))
    # A BC > 0.555 (uniform distribution value) broadly indicates multimodality.
    is_multimodal = False
    n = len(clean_series)
    if n > 3:
        k = kurtosis(clean_series, fisher=True) # excess kurtosis
        bc = (s**2 + 1) / (k + 3 * ((n - 1)**2) / ((n - 2) * (n - 3)))
        if bc > 0.555:
            is_multimodal = True
        
    # 3. Determine Recommendation & detect outliers
    outlier_idx = pd.Series(False, index=clean_series.index)
    total_len = len(clean_series)
    
    if is_multimodal:
        distribution = "Multimodal"
        if total_len > 100:
            recommendation = "DBSCAN"
            try:
                # Naive eps heuristic based on standard deviation
                eps = clean_series.std() / 2.0 if clean_series.std() > 0 else 0.5
                dbscan = DBSCAN(eps=eps, min_samples=5)
                preds = dbscan.fit_predict(clean_series.values.reshape(-1, 1))
                # DBSCAN uses -1 for noise (outliers)
                outlier_idx.iloc[:] = (preds == -1)
            except Exception:
                pass
        else:
            recommendation = "Isolation Forest"
            try:
                iso = IsolationForest(contamination=0.05, random_state=42)
                preds = iso.fit_predict(clean_series.values.reshape(-1, 1))
                # Predictions: 1 = inlier, -1 = outlier
                outlier_idx.iloc[:] = (preds == -1)
            except Exception:
                pass

    elif abs_skew > 2.0:
        distribution = "Extremely Skewed"
        recommendation = "LOF"
        # Local Outlier Factor
        try:
            # Fallback to smaller n_neighbors if very little data
            n_neighbors = min(20, total_len - 1)
            lof = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=0.05)
            preds = lof.fit_predict(clean_series.values.reshape(-1, 1))
            outlier_idx.iloc[:] = (preds == -1)
        except Exception:
            pass

    elif abs_skew > 1.0:
        distribution = "Highly Skewed"
        recommendation = "IQR"
        # IQR Outlier Detection
        q1 = clean_series.quantile(0.25)
        q3 = clean_series.quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        outlier_idx = (clean_series < lower_bound) | (clean_series > upper_bound)
        
    else:
        distribution = "Normal"
        recommendation = "Z-Score"
        # Z-Score Outlier Detection (Threshold = 3)
        mean = clean_series.mean()
        std = clean_series.std()
        if std > 0:
            z_scores = (clean_series - mean) / std
            outlier_idx = abs(z_scores) >= 3

    outlier_count = int(outlier_idx.sum())
    
    return {
        "distribution": distribution,
        "outlier_count": outlier_count,
        "outlier_percentage": round((outlier_count / total_len) * 100, 2) if total_len > 0 else 0.0,
        "recommendation": recommendation,
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
                "recommendation": stats["recommendation"]
            })
            
    # Sort with highest amount of outliers first
    results.sort(key=lambda x: x["outlier_percentage"], reverse=True)
    
    return results
