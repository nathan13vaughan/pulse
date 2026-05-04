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

/** Idempotent — only seeds when the ingredients table is empty. */
export async function importIfNeeded(): Promise<void> {
  const existing = await db.ingredients.count();
  if (existing > 0) return;

  const rows: Ingredient[] = [
    ...(ausnutData as ImportRow[]).map(rowToIngredient),
    ...(brandedData as ImportRow[]).map(rowToIngredient),
  ];

  await db.ingredients.bulkAdd(rows);
}
