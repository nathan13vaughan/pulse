import type { Ingredient } from "../models/Ingredient";
import { inferAisleFromTags } from "./aisleInference";

/**
 * Single-product lookup against Open Food Facts (open data, ODbL licence).
 * Returns an Ingredient ready to insert into IndexedDB, or null if not found
 * or required fields missing.
 *
 * Per CLAUDE.md, this is the only runtime API call the app makes.
 */
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number | undefined>;
}

interface OFFResponse {
  status?: number;
  product?: OFFProduct;
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Ingredient | null> {
  const url = `${OFF_BASE}/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_en,brands,categories_tags,nutriments`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      signal,
      headers: { "User-Agent": "Pulse/1.0 personal health tracker" },
    });
  } catch {
    return null;
  }
  if (!resp.ok) return null;

  const data = (await resp.json()) as OFFResponse;
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;

  const name = (p.product_name ?? p.product_name_en ?? "").trim();
  if (!name) return null;

  const brand = (p.brands ?? "").split(",")[0]?.trim() || undefined;
  const aisle = inferAisleFromTags(p.categories_tags ?? []);
  const n = p.nutriments ?? {};

  // OFF stores macronutrients in g/100g, sodium/potassium in g/100g (so * 1000 for mg).
  const sodiumG = numericOr(n["sodium_100g"], deriveSodiumFromSalt(numericOr(n["salt_100g"], 0)));
  const potassiumG = numericOr(n["potassium_100g"], 0);
  const calciumG = numericOr(n["calcium_100g"], 0);
  const magnesiumG = numericOr(n["magnesium_100g"], 0);

  return {
    name,
    brand,
    barcode: code,
    aisle,
    energyKjPer100g: roundTo(numericOr(n["energy-kj_100g"], 0), 1),
    energyKcalPer100g: roundTo(numericOr(n["energy-kcal_100g"], 0), 1),
    proteinGPer100g: roundTo(numericOr(n["proteins_100g"], 0), 2),
    carbsGPer100g: roundTo(numericOr(n["carbohydrates_100g"], 0), 2),
    fatGPer100g: roundTo(numericOr(n["fat_100g"], 0), 2),
    fibreGPer100g: roundTo(numericOr(n["fiber_100g"], 0), 2),
    sodiumMgPer100g: roundTo(sodiumG * 1000, 1),
    potassiumMgPer100g: roundTo(potassiumG * 1000, 1),
    calciumMgPer100g: roundTo(calciumG * 1000, 1),
    magnesiumMgPer100g: roundTo(magnesiumG * 1000, 1),
  };
}

function numericOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function deriveSodiumFromSalt(saltG: number): number {
  // Salt (NaCl) is ~39% sodium by mass.
  return saltG / 2.5;
}

function roundTo(value: number, places: number): number {
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

// Aisle inference is now centralised in `./aisleInference.ts` so the same
// regex priorities also drive the retroactive name-based re-categorisation.
