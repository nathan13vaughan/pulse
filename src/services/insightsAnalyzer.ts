import type { BPReading } from "../models/BPReading";
import { categoryFor, type BPCategory } from "../models/BPReading";
import type { Ingredient } from "../models/Ingredient";
import { nutrientsPer100g } from "../models/Ingredient";
import type { Meal } from "../models/Meal";
import type { MealIngredient } from "../models/MealIngredient";
import { gramsEquivalent } from "../models/MealIngredient";
import type { MealPlanEntry } from "../models/MealPlanEntry";
import { addTotals, divideTotals, scaleTotals, ZERO_TOTALS, type NutrientTotals } from "../models/NutrientTotals";
import { startOfDay, addDays } from "./dateUtils";

export interface InsightPoint {
  /** ms */
  date: number;
  bpSystolic: number;
  bpDiastolic: number;
  sodiumMg: number;
  potassiumMg: number;
  category: BPCategory;
}

export interface RegressionLine {
  slope: number;
  intercept: number;
}

export interface InsightStats {
  n: number;
  /** Pearson correlation, -1…1. */
  r: number;
  regression: RegressionLine;
  meanX: number;
  meanY: number;
  /** [min, max] of x values, guaranteed non-zero width for plotting. */
  xRange: [number, number];
}

function entryNutrients(
  entry: MealPlanEntry,
  meals: Map<number, Meal>,
  mealIngredients: Map<number, MealIngredient[]>,
  ingredients: Map<number, Ingredient>,
): NutrientTotals {
  const meal = meals.get(entry.mealId);
  if (!meal) return { ...ZERO_TOTALS };

  const items = mealIngredients.get(entry.mealId) ?? [];
  const totalForMeal = items.reduce<NutrientTotals>((acc, mi) => {
    const ingredient = ingredients.get(mi.ingredientId);
    if (!ingredient) return acc;
    const grams = gramsEquivalent(mi);
    const contribution = scaleTotals(nutrientsPer100g(ingredient), grams / 100);
    return addTotals(acc, contribution);
  }, { ...ZERO_TOTALS });

  const perServing = divideTotals(totalForMeal, Math.max(1, meal.servings));
  return scaleTotals(perServing, entry.servings);
}

/**
 * Build insight points by joining each BP reading with the rolling-window
 * average of *eaten* daily nutrient intake ending on the reading's day.
 * Default window 3 days — smooths daily variance without burying lag.
 */
export function buildPoints(input: {
  readings: BPReading[];
  eatenEntries: MealPlanEntry[];
  meals: Map<number, Meal>;
  mealIngredients: Map<number, MealIngredient[]>;
  ingredients: Map<number, Ingredient>;
  windowDays?: number;
}): InsightPoint[] {
  const windowDays = input.windowDays ?? 3;

  // Sum eaten entries' nutrient contributions per start-of-day for O(1) lookup.
  const byDay = new Map<number, NutrientTotals>();
  for (const entry of input.eatenEntries) {
    const day = entry.date; // already start-of-day
    const existing = byDay.get(day) ?? { ...ZERO_TOTALS };
    byDay.set(day, addTotals(existing, entryNutrients(entry, input.meals, input.mealIngredients, input.ingredients)));
  }

  const points: InsightPoint[] = [];
  for (const reading of input.readings) {
    const day = startOfDay(reading.timestamp);
    let total: NutrientTotals = { ...ZERO_TOTALS };
    let daysWithData = 0;
    for (let offset = 0; offset < windowDays; offset++) {
      const d = addDays(day, -offset);
      const dayTotals = byDay.get(d);
      if (dayTotals) {
        total = addTotals(total, dayTotals);
        daysWithData += 1;
      }
    }
    if (daysWithData === 0) continue;
    const avg = divideTotals(total, daysWithData);
    points.push({
      date: reading.timestamp,
      bpSystolic: reading.systolic,
      bpDiastolic: reading.diastolic,
      sodiumMg: avg.sodiumMg,
      potassiumMg: avg.potassiumMg,
      category: categoryFor(reading.systolic, reading.diastolic),
    });
  }

  return points;
}

/** Pearson correlation. Returns 0 for n < 2 or zero-variance series. */
export function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, sx2 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    sx2 += dx * dx;
    sy2 += dy * dy;
  }
  const denom = Math.sqrt(sx2 * sy2);
  return denom === 0 ? 0 : num / denom;
}

/** OLS linear regression. Returns slope=0, intercept=meanY for degenerate cases. */
export function leastSquares(xs: number[], ys: number[]): RegressionLine {
  if (xs.length !== ys.length || xs.length < 2) {
    return { slope: 0, intercept: ys[0] ?? 0 };
  }
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    num += dx * (ys[i]! - meanY);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

export function stats(xs: number[], ys: number[]): InsightStats | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const r = pearson(xs, ys);
  const regression = leastSquares(xs, ys);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return { n, r, regression, meanX, meanY, xRange: [lo, Math.max(hi, lo + 1)] };
}

export function strengthLabel(r: number): "minimal" | "weak" | "moderate" | "strong" {
  const m = Math.abs(r);
  if (m >= 0.7) return "strong";
  if (m >= 0.4) return "moderate";
  if (m >= 0.2) return "weak";
  return "minimal";
}
