from fastapi import APIRouter

from app.schemas.request import TrainRequest
from app.schemas.response import TrainResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/train", tags=["train"])


@router.post("", response_model=TrainResponse)
def train_model(payload: TrainRequest) -> TrainResponse:
    result = pipeline_service.train_model(payload)
    return TrainResponse(
        session_id=payload.session_id,
        step="train",
        model_id=result["model_id"],
        model=result["model"],
        parameters=result["parameters"],
    )
