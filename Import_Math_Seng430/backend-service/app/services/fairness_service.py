from app.schemas.request import FairnessRequest


class FairnessService:
    def check(self, _: FairnessRequest) -> dict[str, object]:
        subgroups = [
            {"group": "male", "accuracy": 0.81, "sensitivity": 0.67, "specificity": 0.88},
            {"group": "female", "accuracy": 0.73, "sensitivity": 0.41, "specificity": 0.83},
            {"group": "age_18_60", "accuracy": 0.80, "sensitivity": 0.65, "specificity": 0.87},
            {"group": "age_61_75", "accuracy": 0.77, "sensitivity": 0.58, "specificity": 0.84},
            {"group": "age_76_plus", "accuracy": 0.71, "sensitivity": 0.39, "specificity": 0.80},
        ]
        warnings = [
            "Sensitivity gap between male and female groups exceeds 10 percentage points.",
            "Model requires bias mitigation before deployment.",
        ]
        return {"subgroup_metrics": subgroups, "warnings": warnings}
