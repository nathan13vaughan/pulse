export default function DashboardView() {
  return (
    <>
      <header className="view-header">
        <h1>Today</h1>
      </header>
      <div className="scroll-area">
        <div className="card">
          <div className="section-label">Coming next</div>
          <p className="muted" style={{ marginTop: "var(--sp-xs)" }}>
            Daily snapshot — latest reading, today's plan, 7-day averages, link to insights.
          </p>
        </div>
      </div>
    </>
  );
}
