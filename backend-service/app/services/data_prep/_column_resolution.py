from __future__ import annotations

import re

import pandas as pd


def _normalize_column_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(name).strip().lower())


def resolve_column_name(df: pd.DataFrame, requested: str | None) -> str:
    if not requested:
        return ""

    if requested in df.columns:
        return requested

    lowered_map = {str(column).strip().lower(): str(column) for column in df.columns}
    lowered_requested = str(requested).strip().lower()
    if lowered_requested in lowered_map:
        return lowered_map[lowered_requested]

    normalized_requested = _normalize_column_name(requested)
    normalized_map = {
        _normalize_column_name(str(column)): str(column)
        for column in df.columns
    }
    return normalized_map.get(normalized_requested, str(requested))
