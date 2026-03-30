from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

from app.services.model_training.dataset_builder import PreparedTrainingData


class TrainingDiagnosticsService:
    def build(
        self,
        *,
        estimator: Any,
        data: PreparedTrainingData,
        X_eval: pd.DataFrame,
        y_eval: np.ndarray,
        y_pred: np.ndarray,
        y_scores: np.ndarray | None,
        split_name: str,
        split_metrics: dict[str, Any] | None = None,
        generalization: dict[str, Any] | None = None,
        feature_signal_source: str | None = None,
    ) -> dict[str, Any]:
        return {
            "split_summary": self._build_split_summary(data, split_name),
            "split_metrics": split_metrics or {},
            "generalization": generalization or {},
            "feature_signal_source": feature_signal_source,
            "per_class_metrics": self._build_per_class_metrics(data.class_names, y_eval, y_pred),
            "confusion_matrix_full": self._build_confusion_matrix_full(data.class_names, y_eval, y_pred),
            "confidence_histogram": self._build_confidence_histogram(y_eval, y_pred, y_scores),
            "projection": self._build_projection(estimator, data, X_eval, y_eval, y_pred, y_scores),
        }

    def _build_split_summary(self, data: PreparedTrainingData, split_name: str) -> dict[str, Any]:
        summary = {
            "selection_split": split_name,
            "train_rows": int(len(data.X_train)),
            "validation_rows": int(len(data.X_validation)) if data.X_validation is not None else 0,
            "test_rows": int(len(data.X_test)),
            "class_distribution": {
                "train": self._class_distribution(data.class_names, data.y_train),
                "test": self._class_distribution(data.class_names, data.y_test),
            },
        }
        if data.y_validation is not None:
            summary["class_distribution"]["validation"] = self._class_distribution(data.class_names, data.y_validation)
        return summary

    def _class_distribution(self, class_names: list[str], y_values: np.ndarray) -> list[dict[str, Any]]:
        total = int(len(y_values))
        counts = np.bincount(y_values, minlength=len(class_names))
        distribution: list[dict[str, Any]] = []
        for index, label in enumerate(class_names):
            count = int(counts[index]) if index < len(counts) else 0
            distribution.append(
                {
                    "label": label,
                    "count": count,
                    "ratio": round(float(count / total), 4) if total else 0.0,
                }
            )
        return distribution

    def _build_per_class_metrics(
        self,
        class_names: list[str],
        y_true: np.ndarray,
        y_pred: np.ndarray,
    ) -> list[dict[str, Any]]:
        precision, recall, f1, support = precision_recall_fscore_support(
            y_true,
            y_pred,
            labels=list(range(len(class_names))),
            zero_division=0,
        )

        rows: list[dict[str, Any]] = []
        for index, label in enumerate(class_names):
            rows.append(
                {
                    "label": label,
                    "precision": round(float(precision[index]), 4),
                    "recall": round(float(recall[index]), 4),
                    "f1_score": round(float(f1[index]), 4),
                    "support": int(support[index]),
                }
            )
        return rows

    def _build_confusion_matrix_full(
        self,
        class_names: list[str],
        y_true: np.ndarray,
        y_pred: np.ndarray,
    ) -> dict[str, Any]:
        matrix = confusion_matrix(y_true, y_pred, labels=list(range(len(class_names))))
        return {
            "labels": class_names,
            "matrix": matrix.astype(int).tolist(),
        }

    def _build_confidence_histogram(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_scores: np.ndarray | None,
    ) -> list[dict[str, Any]]:
        if y_scores is None:
            return []

        confidence = self._extract_confidence(y_scores)
        if confidence is None or confidence.size == 0:
            return []

        bins = np.linspace(0.0, 1.0, 11)
        histogram: list[dict[str, Any]] = []
        correct_mask = y_true == y_pred

        for start, end in zip(bins[:-1], bins[1:], strict=False):
            if end == 1.0:
                mask = (confidence >= start) & (confidence <= end)
            else:
                mask = (confidence >= start) & (confidence < end)

            count = int(mask.sum())
            correct = int(correct_mask[mask].sum()) if count else 0
            histogram.append(
                {
                    "start": round(float(start), 2),
                    "end": round(float(end), 2),
                    "count": count,
                    "accuracy": round(float(correct / count), 4) if count else None,
                }
            )

        return histogram

    def _extract_confidence(self, y_scores: np.ndarray) -> np.ndarray | None:
        scores = np.asarray(y_scores)
        if scores.ndim == 1:
            return np.maximum(scores, 1.0 - scores)
        if scores.ndim == 2 and scores.shape[1] >= 1:
            return np.max(scores, axis=1)
        return None

    def _build_projection(
        self,
        estimator: Any,
        data: PreparedTrainingData,
        X_eval: pd.DataFrame,
        y_eval: np.ndarray,
        y_pred: np.ndarray,
        y_scores: np.ndarray | None,
    ) -> dict[str, Any]:
        del estimator

        if X_eval.empty or data.X_train.empty:
            return {}
        if data.X_train.shape[1] < 2 or len(X_eval) < 3:
            return {}

        eval_frame = X_eval.reset_index(drop=True)
        train_frame = data.X_train.reset_index(drop=True)

        try:
            pca = PCA(n_components=2, random_state=42)
            pca.fit(train_frame)
            coords = pca.transform(eval_frame)
            explained_variance = [round(float(value), 4) for value in pca.explained_variance_ratio_.tolist()]
        except ValueError:
            return {}

        confidence = self._extract_confidence(y_scores) if y_scores is not None else None
        indices = self._sample_indices(len(eval_frame), maximum=220)
        points: list[dict[str, Any]] = []

        for index in indices:
            actual_index = int(y_eval[index])
            predicted_index = int(y_pred[index])
            points.append(
                {
                    "x": round(float(coords[index][0]), 6),
                    "y": round(float(coords[index][1]), 6),
                    "actual": data.class_names[actual_index],
                    "predicted": data.class_names[predicted_index],
                    "correct": bool(actual_index == predicted_index),
                    "confidence": round(float(confidence[index]), 4) if confidence is not None else None,
                }
            )

        return {
            "method": "pca_train_fit",
            "explained_variance": explained_variance,
            "points": points,
            "sample_size": int(len(points)),
        }

    def _sample_indices(self, size: int, *, maximum: int) -> np.ndarray:
        if size <= maximum:
            return np.arange(size)
        return np.unique(np.linspace(0, size - 1, num=maximum, dtype=int))
