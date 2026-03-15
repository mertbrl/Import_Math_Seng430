"""Data Exploration Service — orchestration layer.

Reads an uploaded ``UploadFile`` into a Pandas ``DataFrame`` and
delegates all analytical work to the ML core EDA engine.
"""

from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import UploadFile

from app.core.exceptions import PipelineError
from app.ml_core.data_engine.eda import run_full_eda


class DataExplorationService:
    """Stateless service that bridges HTTP uploads and the EDA engine."""

    async def explore(self, file: UploadFile, ignored_columns: list[str] | None = None) -> dict[str, Any]:
        """Run the full EDA pipeline on an uploaded CSV file.

        Parameters
        ----------
        file : UploadFile
            A FastAPI upload handle whose content is raw CSV bytes.
        ignored_columns : list[str], optional
            A list of column names to ignore during EDA, by default None.

        Returns
        -------
        dict
            A dict whose structure matches ``EDAProfileResponse``.

        Raises
        ------
        PipelineError
            If the file is not a CSV or cannot be parsed by Pandas.
        """
        # ── validation ───────────────────────────────────────────────
        filename = (file.filename or "").lower()
        if not filename.endswith(".csv"):
            raise PipelineError("Only .csv files are accepted.", status_code=400)

        content = await file.read()
        if not content:
            raise PipelineError("Uploaded file is empty.", status_code=400)

        # ── parse ────────────────────────────────────────────────────
        try:
            df: pd.DataFrame = pd.read_csv(io.BytesIO(content))
        except Exception as exc:
            raise PipelineError(
                f"Failed to parse CSV: {exc}",
                status_code=400,
            ) from exc

        if df.empty or df.shape[1] == 0:
            raise PipelineError(
                "CSV file is empty or contains no columns.",
                status_code=400,
            )

        # ── analyse ──────────────────────────────────────────────────
        # Pass DataFrame and explicitly ignored columns to the EDA engine
        eda_profile = run_full_eda(df, ignored_columns=ignored_columns)
        return eda_profile


# Module-level singleton (matches existing services pattern).
data_exploration_service = DataExplorationService()
