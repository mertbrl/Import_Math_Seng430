"""
Shared DataFrame Loader
Single Responsibility: Resolve dataset path from session state and return a Pandas DataFrame.
All step modules import this; never re-implement path resolution.
"""

from functools import lru_cache
import pathlib

import pandas as pd

from app.core.exceptions import PipelineError
from app.services.session_service import session_service

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent.parent.parent
CORE_DATASETS_DIR = BASE_DIR / "core_datasets"
SESSION_DATA_DIR = BASE_DIR / "temp_sessions"


def _resolve_dataframe_path(session_id: str) -> pathlib.Path:
    state = session_service.get(session_id)
    if not state.dataset:
        raise PipelineError("No dataset loaded for this session.")

    source = state.dataset.get("source")
    file_name = state.dataset.get("file_name")

    if source == "default" and file_name:
        file_path = CORE_DATASETS_DIR / file_name
    else:
        session_dir = SESSION_DATA_DIR / session_id
        file_path = session_dir / "raw.csv"

        if not file_path.exists() and file_name:
            alt_path = CORE_DATASETS_DIR / file_name
            if alt_path.exists():
                file_path = alt_path

    if not file_path.exists():
        raise PipelineError(f"Immutable source file not found at {file_path}", status_code=404)

    return file_path


@lru_cache(maxsize=16)
def _read_csv_cached(file_path_str: str, mtime_ns: int, file_size: int) -> pd.DataFrame:
    del mtime_ns, file_size
    return pd.read_csv(file_path_str)


def load_dataframe(session_id: str) -> pd.DataFrame:
    """
    Resolve the immutable source CSV for *session_id* and return it as a DataFrame.
    Raises PipelineError (404) when the file cannot be located.
    """
    file_path = _resolve_dataframe_path(session_id)

    try:
        stat = file_path.stat()
        cached = _read_csv_cached(str(file_path), stat.st_mtime_ns, stat.st_size)
        return cached.copy(deep=False)
    except Exception as exc:
        raise PipelineError(f"Failed to read source data: {exc}", status_code=500) from exc
