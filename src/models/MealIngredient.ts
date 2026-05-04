export type MeasurementUnit =
  | "g" | "kg"
  | "oz" | "lb"
  | "ml" | "l"
  | "tsp" | "tbsp" | "cup"
  | "pc";

export const UNITS: ReadonlyArray<MeasurementUnit> = [
  "g", "kg", "oz", "lb", "ml", "l", "tsp", "tbsp", "cup", "pc",
];

/** Approximate g (or ml→g for liquids assuming density ~1) per unit. */
export const GRAMS_PER_UNIT: Record<MeasurementUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  pc: 100,
};

export interface MealIngredient {
  id?: number;
  mealId: number;
  ingredientId: number;
  quantity: number;
  unit: MeasurementUnit;
}

export function gramsEquivalent(mi: Pick<MealIngredient, "quantity" | "unit">): number {
  return mi.quantity * GRAMS_PER_UNIT[mi.unit];
}
