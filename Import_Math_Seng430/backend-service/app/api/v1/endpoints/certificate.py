from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.schemas.request import CertificateRequest
from app.schemas.response import CertificateResponse
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/certificate", tags=["certificate"])


class CertificateGenerateRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    participant: str = Field(default="Demo User")
    organization: str = Field(default="Demo Hospital")


@router.post("/generate", response_model=CertificateResponse)
def generate_certificate(payload: CertificateGenerateRequest) -> CertificateResponse:
    request = CertificateRequest(
        session_id=payload.session_id,
        participant=payload.participant,
        organization=payload.organization,
    )
    result = pipeline_service.build_certificate(request)
    return CertificateResponse(
        session_id=payload.session_id,
        step="certificate",
        participant=result["participant"],
        summary=result["summary"],
        checklist=result["checklist"],
    )
