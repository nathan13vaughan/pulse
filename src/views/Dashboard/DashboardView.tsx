import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { categoryFor, type BPReading } from "../../models/BPReading";
import { defaultGoals, type Goals } from "../../models/Goals";
import { CategoryBadge } from "../../components/CategoryBadge";
import { LargeTitlePage } from "../../components/LargeTitlePage";
import { BPLogModal } from "../BP/BPLogModal";
import {
  formatDateTime,
  formatLong,
  formatTime,
  isSameDay,
  startOfDay,
  addDays,
} from "../../services/dateUtils";
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type Meal } from "../../models/Meal";
import type { MealPlanEntry } from "../../models/MealPlanEntry";
import type { MealIngredient } from "../../models/MealIngredient";
import type { Ingredient } from "../../models/Ingredient";
import { gramsEquivalent } from "../../models/MealIngredient";
import { nutrientsPer100g } from "../../models/Ingredient";
import {
  ZERO_TOTALS,
  addTotals,
  divideTotals,
  scaleTotals,
  type NutrientTotals,
} from "../../models/NutrientTotals";
import "./dashboard.css";

export default function DashboardView() {
  const todayStart = startOfDay();
  const sevenDaysAgo = addDays(todayStart, -6); // rolling 7-day window incl today
  const oneDayAhead = addDays(todayStart, 1);

  const readings = useLiveQuery(
    () => db.readings.orderBy("timestamp").reverse().toArray(),
    [],
    [] as BPReading[],
  );

  const goals: Goals = useLiveQuery(() => db.goals.get(1), [], undefined) ?? defaultGoals();

  const todayReadings = useMemo(
    () => readings.filter((r) => isSameDay(r.timestamp, todayStart)),
    [readings, todayStart],
  );

  const weekReadings = useMemo(() => {
    const cutoff = sevenDaysAgo;
    return readings.filter((r) => r.timestamp >= cutoff);
  }, [readings, sevenDaysAgo]);

  const planEntries = useLiveQuery(
    () => db.mealPlan.where("date").between(sevenDaysAgo, oneDayAhead, true, false).toArray(),
    [sevenDaysAgo, oneDayAhead],
    [] as MealPlanEntry[],
  );

  const todayPlan = useMemo(
    () => planEntries.filter((e) => e.date === todayStart),
    [planEntries, todayStart],
  );

  const eatenWeek = useMemo(
    () => planEntries.filter((e) => e.wasEaten),
    [planEntries],
  );

  // Look up meals + their ingredients to compute weekly intake totals.
  const weekTotals = useWeeklyEatenTotals(eatenWeek);

  const dailyAvg = divideTotals(weekTotals, 7);
  const sodiumWarn = dailyAvg.sodiumMg > 2000;

  const [logOpen, setLogOpen] = useState(false);

  return (
    <LargeTitlePage title="Today">
      <div className="dash-stack">
          <div>
            <div className="dash-greeting">{greeting()}</div>
            <div className="muted dash-date">{formatLong(todayStart)}</div>
          </div>

          <TodayBPCard
            todayReadings={todayReadings}
            onLog={() => setLogOpen(true)}
          />

          <WeekAveragesCard readings={weekReadings} goals={goals} />

          <TodayPlanCard
            entries={todayPlan}
            mealsById={useMealsById(todayPlan.map((e) => e.mealId))}
          />

          {eatenWeek.length > 0 ? (
            <section className="card">
              <div className="section-label">Eaten this week (daily avg)</div>
              <div className="dash-metrics">
                <Stat title="kJ" value={Math.round(dailyAvg.energyKj)} />
                <Stat
                  title="Sodium"
                  value={`${Math.round(dailyAvg.sodiumMg)} mg`}
                  warn={
                    goals.targetSodiumMg !== undefined
                      ? dailyAvg.sodiumMg > goals.targetSodiumMg
                      : sodiumWarn
                  }
                />
                <Stat
                  title="Potassium"
                  value={`${Math.round(dailyAvg.potassiumMg)} mg`}
                  warn={
                    goals.targetPotassiumMg !== undefined &&
                    dailyAvg.potassiumMg < goals.targetPotassiumMg
                  }
                />
              </div>
              {(goals.targetSodiumMg !== undefined || goals.targetPotassiumMg !== undefined) ? (
                <p className="muted dash-goal-line">
                  Goal:{" "}
                  {goals.targetSodiumMg !== undefined ? `Na ≤ ${goals.targetSodiumMg} mg` : null}
                  {goals.targetSodiumMg !== undefined && goals.targetPotassiumMg !== undefined ? " · " : null}
                  {goals.targetPotassiumMg !== undefined ? `K ≥ ${goals.targetPotassiumMg} mg` : null}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="card">
              <div className="section-label">Eaten this week</div>
              <p className="muted" style={{ margin: "var(--sp-xs) 0 0" }}>
                Tick meals as eaten on the Plan tab to see your intake here.
              </p>
            </section>
          )}

          <Link to="/insights" className="card dash-insights-link">
            <div>
              <div style={{ fontSize: "var(--fs-headline)", fontWeight: 600 }}>Insights</div>
              <div className="muted" style={{ fontSize: "var(--fs-caption)" }}>
                Sodium and potassium correlations with your BP
              </div>
            </div>
            <ChevronRight />
          </Link>

          <Link to="/tips" className="card dash-insights-link">
            <div>
              <div style={{ fontSize: "var(--fs-headline)", fontWeight: 600 }}>Lifestyle tips</div>
              <div className="muted" style={{ fontSize: "var(--fs-caption)" }}>
                General BP-management info from Heart Foundation Australia
              </div>
            </div>
            <ChevronRight />
          </Link>
        </div>

      <BPLogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </LargeTitlePage>
  );
}

function TodayBPCard({
  todayReadings,
  onLog,
}: {
  todayReadings: BPReading[];
  onLog: () => void;
}) {
  const latest = todayReadings[0];
  return (
    <section className="card">
      <div className="section-label">Today's BP</div>
      {latest ? (
        <>
          <div className="dash-bp-numbers">
            <span className="mono dash-bp-sys">{latest.systolic}</span>
            <span className="dash-bp-slash">/</span>
            <span className="mono dash-bp-dia">{latest.diastolic}</span>
            <span className="dash-bp-unit">mmHg</span>
          </div>
          <div className="dash-bp-meta">
            <CategoryBadge category={categoryFor(latest.systolic, latest.diastolic)} />
            <span className="muted" style={{ fontSize: "var(--fs-caption)" }}>
              ·{" "}
              {todayReadings.length > 1
                ? `${todayReadings.length} readings · last ${formatTime(latest.timestamp)}`
                : formatDateTime(latest.timestamp)}
            </span>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: "var(--fs-headline)", fontWeight: 600, marginTop: "var(--sp-xs)" }}>
            No reading yet today
          </div>
          <button type="button" className="btn btn--ghost dash-bp-log" onClick={onLog}>
            <PlusIcon /> Log a reading
          </button>
        </>
      )}
    </section>
  );
}

