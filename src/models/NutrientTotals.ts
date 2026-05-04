export interface NutrientTotals {
  energyKj: number;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  sodiumMg: number;
  potassiumMg: number;
  calciumMg: number;
  magnesiumMg: number;
}

export const NUTRIENT_KEYS: ReadonlyArray<keyof NutrientTotals> = [
  "energyKj",
  "energyKcal",
  "proteinG",
  "carbsG",
  "fatG",
  "fibreG",
  "sodiumMg",
  "potassiumMg",
  "calciumMg",
  "magnesiumMg",
];

export const ZERO_TOTALS: NutrientTotals = {
  energyKj: 0,
  energyKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fibreG: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  calciumMg: 0,
  magnesiumMg: 0,
};

export function addTotals(a: NutrientTotals, b: NutrientTotals): NutrientTotals {
  const out = { ...ZERO_TOTALS };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] + b[k];
  return out;
}

export function divideTotals(a: NutrientTotals, divisor: number): NutrientTotals {
  if (divisor === 0) return { ...ZERO_TOTALS };
  const out = { ...ZERO_TOTALS };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] / divisor;
  return out;
}

export function scaleTotals(a: NutrientTotals, factor: number): NutrientTotals {
  const out = { ...ZERO_TOTALS };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] * factor;
  return out;
}
