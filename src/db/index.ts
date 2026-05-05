import Dexie, { type Table } from "dexie";
import type { BPReading } from "../models/BPReading";
import type { Ingredient } from "../models/Ingredient";
import type { Meal } from "../models/Meal";
import type { MealIngredient } from "../models/MealIngredient";
import type { MealPlanEntry } from "../models/MealPlanEntry";
import type { NotificationSchedule } from "../models/NotificationSchedule";
import type { GroceryCheck } from "../models/GroceryCheck";
import type { Goals } from "../models/Goals";
import { defaultGoals } from "../models/Goals";
import type { AISettings } from "../models/AISettings";

class PulseDB extends Dexie {
  readings!: Table<BPReading, number>;
  ingredients!: Table<Ingredient, number>;
  meals!: Table<Meal, number>;
  mealIngredients!: Table<MealIngredient, number>;
  mealPlan!: Table<MealPlanEntry, number>;
  notificationSchedules!: Table<NotificationSchedule, number>;
  groceryChecks!: Table<GroceryCheck, [number, number]>;
  goals!: Table<Goals, number>;
  aiSettings!: Table<AISettings, number>;

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

    // v3 — goals singleton (id always 1).
    this.version(3).stores({
      goals: "id",
    });

    // v4 — AI settings singleton (Groq key + cached response).
    this.version(4).stores({
      aiSettings: "id",
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

/** Read the singleton goals row, falling back to sensible AU defaults if unset. */
export async function getGoals(): Promise<Goals> {
  const stored = await db.goals.get(1);
  return stored ?? defaultGoals();
}

/** Persist the singleton goals row (always id=1). */
export async function saveGoals(goals: Omit<Goals, "id">): Promise<void> {
  await db.goals.put({ ...goals, id: 1 });
}

/** Read the singleton AI settings row, or empty defaults. */
export async function getAISettings(): Promise<AISettings> {
  return (await db.aiSettings.get(1)) ?? { id: 1 };
}

/** Patch a subset of AI settings, preserving the rest. */
export async function updateAISettings(patch: Partial<Omit<AISettings, "id">>): Promise<void> {
  const current = await getAISettings();
  await db.aiSettings.put({ ...current, ...patch, id: 1 });
}
