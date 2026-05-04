import Dexie, { type Table } from "dexie";
import type { BPReading } from "../models/BPReading";
import type { Ingredient } from "../models/Ingredient";
import type { Meal } from "../models/Meal";
import type { MealIngredient } from "../models/MealIngredient";
import type { MealPlanEntry } from "../models/MealPlanEntry";
import type { NotificationSchedule } from "../models/NotificationSchedule";
import type { GroceryCheck } from "../models/GroceryCheck";

class PulseDB extends Dexie {
  readings!: Table<BPReading, number>;
  ingredients!: Table<Ingredient, number>;
  meals!: Table<Meal, number>;
  mealIngredients!: Table<MealIngredient, number>;
  mealPlan!: Table<MealPlanEntry, number>;
  notificationSchedules!: Table<NotificationSchedule, number>;
  groceryChecks!: Table<GroceryCheck, [number, number]>;

  constructor() {
    super("pulse");

    this.version(1).stores({
      readings: "++id, timestamp",
      ingredients: "++id, name, brand, barcode, publicFoodKey, aisle",
      meals: "++id, name, defaultSlot, *tags",
      mealIngredients: "++id, mealId, ingredientId",
      mealPlan: "++id, [date+slot], date, slot, mealId",
      notificationSchedules: "++id, type, isEnabled",
    });

    // v2 — persistent grocery ticks per week.
    this.version(2).stores({
      groceryChecks: "[weekStart+ingredientId], weekStart, ingredientId",
    });
  }
}

export const db = new PulseDB();

/** Delete a meal and all its `MealIngredient` rows in one transaction. */
export async function deleteMealCascade(mealId: number): Promise<void> {
  await db.transaction("rw", db.meals, db.mealIngredients, async () => {
    await db.mealIngredients.where("mealId").equals(mealId).delete();
    await db.meals.delete(mealId);
  });
}
