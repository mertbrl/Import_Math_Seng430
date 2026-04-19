import math
from typing import Any

from app.core.exceptions import PipelineError
from app.services.session_service import session_service
from app.services.data_prep._dataframe_loader import load_dataframe
from app.services.data_prep.step01_basic_cleaning import calculate_basic_cleaning_stats
from app.services.data_prep.step01b_type_casting import calculate_type_mismatch_stats
from app.services.data_prep.step04_imputation import calculate_missing_statistics
from app.services.data_prep.step05_outliers import calculate_outlier_statistics
from app.services.data_prep.step06_transformation import analyze_transformation_candidates
from app.services.data_prep.step07_encoding import analyze_encoding_candidates
from app.services.data_prep.step08_scaling import analyze_scaling_candidates
from app.services.data_prep.step09_feature_selection import calculate_feature_importances
from app.services.data_prep.step10_imbalance import analyze_class_balance
from app.services.data_prep.pipeline_execution import apply_full_pipeline

AUTO_PREP_THREE_WAY_SPLIT_MIN_ROWS = 1000


def _choose_auto_prep_split(total_rows: int) -> dict[str, Any]:
    if total_rows >= AUTO_PREP_THREE_WAY_SPLIT_MIN_ROWS:
        return {
            "strategy": "3-way",
            "train": 0.7,
            "val": 0.15,
            "test": 0.15,
        }
    return {
        "strategy": "2-way",
        "train": 0.8,
        "val": 0,
        "test": 0.2,
    }


def _map_actions_to_pipeline_config(session_id: str, actions: list[dict[str, Any]], target_column: str) -> dict[str, Any]:
    """Helper to convert frontend-style action list to the pipeline execution config dictionary."""
    config = {
        "session_id": session_id,
        "target_column": target_column,
        "problem_type": "classification",
        "excluded_columns": [target_column] if target_column else [],
        "imputation": {"enabled": False, "strategies": {}},
        "outliers": {"enabled": False, "strategies": {}},
        "transformation": {"enabled": False, "strategies": {}},
        "encoding": {"enabled": False, "strategies": {}},
        "scaling": {"enabled": False, "strategies": {}},
        "dimensionality_reduction": {"enabled": False, "actions": {}, "use_pca": False},
        "feature_selection": {"enabled": False, "method": "manual", "selected_features": []},
        "imbalance": {"enabled": False, "strategy": "none"}
    }
    
    for act in actions:
        if act["action"] == "impute_missing":
            config["imputation"]["enabled"] = True
            config["imputation"]["strategies"] = act.get("strategies", {})
        elif act["action"] == "handle_outliers":
            config["outliers"]["enabled"] = True
            config["outliers"]["strategies"] = act.get("strategies", {})
        elif act["action"] == "apply_transformation":
            config["transformation"]["enabled"] = True
            config["transformation"]["strategies"] = act.get("strategies", {})
        elif act["action"] == "encode_categoricals":
            config["encoding"]["enabled"] = True
            config["encoding"]["strategies"] = act.get("strategies", {})
        elif act["action"] == "apply_scaling":
            config["scaling"]["enabled"] = True
            config["scaling"]["strategies"] = act.get("strategies", {})
            
    return config

