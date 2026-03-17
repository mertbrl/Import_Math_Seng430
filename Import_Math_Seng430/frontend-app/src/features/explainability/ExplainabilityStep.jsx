import SectionCard from "../../components/common/SectionCard";

function ExplainabilityStep({ value, onChange }) {
  return (
    <SectionCard title="Explainability">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Patient ID
          <input
            value={value.patient_id}
            onChange={(event) => onChange({ patient_id: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <div style={{ fontSize: 14, color: "#4a6278" }}>
          Global ve local explanation çıktıları bu step tetiklenince backend'den gelir.
        </div>
      </div>
    </SectionCard>
  );
}

export default ExplainabilityStep;
