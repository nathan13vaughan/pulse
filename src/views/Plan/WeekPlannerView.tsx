import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type Meal, type MealSlot } from "../../models/Meal";
import type { MealPlanEntry } from "../../models/MealPlanEntry";
import { addDays, formatShort, isSameDay, startOfDay, startOfWeekMonday } from "../../services/dateUtils";
import { useDeferredUnmount } from "../../services/useDeferredUnmount";
import { SlotMealPicker } from "./SlotMealPicker";

const AU_LOCALE = "en-AU";

export function WeekPlannerView() {
  const [weekStart, setWeekStart] = useState<number>(() => startOfWeekMonday());
  const weekEnd = addDays(weekStart, 7);
  const today = startOfDay();

  const entries = useLiveQuery(
    () => db.mealPlan.where("date").between(weekStart, weekEnd, true, false).toArray(),
    [weekStart, weekEnd],
    [] as MealPlanEntry[],
  );

  const mealLookup = useLiveQuery(
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

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const entriesByDay = useMemo(() => {
    const m = new Map<number, MealPlanEntry[]>();
    entries.forEach((e) => {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    });
    return m;
  }, [entries]);

  const [picker, setPicker] = useState<{ date: number; slot: MealSlot; existing: MealPlanEntry | null } | null>(null);
  const pickerDeferred = useDeferredUnmount(picker, 320);

  const shiftWeek = (deltaDays: number) => setWeekStart(addDays(weekStart, deltaDays));
  const goToday = () => setWeekStart(startOfWeekMonday());

  const isCurrentWeek = weekStart === startOfWeekMonday();
  const weekRangeLabel = `${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))}`;

  return (
    <>
      <header className="view-header">
        <button type="button" className="icon-btn" onClick={() => shiftWeek(-7)} aria-label="Previous week">
          <Chevron dir="left" />
        </button>
        <h1 style={{ fontSize: "var(--fs-title)", fontWeight: 500 }}>{weekRangeLabel}</h1>
        <button type="button" className="icon-btn" onClick={() => shiftWeek(7)} aria-label="Next week">
          <Chevron dir="right" />
        </button>
      </header>

      {!isCurrentWeek ? (
        <div className="plan-jump-row">
          <button type="button" className="btn btn--ghost plan-jump-btn" onClick={goToday}>
            Jump to today
          </button>
        </div>
      ) : null}

      <div className="scroll-area">
        {days.map((day) => {
          const dayEntries = entriesByDay.get(day) ?? [];
          const isToday = isSameDay(day, today);
          return (
            <section key={day} className={`day-card ${isToday ? "day-card--today" : ""}`}>
              <header className="day-card__header">
                <div>
                  <span className={`day-card__weekday ${isToday ? "day-card__weekday--today" : ""}`}>
                    {new Date(day).toLocaleDateString(AU_LOCALE, { weekday: "long" })}
                  </span>
                  {isToday ? <span className="day-card__pill">Today</span> : null}
                </div>
                <span className="muted day-card__date">{formatShort(day)}</span>
              </header>
              <div className="slot-rows">
                {MEAL_SLOTS.map((slot, i) => {
                  const entry = dayEntries.find((e) => e.slot === slot) ?? null;
                  return (
                    <div key={slot}>
                      <SlotRow
                        slot={slot}
                        entry={entry}
                        meal={entry ? mealLookup.get(entry.mealId) : undefined}
                        onTap={() => setPicker({ date: day, slot, existing: entry })}
                      />
                      {i < MEAL_SLOTS.length - 1 ? <div className="slot-divider" /> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {pickerDeferred ? (
        <SlotMealPicker
          open={Boolean(picker)}
          onClose={() => setPicker(null)}
          date={pickerDeferred.date}
          slot={pickerDeferred.slot}
          existing={pickerDeferred.existing}
        />
      ) : null}
    </>
  );
}

interface SlotRowProps {
  slot: MealSlot;
  entry: MealPlanEntry | null;
  meal: Meal | undefined;
  onTap: () => void;
}

function SlotRow({ slot, entry, meal, onTap }: SlotRowProps) {
  const toggleEaten = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry?.id === undefined) return;
    await db.mealPlan.update(entry.id, { wasEaten: !entry.wasEaten });
  };

  return (
    <div className="slot-row">
      <button type="button" className="slot-row__main" onClick={onTap}>
        <span className="slot-row__label section-label">{MEAL_SLOT_LABEL[slot]}</span>
        {entry && meal ? (
          <span className={`slot-row__meal ${entry.wasEaten ? "slot-row__meal--eaten" : ""}`}>
            {meal.name}
            {entry.servings !== 1 ? (
              <span className="slot-row__servings muted"> × {entry.servings}</span>
            ) : null}
          </span>
        ) : (
          <span className="muted">Add meal</span>
        )}
      </button>
      {entry ? (
        <button
          type="button"
          className={`slot-row__check ${entry.wasEaten ? "slot-row__check--eaten" : ""}`}
          onClick={toggleEaten}
          aria-label={entry.wasEaten ? "Mark not eaten" : "Mark eaten"}
        >
          {entry.wasEaten ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </button>
      ) : null}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  const d = dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

