export default function PlanView() {
  return (
    <>
      <header className="view-header">
        <h1>Plan</h1>
      </header>
      <div className="scroll-area">
        <div className="card">
          <div className="section-label">Coming next</div>
          <p className="muted" style={{ marginTop: "var(--sp-xs)" }}>
            Weekly meal grid (Monday-first), tap-to-pick slots, generated grocery list grouped by aisle.
          </p>
        </div>
      </div>
    </>
  );
}
