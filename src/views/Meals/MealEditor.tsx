import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, deleteMealCascade } from "../../db";
import { Modal } from "../../components/Modal";
import { NumericStepper } from "../../components/NumericStepper";
import { IngredientPicker } from "./IngredientPicker";
import {
  ingredientDisplayName,
  nutrientsPer100g,
  type Ingredient,
} from "../../models/Ingredient";
import {
  GRAMS_PER_UNIT,
  UNITS,
  gramsEquivalent,
  type MealIngredient,
  type MeasurementUnit,
} from "../../models/MealIngredient";
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type MealSlot } from "../../models/Meal";
import {
  ZERO_TOTALS,
  addTotals,
  divideTotals,
  scaleTotals,
  type NutrientTotals,
} from "../../models/NutrientTotals";

interface Props {
  mealId: number;
  isNew: boolean;
  open: boolean;
  onClose: () => void;
}

export function MealEditor({ mealId, isNew, open, onClose }: Props) {
  const meal = useLiveQuery(() => db.meals.get(mealId), [mealId]);
  const ingredients = useLiveQuery(
    () => db.mealIngredients.where("mealId").equals(mealId).toArray(),
    [mealId],
    [] as MealIngredient[],
  );

  // Resolve referenced Ingredient rows so we can show names + nutrient maths.
  const ingredientLookup = useLiveQuery(
    async () => {
      if (ingredients.length === 0) return new Map<number, Ingredient>();
      const ids = ingredients.map((i) => i.ingredientId);
      const rows = await db.ingredients.bulkGet(ids);
      const m = new Map<number, Ingredient>();
      rows.forEach((r) => {
        if (r && r.id !== undefined) m.set(r.id, r);
      });
      return m;
    },
    [ingredients],
    new Map<number, Ingredient>(),
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [newTag, setNewTag] = useState("");

  const nameValid = (meal?.name ?? "").trim().length > 0;

  const close = () => { setNewTag(""); setPickerOpen(false); onClose(); };

  const cancel = () => {
    close();
    if (isNew) {
      // Run the cascade delete after the close animation has played out, so the
      // modal doesn't briefly re-render in a "loading…" state when the meal row
      // disappears mid-animation.
      window.setTimeout(() => { void deleteMealCascade(mealId); }, 350);
    }
  };

  const save = () => { if (nameValid) close(); };

  const updateMeal = async (patch: Parameters<typeof db.meals.update>[1]) => {
    await db.meals.update(mealId, patch);
  };

  const addIngredient = async (ing: Ingredient, qty: number, unit: MeasurementUnit) => {
    if (ing.id === undefined) return;
    await db.mealIngredients.add({
      mealId,
      ingredientId: ing.id,
      quantity: qty,
      unit,
    });
  };

  const updateIngredient = async (id: number, patch: Partial<MealIngredient>) => {
    await db.mealIngredients.update(id, patch);
  };

  const removeIngredient = async (id: number) => {
    await db.mealIngredients.delete(id);
  };

  const addTag = async () => {
    const t = newTag.trim();
    if (!t || !meal) return;
    if (meal.tags.includes(t)) { setNewTag(""); return; }
    await updateMeal({ tags: [...meal.tags, t] });
    setNewTag("");
  };

  const removeTag = async (tag: string) => {
    if (!meal) return;
    await updateMeal({ tags: meal.tags.filter((t) => t !== tag) });
  };

  // Per-serving nutrient totals
  const perServing: NutrientTotals = useMemo(() => {
    if (!meal) return { ...ZERO_TOTALS };
    const total = ingredients.reduce<NutrientTotals>((acc, mi) => {
      const ing = ingredientLookup.get(mi.ingredientId);
      if (!ing) return acc;
      const grams = gramsEquivalent(mi);
      return addTotals(acc, scaleTotals(nutrientsPer100g(ing), grams / 100));
    }, { ...ZERO_TOTALS });
    return divideTotals(total, Math.max(1, meal.servings));
  }, [ingredients, ingredientLookup, meal]);

  if (!meal) {
    return (
      <Modal open={open} onClose={close} title={isNew ? "New meal" : "Edit meal"} tall>
        <p className="muted">Loading…</p>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onClose={cancel}
        title={isNew ? "New meal" : "Edit meal"}
        primaryAction={{ label: isNew ? "Save" : "Done", onClick: save, disabled: !nameValid }}
        tall
      >
        <div className="form-stack">
          <div className="field">
            <label className="field-label" htmlFor="meal-name">Name</label>
            <input
              id="meal-name"
              className="text-input"
              value={meal.name}
              onChange={(e) => updateMeal({ name: e.target.value })}
              placeholder="Spaghetti bolognese"
              autoFocus={isNew}
            />
          </div>

          <div className="field">
            <div className="field-label">Default slot</div>
            <div className="seg">
              {MEAL_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`seg__btn ${meal.defaultSlot === s ? "seg__btn--active" : ""}`}
                  onClick={() => updateMeal({ defaultSlot: s as MealSlot })}
                >
                  {MEAL_SLOT_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <NumericStepper
            label="Servings"
            value={meal.servings}
            onChange={(n) => updateMeal({ servings: Math.max(1, n) })}
            min={1}
            max={20}
          />

          <div className="field">
            <div className="field-label">Tags</div>
            {meal.tags.length > 0 ? (
              <div className="chips" style={{ marginBottom: "var(--sp-xs)" }}>
                {meal.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="chip chip--active"
                    onClick={() => removeTag(t)}
                  >
                    {t} <span style={{ marginLeft: 4, fontSize: 9 }}>✕</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="row-add">
              <input
                className="text-input"
                placeholder="Add tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTag(); } }}
              />
              <button type="button" className="btn btn--ghost" onClick={addTag} disabled={!newTag.trim()}>
                Add
              </button>
            </div>
          </div>

          <NutrientRollup totals={perServing} servings={meal.servings} />

          <div className="field">
            <div className="field-label">Ingredients ({ingredients.length})</div>
            {ingredients.length === 0 ? (
              <p className="muted" style={{ margin: "var(--sp-xs) 0" }}>No ingredients yet.</p>
            ) : (
              <ul className="ing-list">
                {ingredients.map((mi) => {
                  const ing = ingredientLookup.get(mi.ingredientId);
                  if (!ing || mi.id === undefined) return null;
                  const grams = mi.quantity * GRAMS_PER_UNIT[mi.unit];
                  const contribution = scaleTotals(nutrientsPer100g(ing), grams / 100);
                  return (
                    <li key={mi.id} className="ing-row">
                      <div className="ing-row__main">
                        <div>{ingredientDisplayName(ing)}</div>
                        <div className="muted ing-row__sub">
                          {Math.round(contribution.energyKj)} kJ · {Math.round(contribution.sodiumMg)} mg Na
                        </div>
                      </div>
                      <input
                        className="text-input ing-row__qty"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={mi.quantity}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          void updateIngredient(mi.id!, { quantity: Number.isFinite(v) ? v : 0 });
                        }}
                      />
                      <select
                        className="text-input ing-row__unit"
                        value={mi.unit}
                        onChange={(e) => void updateIngredient(mi.id!, { unit: e.target.value as MeasurementUnit })}
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => void removeIngredient(mi.id!)}
                        aria-label="Remove ingredient"
                      >✕</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => setPickerOpen(true)}>
              + Add ingredient
            </button>
          </div>

          {!isNew ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={async () => {
                await deleteMealCascade(mealId);
                close();
              }}
              style={{ marginTop: "var(--sp-md)" }}
            >
              Delete meal
            </button>
          ) : null}
        </div>
      </Modal>

      <IngredientPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addIngredient}
      />
    </>
  );
}

function NutrientRollup({ totals, servings }: { totals: NutrientTotals; servings: number }) {
  const sodiumWarn = totals.sodiumMg > 600;
  return (
    <div className="card rollup">
      <div className="section-label">
        Per serving {servings > 1 ? `· auto from ÷ ${servings}` : ""}
      </div>
      <div className="rollup__row">
        <Pill label="kJ" value={Math.round(totals.energyKj)} />
        <Pill label="kcal" value={Math.round(totals.energyKcal)} />
      </div>
      <div className="rollup__divider" />
      <div className="rollup__row">
        <Pill label="Protein" value={fmt(totals.proteinG)} unit="g" />
        <Pill label="Carbs" value={fmt(totals.carbsG)} unit="g" />
        <Pill label="Fat" value={fmt(totals.fatG)} unit="g" />
        <Pill label="Fibre" value={fmt(totals.fibreG)} unit="g" />
      </div>
      <div className="rollup__divider" />
      <div className="rollup__row">
        <Pill label="Sodium" value={Math.round(totals.sodiumMg)} unit="mg" warn={sodiumWarn} />
        <Pill label="Potassium" value={Math.round(totals.potassiumMg)} unit="mg" />
        <Pill label="Calcium" value={Math.round(totals.calciumMg)} unit="mg" />
        <Pill label="Mg" value={Math.round(totals.magnesiumMg)} unit="mg" />
      </div>
    </div>
  );
}

function fmt(v: number): string {
  if (v >= 100) return Math.round(v).toString();
  return v.toFixed(1);
}

function Pill({ label, value, unit, warn }: { label: string; value: string | number; unit?: string; warn?: boolean }) {
  return (
    <div className="pill">
      <div className="pill__label">{label}</div>
      <div className={`pill__value mono ${warn ? "pill__value--warn" : ""}`}>
        {value}{unit ? <span className="pill__unit"> {unit}</span> : null}
      </div>
    </div>
  );
}
