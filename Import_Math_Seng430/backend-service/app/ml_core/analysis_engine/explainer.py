def feature_importance() -> list[dict[str, float | str]]:
    return [
        {"feature": "ejection_fraction", "importance": 0.28},
        {"feature": "serum_creatinine", "importance": 0.22},
        {"feature": "age", "importance": 0.17},
    ]
