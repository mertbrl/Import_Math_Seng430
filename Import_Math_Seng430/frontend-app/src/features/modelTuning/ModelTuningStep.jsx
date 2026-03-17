import SectionCard from "../../components/common/SectionCard";

function ModelTuningStep({ value, onChange }) {
  return (
    <SectionCard title="Model & Parameters">
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Algorithm
          <select
            value={value.algorithm}
            onChange={(event) => onChange({ algorithm: event.target.value })}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          >
            <option value="knn">KNN</option>
            <option value="svm">SVM</option>
            <option value="dt">Decision Tree</option>
            <option value="rf">Random Forest</option>
            <option value="lr">Logistic Regression</option>
            <option value="nb">Naive Bayes</option>
          </select>
        </label>
        <label>
          Parameters (JSON)
          <textarea
            value={JSON.stringify(value.parameters, null, 2)}
            onChange={(event) => {
              try {
                onChange({ parameters: JSON.parse(event.target.value) });
              } catch (_) {
                // Keep JSON parsing tolerant while typing.
              }
            }}
            style={{ width: "100%", marginTop: 4, minHeight: 120, padding: 8 }}
          />
        </label>
      </div>
    </SectionCard>
  );
}

export default ModelTuningStep;
