from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.model_selection import GridSearchCV, KFold, StratifiedKFold

from app.core.exceptions import PipelineError
from app.services.model_training.config import MODEL_PARAM_BOUNDS
from app.services.model_training.control import ShouldCancel, raise_if_cancelled
from app.services.model_training.factory import SklearnEstimatorFactory

SEARCH_SCOPE_VALUES = {"focused", "balanced", "wide"}
SEARCH_SCORING_VALUES = {"auto", "accuracy", "f1", "precision", "recall", "roc_auc"}
MAX_GRID_VALUES_PER_PARAM = 8
MAX_GRID_COMBINATIONS = 400


@dataclass
class SearchExecutionResult:
    estimator: Any
    parameters: dict[str, Any]
    summary: dict[str, Any]


def sanitize_search_config(algorithm: str, raw_config: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw_config or {}
    enabled = bool(raw.get("enabled", False))
    parameter_space = _sanitize_parameter_space(algorithm, raw.get("parameter_space"))
    return {
        "enabled": enabled,
        "scope": _enum_value(raw.get("scope"), SEARCH_SCOPE_VALUES, "focused"),
        "cv_folds": _clamp_int(raw.get("cv_folds"), minimum=2, maximum=8, default=5),
        "scoring": _enum_value(raw.get("scoring"), SEARCH_SCORING_VALUES, "auto"),
        "parameter_space": parameter_space,
        "mode": "manual" if not enabled else ("custom" if parameter_space else "preset"),
    }


class ModelSearchService:
    def __init__(self, estimator_factory: SklearnEstimatorFactory | None = None) -> None:
        self._factory = estimator_factory or SklearnEstimatorFactory()

    def fit(
        self,
        *,
        algorithm: str,
        parameters: dict[str, Any],
        search_config: dict[str, Any],
        X_train: Any,
        y_train: np.ndarray,
        class_names: list[str],
        should_cancel: ShouldCancel | None = None,
    ) -> SearchExecutionResult:
        class_count = max(2, len(class_names))
        estimator = self._factory.create(algorithm, parameters, class_count=class_count)
        raise_if_cancelled(should_cancel)
        if not search_config.get("enabled"):
            estimator.fit(X_train, y_train)
            raise_if_cancelled(should_cancel)
            return SearchExecutionResult(
                estimator=estimator,
                parameters=parameters,
                summary={
                    "enabled": False,
                    "mode": "manual",
                    "scope": search_config.get("scope", "focused"),
                    "cv_folds": 0,
                    "scoring": None,
                    "best_score": None,
                    "best_params": parameters,
                    "candidate_count": 1,
                    "top_candidates": [],
                    "parameter_space": {},
                },
            )

        effective_folds = self._resolve_cv_folds(search_config, y_train, class_names)
        scoring = self._resolve_scoring(search_config, class_names)
        custom_parameter_space = dict(search_config.get("parameter_space") or {})
        if custom_parameter_space:
            param_grid = self._build_custom_param_grid(
                algorithm=algorithm,
                parameter_space=custom_parameter_space,
                sample_count=int(len(X_train)),
                cv_folds=effective_folds,
            )
        else:
            param_grid = self._build_param_grid(
                algorithm=algorithm,
                parameters=parameters,
                scope=str(search_config["scope"]),
                sample_count=int(len(X_train)),
                cv_folds=effective_folds,
            )

        candidate_count = self._count_candidates(param_grid)
        if candidate_count > MAX_GRID_COMBINATIONS:
            raise PipelineError(
                f"Grid search would try {candidate_count} combinations. Reduce the number of candidate values or CV folds.",
                status_code=400,
            )

        search = GridSearchCV(
            estimator=estimator,
            param_grid=param_grid,
            scoring=scoring,
            cv=self._build_cv_strategy(effective_folds, y_train, class_names),
            n_jobs=1,
            refit=True,
            error_score="raise",
        )
        raise_if_cancelled(should_cancel)
        search.fit(X_train, y_train)
        raise_if_cancelled(should_cancel)

        best_params = self._factory.to_model_params(algorithm, search.best_estimator_.get_params())
        base_estimator_params = estimator.get_params(deep=True)
        return SearchExecutionResult(
            estimator=search.best_estimator_,
            parameters=best_params,
            summary={
                "enabled": True,
                "mode": search_config.get("mode", "preset"),
                "scope": search_config["scope"] if search_config.get("mode") == "preset" else None,
                "cv_folds": effective_folds,
                "scoring": scoring,
                "best_score": round(float(search.best_score_), 4),
                "best_params": best_params,
                "candidate_count": candidate_count,
                "top_candidates": self._top_candidates(algorithm, search.cv_results_, base_estimator_params),
                "parameter_space": custom_parameter_space if custom_parameter_space else {},
            },
        )

    def _resolve_cv_folds(
        self,
        search_config: dict[str, Any],
        y_train: np.ndarray,
        class_names: list[str],
    ) -> int:
        requested = int(search_config["cv_folds"])
        if len(class_names) <= 1:
            return max(2, min(requested, len(y_train)))

        counts = np.bincount(y_train, minlength=len(class_names))
        viable = [int(count) for count in counts if int(count) > 0]
        limit = min(viable) if viable else len(y_train)
        return max(2, min(requested, limit, len(y_train)))

    def _resolve_scoring(self, search_config: dict[str, Any], class_names: list[str]) -> str:
        requested = str(search_config["scoring"])
        is_multiclass = len(class_names) > 2
        if requested == "accuracy":
            return "accuracy"
        if requested == "precision":
            return "precision_macro" if is_multiclass else "precision"
        if requested == "recall":
            return "recall_macro" if is_multiclass else "recall"
        if requested == "roc_auc":
            return "roc_auc_ovr" if is_multiclass else "roc_auc"
        return "f1_macro" if is_multiclass else "f1"

    def _build_cv_strategy(self, folds: int, y_train: np.ndarray, class_names: list[str]) -> Any:
        if len(class_names) > 1:
            counts = np.bincount(y_train, minlength=len(class_names))
            viable = [int(count) for count in counts if int(count) > 0]
            if viable and min(viable) >= folds:
                return StratifiedKFold(n_splits=folds, shuffle=True, random_state=42)
        return KFold(n_splits=folds, shuffle=True, random_state=42)

    def _build_param_grid(
        self,
        *,
        algorithm: str,
        parameters: dict[str, Any],
        scope: str,
        sample_count: int,
        cv_folds: int,
    ) -> dict[str, list[Any]] | list[dict[str, list[Any]]]:
        if algorithm == "knn":
            max_neighbors = max(1, sample_count - max(1, int(np.ceil(sample_count / cv_folds))))
            return {
                "n_neighbors": [
                    value
                    for value in self._int_candidates(int(parameters["k"]), minimum=1, maximum=max_neighbors, scope=scope)
                    if value <= max_neighbors
                ],
                "weights": self._categorical_candidates(str(parameters["weights"]), ["uniform", "distance"], scope),
                "p": self._categorical_candidates(int(parameters["p"]), [1, 2], scope),
            }

        if algorithm == "svm":
            c_values = self._float_candidates(float(parameters["c"]), minimum=0.01, maximum=100.0, scope=scope)
            weights = self._categorical_candidates(
                self._none_or_string(parameters["class_weight"]),
                [None, "balanced"],
                scope,
            )
            kernels = self._svm_kernel_candidates(str(parameters["kernel"]), scope)
            grids: list[dict[str, list[Any]]] = [
                {
                    "C": c_values,
                    "kernel": ["linear"],
                    "class_weight": weights,
                },
                {
                    "C": c_values,
                    "kernel": ["rbf"],
                    "gamma": self._categorical_candidates(str(parameters["gamma"]), ["scale", "auto"], scope),
                    "class_weight": weights,
                },
            ]
            if "poly" in kernels:
                grids.append(
                    {
                        "C": c_values[: min(3, len(c_values))],
                        "kernel": ["poly"],
                        "gamma": self._categorical_candidates(str(parameters["gamma"]), ["scale", "auto"], scope),
                        "degree": self._int_candidates(int(parameters["degree"]), minimum=2, maximum=5, scope=scope),
                        "class_weight": weights,
                    }
                )
            return [grid for grid in grids if grid["kernel"][0] in kernels]

        if algorithm == "dt":
            return {
                "criterion": self._categorical_candidates(str(parameters["criterion"]), ["gini", "entropy", "log_loss"], scope),
                "max_depth": self._int_candidates(int(parameters["max_depth"]), minimum=1, maximum=30, scope=scope),
                "min_samples_split": self._int_candidates(int(parameters["min_samples_split"]), minimum=2, maximum=min(50, sample_count), scope=scope),
                "min_samples_leaf": self._int_candidates(int(parameters["min_samples_leaf"]), minimum=1, maximum=min(50, max(1, sample_count // 2)), scope=scope),
                "class_weight": self._categorical_candidates(self._none_or_string(parameters["class_weight"]), [None, "balanced"], scope),
            }

        if algorithm in {"rf", "et"}:
            return [
                {
                    "criterion": self._categorical_candidates(str(parameters["criterion"]), ["gini", "entropy", "log_loss"], scope),
                    "n_estimators": self._rf_estimators(int(parameters["n_estimators"]), scope),
                    "max_depth": self._int_candidates(int(parameters["max_depth"]), minimum=1, maximum=30, scope=scope),
                    "max_features": self._categorical_candidates(self._rf_max_features(parameters["max_features"]), ["sqrt", "log2", None], scope),
                },
                {
                    "n_estimators": [int(parameters["n_estimators"])],
                    "max_depth": [int(parameters["max_depth"])],
                    "min_samples_split": self._int_candidates(int(parameters["min_samples_split"]), minimum=2, maximum=min(50, sample_count), scope=scope),
                    "min_samples_leaf": self._int_candidates(int(parameters["min_samples_leaf"]), minimum=1, maximum=min(50, max(1, sample_count // 2)), scope=scope),
                    "bootstrap": self._categorical_candidates(bool(parameters["bootstrap"]), [True, False], scope),
                    "class_weight": self._categorical_candidates(self._none_or_string(parameters["class_weight"]), [None, "balanced", "balanced_subsample"], scope),
                },
            ]

        if algorithm == "ada":
            return {
                "n_estimators": self._rf_estimators(int(parameters["n_estimators"]), scope),
                "learning_rate": self._float_candidates(float(parameters["learning_rate"]), minimum=0.01, maximum=2.0, scope=scope),
                "estimator__max_depth": self._int_candidates(int(parameters["estimator_depth"]), minimum=1, maximum=5, scope=scope),
            }

        if algorithm == "lr":
            return {
                "C": self._float_candidates(float(parameters["c"]), minimum=0.01, maximum=100.0, scope=scope),
                "max_iter": self._categorical_candidates(int(parameters["max_iter"]), [500, 1000, 2000, 3000], scope),
                "class_weight": self._categorical_candidates(self._none_or_string(parameters["class_weight"]), [None, "balanced"], scope),
            }

        if algorithm == "nb":
            return {
                "var_smoothing": self._nb_smoothing(float(parameters["var_smoothing"]), scope),
            }

        if algorithm == "xgb":
            return {
                "n_estimators": self._rf_estimators(int(parameters["n_estimators"]), scope),
                "max_depth": self._int_candidates(int(parameters["max_depth"]), minimum=2, maximum=12, scope=scope),
                "learning_rate": self._float_candidates(float(parameters["learning_rate"]), minimum=0.01, maximum=0.5, scope=scope),
                "subsample": self._float_candidates(float(parameters["subsample"]), minimum=0.5, maximum=1.0, scope=scope),
                "colsample_bytree": self._float_candidates(float(parameters["colsample_bytree"]), minimum=0.5, maximum=1.0, scope=scope),
                "reg_lambda": self._float_candidates(float(parameters["reg_lambda"]), minimum=0.0, maximum=10.0, scope=scope),
            }

        if algorithm == "lgbm":
            return {
                "n_estimators": self._rf_estimators(int(parameters["n_estimators"]), scope),
                "max_depth": self._int_candidates(int(parameters["max_depth"]), minimum=-1, maximum=16, scope=scope),
                "learning_rate": self._float_candidates(float(parameters["learning_rate"]), minimum=0.01, maximum=0.5, scope=scope),
                "num_leaves": self._int_candidates(int(parameters["num_leaves"]), minimum=8, maximum=128, scope=scope),
                "subsample": self._float_candidates(float(parameters["subsample"]), minimum=0.5, maximum=1.0, scope=scope),
                "colsample_bytree": self._float_candidates(float(parameters["colsample_bytree"]), minimum=0.5, maximum=1.0, scope=scope),
            }

        if algorithm == "catboost":
            return {
                "iterations": self._rf_estimators(int(parameters["iterations"]), scope),
                "depth": self._int_candidates(int(parameters["depth"]), minimum=2, maximum=10, scope=scope),
                "learning_rate": self._float_candidates(float(parameters["learning_rate"]), minimum=0.01, maximum=0.5, scope=scope),
                "l2_leaf_reg": self._float_candidates(float(parameters["l2_leaf_reg"]), minimum=1.0, maximum=10.0, scope=scope),
            }

        return {}

    def _build_custom_param_grid(
        self,
        *,
        algorithm: str,
        parameter_space: dict[str, list[Any]],
        sample_count: int,
        cv_folds: int,
    ) -> dict[str, list[Any]]:
        grid: dict[str, list[Any]] = {}
        max_neighbors = max(1, sample_count - max(1, int(np.ceil(sample_count / cv_folds))))

        for name, values in parameter_space.items():
            if not values:
                continue

            if algorithm == "knn":
                if name == "k":
                    grid["n_neighbors"] = self._dedupe([max(1, min(max_neighbors, int(value))) for value in values])
                elif name == "weights":
                    grid["weights"] = [str(value) for value in values]
                elif name == "p":
                    grid["p"] = [int(value) for value in values]
                continue

            if algorithm == "svm":
                if name == "c":
                    grid["C"] = [float(value) for value in values]
                elif name == "class_weight":
                    grid["class_weight"] = [self._none_or_string(value) for value in values]
                else:
                    grid[name] = [value for value in values]
                continue

            if algorithm == "dt":
                if name == "class_weight":
                    grid["class_weight"] = [self._none_or_string(value) for value in values]
                else:
                    grid[name] = [value for value in values]
                continue

            if algorithm in {"rf", "et"}:
                if name == "class_weight":
                    grid["class_weight"] = [self._none_or_string(value) for value in values]
                elif name == "max_features":
                    grid["max_features"] = [self._rf_max_features(value) for value in values]
                else:
                    grid[name] = [value for value in values]
                continue

            if algorithm == "ada":
                if name == "estimator_depth":
                    grid["estimator__max_depth"] = [int(value) for value in values]
                else:
                    grid[name] = [value for value in values]
                continue

            if algorithm == "lr":
                if name == "c":
                    grid["C"] = [float(value) for value in values]
                elif name == "class_weight":
                    grid["class_weight"] = [self._none_or_string(value) for value in values]
                else:
                    grid[name] = [value for value in values]
                continue

            if algorithm in {"nb", "xgb", "lgbm", "catboost"}:
                grid[name] = [value for value in values]
                continue

        return grid

    def _top_candidates(
        self,
        algorithm: str,
        cv_results: dict[str, Any],
        base_estimator_params: dict[str, Any],
    ) -> list[dict[str, Any]]:
        ranks = cv_results.get("rank_test_score", [])
        scores = cv_results.get("mean_test_score", [])
        params = cv_results.get("params", [])
        rows = [
            {
                "rank": int(rank),
                "score": round(float(score), 4),
                "params": self._factory.to_model_params(algorithm, self._merge_candidate_params(base_estimator_params, estimator_params)),
            }
            for rank, score, estimator_params in zip(ranks, scores, params, strict=False)
        ]
        rows.sort(key=lambda row: (row["rank"], -row["score"]))
        return rows[:5]

    def _count_candidates(self, param_grid: dict[str, list[Any]] | list[dict[str, list[Any]]]) -> int:
        grids = param_grid if isinstance(param_grid, list) else [param_grid]
        total = 0
        for grid in grids:
            size = 1
            for values in grid.values():
                size *= max(1, len(values))
            total += size
        return total

    def _svm_kernel_candidates(self, current: str, scope: str) -> list[str]:
        if scope == "focused":
            return [current]
        if scope == "balanced":
            return [current] if current == "poly" else self._dedupe([current, "rbf", "linear"])
        return self._dedupe([current, "rbf", "linear", "poly"])

    def _rf_estimators(self, current: int, scope: str) -> list[int]:
        if scope == "focused":
            offsets = [-30, 0, 30]
        elif scope == "balanced":
            offsets = [-40, 0, 40, 80]
        else:
            offsets = [-50, 0, 50, 100, 150]
        return self._dedupe([max(25, min(500, current + offset)) for offset in offsets])

    def _nb_smoothing(self, current: float, scope: str) -> list[float]:
        if current <= 0:
            current = 1e-9
        base = np.log10(current)
        if scope == "focused":
            offsets = [-1, 0, 1]
        elif scope == "balanced":
            offsets = [-2, -1, 0, 1, 2]
        else:
            offsets = [-3, -2, -1, 0, 1, 2, 3]
        values = [10 ** min(-4, max(-12, base + offset)) for offset in offsets]
        return [float(f"{value:.12g}") for value in self._dedupe(values)]

    def _int_candidates(self, current: int, *, minimum: int, maximum: int, scope: str) -> list[int]:
        if scope == "focused":
            offsets = [-2, 0, 2]
        elif scope == "balanced":
            offsets = [-4, -2, 0, 2, 4]
        else:
            offsets = [-6, -3, 0, 3, 6]
        return self._dedupe([max(minimum, min(maximum, current + offset)) for offset in offsets])

    def _float_candidates(self, current: float, *, minimum: float, maximum: float, scope: str) -> list[float]:
        if scope == "focused":
            multipliers = [0.5, 1.0, 2.0]
        elif scope == "balanced":
            multipliers = [0.25, 0.5, 1.0, 2.0]
        else:
            multipliers = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0]
        values = [max(minimum, min(maximum, current * multiplier)) for multiplier in multipliers]
        return [float(f"{value:.6g}") for value in self._dedupe(values)]

    def _categorical_candidates(self, current: Any, choices: list[Any], scope: str) -> list[Any]:
        if scope == "focused":
            return [current]
        if scope == "balanced":
            return self._dedupe([current, *choices[:2], choices[-1]])
        return self._dedupe([current, *choices])

    def _none_or_string(self, value: Any) -> Any:
        return None if value in {None, "none"} else str(value)

    def _rf_max_features(self, value: Any) -> Any:
        return None if value in {None, "all"} else str(value)

    def _dedupe(self, values: list[Any]) -> list[Any]:
        unique: list[Any] = []
        for value in values:
            if value not in unique:
                unique.append(value)
        return unique

    def _merge_candidate_params(self, base_estimator_params: dict[str, Any], candidate_params: dict[str, Any]) -> dict[str, Any]:
        merged = dict(base_estimator_params)
        merged.update(candidate_params)
        if "estimator__max_depth" in merged:
            merged.pop("estimator", None)
        return merged


def _sanitize_parameter_space(algorithm: str, raw_space: Any) -> dict[str, list[Any]]:
    bounds = MODEL_PARAM_BOUNDS.get(algorithm, {})
    if not isinstance(raw_space, dict):
        return {}

    sanitized: dict[str, list[Any]] = {}
    for name, raw_values in raw_space.items():
        if name not in bounds:
            continue
        values = _parse_search_values(raw_values, bounds[name])
        if values:
            sanitized[name] = values[:MAX_GRID_VALUES_PER_PARAM]
    return sanitized


def _parse_search_values(raw_values: Any, rules: dict[str, Any]) -> list[Any]:
    tokens = _expand_search_tokens(raw_values, rules)
    unique: list[Any] = []
    for token in tokens:
        normalized = _coerce_search_value(token, rules)
        if normalized is None:
            continue
        if normalized not in unique:
            unique.append(normalized)
    return unique


def _expand_search_tokens(raw_values: Any, rules: dict[str, Any]) -> list[Any]:
    if isinstance(raw_values, (list, tuple, set)):
        return list(raw_values)

    if not isinstance(raw_values, str):
        return [raw_values]

    value = raw_values.strip()
    if not value:
        return []

    if rules.get("type") in {"int", "float"} and ":" in value:
        parts = [part.strip() for part in value.split(":")]
        if len(parts) in {2, 3} and all(parts):
            return _expand_numeric_range(parts, rules)

    return [part.strip() for part in value.split(",") if part.strip()]


def _expand_numeric_range(parts: list[str], rules: dict[str, Any]) -> list[Any]:
    try:
        start = float(parts[0])
        end = float(parts[1])
        if len(parts) == 3:
            step = abs(float(parts[2]))
        elif rules.get("type") == "int":
            step = 1.0
        else:
            step = abs(end - start) / 4 if end != start else 0.01
    except ValueError:
        return []

    if step <= 0:
        return []

    lower = min(start, end)
    upper = max(start, end)
    values: list[Any] = []
    cursor = lower
    limit = MAX_GRID_VALUES_PER_PARAM * 4
    while cursor <= upper + 1e-12 and len(values) < limit:
        values.append(cursor if rules.get("type") == "float" else int(round(cursor)))
        cursor += step
    return values


def _coerce_search_value(value: Any, rules: dict[str, Any]) -> Any | None:
    rule_type = rules.get("type")

    if rule_type == "int":
        try:
            parsed = int(float(value))
        except (TypeError, ValueError):
            return None
        return max(int(rules["min"]), min(int(rules["max"]), parsed))

    if rule_type == "float":
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        clamped = max(float(rules["min"]), min(float(rules["max"]), parsed))
        return float(f"{clamped:.12g}")

    if rule_type == "enum":
        allowed = list(rules.get("values", []))
        candidate = value if value in allowed else str(value).strip()
        return candidate if candidate in allowed else None

    if rule_type == "bool":
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
        return None

    return None


def _clamp_int(value: Any, *, minimum: int, maximum: int, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _enum_value(value: Any, allowed: set[str], default: str) -> str:
    if isinstance(value, str) and value in allowed:
        return value
    return default
