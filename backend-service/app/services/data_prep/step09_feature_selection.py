from typing import Any

import numpy as np
import pandas as pd

RANKING_RANDOM_STATE = 42
RANKING_ESTIMATORS = 50


def _prepare_numeric_feature_frame(
    df: pd.DataFrame,
    target_column: str,
    problem_type: str,
) -> tuple[pd.DataFrame, pd.Series]:
    if target_column not in df.columns:
        return pd.DataFrame(index=df.index), pd.Series(dtype=float)

    numeric_df = df.select_dtypes(include=[np.number])
    X = numeric_df.drop(columns=[target_column], errors="ignore")
    if X.empty:
        return X, pd.Series(dtype=float)

    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.dropna(axis=1, how="all")
    if X.empty:
        return X, pd.Series(dtype=float)

    medians = X.median(numeric_only=True).fillna(0.0)
    X = X.fillna(medians).fillna(0.0).astype(np.float32, copy=False)

    y = df[target_column].copy()
    if problem_type == "regression":
        y = pd.to_numeric(y, errors="coerce")
        valid_mask = y.notna()
        X = X.loc[valid_mask]
        y = y.loc[valid_mask].astype(np.float32, copy=False)
    else:
        encoded, _ = pd.factorize(y.fillna("__TARGET_MISSING__"), sort=True)
        y = pd.Series(encoded, index=y.index, dtype=np.int32)

    aligned_index = X.index.intersection(y.index)
    return X.loc[aligned_index], y.loc[aligned_index]


def calculate_feature_importances(df: pd.DataFrame, target_column: str, problem_type: str) -> list[dict[str, Any]]:
    """
    Rank numeric features for the Step 9 UI.

    This path is intentionally lighter than the full training stack so large
    datasets like radiology stay responsive while still producing real scores.
    """
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

    X, y = _prepare_numeric_feature_frame(df, target_column, problem_type)
    if X.empty or y.empty:
        return []

    try:
        if problem_type == "regression":
            model = RandomForestRegressor(
                n_estimators=RANKING_ESTIMATORS,
                random_state=RANKING_RANDOM_STATE,
                n_jobs=-1,
            )
        else:
            model = RandomForestClassifier(
                n_estimators=RANKING_ESTIMATORS,
                random_state=RANKING_RANDOM_STATE,
                n_jobs=-1,
            )

        model.fit(X, y)
        feature_scores = [
            {"feature": feature, "score": float(score)}
            for feature, score in zip(X.columns, model.feature_importances_)
        ]
        feature_scores.sort(key=lambda item: item["score"], reverse=True)
        return feature_scores
    except Exception:
        return []


def apply_feature_selection(df: pd.DataFrame, step: dict[str, Any], target_column: str, problem_type: str) -> pd.DataFrame:
    """
    Applies feature selection iteratively based on the selected method.
    The method is fit ONLY on the currently available training data.
    In the preview endpoint, `df` is already just the training slice.
    """
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.feature_selection import SelectFromModel
    from sklearn.feature_selection import SelectKBest, f_classif, f_regression, mutual_info_classif, mutual_info_regression
    from sklearn.linear_model import Lasso, LogisticRegression

    method = step.get("method", "anova")
    top_k = step.get("top_k", 10)

    if target_column not in df.columns:
        return df

    numeric_df = df.select_dtypes(include=[np.number])
    X = numeric_df.drop(columns=[target_column], errors="ignore")
    y = df[target_column]

    if X.empty:
        return df

    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.dropna(axis=1, how="all")
    if X.empty:
        return df

    X = X.fillna(X.median(numeric_only=True)).fillna(0.0)
    top_k = min(top_k, len(X.columns))
    selected_features: list[str] = []

    try:
        if method == "manual":
            manual_features = step.get("selected_features", [])
            selected_features = [feature for feature in manual_features if feature in X.columns]

        elif method == "anova":
            selector = SelectKBest(
                score_func=f_regression if problem_type == "regression" else f_classif,
                k=top_k,
            )
            selector.fit(X, y)
            selected_features = X.columns[selector.get_support()].tolist()

        elif method == "mutual_info":
            selector = SelectKBest(
                score_func=mutual_info_regression if problem_type == "regression" else mutual_info_classif,
                k=top_k,
            )
            selector.fit(X, y)
            selected_features = X.columns[selector.get_support()].tolist()

        elif method == "random_forest":
            if problem_type == "regression":
                model = RandomForestRegressor(
                    n_estimators=RANKING_ESTIMATORS,
                    random_state=RANKING_RANDOM_STATE,
                    n_jobs=-1,
                )
            else:
                model = RandomForestClassifier(
                    n_estimators=RANKING_ESTIMATORS,
                    random_state=RANKING_RANDOM_STATE,
                    n_jobs=-1,
                )
            model.fit(X, y)
            importances = model.feature_importances_
            ranked_columns = X.columns[np.argsort(importances)[-top_k:]]
            selected_features = ranked_columns.tolist()

        elif method == "lasso":
            if problem_type == "regression":
                model = Lasso(alpha=0.1, random_state=RANKING_RANDOM_STATE)
                selector = SelectFromModel(model, max_features=top_k, prefit=False)
            else:
                num_classes = len(np.unique(pd.Series(y).dropna()))
                if num_classes > 2:
                    model = LogisticRegression(
                        penalty="l1",
                        solver="saga",
                        multi_class="multinomial",
                        random_state=RANKING_RANDOM_STATE,
                    )
                else:
                    model = LogisticRegression(
                        penalty="l1",
                        solver="liblinear",
                        random_state=RANKING_RANDOM_STATE,
                    )
                selector = SelectFromModel(model, max_features=top_k, prefit=False)

            selector.fit(X, y)
            selected_features = X.columns[selector.get_support()].tolist()
            if len(selected_features) == 0:
                selected_features = X.columns[:top_k].tolist()
        else:
            return df

    except Exception:
        return df

    non_numeric_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    final_cols = list(set(selected_features).union(set(non_numeric_cols)))
    if target_column not in final_cols and target_column in df.columns:
        final_cols.append(target_column)

    return df[final_cols]
