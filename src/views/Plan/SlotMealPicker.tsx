import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { Modal } from "../../components/Modal";
import { MEAL_SLOT_LABEL, type Meal, type MealSlot } from "../../models/Meal";
import type { MealPlanEntry } from "../../models/MealPlanEntry";
import { formatShort } from "../../services/dateUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  date: number; // start-of-day epoch ms
  slot: MealSlot;
  existing: MealPlanEntry | null;
}

export function SlotMealPicker({ open, onClose, date, slot, existing }: Props) {
  const meals = useLiveQuery(
    () => db.meals.where("name").notEqual("").sortBy("name"),
    [],
    [] as Meal[],
  );
  const [search, setSearch] = useState("");

  const matches = (m: Meal) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (m.name.toLowerCase().includes(q)) return true;
    if (m.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  };

  const suggested = useMemo(
    () => meals.filter((m) => m.defaultSlot === slot && matches(m)),
    [meals, slot, search],
  );
  const others = useMemo(
    () => meals.filter((m) => m.defaultSlot !== slot && matches(m)),
    [meals, slot, search],
  );

  const close = () => { setSearch(""); onClose(); };

  const assign = async (meal: Meal) => {
    if (meal.id === undefined) return;
    if (existing && existing.id !== undefined) {
      await db.mealPlan.update(existing.id, { mealId: meal.id, servings: 1, wasEaten: false });
    } else {
      await db.mealPlan.add({ date, slot, mealId: meal.id, servings: 1, wasEaten: false });
    }
    close();
  };

  const removeExisting = async () => {
    if (existing?.id !== undefined) await db.mealPlan.delete(existing.id);
    close();
  };

  const currentMeal = useLiveQuery<Meal | undefined>(
    async () => existing ? await db.meals.get(existing.mealId) : undefined,
    [existing?.mealId],
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={`${MEAL_SLOT_LABEL[slot]} — ${formatShort(date)}`}
    >
      <div className="form-stack">
        <input
          className="text-input"
          placeholder="Search meals"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {existing && currentMeal ? (
          <section>
            <div className="section-label">Currently planned</div>
            <div className="card slot-current">
              <div>
                <div className="slot-current__name">{currentMeal.name}</div>
                {existing.servings !== 1 ? (
                  <div className="muted slot-current__sub">× {existing.servings}</div>
                ) : null}
              </div>
              <button type="button" className="btn btn--danger" onClick={removeExisting}>
                Remove
              </button>
            </div>
          </section>
        ) : null}

        {suggested.length > 0 ? (
          <section>
            <div className="section-label">Suggested for {MEAL_SLOT_LABEL[slot].toLowerCase()}</div>
            <ul className="meal-pick-list">
              {suggested.map((m) => (
                <MealPickRow key={m.id} meal={m} onPick={() => assign(m)} />
              ))}
            </ul>
          </section>
        ) : null}

        {others.length > 0 ? (
          <section>
            <div className="section-label">{suggested.length === 0 ? "All meals" : "Other meals"}</div>
            <ul className="meal-pick-list">
              {others.map((m) => (
                <MealPickRow key={m.id} meal={m} onPick={() => assign(m)} />
              ))}
            </ul>
          </section>
        ) : null}

        {meals.length === 0 ? (
          <p className="muted">Build a meal in the Meals tab first.</p>
        ) : suggested.length === 0 && others.length === 0 ? (
          <p className="muted">No meals match your search.</p>
        ) : null}
      </div>
    </Modal>
  );
}

function MealPickRow({ meal, onPick }: { meal: Meal; onPick: () => void }) {
  return (
    <li>
      <button type="button" className="meal-pick-row" onClick={onPick}>
        <div className="meal-pick-row__main">
          <div>{meal.name}</div>
          {meal.tags.length > 0 ? (
            <div className="muted meal-pick-row__sub">{meal.tags.join(" · ")}</div>
          ) : null}
        </div>
        <span className="meal-pick-row__add">+</span>
      </button>
    </li>
  );
}
