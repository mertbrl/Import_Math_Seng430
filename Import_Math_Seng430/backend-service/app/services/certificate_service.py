from app.schemas.request import CertificateRequest


class CertificateService:
    def build(self, payload: CertificateRequest) -> dict[str, object]:
        checklist = [
            {"item": "Model explainability available", "done": True},
            {"item": "Training data documented", "done": True},
            {"item": "Bias audit completed", "done": False},
            {"item": "Human oversight plan approved", "done": False},
        ]
        summary = (
            f"{payload.participant} completed the 7-step ML workflow at "
            f"{payload.organization}. Bias remediation is still required."
        )
        return {
            "participant": payload.participant,
            "summary": summary,
            "checklist": checklist,
        }
