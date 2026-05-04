import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { MEAL_SLOT_LABEL, type Meal } from "../../models/Meal";
import {
  ZERO_TOTALS,
  addTotals,
  divideTotals,
  scaleTotals,
  type NutrientTotals,
} from "../../models/NutrientTotals";
import { gramsEquivalent, type MealIngredient } from "../../models/MealIngredient";
import { nutrientsPer100g } from "../../models/Ingredient";
import { MealEditor } from "./MealEditor";
import "./meals.css";

export default function MealsView() {
  const meals = useLiveQuery(
    () => db.meals.where("name").notEqual("").sortBy("name"),
    [],
    [] as Meal[],
  );

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; isNew: boolean } | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    meals.forEach((m) => m.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [meals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meals.filter((m) => {
      if (tagFilter && !m.tags.includes(tagFilter)) return false;
      if (!q) return true;
      if (m.name.toLowerCase().includes(q)) return true;
      if (m.tags.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [meals, search, tagFilter]);

  const startNew = async () => {
    const id = await db.meals.add({
      name: "",
      tags: [],
      servings: 1,
      defaultSlot: "dinner",
    });
    setEditing({ id: Number(id), isNew: true });
  };

  return (
    <>
      <header className="view-header">
        <h1>Meals</h1>
        <button
          type="button"
          className="icon-btn icon-btn--accent"
          onClick={() => void startNew()}
          aria-label="New meal"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="scroll-area">
        <input
          className="text-input"
          placeholder="Search meals or tags"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {allTags.length > 0 ? (
          <div className="filter-strip" style={{ marginTop: "var(--sp-sm)" }}>
            <button
              type="button"
              className={`chip ${tagFilter === null ? "chip--active" : ""}`}
              onClick={() => setTagFilter(null)}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${tagFilter === t ? "chip--active" : ""}`}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}

        {meals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden>🍴</div>
            <div className="headline" style={{ fontSize: "var(--fs-title)" }}>No meals yet</div>
            <div className="muted">Tap + to build your first recipe.</div>
          </div>
        ) : filtered.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "var(--sp-xl) 0" }}>
            No meals match your filter.
          </p>
        ) : (
          <ul className="meal-list">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="meal-card"
                  onClick={() => m.id !== undefined && setEditing({ id: m.id, isNew: false })}
                >
                  <MealCard meal={m} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <MealEditor
          mealId={editing.id}
          isNew={editing.isNew}
          open={true}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const ingredients = useLiveQuery<MealIngredient[]>(
    async () => {
      if (meal.id === undefined) return [];
      return await db.mealIngredients.where("mealId").equals(meal.id).toArray();
    },
    [meal.id],
    [] as MealIngredient[],
  );

  const ingredientLookup = useLiveQuery<Map<number, NutrientTotals>>(
    async () => {
      if (ingredients.length === 0) return new Map<number, NutrientTotals>();
      const ids = ingredients.map((i) => i.ingredientId);
      const rows = await db.ingredients.bulkGet(ids);
      const m = new Map<number, NutrientTotals>();
      rows.forEach((r) => {
        if (r && r.id !== undefined) m.set(r.id, nutrientsPer100g(r));
      });
      return m;
    },
    [ingredients],
    new Map<number, NutrientTotals>(),
  );

  const perServing: NutrientTotals = useMemo(() => {
    const total = ingredients.reduce<NutrientTotals>((acc, mi) => {
      const per100 = ingredientLookup.get(mi.ingredientId);
      if (!per100) return acc;
      const grams = gramsEquivalent(mi);
      return addTotals(acc, scaleTotals(per100, grams / 100));
    }, { ...ZERO_TOTALS });
    return divideTotals(total, Math.max(1, meal.servings));
  }, [ingredients, ingredientLookup, meal.servings]);

  return (
    <div className="card meal-card__inner">
      <div className="meal-card__header">
        <div className="meal-card__name">{meal.name || "Untitled"}</div>
        <div className="meal-card__slot section-label">{MEAL_SLOT_LABEL[meal.defaultSlot]}</div>
      </div>
      {meal.tags.length > 0 ? (
        <div className="meal-card__tags muted">{meal.tags.join(" · ")}</div>
      ) : null}
      <div className="meal-card__metrics">
        <Metric label="kJ" value={Math.round(perServing.energyKj)} />
        <Metric label="Na" value={Math.round(perServing.sodiumMg)} unit="mg" />
        <Metric label="K" value={Math.round(perServing.potassiumMg)} unit="mg" />
      </div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      <div className="mono meal-card__metric-value">
        {value}{unit ? <span className="meal-card__metric-unit"> {unit}</span> : null}
      </div>
    </div>
  );
}
