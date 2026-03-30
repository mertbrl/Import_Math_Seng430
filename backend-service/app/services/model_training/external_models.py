from __future__ import annotations

from importlib import import_module
from typing import Any

from app.core.exceptions import PipelineError


def require_external_class(module_name: str, class_name: str, *, model_label: str) -> Any:
    try:
        module = import_module(module_name)
    except ImportError as exc:  # pragma: no cover - exercised via integration when deps are missing
        raise PipelineError(
            f"{model_label} is not available because '{module_name}' is not installed in the backend environment.",
            status_code=500,
        ) from exc

    try:
        return getattr(module, class_name)
    except AttributeError as exc:  # pragma: no cover - defensive only
        raise PipelineError(
            f"{model_label} could not be loaded from '{module_name}'.",
            status_code=500,
        ) from exc
