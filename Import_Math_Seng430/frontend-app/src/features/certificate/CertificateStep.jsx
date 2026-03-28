import SectionCard from "../../components/common/SectionCard";

function CertificateStep({ value, onChange }) {
  return (
    <SectionCard title="Summary Certificate">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Participant
          <input
            value={value.participant}
            onChange={(event) => onChange({ participant: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label>
          Organization
          <input
            value={value.organization}
            onChange={(event) => onChange({ organization: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
      </div>
    </SectionCard>
  );
}

export default CertificateStep;
