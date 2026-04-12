from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit_report,
    certificate,
    data,
    health,
    insights,
    model,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(data.router)
api_router.include_router(model.router)
api_router.include_router(insights.router)
api_router.include_router(certificate.router)
api_router.include_router(audit_report.router)
