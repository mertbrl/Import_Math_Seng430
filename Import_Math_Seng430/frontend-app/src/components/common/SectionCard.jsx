function SectionCard({ title, children }) {
  return (
    <section
      style={{
        border: "1px solid #d7e0e8",
        borderRadius: 12,
        padding: 16,
        background: "white",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 20 }}>{title}</h2>
      {children}
    </section>
  );
}

export default SectionCard;
