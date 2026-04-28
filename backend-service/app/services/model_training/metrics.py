from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.preprocessing import label_binarize

from app.services.model_training.dataset_builder import PreparedTrainingData
from app.services.model_training.diagnostics import TrainingDiagnosticsService


class TrainingMetricsService:
    def __init__(self) -> None:
        self._diagnostics = TrainingDiagnosticsService()

    def evaluate(
        self,
        *,
        estimator: Any,
        algorithm: str,
        data: PreparedTrainingData,
    ) -> dict[str, Any]:
        if data.problem_type == "regression":
            return self._evaluate_regression(estimator=estimator, algorithm=algorithm, data=data)

        selection_X = data.X_validation if data.X_validation is not None and data.y_validation is not None else data.X_test
        selection_y = data.y_validation if data.y_validation is not None else data.y_test
        selection_split = data.selection_split

        train_result = self._score_holdout(estimator=estimator, X=data.X_train, y=data.y_train, class_names=data.class_names)
        selection_result = self._score_holdout(estimator=estimator, X=selection_X, y=selection_y, class_names=data.class_names)
        test_result = (
            self._score_holdout(estimator=estimator, X=data.X_test, y=data.y_test, class_names=data.class_names)
            if data.X_validation is not None and data.y_validation is not None
            else None
        )

        feature_importance, feature_source = self._build_feature_importance(
            estimator=estimator,
            algorithm=algorithm,
            feature_names=data.feature_names,
            X_reference=selection_X,
            y_reference=selection_y,
            class_names=data.class_names,
        )

        split_metrics = {
            "train": train_result["metrics"],
            "test": (test_result or selection_result)["metrics"],
        }
        if data.X_validation is not None and data.y_validation is not None:
            split_metrics["validation"] = selection_result["metrics"]

        generalization = self._build_generalization_summary(split_metrics, selection_split)

        result: dict[str, Any] = {
            "metrics": selection_result["metrics"],
            "confusion_matrix": selection_result["confusion_matrix"],
            "roc_curve": selection_result["roc_curve"],
            "visualization": self._diagnostics.build(
                estimator=estimator,
                data=data,
                X_eval=selection_X,
                y_eval=selection_y,
                y_pred=selection_result["y_pred"],
                y_scores=selection_result["y_scores"],
                split_name=selection_split,
                split_metrics=split_metrics,
                generalization=generalization,
                feature_signal_source=feature_source,
            ),
            "evaluation_split": selection_split,
            "feature_importance": feature_importance,
            "feature_importance_source": feature_source,
            "train_metrics": train_result["metrics"],
        }
        if test_result is not None:
            result["test_metrics"] = test_result["metrics"]
            result["test_confusion_matrix"] = test_result["confusion_matrix"]
            result["test_roc_curve"] = test_result["roc_curve"]
            result["test_visualization"] = self._diagnostics.build(
                estimator=estimator,
                data=data,
                X_eval=data.X_test,
                y_eval=data.y_test,
                y_pred=test_result["y_pred"],
                y_scores=test_result["y_scores"],
                split_name="test",
                split_metrics=split_metrics,
                generalization=generalization,
                feature_signal_source=feature_source,
            )
        return result

    def _evaluate_regression(
        self,
        *,
        estimator: Any,
        algorithm: str,
        data: PreparedTrainingData,
    ) -> dict[str, Any]:
        selection_X = data.X_validation if data.X_validation is not None and data.y_validation is not None else data.X_test
        selection_y = data.y_validation if data.y_validation is not None else data.y_test
        selection_split = data.selection_split

        train_result = self._score_regression_holdout(estimator=estimator, X=data.X_train, y=data.y_train)
        selection_result = self._score_regression_holdout(estimator=estimator, X=selection_X, y=selection_y)
        test_result = (
            self._score_regression_holdout(estimator=estimator, X=data.X_test, y=data.y_test)
            if data.X_validation is not None and data.y_validation is not None
            else None
        )

        feature_importance, feature_source = self._build_feature_importance(
            estimator=estimator,
            algorithm=algorithm,
            feature_names=data.feature_names,
            X_reference=selection_X,
            y_reference=selection_y,
            class_names=[],
            problem_type="regression",
        )

        split_metrics = {
            "train": train_result["metrics"],
            "test": (test_result or selection_result)["metrics"],
        }
        if data.X_validation is not None and data.y_validation is not None:
            split_metrics["validation"] = selection_result["metrics"]

        generalization = self._build_regression_generalization_summary(split_metrics, selection_split)

        result: dict[str, Any] = {
            "metrics": selection_result["metrics"],
            "confusion_matrix": {},
            "roc_curve": {},
            "visualization": self._diagnostics.build(
                estimator=estimator,
                data=data,
                X_eval=selection_X,
                y_eval=selection_y,
                y_pred=selection_result["y_pred"],
                y_scores=None,
                split_name=selection_split,
                split_metrics=split_metrics,
                generalization=generalization,
                feature_signal_source=feature_source,
            ),
            "evaluation_split": selection_split,
            "feature_importance": feature_importance,
            "feature_importance_source": feature_source,
            "train_metrics": train_result["metrics"],
        }
        if test_result is not None:
            result["test_metrics"] = test_result["metrics"]
            result["test_confusion_matrix"] = {}
            result["test_roc_curve"] = {}
            result["test_visualization"] = self._diagnostics.build(
                estimator=estimator,
                data=data,
                X_eval=data.X_test,
                y_eval=data.y_test,
                y_pred=test_result["y_pred"],
                y_scores=None,
                split_name="test",
                split_metrics=split_metrics,
                generalization=generalization,
                feature_signal_source=feature_source,
            )
        return result

    def _score_regression_holdout(
        self,
        *,
        estimator: Any,
        X: pd.DataFrame,
        y: np.ndarray,
    ) -> dict[str, Any]:
        y_pred = np.asarray(estimator.predict(X), dtype=float)
        return {
            "metrics": self._build_regression_metrics(y, y_pred),
            "y_pred": y_pred,
        }

    def _score_holdout(
        self,
        *,
        estimator: Any,
        X: pd.DataFrame,
        y: np.ndarray,
        class_names: list[str],
    ) -> dict[str, Any]:
        y_pred = estimator.predict(X)
        y_scores = self._predict_scores(estimator, X)
        return {
            "metrics": self._build_metrics(class_names, y, y_pred, y_scores),
            "confusion_matrix": self._build_confusion_matrix(class_names, y, y_pred),
            "roc_curve": self._build_roc_curve(class_names, y, y_scores),
            "y_pred": y_pred,
            "y_scores": y_scores,
        }

    def _build_metrics(
        self,
        class_names: list[str],
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_scores: np.ndarray | None,
    ) -> dict[str, float | None]:
        average = "binary" if len(class_names) == 2 else "macro"

        metrics: dict[str, float | None] = {
            "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
            "precision": round(float(precision_score(y_true, y_pred, average=average, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, average=average, zero_division=0)), 4),
            "sensitivity": round(float(recall_score(y_true, y_pred, average=average, zero_division=0)), 4),
            "specificity": None,
            "f1_score": round(float(f1_score(y_true, y_pred, average=average, zero_division=0)), 4),
            "auc": None,
        }

        if len(class_names) == 2:
            cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
            tn, fp, fn, tp = cm.ravel()
            specificity = tn / (tn + fp) if (tn + fp) else 0.0
            metrics["specificity"] = round(float(specificity), 4)

            if y_scores is not None and len(np.unique(y_true)) > 1:
                try:
                    positive_scores = y_scores if np.asarray(y_scores).ndim == 1 else np.asarray(y_scores)[:, 1]
                    metrics["auc"] = round(float(roc_auc_score(y_true, positive_scores)), 4)
                except ValueError:
                    metrics["auc"] = None
        elif y_scores is not None and np.asarray(y_scores).ndim == 2 and len(np.unique(y_true)) > 1:
            try:
                metrics["auc"] = round(
                    float(roc_auc_score(y_true, y_scores, multi_class="ovr", average="macro")),
                    4,
                )
            except ValueError:
                metrics["auc"] = None

        return metrics

    def _build_confusion_matrix(self, class_names: list[str], y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, int]:
        if len(class_names) != 2:
            return {}
        cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}

    def _build_roc_curve(
        self,
        class_names: list[str],
        y_true: np.ndarray,
        y_scores: np.ndarray | None,
    ) -> dict[str, Any]:
        if y_scores is None or len(np.unique(y_true)) < 2:
            return {}

        scores = np.asarray(y_scores)
        if len(class_names) == 2:
            positive_scores = scores if scores.ndim == 1 else scores[:, 1]
            fpr, tpr, _ = roc_curve(y_true, positive_scores)
            return {
                "mode": "binary",
                "fpr": [round(float(value), 4) for value in fpr.tolist()],
                "tpr": [round(float(value), 4) for value in tpr.tolist()],
                "curves": [
                    {
                        "label": class_names[1],
                        "auc": round(float(roc_auc_score(y_true, positive_scores)), 4),
                        "fpr": [round(float(value), 4) for value in fpr.tolist()],
                        "tpr": [round(float(value), 4) for value in tpr.tolist()],
                    }
                ],
            }

        if scores.ndim != 2:
            return {}

        y_binary = label_binarize(y_true, classes=list(range(len(class_names))))
        curves: list[dict[str, Any]] = []
        for class_index, label in enumerate(class_names):
            class_targets = y_binary[:, class_index]
            if int(class_targets.min()) == int(class_targets.max()):
                continue
            fpr, tpr, _ = roc_curve(class_targets, scores[:, class_index])
            curves.append(
                {
                    "label": label,
                    "auc": round(float(roc_auc_score(class_targets, scores[:, class_index])), 4),
                    "fpr": [round(float(value), 4) for value in fpr.tolist()],
                    "tpr": [round(float(value), 4) for value in tpr.tolist()],
                }
            )

        if not curves:
            return {}

        micro_fpr, micro_tpr, _ = roc_curve(y_binary.ravel(), scores.ravel())
        curves.append(
            {
                "label": "Micro average",
                "auc": round(float(roc_auc_score(y_binary, scores, average="micro", multi_class="ovr")), 4),
                "fpr": [round(float(value), 4) for value in micro_fpr.tolist()],
                "tpr": [round(float(value), 4) for value in micro_tpr.tolist()],
            }
        )
        return {
            "mode": "multiclass",
            "curves": curves,
        }

    def _build_feature_importance(
        self,
        estimator: Any,
        algorithm: str,
        feature_names: list[str],
        X_reference: pd.DataFrame,
        y_reference: np.ndarray,
        class_names: list[str],
        problem_type: str = "classification",
    ) -> tuple[list[dict[str, float | str]], str]:
        importances: np.ndarray | None = None
        source = "native"

        if hasattr(estimator, "feature_importances_"):
            importances = np.asarray(estimator.feature_importances_, dtype=float)
        elif algorithm in {"lr", "svm"} and hasattr(estimator, "coef_"):
            coefficients = np.asarray(estimator.coef_, dtype=float)
            if coefficients.ndim == 1:
                importances = np.abs(coefficients)
            else:
                importances = np.abs(coefficients).mean(axis=0)

        if importances is None or importances.size == 0 or float(np.abs(importances).sum()) == 0.0:
            sampled_X, sampled_y = self._sample_reference_frame(X_reference, y_reference, maximum_rows=250)
            if problem_type == "regression":
                scoring = "neg_root_mean_squared_error"
            else:
                scoring = "f1_macro" if len(class_names) > 2 else "f1"
            try:
                result = permutation_importance(
                    estimator,
                    sampled_X,
                    sampled_y,
                    n_repeats=3,
                    random_state=42,
                    scoring=scoring,
                )
                importances = np.asarray(result.importances_mean, dtype=float)
                source = "permutation"
            except ValueError:
                importances = None

        if importances is None or importances.size == 0:
            return [], source

        feature_frame = pd.DataFrame(
            {
                "feature": feature_names,
                "importance": importances.tolist(),
            }
        )
        feature_frame["importance"] = feature_frame["importance"].abs()
        feature_frame = feature_frame.sort_values("importance", ascending=False).head(15)

        return (
            [
                {
                    "feature": str(row.feature),
                    "importance": round(float(row.importance), 6),
                }
                for row in feature_frame.itertuples(index=False)
                if float(row.importance) > 0
            ],
            source,
        )

    def _build_regression_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float | None]:
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        r2 = float(r2_score(y_true, y_pred))
        try:
            mape = float(mean_absolute_percentage_error(y_true, y_pred))
        except ValueError:
            mape = 0.0

        return {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "sensitivity": None,
            "specificity": None,
            "f1_score": None,
            "auc": None,
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
            "mape": round(mape, 4),
        }

    def _sample_reference_frame(
        self,
        X_reference: pd.DataFrame,
        y_reference: np.ndarray,
        *,
        maximum_rows: int,
    ) -> tuple[pd.DataFrame, np.ndarray]:
        if len(X_reference) <= maximum_rows:
            return X_reference, y_reference
        indices = np.unique(np.linspace(0, len(X_reference) - 1, num=maximum_rows, dtype=int))
        return X_reference.iloc[indices].reset_index(drop=True), y_reference[indices]

    def _build_generalization_summary(
        self,
        split_metrics: dict[str, dict[str, float | None]],
        selection_split: str,
    ) -> dict[str, Any]:
        train_metrics = split_metrics.get("train", {})
        selection_metrics = split_metrics.get(selection_split, split_metrics.get("test", {}))
        test_metrics = split_metrics.get("test", {})

        train_f1 = float(train_metrics.get("f1_score") or 0.0)
        selection_f1 = float(selection_metrics.get("f1_score") or 0.0)
        test_f1 = float(test_metrics.get("f1_score") or 0.0)
        selection_gap = round(train_f1 - selection_f1, 4)
        test_gap = round(train_f1 - test_f1, 4)

        risk = "low"
        if max(selection_gap, test_gap) >= 0.15:
            risk = "high"
        elif max(selection_gap, test_gap) >= 0.08:
            risk = "moderate"

        notes = []
        if selection_gap >= 0.15:
            notes.append(f"Train F1 is much higher than {selection_split} F1. Overfitting is likely.")
        elif selection_gap >= 0.08:
            notes.append(f"Train F1 is noticeably above {selection_split} F1. Keep an eye on generalization.")
        else:
            notes.append(f"Train and {selection_split} F1 are fairly close.")

        if selection_split != "test":
            if test_gap >= 0.15:
                notes.append("Final test performance drops sharply versus train. The selected setup may not generalize well.")
            elif test_gap >= 0.08:
                notes.append("Final test performance is lower than train by a visible margin.")
            else:
                notes.append("Final test performance stays close to train.")

        return {
            "risk": risk,
            "selection_split": selection_split,
            "primary_metric_name": "f1_score",
            "primary_metric_direction": "higher_is_better",
            "train_minus_selection_f1": selection_gap,
            "train_minus_test_f1": test_gap,
            "train_minus_selection": selection_gap,
            "train_minus_test": test_gap,
            "notes": notes,
        }

    def _build_regression_generalization_summary(
        self,
        split_metrics: dict[str, dict[str, float | None]],
        selection_split: str,
    ) -> dict[str, Any]:
        train_metrics = split_metrics.get("train", {})
        selection_metrics = split_metrics.get(selection_split, split_metrics.get("test", {}))
        test_metrics = split_metrics.get("test", {})

        train_rmse = float(train_metrics.get("rmse") or 0.0)
        selection_rmse = float(selection_metrics.get("rmse") or 0.0)
        test_rmse = float(test_metrics.get("rmse") or 0.0)
        selection_gap = round(selection_rmse - train_rmse, 4)
        test_gap = round(test_rmse - train_rmse, 4)

        risk = "low"
        if max(selection_gap, test_gap) >= 0.2:
            risk = "high"
        elif max(selection_gap, test_gap) >= 0.08:
            risk = "moderate"

        notes = []
        if selection_gap >= 0.2:
            notes.append(f"{selection_split.title()} RMSE is much higher than train RMSE. Overfitting is likely.")
        elif selection_gap >= 0.08:
            notes.append(f"{selection_split.title()} RMSE is noticeably higher than train RMSE.")
        else:
            notes.append(f"Train and {selection_split} RMSE are fairly close.")

        if selection_split != "test":
            if test_gap >= 0.2:
                notes.append("Final test RMSE rises sharply versus train.")
            elif test_gap >= 0.08:
                notes.append("Final test RMSE is higher than train by a visible margin.")
            else:
                notes.append("Final test RMSE stays close to train.")

        return {
            "risk": risk,
            "selection_split": selection_split,
            "primary_metric_name": "rmse",
            "primary_metric_direction": "lower_is_better",
            "train_minus_selection_f1": None,
            "train_minus_test_f1": None,
            "train_minus_selection": selection_gap,
            "train_minus_test": test_gap,
            "notes": notes,
        }

    def _predict_scores(self, estimator: Any, X_test: pd.DataFrame) -> np.ndarray | None:
        if hasattr(estimator, "predict_proba"):
            probabilities = estimator.predict_proba(X_test)
            if probabilities.ndim == 2 and probabilities.shape[1] == 2:
                return probabilities[:, 1]
            return probabilities
        if hasattr(estimator, "decision_function"):
            scores = np.asarray(estimator.decision_function(X_test))
            if scores.ndim == 1:
                min_score = float(scores.min())
                max_score = float(scores.max())
                if max_score > min_score:
                    return (scores - min_score) / (max_score - min_score)
            return scores
        return None
