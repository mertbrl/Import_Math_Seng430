from fastapi import APIRouter

from app.schemas.request import ContextRequest
from app.schemas.response import ContextResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/context", tags=["context"])


@router.post("", response_model=ContextResponse)
def set_context(payload: ContextRequest) -> ContextResponse:
    result = pipeline_service.set_context(payload)
    return ContextResponse(session_id=payload.session_id, step="context", payload=result)
