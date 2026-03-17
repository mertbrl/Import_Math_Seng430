import { useMemo, useState } from "react";

import SectionCard from "../components/common/SectionCard";
import StepNav from "../components/stepper/StepNav";
import ColumnMapperStep from "../features/columnMapper/ColumnMapperStep";
import ContextStep from "../features/context/ContextStep";
import DataExplorationStep from "../features/dataExploration/DataExplorationStep";
import DataPrepStep from "../features/dataPrep/DataPrepStep";
import EthicsStep from "../features/ethics/EthicsStep";
import EvaluationStep from "../features/evaluation/EvaluationStep";
import ExplainabilityStep from "../features/explainability/ExplainabilityStep";
import ModelTuningStep from "../features/modelTuning/ModelTuningStep";
import CertificateStep from "../features/certificate/CertificateStep";
import { usePipelineSteps } from "../hooks/usePipelineSteps";
import {
  buildCertificate,
  checkFairness,
  evaluateModel,
  explainModel,
  exploreData,
  preprocessData,
  putMapping,
  setContext,
  trainModel,
  validateMapping,
} from "../services/pipelineApi";
import { INITIAL_PIPELINE_STATE } from "../store/pipelineStore";

function HomePage() {
  const [pipelineState, setPipelineState] = useState(INITIAL_PIPELINE_STATE);
  const [responses, setResponses] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentStep, currentStepIndex, nextStep, prevStep, goToStep } = usePipelineSteps();

  const canGoPrev = currentStepIndex > 0;

  const updateStepState = (stepKey, patch) => {
    setPipelineState((prev) => ({
      ...prev,
      [stepKey]: { ...prev[stepKey], ...patch },
    }));
  };

  const runCurrentStep = async () => {
    setLoading(true);
    setError("");
    try {
      const session_id = pipelineState.sessionId;
      let result;
      if (currentStep === "context") {
        result = await setContext({ session_id, ...pipelineState.context });
      } else if (currentStep === "dataExploration") {
        result = await exploreData({ session_id, ...pipelineState.dataExploration });
      } else if (currentStep === "columnMapper") {
        await putMapping(session_id, {
          problem_type: "binary_classification",
          target_column: pipelineState.columnMapper.targetColumn,
          roles: {
            [pipelineState.columnMapper.targetColumn]: "target",
          },
        });
        result = await validateMapping(session_id);
        setPipelineState((prev) => ({
          ...prev,
          columnMapper: { ...prev.columnMapper, schemaValidated: true },
        }));
      } else if (currentStep === "dataPrep") {
        result = await preprocessData({ session_id, ...pipelineState.dataPrep });
      } else if (currentStep === "modelTuning") {
        result = await trainModel({ session_id, ...pipelineState.modelTuning });
      } else if (currentStep === "evaluation") {
        result = await evaluateModel({ session_id });
        setPipelineState((prev) => ({ ...prev, evaluation: result }));
      } else if (currentStep === "explainability") {
        result = await explainModel({ session_id, ...pipelineState.explainability });
      } else if (currentStep === "ethics") {
        result = await checkFairness({ session_id });
        setPipelineState((prev) => ({ ...prev, ethics: result }));
      } else if (currentStep === "certificate") {
        result = await buildCertificate({ session_id, ...pipelineState.certificate });
      }
      if (result) {
        setResponses((prev) => ({ ...prev, [currentStep]: result }));
      }
    } catch (apiError) {
      setError(apiError?.response?.data?.error || "Step execution failed.");
    } finally {
      setLoading(false);
    }
  };

  const activeStepComponent = useMemo(() => {
    if (currentStep === "context") {
      return <ContextStep value={pipelineState.context} onChange={(patch) => updateStepState("context", patch)} />;
    }
    if (currentStep === "dataExploration") {
      return (
        <DataExplorationStep
          value={pipelineState.dataExploration}
          onChange={(patch) => updateStepState("dataExploration", patch)}
        />
      );
    }
    if (currentStep === "columnMapper") {
      return (
        <ColumnMapperStep value={pipelineState.columnMapper} onChange={(patch) => updateStepState("columnMapper", patch)} />
      );
    }
    if (currentStep === "dataPrep") {
      return <DataPrepStep value={pipelineState.dataPrep} onChange={(patch) => updateStepState("dataPrep", patch)} />;
    }
    if (currentStep === "modelTuning") {
      return (
        <ModelTuningStep
          value={pipelineState.modelTuning}
          onChange={(patch) => updateStepState("modelTuning", patch)}
        />
      );
    }
    if (currentStep === "evaluation") {
      return <EvaluationStep value={pipelineState.evaluation} />;
    }
    if (currentStep === "explainability") {
      return (
        <ExplainabilityStep
          value={pipelineState.explainability}
          onChange={(patch) => updateStepState("explainability", patch)}
        />
      );
    }
    if (currentStep === "ethics") {
      return <EthicsStep value={pipelineState.ethics} />;
    }
    return <CertificateStep value={pipelineState.certificate} onChange={(patch) => updateStepState("certificate", patch)} />;
  }, [currentStep, pipelineState]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>IMP ML Tool - Structured Skeleton</h1>
      <p style={{ color: "#4a6278" }}>
        Bu arayuz proje yapisini hizlica dogrulamak icin olusturulmus temel iskelettir.
      </p>

      <StepNav activeStep={currentStep} onStepChange={goToStep} />

      <div style={{ marginTop: 16 }}>{activeStepComponent}</div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button type="button" onClick={prevStep} disabled={!canGoPrev}>
          Previous
        </button>
        <button type="button" onClick={runCurrentStep} disabled={loading}>
          {loading ? "Running..." : "Run Step"}
        </button>
        <button type="button" onClick={nextStep}>
          Next
        </button>
      </div>

      {error ? (
        <p style={{ color: "#9f1d1d", marginTop: 12, fontWeight: 600 }}>{error}</p>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <SectionCard title="Latest Step Output">
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: "#f4f7fb",
              border: "1px solid #d7e0e8",
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(responses[currentStep] || {}, null, 2)}
          </pre>
        </SectionCard>
      </div>
    </div>
  );
}

export default HomePage;
