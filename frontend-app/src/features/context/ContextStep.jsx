import SectionCard from "../../components/common/SectionCard";

function ContextStep({ value, onChange }) {
  return (
    <SectionCard title="Clinical Context">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Domain
          <input
            value={value.domain}
            onChange={(event) => onChange({ domain: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label>
          Use Case
          <textarea
            value={value.use_case}
            onChange={(event) => onChange({ use_case: event.target.value })}
            style={{ width: "100%", marginTop: 4, minHeight: 80, padding: 8 }}
          />
        </label>
      </div>
    </SectionCard>
  );
}

export default ContextStep;
