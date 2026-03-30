from typing import Any

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    session_id: str | None = None
    domain: str = Field(default="Cardiology")
    use_case: str = Field(default="Predict 30-day readmission risk.")


class SessionPatchRequest(BaseModel):
    domain: str | None = None
    use_case: str | None = None


class DatasetUpsertRequest(BaseModel):
    source: str = Field(default="default", pattern="^(default|upload)$")
    target_column: str = Field(default="DEATH_EVENT")
    file_name: str | None = None
    row_count: int = Field(default=304, ge=1)
    column_count: int = Field(default=12, ge=1)


class DatasetPatchRequest(BaseModel):
    source: str | None = Field(default=None, pattern="^(default|upload)$")
    target_column: str | None = None
    file_name: str | None = None
    row_count: int | None = Field(default=None, ge=1)
    column_count: int | None = Field(default=None, ge=1)


class MappingUpsertRequest(BaseModel):
    problem_type: str = Field(default="binary_classification")
    target_column: str = Field(default="DEATH_EVENT")
    roles: dict[str, str] = Field(default_factory=dict)


class PreprocessingConfigRequest(BaseModel):
    train_split: int = Field(default=80, ge=60, le=90)
    missing_strategy: str = Field(default="median")
    normalization: str = Field(default="zscore")
    imbalance_strategy: str = Field(default="smote")


class TrainingConfigRequest(BaseModel):
    algorithm: str = Field(default="knn")
    parameters: dict[str, Any] = Field(default_factory=dict)


class ExplainabilityLocalRequest(BaseModel):
    patient_id: str = Field(default="patient-47")


class CertificateCreateRequest(BaseModel):
    participant: str = Field(default="Demo User")
    organization: str = Field(default="Demo Hospital")


class ContextRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    domain: str = Field(default="Cardiology")
    use_case: str = Field(default="Predict 30-day readmission risk.")


class DataExplorationRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    source: str = Field(default="default", pattern="^(default|upload)$")
    target_column: str = Field(default="DEATH_EVENT")


class ValidateMappingRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    target_column: str = Field(default="DEATH_EVENT")
    problem_type: str = Field(default="binary_classification")
    roles: dict[str, str] = Field(default_factory=dict)


class PreprocessRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    train_split: int = Field(default=80, ge=60, le=90)
    missing_strategy: str = Field(default="median")
    normalization: str = Field(default="zscore")
    imbalance_strategy: str = Field(default="smote")


class DataCleaningPreviewRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    pipeline: list[dict[str, Any]] = Field(default_factory=list)


class PipelineConfigRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    target_column: str | None = None
    problem_type: str | None = None
    excluded_columns: list[str] = Field(default_factory=list)
    basic_cleaning: dict[str, Any] = Field(default_factory=dict)
    sampling: dict[str, Any] = Field(default_factory=dict)
    data_split: dict[str, Any] = Field(default_factory=dict)
    imputation: dict[str, Any] = Field(default_factory=dict)
    outliers: dict[str, Any] = Field(default_factory=dict)
    transformation: dict[str, Any] = Field(default_factory=dict)
    encoding: dict[str, Any] = Field(default_factory=dict)
    scaling: dict[str, Any] = Field(default_factory=dict)
    dimensionality_reduction: dict[str, Any] = Field(default_factory=dict)
    feature_selection: dict[str, Any] = Field(default_factory=dict)
    imbalance: dict[str, Any] = Field(default_factory=dict)


class PipelineExecutionRequest(BaseModel):
    pipeline_config: PipelineConfigRequest | None = None
    session_id: str = Field(default="demo-session")
    target_column: str = Field(default="")
    problem_type: str | None = None
    excluded_columns: list[str] = Field(default_factory=list)
    pipeline: list[dict[str, Any]] = Field(default_factory=list)


class BasicCleaningStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)


class TypeMismatchStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)


class MissingStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)


class OutliersStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)


class TrainRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    algorithm: str = Field(default="knn")
    parameters: dict[str, Any] = Field(default_factory=dict)
    search_config: dict[str, Any] = Field(default_factory=dict)
    pipeline_config: dict[str, Any] = Field(default_factory=dict)


class EvaluationRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    model_id: str | None = None


class ExplainabilityRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    model_id: str | None = None
    patient_id: str = Field(default="patient-47")


class FairnessRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    model_id: str | None = None


class CertificateRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    participant: str = Field(default="Demo User")
    organization: str = Field(default="Demo Hospital")


class TransformationStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)


class EncodingStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)
    target_column: str | None = None


class ScalingStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)


class DimensionalityStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    excluded_columns: list[str] = Field(default_factory=list)
    protected_columns: list[str] = Field(default_factory=list)


class ImbalanceStatsRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    target_column: str = Field(default="DEATH_EVENT")
    excluded_columns: list[str] = Field(default_factory=list)
    pipeline_config: PipelineConfigRequest | None = None

class FeatureImportanceRequest(BaseModel):
    session_id: str = Field(default="demo-session")
    target_column: str = Field(default="DEATH_EVENT")
    excluded_columns: list[str] = Field(default_factory=list)
    pipeline_config: PipelineConfigRequest | None = None
