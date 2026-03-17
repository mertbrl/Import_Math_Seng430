from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class PipelineError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(PipelineError)
    async def handle_pipeline_error(_: Request, exc: PipelineError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message},
        )
