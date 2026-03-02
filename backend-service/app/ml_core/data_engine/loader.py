from app.core.exceptions import PipelineError


class DataLoader:
    def validate_filename(self, filename: str) -> None:
        if not filename.endswith(".csv"):
            raise PipelineError("Only CSV files are supported.")

    def summary(self) -> dict[str, object]:
        return {"rows": 304, "columns": 12}
