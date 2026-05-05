import type { GroceryAisle } from "../models/Ingredient";

/**
 * Word-boundary regex patterns mapped to grocery aisles. Used by both:
 *   - The runtime barcode lookup (`openFoodFacts.ts`) — matched against OFF category tags.
 *   - The retroactive re-categorisation pass — matched against the ingredient's
 *     own name (and brand) for items already in IndexedDB whose aisle was set
 *     by the old buggy substring matcher.
 *
 * Order matters: first match wins. Specific food types come before generic
 * location/preparation words like "frozen" / "water" so e.g. "Tuna in
 * Springwater" lands in meatSeafood, not beverages.
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
  [/\bmince\b/, "meatSeafood"],

  // Dairy & eggs (egg pattern won't match eggplant)
  [/\bdair(y|ies)\b/, "dairyEggs"],
  [/\bmilks?\b/, "dairyEggs"],
  [/\byog(h?urts?)?\b/, "dairyEggs"],
  [/\bcheeses?\b/, "dairyEggs"],
  [/\bbutters?\b/, "dairyEggs"],
  [/\bcreams?\b/, "dairyEggs"],
  [/\beggs?\b/, "dairyEggs"],
  [/\bricotta\b/, "dairyEggs"],
  [/\bfeta\b/, "dairyEggs"],

  // Bakery
  [/\bbreads?\b/, "bakery"],
  [/\bbakery\b/, "bakery"],
  [/\bpastr(y|ies)\b/, "bakery"],
  [/\bcakes?\b/, "bakery"],
  [/\bmuffins?\b/, "bakery"],
  [/\bbagels?\b/, "bakery"],
  [/\brolls?\b/, "bakery"],
  [/\bbuns?\b/, "bakery"],
  [/\bcroissants?\b/, "bakery"],
  [/\bwraps?\b/, "bakery"],
  [/\btortillas?\b/, "bakery"],
  [/\bpitas?\b/, "bakery"],
  [/\bsourdough\b/, "bakery"],

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
  [/\bweet[\s-]?bix\b/, "pantry"],
  [/\bmuesli\b/, "pantry"],
  [/\bgranolas?\b/, "pantry"],
  [/\brice\b/, "pantry"],
  [/\bpastas?\b/, "pantry"],
  [/\bnoodles?\b/, "pantry"],
  [/\bspaghetti\b/, "pantry"],
  [/\bflours?\b/, "pantry"],
  [/\bsugars?\b/, "pantry"],
  [/\bsnacks?\b/, "pantry"],
  [/\bbiscuits?\b/, "pantry"],
  [/\bcrackers?\b/, "pantry"],
  [/\bchips?\b/, "pantry"],
  [/\blegumes?\b/, "pantry"],
  [/\bbeans?\b/, "pantry"],
  [/\blentils?\b/, "pantry"],
  [/\bchickpeas?\b/, "pantry"],
  [/\bnuts?\b/, "pantry"],
  [/\balmonds?\b/, "pantry"],
  [/\bcashews?\b/, "pantry"],
  [/\bwalnuts?\b/, "pantry"],
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
  [/\bvegemite\b/, "condiments"],
  [/\bpestos?\b/, "condiments"],
  [/\bhummus\b/, "condiments"],

  // Spices & herbs
  [/\bherbs?\b/, "spices"],
  [/\bspices?\b/, "spices"],
  [/\bsalts?\b/, "spices"],
  [/\bpeppers?\b/, "spices"],

  // Beverages — last so it doesn't vacuum up "tuna in springwater" etc.
  [/\bbeverages?\b/, "beverages"],
  [/\bdrinks?\b/, "beverages"],
  [/\bwaters?\b/, "beverages"],
  [/\bjuices?\b/, "beverages"],
  [/\bsodas?\b/, "beverages"],
  [/\bteas?\b/, "beverages"],
  [/\bcoffees?\b/, "beverages"],
  [/\bwines?\b/, "beverages"],
  [/\bbeers?\b/, "beverages"],
  [/\bsmoothies?\b/, "beverages"],
];

/** Infer aisle from OFF category tags (used at runtime barcode lookup). */
export function inferAisleFromTags(tags: string[]): GroceryAisle {
  const haystack = tags.join(" ").toLowerCase();
  for (const [pattern, aisle] of AISLE_PATTERNS) {
    if (pattern.test(haystack)) return aisle;
  }
  return "other";
}

/**
 * Infer aisle from an ingredient's display name + brand.
 * Returns null when nothing matches — caller decides whether to leave the
 * existing aisle alone or default to "other".
 */
export function inferAisleFromName(name: string, brand?: string): GroceryAisle | null {
  const haystack = `${brand ?? ""} ${name}`.toLowerCase();
  for (const [pattern, aisle] of AISLE_PATTERNS) {
    if (pattern.test(haystack)) return aisle;
  }
  return null;
}
