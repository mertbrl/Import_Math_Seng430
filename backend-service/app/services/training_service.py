from __future__ import annotations

from typing import Any

from app.schemas.request import TrainRequest
from app.services.model_training import (
    MODEL_PARAM_BOUNDS,
    ModelSearchService,
    SklearnEstimatorFactory,
    TrainingDatasetBuilder,
    TrainingMetricsService,
    list_supported_models,
    sanitize_search_config,
    sanitize_model_params,
)
from app.services.model_training.control import ShouldCancel, raise_if_cancelled


class TrainingService:
    def __init__(self) -> None:
        self._dataset_builder = TrainingDatasetBuilder()
        self._estimator_factory = SklearnEstimatorFactory()
        self._search_service = ModelSearchService(self._estimator_factory)
        self._metrics_service = TrainingMetricsService()

    def train(self, payload: TrainRequest, *, should_cancel: ShouldCancel | None = None) -> dict[str, Any]:
        data = self._dataset_builder.prepare(payload.session_id, payload.pipeline_config)
        raise_if_cancelled(should_cancel)
        params = sanitize_model_params(payload.algorithm, payload.parameters)
        search_config = sanitize_search_config(payload.algorithm, payload.search_config)

        if payload.algorithm == "knn":
            params["k"] = max(1, min(int(params["k"]), len(data.X_train)))

        search_result = self._search_service.fit(
            algorithm=payload.algorithm,
            parameters=params,
            search_config=search_config,
            X_train=data.X_train,
            y_train=data.y_train,
            class_names=data.class_names,
            should_cancel=should_cancel,
        )
        raise_if_cancelled(should_cancel)

        evaluation = self._metrics_service.evaluate(
            estimator=search_result.estimator,
            algorithm=payload.algorithm,
            data=data,
        )
        raise_if_cancelled(should_cancel)

        return {
            "model_id": f"{payload.algorithm}-sklearn-v1",
            "model": payload.algorithm,
            "parameters": search_result.parameters,
            "search": search_result.summary,
            **evaluation,
        }

    def list_models(self) -> list[str]:
        return list_supported_models()

    def get_model_param_bounds(self) -> dict[str, dict[str, Any]]:
        return MODEL_PARAM_BOUNDS
