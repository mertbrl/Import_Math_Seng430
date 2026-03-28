import { STEP_KEYS, STEP_LABELS } from "../../store/pipelineStore";

function StepNav({ activeStep, onStepChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {STEP_KEYS.map((stepKey, index) => (
        <button
          key={stepKey}
          onClick={() => onStepChange(stepKey)}
          type="button"
          style={{
            border: activeStep === stepKey ? "2px solid #1f4c78" : "1px solid #c6d2dc",
            background: activeStep === stepKey ? "#eef6ff" : "white",
            borderRadius: 10,
            padding: "8px 10px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 12, color: "#44627d" }}>Step {index + 1}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{STEP_LABELS[stepKey]}</div>
        </button>
      ))}
    </div>
  );
}

export default StepNav;
