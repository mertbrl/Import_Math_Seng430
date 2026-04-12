from app.core.exceptions import PipelineError
from app.schemas.request import (
    CertificateCreateRequest,
    CertificateRequest,
    ContextRequest,
    DatasetPatchRequest,
    DatasetUpsertRequest,
    DataExplorationRequest,
    EvaluationRequest,
    ExplainabilityRequest,
    ExplainabilityLocalRequest,
    FairnessRequest,
    MappingUpsertRequest,
    PreprocessRequest,
    PreprocessingConfigRequest,
    SessionCreateRequest,
    SessionPatchRequest,
    TrainRequest,
    TrainingConfigRequest,
)
from app.services.certificate_service import CertificateService
from app.services.context_service import ContextService
from app.services.data_exploration_service import DataExplorationService
from app.services.evaluation_service import EvaluationService
from app.services.explainability_service import explainability_service
from app.services.fairness_service import FairnessService
from app.services.preprocessing_service import PreprocessingService
from app.services.session_service import session_service
from app.services.training_service import TrainingService


class PipelineService:
    def __init__(self) -> None:
        self.context_service = ContextService()
        self.data_exploration_service = DataExplorationService()
        self.preprocessing_service = PreprocessingService()
        self.training_service = TrainingService()
        self.evaluation_service = EvaluationService()
        self.explainability_service = explainability_service
        self.fairness_service = FairnessService()
        self.certificate_service = CertificateService()

    # Session CRUD
    def create_session(self, payload: SessionCreateRequest) -> dict[str, object]:
        state = session_service.create(
            session_id=payload.session_id,
            context={"domain": payload.domain, "use_case": payload.use_case},
        )
        return session_service.snapshot(state.session_id)

    def list_sessions(self) -> list[dict[str, object]]:
        return session_service.list_sessions()

    def get_session(self, session_id: str) -> dict[str, object]:
        return session_service.snapshot(session_id)

    def patch_session(self, session_id: str, payload: SessionPatchRequest) -> dict[str, object]:
        state = session_service.get(session_id)
        if payload.domain is not None:
            state.context["domain"] = payload.domain
        if payload.use_case is not None:
            state.context["use_case"] = payload.use_case
        session_service.touch(state)
        return session_service.snapshot(session_id)

    def delete_session(self, session_id: str) -> dict[str, str]:
        explainability_service.clear_session(session_id)
        session_service.delete(session_id)
        return {"status": "deleted", "session_id": session_id}

    # Dataset lifecycle
    def create_dataset(self, session_id: str, payload: DatasetUpsertRequest) -> dict[str, object]:
        state = session_service.get(session_id)
        session_service.invalidate_from_dataset(state)
        state.dataset_version += 1
        profile = {}
        profile["rows"] = payload.row_count
        profile["columns"] = payload.column_count
        state.dataset = {
            "source": payload.source,
            "target_column": payload.target_column,
            "file_name": payload.file_name,
            "row_count": payload.row_count,
            "column_count": payload.column_count,
        }
        state.data_profile = profile
        session_service.touch(state)
        return {
            "session_id": session_id,
            "dataset_version": state.dataset_version,
            "dataset": state.dataset,
            "profile": state.data_profile,
        }

    def get_dataset(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.dataset:
            raise PipelineError("Dataset not found for this session.", status_code=404)
        return {
            "session_id": session_id,
            "dataset_version": state.dataset_version,
            "dataset": state.dataset,
            "profile": state.data_profile,
        }

    def patch_dataset(self, session_id: str, payload: DatasetPatchRequest) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.dataset:
            raise PipelineError("Dataset not found for this session.", status_code=404)
        merged = {
            "source": payload.source if payload.source is not None else state.dataset.get("source"),
            "target_column": payload.target_column if payload.target_column is not None else state.dataset.get("target_column"),
            "file_name": payload.file_name if payload.file_name is not None else state.dataset.get("file_name"),
            "row_count": payload.row_count if payload.row_count is not None else state.dataset.get("row_count", 304),
            "column_count": payload.column_count if payload.column_count is not None else state.dataset.get("column_count", 12),
        }
        return self.create_dataset(session_id, DatasetUpsertRequest(**merged))

    def delete_dataset(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.dataset:
            raise PipelineError("Dataset not found for this session.", status_code=404)
        session_service.invalidate_from_dataset(state)
        state.dataset = {}
        state.dataset_version += 1
        session_service.touch(state)
        return {
            "status": "deleted",
            "session_id": session_id,
            "dataset_version": state.dataset_version,
        }

    # Mapping lifecycle
    def put_mapping(self, session_id: str, payload: MappingUpsertRequest) -> dict[str, object]:
        state = session_service.get(session_id)
        self._require_data(session_id)
        session_service.invalidate_from_mapping(state)
        state.mapping = {
            "problem_type": payload.problem_type,
            "target_column": payload.target_column,
            "roles": payload.roles,
        }
        state.mapping_validated = False
        session_service.touch(state)
        return {
            "session_id": session_id,
            "dataset_version": state.dataset_version,
            "mapping_validated": state.mapping_validated,
            "mapping": state.mapping,
        }

    def get_mapping(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.mapping:
            raise PipelineError("Mapping not found for this session.", status_code=404)
        return {
            "session_id": session_id,
            "dataset_version": state.dataset_version,
            "mapping_validated": state.mapping_validated,
            "mapping": state.mapping,
        }

    def validate_mapping(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.mapping:
            raise PipelineError("Mapping not found for this session.", status_code=404)
        target_column = state.mapping.get("target_column")
        if not target_column:
            raise PipelineError("Mapping target_column is required.")
        state.mapping_validated = True
        session_service.touch(state)
        return {
            "session_id": session_id,
            "mapping_validated": state.mapping_validated,
            "message": "Mapping validated and step 3 is unlocked.",
        }

    def delete_mapping(self, session_id: str) -> dict[str, str]:
        state = session_service.get(session_id)
        if not state.mapping:
            raise PipelineError("Mapping not found for this session.", status_code=404)
        session_service.invalidate_from_mapping(state)
        state.mapping = {}
        state.mapping_validated = False
        session_service.touch(state)
        return {"status": "deleted", "session_id": session_id}

    # Preprocessing lifecycle
    def put_preprocessing_config(self, session_id: str, payload: PreprocessingConfigRequest) -> dict[str, object]:
        state = session_service.get(session_id)
        self._require_valid_mapping(session_id)
        session_service.invalidate_from_preprocessing(state)
        state.preprocessing_config = payload.model_dump()
        session_service.touch(state)
        return {"session_id": session_id, "preprocessing_config": state.preprocessing_config}

    def run_preprocessing(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        config = state.preprocessing_config
        if not config:
            raise PipelineError("Preprocessing config is not set. Use PUT first.")
        request = PreprocessRequest(session_id=session_id, **config)
        recipe = self.preprocessing_service.apply(request)
        state.preprocessing_result = recipe
        state.preprocessing = recipe
        session_service.touch(state)
        return {"session_id": session_id, "dataset_version": state.dataset_version, "recipe": recipe}

    def get_preprocessing_result(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.preprocessing_result:
            raise PipelineError("Preprocessing result not found for this session.", status_code=404)
        return {"session_id": session_id, "dataset_version": state.dataset_version, "recipe": state.preprocessing_result}

    def delete_preprocessing_result(self, session_id: str) -> dict[str, str]:
        state = session_service.get(session_id)
        if not state.preprocessing_result:
            raise PipelineError("Preprocessing result not found for this session.", status_code=404)
        session_service.invalidate_from_preprocessing(state)
        state.preprocessing_result = {}
        state.preprocessing = {}
        session_service.touch(state)
        return {"status": "deleted", "session_id": session_id}

    # Training lifecycle
    def put_training_config(self, session_id: str, payload: TrainingConfigRequest) -> dict[str, object]:
        state = session_service.get(session_id)
        self._require_preprocessing(session_id)
        state.training_config = payload.model_dump()
        state.training_runs = {}
        state.active_run_id = None
        state.training = {}
        session_service.invalidate_from_training(state)
        session_service.touch(state)
        return {"session_id": session_id, "training_config": state.training_config}

    def run_training(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        config = state.training_config
        if not config:
            raise PipelineError("Training config is not set. Use PUT first.")
        request = TrainRequest(session_id=session_id, algorithm=config["algorithm"], parameters=config["parameters"])
        result = self.training_service.train(request)
        artifacts = result.pop("_artifacts", None)
        run_id = f"run-{len(state.training_runs) + 1}"
        run = {
            "run_id": run_id,
            "model_id": f"{result['model_id']}-{run_id}",
            "model": result["model"],
            "parameters": result["parameters"],
            "dataset_version": state.dataset_version,
            "pipeline_revision": state.pipeline_revision,
        }
        state.training_runs[run_id] = run
        state.active_run_id = run_id
        state.training = run
        session_service.touch(state)

        if artifacts:
            final_metrics = result.get("test_metrics") or result["metrics"]
            visualization = result.get("test_visualization") or result.get("visualization") or {}
            try:
                explainability_service.register_training_artifacts(
                    session_id=session_id,
                    run_id=run_id,
                    model_id=run["model_id"],
                    algorithm=result["model"],
                    estimator=artifacts["estimator"],
                    data=artifacts["data"],
                    search_summary=result.get("search"),
                    train_metrics=result.get("train_metrics"),
                    final_metrics=final_metrics,
                    generalization=visualization.get("generalization"),
                    feature_importance=result.get("feature_importance"),
                    feature_importance_source=result.get("feature_importance_source"),
                )
            except Exception:
                pass
        return {"session_id": session_id, "run": run}

    def list_training_runs(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        return {
            "session_id": session_id,
            "active_run_id": state.active_run_id,
            "runs": list(state.training_runs.values()),
        }

    def get_training_run(self, session_id: str, run_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        run = state.training_runs.get(run_id)
        if not run:
            raise PipelineError(f"Run '{run_id}' not found.", status_code=404)
        return {"session_id": session_id, "run": run}

    def delete_training_run(self, session_id: str, run_id: str) -> dict[str, str]:
        state = session_service.get(session_id)
        if run_id not in state.training_runs:
            raise PipelineError(f"Run '{run_id}' not found.", status_code=404)
        del state.training_runs[run_id]
        explainability_service.clear_run(session_id, run_id)
        state.evaluations.pop(run_id, None)
        state.explainability.pop(run_id, None)
        state.fairness.pop(run_id, None)
        state.certificate = {}
        if state.active_run_id == run_id:
            state.active_run_id = next(iter(state.training_runs), None)
        if state.active_run_id:
            state.training = state.training_runs[state.active_run_id]
        else:
            state.training = {}
            state.evaluation = {}
        session_service.touch(state)
        return {"status": "deleted", "session_id": session_id}

    # Analysis lifecycle
    def get_evaluation(self, session_id: str, run_id: str) -> dict[str, object]:
        state, resolved_run_id, run = self._resolve_run(session_id, run_id)
        if run["dataset_version"] != state.dataset_version:
            raise PipelineError("Run is stale for current dataset version. Retrain is required.")
        cached = state.evaluations.get(resolved_run_id)
        if cached:
            return cached
        result = self.evaluation_service.evaluate(EvaluationRequest(session_id=session_id, model_id=run["model_id"]))
        response = {
            "session_id": session_id,
            "run_id": resolved_run_id,
            "dataset_version": state.dataset_version,
            "metrics": result["metrics"],
            "confusion_matrix": result["confusion_matrix"],
            "roc_curve": result.get("roc_curve"),
        }
        state.evaluations[resolved_run_id] = response
        if state.active_run_id == resolved_run_id:
            state.evaluation = response
        session_service.touch(state, bump_revision=False)
        return response

    def get_explainability_global(self, session_id: str, run_id: str) -> dict[str, object]:
        state, resolved_run_id, _run = self._resolve_run(session_id, run_id)
        self.get_evaluation(session_id, resolved_run_id)
        global_payload = explainability_service.get_global_payload(session_id, resolved_run_id)
        state.explainability[resolved_run_id] = {
            "summary": global_payload["summary"],
            "global_explanation": global_payload["global_explanation"],
        }
        session_service.touch(state, bump_revision=False)
        return {
            "session_id": session_id,
            "run_id": resolved_run_id,
            "summary": global_payload["summary"],
            "global_explanation": global_payload["global_explanation"],
            "global_importance": [
                {"feature": item["feature"], "importance": item["importance"]}
                for item in global_payload["global_explanation"]["features"]
            ],
        }

    def get_explainability_local(self, session_id: str, run_id: str, payload: ExplainabilityLocalRequest) -> dict[str, object]:
        state, resolved_run_id, _run = self._resolve_run(session_id, run_id)
        self.get_evaluation(session_id, resolved_run_id)
        local_payload = explainability_service.get_local_payload(session_id, resolved_run_id, str(payload.patient_id))
        cached = state.explainability.setdefault(resolved_run_id, {})
        local_store = cached.setdefault("local_by_patient", {})
        local_store[str(payload.patient_id)] = local_payload["scenario"]
        session_service.touch(state, bump_revision=False)
        return {
            "session_id": session_id,
            "run_id": resolved_run_id,
            "patient_id": payload.patient_id,
            "record_id": str(payload.patient_id),
            "scenario": local_payload["scenario"],
            "local_explanation": local_payload["scenario"]["local_explanation"]["top_features"],
        }

    def get_explainability_workbench(self, session_id: str, run_id: str) -> dict[str, object]:
        self.get_evaluation(session_id, run_id)
        return explainability_service.get_workbench(session_id, run_id)

    def simulate_explainability(
        self,
        session_id: str,
        run_id: str,
        *,
        record_id: str,
        feature_overrides: dict[str, object] | None = None,
    ) -> dict[str, object]:
        self.get_evaluation(session_id, run_id)
        return explainability_service.simulate(
            session_id,
            run_id,
            record_id=record_id,
            feature_overrides=feature_overrides or {},
        )

    def get_fairness(self, session_id: str, run_id: str) -> dict[str, object]:
        state, resolved_run_id, run = self._resolve_run(session_id, run_id)
        self.get_evaluation(session_id, resolved_run_id)
        cached = state.fairness.get(resolved_run_id)
        if cached:
            return cached
        result = self.fairness_service.check(FairnessRequest(session_id=session_id, model_id=run["model_id"]))
        response = {
            "session_id": session_id,
            "run_id": resolved_run_id,
            "subgroup_metrics": result["subgroup_metrics"],
            "warnings": result["warnings"],
        }
        state.fairness[resolved_run_id] = response
        session_service.touch(state, bump_revision=False)
        return response

    # Certificate lifecycle
    def create_certificate(self, session_id: str, payload: CertificateCreateRequest) -> dict[str, object]:
        state, resolved_run_id, _ = self._resolve_run(session_id, None)
        self.get_evaluation(session_id, resolved_run_id)
        self.get_explainability_global(session_id, resolved_run_id)
        self.get_fairness(session_id, resolved_run_id)
        request = CertificateRequest(
            session_id=session_id,
            participant=payload.participant,
            organization=payload.organization,
        )
        result = self.certificate_service.build(request)
        certificate = {
            "session_id": session_id,
            "run_id": resolved_run_id,
            "dataset_version": state.dataset_version,
            "participant": result["participant"],
            "summary": result["summary"],
            "checklist": result["checklist"],
        }
        state.certificate = certificate
        session_service.touch(state)
        return certificate

    def get_certificate(self, session_id: str) -> dict[str, object]:
        state = session_service.get(session_id)
        if not state.certificate:
            raise PipelineError("Certificate not generated yet.", status_code=404)
        return state.certificate

    def delete_certificate(self, session_id: str) -> dict[str, str]:
        state = session_service.get(session_id)
        if not state.certificate:
            raise PipelineError("Certificate not generated yet.", status_code=404)
        state.certificate = {}
        session_service.touch(state)
        return {"status": "deleted", "session_id": session_id}

    # Legacy-compatible methods (used by existing endpoints/frontend)
    def set_context(self, payload: ContextRequest) -> dict[str, object]:
        state = session_service.get_or_create(payload.session_id)
        context = self.context_service.set_context(payload)
        state.context = context
        session_service.touch(state)
        return context

    def explore_data(self, payload: DataExplorationRequest) -> dict[str, object]:
        session_service.get_or_create(payload.session_id)
        created = self.create_dataset(
            payload.session_id,
            DatasetUpsertRequest(
                source=payload.source,
                target_column=payload.target_column,
            ),
        )
        return created["profile"]

    def apply_preprocessing(self, payload: PreprocessRequest) -> dict[str, object]:
        self.put_preprocessing_config(
            payload.session_id,
            PreprocessingConfigRequest(
                train_split=payload.train_split,
                missing_strategy=payload.missing_strategy,
                normalization=payload.normalization,
                imbalance_strategy=payload.imbalance_strategy,
            ),
        )
        result = self.run_preprocessing(payload.session_id)
        return result["recipe"]

    def train_model(self, payload: TrainRequest) -> dict[str, object]:
        self.put_training_config(
            payload.session_id,
            TrainingConfigRequest(algorithm=payload.algorithm, parameters=payload.parameters),
        )
        result = self.run_training(payload.session_id)
        run = result["run"]
        return {
            "model_id": run["model_id"],
            "model": run["model"],
            "parameters": run["parameters"],
        }

    def evaluate_model(self, payload: EvaluationRequest) -> dict[str, object]:
        state = session_service.get(payload.session_id)
        run_id = self._find_run_id(payload.session_id, payload.model_id)
        result = self.get_evaluation(payload.session_id, run_id or state.active_run_id or "")
        return {
            "metrics": result["metrics"],
            "confusion_matrix": result["confusion_matrix"],
            "roc_curve": result.get("roc_curve"),
        }

    def explain(self, payload: ExplainabilityRequest) -> dict[str, object]:
        state = session_service.get(payload.session_id)
        run_id = self._find_run_id(payload.session_id, payload.model_id) or state.active_run_id
        if not run_id:
            raise PipelineError("No active run found for explainability.")
        global_result = self.get_explainability_global(payload.session_id, run_id)
        local_result = self.get_explainability_local(
            payload.session_id,
            run_id,
            ExplainabilityLocalRequest(patient_id=payload.patient_id),
        )
        return {
            "global_importance": global_result["global_importance"],
            "local_explanation": local_result["local_explanation"],
        }

    def check_fairness(self, payload: FairnessRequest) -> dict[str, object]:
        state = session_service.get(payload.session_id)
        run_id = self._find_run_id(payload.session_id, payload.model_id) or state.active_run_id
        if not run_id:
            raise PipelineError("No active run found for fairness.")
        result = self.get_fairness(payload.session_id, run_id)
        return {
            "subgroup_metrics": result["subgroup_metrics"],
            "warnings": result["warnings"],
        }

    def build_certificate(self, payload: CertificateRequest) -> dict[str, object]:
        result = self.create_certificate(
            payload.session_id,
            CertificateCreateRequest(participant=payload.participant, organization=payload.organization),
        )
        return {
            "participant": result["participant"],
            "summary": result["summary"],
            "checklist": result["checklist"],
        }

    def list_models(self) -> list[str]:
        return self.training_service.list_models()

    @staticmethod
    def snapshot(session_id: str) -> dict[str, object]:
        return session_service.snapshot(session_id)

    def _require_context(self, session_id: str) -> None:
        state = session_service.get_or_create(session_id)
        if not state.context:
            raise PipelineError("Step 1 (context) must be completed first.")

    def _require_data(self, session_id: str) -> None:
        state = session_service.get_or_create(session_id)
        if not state.dataset:
            raise PipelineError("Step 2 (data exploration) must be completed first.")

    def _require_valid_mapping(self, session_id: str) -> None:
        state = session_service.get_or_create(session_id)
        if not state.mapping or not state.mapping_validated:
            raise PipelineError("Step 2.1 (column mapping + validation) must be completed first.")

    def _require_preprocessing(self, session_id: str) -> None:
        state = session_service.get_or_create(session_id)
        if not state.preprocessing_result:
            raise PipelineError("Step 3 (data preparation) must be completed first.")

    def _require_training(self, session_id: str) -> None:
        state = session_service.get_or_create(session_id)
        if not state.training_runs:
            raise PipelineError("Step 4 (training) must be completed first.")

    def _require_evaluation(self, session_id: str) -> None:
        state = session_service.get_or_create(session_id)
        if not state.evaluations:
            raise PipelineError("Step 5 (evaluation) must be completed first.")

    def _resolve_run(self, session_id: str, run_id: str | None) -> tuple[object, str, dict[str, object]]:
        state = session_service.get(session_id)
        resolved_run_id = run_id or state.active_run_id
        if not resolved_run_id:
            raise PipelineError("No active run found. Train a model first.")
        run = state.training_runs.get(resolved_run_id)
        if not run:
            raise PipelineError(f"Run '{resolved_run_id}' not found.", status_code=404)
        return state, resolved_run_id, run

    def _find_run_id(self, session_id: str, model_id: str | None) -> str | None:
        if model_id is None:
            return None
        state = session_service.get(session_id)
        for run_id, run in state.training_runs.items():
            if run.get("model_id") == model_id:
                return run_id
        raise PipelineError(f"Model id '{model_id}' not found in session runs.", status_code=404)


pipeline_service = PipelineService()
