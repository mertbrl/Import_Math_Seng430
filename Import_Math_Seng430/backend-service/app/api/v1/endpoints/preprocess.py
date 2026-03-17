from fastapi import APIRouter

from app.schemas.request import PreprocessRequest
from app.schemas.response import PreprocessResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/preprocess", tags=["preprocess"])


@router.post("", response_model=PreprocessResponse)
def preprocess_data(payload: PreprocessRequest) -> PreprocessResponse:
    recipe = pipeline_service.apply_preprocessing(payload)
    return PreprocessResponse(session_id=payload.session_id, step="preprocess", recipe=recipe)
