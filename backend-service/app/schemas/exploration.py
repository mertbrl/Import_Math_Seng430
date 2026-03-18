"""Pydantic models for the EDA profile response.

These schemas mirror the frontend TypeScript interfaces defined in
``mockEDAData.ts`` so the JSON contract is identical.  Field aliases
convert Python ``snake_case`` names to the ``camelCase`` keys the
React components expect.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VariableTypesSchema(BaseModel):
    """Breakdown of column types in the dataset."""

    model_config = ConfigDict(populate_by_name=True)

    numeric: int = Field(alias="Numeric", default=0)
    categorical: int = Field(alias="Categorical", default=0)
    boolean: int = Field(alias="Boolean", default=0)


class SummaryStatsSchema(BaseModel):
    """Executive summary matching the frontend ``SummaryStats`` interface."""

    model_config = ConfigDict(populate_by_name=True)

    num_variables: int = Field(alias="numVariables")
    num_observations: int = Field(alias="numObservations")
    missing_cells: int = Field(alias="missingCells")
    missing_cells_pct: float = Field(alias="missingCellsPct")
    duplicate_rows: int = Field(alias="duplicateRows")
    duplicate_rows_pct: float = Field(alias="duplicateRowsPct")
    total_memory: str = Field(alias="totalMemory")
    variable_types: VariableTypesSchema = Field(alias="variableTypes")


class AlertSchema(BaseModel):
    """Rule-based alert matching the frontend ``Alert`` interface."""

    severity: str  # 'warning' | 'severe' | 'info'
    icon: str
    title: str
    message: str


class DistributionBin(BaseModel):
    """A single histogram/bar-chart bin."""

    label: str
    value: int


class ColumnStatsSchema(BaseModel):
    """Per-column statistics matching the frontend ``ColumnStats`` interface."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    type: str  # 'Numeric' | 'Categorical' | 'Boolean'
    min: float | None = None
    max: float | None = None
    mean: float | None = None
    std_dev: float | None = Field(default=None, alias="stdDev")
    zeros_pct: float | None = Field(default=None, alias="zerosPct")
    negative_pct: float | None = Field(default=None, alias="negativePct")
    outliers_count: int | None = Field(default=None, alias="outliersCount")
    skewness: float | None = None
    kurtosis: float | None = None
    distribution_shape: str | None = Field(default=None, alias="distributionShape")
    distinct: int
    missing: int
    missing_pct: float = Field(alias="missingPct")
    distribution: list[DistributionBin]


class CorrelationEntrySchema(BaseModel):
    """Single cell in the correlation matrix."""

    row: str
    col: str
    value: float


class PreviewSchema(BaseModel):
    """First N rows of the dataset for the Data Preview tab."""

    headers: list[str]
    rows: list[dict[str, Any]]


class MissingColumnSchema(BaseModel):
    """Missing data analysis for one column."""

    model_config = ConfigDict(populate_by_name=True)

    column: str
    type: str
    missing_count: int = Field(alias="missingCount")
    missing_pct: float = Field(alias="missingPct")
    mechanism: str  # 'MCAR' | 'MAR' | 'MNAR'
    mechanism_detail: str = Field(alias="mechanismDetail")
    missing_rows: list[int] = Field(alias="missingRows")


class EDAProfileResponse(BaseModel):
    """Top-level EDA profile matching the frontend ``MockEDADataset``
    interface.  This is the JSON body returned by ``POST /data/explore``.
    """

    model_config = ConfigDict(populate_by_name=True)

    summary: SummaryStatsSchema
    alerts: list[AlertSchema]
    columns: list[ColumnStatsSchema]
    correlation_matrix: list[CorrelationEntrySchema] = Field(
        alias="correlationMatrix",
    )
    numeric_column_names: list[str] = Field(alias="numericColumnNames")
    preview: PreviewSchema
    missing_analysis: list[MissingColumnSchema] = Field(alias="missingAnalysis")


class PreprocessingReviewResponse(BaseModel):
    """Before/after EDA payload for post-preprocessing review."""

    model_config = ConfigDict(populate_by_name=True)

    before: EDAProfileResponse
    after: EDAProfileResponse
    before_shape: list[int] = Field(alias="beforeShape")
    after_shape: list[int] = Field(alias="afterShape")
    removed_columns: list[str] = Field(alias="removedColumns")
    added_columns: list[str] = Field(alias="addedColumns")
