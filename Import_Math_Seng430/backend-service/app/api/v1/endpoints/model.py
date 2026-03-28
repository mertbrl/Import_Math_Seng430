from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.pipeline_service import pipeline_service
from app.services.train_task_service import train_task_service

router = APIRouter(tags=["models"])

MODEL_PARAM_BOUNDS: dict[str, dict[str, Any]] = {
    "knn": {"k": {"type": "int", "min": 1, "max": 25, "default": 5}},
    "svm": {
        "kernel": {"type": "enum", "values": ["linear", "rbf", "poly"], "default": "rbf"},
        "c": {"type": "float", "min": 0.01, "max": 100.0, "default": 1.0},
    },
    "dt": {"max_depth": {"type": "int", "min": 1, "max": 15, "default": 5}},
    "rf": {
        "n_estimators": {"type": "int", "min": 10, "max": 300, "default": 100},
        "max_depth": {"type": "int", "min": 1, "max": 20, "default": 10},
    },
    "lr": {
        "c": {"type": "float", "min": 0.01, "max": 100.0, "default": 1.0},
        "max_iter": {"type": "int", "min": 100, "max": 2000, "default": 1000},
    },
    "nb": {"var_smoothing": {"type": "float", "min": 1e-12, "max": 1e-6, "default": 1e-9}},
}


class TrainStartRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    model: str = Field(default="knn")
    parameters: dict[str, Any] = Field(default_factory=dict)


def _model_catalog_response() -> dict[str, list[dict[str, Any]]]:
    return {
        "models": [
            {"name": model_name, "parameters": MODEL_PARAM_BOUNDS.get(model_name, {})}
            for model_name in pipeline_service.list_models()
        ]
    }


@router.get("/models")
def models_catalog() -> dict[str, list[dict[str, Any]]]:
    return _model_catalog_response()


@router.post("/models/train/start")
def start_training(payload: TrainStartRequest) -> dict[str, Any]:
    task = train_task_service.start(
        session_id=payload.session_id,
        algorithm=payload.model,
        parameters=payload.parameters,
    )
    return {
        "task_id": task.task_id,
        "session_id": task.session_id,
        "status": task.status,
        "created_at": task.created_at,
    }


@router.get("/models/train/status/{task_id}")
def training_status(task_id: str) -> dict[str, Any]:
    task = train_task_service.get(task_id)
    response = {
        "task_id": task.task_id,
        "session_id": task.session_id,
        "status": task.status,
        "created_at": task.created_at,
        "started_at": task.started_at,
        "finished_at": task.finished_at,
    }
    if task.status == "completed":
        response["result"] = task.result
    if task.status == "failed":
        response["error"] = task.error
    return response
