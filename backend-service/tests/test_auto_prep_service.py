from app.services.data_prep.auto_prep_service import run_auto_prep
from app.services.session_service import session_service


def test_run_auto_prep_maps_current_step_outputs_into_pipeline_actions(monkeypatch) -> None:
    session_service._sessions.clear()
    state = session_service.get_or_create("auto-prep-session")
    state.dataset = {"target_column": "target"}
    state.mapping = {"target_column": "target", "problem_type": "classification"}

    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.calculate_basic_cleaning_stats",
        lambda session_id, excluded: {
            "duplicates_count": 2,
            "zero_variance_columns": ["constant_feature"],
        },
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.calculate_type_mismatch_stats",
        lambda session_id, excluded: {
            "mismatched_columns": [{"column": "lab_value"}],
        },
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.calculate_missing_statistics",
        lambda session_id, excluded: [
            {"column": "age", "missing_count": 3, "type": "Numeric"},
            {"column": "sex", "missing_count": 2, "type": "Categorical"},
        ],
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.calculate_outlier_statistics",
        lambda session_id, excluded: [
            {
                "column": "creatinine",
                "outlier_count": 4,
                "recommended_detector": "Isolation Forest",
                "recommended_treatment": "cap_5_95",
            }
        ],
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.analyze_transformation_candidates",
        lambda session_id, excluded: {
            "columns": [
                {"column": "bilirubin", "needs_transform": True, "recommendation": "box_cox"},
                {"column": "heart_rate", "needs_transform": False, "recommendation": None},
            ]
        },
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.analyze_encoding_candidates",
        lambda session_id, excluded, target: {
            "columns": [{"column": "ward", "recommendation": "onehot"}]
        },
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.analyze_scaling_candidates",
        lambda session_id, excluded: {
            "columns": [{"column": "age", "recommendation": "robust"}]
        },
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.load_dataframe",
        lambda session_id: object(),
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.apply_full_pipeline",
        lambda df, config, stop_before=None: object(),
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.calculate_feature_importances",
        lambda df, target, problem_type: [
            {"feature": "age", "score": 0.9},
            {"feature": "creatinine", "score": 0.8},
            {"feature": "bilirubin", "score": 0.7},
            {"feature": "ward_ICU", "score": 0.6},
            {"feature": "sex", "score": 0.5},
            {"feature": "platelets", "score": 0.4},
        ],
    )
    monkeypatch.setattr(
        "app.services.data_prep.auto_prep_service.analyze_class_balance",
        lambda session_id, target, excluded: {"recommendation_tag": "moderate"},
    )

    actions = run_auto_prep("auto-prep-session", imbalance_enabled=True)
    action_map = {action["action"]: action for action in actions}

    assert action_map["impute_missing"]["strategies"] == {"age": "median", "sex": "mode"}
    assert action_map["handle_outliers"]["strategies"] == {
        "creatinine": {
            "detector": "isolation_forest",
            "treatment": "cap_5_95",
        }
    }
    assert action_map["apply_transformation"]["strategies"] == {"bilirubin": "box_cox"}
    assert action_map["encode_categoricals"]["strategies"] == {"ward": "onehot"}
    assert action_map["apply_scaling"]["strategies"] == {"age": "robust"}
    assert action_map["feature_selection"]["selected_features"] == [
        "age",
        "creatinine",
        "bilirubin",
        "ward_ICU",
        "sex",
        "platelets",
    ]
    assert action_map["handle_imbalance"]["strategy"] == "smote"
