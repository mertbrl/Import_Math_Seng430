from typing import Any

from pydantic import BaseModel, Field


class BaseStepResponse(BaseModel):
    session_id: str
    step: str
    status: str = "ok"


class ContextResponse(BaseStepResponse):
    payload: dict[str, Any]


class DataExplorationResponse(BaseStepResponse):
    profile: dict[str, Any]


class PreprocessResponse(BaseStepResponse):
    recipe: dict[str, Any]


class TrainResponse(BaseStepResponse):
    model_id: str
    model: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class EvaluationResponse(BaseStepResponse):
    metrics: dict[str, Any]
    confusion_matrix: dict[str, int]


class ExplainabilityResponse(BaseStepResponse):
    global_importance: list[dict[str, Any]]
    local_explanation: list[dict[str, Any]]


class FairnessResponse(BaseStepResponse):
    subgroup_metrics: list[dict[str, Any]]
    warnings: list[str]


class CertificateResponse(BaseStepResponse):
    participant: str
    summary: str
    checklist: list[dict[str, Any]]
