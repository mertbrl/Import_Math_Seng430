from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.schemas.request import ExplainabilityLocalRequest
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/insights", tags=["insights"])


class ExplainGlobalRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    run_id: str = Field(default="run-1")


class ExplainLocalRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    run_id: str = Field(default="run-1")
    patient_id: str = Field(default="patient-47")


class FairnessInsightRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    run_id: str = Field(default="run-1")


@router.post("/explain/global")
def explain_global(payload: ExplainGlobalRequest) -> dict[str, object]:
    return pipeline_service.get_explainability_global(payload.session_id, payload.run_id)


@router.post("/explain/local")
def explain_local(payload: ExplainLocalRequest) -> dict[str, object]:
    return pipeline_service.get_explainability_local(
        payload.session_id,
        payload.run_id,
        ExplainabilityLocalRequest(patient_id=payload.patient_id),
    )


@router.post("/fairness")
def fairness_insight(payload: FairnessInsightRequest) -> dict[str, object]:
    result = pipeline_service.get_fairness(payload.session_id, payload.run_id)
    subgroup_metrics = result.get("subgroup_metrics", [])
    avg_sensitivity = sum(float(item.get("sensitivity", 0.0)) for item in subgroup_metrics) / max(len(subgroup_metrics), 1)
    bias_detected = any((avg_sensitivity - float(item.get("sensitivity", 0.0))) > 0.10 for item in subgroup_metrics)
    result["bias_detected"] = bias_detected
    result["bias_threshold"] = 0.10
    return result
