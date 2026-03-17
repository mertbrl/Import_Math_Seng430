from fastapi import APIRouter

from app.schemas.request import FairnessRequest
from app.schemas.response import FairnessResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/fairness", tags=["fairness"])


@router.post("", response_model=FairnessResponse)
def check_fairness(payload: FairnessRequest) -> FairnessResponse:
    result = pipeline_service.check_fairness(payload)
    return FairnessResponse(
        session_id=payload.session_id,
        step="fairness",
        subgroup_metrics=result["subgroup_metrics"],
        warnings=result["warnings"],
    )