function WeekAveragesCard({ readings, goals }: { readings: BPReading[]; goals: Goals }) {
  if (readings.length === 0) {
    return (
      <section className="card">
        <div className="section-label">Last 7 days</div>
        <p className="muted" style={{ margin: "var(--sp-xs) 0 0" }}>
          No readings logged this week.
        </p>
        {goals.targetReadingsPerWeek !== undefined ? (
          <p className="muted dash-goal-line">
            Goal: {goals.targetReadingsPerWeek} readings / week
          </p>
        ) : null}
      </section>
    );
  }
  const sysAvg = Math.round(readings.reduce((a, r) => a + r.systolic, 0) / readings.length);
  const diaAvg = Math.round(readings.reduce((a, r) => a + r.diastolic, 0) / readings.length);
  const sysWarn = goals.targetSystolic !== undefined && sysAvg > goals.targetSystolic;
  const diaWarn = goals.targetDiastolic !== undefined && diaAvg > goals.targetDiastolic;
  const readsWarn =
    goals.targetReadingsPerWeek !== undefined && readings.length < goals.targetReadingsPerWeek;

  const goalParts: string[] = [];
  if (goals.targetSystolic !== undefined && goals.targetDiastolic !== undefined) {
    goalParts.push(`BP < ${goals.targetSystolic}/${goals.targetDiastolic}`);
  } else if (goals.targetSystolic !== undefined) {
    goalParts.push(`Sys < ${goals.targetSystolic}`);
  } else if (goals.targetDiastolic !== undefined) {
    goalParts.push(`Dia < ${goals.targetDiastolic}`);
  }
  if (goals.targetReadingsPerWeek !== undefined) {
    goalParts.push(`${goals.targetReadingsPerWeek} readings / wk`);
  }

  return (
    <section className="card">
      <div className="section-label">Last 7 days</div>
      <div className="dash-metrics">
        <Stat title="Avg sys" value={sysAvg} warn={sysWarn} />
        <Stat title="Avg dia" value={diaAvg} warn={diaWarn} />
        <Stat title="Readings" value={readings.length} warn={readsWarn} />
      </div>
      {goalParts.length > 0 ? (
        <p className="muted dash-goal-line">Goal: {goalParts.join(" · ")}</p>
      ) : null}
    </section>
  );
}

