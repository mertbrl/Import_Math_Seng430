from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest, RandomForestClassifier, RandomForestRegressor
from sklearn.feature_selection import SelectFromModel, SelectKBest, f_classif, f_regression, mutual_info_classif, mutual_info_regression
from sklearn.impute import KNNImputer
from sklearn.linear_model import Lasso, LogisticRegression
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import MinMaxScaler, PowerTransformer, RobustScaler, StandardScaler

from app.core.exceptions import PipelineError
from app.services.data_prep.pipeline_execution import _apply_imbalance
from app.services.data_prep.step02_sampling import apply_sampling
from app.services.data_prep.step09_dimensionality import drop_multicollinear_features_iteratively

ROW_ID_COLUMN = "__row_id__"
OUTLIER_DETECTORS = {"iqr", "zscore", "isolation_forest", "lof", "dbscan"}
OUTLIER_TREATMENTS = {"ignore", "drop_rows", "cap_1_99", "cap_5_95"}


class LeakageSafeTrainingPreprocessor:
    def prepare_source_dataframe(
        self,
        df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> pd.DataFrame:
        df_working = df.copy()
        if ROW_ID_COLUMN not in df_working.columns:
            df_working[ROW_ID_COLUMN] = np.arange(len(df_working))

        excluded_columns = [
            column
            for column in config.get("excluded_columns", []) or []
            if column in df_working.columns and column != target_column
        ]
        if excluded_columns:
            df_working = df_working.drop(columns=excluded_columns, errors="ignore")

        basic_config = dict(config.get("basic_cleaning", {}) or {})
        if basic_config.get("drop_duplicates"):
            df_working = df_working.drop_duplicates()

        for column in basic_config.get("cast_to_numeric", []) or []:
            if column in df_working.columns:
                df_working[column] = pd.to_numeric(df_working[column], errors="coerce")

        sampling_config = dict(config.get("sampling", {}) or {})
        if sampling_config.get("enabled"):
            sampling_step = {**sampling_config}
            if target_column and "target" not in sampling_step:
                sampling_step["target"] = target_column
            df_working = apply_sampling(df_working, sampling_step)

        return df_working.reset_index(drop=True)

    def fit_transform(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
        problem_type: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        train_working = train_df.copy()
        test_working = test_df.copy()

        train_working, test_working = self._apply_zero_variance(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_imputation(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_outliers(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_transformations(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_encoding(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_scaling(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_dimensionality_reduction(train_working, test_working, config, target_column)
        train_working, test_working = self._apply_feature_selection(train_working, test_working, config, target_column, problem_type)

        imbalance_config = dict(config.get("imbalance", {}) or {})
        if imbalance_config.get("enabled"):
            train_working = _apply_imbalance(train_working, imbalance_config, target_column=target_column)

        train_working = train_working.drop(columns=[ROW_ID_COLUMN], errors="ignore").reset_index(drop=True)
        test_working = test_working.drop(columns=[ROW_ID_COLUMN], errors="ignore").reset_index(drop=True)
        return train_working, test_working

    def _apply_zero_variance(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        basic_config = dict(config.get("basic_cleaning", {}) or {})
        if not basic_config.get("drop_zero_variance"):
            return train_df, test_df

        explicit = [
            column
            for column in basic_config.get("zero_variance_columns", []) or []
            if column in train_df.columns and column not in {target_column, ROW_ID_COLUMN}
        ]
        zero_variance_columns = explicit or [
            column
            for column in train_df.columns
            if column not in {target_column, ROW_ID_COLUMN} and train_df[column].nunique(dropna=False) <= 1
        ]
        if not zero_variance_columns:
            return train_df, test_df
        return (
            train_df.drop(columns=zero_variance_columns, errors="ignore"),
            test_df.drop(columns=zero_variance_columns, errors="ignore"),
        )

    def _apply_imputation(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        imputation_config = dict(config.get("imputation", {}) or {})
        strategies = dict(imputation_config.get("strategies", {}) or {})
        if not imputation_config.get("enabled") or not strategies:
            return train_df, test_df

        train_working = train_df.copy()
        test_working = test_df.copy()

        drop_columns = [
            column
            for column, strategy in strategies.items()
            if strategy == "drop_column" and column in train_working.columns and column not in {target_column, ROW_ID_COLUMN}
        ]
        if drop_columns:
            train_working = train_working.drop(columns=drop_columns, errors="ignore")
            test_working = test_working.drop(columns=drop_columns, errors="ignore")

        drop_rows_columns = [column for column, strategy in strategies.items() if strategy == "drop_rows"]
        for column in drop_rows_columns:
            if column in train_working.columns:
                train_working = train_working.dropna(subset=[column]).copy()
            if column in test_working.columns:
                test_working = test_working.dropna(subset=[column]).copy()

        for column, strategy in strategies.items():
            if strategy in {"drop_column", "drop_rows", "knn"}:
                continue
            if column not in train_working.columns:
                continue

            train_series = train_working[column]
            test_series = test_working[column] if column in test_working.columns else pd.Series(index=test_working.index, dtype=object)
            train_numeric = pd.to_numeric(train_series, errors="coerce")
            test_numeric = pd.to_numeric(test_series, errors="coerce")
            is_numeric = pd.api.types.is_numeric_dtype(train_series) or train_numeric.notna().any()

            if strategy == "mean" and train_numeric.notna().any():
                fill_value = float(train_numeric.mean())
                train_working[column] = train_numeric.fillna(fill_value)
                if column in test_working.columns:
                    test_working[column] = test_numeric.fillna(fill_value)
            elif strategy == "median" and train_numeric.notna().any():
                fill_value = float(train_numeric.median())
                train_working[column] = train_numeric.fillna(fill_value)
                if column in test_working.columns:
                    test_working[column] = test_numeric.fillna(fill_value)
            elif strategy == "mode":
                mode = train_series.mode(dropna=True)
                if not mode.empty:
                    fill_value = mode.iloc[0]
                    train_working[column] = train_series.fillna(fill_value)
                    if column in test_working.columns:
                        test_working[column] = test_series.fillna(fill_value)
            elif strategy == "zero":
                if is_numeric:
                    train_working[column] = train_numeric.fillna(0.0)
                    if column in test_working.columns:
                        test_working[column] = test_numeric.fillna(0.0)
                else:
                    train_working[column] = train_series.fillna("0")
                    if column in test_working.columns:
                        test_working[column] = test_series.fillna("0")

        knn_columns = [
            column
            for column, strategy in strategies.items()
            if strategy == "knn" and column in train_working.columns and column not in {target_column, ROW_ID_COLUMN}
        ]
        if knn_columns:
            numeric_columns: list[str] = []
            for column in train_working.columns:
                if column in {target_column, ROW_ID_COLUMN}:
                    continue
                train_numeric = pd.to_numeric(train_working[column], errors="coerce")
                if (pd.api.types.is_numeric_dtype(train_working[column]) or train_numeric.notna().any()) and train_numeric.notna().any():
                    numeric_columns.append(column)

            if numeric_columns:
                train_numeric_frame = train_working[numeric_columns].apply(pd.to_numeric, errors="coerce")
                test_numeric_frame = test_working[numeric_columns].apply(pd.to_numeric, errors="coerce")
                imputer = KNNImputer()
                transformed_train = pd.DataFrame(
                    imputer.fit_transform(train_numeric_frame),
                    columns=numeric_columns,
                    index=train_working.index,
                )
                transformed_test = pd.DataFrame(
                    imputer.transform(test_numeric_frame),
                    columns=numeric_columns,
                    index=test_working.index,
                )
                for column in knn_columns:
                    if column in transformed_train.columns:
                        train_working[column] = transformed_train[column]
                        if column in transformed_test.columns:
                            test_working[column] = transformed_test[column]

            for column in knn_columns:
                if column not in train_working.columns:
                    continue
                train_series = train_working[column]
                train_numeric = pd.to_numeric(train_series, errors="coerce")
                if train_numeric.notna().any():
                    continue
                mode = train_series.mode(dropna=True)
                if not mode.empty:
                    fill_value = mode.iloc[0]
                    train_working[column] = train_series.fillna(fill_value)
                    if column in test_working.columns:
                        test_working[column] = test_working[column].fillna(fill_value)

        return train_working, test_working

    def _apply_outliers(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        outlier_config = dict(config.get("outliers", {}) or {})
        strategies = dict(outlier_config.get("strategies", {}) or {})
        if not outlier_config.get("enabled") or not strategies:
            return train_df, test_df

        train_working = train_df.copy()
        test_working = test_df.copy()

        for column, raw_strategy in strategies.items():
            if column not in train_working.columns or column in {target_column, ROW_ID_COLUMN}:
                continue

            rule = self._normalize_outlier_rule(raw_strategy)
            if rule is None or rule["treatment"] == "ignore":
                continue

            train_series = pd.to_numeric(train_working[column], errors="coerce")
            test_series = pd.to_numeric(test_working[column], errors="coerce") if column in test_working.columns else pd.Series(index=test_working.index, dtype=float)
            if train_series.notna().sum() < 3:
                continue

            if rule.get("apply_to_all"):
                lower, upper = self._cap_bounds(train_series.dropna(), str(rule["treatment"]))
                train_working[column] = train_series.clip(lower=lower, upper=upper)
                if column in test_working.columns:
                    test_working[column] = test_series.clip(lower=lower, upper=upper)
                continue

            train_mask, test_mask = self._detect_outlier_masks(train_series, test_series, str(rule["detector"]))
            treatment = str(rule["treatment"])

            if treatment == "drop_rows":
                train_working = train_working.loc[~train_mask].copy()
                test_working = test_working.loc[~test_mask].copy()
                continue

            lower, upper = self._cap_bounds(train_series.dropna(), treatment)
            capped_train = train_series.copy()
            capped_train.loc[train_mask] = capped_train.loc[train_mask].clip(lower=lower, upper=upper)
            train_working[column] = capped_train

            if column in test_working.columns:
                capped_test = test_series.copy()
                capped_test.loc[test_mask] = capped_test.loc[test_mask].clip(lower=lower, upper=upper)
                test_working[column] = capped_test

        return train_working, test_working

    def _apply_transformations(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        transformation_config = dict(config.get("transformation", {}) or {})
        strategies = dict(transformation_config.get("strategies", {}) or {})
        if not transformation_config.get("enabled") or not strategies:
            return train_df, test_df

        train_working = train_df.copy()
        test_working = test_df.copy()

        for column, strategy in strategies.items():
            if column not in train_working.columns or column in {target_column, ROW_ID_COLUMN} or strategy == "none":
                continue

            train_series = pd.to_numeric(train_working[column], errors="coerce")
            test_series = pd.to_numeric(test_working[column], errors="coerce") if column in test_working.columns else pd.Series(index=test_working.index, dtype=float)
            train_valid = train_series.dropna()
            if train_valid.empty:
                continue

            try:
                if strategy == "log":
                    shift = 1 - float(train_valid.min()) if float(train_valid.min()) <= 0 else 0.0
                    transformed_train = np.log1p((train_valid + shift).clip(lower=0.0))
                    transformed_test = np.log1p((test_series.dropna() + shift).clip(lower=0.0))
                elif strategy == "box_cox":
                    shift = 1 - float(train_valid.min()) if float(train_valid.min()) <= 0 else 0.0
                    transformer = PowerTransformer(method="box-cox")
                    fitted_train = (train_valid + shift).clip(lower=1e-9)
                    transformer.fit(fitted_train.to_numpy().reshape(-1, 1))
                    transformed_train = pd.Series(
                        transformer.transform(fitted_train.to_numpy().reshape(-1, 1)).ravel(),
                        index=train_valid.index,
                    )
                    test_valid = (test_series.dropna() + shift).clip(lower=1e-9)
                    transformed_test = pd.Series(
                        transformer.transform(test_valid.to_numpy().reshape(-1, 1)).ravel(),
                        index=test_valid.index,
                    )
                elif strategy == "yeo_johnson":
                    transformer = PowerTransformer(method="yeo-johnson")
                    transformer.fit(train_valid.to_numpy().reshape(-1, 1))
                    transformed_train = pd.Series(
                        transformer.transform(train_valid.to_numpy().reshape(-1, 1)).ravel(),
                        index=train_valid.index,
                    )
                    test_valid = test_series.dropna()
                    transformed_test = pd.Series(
                        transformer.transform(test_valid.to_numpy().reshape(-1, 1)).ravel(),
                        index=test_valid.index,
                    )
                else:
                    continue
            except ValueError:
                continue

            train_working.loc[transformed_train.index, column] = transformed_train
            if column in test_working.columns:
                test_working.loc[transformed_test.index, column] = transformed_test

        return train_working, test_working

    def _apply_encoding(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        encoding_config = dict(config.get("encoding", {}) or {})
        strategies = dict(encoding_config.get("strategies", {}) or {})
        if not encoding_config.get("enabled") or not strategies:
            return train_df, test_df

        train_working = train_df.copy()
        test_working = test_df.copy()

        for column, strategy in list(strategies.items()):
            if column not in train_working.columns or column in {target_column, ROW_ID_COLUMN} or strategy == "none":
                continue

            train_series = train_working[column].fillna("__MISSING__").astype(str)
            test_series = (
                test_working[column].fillna("__MISSING__").astype(str)
                if column in test_working.columns
                else pd.Series(index=test_working.index, dtype=str)
            )

            if strategy == "label":
                categories = sorted(train_series.unique().tolist())
                mapping = {value: index for index, value in enumerate(categories)}
                train_working[column] = train_series.map(mapping).fillna(-1).astype(float)
                if column in test_working.columns:
                    test_working[column] = test_series.map(mapping).fillna(-1).astype(float)
            elif strategy == "onehot":
                categories = train_series.unique().tolist()
                train_categorical = pd.Categorical(train_series, categories=categories)
                test_categorical = pd.Categorical(test_series, categories=categories)
                train_encoded = pd.get_dummies(train_categorical, prefix=column, drop_first=True, dtype=float)
                test_encoded = pd.get_dummies(test_categorical, prefix=column, drop_first=True, dtype=float)
                train_working = pd.concat([train_working.drop(columns=[column]), train_encoded], axis=1)
                if column in test_working.columns:
                    test_working = pd.concat([test_working.drop(columns=[column]), test_encoded], axis=1)
            elif strategy == "target":
                if target_column not in train_working.columns:
                    continue
                target_numeric = self._target_as_numeric(train_working[target_column])
                global_mean = float(target_numeric.mean()) if target_numeric.notna().any() else 0.0
                grouped = pd.DataFrame({"category": train_series, "target": target_numeric}).groupby("category")["target"]
                means = grouped.mean()
                counts = grouped.count()
                smoothing = 10.0
                mapping = ((counts * means) + (smoothing * global_mean)) / (counts + smoothing)
                train_working[column] = train_series.map(mapping).fillna(global_mean)
                if column in test_working.columns:
                    test_working[column] = test_series.map(mapping).fillna(global_mean)

        return train_working, test_working

    def _apply_scaling(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        scaling_config = dict(config.get("scaling", {}) or {})
        strategies = dict(scaling_config.get("strategies", {}) or {})
        if not scaling_config.get("enabled") or not strategies:
            return train_df, test_df

        train_working = train_df.copy()
        test_working = test_df.copy()

        for column, strategy in strategies.items():
            if column not in train_working.columns or column in {target_column, ROW_ID_COLUMN} or strategy == "none":
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

            train_series = pd.to_numeric(train_working[column], errors="coerce")
            test_series = pd.to_numeric(test_working[column], errors="coerce") if column in test_working.columns else pd.Series(index=test_working.index, dtype=float)
            train_valid = train_series.dropna()
            if train_valid.empty:
                continue

            scaler.fit(train_valid.to_numpy().reshape(-1, 1))
            transformed_train = pd.Series(
                scaler.transform(train_valid.to_numpy().reshape(-1, 1)).ravel(),
                index=train_valid.index,
            )
            train_working.loc[transformed_train.index, column] = transformed_train

            if column in test_working.columns:
                test_valid = test_series.dropna()
                if not test_valid.empty:
                    transformed_test = pd.Series(
                        scaler.transform(test_valid.to_numpy().reshape(-1, 1)).ravel(),
                        index=test_valid.index,
                    )
                    test_working.loc[transformed_test.index, column] = transformed_test

        return train_working, test_working

    def _apply_dimensionality_reduction(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        reduction_config = dict(config.get("dimensionality_reduction", {}) or {})
        if not reduction_config.get("enabled"):
            return train_df, test_df

        train_working = train_df.copy()
        test_working = test_df.copy()

        if reduction_config.get("use_pca"):
            feature_columns = [
                column
                for column in train_working.columns
                if column not in {target_column, ROW_ID_COLUMN} and pd.api.types.is_numeric_dtype(train_working[column])
            ]
            if len(feature_columns) < 2 or len(train_working) < 2:
                return train_working, test_working

            train_features = train_working[feature_columns].apply(pd.to_numeric, errors="coerce")
            fill_values = train_features.median(numeric_only=True).fillna(0.0)
            train_features = train_features.fillna(fill_values).fillna(0.0)

            test_features = test_working[feature_columns].apply(pd.to_numeric, errors="coerce")
            test_features = test_features.fillna(fill_values).fillna(0.0)

            scaler = StandardScaler()
            train_scaled = scaler.fit_transform(train_features)
            test_scaled = scaler.transform(test_features)

            variance_ratio = min(max(float(reduction_config.get("pca_variance", 95)) / 100.0, 0.8), 0.99)
            pca = PCA(n_components=variance_ratio, random_state=42)
            train_transformed = pca.fit_transform(train_scaled)
            test_transformed = pca.transform(test_scaled)

            component_columns = [f"pca_{index + 1}" for index in range(train_transformed.shape[1])]
            train_components = pd.DataFrame(train_transformed, columns=component_columns, index=train_working.index)
            test_components = pd.DataFrame(test_transformed, columns=component_columns, index=test_working.index)

            preserved_columns = [
                column
                for column in train_working.columns
                if column in {target_column, ROW_ID_COLUMN} or column not in feature_columns
            ]
            train_working = pd.concat([train_working[preserved_columns], train_components], axis=1)
            test_working = pd.concat([test_working[preserved_columns], test_components], axis=1)
            return train_working, test_working

        actions = dict(reduction_config.get("actions", {}) or {})
        explicit_drop = [
            column
            for column, action in actions.items()
            if action == "drop" and column in train_working.columns and column not in {target_column, ROW_ID_COLUMN}
        ]
        if explicit_drop:
            train_working = train_working.drop(columns=explicit_drop, errors="ignore")
            test_working = test_working.drop(columns=explicit_drop, errors="ignore")

        feature_columns = [
            column
            for column in train_working.columns
            if column not in {target_column, ROW_ID_COLUMN} and pd.api.types.is_numeric_dtype(train_working[column])
        ]
        if len(feature_columns) < 2:
            return train_working, test_working

        protected_features = [
            column
            for column, action in actions.items()
            if action == "keep" and column in feature_columns
        ]
        if not explicit_drop:
            train_numeric = train_working[feature_columns].apply(pd.to_numeric, errors="coerce")
            fill_values = train_numeric.median(numeric_only=True).fillna(0.0)
            train_numeric = train_numeric.fillna(fill_values).fillna(0.0)
            _, derived_drop = drop_multicollinear_features_iteratively(
                train_numeric,
                threshold=10.0,
                protected_features=protected_features,
            )
            if derived_drop:
                train_working = train_working.drop(columns=derived_drop, errors="ignore")
                test_working = test_working.drop(columns=derived_drop, errors="ignore")

        return train_working, test_working

    def _apply_feature_selection(
        self,
        train_df: pd.DataFrame,
        test_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
        problem_type: str,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        selection_config = dict(config.get("feature_selection", {}) or {})
        if not selection_config.get("enabled"):
            return train_df, test_df
        if target_column not in train_df.columns:
            raise PipelineError("Feature selection requires a valid target column.", status_code=400)

        selected_features = self._select_feature_names(train_df, selection_config, target_column, problem_type)
        if not selected_features:
            return train_df, test_df

        retained_columns = [
            column
            for column in train_df.columns
            if column in {target_column, ROW_ID_COLUMN}
            or column in selected_features
            or not pd.api.types.is_numeric_dtype(train_df[column])
        ]
        retained_columns = [column for column in retained_columns if column in train_df.columns]
        matching_test_columns = [column for column in retained_columns if column in test_df.columns]
        return train_df[retained_columns].copy(), test_df[matching_test_columns].copy()

    def _select_feature_names(
        self,
        train_df: pd.DataFrame,
        config: dict[str, Any],
        target_column: str,
        problem_type: str,
    ) -> list[str]:
        method = str(config.get("method", "manual"))
        if method == "manual":
            requested_features = config.get("selected_features", []) or []
            return [
                column
                for column in requested_features
                if column in train_df.columns and column not in {target_column, ROW_ID_COLUMN}
            ]

        numeric_df = train_df.select_dtypes(include=np.number)
        X = numeric_df.drop(columns=[column for column in [target_column, ROW_ID_COLUMN] if column in numeric_df.columns], errors="ignore")
        if X.empty:
            return []

        fill_values = X.median(numeric_only=True).fillna(0.0)
        X = X.fillna(fill_values).fillna(0.0)

        top_k = config.get("top_k")
        if top_k is None:
            top_k = 10
        top_k = max(1, min(int(top_k), len(X.columns)))
        y = train_df[target_column]
        y_numeric = self._target_as_numeric(y)

        try:
            if method == "anova":
                selector = SelectKBest(score_func=f_regression if problem_type == "regression" else f_classif, k=top_k)
                selector.fit(X, y_numeric if problem_type == "regression" else y)
                return X.columns[selector.get_support()].tolist()

            if method == "mutual_info":
                selector = SelectKBest(
                    score_func=mutual_info_regression if problem_type == "regression" else mutual_info_classif,
                    k=top_k,
                )
                selector.fit(X, y_numeric if problem_type == "regression" else y)
                return X.columns[selector.get_support()].tolist()

            if method == "random_forest":
                model = (
                    RandomForestRegressor(n_estimators=50, random_state=42)
                    if problem_type == "regression"
                    else RandomForestClassifier(n_estimators=50, random_state=42)
                )
                model.fit(X, y_numeric if problem_type == "regression" else y)
                importances = np.asarray(model.feature_importances_, dtype=float)
                indices = np.argsort(importances)[-top_k:]
                return X.columns[indices].tolist()

            if method == "lasso":
                if problem_type == "regression":
                    selector = SelectFromModel(Lasso(alpha=0.1, random_state=42), max_features=top_k)
                    selector.fit(X, y_numeric)
                else:
                    class_count = int(y.nunique(dropna=True))
                    model = (
                        LogisticRegression(penalty="l1", solver="saga", multi_class="multinomial", random_state=42, max_iter=1000)
                        if class_count > 2
                        else LogisticRegression(penalty="l1", solver="liblinear", random_state=42, max_iter=1000)
                    )
                    selector = SelectFromModel(model, max_features=top_k)
                    selector.fit(X, y)
                selected = X.columns[selector.get_support()].tolist()
                return selected or X.columns[:top_k].tolist()
        except Exception:
            return X.columns[:top_k].tolist()

        return []

    def _normalize_outlier_rule(self, raw: Any) -> dict[str, Any] | None:
        if isinstance(raw, dict):
            detector = str(raw.get("detector") or "").strip().lower()
            treatment = str(raw.get("treatment") or "").strip().lower()
            if detector not in OUTLIER_DETECTORS or treatment not in OUTLIER_TREATMENTS:
                return None
            return {"detector": detector, "treatment": treatment, "apply_to_all": False}

        if not isinstance(raw, str):
            return None

        normalized = raw.strip().lower()
        if normalized == "ignore":
            return {"detector": "iqr", "treatment": "ignore", "apply_to_all": False}
        if normalized in {"cap_1_99", "cap_5_95"}:
            return {"detector": "iqr", "treatment": normalized, "apply_to_all": True}
        if normalized == "drop_rows":
            return {"detector": "iqr", "treatment": "drop_rows", "apply_to_all": False}
        if normalized in OUTLIER_DETECTORS:
            return {"detector": normalized, "treatment": "drop_rows", "apply_to_all": False}
        return None

    def _cap_bounds(self, series: pd.Series, treatment: str) -> tuple[float, float]:
        if treatment == "cap_1_99":
            return float(series.quantile(0.01)), float(series.quantile(0.99))
        if treatment == "cap_5_95":
            return float(series.quantile(0.05)), float(series.quantile(0.95))
        minimum = float(series.min()) if not series.empty else 0.0
        maximum = float(series.max()) if not series.empty else 0.0
        return minimum, maximum

    def _detect_outlier_masks(
        self,
        train_series: pd.Series,
        test_series: pd.Series,
        detector: str,
    ) -> tuple[pd.Series, pd.Series]:
        train_mask = pd.Series(False, index=train_series.index)
        test_mask = pd.Series(False, index=test_series.index)
        valid_train = train_series.dropna()
        valid_test = test_series.dropna()
        if valid_train.empty:
            return train_mask, test_mask

        if detector == "iqr":
            q1 = float(valid_train.quantile(0.25))
            q3 = float(valid_train.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            train_mask.loc[valid_train.index] = (valid_train < lower) | (valid_train > upper)
            if not valid_test.empty:
                test_mask.loc[valid_test.index] = (valid_test < lower) | (valid_test > upper)
            return train_mask, test_mask

        if detector == "zscore":
            std = float(valid_train.std())
            if std == 0:
                return train_mask, test_mask
            mean = float(valid_train.mean())
            train_mask.loc[valid_train.index] = ((valid_train - mean) / std).abs() >= 3
            if not valid_test.empty:
                test_mask.loc[valid_test.index] = ((valid_test - mean) / std).abs() >= 3
            return train_mask, test_mask

        train_values = valid_train.to_numpy().reshape(-1, 1)

        if detector == "isolation_forest":
            model = IsolationForest(contamination=0.05, random_state=42)
            train_predictions = model.fit_predict(train_values)
            train_mask.loc[valid_train.index] = train_predictions == -1
            if not valid_test.empty:
                test_predictions = model.predict(valid_test.to_numpy().reshape(-1, 1))
                test_mask.loc[valid_test.index] = test_predictions == -1
            return train_mask, test_mask

        if detector == "lof":
            n_neighbors = min(20, len(valid_train) - 1)
            if n_neighbors < 1:
                return train_mask, test_mask
            model = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=0.05, novelty=True)
            model.fit(train_values)
            train_predictions = model.predict(train_values)
            train_mask.loc[valid_train.index] = train_predictions == -1
            if not valid_test.empty:
                test_predictions = model.predict(valid_test.to_numpy().reshape(-1, 1))
                test_mask.loc[valid_test.index] = test_predictions == -1
            return train_mask, test_mask

        if detector == "dbscan":
            if len(valid_train) < 5:
                return train_mask, test_mask
            eps = float(valid_train.std()) / 2.0 if float(valid_train.std()) > 0 else 0.5
            model = DBSCAN(eps=eps, min_samples=5)
            train_predictions = model.fit_predict(train_values)
            train_mask.loc[valid_train.index] = train_predictions == -1

            if not valid_test.empty and hasattr(model, "components_") and len(model.components_) > 0:
                core_samples = model.components_.reshape(-1)
                test_values = valid_test.to_numpy().reshape(-1)
                distances = np.abs(test_values[:, None] - core_samples[None, :])
                is_neighbor = (distances <= eps).any(axis=1)
                test_mask.loc[valid_test.index] = ~is_neighbor
            return train_mask, test_mask

        return train_mask, test_mask

    def _target_as_numeric(self, series: pd.Series) -> pd.Series:
        if pd.api.types.is_numeric_dtype(series):
            return pd.to_numeric(series, errors="coerce")
        encoded, _ = pd.factorize(series.fillna("__TARGET_MISSING__"), sort=True)
        return pd.Series(encoded, index=series.index, dtype=float)
