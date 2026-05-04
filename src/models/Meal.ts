export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const MEAL_SLOTS: ReadonlyArray<MealSlot> = ["breakfast", "lunch", "dinner", "snack"];

export interface Meal {
  id?: number;
  name: string;
  tags: string[];
  servings: number;
  defaultSlot: MealSlot;
  notes?: string;
}
