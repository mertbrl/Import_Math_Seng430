import pandas as pd

from app.services.data_prep.step09_dimensionality import (
    _calculate_vif_scores,
    drop_multicollinear_features_iteratively,
)


def test_iterative_vif_drops_only_the_worst_feature_each_round() -> None:
    X = pd.DataFrame(
        {
            "x1": [1, 2, 3, 4, 5, 6, 7, 8],
            "x2": [2, 4, 6, 8, 10, 12, 14, 16],
            "x3": [1, 1, 2, 3, 5, 8, 13, 21],
        }
    )

    filtered, dropped = drop_multicollinear_features_iteratively(X, threshold=10.0)

    assert dropped == ["x1"] or dropped == ["x2"]
    assert filtered.shape[1] == 2

    remaining_vif = _calculate_vif_scores(filtered)
    assert (remaining_vif <= 10.0).all()


def test_iterative_vif_can_drop_multiple_features_until_threshold_is_satisfied() -> None:
    X = pd.DataFrame(
        {
            "x1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            "x2": [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
            "x3": [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
            "x4": [1, 4, 2, 5, 3, 6, 4, 7, 5, 8],
        }
    )

    filtered, dropped = drop_multicollinear_features_iteratively(X, threshold=5.0)

    assert len(dropped) == 2
    assert list(filtered.columns) == ["x3", "x4"] or list(filtered.columns) == ["x2", "x4"] or list(filtered.columns) == ["x1", "x4"]
    assert (_calculate_vif_scores(filtered) <= 5.0).all()


def test_iterative_vif_rejects_non_numeric_columns() -> None:
    X = pd.DataFrame(
        {
            "num": [1.0, 2.0, 3.0, 4.0],
            "cat": ["a", "b", "a", "b"],
        }
    )

    try:
        drop_multicollinear_features_iteratively(X)
    except ValueError as exc:
        assert "Non-numeric columns" in str(exc)
    else:
        raise AssertionError("Expected ValueError for non-numeric input.")


def test_iterative_vif_respects_protected_features() -> None:
    X = pd.DataFrame(
        {
            "x1": [1, 2, 3, 4, 5, 6, 7, 8],
            "x2": [2, 4, 6, 8, 10, 12, 14, 16],
            "x3": [1, 1, 2, 3, 5, 8, 13, 21],
        }
    )

    filtered, dropped = drop_multicollinear_features_iteratively(
        X,
        threshold=10.0,
        protected_features=["x1"],
    )

    assert "x1" in filtered.columns
    assert dropped == ["x2"]
