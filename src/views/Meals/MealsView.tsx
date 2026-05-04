export default function MealsView() {
  return (
    <>
      <header className="view-header">
        <h1>Meals</h1>
      </header>
      <div className="scroll-area">
        <div className="card">
          <div className="section-label">Coming next</div>
          <p className="muted" style={{ marginTop: "var(--sp-xs)" }}>
            Meal library with search and tag filters, editor with live nutrient rollup, ingredient picker across AUSNUT and Coles/Woolworths branded foods.
          </p>
        </div>
      </div>
    </>
  );
}
