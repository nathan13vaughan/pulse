import type { MealSlot } from "./Meal";

export interface MealPlanEntry {
  id?: number;
  /** epoch ms at start of day. Use `startOfDay()` from utils when constructing. */
  date: number;
  slot: MealSlot;
  mealId: number;
  servings: number;
  wasEaten: boolean;
}
