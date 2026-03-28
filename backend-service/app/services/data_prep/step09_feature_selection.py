from typing import Any
import pandas as pd
import numpy as np

def calculate_feature_importances(df: pd.DataFrame, target_column: str, problem_type: str) -> list[dict[str, Any]]:
    """
    Fits a Random Forest model on the numeric features to calculate feature importances.
    Returns a sorted list (descending) of feature importance objects: [{"feature": "x", "score": 0.85}]
    """
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    
    if target_column not in df.columns:
        return []
        
    numeric_df = df.select_dtypes(include=[np.number])
    if target_column in numeric_df.columns:
        X = numeric_df.drop(columns=[target_column])
    else:
        X = numeric_df
        
    y = df[target_column]
    
    if X.empty:
        return []
        
    try:
        if problem_type == "regression":
            model = RandomForestRegressor(n_estimators=50, random_state=42)
        else:
            model = RandomForestClassifier(n_estimators=50, random_state=42)
            
        model.fit(X, y)
        importances = model.feature_importances_
        
        # Create list of dicts
        feature_scores = []
        for feat, score in zip(X.columns, importances):
            feature_scores.append({"feature": feat, "score": float(score)})
            
        # Sort descending
        feature_scores.sort(key=lambda x: x["score"], reverse=True)
        return feature_scores
        
    except Exception:
        return []

def apply_feature_selection(df: pd.DataFrame, step: dict[str, Any], target_column: str, problem_type: str) -> pd.DataFrame:
    """
    Applies feature selection iteratively based on the selected method.
    The method is fit ONLY on the currently available training data.
    In the preview endpoint, `df` is already just the training slice.
    """
    from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif, f_regression, mutual_info_regression
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.linear_model import LogisticRegression, Lasso
    from sklearn.feature_selection import SelectFromModel

    method = step.get("method", "anova")
    top_k = step.get("top_k", 10)

    # Separate X and y
    if target_column not in df.columns:
        return df

    # We can only perform feature selection on numeric columns for now,
    # assuming categorical columns have already been encoded if necessary, or we just select from numerics
    numeric_df = df.select_dtypes(include=[np.number])
    if target_column in numeric_df.columns:
        X = numeric_df.drop(columns=[target_column])
    else:
        # target might be categorical, X still numeric
        X = numeric_df
    
    y = df[target_column]
    
    if X.empty:
        return df
        
    top_k = min(top_k, len(X.columns))

    selected_features = []

    try:
        if method == "manual":
            # Explicitly requested features from the UI checkboxes
            manual_features = step.get("selected_features", [])
            # Filter to only features that actually exist in X
            selected_features = [f for f in manual_features if f in X.columns]
        
        elif method == "anova":
            if problem_type == "regression":
                selector = SelectKBest(score_func=f_regression, k=top_k)
            else:
                selector = SelectKBest(score_func=f_classif, k=top_k)
            selector.fit(X, y)
            selected_features = X.columns[selector.get_support()].tolist()

        elif method == "mutual_info":
            if problem_type == "regression":
                selector = SelectKBest(score_func=mutual_info_regression, k=top_k)
            else:
                selector = SelectKBest(score_func=mutual_info_classif, k=top_k)
            selector.fit(X, y)
            selected_features = X.columns[selector.get_support()].tolist()

        elif method == "random_forest":
            if problem_type == "regression":
                model = RandomForestRegressor(n_estimators=50, random_state=42)
            else:
                model = RandomForestClassifier(n_estimators=50, random_state=42)
            model.fit(X, y)
            
            # Select top k features based on importance
            importances = model.feature_importances_
            indices = np.argsort(importances)[-top_k:]
            selected_features = X.columns[indices].tolist()

        elif method == "lasso":
            if problem_type == "regression":
                model = Lasso(alpha=0.1, random_state=42)
                selector = SelectFromModel(model, max_features=top_k, prefit=False)
            else:
                num_classes = len(np.unique(y.dropna()))
                if num_classes > 2:
                    model = LogisticRegression(penalty="l1", solver="saga", multi_class="multinomial", random_state=42)
                else:
                    model = LogisticRegression(penalty="l1", solver="liblinear", random_state=42)
                selector = SelectFromModel(model, max_features=top_k, prefit=False)
            
            selector.fit(X, y)
            selected_features = X.columns[selector.get_support()].tolist()
            # If Lasso dropped too many, pad with remaining
            if len(selected_features) == 0:
                selected_features = X.columns[:top_k].tolist()
        else:
            return df
            
    except Exception:
        # Fallback if something fails (e.g., NaNs in X)
        return df

    # Return df retaining the selected features, non-numeric columns, and target
    non_numeric_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    final_cols = list(set(selected_features).union(set(non_numeric_cols)))
    if target_column not in final_cols and target_column in df.columns:
        final_cols.append(target_column)

    return df[final_cols]
