import { db } from "../db";
import type { GroceryAisle, Ingredient } from "../models/Ingredient";
import ausnutData from "../data/ausnut_foods.json";
import brandedData from "../data/branded_foods.json";
import { inferAisleFromName } from "./aisleInference";

interface ImportRow {
  key?: string;
  barcode?: string;
  brand?: string;
  name: string;
  aisle?: string;
  kj: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sodium: number;
  potassium: number;
  calcium: number;
  magnesium: number;
}

const AISLE_VALUES: ReadonlyArray<GroceryAisle> = [
  "produce", "meatSeafood", "dairyEggs", "bakery", "pantry",
  "frozen", "beverages", "condiments", "spices", "other",
];

/**
 * Bundle version. **Bump this whenever you expand `ausnut_foods.json` or
 * `branded_foods.json`** so existing installs pick up the new entries on next
 * launch without wiping their data. Existing rows are never modified — only
 * brand-new keys / barcodes get added.
 */
const BUNDLE_VERSION = 2;

const STORAGE_KEY = "pulse:lastImportedBundleVersion";

/**
 * Bumped when we want every device to re-run the name-based aisle
 * re-categorisation pass. Independent of bundle version.
 */
const RECATEGORISATION_VERSION = 1;
const RECAT_STORAGE_KEY = "pulse:lastRecategorisationVersion";

/** Aisles where the old buggy substring matcher dumped misclassified items.
    These are the only aisles the retroactive pass will re-write — anything
    already in produce/dairyEggs/etc is treated as user-trusted. */
const SUSPECT_AISLES: ReadonlyArray<GroceryAisle> = ["beverages", "frozen", "other"];

function parseAisle(raw?: string): GroceryAisle {
  if (raw && (AISLE_VALUES as readonly string[]).includes(raw)) return raw as GroceryAisle;
  return "other";
}

function rowToIngredient(row: ImportRow): Ingredient {
  return {
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    publicFoodKey: row.key,
    aisle: parseAisle(row.aisle),
    energyKjPer100g: row.kj,
    energyKcalPer100g: row.kcal,
    proteinGPer100g: row.protein,
    carbsGPer100g: row.carbs,
    fatGPer100g: row.fat,
    fibreGPer100g: row.fibre,
    sodiumMgPer100g: row.sodium,
    potassiumMgPer100g: row.potassium,
    calciumMgPer100g: row.calcium,
    magnesiumMgPer100g: row.magnesium,
  };
}

function getLastBundleVersion(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = parseInt(raw ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function setLastBundleVersion(v: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(v));
}

/**
 * Seed (first launch) or upsert (later launches with a newer bundle).
 *
 * - First launch (table empty): bulk-import everything.
 * - Later launches: if `BUNDLE_VERSION` exceeds the locally-recorded version,
 *   add only the entries whose Public Food Key (AUSNUT) or barcode (OFF) isn't
 *   already in the local DB. User-edited or user-added entries are preserved.
 *   Deleted entries do NOT come back unless the bundle version is bumped again
 *   AND the entry is still in the bundled JSON.
 */
export async function importIfNeeded(): Promise<void> {
  const ausnutRows = (ausnutData as ImportRow[]).map(rowToIngredient);
  const brandedRows = (brandedData as ImportRow[]).map(rowToIngredient);
  const all = [...ausnutRows, ...brandedRows];

  const existingCount = await db.ingredients.count();
  if (existingCount === 0) {
    await db.ingredients.bulkAdd(all);
    setLastBundleVersion(BUNDLE_VERSION);
    return;
  }

  const lastVersion = getLastBundleVersion();
  if (lastVersion >= BUNDLE_VERSION) return;

  // Upsert path: figure out which keys / barcodes the local DB is missing,
  // and bulk-add only those.
  const existing = await db.ingredients.toArray();
  const existingKeys = new Set(existing.map((i) => i.publicFoodKey).filter(Boolean));
  const existingBarcodes = new Set(existing.map((i) => i.barcode).filter(Boolean));

  const missing = all.filter((row) => {
    if (row.publicFoodKey && existingKeys.has(row.publicFoodKey)) return false;
    if (row.barcode && existingBarcodes.has(row.barcode)) return false;
    return true;
  });

  if (missing.length > 0) {
    await db.ingredients.bulkAdd(missing);
    console.log(`Imported ${missing.length} new ingredients from bundle v${BUNDLE_VERSION}.`);
  }
  setLastBundleVersion(BUNDLE_VERSION);
}

/**
 * One-time pass over existing ingredients to fix aisle miscategorisation done
 * by an older substring-based matcher (e.g. "tuna in springwater" landing in
 * beverages because of "water").
 *
 * Conservative — only re-aisles items currently sitting in known dumping-ground
 * aisles, and only when the inferred replacement is itself a *different*,
 * non-dumping-ground aisle. User-edited or correctly-categorised items aren't
 * touched.
 */
export async function recategoriseSuspectAisles(): Promise<void> {
  const lastVersion = parseInt(localStorage.getItem(RECAT_STORAGE_KEY) ?? "0", 10);
  if (Number.isFinite(lastVersion) && lastVersion >= RECATEGORISATION_VERSION) return;

  const suspects = await db.ingredients
    .where("aisle")
    .anyOf(SUSPECT_AISLES as unknown as string[])
    .toArray();

  let updated = 0;
  for (const ing of suspects) {
    if (ing.id === undefined) continue;
    const inferred = inferAisleFromName(ing.name, ing.brand);
    if (!inferred) continue;
    if (inferred === ing.aisle) continue;
    if (SUSPECT_AISLES.includes(inferred)) continue; // never demote into another dumping ground
    await db.ingredients.update(ing.id, { aisle: inferred });
    updated += 1;
  }

  localStorage.setItem(RECAT_STORAGE_KEY, String(RECATEGORISATION_VERSION));
  if (updated > 0) {
    console.log(`Re-categorised ${updated} ingredients from suspect aisles using their names.`);
  }
}
