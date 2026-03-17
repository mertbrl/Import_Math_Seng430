from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.impute import KNNImputer
from sklearn.neighbors import LocalOutlierFactor, NearestNeighbors
from sklearn.preprocessing import MinMaxScaler, PowerTransformer, RobustScaler, StandardScaler

from app.core.exceptions import PipelineError
from app.services.data_prep.step02_sampling import apply_sampling
from app.services.data_prep.step03_data_split import apply_data_split
from app.services.data_prep.step09_feature_selection import apply_feature_selection
from app.services.session_service import session_service

PIPELINE_STAGE_ORDER = [
    "basic_cleaning",
    "sampling",
    "data_split",
    "imputation",
    "outliers",
    "transformation",
    "encoding",
    "scaling",
    "dimensionality_reduction",
    "feature_selection",
    "imbalance",
]


def normalize_pipeline_config(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept both the new structured payload and the older step-list payload."""
    raw = payload.get("pipeline_config") or {}
    if raw:
        return _with_defaults(raw)

    legacy = {
        "session_id": payload.get("session_id", "demo-session"),
        "target_column": payload.get("target_column") or "",
        "problem_type": payload.get("problem_type"),
        "excluded_columns": payload.get("excluded_columns", []) or [],
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

    for step in payload.get("pipeline", []) or []:
        action = step.get("action")
        if action == "drop_duplicates":
            legacy["basic_cleaning"]["drop_duplicates"] = True
        elif action == "drop_zero_variance":
            legacy["basic_cleaning"]["drop_zero_variance"] = True
            legacy["basic_cleaning"]["zero_variance_columns"] = step.get("columns", []) or []
        elif action == "cast_to_numeric":
            legacy["basic_cleaning"]["cast_to_numeric"] = step.get("columns", []) or []
        elif action == "sample":
            legacy["sampling"] = {"enabled": True, **step}
        elif action == "split":
            legacy["data_split"] = {"enabled": True, **step}
        elif action == "impute_missing":
            legacy["imputation"] = {"enabled": True, "strategies": step.get("strategies", {}) or {}}
        elif action == "handle_outliers":
            legacy["outliers"] = {"enabled": True, "strategies": step.get("strategies", {}) or {}}
        elif action == "apply_transformation":
            legacy["transformation"] = {"enabled": True, "strategies": step.get("strategies", {}) or {}}
        elif action == "encode_categoricals":
            legacy["encoding"] = {"enabled": True, "strategies": step.get("strategies", {}) or {}}
        elif action == "apply_scaling":
            legacy["scaling"] = {"enabled": True, "strategies": step.get("strategies", {}) or {}}
        elif action == "reduce_features":
            legacy["dimensionality_reduction"] = {
                "enabled": True,
                "actions": step.get("actions", {}) or {},
                "use_pca": bool(step.get("use_pca", False)),
                "pca_variance": step.get("pca_variance", 95),
            }
        elif action == "feature_selection":
            legacy["feature_selection"] = {
                "enabled": True,
                "method": step.get("method", "manual"),
                "top_k": step.get("top_k"),
                "selected_features": step.get("selected_features", []) or [],
            }
        elif action == "handle_imbalance":
            legacy["imbalance"] = {
                "enabled": True,
                "strategy": step.get("strategy", "none"),
            }

    return _with_defaults(legacy)


def apply_full_pipeline(
    df: pd.DataFrame,
    pipeline_config: dict[str, Any],
    *,
    stop_before: str | None = None,
) -> pd.DataFrame:
    """
    Apply the entire user-defined preprocessing recipe in one deterministic backend path.

    The dataframe returned here is the source of truth for preview tables, feature-importance
    previews, and the downloadable preprocessed CSV.
    """
    config = _with_defaults(pipeline_config)
    session_id = str(config.get("session_id") or "demo-session")
    state = session_service.get_or_create(session_id)
    target_column = _resolve_target_column(config, state)
    problem_type = _resolve_problem_type(config, state)

    df_working = df.copy()

    excluded_columns = [
        column
        for column in config.get("excluded_columns", []) or []
        if column in df_working.columns and column != target_column
    ]
    if excluded_columns:
        df_working = df_working.drop(columns=excluded_columns, errors="ignore")

    for stage in PIPELINE_STAGE_ORDER:
        if stop_before == stage:
            break

        if stage == "basic_cleaning":
            df_working = _apply_basic_cleaning(
                df_working,
                config.get("basic_cleaning", {}),
                target_column=target_column,
            )
        elif stage == "sampling":
            sampling_config = config.get("sampling", {})
            if sampling_config.get("enabled"):
                sampling_step = {**sampling_config}
                if target_column and "target" not in sampling_step:
                    sampling_step["target"] = target_column
                df_working = apply_sampling(df_working, sampling_step)
        elif stage == "data_split":
            split_config = config.get("data_split", {})
            if split_config.get("enabled"):
                split_step = {**split_config}
                if split_step.get("stratify") and target_column and "target" not in split_step:
                    split_step["target"] = target_column
                split_result = apply_data_split(df_working, split_step)
                df_working = split_result["train"].copy()
        elif stage == "imputation":
            df_working = _apply_imputation(
                df_working,
                config.get("imputation", {}),
                target_column=target_column,
            )
        elif stage == "outliers":
            df_working = _apply_outliers(
                df_working,
                config.get("outliers", {}),
                target_column=target_column,
            )
        elif stage == "transformation":
            df_working = _apply_transformations(
                df_working,
                config.get("transformation", {}),
                target_column=target_column,
            )
        elif stage == "encoding":
            df_working = _apply_encoding(
                df_working,
                config.get("encoding", {}),
                target_column=target_column,
            )
        elif stage == "scaling":
            df_working = _apply_scaling(
                df_working,
                config.get("scaling", {}),
                target_column=target_column,
            )
        elif stage == "dimensionality_reduction":
            df_working = _apply_dimensionality_reduction(
                df_working,
                config.get("dimensionality_reduction", {}),
                target_column=target_column,
            )
        elif stage == "feature_selection":
            df_working = _apply_feature_selection_stage(
                df_working,
                config.get("feature_selection", {}),
                target_column=target_column,
                problem_type=problem_type,
            )
        elif stage == "imbalance":
            df_working = _apply_imbalance(
                df_working,
                config.get("imbalance", {}),
                target_column=target_column,
            )

    return df_working.reset_index(drop=True)


def _with_defaults(config: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(config)
    normalized.setdefault("session_id", "demo-session")
    normalized.setdefault("target_column", "")
    normalized.setdefault("problem_type", None)
    normalized.setdefault("excluded_columns", [])
    normalized.setdefault("basic_cleaning", {})
    normalized.setdefault("sampling", {})
    normalized.setdefault("data_split", {})
    normalized.setdefault("imputation", {})
    normalized.setdefault("outliers", {})
    normalized.setdefault("transformation", {})
    normalized.setdefault("encoding", {})
    normalized.setdefault("scaling", {})
    normalized.setdefault("dimensionality_reduction", {})
    normalized.setdefault("feature_selection", {})
    normalized.setdefault("imbalance", {})
    return normalized


def _resolve_target_column(config: dict[str, Any], state: Any) -> str:
    return (
        str(config.get("target_column") or "")
        or str(state.mapping.get("target_column") or "")
        or str(state.dataset.get("target_column") or "")
    )


def _resolve_problem_type(config: dict[str, Any], state: Any) -> str:
    requested = str(config.get("problem_type") or "").lower()
    if requested in {"classification", "multiclass", "regression"}:
        return requested

    mapped = str(state.mapping.get("problem_type") or "").lower()
    if mapped == "regression":
        return "regression"
    if mapped == "multi_class_classification":
        return "multiclass"
    return "classification"


def _apply_basic_cleaning(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    df_working = df.copy()

    if config.get("drop_duplicates"):
        df_working = df_working.drop_duplicates()

    for column in config.get("cast_to_numeric", []) or []:
        if column in df_working.columns:
            df_working[column] = pd.to_numeric(df_working[column], errors="coerce")

    if config.get("drop_zero_variance"):
        columns = [
            column
            for column in (config.get("zero_variance_columns", []) or [])
            if column in df_working.columns and column != target_column
        ]
        if not columns:
            columns = [
                column
                for column in df_working.columns
                if column != target_column and df_working[column].nunique(dropna=False) <= 1
            ]
        if columns:
            df_working = df_working.drop(columns=columns, errors="ignore")

    return df_working


def _apply_imputation(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    strategies = dict(config.get("strategies", {}) or {})
    if not config.get("enabled") or not strategies:
        return df

    df_working = df.copy()

    for column, strategy in strategies.items():
        if strategy == "drop_column" and column in df_working.columns and column != target_column:
            df_working = df_working.drop(columns=[column], errors="ignore")

    for column, strategy in strategies.items():
        if strategy == "drop_rows" and column in df_working.columns:
            df_working = df_working.dropna(subset=[column])

    knn_columns = [
        column
        for column, strategy in strategies.items()
        if strategy == "knn" and column in df_working.columns and column != target_column
    ]

    for column, strategy in strategies.items():
        if column not in df_working.columns:
            continue

        series = df_working[column]
        numeric_series = pd.to_numeric(series, errors="coerce")
        is_numeric = pd.api.types.is_numeric_dtype(series) or numeric_series.notna().sum() > 0

        if strategy == "mean":
            if is_numeric and numeric_series.notna().any():
                df_working[column] = numeric_series.fillna(float(numeric_series.mean()))
        elif strategy == "median":
            if is_numeric and numeric_series.notna().any():
                df_working[column] = numeric_series.fillna(float(numeric_series.median()))
        elif strategy == "mode":
            mode = series.mode(dropna=True)
            if not mode.empty:
                df_working[column] = series.fillna(mode.iloc[0])
        elif strategy == "zero":
            df_working[column] = numeric_series.fillna(0) if is_numeric else series.fillna("0")

    if knn_columns:
        numeric_columns: list[str] = []
        for column in df_working.columns:
            if column == target_column:
                continue
            original = df_working[column]
            coerced = pd.to_numeric(original, errors="coerce")
            if pd.api.types.is_numeric_dtype(original) or coerced.notna().any():
                numeric_columns.append(column)
        numeric_columns = [column for column in numeric_columns if column in df_working.columns]
        if numeric_columns:
            numeric_frame = df_working[numeric_columns].apply(pd.to_numeric, errors="coerce")
            imputer = KNNImputer()
            transformed = pd.DataFrame(
                imputer.fit_transform(numeric_frame),
                columns=numeric_columns,
                index=df_working.index,
            )
            for column in knn_columns:
                if column in transformed.columns:
                    df_working[column] = transformed[column]

        for column in knn_columns:
            if column not in df_working.columns:
                continue
            original = df_working[column]
            coerced = pd.to_numeric(original, errors="coerce")
            if not pd.api.types.is_numeric_dtype(original) and not coerced.notna().any():
                mode = original.mode(dropna=True)
                if not mode.empty:
                    df_working[column] = original.fillna(mode.iloc[0])

    return df_working


def _apply_outliers(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    strategies = dict(config.get("strategies", {}) or {})
    if not config.get("enabled") or not strategies:
        return df

    df_working = df.copy()

    for column, strategy in strategies.items():
        if column not in df_working.columns or column == target_column or strategy == "ignore":
            continue

        series = pd.to_numeric(df_working[column], errors="coerce")
        if series.notna().sum() < 3:
            continue

        if strategy == "cap_1_99":
            lower = float(series.quantile(0.01))
            upper = float(series.quantile(0.99))
            df_working[column] = series.clip(lower=lower, upper=upper)
            continue

        if strategy == "cap_5_95":
            lower = float(series.quantile(0.05))
            upper = float(series.quantile(0.95))
            df_working[column] = series.clip(lower=lower, upper=upper)
            continue

        mask = _build_outlier_mask(series, strategy)
        if mask is not None and mask.any():
            df_working = df_working.loc[~mask].copy()

    return df_working


def _build_outlier_mask(series: pd.Series, strategy: str) -> pd.Series | None:
    mask = pd.Series(False, index=series.index)
    valid = series.dropna()
    if valid.empty:
        return mask

    if strategy in {"drop_rows", "iqr"}:
        q1 = float(valid.quantile(0.25))
        q3 = float(valid.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        mask.loc[valid.index] = (valid < lower) | (valid > upper)
        return mask

    if strategy == "zscore":
        std = float(valid.std())
        if std == 0:
            return mask
        z_scores = (valid - float(valid.mean())) / std
        mask.loc[valid.index] = z_scores.abs() >= 3
        return mask

    values = valid.to_numpy().reshape(-1, 1)

    if strategy == "isolation_forest":
        detector = IsolationForest(contamination=0.05, random_state=42)
        predictions = detector.fit_predict(values)
        mask.loc[valid.index] = predictions == -1
        return mask

    if strategy == "lof":
        n_neighbors = min(20, len(valid) - 1)
        if n_neighbors < 1:
            return mask
        detector = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=0.05)
        predictions = detector.fit_predict(values)
        mask.loc[valid.index] = predictions == -1
        return mask

    if strategy == "dbscan":
        eps = float(valid.std()) / 2.0 if float(valid.std()) > 0 else 0.5
        detector = DBSCAN(eps=eps, min_samples=5)
        predictions = detector.fit_predict(values)
        mask.loc[valid.index] = predictions == -1
        return mask

    return None


def _apply_transformations(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    strategies = dict(config.get("strategies", {}) or {})
    if not config.get("enabled") or not strategies:
        return df

    df_working = df.copy()
    for column, strategy in strategies.items():
        if column not in df_working.columns or column == target_column or strategy == "none":
            continue

        series = pd.to_numeric(df_working[column], errors="coerce")
        valid = series.dropna()
        if valid.empty:
            continue

        if strategy == "log":
            shift = 1 - float(valid.min()) if float(valid.min()) <= 0 else 0.0
            transformed = np.log1p(valid + shift)
        elif strategy in {"box_cox", "yeo_johnson"}:
            transformer = PowerTransformer(method="box-cox" if strategy == "box_cox" else "yeo-johnson")
            values = valid.to_numpy().reshape(-1, 1)
            if strategy == "box_cox" and float(valid.min()) <= 0:
                values = (valid + (1 - float(valid.min()))).to_numpy().reshape(-1, 1)
            transformed = pd.Series(
                transformer.fit_transform(values).ravel(),
                index=valid.index,
            )
        else:
            continue

        df_working.loc[valid.index, column] = transformed

    return df_working


def _apply_encoding(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    strategies = dict(config.get("strategies", {}) or {})
    if not config.get("enabled") or not strategies:
        return df

    df_working = df.copy()

    for column, strategy in list(strategies.items()):
        if column not in df_working.columns or column == target_column or strategy == "none":
            continue

        series = df_working[column].fillna("__MISSING__")

        if strategy == "label":
            encoded, _ = pd.factorize(series, sort=True)
            df_working[column] = encoded
        elif strategy == "onehot":
            encoded = pd.get_dummies(series, prefix=column, drop_first=True, dtype=int)
            df_working = pd.concat([df_working.drop(columns=[column]), encoded], axis=1)
        elif strategy == "target":
            if target_column not in df_working.columns:
                continue
            target = df_working[target_column]
            if pd.api.types.is_numeric_dtype(target):
                target_numeric = pd.to_numeric(target, errors="coerce")
            else:
                encoded_target, _ = pd.factorize(target.fillna("__TARGET_MISSING__"), sort=True)
                target_numeric = pd.Series(encoded_target, index=target.index, dtype=float)
            global_mean = float(target_numeric.mean()) if target_numeric.notna().any() else 0.0
            grouped = pd.DataFrame({"category": series, "target": target_numeric}).groupby("category")["target"]
            means = grouped.mean()
            counts = grouped.count()
            smoothing = 10.0
            mapping = ((counts * means) + (smoothing * global_mean)) / (counts + smoothing)
            df_working[column] = series.map(mapping).fillna(global_mean)

    return df_working


def _apply_scaling(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    strategies = dict(config.get("strategies", {}) or {})
    if not config.get("enabled") or not strategies:
        return df

    df_working = df.copy()
    for column, strategy in strategies.items():
        if column not in df_working.columns or column == target_column or strategy == "none":
            continue

        series = pd.to_numeric(df_working[column], errors="coerce")
        valid = series.dropna()
        if valid.empty:
            continue

        scaler = None
        if strategy == "standard":
            scaler = StandardScaler()
        elif strategy == "robust":
            scaler = RobustScaler()
        elif strategy == "minmax":
            scaler = MinMaxScaler()

        if scaler is None:
            continue

        transformed = scaler.fit_transform(valid.to_numpy().reshape(-1, 1)).ravel()
        df_working.loc[valid.index, column] = transformed

    return df_working


def _apply_dimensionality_reduction(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    if not config.get("enabled"):
        return df

    df_working = df.copy()

    if config.get("use_pca"):
        feature_columns = [
            column for column in df_working.columns if column != target_column and pd.api.types.is_numeric_dtype(df_working[column])
        ]
        if len(feature_columns) < 2:
            return df_working

        features = df_working[feature_columns].apply(pd.to_numeric, errors="coerce")
        features = features.fillna(features.median(numeric_only=True)).fillna(0)
        scaled = StandardScaler().fit_transform(features)
        variance_ratio = min(max(float(config.get("pca_variance", 95)) / 100.0, 0.8), 0.99)
        pca = PCA(n_components=variance_ratio, random_state=42)
        transformed = pca.fit_transform(scaled)
        columns = [f"pca_{index + 1}" for index in range(transformed.shape[1])]
        pca_frame = pd.DataFrame(transformed, columns=columns, index=df_working.index)
        non_feature_columns = [
            column for column in df_working.columns if column == target_column or column not in feature_columns
        ]
        return pd.concat([df_working[non_feature_columns], pca_frame], axis=1)

    to_drop = [
        column
        for column, action in dict(config.get("actions", {}) or {}).items()
        if action == "drop" and column in df_working.columns and column != target_column
    ]
    if to_drop:
        df_working = df_working.drop(columns=to_drop, errors="ignore")

    return df_working


def _apply_feature_selection_stage(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
    problem_type: str,
) -> pd.DataFrame:
    if not config.get("enabled"):
        return df
    if not target_column or target_column not in df.columns:
        raise PipelineError("Feature selection requires a valid target column.", status_code=400)

    top_k = config.get("top_k")
    if top_k is None:
        manual_features = config.get("selected_features", []) or []
        top_k = max(1, len(manual_features)) if manual_features else 10

    step = {
        "method": config.get("method", "manual"),
        "top_k": top_k,
        "selected_features": config.get("selected_features", []) or [],
    }
    selected = apply_feature_selection(df, step, target_column, problem_type)
    ordered_columns = [column for column in df.columns if column in selected.columns]
    return selected[ordered_columns]


def _apply_imbalance(
    df: pd.DataFrame,
    config: dict[str, Any],
    *,
    target_column: str,
) -> pd.DataFrame:
    strategy = str(config.get("strategy", "none")).lower()
    if not config.get("enabled") or strategy != "smote":
        return df
    if not target_column or target_column not in df.columns:
        raise PipelineError("SMOTE requires a valid target column.", status_code=400)

    class_counts = df[target_column].value_counts(dropna=False)
    if len(class_counts) < 2:
        return df

    feature_columns = [column for column in df.columns if column != target_column]
    if not feature_columns:
        return df

    numeric_columns = [column for column in feature_columns if pd.api.types.is_numeric_dtype(df[column])]
    categorical_columns = [column for column in feature_columns if column not in numeric_columns]
    prepared = _prepare_features_for_neighbors(df, feature_columns, numeric_columns, categorical_columns)

    synthetic_rows: list[dict[str, Any]] = []
    max_count = int(class_counts.max())
    seed_base = 42

    for index, (label, count) in enumerate(class_counts.items()):
        if int(count) >= max_count:
            continue

        class_df = df[df[target_column] == label]
        class_prepared = prepared.loc[class_df.index]
        rng = np.random.default_rng(seed_base + index)
        needed = max_count - int(count)

        if len(class_df) <= 2:
            sampled = class_df.sample(n=needed, replace=True, random_state=seed_base + index)
            synthetic_rows.extend(sampled.to_dict(orient="records"))
            continue

        n_neighbors = min(5, len(class_df) - 1)
        neighbors = NearestNeighbors(n_neighbors=n_neighbors + 1)
        neighbors.fit(class_prepared)
        neighbor_indices = neighbors.kneighbors(return_distance=False)

        for _ in range(needed):
            base_position = int(rng.integers(0, len(class_df)))
            candidate_neighbors = neighbor_indices[base_position][1:]
            neighbor_position = (
                int(rng.choice(candidate_neighbors))
                if len(candidate_neighbors) > 0
                else base_position
            )
            base_row = class_df.iloc[base_position]
            neighbor_row = class_df.iloc[neighbor_position]
            gap = float(rng.random())

            synthetic: dict[str, Any] = {}
            for column in numeric_columns:
                base_value = pd.to_numeric(base_row[column], errors="coerce")
                neighbor_value = pd.to_numeric(neighbor_row[column], errors="coerce")
                if pd.isna(base_value) and pd.isna(neighbor_value):
                    synthetic[column] = np.nan
                else:
                    if pd.isna(base_value):
                        base_value = neighbor_value
                    if pd.isna(neighbor_value):
                        neighbor_value = base_value
                    synthetic[column] = float(base_value) + gap * (float(neighbor_value) - float(base_value))

            for column in categorical_columns:
                synthetic[column] = base_row[column] if rng.random() < 0.5 else neighbor_row[column]

            synthetic[target_column] = label
            synthetic_rows.append(synthetic)

    if not synthetic_rows:
        return df.reset_index(drop=True)

    synthetic_frame = pd.DataFrame(synthetic_rows).reindex(columns=df.columns)
    return pd.concat([df, synthetic_frame], ignore_index=True)


def _prepare_features_for_neighbors(
    df: pd.DataFrame,
    feature_columns: list[str],
    numeric_columns: list[str],
    categorical_columns: list[str],
) -> pd.DataFrame:
    prepared = pd.DataFrame(index=df.index)

    for column in numeric_columns:
        numeric_series = pd.to_numeric(df[column], errors="coerce")
        fill_value = float(numeric_series.median()) if numeric_series.notna().any() else 0.0
        prepared[column] = numeric_series.fillna(fill_value)

    for column in categorical_columns:
        encoded, _ = pd.factorize(df[column].fillna("__MISSING__"), sort=True)
        prepared[column] = encoded.astype(float)

    missing_columns = [column for column in feature_columns if column not in prepared.columns]
    for column in missing_columns:
        prepared[column] = 0.0

    return prepared[feature_columns]
