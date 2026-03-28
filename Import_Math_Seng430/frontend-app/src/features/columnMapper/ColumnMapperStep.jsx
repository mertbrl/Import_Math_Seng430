import SectionCard from "../../components/common/SectionCard";

function ColumnMapperStep({ value, onChange }) {
  return (
    <SectionCard title="Column Mapper">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Target Column Mapping
          <input
            value={value.targetColumn}
            onChange={(event) => onChange({ targetColumn: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={value.schemaValidated}
            onChange={(event) => onChange({ schemaValidated: event.target.checked })}
          />
          Schema validated
        </label>
      </div>
    </SectionCard>
  );
}

export default ColumnMapperStep;
