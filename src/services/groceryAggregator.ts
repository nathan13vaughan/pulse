import type { Ingredient, GroceryAisle } from "../models/Ingredient";
import type { Meal } from "../models/Meal";
import type { MealIngredient } from "../models/MealIngredient";
import { gramsEquivalent } from "../models/MealIngredient";
import type { MealPlanEntry } from "../models/MealPlanEntry";
import { addTotals, scaleTotals, ZERO_TOTALS, type NutrientTotals } from "../models/NutrientTotals";
import { nutrientsPer100g } from "../models/Ingredient";

export interface GroceryLine {
  ingredient: Ingredient;
  totalGrams: number;
}

/** Aisles in typical Australian-supermarket shopping order. */
export const AISLE_SHOPPING_ORDER: ReadonlyArray<GroceryAisle> = [
  "produce", "meatSeafood", "dairyEggs", "bakery", "pantry",
  "condiments", "spices", "frozen", "beverages", "other",
];

export function displayQuantity(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)} kg`;
  return `${Math.round(grams)} g`;
}

export function lineNutrients(line: GroceryLine): NutrientTotals {
  return scaleTotals(nutrientsPer100g(line.ingredient), line.totalGrams / 100);
}

/**
 * Roll up meal-plan entries into deduplicated grocery lines.
 * Quantity per ingredient: `gramsEquivalent(mealIngredient) × (entry.servings ÷ meal.servings)`,
 * summed across all entries that include it.
 */
export function aggregate(input: {
  entries: MealPlanEntry[];
  meals: Map<number, Meal>;
  mealIngredients: Map<number, MealIngredient[]>; // keyed by mealId
  ingredients: Map<number, Ingredient>;
}): GroceryLine[] {
  const totals = new Map<number, { ingredient: Ingredient; grams: number }>();

  for (const entry of input.entries) {
    const meal = input.meals.get(entry.mealId);
    if (!meal) continue;

    const denom = Math.max(1, meal.servings);
    const scaling = entry.servings / denom;

    const items = input.mealIngredients.get(entry.mealId) ?? [];
    for (const mi of items) {
      const ingredient = input.ingredients.get(mi.ingredientId);
      if (!ingredient || ingredient.id === undefined) continue;

      const grams = gramsEquivalent(mi) * scaling;
      if (grams <= 0) continue;

      const existing = totals.get(ingredient.id);
      if (existing) {
        existing.grams += grams;
      } else {
        totals.set(ingredient.id, { ingredient, grams });
      }
    }
  }

  return Array.from(totals.values())
    .map(({ ingredient, grams }) => ({ ingredient, totalGrams: grams }))
    .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, "en-AU", { sensitivity: "base" }));
}

/** Group lines by aisle in shopping order. Empty aisles omitted. */
export function grouped(lines: GroceryLine[]): { aisle: GroceryAisle; lines: GroceryLine[] }[] {
  const map = new Map<GroceryAisle, GroceryLine[]>();
  for (const line of lines) {
    const arr = map.get(line.ingredient.aisle) ?? [];
    arr.push(line);
    map.set(line.ingredient.aisle, arr);
  }
  return AISLE_SHOPPING_ORDER
    .map((aisle) => ({ aisle, lines: map.get(aisle) ?? [] }))
    .filter((section) => section.lines.length > 0);
}

/** Total nutrients across the whole list — useful for an "estimated weekly intake" panel. */
export function totalsAcross(lines: GroceryLine[]): NutrientTotals {
  return lines.reduce<NutrientTotals>((acc, line) => addTotals(acc, lineNutrients(line)), { ...ZERO_TOTALS });
}