def run_auto_prep(session_id: str, imbalance_enabled: bool) -> list[dict[str, Any]]:
    state = session_service.get_or_create(session_id)
    target_column = state.mapping.get("target_column") or state.dataset.get("target_column")
    df = load_dataframe(session_id)
    split_plan = _choose_auto_prep_split(len(df))
    
    excluded_columns = []
    if target_column:
        excluded_columns.append(target_column)

    actions = []

    # Step 1: Basic Cleaning
    bc_stats = calculate_basic_cleaning_stats(session_id, excluded_columns)
    if bc_stats.get("duplicates_count", 0) > 0:
        actions.append({"step": "data_cleaning", "action": "drop_duplicates", "count": bc_stats["duplicates_count"]})
    if bc_stats.get("zero_variance_columns"):
        actions.append({"step": "data_cleaning", "action": "drop_zero_variance", "columns": bc_stats["zero_variance_columns"]})

    tc_stats = calculate_type_mismatch_stats(session_id, excluded_columns)
    mismatched = [col["column"] for col in tc_stats.get("mismatched_columns", [])]
    if mismatched:
        actions.append({"step": "data_cleaning", "action": "cast_to_numeric", "columns": mismatched})

    # Always add mandatory data split for pipeline
    actions.append({
        "step": "data_split",
        "action": "split",
        "train": split_plan["train"],
        "test": split_plan["test"],
        "val": split_plan["val"],
        "strategy": split_plan["strategy"],
        "stratify": True,
        "target": target_column,
    })

    # Step 4: Imputation
    missing_stats = calculate_missing_statistics(session_id, excluded_columns)
    missing_strategies = {}
    for col_stat in missing_stats:
        if int(col_stat.get("missing_count", 0)) > 0:
            column = col_stat.get("column")
            if column:
                column_type = str(col_stat.get("type", "")).lower()
                missing_strategies[str(column)] = "mode" if column_type == "categorical" else "median"
    if missing_strategies:
         actions.append({"step": "imputation", "action": "impute_missing", "strategies": missing_strategies})

    # Step 5: Outliers
    outlier_stats = calculate_outlier_statistics(session_id, excluded_columns)
    outlier_strategies = {}
    for col_stat in outlier_stats:
        if int(col_stat.get("outlier_count", 0)) > 0:
            column = col_stat.get("column")
            if not column:
                continue
            detector = str(col_stat.get("recommended_detector", "iqr")).strip().lower().replace("-", "_").replace(" ", "_")
            if detector == "isolation":
                detector = "isolation_forest"
            outlier_strategies[str(column)] = {
                "detector": detector or "iqr",
                "treatment": col_stat.get("recommended_treatment", "cap_1_99")
            }
    if outlier_strategies:
         actions.append({"step": "outliers", "action": "handle_outliers", "strategies": outlier_strategies})

    # Step 6: Transformation
    trans_stats = analyze_transformation_candidates(session_id, excluded_columns)
    transformation_strategies = {
        str(col_stat["column"]): str(col_stat["recommendation"])
        for col_stat in trans_stats.get("columns", [])
        if col_stat.get("needs_transform") and col_stat.get("recommendation")
    }
    if transformation_strategies:
         actions.append({"step": "transformation", "action": "apply_transformation", "strategies": transformation_strategies})

    # Step 7: Encoding
    encoding_stats = analyze_encoding_candidates(session_id, excluded_columns, target_column)
    encoding_strategies = {
        str(col_stat["column"]): str(col_stat["recommendation"])
        for col_stat in encoding_stats.get("columns", [])
        if col_stat.get("column") and col_stat.get("recommendation")
    }
    if encoding_strategies:
         actions.append({"step": "encoding", "action": "encode_categoricals", "strategies": encoding_strategies})

    # Step 8: Scaling
    scaling_stats = analyze_scaling_candidates(session_id, excluded_columns)
    scaling_strategies = {
        str(col_stat["column"]): str(col_stat["recommendation"])
        for col_stat in scaling_stats.get("columns", [])
        if col_stat.get("column") and col_stat.get("recommendation")
    }
    if scaling_strategies:
         actions.append({"step": "scaling", "action": "apply_scaling", "strategies": scaling_strategies})

    # Step 9: Feature Selection
    # Build a temporary pipeline to execute data up to the selection step
    problem_type = state.mapping.get("problem_type", "classification")
    if problem_type in ["binary_classification", "multi_class_classification"]:
        problem_type = "classification"

    temp_config = _map_actions_to_pipeline_config(session_id, actions, target_column)
    df_for_ranking = apply_full_pipeline(df, temp_config, stop_before="feature_selection")

    importances = calculate_feature_importances(df_for_ranking, target_column, problem_type)
    
    if importances:
        num_features = len(importances)
        # Logic: keep top K, max 10. But NEVER go below min(5, num_features).
        # This resolves the user's request.
        target_k = min(10, max(5, num_features))

        selected = importances[:target_k]
        selected_features = [f["feature"] for f in selected]
        
        if len(selected_features) < num_features:
            actions.append({
                "step": "feature_selection", 
                "action": "feature_selection", 
                "method": "manual", 
                "selected_features": selected_features,
            })

    # Step 10: Imbalance
    if imbalance_enabled:
        imbalance_stats = analyze_class_balance(session_id, target_column, excluded_columns)
        tag = imbalance_stats.get("recommendation_tag", "balanced")
        if tag in ["severe", "moderate"]:
             actions.append({"step": "imbalance_handling", "action": "handle_imbalance", "strategy": "smote"})
             
    return actions
