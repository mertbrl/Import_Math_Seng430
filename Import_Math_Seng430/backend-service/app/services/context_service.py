from app.schemas.request import ContextRequest


class ContextService:
    def set_context(self, payload: ContextRequest) -> dict[str, str]:
        return {
            "domain": payload.domain,
            "use_case": payload.use_case,
            "step_name": "Clinical Context",
        }
