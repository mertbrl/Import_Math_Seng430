from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.pipeline_service import pipeline_service
from app.services.ddata_model import train_task_service
from app.services.model_training import MODEL_PARAM_BOUNDS

router = APIRouter(tags=["models"])

class TrainStartRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    model: str = Field(default="knn")
    parameters: dict[str, Any] = Field(default_factory=dict)
    search_config: dict[str, Any] = Field(default_factory=dict)
    pipeline_config: dict[str, Any] = Field(default_factory=dict)


class TrainCancelRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    task_ids: list[str] = Field(default_factory=list)


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
        search_config=payload.search_config,
        pipeline_config=payload.pipeline_config,
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
        "cancelled_at": task.cancelled_at,
    }
    if task.status == "completed":
        response["result"] = task.result
    if task.status == "failed":
        response["error"] = task.error
    return response


@router.post("/models/train/cancel")
def cancel_training(payload: TrainCancelRequest) -> dict[str, Any]:
    return train_task_service.cancel_session(
        session_id=payload.session_id,
        task_ids=payload.task_ids,
    )
