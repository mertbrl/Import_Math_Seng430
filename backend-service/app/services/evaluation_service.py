import math
from app.schemas.request import EvaluationRequest


# Realistic simulated metrics per algorithm so each model looks meaningfully different.
_MODEL_METRICS: dict[str, dict[str, float]] = {
    "knn":  {"accuracy": 0.76, "sensitivity": 0.61, "specificity": 0.83, "precision": 0.57, "f1_score": 0.59, "auc": 0.79},
    "svm":  {"accuracy": 0.82, "sensitivity": 0.72, "specificity": 0.88, "precision": 0.71, "f1_score": 0.71, "auc": 0.86},
    "dt":   {"accuracy": 0.73, "sensitivity": 0.58, "specificity": 0.81, "precision": 0.54, "f1_score": 0.56, "auc": 0.74},
    "rf":   {"accuracy": 0.85, "sensitivity": 0.76, "specificity": 0.90, "precision": 0.78, "f1_score": 0.77, "auc": 0.89},
    "lr":   {"accuracy": 0.80, "sensitivity": 0.68, "specificity": 0.86, "precision": 0.67, "f1_score": 0.68, "auc": 0.84},
    "nb":   {"accuracy": 0.71, "sensitivity": 0.65, "specificity": 0.74, "precision": 0.52, "f1_score": 0.58, "auc": 0.77},
}

_DEFAULT_METRICS = {"accuracy": 0.78, "sensitivity": 0.62, "specificity": 0.85, "precision": 0.58, "f1_score": 0.60, "auc": 0.81}

_MODEL_CM: dict[str, dict[str, int]] = {
    "knn":  {"tn": 35, "fp": 6,  "fn": 9,  "tp": 11},
    "svm":  {"tn": 38, "fp": 4,  "fn": 6,  "tp": 13},
    "dt":   {"tn": 33, "fp": 8,  "fn": 11, "tp": 9},
    "rf":   {"tn": 39, "fp": 3,  "fn": 5,  "tp": 14},
    "lr":   {"tn": 37, "fp": 5,  "fn": 7,  "tp": 12},
    "nb":   {"tn": 32, "fp": 9,  "fn": 8,  "tp": 12},
}

_DEFAULT_CM = {"tn": 36, "fp": 5, "fn": 8, "tp": 12}

_N_ROC_POINTS = 50


def _roc_curve(auc: float) -> dict[str, list[float]]:
    """
    Generate a smooth simulated ROC curve with the given AUC.
    Uses a beta-distribution-like shape so higher AUC = curve closer to top-left.
    """
    fpr: list[float] = []
    tpr: list[float] = []
    for i in range(_N_ROC_POINTS + 1):
        t = i / _N_ROC_POINTS          # fpr value 0..1
        # Approximate TPR via power function: tpr = t^(1/alpha) where alpha relates to AUC.
        # auc ≈ alpha/(alpha+1)  →  alpha = auc/(1-auc)
        alpha = auc / max(1 - auc, 1e-6)
        tpr_val = t ** (1.0 / max(alpha, 0.01))
        fpr.append(round(t, 4))
        tpr.append(round(tpr_val, 4))
    return {"fpr": fpr, "tpr": tpr}


def _extract_algo(model_id: str) -> str:
    """Infer the algorithm abbreviation from a model_id like 'knn-demo-v1-run-1'."""
    for key in _MODEL_METRICS:
        if model_id.startswith(key):
            return key
    return ""


class EvaluationService:
    def evaluate(self, request: EvaluationRequest) -> dict[str, object]:
        algo = _extract_algo(request.model_id or "")
        metrics = _MODEL_METRICS.get(algo, _DEFAULT_METRICS)
        cm = _MODEL_CM.get(algo, _DEFAULT_CM)
        roc = _roc_curve(metrics["auc"])
        return {
            "metrics": metrics,
            "confusion_matrix": cm,
            "roc_curve": roc,
        }
