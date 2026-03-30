from __future__ import annotations

from typing import Any

from app.core.exceptions import PipelineError

MODEL_PARAM_BOUNDS: dict[str, dict[str, dict[str, Any]]] = {
    "knn": {
        "k": {"type": "int", "min": 1, "max": 50, "default": 5},
        "weights": {"type": "enum", "values": ["uniform", "distance"], "default": "uniform"},
        "p": {"type": "enum", "values": [1, 2], "default": 2},
    },
    "svm": {
        "kernel": {"type": "enum", "values": ["linear", "rbf", "poly"], "default": "rbf"},
        "c": {"type": "float", "min": 0.01, "max": 100.0, "default": 1.0},
        "gamma": {"type": "enum", "values": ["scale", "auto"], "default": "scale"},
        "degree": {"type": "int", "min": 2, "max": 5, "default": 3},
        "class_weight": {"type": "enum", "values": ["none", "balanced"], "default": "none"},
    },
    "dt": {
        "criterion": {"type": "enum", "values": ["gini", "entropy", "log_loss"], "default": "gini"},
        "max_depth": {"type": "int", "min": 1, "max": 30, "default": 5},
        "min_samples_split": {"type": "int", "min": 2, "max": 50, "default": 2},
        "min_samples_leaf": {"type": "int", "min": 1, "max": 50, "default": 1},
        "class_weight": {"type": "enum", "values": ["none", "balanced"], "default": "none"},
    },
    "rf": {
        "criterion": {"type": "enum", "values": ["gini", "entropy", "log_loss"], "default": "gini"},
        "n_estimators": {"type": "int", "min": 50, "max": 500, "default": 100},
        "max_depth": {"type": "int", "min": 1, "max": 30, "default": 10},
        "min_samples_split": {"type": "int", "min": 2, "max": 50, "default": 2},
        "min_samples_leaf": {"type": "int", "min": 1, "max": 50, "default": 1},
        "max_features": {"type": "enum", "values": ["sqrt", "log2", "all"], "default": "sqrt"},
        "bootstrap": {"type": "bool", "default": True},
        "class_weight": {"type": "enum", "values": ["none", "balanced", "balanced_subsample"], "default": "none"},
    },
    "et": {
        "criterion": {"type": "enum", "values": ["gini", "entropy", "log_loss"], "default": "gini"},
        "n_estimators": {"type": "int", "min": 50, "max": 500, "default": 150},
        "max_depth": {"type": "int", "min": 1, "max": 30, "default": 10},
        "min_samples_split": {"type": "int", "min": 2, "max": 50, "default": 2},
        "min_samples_leaf": {"type": "int", "min": 1, "max": 50, "default": 1},
        "max_features": {"type": "enum", "values": ["sqrt", "log2", "all"], "default": "sqrt"},
        "bootstrap": {"type": "bool", "default": False},
        "class_weight": {"type": "enum", "values": ["none", "balanced", "balanced_subsample"], "default": "none"},
    },
    "ada": {
        "n_estimators": {"type": "int", "min": 25, "max": 500, "default": 100},
        "learning_rate": {"type": "float", "min": 0.01, "max": 2.0, "default": 0.5},
        "estimator_depth": {"type": "int", "min": 1, "max": 5, "default": 1},
    },
    "lr": {
        "c": {"type": "float", "min": 0.01, "max": 100.0, "default": 1.0},
        "max_iter": {"type": "int", "min": 100, "max": 5000, "default": 1000},
        "class_weight": {"type": "enum", "values": ["none", "balanced"], "default": "none"},
    },
    "nb": {
        "var_smoothing": {"type": "float", "min": 1e-12, "max": 1e-4, "default": 1e-9},
    },
    "xgb": {
        "n_estimators": {"type": "int", "min": 50, "max": 500, "default": 200},
        "max_depth": {"type": "int", "min": 2, "max": 12, "default": 6},
        "learning_rate": {"type": "float", "min": 0.01, "max": 0.5, "default": 0.1},
        "subsample": {"type": "float", "min": 0.5, "max": 1.0, "default": 1.0},
        "colsample_bytree": {"type": "float", "min": 0.5, "max": 1.0, "default": 1.0},
        "reg_lambda": {"type": "float", "min": 0.0, "max": 10.0, "default": 1.0},
    },
    "lgbm": {
        "n_estimators": {"type": "int", "min": 50, "max": 500, "default": 200},
        "max_depth": {"type": "int", "min": -1, "max": 16, "default": -1},
        "learning_rate": {"type": "float", "min": 0.01, "max": 0.5, "default": 0.1},
        "num_leaves": {"type": "int", "min": 8, "max": 128, "default": 31},
        "subsample": {"type": "float", "min": 0.5, "max": 1.0, "default": 1.0},
        "colsample_bytree": {"type": "float", "min": 0.5, "max": 1.0, "default": 1.0},
    },
    "catboost": {
        "iterations": {"type": "int", "min": 50, "max": 500, "default": 200},
        "depth": {"type": "int", "min": 2, "max": 10, "default": 6},
        "learning_rate": {"type": "float", "min": 0.01, "max": 0.5, "default": 0.1},
        "l2_leaf_reg": {"type": "float", "min": 1.0, "max": 10.0, "default": 3.0},
    },
}


def list_supported_models() -> list[str]:
    return list(MODEL_PARAM_BOUNDS.keys())


def sanitize_model_params(algorithm: str, raw_params: dict[str, Any] | None) -> dict[str, Any]:
    bounds = MODEL_PARAM_BOUNDS.get(algorithm)
    if bounds is None:
        raise PipelineError(f"Unsupported model '{algorithm}'.", status_code=400)

    params = raw_params or {}
    normalized: dict[str, Any] = {}

    for name, rules in bounds.items():
        default = rules.get("default")
        value = params.get(name, default)
        rule_type = rules.get("type")

        if rule_type == "int":
            normalized[name] = _clamp_int(value, minimum=int(rules["min"]), maximum=int(rules["max"]), default=int(default))
        elif rule_type == "float":
            normalized[name] = _clamp_float(
                value,
                minimum=float(rules["min"]),
                maximum=float(rules["max"]),
                default=float(default),
            )
        elif rule_type == "enum":
            normalized[name] = _enum_value(value, rules["values"], default)
        elif rule_type == "bool":
            normalized[name] = _coerce_bool(value, bool(default))
        else:
            normalized[name] = default

    return normalized


def _clamp_int(value: Any, *, minimum: int, maximum: int, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _clamp_float(value: Any, *, minimum: float, maximum: float, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _enum_value(value: Any, allowed: list[Any], default: Any) -> Any:
    return value if value in allowed else default


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    return default
