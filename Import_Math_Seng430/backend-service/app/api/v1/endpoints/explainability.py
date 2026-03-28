from fastapi import APIRouter

from app.schemas.request import ExplainabilityRequest
from app.schemas.response import ExplainabilityResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/explainability", tags=["explainability"])


@router.post("", response_model=ExplainabilityResponse)
def explain_prediction(payload: ExplainabilityRequest) -> ExplainabilityResponse:
    result = pipeline_service.explain(payload)
    return ExplainabilityResponse(
        session_id=payload.session_id,
        step="explainability",
        global_importance=result["global_importance"],
        local_explanation=result["local_explanation"],
    )
