"""Step 10 – Imbalance Handling (SMOTE only)"""

from typing import Any

import pandas as pd

from app.services.data_prep._column_resolution import resolve_column_name
from app.services.data_prep._dataframe_loader import load_dataframe


def recommend_smote_from_metadata(
    total_samples: int,
    minority_class_ratio: float,
    minority_sample_count: int,
    categorical_feature_ratio: float,
) -> dict[str, Any]:
    if minority_sample_count < 6:
        return {
            "is_recommended": False,
            "recommended_algorithm": "none",
            "ui_message": (
                f"SMOTE is not recommended because the minority class has only {minority_sample_count} "
                "samples. Standard SMOTE relies on k-nearest neighbors, and the default k=5 needs at least "
                "6 minority rows to generate stable synthetic points."
            ),
        }

    if minority_class_ratio >= 0.25:
        return {
            "is_recommended": False,
            "recommended_algorithm": "class_weights",
            "ui_message": (
                f"SMOTE is not recommended because the minority class already represents {minority_class_ratio:.1%} "
                f"of the dataset ({minority_sample_count}/{total_samples} rows). This is a mild imbalance, so "
                "algorithmic balancing such as class weights is usually safer and less likely to overfit than oversampling."
            ),
        }

    if categorical_feature_ratio > 0.5:
        return {
            "is_recommended": False,
            "recommended_algorithm": "smotenc",
            "ui_message": (
                f"Standard SMOTE is not recommended because {categorical_feature_ratio:.1%} of the features are categorical. "
                "Interpolating across many categorical columns can create unrealistic synthetic samples. "
                "Use SMOTENC instead so nominal features are handled correctly."
            ),
        }

    return {
        "is_recommended": True,
        "recommended_algorithm": "smote",
        "ui_message": (
            f"SMOTE is recommended because the minority class represents only {minority_class_ratio:.1%} "
            f"of the dataset ({minority_sample_count}/{total_samples} rows), and the feature mix is suitable "
            "for standard synthetic oversampling."
        ),
    }


def summarize_class_balance(df: pd.DataFrame, target_column: str) -> dict[str, Any]:
    target_column = resolve_column_name(df, target_column)
    if target_column not in df.columns:
        return {"error": f"Target column '{target_column}' not found in dataset."}

    value_counts = df[target_column].value_counts()
    total = len(df)

    class_distribution = [
        {
            "class": str(label),
            "count": int(count),
            "percentage": round(count / total * 100, 2) if total > 0 else 0.0,
        }
        for label, count in value_counts.items()
    ]

    if len(value_counts) < 2:
        return {
            "class_distribution": class_distribution,
            "imbalance_ratio": 1.0,
            "severity": "balanced",
            "recommendation": None,
            "recommended_algorithm": "none",
            "is_recommended": False,
            "ui_message": "SMOTE is not applicable because the target column contains fewer than two classes.",
            "minority_class_ratio": 1.0,
            "minority_sample_count": total,
            "categorical_feature_ratio": 0.0,
        }

    majority = int(value_counts.iloc[0])
    minority = int(value_counts.iloc[-1])
    ratio = round(majority / minority, 2)
    minority_class_ratio = minority / total if total > 0 else 0.0

    feature_df = df.drop(columns=[target_column], errors="ignore")
    feature_count = len(feature_df.columns)
    categorical_feature_count = sum(
        1 for column in feature_df.columns if not pd.api.types.is_numeric_dtype(feature_df[column])
    )
    categorical_feature_ratio = (
        categorical_feature_count / feature_count if feature_count > 0 else 0.0
    )

    recommendation_payload = recommend_smote_from_metadata(
        total_samples=total,
        minority_class_ratio=minority_class_ratio,
        minority_sample_count=minority,
        categorical_feature_ratio=categorical_feature_ratio,
    )

    if ratio > 3:
        severity = "severe"
    elif ratio > 1.5:
        severity = "moderate"
    else:
        severity = "balanced"

    return {
        "class_distribution": class_distribution,
        "imbalance_ratio": ratio,
        "severity": severity,
        "recommendation": recommendation_payload["recommended_algorithm"] if recommendation_payload["is_recommended"] else None,
        "recommended_algorithm": recommendation_payload["recommended_algorithm"],
        "is_recommended": recommendation_payload["is_recommended"],
        "ui_message": recommendation_payload["ui_message"],
        "minority_class_ratio": round(minority_class_ratio, 4),
        "minority_sample_count": minority,
        "categorical_feature_ratio": round(categorical_feature_ratio, 4),
    }


def analyze_class_balance(session_id: str, target_column: str, ignored_columns: list[str] | None = None) -> dict[str, Any]:
    """
    Analyzes the class distribution of the target column to detect imbalance.

    Imbalance Rules:
    - Majority/Minority ratio > 1.5: Moderate/Severe imbalance → Suggest SMOTE
    - Balanced: No action required

    NOTE: SMOTE/ADASYN must ONLY be applied to the Train Set.
    This endpoint returns analysis for the full dataset (for display purposes).
    The pipeline executor enforces train-only oversampling.
    """
    df = load_dataframe(session_id)
    if ignored_columns:
        df = df.drop(columns=[c for c in ignored_columns if c in df.columns], errors='ignore')

    return summarize_class_balance(df, target_column)
