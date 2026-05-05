import { db } from "../db";
import type { GroceryAisle, Ingredient } from "../models/Ingredient";
import ausnutData from "../data/ausnut_foods.json";
import brandedData from "../data/branded_foods.json";

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
