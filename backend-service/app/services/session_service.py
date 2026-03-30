from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.core.exceptions import PipelineError


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class SessionState:
    session_id: str
    context: dict[str, Any] = field(default_factory=dict)
    dataset: dict[str, Any] = field(default_factory=dict)
    dataset_version: int = 0
    mapping: dict[str, Any] = field(default_factory=dict)
    mapping_validated: bool = False
    preprocessing_config: dict[str, Any] = field(default_factory=dict)
    preprocessing_result: dict[str, Any] = field(default_factory=dict)
    training_config: dict[str, Any] = field(default_factory=dict)
    training_split_cache: dict[str, Any] = field(default_factory=dict)
    training_runs: dict[str, dict[str, Any]] = field(default_factory=dict)
    active_run_id: str | None = None
    evaluations: dict[str, dict[str, Any]] = field(default_factory=dict)
    explainability: dict[str, dict[str, Any]] = field(default_factory=dict)
    fairness: dict[str, dict[str, Any]] = field(default_factory=dict)
    certificate: dict[str, Any] = field(default_factory=dict)
    pipeline_revision: int = 0
    created_at: str = field(default_factory=_utc_now)
    updated_at: str = field(default_factory=_utc_now)

    # Legacy compatibility fields consumed by older endpoints.
    data_profile: dict[str, Any] = field(default_factory=dict)
    preprocessing: dict[str, Any] = field(default_factory=dict)
    training: dict[str, Any] = field(default_factory=dict)
    evaluation: dict[str, Any] = field(default_factory=dict)


class SessionService:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def create(self, session_id: str | None = None, *, context: dict[str, Any] | None = None) -> SessionState:
        resolved_id = session_id or f"session-{uuid4().hex[:8]}"
        if resolved_id in self._sessions:
            raise PipelineError(f"Session '{resolved_id}' already exists.", status_code=409)
        state = SessionState(
            session_id=resolved_id,
            context=context or {
                "domain": "Cardiology",
                "use_case": "Predict 30-day readmission risk.",
            },
        )
        self._sessions[resolved_id] = state
        return state

    def list_sessions(self) -> list[dict[str, Any]]:
        return [
            {
                "session_id": state.session_id,
                "domain": state.context.get("domain"),
                "dataset_version": state.dataset_version,
                "pipeline_revision": state.pipeline_revision,
                "updated_at": state.updated_at,
            }
            for state in self._sessions.values()
        ]

    def get(self, session_id: str) -> SessionState:
        state = self._sessions.get(session_id)
        if not state:
            raise PipelineError(f"Session '{session_id}' not found.", status_code=404)
        return state

    def get_or_create(self, session_id: str) -> SessionState:
        if session_id not in self._sessions:
            self.create(
                session_id=session_id,
                context={
                    "domain": "Cardiology",
                    "use_case": "Predict 30-day readmission risk.",
                },
            )
        return self._sessions[session_id]

    def delete(self, session_id: str) -> None:
        self.get(session_id)
        del self._sessions[session_id]

    def touch(self, state: SessionState, *, bump_revision: bool = True) -> SessionState:
        if bump_revision:
            state.pipeline_revision += 1
        state.updated_at = _utc_now()
        return state

    def invalidate_from_dataset(self, state: SessionState) -> None:
        state.mapping = {}
        state.mapping_validated = False
        state.preprocessing_config = {}
        state.preprocessing_result = {}
        state.training_config = {}
        state.training_split_cache = {}
        state.training_runs = {}
        state.active_run_id = None
        state.evaluations = {}
        state.explainability = {}
        state.fairness = {}
        state.certificate = {}
        state.data_profile = {}
        state.preprocessing = {}
        state.training = {}
        state.evaluation = {}

    def invalidate_from_mapping(self, state: SessionState) -> None:
        state.preprocessing_config = {}
        state.preprocessing_result = {}
        state.training_config = {}
        state.training_split_cache = {}
        state.training_runs = {}
        state.active_run_id = None
        state.evaluations = {}
        state.explainability = {}
        state.fairness = {}
        state.certificate = {}
        state.preprocessing = {}
        state.training = {}
        state.evaluation = {}

    def invalidate_from_preprocessing(self, state: SessionState) -> None:
        state.training_config = {}
        state.training_runs = {}
        state.active_run_id = None
        state.evaluations = {}
        state.explainability = {}
        state.fairness = {}
        state.certificate = {}
        state.training = {}
        state.evaluation = {}

    def invalidate_from_training(self, state: SessionState) -> None:
        state.evaluations = {}
        state.explainability = {}
        state.fairness = {}
        state.certificate = {}
        state.evaluation = {}

    def snapshot(self, session_id: str) -> dict[str, Any]:
        return asdict(self.get(session_id))


session_service = SessionService()
