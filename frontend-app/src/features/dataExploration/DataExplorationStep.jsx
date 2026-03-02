import SectionCard from "../../components/common/SectionCard";

function DataExplorationStep({ value, onChange }) {
  return (
    <SectionCard title="Data Exploration">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Source
          <select
            value={value.source}
            onChange={(event) => onChange({ source: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          >
            <option value="default">Default Dataset</option>
            <option value="upload">Upload CSV</option>
          </select>
        </label>
        <label>
          Target Column
          <input
            value={value.target_column}
            onChange={(event) => onChange({ target_column: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
      </div>
    </SectionCard>
  );
}

export default DataExplorationStep;
