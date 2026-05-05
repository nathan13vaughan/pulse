import { db } from "../db";
import type { BPReading } from "../models/BPReading";
import type { Ingredient } from "../models/Ingredient";
import type { Meal } from "../models/Meal";
import type { MealIngredient } from "../models/MealIngredient";
import type { MealPlanEntry } from "../models/MealPlanEntry";
import type { NotificationSchedule } from "../models/NotificationSchedule";
import type { GroceryCheck } from "../models/GroceryCheck";
import type { Goals } from "../models/Goals";
import type { AISettings } from "../models/AISettings";

/**
 * Versioned wire format for backups.
 *  - v1: original tables
 *  - v2: + groceryChecks
 *  - v3: + goals (singleton)
 *  - v4: + AI cached response (the API key itself is intentionally excluded
 *        from exports so a shared backup can't leak credentials)
 *
 * Older backups still import; missing fields are treated as empty.
 */
export const EXPORT_VERSION = 4;

export interface PulseExport {
  version: number;
  exportedAt: string;
  readings: BPReading[];
  ingredients: Ingredient[];
  meals: Meal[];
  mealIngredients: MealIngredient[];
  mealPlan: MealPlanEntry[];
  notificationSchedules: NotificationSchedule[];
  groceryChecks?: GroceryCheck[]; // v2+
  goals?: Goals[];                // v3+ (always 0 or 1 row)
  /** v4+. API key is stripped before export so it can't leak via shared files. */
  aiSettings?: AISettings[];
}

export async function gatherExport(): Promise<PulseExport> {
  const [readings, ingredients, meals, mealIngredients, mealPlan, notificationSchedules, groceryChecks, goals, aiSettings] =
    await Promise.all([
      db.readings.toArray(),
      db.ingredients.toArray(),
      db.meals.toArray(),
      db.mealIngredients.toArray(),
      db.mealPlan.toArray(),
      db.notificationSchedules.toArray(),
      db.groceryChecks.toArray(),
      db.goals.toArray(),
      db.aiSettings.toArray(),
    ]);
  // Strip the API key from the exported aiSettings — backup files might be
  // shared, sent to a GP, or end up in cloud storage; the key shouldn't follow.
  const sanitisedAi = aiSettings.map(({ groqApiKey: _drop, ...rest }) => rest);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    readings,
    ingredients,
    meals,
    mealIngredients,
    mealPlan,
    notificationSchedules,
    groceryChecks,
    goals,
    aiSettings: sanitisedAi,
  };
}

export async function downloadExport(): Promise<void> {
  const data = await gatherExport();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pulse-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Replace all data with the contents of an exported file.
 * Caller is responsible for confirming the wipe with the user first.
 */
export async function replaceFromExport(data: PulseExport): Promise<void> {
  if (data.version > EXPORT_VERSION) {
    throw new Error(
      `Backup is from a newer version (${data.version}); this app supports up to ${EXPORT_VERSION}.`,
    );
  }
  // Preserve the existing API key — backups don't carry it, but a restore
  // shouldn't wipe one the user just typed in either.
  const existingApiKey = (await db.aiSettings.get(1))?.groqApiKey;

  await db.transaction(
    "rw",
    [
      db.readings, db.ingredients, db.meals, db.mealIngredients,
      db.mealPlan, db.notificationSchedules, db.groceryChecks, db.goals, db.aiSettings,
    ],
    async () => {
      await Promise.all([
        db.readings.clear(),
        db.ingredients.clear(),
        db.meals.clear(),
        db.mealIngredients.clear(),
        db.mealPlan.clear(),
        db.notificationSchedules.clear(),
        db.groceryChecks.clear(),
        db.goals.clear(),
        db.aiSettings.clear(),
      ]);
      // Preserve all IDs so foreign-key references (mealId, ingredientId)
      // stay valid. Tables were just cleared, so collisions aren't possible.
      await Promise.all([
        db.readings.bulkAdd(data.readings),
        db.ingredients.bulkAdd(data.ingredients),
        db.meals.bulkAdd(data.meals),
        db.mealIngredients.bulkAdd(data.mealIngredients),
        db.mealPlan.bulkAdd(data.mealPlan),
        db.notificationSchedules.bulkAdd(data.notificationSchedules),
        db.groceryChecks.bulkAdd(data.groceryChecks ?? []),
        db.goals.bulkAdd(data.goals ?? []),
        db.aiSettings.bulkAdd(
          (data.aiSettings ?? []).map((row) => ({ ...row, groqApiKey: existingApiKey })),
        ),
      ]);
    },
  );
}

export async function readImportFile(file: File): Promise<PulseExport> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (!isPulseExport(parsed)) {
    throw new Error("File doesn't look like a Pulse backup.");
  }
  return parsed;
}

function isPulseExport(v: unknown): v is PulseExport {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.version === "number" &&
    Array.isArray(obj.readings) &&
    Array.isArray(obj.ingredients) &&
    Array.isArray(obj.meals) &&
    Array.isArray(obj.mealIngredients) &&
    Array.isArray(obj.mealPlan) &&
    Array.isArray(obj.notificationSchedules)
  );
}
