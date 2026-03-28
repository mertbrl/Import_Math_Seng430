from app.schemas.request import TrainRequest


MODEL_DEFAULTS: dict[str, dict[str, object]] = {
    "knn": {"k": 5},
    "svm": {"kernel": "rbf", "c": 1.0},
    "dt": {"max_depth": 5},
    "rf": {"n_estimators": 100, "max_depth": 10},
    "lr": {"c": 1.0, "max_iter": 1000},
    "nb": {"var_smoothing": 1e-9},
}


class TrainingService:
    def train(self, payload: TrainRequest) -> dict[str, object]:
        defaults = MODEL_DEFAULTS.get(payload.algorithm, {})
        params = {**defaults, **payload.parameters}
        model_id = f"{payload.algorithm}-demo-v1"
        return {
            "model_id": model_id,
            "model": payload.algorithm,
            "parameters": params,
        }

    def list_models(self) -> list[str]:
        return list(MODEL_DEFAULTS.keys())
