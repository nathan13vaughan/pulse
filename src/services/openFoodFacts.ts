import type { GroceryAisle, Ingredient } from "../models/Ingredient";

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
  const aisle = aisleFromCategoryTags(p.categories_tags ?? []);
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

/**
 * Aisle inference from OFF category tags.
 *
 * Word-boundary regex (not raw substring) so that:
 *   - `egg` doesn't match `eggplant`
 *   - `fish` correctly matches `fish-canned-in-water` without `water` winning
 *
 * Order matters — first match wins. Specific protein/dairy/produce types come
 * before generic location words like "frozen" / "water" so e.g. "tuna in water"
 * lands in meatSeafood, not beverages.
 */
const AISLE_PATTERNS: ReadonlyArray<readonly [RegExp, GroceryAisle]> = [
  // Proteins
  [/\bfish(es)?\b/, "meatSeafood"],
  [/\bseafoods?\b/, "meatSeafood"],
  [/\bsalmons?\b/, "meatSeafood"],
  [/\btunas?\b/, "meatSeafood"],
  [/\bsardines?\b/, "meatSeafood"],
  [/\banchov(y|ies)\b/, "meatSeafood"],
  [/\bprawns?\b/, "meatSeafood"],
  [/\bshrimps?\b/, "meatSeafood"],
  [/\bcrabs?\b/, "meatSeafood"],
  [/\bmeats?\b/, "meatSeafood"],
  [/\bpoultry\b/, "meatSeafood"],
  [/\bchickens?\b/, "meatSeafood"],
  [/\bbeef\b/, "meatSeafood"],
  [/\blambs?\b/, "meatSeafood"],
  [/\bporks?\b/, "meatSeafood"],
  [/\bsausages?\b/, "meatSeafood"],
  [/\bbacons?\b/, "meatSeafood"],
  [/\bham\b/, "meatSeafood"],

  // Dairy & eggs (egg pattern won't match eggplant)
  [/\bdair(y|ies)\b/, "dairyEggs"],
  [/\bmilks?\b/, "dairyEggs"],
  [/\byog(h?urts?)?\b/, "dairyEggs"],
  [/\bcheeses?\b/, "dairyEggs"],
  [/\bbutters?\b/, "dairyEggs"],
  [/\bcreams?\b/, "dairyEggs"],
  [/\beggs?\b/, "dairyEggs"],

  // Bakery
  [/\bbreads?\b/, "bakery"],
  [/\bbakery\b/, "bakery"],
  [/\bpastr(y|ies)\b/, "bakery"],
  [/\bcakes?\b/, "bakery"],
  [/\bmuffins?\b/, "bakery"],

  // Frozen before produce so "frozen vegetables" lands in frozen
  [/\bfrozen\b/, "frozen"],
  [/\bvegetables?\b/, "produce"],
  [/\bfruits?\b/, "produce"],
  [/\bberr(y|ies)\b/, "produce"],
  [/\bsalads?\b/, "produce"],

  // Pantry
  [/\bcereals?\b/, "pantry"],
  [/\bbreakfast\b/, "pantry"],
  [/\boats?\b/, "pantry"],
  [/\brice\b/, "pantry"],
  [/\bpastas?\b/, "pantry"],
  [/\bnoodles?\b/, "pantry"],
  [/\bflours?\b/, "pantry"],
  [/\bsugars?\b/, "pantry"],
  [/\bsnacks?\b/, "pantry"],
  [/\bbiscuits?\b/, "pantry"],
  [/\bcrackers?\b/, "pantry"],
  [/\blegumes?\b/, "pantry"],
  [/\bbeans?\b/, "pantry"],
  [/\blentils?\b/, "pantry"],
  [/\bchickpeas?\b/, "pantry"],
  [/\bnuts?\b/, "pantry"],
  [/\bseeds?\b/, "pantry"],
  [/\bjams?\b/, "pantry"],
  [/\bhoney\b/, "pantry"],

  // Condiments
  [/\bsauces?\b/, "condiments"],
  [/\bcondiments?\b/, "condiments"],
  [/\boils?\b/, "condiments"],
  [/\bvinegars?\b/, "condiments"],
  [/\bdressings?\b/, "condiments"],
  [/\bspreads?\b/, "condiments"],
  [/\bmayonnaise\b/, "condiments"],
  [/\bketchup\b/, "condiments"],
  [/\bmustards?\b/, "condiments"],

  // Spices & herbs
  [/\bherbs?\b/, "spices"],
  [/\bspices?\b/, "spices"],
  [/\bsalts?\b/, "spices"],
  [/\bpeppers?\b/, "spices"],

  // Beverages LAST so canned-in-water doesn't trump fish
  [/\bbeverages?\b/, "beverages"],
  [/\bdrinks?\b/, "beverages"],
  [/\bwaters?\b/, "beverages"],
  [/\bjuices?\b/, "beverages"],
  [/\bsodas?\b/, "beverages"],
  [/\bteas?\b/, "beverages"],
  [/\bcoffees?\b/, "beverages"],
  [/\bwines?\b/, "beverages"],
  [/\bbeers?\b/, "beverages"],
];

function aisleFromCategoryTags(tags: string[]): GroceryAisle {
  const haystack = tags.join(" ").toLowerCase();
  for (const [pattern, aisle] of AISLE_PATTERNS) {
    if (pattern.test(haystack)) return aisle;
  }
  return "other";
}
