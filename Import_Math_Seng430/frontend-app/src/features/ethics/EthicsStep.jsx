import SectionCard from "../../components/common/SectionCard";

function EthicsStep({ value }) {
  return (
    <SectionCard title="Ethics & Bias">
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
        {JSON.stringify(value, null, 2)}
      </pre>
    </SectionCard>
  );
}

export default EthicsStep;
