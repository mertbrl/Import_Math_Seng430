from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from app.core.exceptions import PipelineError
from app.services.model_training.dataset_builder import PreparedTrainingData

try:  # pragma: no cover - optional runtime dependency
    import shap  # type: ignore[import-not-found]
except Exception:  # noqa: BLE001 - fallback is intentional
    shap = None

TREE_ALGORITHMS = {"dt", "rf", "et", "ada", "xgb", "lgbm", "catboost"}
MAX_BACKGROUND_ROWS = 192
MAX_REFERENCE_ROWS = 60
MAX_SURROGATE_ROWS = 768
MAX_GLOBAL_FEATURES = 15
MAX_CONTROL_FEATURES = 12
HISTOGRAM_BINS = 12


@dataclass
class CachedExplainabilityRun:
    session_id: str
    run_id: str
    model_id: str
    algorithm: str
    class_names: list[str]
    selection_split: str
    summary: dict[str, Any]
    global_payload: dict[str, Any]
    feature_stats: dict[str, dict[str, float]]
    control_specs: dict[str, dict[str, Any]]
    control_features: list[str]
    record_frame: pd.DataFrame
    record_options: list[dict[str, Any]]
    default_record_id: str
    simulator_mode: str
    surrogate_baseline: list[float]
    global_weight_map: dict[str, float] = field(default_factory=dict)
    surrogate_model: Any | None = None
    surrogate_explainer: Any | None = None


