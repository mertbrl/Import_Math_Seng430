from app.schemas.request import PreprocessRequest


class PreprocessingService:
    def apply(self, payload: PreprocessRequest) -> dict[str, object]:
        train_rows = round(304 * (payload.train_split / 100))
        test_rows = 304 - train_rows
        return {
            "train_split": payload.train_split,
            "train_rows": train_rows,
            "test_rows": test_rows,
            "missing_strategy": payload.missing_strategy,
            "normalization": payload.normalization,
            "imbalance_strategy": payload.imbalance_strategy,
        }
