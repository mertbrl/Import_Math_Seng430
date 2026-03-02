from fastapi import APIRouter

from app.schemas.request import EvaluationRequest
from app.schemas.response import EvaluationResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.post("", response_model=EvaluationResponse)
def evaluate_model(payload: EvaluationRequest) -> EvaluationResponse:
    result = pipeline_service.evaluate_model(payload)
    return EvaluationResponse(
        session_id=payload.session_id,
        step="evaluation",
        metrics=result["metrics"],
        confusion_matrix=result["confusion_matrix"],
    )
