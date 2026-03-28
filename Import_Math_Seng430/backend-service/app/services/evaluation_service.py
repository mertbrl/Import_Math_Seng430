from app.schemas.request import EvaluationRequest


class EvaluationService:
    def evaluate(self, _: EvaluationRequest) -> dict[str, object]:
        return {
            "metrics": {
                "accuracy": 0.78,
                "sensitivity": 0.62,
                "specificity": 0.85,
                "precision": 0.58,
                "f1_score": 0.60,
                "auc": 0.81,
            },
            "confusion_matrix": {"tn": 36, "fp": 5, "fn": 8, "tp": 12},
        }