class ExplainabilityService:
    def __init__(self) -> None:
        self._runs: dict[tuple[str, str], CachedExplainabilityRun] = {}
        self._lock = Lock()

    def register_training_artifacts(
        self,
        *,
        session_id: str,
        run_id: str,
        model_id: str,
        algorithm: str,
        estimator: Any,
        data: PreparedTrainingData,
        search_summary: dict[str, Any] | None = None,
        train_metrics: dict[str, Any] | None = None,
        final_metrics: dict[str, Any] | None = None,
        generalization: dict[str, Any] | None = None,
        feature_importance: list[dict[str, Any]] | None = None,
        feature_importance_source: str | None = None,
    ) -> None:
        background_frame = self._sample_frame(data.X_train, MAX_BACKGROUND_ROWS)
        reference_frame, reference_ids = self._build_reference_frame(data)
        if reference_frame.empty:
            raise PipelineError("Explainability requires a non-empty reference split.", status_code=400)

        probability_matrix = self._predict_probability_matrix(estimator, reference_frame, data.class_names)
        summary = self._build_summary(
            algorithm=algorithm,
            model_id=model_id,
            class_names=data.class_names,
            train_metrics=train_metrics or {},
            final_metrics=final_metrics or {},
            generalization=generalization or {},
            search_summary=search_summary or {},
        )
        global_payload = self._build_global_payload(
            estimator=estimator,
            algorithm=algorithm,
            background_frame=background_frame,
            reference_frame=reference_frame,
            fallback_importance=feature_importance or [],
            fallback_source=feature_importance_source,
        )

        control_features = self._resolve_control_features(global_payload, reference_frame.columns.tolist())
        feature_stats = self._build_feature_stats(pd.concat([background_frame, reference_frame], ignore_index=True))
        control_specs = {
            feature: self._build_control_spec(reference_frame[feature], feature_stats.get(feature, {}))
            for feature in control_features
            if feature in reference_frame.columns
        }

        top_feature_names = [item["feature"] for item in global_payload.get("features", [])]
        record_frame, record_options = self._build_record_catalog(reference_frame, reference_ids, probability_matrix, data.class_names, top_feature_names)
        if record_frame.empty or not record_options:
            raise PipelineError("Explainability requires at least one candidate record.", status_code=400)

        background_probabilities = self._predict_probability_matrix(estimator, background_frame, data.class_names)
        surrogate_frame = pd.concat([background_frame, reference_frame], ignore_index=True)
        surrogate_targets = np.vstack([background_probabilities, probability_matrix])
        surrogate_model = self._train_surrogate(surrogate_frame, surrogate_targets)
        surrogate_baseline = self._build_surrogate_baseline(surrogate_targets, data.class_names)
        surrogate_explainer = self._build_surrogate_explainer(surrogate_model)
        simulator_mode = "surrogate_tree_shap" if surrogate_explainer is not None else "surrogate_proxy"

        bundle = CachedExplainabilityRun(
            session_id=session_id,
            run_id=run_id,
            model_id=model_id,
            algorithm=algorithm,
            class_names=data.class_names,
            selection_split=data.selection_split,
            summary=summary,
            global_payload=global_payload,
            feature_stats=feature_stats,
            control_specs=control_specs,
            control_features=list(control_specs.keys()),
            record_frame=record_frame,
            record_options=record_options,
            default_record_id=str(record_options[0]["record_id"]),
            simulator_mode=simulator_mode,
            surrogate_baseline=surrogate_baseline,
            global_weight_map=self._build_weight_map(global_payload),
            surrogate_model=surrogate_model,
            surrogate_explainer=surrogate_explainer,
        )

        with self._lock:
            self._runs[(session_id, run_id)] = bundle

    def get_workbench(self, session_id: str, run_id: str) -> dict[str, Any]:
        bundle = self._get_bundle(session_id, run_id)
        scenario = self._simulate(bundle, bundle.default_record_id, {})
        return {
            "session_id": session_id,
            "run_id": run_id,
            "summary": bundle.summary,
            "global_explanation": bundle.global_payload,
            "simulator": {
                "debounce_ms": 300,
                "computation_mode": bundle.simulator_mode,
                "record_options": bundle.record_options,
                "default_record_id": bundle.default_record_id,
                "control_features": [
                    {
                        **bundle.control_specs[feature],
                        "feature": feature,
                    }
                    for feature in bundle.control_features
                ],
                "selected_scenario": scenario["scenario"],
            },
        }

    def simulate(
        self,
        session_id: str,
        run_id: str,
        *,
        record_id: str,
        feature_overrides: dict[str, float | int | bool | str | None],
    ) -> dict[str, Any]:
        bundle = self._get_bundle(session_id, run_id)
        return self._simulate(bundle, record_id, feature_overrides)

    def get_global_payload(self, session_id: str, run_id: str) -> dict[str, Any]:
        bundle = self._get_bundle(session_id, run_id)
        return {
            "session_id": session_id,
            "run_id": run_id,
            "summary": bundle.summary,
            "global_explanation": bundle.global_payload,
        }

    def get_local_payload(self, session_id: str, run_id: str, record_id: str) -> dict[str, Any]:
        bundle = self._get_bundle(session_id, run_id)
        return self._simulate(bundle, record_id, {})

    def clear_run(self, session_id: str, run_id: str) -> None:
        with self._lock:
            self._runs.pop((session_id, run_id), None)

    def clear_session(self, session_id: str) -> None:
        with self._lock:
            to_delete = [key for key in self._runs if key[0] == session_id]
            for key in to_delete:
                del self._runs[key]

    def _get_bundle(self, session_id: str, run_id: str) -> CachedExplainabilityRun:
        with self._lock:
            bundle = self._runs.get((session_id, run_id))
        if bundle is None:
            raise PipelineError(
                "Explainability cache is not ready for this run. Retrain the model or reopen Step 5 after the run completes.",
                status_code=404,
            )
        return bundle

    def _simulate(
        self,
        bundle: CachedExplainabilityRun,
        record_id: str,
        feature_overrides: dict[str, float | int | bool | str | None],
    ) -> dict[str, Any]:
        row = self._resolve_record(bundle, record_id)
        scenario_row = row.copy()

        for feature, raw_value in feature_overrides.items():
            if feature not in scenario_row.index or feature not in bundle.control_specs:
                continue
            scenario_row[feature] = self._coerce_override_value(raw_value, bundle.control_specs[feature])

        scenario_frame = pd.DataFrame([scenario_row], columns=bundle.record_frame.columns)
        probability_vector = self._predict_from_surrogate(bundle, scenario_frame)
        target_index = int(np.argmax(probability_vector))
        target_probability = float(probability_vector[target_index])
        base_value = float(bundle.surrogate_baseline[target_index]) if target_index < len(bundle.surrogate_baseline) else 0.0

        if bundle.surrogate_explainer is not None:
            contribution_vector = self._local_shap_vector(bundle, scenario_frame, target_index)
            local_mode = bundle.simulator_mode
        else:
            contribution_vector = self._proxy_local_vector(bundle, scenario_row, target_index, base_value, target_probability)
            local_mode = "surrogate_proxy"

        ordered_contributions = self._rank_local_contributions(
            contribution_vector=contribution_vector,
            scenario_row=scenario_row,
            target_index=target_index,
            class_names=bundle.class_names,
        )

        scenario_payload = {
            "record_id": str(record_id),
            "prediction": {
                "target_class_index": target_index,
                "target_class_label": bundle.class_names[target_index],
                "target_probability": round(target_probability, 6),
                "baseline_probability": round(base_value, 6),
                "delta_from_baseline": round(target_probability - base_value, 6),
                "confidence_band": self._confidence_band(target_probability),
                "class_probabilities": [
                    {
                        "label": label,
                        "probability": round(float(probability), 6),
                    }
                    for label, probability in zip(bundle.class_names, probability_vector, strict=False)
                ],
            },
            "feature_values": {
                feature: self._round_value(float(scenario_row[feature]))
                for feature in bundle.control_features
                if feature in scenario_row.index
            },
            "local_explanation": {
                "computation_mode": local_mode,
                "base_value": round(base_value, 6),
                "predicted_value": round(target_probability, 6),
                "top_features": ordered_contributions,
            },
        }

        return {
            "session_id": bundle.session_id,
            "run_id": bundle.run_id,
            "scenario": scenario_payload,
        }

    def _build_summary(
        self,
        *,
        algorithm: str,
        model_id: str,
        class_names: list[str],
        train_metrics: dict[str, Any],
        final_metrics: dict[str, Any],
        generalization: dict[str, Any],
        search_summary: dict[str, Any],
    ) -> dict[str, Any]:
        holdout_score = float(final_metrics.get("f1_score") or final_metrics.get("accuracy") or 0.0)
        cv_score = float(search_summary.get("best_score") or holdout_score)
        train_score = float(train_metrics.get("f1_score") or train_metrics.get("accuracy") or holdout_score)
        train_test_gap = round(max(0.0, train_score - holdout_score), 4)
        cv_gap = abs(cv_score - holdout_score)
        stability_score = round(max(0.0, min(1.0, 1.0 - (train_test_gap * 1.8) - (cv_gap * 1.2))), 4)
        overfitting_risk = str(generalization.get("risk") or self._risk_from_gap(train_test_gap))

        rationale = (
            "Considering the training and stability metrics together, this model stands out with the most balanced profile."
            if stability_score >= 0.85 and train_test_gap <= 0.05
            else "Because the gap between training and test performance is low, this model appears to be reliable."
            if stability_score >= 0.7 and train_test_gap <= 0.08
            else "Although the score is strong, the train-test gap is higher; therefore, explanations should be interpreted carefully."
        )

        return {
            "algorithm": algorithm,
            "model_id": model_id,
            "class_count": len(class_names),
            "cv_score": round(cv_score, 4),
            "train_test_gap": train_test_gap,
            "stability_score": stability_score,
            "overfitting_risk": overfitting_risk,
            "selection_rationale": rationale,
        }

    def _build_global_payload(
        self,
        *,
        estimator: Any,
        algorithm: str,
        background_frame: pd.DataFrame,
        reference_frame: pd.DataFrame,
        fallback_importance: list[dict[str, Any]],
        fallback_source: str | None,
    ) -> dict[str, Any]:
        shap_importance = self._compute_shap_importance(
            estimator=estimator,
            algorithm=algorithm,
            background_frame=background_frame,
            reference_frame=reference_frame,
        )
        if shap_importance:
            importance_rows = shap_importance
            source = "shap_tree" if algorithm in TREE_ALGORITHMS else "shap_model"
            computation_mode = source
        else:
            importance_rows = [
                {
                    "feature": str(row.get("feature")),
                    "importance": float(row.get("importance") or row.get("score") or 0.0),
                }
                for row in fallback_importance
                if row.get("feature")
            ]
            source = fallback_source or "cached_feature_signal"
            computation_mode = "cached_feature_signal"

        ordered_rows = sorted(importance_rows, key=lambda row: float(row.get("importance", 0.0)), reverse=True)[:MAX_GLOBAL_FEATURES]
        features = []
        for row in ordered_rows:
            feature = str(row["feature"])
            if feature not in reference_frame.columns:
                continue
            values = pd.to_numeric(reference_frame[feature], errors="coerce").fillna(0.0)
            features.append(
                {
                    "feature": feature,
                    "importance": round(float(row["importance"]), 6),
                    "histogram": self._build_histogram(values.to_numpy()),
                    "summary": {
                        "min": self._round_value(values.min()),
                        "max": self._round_value(values.max()),
                        "mean": self._round_value(values.mean()),
                        "median": self._round_value(values.median()),
                    },
                }
            )

        return {
            "computation_mode": computation_mode,
            "source": source,
            "features": features,
        }

    def _compute_shap_importance(
        self,
        *,
        estimator: Any,
        algorithm: str,
        background_frame: pd.DataFrame,
        reference_frame: pd.DataFrame,
    ) -> list[dict[str, Any]]:
        if shap is None or reference_frame.empty:
            return []

        try:
            if algorithm in TREE_ALGORITHMS:
                explainer = shap.TreeExplainer(estimator)
                raw_values = explainer.shap_values(reference_frame, check_additivity=False)
            elif hasattr(estimator, "coef_"):
                explainer = shap.LinearExplainer(estimator, background_frame)
                raw_values = explainer.shap_values(reference_frame)
            else:
                return []
        except Exception:  # noqa: BLE001 - fallback handled below
            return []

        matrix = self._coerce_shap_tensor(raw_values, reference_frame.shape[1])
        if matrix.size == 0:
            return []

        importance = np.mean(np.abs(matrix), axis=(0, 2))
        return [
            {
                "feature": feature,
                "importance": round(float(score), 6),
            }
            for feature, score in sorted(
                zip(reference_frame.columns.tolist(), importance.tolist(), strict=False),
                key=lambda item: float(item[1]),
                reverse=True,
            )
            if float(score) > 0
        ]

    def _build_reference_frame(self, data: PreparedTrainingData) -> tuple[pd.DataFrame, list[str]]:
        if data.X_validation is not None and data.y_validation is not None and not data.X_validation.empty:
            frame = data.X_validation.copy()
            row_ids = list(data.validation_row_ids)
        else:
            frame = data.X_test.copy()
            row_ids = list(data.test_row_ids)

        if frame.empty:
            return frame, row_ids

        selected_indices = np.unique(np.linspace(0, len(frame) - 1, num=min(MAX_REFERENCE_ROWS, len(frame)), dtype=int))
        sampled_frame = frame.iloc[selected_indices].reset_index(drop=True)
        sampled_ids = [row_ids[index] if index < len(row_ids) else f"record-{index + 1}" for index in selected_indices]
        return sampled_frame, sampled_ids

    def _build_record_catalog(
        self,
        reference_frame: pd.DataFrame,
        record_ids: list[str],
        probability_matrix: np.ndarray,
        class_names: list[str],
        top_feature_names: list[str] | None = None,
    ) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
        if reference_frame.empty or probability_matrix.size == 0:
            return pd.DataFrame(columns=reference_frame.columns), []

        confidence = probability_matrix.max(axis=1)
        selection_order = np.unique(np.linspace(0, len(reference_frame) - 1, num=min(MAX_REFERENCE_ROWS, len(reference_frame)), dtype=int))
        ranked_indices = selection_order[np.argsort(confidence[selection_order])[::-1]]
        ranked_frame = reference_frame.iloc[ranked_indices].reset_index(drop=True)
        ranked_ids = [record_ids[index] if index < len(record_ids) else f"record-{index + 1}" for index in ranked_indices]
        ranked_probabilities = probability_matrix[ranked_indices]

        # Resolve the top-2 feature names used for rich dropdown labels.
        # We use the globally-ranked features so the label is stable across records.
        context_features: list[str] = []
        if top_feature_names:
            context_features = [f for f in top_feature_names if f in ranked_frame.columns][:2]

        options: list[dict[str, Any]] = []
        for local_index, (record_id, probabilities) in enumerate(zip(ranked_ids, ranked_probabilities, strict=False)):
            top_index = int(np.argmax(probabilities))
            top_probability = float(probabilities[top_index])

            # Build top_feature_values dict: {feature_name: rounded_value} for each context feature
            row = ranked_frame.iloc[local_index]
            top_feature_values: dict[str, float | int] = {}
            for feat in context_features:
                raw = row[feat]
                numeric = float(raw) if not pd.isna(raw) else 0.0
                # Preserve integer appearance for whole numbers
                top_feature_values[feat] = int(numeric) if numeric == int(numeric) else round(numeric, 2)

            options.append(
                {
                    "record_id": str(record_id),
                    "position": local_index + 1,
                    "predicted_label": class_names[top_index],
                    "predicted_probability": round(top_probability, 6),
                    "confidence_band": self._confidence_band(top_probability),
                    "top_feature_values": top_feature_values,
                }
            )

        return ranked_frame, options

    def _train_surrogate(self, reference_frame: pd.DataFrame, probability_matrix: np.ndarray) -> RandomForestRegressor | None:
        if reference_frame.empty or probability_matrix.size == 0:
            return None

        if len(reference_frame) > MAX_SURROGATE_ROWS:
            indices = np.unique(np.linspace(0, len(reference_frame) - 1, num=MAX_SURROGATE_ROWS, dtype=int))
            frame = reference_frame.iloc[indices].reset_index(drop=True)
            targets = probability_matrix[indices]
        else:
            frame = reference_frame.copy()
            targets = probability_matrix
        if frame.empty or len(targets) != len(frame):
            return None

        surrogate = RandomForestRegressor(
            n_estimators=120,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=1,
        )
        surrogate.fit(frame, targets)
        return surrogate

    def _build_surrogate_explainer(self, surrogate_model: Any | None) -> Any | None:
        if shap is None or surrogate_model is None:
            return None
        try:
            return shap.TreeExplainer(surrogate_model)
        except Exception:  # noqa: BLE001 - proxy fallback is acceptable
            return None

    def _build_surrogate_baseline(self, probability_matrix: np.ndarray, class_names: list[str]) -> list[float]:
        if probability_matrix.size == 0:
            return [0.0 for _ in class_names]
        return [round(float(value), 6) for value in probability_matrix.mean(axis=0).tolist()]

    def _build_weight_map(self, global_payload: dict[str, Any]) -> dict[str, float]:
        features = global_payload.get("features", [])
        total = sum(float(item.get("importance", 0.0)) for item in features)
        if total <= 0:
            return {str(item.get("feature")): 0.0 for item in features}
        return {
            str(item.get("feature")): float(item.get("importance", 0.0)) / total
            for item in features
        }

    def _build_feature_stats(self, frame: pd.DataFrame) -> dict[str, dict[str, float]]:
        stats: dict[str, dict[str, float]] = {}
        for column in frame.columns:
            values = pd.to_numeric(frame[column], errors="coerce").fillna(0.0)
            minimum = float(values.min())
            maximum = float(values.max())
            median = float(values.median())
            scale = float(max(values.std(ddof=0), (maximum - minimum) / 6.0, 1e-6))
            stats[column] = {
                "min": minimum,
                "max": maximum,
                "median": median,
                "scale": scale,
            }
        return stats

    def _build_control_spec(self, series: pd.Series, stats: dict[str, float]) -> dict[str, Any]:
        values = pd.to_numeric(series, errors="coerce").fillna(0.0)
        unique_values = sorted({round(float(value), 6) for value in values.tolist()})
        is_binary = len(unique_values) <= 2 and set(unique_values).issubset({0.0, 1.0})
        is_integer = np.allclose(values.to_numpy(), np.round(values.to_numpy()))
        minimum = float(stats.get("min", float(values.min())))
        maximum = float(stats.get("max", float(values.max())))
        step = 1 if is_binary or is_integer else self._resolve_step(minimum, maximum)

        return {
            "control_type": "binary" if is_binary else "integer" if is_integer else "continuous",
            "min": self._round_value(minimum),
            "max": self._round_value(maximum),
            "step": step,
            "default_value": self._round_value(float(values.iloc[0] if not values.empty else 0.0)),
        }

    def _resolve_control_features(self, global_payload: dict[str, Any], available_columns: list[str]) -> list[str]:
        ranked = [
            str(item.get("feature"))
            for item in global_payload.get("features", [])
            if item.get("feature") in available_columns
        ]
        if not ranked:
            ranked = available_columns[:MAX_CONTROL_FEATURES]
        return ranked[:MAX_CONTROL_FEATURES]

    def _predict_probability_matrix(self, estimator: Any, frame: pd.DataFrame, class_names: list[str]) -> np.ndarray:
        if hasattr(estimator, "predict_proba"):
            scores = np.asarray(estimator.predict_proba(frame), dtype=float)
            if scores.ndim == 1:
                scores = np.column_stack([1.0 - scores, scores])
            return self._normalize_probability_matrix(scores, class_names)

        if hasattr(estimator, "decision_function"):
            decision = np.asarray(estimator.decision_function(frame), dtype=float)
            if decision.ndim == 1:
                positive = 1.0 / (1.0 + np.exp(-decision))
                scores = np.column_stack([1.0 - positive, positive])
            else:
                shifted = decision - decision.max(axis=1, keepdims=True)
                exp_scores = np.exp(shifted)
                scores = exp_scores / exp_scores.sum(axis=1, keepdims=True)
            return self._normalize_probability_matrix(scores, class_names)

        predictions = np.asarray(estimator.predict(frame))
        scores = np.zeros((len(predictions), len(class_names)), dtype=float)
        for index, predicted in enumerate(predictions):
            if int(predicted) < scores.shape[1]:
                scores[index, int(predicted)] = 1.0
        return self._normalize_probability_matrix(scores, class_names)

    def _predict_from_surrogate(self, bundle: CachedExplainabilityRun, scenario_frame: pd.DataFrame) -> np.ndarray:
        if bundle.surrogate_model is not None:
            raw = np.asarray(bundle.surrogate_model.predict(scenario_frame), dtype=float)
            if raw.ndim == 1:
                raw = raw.reshape(1, -1)
            probabilities = self._normalize_probability_matrix(raw, bundle.class_names)
            return probabilities[0]

        return np.asarray(bundle.surrogate_baseline, dtype=float)

    def _local_shap_vector(self, bundle: CachedExplainabilityRun, scenario_frame: pd.DataFrame, output_index: int) -> np.ndarray:
        explainer = bundle.surrogate_explainer
        if explainer is None:
            return np.zeros(len(scenario_frame.columns), dtype=float)

        try:
            if hasattr(explainer, "shap_values"):
                raw_values = explainer.shap_values(scenario_frame, check_additivity=False)
            else:
                raw_values = explainer(scenario_frame).values
        except Exception:  # noqa: BLE001 - proxy fallback will handle it
            return np.zeros(len(scenario_frame.columns), dtype=float)

        matrix = self._coerce_shap_tensor(raw_values, scenario_frame.shape[1])
        if matrix.size == 0:
            return np.zeros(len(scenario_frame.columns), dtype=float)
        safe_index = min(output_index, matrix.shape[2] - 1)
        return matrix[0, :, safe_index]

    def _proxy_local_vector(
        self,
        bundle: CachedExplainabilityRun,
        scenario_row: pd.Series,
        target_index: int,
        base_value: float,
        target_probability: float,
    ) -> np.ndarray:
        del target_index
        raw_vector = np.zeros(len(scenario_row), dtype=float)
        for position, feature in enumerate(bundle.record_frame.columns):
            stats = bundle.feature_stats.get(feature, {})
            scale = max(float(stats.get("scale", 1.0)), 1e-6)
            center = float(stats.get("median", 0.0))
            weight = float(bundle.global_weight_map.get(feature, 0.0))
            raw_vector[position] = weight * ((float(scenario_row[feature]) - center) / scale)

        delta = float(target_probability - base_value)
        total = float(np.sum(np.abs(raw_vector)))
        if total <= 1e-9:
            return raw_vector
        return raw_vector * (delta / total)

    def _rank_local_contributions(
        self,
        *,
        contribution_vector: np.ndarray,
        scenario_row: pd.Series,
        target_index: int,
        class_names: list[str],
    ) -> list[dict[str, Any]]:
        del target_index, class_names
        rows = []
        for feature, impact in zip(scenario_row.index.tolist(), contribution_vector.tolist(), strict=False):
            if abs(float(impact)) < 1e-7:
                continue
            rows.append(
                {
                    "feature": feature,
                    "impact": round(float(impact), 6),
                    "value": self._round_value(float(scenario_row[feature])),
                    "direction": "increase" if float(impact) >= 0 else "decrease",
                }
            )
        rows.sort(key=lambda item: abs(float(item["impact"])), reverse=True)
        return rows[:MAX_GLOBAL_FEATURES]

    def _resolve_record(self, bundle: CachedExplainabilityRun, record_id: str) -> pd.Series:
        for index, option in enumerate(bundle.record_options):
            if str(option["record_id"]) == str(record_id):
                return bundle.record_frame.iloc[index].copy()
        if not bundle.record_frame.empty:
            return bundle.record_frame.iloc[0].copy()
        raise PipelineError(f"Record '{record_id}' is not available in the explainability sample.", status_code=404)

    def _coerce_override_value(self, raw_value: float | int | bool | str | None, spec: dict[str, Any]) -> float:
        if raw_value is None:
            return float(spec.get("default_value", 0.0))
        value = float(raw_value)
        minimum = float(spec.get("min", value))
        maximum = float(spec.get("max", value))
        clamped = max(minimum, min(maximum, value))
        if spec.get("control_type") in {"binary", "integer"}:
            return float(int(round(clamped)))
        return float(clamped)

    def _normalize_probability_matrix(self, scores: np.ndarray, class_names: list[str]) -> np.ndarray:
        matrix = np.asarray(scores, dtype=float)
        if matrix.ndim == 1:
            matrix = matrix.reshape(1, -1)
        if matrix.shape[1] == 1 and len(class_names) == 2:
            positive = np.clip(matrix[:, 0], 0.0, 1.0)
            matrix = np.column_stack([1.0 - positive, positive])
        elif matrix.shape[1] < len(class_names):
            padded = np.zeros((matrix.shape[0], len(class_names)), dtype=float)
            padded[:, : matrix.shape[1]] = matrix
            matrix = padded

        matrix = np.clip(matrix, 0.0, None)
        row_sums = matrix.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        return matrix / row_sums

    def _coerce_shap_tensor(self, raw_values: Any, feature_count: int) -> np.ndarray:
        if isinstance(raw_values, list):
            arrays = [np.asarray(values, dtype=float) for values in raw_values]
            if not arrays:
                return np.zeros((0, feature_count, 0), dtype=float)
            return np.stack(arrays, axis=-1)

        matrix = np.asarray(raw_values, dtype=float)
        if matrix.ndim == 2:
            return matrix[:, :, np.newaxis]
        if matrix.ndim == 3:
            if matrix.shape[1] == feature_count:
                return matrix
            if matrix.shape[2] == feature_count:
                return np.transpose(matrix, (1, 2, 0))
        return np.zeros((0, feature_count, 0), dtype=float)

    def _build_histogram(self, values: np.ndarray) -> list[dict[str, Any]]:
        numeric = np.asarray(values, dtype=float)
        if numeric.size == 0:
            return []
        minimum = float(np.min(numeric))
        maximum = float(np.max(numeric))
        if np.isclose(minimum, maximum):
            return [{"start": self._round_value(minimum), "end": self._round_value(maximum), "count": int(numeric.size)}]

        counts, edges = np.histogram(numeric, bins=min(HISTOGRAM_BINS, max(4, int(np.sqrt(numeric.size)))))
        return [
            {
                "start": self._round_value(edges[index]),
                "end": self._round_value(edges[index + 1]),
                "count": int(counts[index]),
            }
            for index in range(len(counts))
        ]

    def _sample_frame(self, frame: pd.DataFrame, maximum_rows: int) -> pd.DataFrame:
        if frame.empty or len(frame) <= maximum_rows:
            return frame.copy()
        indices = np.unique(np.linspace(0, len(frame) - 1, num=maximum_rows, dtype=int))
        return frame.iloc[indices].reset_index(drop=True)

    def _confidence_band(self, probability: float) -> str:
        if probability >= 0.75:
            return "high"
        if probability >= 0.45:
            return "moderate"
        return "low"

    def _resolve_step(self, minimum: float, maximum: float) -> float:
        span = abs(maximum - minimum)
        if span <= 1:
            return 0.01
        if span <= 10:
            return 0.1
        if span <= 100:
            return 1.0
        return 5.0

    def _risk_from_gap(self, train_test_gap: float) -> str:
        if train_test_gap >= 0.15:
            return "high"
        if train_test_gap >= 0.08:
            return "moderate"
        return "low"

    def _round_value(self, value: float) -> float:
        return round(float(value), 4)


explainability_service = ExplainabilityService()
