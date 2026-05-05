import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { db } from "../../db";
import type { BPReading } from "../../models/BPReading";
import { categoryFor } from "../../models/BPReading";
import type { Meal } from "../../models/Meal";
import type { MealIngredient } from "../../models/MealIngredient";
import type { Ingredient } from "../../models/Ingredient";
import type { MealPlanEntry } from "../../models/MealPlanEntry";
import {
  buildPoints,
  leastSquares,
  stats as buildStats,
  strengthLabel,
  type InsightPoint,
} from "../../services/insightsAnalyzer";
import { useChartColors, type ChartColors } from "../../services/useChartColors";
import { NutritionFeedbackCard } from "./NutritionFeedbackCard";
import "./insights.css";

const RANGES = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "180d", label: "180D", days: 180 },
  { key: "all", label: "All", days: null as number | null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const WINDOWS: { value: number; label: string }[] = [
  { value: 1, label: "Same day" },
  { value: 3, label: "3-day avg" },
  { value: 7, label: "7-day avg" },
];

export default function InsightsView() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("90d");
  const [windowDays, setWindowDays] = useState<number>(3);
  const colors = useChartColors();

  const allReadings = useLiveQuery(
    () => db.readings.orderBy("timestamp").toArray(),
    [],
    [] as BPReading[],
  );

  const eatenEntries = useLiveQuery(
    () => db.mealPlan.filter((e) => e.wasEaten).toArray(),
    [],
    [] as MealPlanEntry[],
  );

  const filteredReadings = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days;
    if (days == null) return allReadings;
    const cutoff = Date.now() - days * 86_400_000;
    return allReadings.filter((r) => r.timestamp >= cutoff);
  }, [allReadings, rangeKey]);

  const detail = useLiveQuery(
    async () => {
      if (eatenEntries.length === 0) {
        return {
          meals: new Map<number, Meal>(),
          mealIngredients: new Map<number, MealIngredient[]>(),
          ingredients: new Map<number, Ingredient>(),
        };
      }
      const mealIds = Array.from(new Set(eatenEntries.map((e) => e.mealId)));
      const meals = await db.meals.bulkGet(mealIds);
      const mealMap = new Map<number, Meal>();
      meals.forEach((m) => { if (m && m.id !== undefined) mealMap.set(m.id, m); });

      const allMI = await db.mealIngredients.where("mealId").anyOf(mealIds).toArray();
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
    [eatenEntries],
    {
      meals: new Map<number, Meal>(),
      mealIngredients: new Map<number, MealIngredient[]>(),
      ingredients: new Map<number, Ingredient>(),
    },
  );

  const points: InsightPoint[] = useMemo(
    () => buildPoints({
      readings: filteredReadings,
      eatenEntries,
      meals: detail.meals,
      mealIngredients: detail.mealIngredients,
      ingredients: detail.ingredients,
      windowDays,
    }),
    [filteredReadings, eatenEntries, detail, windowDays],
  );

  return (
    <>
      <header className="view-header">
        <Link to="/" className="icon-btn" aria-label="Back to today">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1>Insights</h1>
        <span style={{ width: 32 }} />
      </header>

      <div className="scroll-area">
        <section className="card insights-controls">
          <div>
            <div className="section-label">Range</div>
            <div className="seg" style={{ marginTop: 4 }}>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`seg__btn ${rangeKey === r.key ? "seg__btn--active" : ""}`}
                  onClick={() => setRangeKey(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "var(--sp-sm)" }}>
            <div className="section-label">Lookback window</div>
            <div className="seg" style={{ marginTop: 4 }}>
              {WINDOWS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  className={`seg__btn ${windowDays === w.value ? "seg__btn--active" : ""}`}
                  onClick={() => setWindowDays(w.value)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {points.length === 0 ? (
          <section className="card">
            <div className="headline" style={{ fontSize: "var(--fs-title)" }}>
              Not enough joined data
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Insights pair BP readings with the meals you've ticked as eaten in the chosen
              lookback window. Log readings, plan meals, and tick them off — the signal will
              start to appear.
            </p>
          </section>
        ) : (
          <>
            <CorrelationCard
              title="Sodium ↔ Systolic"
              xLabel="Sodium (mg/day)"
              yLabel="Systolic (mmHg)"
              points={points}
              xKey="sodiumMg"
              higherIsBad={true}
              colors={colors}
            />
            <CorrelationCard
              title="Potassium ↔ Systolic"
              xLabel="Potassium (mg/day)"
              yLabel="Systolic (mmHg)"
              points={points}
              xKey="potassiumMg"
              higherIsBad={false}
              colors={colors}
            />
          </>
        )}

        <NutritionFeedbackCard />

        <p className="muted insights-disclaimer">
          Personal trend analysis only. This is your own n-of-1 data, not medical advice. Talk
          to your GP about anything you act on.
        </p>
      </div>
    </>
  );
}

interface CorrelationCardProps {
  title: string;
  xLabel: string;
  yLabel: string;
  points: InsightPoint[];
  xKey: "sodiumMg" | "potassiumMg";
  higherIsBad: boolean;
  colors: ChartColors;
}

function CorrelationCard({ title, xLabel, yLabel, points, xKey, higherIsBad, colors }: CorrelationCardProps) {
  const xs = points.map((p) => p[xKey]);
  const ys = points.map((p) => p.bpSystolic);
  const stats = buildStats(xs, ys);

  const dotColor = (category: ReturnType<typeof categoryFor>): string => {
    switch (category) {
      case "normal": return colors.accent;
      case "normalHigh": return colors.amber;
      default: return colors.warning;
    }
  };

  const scatterData = points.map((p) => ({
    x: p[xKey],
    y: p.bpSystolic,
    color: dotColor(categoryFor(p.bpSystolic, p.bpDiastolic)),
  }));

  const lineData = stats
    ? [
        { x: stats.xRange[0], y: leastSquares(xs, ys).slope * stats.xRange[0] + leastSquares(xs, ys).intercept },
        { x: stats.xRange[1], y: leastSquares(xs, ys).slope * stats.xRange[1] + leastSquares(xs, ys).intercept },
      ]
    : [];

  return (
    <section className="card insights-card">
      <h2 className="headline" style={{ fontSize: "var(--fs-title)", margin: 0 }}>{title}</h2>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid stroke={colors.grid} />
            <XAxis
              type="number"
              dataKey="x"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11, fill: colors.muted }}
              stroke={colors.grid}
              label={{ value: xLabel, position: "insideBottom", offset: -10, fontSize: 11, fill: colors.muted }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={["dataMin - 5", "dataMax + 5"]}
              tick={{ fontSize: 11, fill: colors.muted }}
              stroke={colors.grid}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: colors.grid }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "0.5px solid var(--color-border)",
                borderRadius: "var(--r-sm)",
                fontSize: "var(--fs-caption)",
              }}
              formatter={(value: number, name: string) => [Math.round(value), name === "x" ? xLabel : yLabel]}
            />
            <Scatter data={scatterData} dataKey="y" isAnimationActive={false}>
              {scatterData.map((p, i) => (
                <Cell key={i} fill={p.color} />
              ))}
            </Scatter>
            {lineData.length === 2 ? (
              <Line
                data={lineData}
                dataKey="y"
                stroke={colors.accent}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {stats ? (
        <>
          <div className="insights-stats">
            <Pill label="n" value={String(stats.n)} />
            <Pill
              label="r"
              value={(stats.r >= 0 ? "+" : "") + stats.r.toFixed(2)}
              tone={pillTone(stats.r, higherIsBad)}
            />
            <Pill label="mean Y" value={String(Math.round(stats.meanY))} />
          </div>
          <p className="muted insights-narrative">
            {narrative(stats.n, stats.r, higherIsBad)}
          </p>
        </>
      ) : null}
    </section>
  );
}

function pillTone(r: number, higherIsBad: boolean): "warn" | "accent" | "normal" {
  if (Math.abs(r) < 0.2) return "normal";
  const directionMatchesBad = r > 0 === higherIsBad;
  return directionMatchesBad ? "warn" : "accent";
}

function narrative(n: number, r: number, higherIsBad: boolean): string {
  if (n < 5) {
    return `Only ${n} overlapping readings — too few to read into the trend yet.`;
  }
  if (Math.abs(r) < 0.2) {
    return "No clear relationship in your data so far.";
  }
  const strength = strengthLabel(r);
  const trendIsBad = r > 0 === higherIsBad;
  const intakeWord = higherIsBad ? "Higher" : "Lower";
  const direction = trendIsBad ? "tend to come with higher BP" : "tend to come with lower BP";
  return `${capitalise(strength)} signal: ${intakeWord} intake days ${direction}.`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Pill({ label, value, tone = "normal" }: { label: string; value: string; tone?: "warn" | "accent" | "normal" }) {
  return (
    <div className="insights-pill">
      <div className="section-label">{label}</div>
      <div className={`mono insights-pill__value insights-pill__value--${tone}`}>{value}</div>
    </div>
  );
}
