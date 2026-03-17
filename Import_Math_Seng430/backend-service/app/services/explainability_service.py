from app.schemas.request import ExplainabilityRequest


class ExplainabilityService:
    def explain(self, payload: ExplainabilityRequest) -> dict[str, object]:
        return {
            "global_importance": [
                {"feature": "ejection_fraction", "score": 0.28},
                {"feature": "serum_creatinine", "score": 0.22},
                {"feature": "age", "score": 0.17},
            ],
            "local_explanation": [
                {"feature": "ejection_fraction", "impact": 0.24},
                {"feature": "age", "impact": 0.16},
                {"feature": "creatinine", "impact": 0.12},
                {"feature": "smoker", "impact": -0.05},
            ],
            "patient_id": payload.patient_id,
        }
