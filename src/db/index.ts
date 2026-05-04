import Dexie, { type Table } from "dexie";
import type { BPReading } from "../models/BPReading";
import type { Ingredient } from "../models/Ingredient";
import type { Meal } from "../models/Meal";
import type { MealIngredient } from "../models/MealIngredient";
import type { MealPlanEntry } from "../models/MealPlanEntry";
import type { NotificationSchedule } from "../models/NotificationSchedule";

class PulseDB extends Dexie {
  readings!: Table<BPReading, number>;
  ingredients!: Table<Ingredient, number>;
  meals!: Table<Meal, number>;
  mealIngredients!: Table<MealIngredient, number>;
  mealPlan!: Table<MealPlanEntry, number>;
  notificationSchedules!: Table<NotificationSchedule, number>;

  constructor() {
    super("pulse");

    // Index strategy:
    // - `++id` auto-increments primary keys
    // - secondary indexes only on fields we filter or sort by
    this.version(1).stores({
      readings: "++id, timestamp",
      ingredients: "++id, name, brand, barcode, publicFoodKey, aisle",
      meals: "++id, name, defaultSlot, *tags",
      mealIngredients: "++id, mealId, ingredientId",
      mealPlan: "++id, [date+slot], date, slot, mealId",
      notificationSchedules: "++id, type, isEnabled",
    });
  }
}

export const db = new PulseDB();
