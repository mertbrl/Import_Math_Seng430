from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from app.core.exceptions import PipelineError
from app.services.data_prep._column_resolution import resolve_column_name
from app.services.data_prep._dataframe_loader import load_dataframe
from app.services.data_prep.pipeline_execution import normalize_pipeline_config
from app.services.model_training.preprocessor import LeakageSafeTrainingPreprocessor, ROW_ID_COLUMN
from app.services.session_service import SessionState, session_service


@dataclass
class PreparedTrainingData:
    problem_type: str
    target_column: str
    feature_names: list[str]
    class_names: list[str]
    selection_split: str
    X_train: pd.DataFrame
    X_validation: pd.DataFrame | None
    X_test: pd.DataFrame
    y_train: np.ndarray
    y_validation: np.ndarray | None
    y_test: np.ndarray


class TrainingDatasetBuilder:
    def __init__(self) -> None:
        self._preprocessor = LeakageSafeTrainingPreprocessor()
        self._split_lock = Lock()

    def prepare(self, session_id: str, pipeline_config: dict[str, Any] | None = None) -> PreparedTrainingData:
        state = session_service.get_or_create(session_id)
        config = self._resolve_pipeline_config(session_id, state, pipeline_config)

        problem_type = self._resolve_problem_type(config, state)
        if problem_type == "regression":
            raise PipelineError("Step 4 currently supports classification datasets only.", status_code=400)

        raw_df = load_dataframe(session_id)
        target_column = self._resolve_target_column(raw_df, config, state)

        source_df = self._preprocessor.prepare_source_dataframe(raw_df, config, target_column)
        if target_column not in source_df.columns:
            raise PipelineError(
                f"Target column '{target_column}' is missing after preprocessing. Adjust Step 3 configuration.",
                status_code=400,
            )

        source_df = self._drop_missing_target_rows(source_df, target_column)
        if source_df.empty:
            raise PipelineError("Training requires at least one row with a non-empty target.", status_code=400)

        train_source, validation_source, test_source = self._split_dataframe(state, source_df, config, target_column, problem_type)
        train_df, validation_df = self._preprocessor.fit_transform(train_source, validation_source, config, target_column, problem_type)
        _, test_df = self._preprocessor.fit_transform(train_source, test_source, config, target_column, problem_type)

        train_df = self._drop_missing_target_rows(train_df, target_column)
        validation_df = self._drop_missing_target_rows(validation_df, target_column) if not validation_df.empty else validation_df
        test_df = self._drop_missing_target_rows(test_df, target_column)
        if train_df.empty or test_df.empty:
            raise PipelineError("Training requires non-empty train and test splits after preprocessing.", status_code=400)

        X_train, X_validation, X_test = self._build_feature_matrices(train_df, validation_df, test_df, target_column)
        if X_train.empty or X_test.empty:
            raise PipelineError("Training requires non-empty train and test splits after preprocessing.", status_code=400)
        if X_train.shape[1] == 0:
            raise PipelineError("Training requires at least one usable feature column after preprocessing.", status_code=400)

        y_train, y_validation, y_test, class_names = self._encode_target(train_df, validation_df, test_df, target_column)
        if len(np.unique(y_train)) < 2:
            raise PipelineError("Training requires at least two target classes in the training split.", status_code=400)

        return PreparedTrainingData(
            problem_type=problem_type,
            target_column=target_column,
            feature_names=X_train.columns.tolist(),
            class_names=class_names,
            selection_split="validation" if X_validation is not None and not X_validation.empty else "test",
            X_train=X_train,
            X_validation=X_validation,
            X_test=X_test,
            y_train=y_train,
            y_validation=y_validation,
            y_test=y_test,
        )

    def _resolve_pipeline_config(
        self,
        session_id: str,
        state: SessionState,
        pipeline_config: dict[str, Any] | None,
    ) -> dict[str, Any]:
        raw_config = pipeline_config or {
            "session_id": session_id,
            "target_column": state.mapping.get("target_column") or state.dataset.get("target_column") or "",
            "problem_type": state.mapping.get("problem_type") or "binary_classification",
            "excluded_columns": [],
            "basic_cleaning": {},
            "sampling": {},
            "data_split": {},
            "imputation": {},
            "outliers": {},
            "transformation": {},
            "encoding": {},
            "scaling": {},
            "dimensionality_reduction": {},
            "feature_selection": {},
            "imbalance": {},
        }
        normalized = normalize_pipeline_config({"pipeline_config": raw_config})
        normalized["session_id"] = session_id
        return normalized

    def _resolve_target_column(self, df: pd.DataFrame, config: dict[str, Any], state: SessionState) -> str:
        raw_target = (
            str(config.get("target_column") or "")
            or str(state.mapping.get("target_column") or "")
            or str(state.dataset.get("target_column") or "")
        )
        if not raw_target:
            raise PipelineError("Training requires a mapped target column from Step 2.", status_code=400)
        return resolve_column_name(df, raw_target)

    def _resolve_problem_type(self, config: dict[str, Any], state: SessionState) -> str:
        requested = str(config.get("problem_type") or "").lower()
        if requested in {"classification", "multiclass", "regression"}:
            return requested
        mapped = str(state.mapping.get("problem_type") or "").lower()
        if mapped == "multi_class_classification":
            return "multiclass"
        if mapped == "regression":
            return "regression"
        return "classification"

    def _split_dataframe(
        self,
        state: SessionState,
        df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
        problem_type: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        split_config = dict(config.get("data_split", {}) or {})
        force_resplit = bool(split_config.pop("force_resplit", False))
        signature = self._build_split_signature(df, split_config, target_column, problem_type)

        with self._split_lock:
            cache = dict(state.training_split_cache or {})
            if cache.get("signature") == signature and not force_resplit:
                cached_train = self._slice_cached_split(df, cache.get("train_row_ids", []) or [])
                cached_validation = self._slice_cached_split(df, cache.get("validation_row_ids", []) or [])
                cached_test = self._slice_cached_split(df, cache.get("test_row_ids", []) or [])
                if not cached_train.empty and not cached_test.empty:
                    return (
                        cached_train.reset_index(drop=True),
                        cached_validation.reset_index(drop=True),
                        cached_test.reset_index(drop=True),
                    )

            seed = self._next_split_seed(cache if cache.get("signature") == signature else None, force_resplit)
            train_df, validation_df, test_df = self._perform_split(df, split_config, target_column, problem_type, seed)
            state.training_split_cache = {
                "signature": signature,
                "seed": seed,
                "train_row_ids": train_df[ROW_ID_COLUMN].tolist(),
                "validation_row_ids": validation_df[ROW_ID_COLUMN].tolist(),
                "test_row_ids": test_df[ROW_ID_COLUMN].tolist(),
            }
            session_service.touch(state, bump_revision=False)
            return (
                train_df.reset_index(drop=True),
                validation_df.reset_index(drop=True),
                test_df.reset_index(drop=True),
            )

    def _perform_split(
        self,
        df: pd.DataFrame,
        split_config: dict[str, Any],
        target_column: str,
        problem_type: str,
        seed: int,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        validation_df = pd.DataFrame(columns=df.columns)
        anchor_train_df, split_df = self._reserve_train_anchor_rows(df, target_column, problem_type, seed)
        if split_config.get("enabled"):
            strategy = str(split_config.get("strategy", "2-way"))
            train_ratio = float(split_config.get("train", 0.8))
            val_ratio = float(split_config.get("val", 0.0))
            test_ratio = float(split_config.get("test", 0.2))
            use_stratify = bool(split_config.get("stratify") and problem_type != "regression")

            stratify = self._stratify_labels(split_df, target_column, problem_type, use_stratify)
            train_df, temp_df = self._safe_train_test_split(split_df, train_ratio, stratify, seed)

            if strategy == "2-way" or val_ratio <= 0.0 or temp_df.empty:
                test_df = temp_df.copy()
            else:
                remaining_ratio = val_ratio + test_ratio
                relative_val_ratio = val_ratio / remaining_ratio if remaining_ratio > 0 else 0.0
                temp_stratify = self._stratify_labels(temp_df, target_column, problem_type, use_stratify)
                validation_df, test_df = self._safe_train_test_split(temp_df, relative_val_ratio, temp_stratify, seed)
        else:
            stratify = self._stratify_labels(split_df, target_column, problem_type, True)
            train_df, test_df = self._safe_train_test_split(split_df, 0.8, stratify, seed)

        if not anchor_train_df.empty:
            train_df = pd.concat([train_df, anchor_train_df], ignore_index=True)

        if test_df.empty and len(train_df) > 1:
            fallback_stratify = self._stratify_labels(train_df, target_column, problem_type, True)
            train_df, test_df = self._safe_train_test_split(train_df, 0.8, fallback_stratify, seed)

        if test_df.empty:
            raise PipelineError("Training requires a non-empty test split.", status_code=400)

        return train_df, validation_df, test_df

    def _reserve_train_anchor_rows(
        self,
        df: pd.DataFrame,
        target_column: str,
        problem_type: str,
        seed: int,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        if problem_type == "regression" or target_column not in df.columns or df.empty:
            return pd.DataFrame(columns=df.columns), df

        anchor_indices: list[Any] = []
        for _, group in df.groupby(target_column, dropna=False, sort=False):
            if group.empty:
                continue
            anchor_indices.append(group.sample(n=1, random_state=seed).index[0])

        if not anchor_indices:
            return pd.DataFrame(columns=df.columns), df

        anchor_df = df.loc[anchor_indices].copy()
        remaining_df = df.drop(index=anchor_indices).copy()
        return anchor_df, remaining_df

    def _safe_train_test_split(
        self,
        df: pd.DataFrame,
        train_size: float,
        stratify: pd.Series | None,
        seed: int,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        kwargs: dict[str, Any] = {"train_size": train_size, "random_state": seed}
        if stratify is not None:
            kwargs["stratify"] = stratify
        try:
            return train_test_split(df, **kwargs)
        except ValueError:
            kwargs.pop("stratify", None)
            return train_test_split(df, **kwargs)

    def _stratify_labels(
        self,
        df: pd.DataFrame,
        target_column: str,
        problem_type: str,
        enabled: bool,
    ) -> pd.Series | None:
        if not enabled or problem_type == "regression" or target_column not in df.columns:
            return None
        target = df[target_column]
        if target.nunique(dropna=True) < 2:
            return None
        class_counts = target.value_counts(dropna=True)
        if class_counts.empty or int(class_counts.min()) < 2:
            return None
        return target

    def _build_split_signature(
        self,
        df: pd.DataFrame,
        split_config: dict[str, Any],
        target_column: str,
        problem_type: str,
    ) -> str:
        payload = {
            "row_ids": df[ROW_ID_COLUMN].tolist() if ROW_ID_COLUMN in df.columns else [],
            "split": {
                "enabled": bool(split_config.get("enabled")),
                "strategy": str(split_config.get("strategy", "2-way")),
                "train": float(split_config.get("train", 0.8)),
                "val": float(split_config.get("val", 0.0)),
                "test": float(split_config.get("test", 0.2)),
                "stratify": bool(split_config.get("stratify")),
            },
            "target_column": target_column,
            "problem_type": problem_type,
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def _next_split_seed(self, cache: dict[str, Any] | None, force_resplit: bool) -> int:
        if not cache:
            return 42
        seed = int(cache.get("seed", 42))
        return seed + 1 if force_resplit else seed

    def _slice_cached_split(self, df: pd.DataFrame, row_ids: list[Any]) -> pd.DataFrame:
        if ROW_ID_COLUMN not in df.columns or not row_ids:
            return pd.DataFrame(columns=df.columns)
        ordering = {row_id: position for position, row_id in enumerate(row_ids)}
        subset = df[df[ROW_ID_COLUMN].isin(ordering)].copy()
        if subset.empty:
            return subset
        subset["__split_order__"] = subset[ROW_ID_COLUMN].map(ordering)
        subset = subset.sort_values("__split_order__").drop(columns=["__split_order__"])
        return subset

    def _drop_missing_target_rows(self, df: pd.DataFrame, target_column: str) -> pd.DataFrame:
        if target_column not in df.columns:
            raise PipelineError(f"Target column '{target_column}' is unavailable for training.", status_code=400)
        return df.dropna(subset=[target_column]).reset_index(drop=True)

    def _build_feature_matrices(
        self,
        train_df: pd.DataFrame,
        validation_df: pd.DataFrame,
        test_df: pd.DataFrame,
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame | None, pd.DataFrame]:
        X_train_raw = train_df.drop(columns=[target_column], errors="ignore").copy()
        X_validation_raw = validation_df.drop(columns=[target_column], errors="ignore").copy() if not validation_df.empty else pd.DataFrame(columns=X_train_raw.columns)
        X_test_raw = test_df.drop(columns=[target_column], errors="ignore").copy()

        unsafe_columns = self._identify_unsafe_feature_columns(X_train_raw)
        if unsafe_columns:
            X_train_raw = X_train_raw.drop(columns=unsafe_columns, errors="ignore")
            X_validation_raw = X_validation_raw.drop(columns=unsafe_columns, errors="ignore")
            X_test_raw = X_test_raw.drop(columns=unsafe_columns, errors="ignore")

        X_train_raw = X_train_raw.replace([np.inf, -np.inf], np.nan)
        X_validation_raw = X_validation_raw.replace([np.inf, -np.inf], np.nan)
        X_test_raw = X_test_raw.replace([np.inf, -np.inf], np.nan)

        X_train = pd.get_dummies(X_train_raw, drop_first=False, dtype=float)
        X_validation = pd.get_dummies(X_validation_raw, drop_first=False, dtype=float) if not validation_df.empty else None
        X_test = pd.get_dummies(X_test_raw, drop_first=False, dtype=float)
        if X_validation is not None:
            X_validation = X_validation.reindex(columns=X_train.columns, fill_value=0.0)
        X_test = X_test.reindex(columns=X_train.columns, fill_value=0.0)

        fill_values = X_train.median(numeric_only=True).fillna(0.0)
        X_train = X_train.fillna(fill_values).fillna(0.0)
        if X_validation is not None:
            X_validation = X_validation.fillna(fill_values).fillna(0.0)
        X_test = X_test.fillna(fill_values).fillna(0.0)

        return (
            X_train.astype(float),
            X_validation.astype(float) if X_validation is not None else None,
            X_test.astype(float),
        )

    def _identify_unsafe_feature_columns(self, train_df: pd.DataFrame) -> list[str]:
        row_count = max(1, len(train_df))
        high_cardinality_limit = min(200, max(32, int(np.sqrt(row_count) * 4)))
        identifier_hints = ("id", "index", "uuid", "patient", "encounter", "image", "record", "name")

        drop_columns: list[str] = []
        for column in train_df.columns:
            series = train_df[column]
            observed = series.dropna()
            if observed.empty:
                continue

            unique_count = observed.astype(str).nunique()
            unique_ratio = unique_count / max(1, len(observed))
            column_name = column.lower()
            looks_like_identifier = any(hint in column_name for hint in identifier_hints)
            is_text_like = not pd.api.types.is_numeric_dtype(series)

            if looks_like_identifier and unique_ratio >= 0.5:
                drop_columns.append(column)
                continue

            if is_text_like and (
                unique_count > high_cardinality_limit or (unique_ratio >= 0.9 and unique_count >= 20)
            ):
                drop_columns.append(column)

        return drop_columns

    def _encode_target(
        self,
        train_df: pd.DataFrame,
        validation_df: pd.DataFrame,
        test_df: pd.DataFrame,
        target_column: str,
    ) -> tuple[np.ndarray, np.ndarray | None, np.ndarray, list[str]]:
        encoder = LabelEncoder()
        train_target = train_df[target_column].astype(str)
        validation_target = validation_df[target_column].astype(str) if not validation_df.empty else None
        test_target = test_df[target_column].astype(str)
        encoder.fit(train_target)

        known_labels = set(encoder.classes_.tolist())
        unseen_validation_labels = sorted(set(validation_target.unique()) - known_labels) if validation_target is not None else []
        unseen_test_labels = sorted(set(test_target.unique()) - known_labels)
        if unseen_validation_labels or unseen_test_labels:
            raise PipelineError(
                "Validation/Test split contains target classes that are absent from the training split. Request a new split or enable stratification.",
                status_code=400,
            )

        y_train = encoder.transform(train_target)
        y_validation = encoder.transform(validation_target) if validation_target is not None else None
        y_test = encoder.transform(test_target)
        return y_train, y_validation, y_test, encoder.classes_.tolist()
