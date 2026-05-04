import type { NutrientTotals } from "./NutrientTotals";

export type GroceryAisle =
  | "produce"
  | "meatSeafood"
  | "dairyEggs"
  | "bakery"
  | "pantry"
  | "frozen"
  | "beverages"
  | "condiments"
  | "spices"
  | "other";

export const AISLE_LABEL: Record<GroceryAisle, string> = {
  produce: "Produce",
  meatSeafood: "Meat & Seafood",
  dairyEggs: "Dairy & Eggs",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  beverages: "Beverages",
  condiments: "Condiments",
  spices: "Spices",
  other: "Other",
};

export interface Ingredient {
  id?: number;
  name: string;
  /** Manufacturer or store brand (e.g. "Coles", "Tip Top"). Nil for generic AUSNUT entries. */
  brand?: string;
  /** EAN/UPC barcode digits, for future barcode-scan lookup. */
  barcode?: string;
  /** AUSNUT 2011–13 Public Food Key. Nil for branded/user-added. */
  publicFoodKey?: string;
  aisle: GroceryAisle;
  /** All per-100g for normalisation. */
  energyKjPer100g: number;
  energyKcalPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
  fibreGPer100g: number;
  sodiumMgPer100g: number;
  potassiumMgPer100g: number;
  calciumMgPer100g: number;
  magnesiumMgPer100g: number;
}

export function ingredientDisplayName(ing: Ingredient): string {
  return ing.brand ? `${ing.brand} — ${ing.name}` : ing.name;
}

export function nutrientsPer100g(ing: Ingredient): NutrientTotals {
  return {
    energyKj: ing.energyKjPer100g,
    energyKcal: ing.energyKcalPer100g,
    proteinG: ing.proteinGPer100g,
    carbsG: ing.carbsGPer100g,
    fatG: ing.fatGPer100g,
    fibreG: ing.fibreGPer100g,
    sodiumMg: ing.sodiumMgPer100g,
    potassiumMg: ing.potassiumMgPer100g,
    calciumMg: ing.calciumMgPer100g,
    magnesiumMg: ing.magnesiumMgPer100g,
  };
}
