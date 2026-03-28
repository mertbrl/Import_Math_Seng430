import SectionCard from "../../components/common/SectionCard";

function DataPrepStep({ value, onChange }) {
  return (
    <SectionCard title="Data Preparation">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Train Split (%)
          <input
            type="number"
            min={60}
            max={90}
            value={value.train_split}
            onChange={(event) => onChange({ train_split: Number(event.target.value) })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label>
          Missing Strategy
          <input
            value={value.missing_strategy}
            onChange={(event) => onChange({ missing_strategy: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label>
          Normalization
          <input
            value={value.normalization}
            onChange={(event) => onChange({ normalization: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
        <label>
          Imbalance Strategy
          <input
            value={value.imbalance_strategy}
            onChange={(event) => onChange({ imbalance_strategy: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </label>
      </div>
    </SectionCard>
  );
}

export default DataPrepStep;
