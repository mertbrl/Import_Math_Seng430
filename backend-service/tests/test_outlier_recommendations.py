from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.data_prep.step05_outliers import detect_distribution_and_outliers


def test_normal_series_prefers_zscore() -> None:
    rng = np.random.default_rng(0)
    series = pd.Series(rng.normal(0.0, 1.0, 500))

    stats = detect_distribution_and_outliers(series)

    assert stats["distribution"] == "Normal"
    assert stats["recommendation"] == "Z-Score"


def test_non_gaussian_unimodal_series_prefers_iqr() -> None:
    rng = np.random.default_rng(3)
    series = pd.Series(rng.gamma(shape=3.0, scale=1.0, size=300))

    stats = detect_distribution_and_outliers(series)

    assert stats["distribution"] in {"Highly Skewed", "Non-Gaussian"}
    assert stats["recommendation"] == "IQR"


def test_bimodal_series_prefers_isolation_forest() -> None:
    rng = np.random.default_rng(7)
    left_mode = rng.normal(-3.0, 0.5, 250)
    right_mode = rng.normal(3.0, 0.5, 250)
    series = pd.Series(np.concatenate([left_mode, right_mode]))

    stats = detect_distribution_and_outliers(series)

    assert stats["distribution"] in {"Bimodal", "Multimodal"}
    assert stats["recommendation"] == "Isolation Forest"
