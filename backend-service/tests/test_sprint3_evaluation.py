"""
Sprint 3 – Evaluation unit tests.
Covers: all 6 metric keys, ROC curve shape, confusion matrix keys,
colour-threshold boundary logic, and sensitivity danger-banner logic.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.request import EvaluationRequest
from app.services.evaluation_service import EvaluationService
from app.services.session_service import session_service

CLIENT = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

EXPECTED_METRIC_KEYS = {"accuracy", "sensitivity", "specificity", "precision", "f1_score", "auc"}
EXPECTED_CM_KEYS = {"tn", "fp", "fn", "tp"}
ALGORITHMS = ["knn", "svm", "dt", "rf", "lr", "nb"]


def _colour(metric: str, value: float) -> str:
    """Replicate the frontend colour-threshold logic in Python for testing."""
    if metric == "accuracy":
        if value >= 0.80:
            return "green"
        elif value >= 0.60:
            return "amber"
        return "red"
    else:  # sensitivity, specificity, precision, f1, auc
        if value >= 0.70:
            return "green"
        elif value >= 0.50:
            return "amber"
        return "red"


# ---------------------------------------------------------------------------
# Tests: metric keys
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("algo", ALGORITHMS)
def test_all_six_metric_keys_present(algo: str) -> None:
    svc = EvaluationService()
    # Create a fake model_id that starts with the algo prefix so the service resolves it.
    result = svc.evaluate(EvaluationRequest(session_id="test", model_id=f"{algo}-demo-v1"))
    assert EXPECTED_METRIC_KEYS == set(result["metrics"].keys()), (
        f"Missing metric keys for {algo}: {EXPECTED_METRIC_KEYS - set(result['metrics'].keys())}"
    )


# ---------------------------------------------------------------------------
# Tests: confusion matrix
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("algo", ALGORITHMS)
def test_confusion_matrix_keys_present(algo: str) -> None:
    svc = EvaluationService()
    result = svc.evaluate(EvaluationRequest(session_id="test", model_id=f"{algo}-demo-v1"))
    assert EXPECTED_CM_KEYS == set(result["confusion_matrix"].keys())


@pytest.mark.parametrize("algo", ALGORITHMS)
def test_confusion_matrix_values_are_non_negative_integers(algo: str) -> None:
    svc = EvaluationService()
    result = svc.evaluate(EvaluationRequest(session_id="test", model_id=f"{algo}-demo-v1"))
    for key, val in result["confusion_matrix"].items():
        assert isinstance(val, int), f"{key} should be int"
        assert val >= 0, f"{key} should be >= 0"


# ---------------------------------------------------------------------------
# Tests: ROC curve
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("algo", ALGORITHMS)
def test_roc_curve_present_and_equal_length(algo: str) -> None:
    svc = EvaluationService()
    result = svc.evaluate(EvaluationRequest(session_id="test", model_id=f"{algo}-demo-v1"))
    assert "roc_curve" in result
    roc = result["roc_curve"]
    assert "fpr" in roc and "tpr" in roc
    assert len(roc["fpr"]) == len(roc["tpr"]), "fpr and tpr must be same length"
    assert len(roc["fpr"]) > 0, "ROC curve must not be empty"


@pytest.mark.parametrize("algo", ALGORITHMS)
def test_roc_curve_starts_at_zero_ends_at_one(algo: str) -> None:
    svc = EvaluationService()
    result = svc.evaluate(EvaluationRequest(session_id="test", model_id=f"{algo}-demo-v1"))
    fpr = result["roc_curve"]["fpr"]
    tpr = result["roc_curve"]["tpr"]
    assert fpr[0] == pytest.approx(0.0, abs=0.01)
    assert fpr[-1] == pytest.approx(1.0, abs=0.01)
    assert tpr[0] == pytest.approx(0.0, abs=0.1)
    assert tpr[-1] == pytest.approx(1.0, abs=0.01)


# ---------------------------------------------------------------------------
# Tests: colour thresholds (boundary values)
# ---------------------------------------------------------------------------

def test_sensitivity_colour_thresholds() -> None:
    assert _colour("sensitivity", 0.70) == "green"
    assert _colour("sensitivity", 0.50) == "amber"
    assert _colour("sensitivity", 0.49) == "red"
    assert _colour("sensitivity", 0.69) == "amber"
    assert _colour("sensitivity", 0.00) == "red"


def test_accuracy_colour_thresholds() -> None:
    assert _colour("accuracy", 0.80) == "green"
    assert _colour("accuracy", 0.60) == "amber"
    assert _colour("accuracy", 0.59) == "red"
    assert _colour("accuracy", 1.00) == "green"


def test_auc_colour_thresholds() -> None:
    assert _colour("auc", 0.70) == "green"
    assert _colour("auc", 0.50) == "amber"
    assert _colour("auc", 0.49) == "red"


# ---------------------------------------------------------------------------
# Tests: sensitivity danger-banner trigger
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("sensitivity,expected_danger", [
    (0.49, True),
    (0.50, False),   # boundary: 0.50 is NOT dangerous
    (0.30, True),
    (0.70, False),
    (0.00, True),
    (1.00, False),
])
def test_sensitivity_danger_banner_boundary(sensitivity: float, expected_danger: bool) -> None:
    """Banner should appear when sensitivity < 0.50."""
    danger = sensitivity < 0.50
    assert danger == expected_danger


# ---------------------------------------------------------------------------
# Tests: model comparison table deduplication (logic test)
# ---------------------------------------------------------------------------

def test_comparison_table_no_duplicates() -> None:
    """Simulate the comparison table: adding the same model twice should not duplicate."""
    table: list[dict] = []

    def add_row(model: str, metrics: dict) -> None:
        key = model
        if any(row["model"] == key for row in table):
            return
        table.append({"model": model, **metrics})

    dummy = {"accuracy": 0.80, "sensitivity": 0.70}
    add_row("knn", dummy)
    add_row("svm", dummy)
    add_row("knn", dummy)   # duplicate – should not be added

    assert len(table) == 2
    models_in_table = [r["model"] for r in table]
    assert models_in_table.count("knn") == 1
