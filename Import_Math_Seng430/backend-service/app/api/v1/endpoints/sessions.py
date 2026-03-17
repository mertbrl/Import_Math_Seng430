from fastapi import APIRouter

from app.schemas.request import (
    CertificateCreateRequest,
    DatasetPatchRequest,
    DatasetUpsertRequest,
    ExplainabilityLocalRequest,
    MappingUpsertRequest,
    PreprocessingConfigRequest,
    SessionCreateRequest,
    SessionPatchRequest,
    TrainingConfigRequest,
)
from app.services.pipeline_service import pipeline_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("")
def create_session(payload: SessionCreateRequest) -> dict[str, object]:
    return pipeline_service.create_session(payload)


@router.get("")
def list_sessions() -> dict[str, object]:
    return {"sessions": pipeline_service.list_sessions()}


@router.get("/{session_id}")
def get_session(session_id: str) -> dict[str, object]:
    return pipeline_service.get_session(session_id)


@router.patch("/{session_id}")
def patch_session(session_id: str, payload: SessionPatchRequest) -> dict[str, object]:
    return pipeline_service.patch_session(session_id, payload)


@router.delete("/{session_id}")
def delete_session(session_id: str) -> dict[str, str]:
    return pipeline_service.delete_session(session_id)


@router.post("/{session_id}/dataset")
def create_dataset(session_id: str, payload: DatasetUpsertRequest) -> dict[str, object]:
    return pipeline_service.create_dataset(session_id, payload)


@router.get("/{session_id}/dataset")
def get_dataset(session_id: str) -> dict[str, object]:
    return pipeline_service.get_dataset(session_id)


@router.patch("/{session_id}/dataset")
def patch_dataset(session_id: str, payload: DatasetPatchRequest) -> dict[str, object]:
    return pipeline_service.patch_dataset(session_id, payload)


@router.delete("/{session_id}/dataset")
def delete_dataset(session_id: str) -> dict[str, object]:
    return pipeline_service.delete_dataset(session_id)


@router.put("/{session_id}/mapping")
def put_mapping(session_id: str, payload: MappingUpsertRequest) -> dict[str, object]:
    return pipeline_service.put_mapping(session_id, payload)


@router.get("/{session_id}/mapping")
def get_mapping(session_id: str) -> dict[str, object]:
    return pipeline_service.get_mapping(session_id)


@router.post("/{session_id}/mapping/validate")
def validate_mapping(session_id: str) -> dict[str, object]:
    return pipeline_service.validate_mapping(session_id)


@router.delete("/{session_id}/mapping")
def delete_mapping(session_id: str) -> dict[str, str]:
    return pipeline_service.delete_mapping(session_id)


@router.put("/{session_id}/preprocessing")
def put_preprocessing_config(session_id: str, payload: PreprocessingConfigRequest) -> dict[str, object]:
    return pipeline_service.put_preprocessing_config(session_id, payload)


@router.post("/{session_id}/preprocessing/run")
def run_preprocessing(session_id: str) -> dict[str, object]:
    return pipeline_service.run_preprocessing(session_id)


@router.get("/{session_id}/preprocessing/result")
def get_preprocessing_result(session_id: str) -> dict[str, object]:
    return pipeline_service.get_preprocessing_result(session_id)


@router.delete("/{session_id}/preprocessing/result")
def delete_preprocessing_result(session_id: str) -> dict[str, str]:
    return pipeline_service.delete_preprocessing_result(session_id)


@router.put("/{session_id}/training/config")
def put_training_config(session_id: str, payload: TrainingConfigRequest) -> dict[str, object]:
    return pipeline_service.put_training_config(session_id, payload)


@router.post("/{session_id}/training/run")
def run_training(session_id: str) -> dict[str, object]:
    return pipeline_service.run_training(session_id)


@router.get("/{session_id}/training/runs")
def list_training_runs(session_id: str) -> dict[str, object]:
    return pipeline_service.list_training_runs(session_id)


@router.get("/{session_id}/training/runs/{run_id}")
def get_training_run(session_id: str, run_id: str) -> dict[str, object]:
    return pipeline_service.get_training_run(session_id, run_id)


@router.delete("/{session_id}/training/runs/{run_id}")
def delete_training_run(session_id: str, run_id: str) -> dict[str, str]:
    return pipeline_service.delete_training_run(session_id, run_id)


@router.get("/{session_id}/evaluation/{run_id}")
def get_evaluation(session_id: str, run_id: str) -> dict[str, object]:
    return pipeline_service.get_evaluation(session_id, run_id)


@router.get("/{session_id}/explainability/{run_id}/global")
def get_explainability_global(session_id: str, run_id: str) -> dict[str, object]:
    return pipeline_service.get_explainability_global(session_id, run_id)


@router.post("/{session_id}/explainability/{run_id}/local")
def get_explainability_local(
    session_id: str,
    run_id: str,
    payload: ExplainabilityLocalRequest,
) -> dict[str, object]:
    return pipeline_service.get_explainability_local(session_id, run_id, payload)


@router.get("/{session_id}/fairness/{run_id}")
def get_fairness(session_id: str, run_id: str) -> dict[str, object]:
    return pipeline_service.get_fairness(session_id, run_id)


@router.post("/{session_id}/certificate")
def create_certificate(session_id: str, payload: CertificateCreateRequest) -> dict[str, object]:
    return pipeline_service.create_certificate(session_id, payload)


@router.get("/{session_id}/certificate")
def get_certificate(session_id: str) -> dict[str, object]:
    return pipeline_service.get_certificate(session_id)


@router.delete("/{session_id}/certificate")
def delete_certificate(session_id: str) -> dict[str, str]:
    return pipeline_service.delete_certificate(session_id)
