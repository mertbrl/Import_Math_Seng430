from app.core.exceptions import PipelineError
from app.ml_core.model_engine.base_model import BaseModelEngine


class DummyModel(BaseModelEngine):
    def __init__(self, name: str, params: dict[str, object]) -> None:
        self._name = name
        self._params = params

    def fit(self, features: list[list[float]], target: list[int]) -> None:
        _ = features, target

    def predict(self, features: list[list[float]]) -> list[int]:
        return [0 for _ in features]

    def get_params(self) -> dict[str, object]:
        return {"model": self._name, **self._params}


def build_model(model_name: str, params: dict[str, object]) -> BaseModelEngine:
    allowed = {"knn", "svm", "dt", "rf", "lr", "nb"}
    if model_name not in allowed:
        raise PipelineError(f"Unsupported model '{model_name}'.")
    return DummyModel(model_name, params)