function TodayPlanCard({
  entries,
  mealsById,
}: {
  entries: MealPlanEntry[];
  mealsById: Map<number, Meal>;
}) {
  return (
    <section className="card">
      <div className="section-label">Today's plan</div>
      {entries.length === 0 ? (
        <p className="muted" style={{ margin: "var(--sp-xs) 0 0" }}>
          Nothing planned. Build out the week from the Plan tab.
        </p>
      ) : (
        <ul className="dash-plan-list">
          {MEAL_SLOTS.map((slot) => {
            const entry = entries.find((e) => e.slot === slot);
            const meal = entry ? mealsById.get(entry.mealId) : undefined;
            return (
              <li key={slot} className="dash-plan-row">
                <span className="dash-plan-slot section-label">{MEAL_SLOT_LABEL[slot]}</span>
                {entry && meal ? (
                  <>
                    <span
                      className={`dash-plan-meal ${entry.wasEaten ? "dash-plan-meal--eaten" : ""}`}
                    >
                      {meal.name}
                    </span>
                    {entry.wasEaten ? (
                      <CheckIcon />
                    ) : null}
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({ title, value, warn }: { title: string; value: string | number; warn?: boolean }) {
  return (
    <div>
      <div className="section-label">{title}</div>
      <div className={`mono dash-stat-value ${warn ? "dash-stat-value--warn" : ""}`}>{value}</div>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Hello";
}

function useMealsById(ids: number[]): Map<number, Meal> {
  return useLiveQuery(
    async () => {
      if (ids.length === 0) return new Map<number, Meal>();
      const rows = await db.meals.bulkGet(ids);
      const m = new Map<number, Meal>();
      rows.forEach((r) => { if (r && r.id !== undefined) m.set(r.id, r); });
      return m;
    },
    [ids.join(",")], // stable key
    new Map<number, Meal>(),
  );
}

function useWeeklyEatenTotals(entries: MealPlanEntry[]): NutrientTotals {
  // Pull every meal + ingredient + ingredient-row referenced by these entries
  // and compute total nutrient intake. Recomputed live as DB changes.
  const detail = useLiveQuery(
    async () => {
      if (entries.length === 0) {
        return {
          meals: new Map<number, Meal>(),
          mealIngredients: new Map<number, MealIngredient[]>(),
          ingredients: new Map<number, Ingredient>(),
        };
      }
      const mealIds = Array.from(new Set(entries.map((e) => e.mealId)));
      const meals = await db.meals.bulkGet(mealIds);
      const mealMap = new Map<number, Meal>();
      meals.forEach((m) => { if (m && m.id !== undefined) mealMap.set(m.id, m); });

      const allMI = mealIds.length > 0
        ? await db.mealIngredients.where("mealId").anyOf(mealIds).toArray()
        : [];
      const miMap = new Map<number, MealIngredient[]>();
      for (const mi of allMI) {
        const arr = miMap.get(mi.mealId) ?? [];
        arr.push(mi);
        miMap.set(mi.mealId, arr);
      }

      const ingIds = Array.from(new Set(allMI.map((mi) => mi.ingredientId)));
      const ings = ingIds.length > 0 ? await db.ingredients.bulkGet(ingIds) : [];
      const ingMap = new Map<number, Ingredient>();
      ings.forEach((i) => { if (i && i.id !== undefined) ingMap.set(i.id, i); });

      return { meals: mealMap, mealIngredients: miMap, ingredients: ingMap };
    },
    [entries],
    {
      meals: new Map<number, Meal>(),
      mealIngredients: new Map<number, MealIngredient[]>(),
      ingredients: new Map<number, Ingredient>(),
    },
  );

  return useMemo(() => {
    return entries.reduce<NutrientTotals>((acc, entry) => {
      const meal = detail.meals.get(entry.mealId);
      if (!meal) return acc;
      const items = detail.mealIngredients.get(entry.mealId) ?? [];
      const totalForMeal = items.reduce<NutrientTotals>((mAcc, mi) => {
        const ing = detail.ingredients.get(mi.ingredientId);
        if (!ing) return mAcc;
        const grams = gramsEquivalent(mi);
        return addTotals(mAcc, scaleTotals(nutrientsPer100g(ing), grams / 100));
      }, { ...ZERO_TOTALS });
      const perServing = divideTotals(totalForMeal, Math.max(1, meal.servings));
      return addTotals(acc, scaleTotals(perServing, entry.servings));
    }, { ...ZERO_TOTALS });
  }, [entries, detail]);
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--color-accent)", marginLeft: "auto" }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
