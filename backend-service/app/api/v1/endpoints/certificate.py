from fastapi import APIRouter, HTTPException
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


from fastapi.responses import StreamingResponse
from app.schemas.request import CertificateDownloadRequest
from app.services.pdf_service import pdf_service

@router.post("/download-pdf", response_class=StreamingResponse)
def download_pdf(payload: CertificateDownloadRequest) -> StreamingResponse:
    metric_values = [
        payload.accuracy,
        payload.precision,
        payload.sensitivity,
        payload.specificity,
        payload.f1_score,
        payload.auc,
    ]
    if not any(value is not None for value in metric_values):
        raise HTTPException(
            status_code=422,
            detail="Audit PDF requires model performance metrics from the selected run.",
        )

    pdf_buffer = pdf_service.generate_model_validation_pdf(payload)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="health_ai_model_validation_certificate_{payload.run_id}.pdf"'}
    )
