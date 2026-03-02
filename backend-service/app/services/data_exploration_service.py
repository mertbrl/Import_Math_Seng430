from app.schemas.request import DataExplorationRequest


class DataExplorationService:
    def profile(self, payload: DataExplorationRequest) -> dict[str, object]:
        return {
            "source": payload.source,
            "target_column": payload.target_column,
            "rows": 304,
            "columns": 12,
            "missing_ratio": 0.068,
            "class_balance": {"negative": 0.67, "positive": 0.33},
        }
