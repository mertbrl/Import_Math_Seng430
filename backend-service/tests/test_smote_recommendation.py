import pandas as pd

from app.services.data_prep.step10_imbalance import recommend_smote_from_metadata, summarize_class_balance


def test_smote_not_recommended_when_minority_count_is_too_small() -> None:
    result = recommend_smote_from_metadata(
        total_samples=100,
        minority_class_ratio=0.05,
        minority_sample_count=5,
        categorical_feature_ratio=0.2,
    )

    assert result["is_recommended"] is False
    assert result["recommended_algorithm"] == "none"
    assert "only 5 samples" in result["ui_message"]


def test_smote_not_recommended_for_mild_imbalance() -> None:
    result = recommend_smote_from_metadata(
        total_samples=100,
        minority_class_ratio=0.3,
        minority_sample_count=30,
        categorical_feature_ratio=0.2,
    )

    assert result["is_recommended"] is False
    assert result["recommended_algorithm"] == "class_weights"
    assert "mild imbalance" in result["ui_message"]


def test_smotenc_is_recommended_when_categorical_features_dominate() -> None:
    result = recommend_smote_from_metadata(
        total_samples=200,
        minority_class_ratio=0.1,
        minority_sample_count=20,
        categorical_feature_ratio=0.75,
    )

    assert result["is_recommended"] is False
    assert result["recommended_algorithm"] == "smotenc"
    assert "SMOTENC" in result["ui_message"]


def test_smote_is_recommended_for_clear_numeric_imbalance() -> None:
    result = recommend_smote_from_metadata(
        total_samples=200,
        minority_class_ratio=0.1,
        minority_sample_count=20,
        categorical_feature_ratio=0.25,
    )

    assert result["is_recommended"] is True
    assert result["recommended_algorithm"] == "smote"
    assert "SMOTE is recommended" in result["ui_message"]


def test_summarize_class_balance_exposes_metadata_driven_smotenc_decision() -> None:
    df = pd.DataFrame(
        {
            "cat_a": (["a", "b"] * 15),
            "cat_b": (["x", "x", "y", "y", "x"] * 6),
            "num_a": [float(index) for index in range(30)],
            "target": ([0] * 24) + ([1] * 6),
        }
    )

    result = summarize_class_balance(df, "target")

    assert result["is_recommended"] is False
    assert result["recommended_algorithm"] == "smotenc"
    assert result["categorical_feature_ratio"] > 0.5


def test_summarize_class_balance_resolves_target_name_case_and_format() -> None:
    df = pd.DataFrame(
        {
            "Diagnosis": ["B", "B", "B", "B", "M", "M"],
            "radius_mean": [1.0, 1.1, 1.2, 1.3, 2.0, 2.1],
        }
    )

    result = summarize_class_balance(df, "diagnosis")

    assert "error" not in result
    assert result["minority_sample_count"] == 2
