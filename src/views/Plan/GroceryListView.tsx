import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { AISLE_LABEL, type Ingredient } from "../../models/Ingredient";
import type { Meal } from "../../models/Meal";
import type { MealIngredient } from "../../models/MealIngredient";
import type { MealPlanEntry } from "../../models/MealPlanEntry";
import { addDays, formatShort, startOfWeekMonday } from "../../services/dateUtils";
import { aggregate, displayQuantity, grouped, type GroceryLine } from "../../services/groceryAggregator";

export function GroceryListView() {
  const location = useLocation();
  const navState = location.state as { weekStart?: number } | null;
  const weekStart = navState?.weekStart ?? startOfWeekMonday();
  const weekEnd = addDays(weekStart, 7);

  const [hideEaten, setHideEaten] = useState(true);
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  const entries = useLiveQuery(
    () => db.mealPlan.where("date").between(weekStart, weekEnd, true, false).toArray(),
    [weekStart, weekEnd],
    [] as MealPlanEntry[],
  );

  const meals = useLiveQuery(
    async () => {
      if (entries.length === 0) return new Map<number, Meal>();
      const ids = Array.from(new Set(entries.map((e) => e.mealId)));
      const rows = await db.meals.bulkGet(ids);
      const m = new Map<number, Meal>();
      rows.forEach((r) => { if (r && r.id !== undefined) m.set(r.id, r); });
      return m;
    },
    [entries],
    new Map<number, Meal>(),
  );

  const mealIngredientsByMeal = useLiveQuery(
    async () => {
      const mealIds: number[] = [];
      for (const meal of meals.values()) {
        if (meal.id !== undefined) mealIds.push(meal.id);
      }
      if (mealIds.length === 0) return new Map<number, MealIngredient[]>();
      const all = await db.mealIngredients.where("mealId").anyOf(mealIds).toArray();
      const map = new Map<number, MealIngredient[]>();
      for (const mi of all) {
        const arr = map.get(mi.mealId) ?? [];
        arr.push(mi);
        map.set(mi.mealId, arr);
      }
      return map;
    },
    [meals],
    new Map<number, MealIngredient[]>(),
  );

  const ingredientById = useLiveQuery(
    async () => {
      const ids = new Set<number>();
      for (const list of mealIngredientsByMeal.values()) {
        list.forEach((mi) => ids.add(mi.ingredientId));
      }
      if (ids.size === 0) return new Map<number, Ingredient>();
      const rows = await db.ingredients.bulkGet(Array.from(ids));
      const m = new Map<number, Ingredient>();
      rows.forEach((r) => { if (r && r.id !== undefined) m.set(r.id, r); });
      return m;
    },
    [mealIngredientsByMeal],
    new Map<number, Ingredient>(),
  );

  const lines: GroceryLine[] = useMemo(() => {
    const filtered = hideEaten ? entries.filter((e) => !e.wasEaten) : entries;
    return aggregate({
      entries: filtered,
      meals,
      mealIngredients: mealIngredientsByMeal,
      ingredients: ingredientById,
    });
  }, [entries, meals, mealIngredientsByMeal, ingredientById, hideEaten]);

  const sections = useMemo(() => grouped(lines), [lines]);

  const totalCount = lines.length;
  const checkedCount = lines.filter((l) => l.ingredient.id !== undefined && checked.has(l.ingredient.id)).length;

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const weekLabel = `${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))}`;

  return (
    <>
      <header className="view-header">
        <Link to="/plan" className="icon-btn" aria-label="Back to plan">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 style={{ fontSize: "var(--fs-title)" }}>{weekLabel}</h1>
        <button
          type="button"
          className={`icon-btn ${hideEaten ? "icon-btn--accent" : ""}`}
          onClick={() => setHideEaten((v) => !v)}
          aria-label={hideEaten ? "Show eaten meals" : "Hide eaten meals"}
          title={hideEaten ? "Showing un-eaten only" : "Showing all"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={hideEaten ? "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" : "M1 1l22 22M17.94 17.94A11 11 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A11 11 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"} />
          </svg>
        </button>
      </header>

      <div className="scroll-area">
        {totalCount === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🛒</div>
            <div className="headline" style={{ fontSize: "var(--fs-title)" }}>Nothing to shop for</div>
            <div className="muted">
              {hideEaten
                ? "All planned meals this week are ticked, or no meals are planned."
                : "No meals planned for this week."}
            </div>
          </div>
        ) : (
          <>
            <div className="grocery-progress card">
              <div className="grocery-progress__label muted">
                {checkedCount} of {totalCount} ticked
              </div>
              <progress max={totalCount} value={checkedCount} className="grocery-progress__bar" />
            </div>

            {sections.map((section) => (
              <section key={section.aisle} className="grocery-section">
                <div className="section-label" style={{ marginBottom: "var(--sp-xs)" }}>
                  {AISLE_LABEL[section.aisle]}
                </div>
                <ul className="grocery-list">
                  {section.lines.map((line) => {
                    const id = line.ingredient.id!;
                    const isChecked = checked.has(id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={`grocery-row ${isChecked ? "grocery-row--checked" : ""}`}
                          onClick={() => toggle(id)}
                        >
                          <span className="grocery-row__check" aria-hidden>
                            {isChecked ? (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                            )}
                          </span>
                          <div className="grocery-row__main">
                            <div className="grocery-row__name">{line.ingredient.name}</div>
                            {line.ingredient.brand ? (
                              <div className="grocery-row__brand">{line.ingredient.brand}</div>
                            ) : null}
                          </div>
                          <span className="grocery-row__qty mono">{displayQuantity(line.totalGrams)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}
