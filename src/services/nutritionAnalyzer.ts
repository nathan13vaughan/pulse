import { db, getGoals } from "../db";
import { nutrientsPer100g } from "../models/Ingredient";
import { gramsEquivalent } from "../models/MealIngredient";
import {
  ZERO_TOTALS,
  addTotals,
  divideTotals,
  scaleTotals,
  type NutrientTotals,
} from "../models/NutrientTotals";
import { addDays, startOfDay } from "./dateUtils";
import { chatCompletion, type GroqMessage } from "./groq";

const WINDOW_DAYS = 14;

/** AU NHMRC adult Adequate Intake / suggested targets. Used as reference points
    in the prompt so the model has Australian guidelines, not US ones. */
const NHMRC = {
  fibreG: 30,         // AI for adult men; women 25g
  sodiumMgUpper: 2000, // suggested upper, ~5g salt
  potassiumMg: 3800,   // AI for adult men; women 2800
  calciumMg: 1000,     // RDI adults
  magnesiumMg: 400,    // RDI adult men; women 320
} as const;

const SYSTEM_PROMPT = `You are providing general nutrition observations on a user's recent food log. \
You are NOT a doctor and you do NOT give medical advice. \
You speak in plain, friendly English using Australian dietary references (NHMRC). \
Format your reply as plain text with three short paragraphs (no markdown, no asterisks, no bold): \
"Looking good", "Worth more attention", "Practical suggestions". \
Keep the whole response under 200 words. \
Never comment on weight, calorie deficit, or specific medical conditions. \
Never use the words "should", "must", or "need" — use "consider", "you might", "tends to". \
Suggest specific Australian foods (e.g. "kangaroo mince", "Weet-Bix", "tinned salmon"). \
If a nutrient is within 80% of the reference, treat it as fine.`;

export interface NutritionPromptData {
  daysWithData: number;
  dailyAvg: NutrientTotals;
  topMeals: { name: string; count: number }[];
  goals: {
    targetSodiumMg?: number;
    targetPotassiumMg?: number;
  };
}

/**
 * Pull the last 14 days of eaten meal-plan entries, compute daily nutrient
 * averages, and surface the most-frequent meal names.
 */
export async function gatherPromptData(): Promise<NutritionPromptData> {
  const today = startOfDay();
  const cutoff = addDays(today, -(WINDOW_DAYS - 1));

  const entries = await db.mealPlan
    .where("date")
    .between(cutoff, addDays(today, 1), true, false)
    .toArray();
  const eaten = entries.filter((e) => e.wasEaten);

  // Resolve all referenced meals + ingredients in bulk to avoid N queries.
  const mealIds = Array.from(new Set(eaten.map((e) => e.mealId)));
  const meals = mealIds.length === 0 ? [] : await db.meals.bulkGet(mealIds);
  const mealMap = new Map<number, { id: number; name: string; servings: number }>();
  meals.forEach((m) => {
    if (m && m.id !== undefined) mealMap.set(m.id, { id: m.id, name: m.name, servings: m.servings });
  });

  const allMI = mealIds.length === 0
    ? []
    : await db.mealIngredients.where("mealId").anyOf(mealIds).toArray();
  const miByMeal = new Map<number, typeof allMI>();
  for (const mi of allMI) {
    const arr = miByMeal.get(mi.mealId) ?? [];
    arr.push(mi);
    miByMeal.set(mi.mealId, arr);
  }

  const ingIds = Array.from(new Set(allMI.map((mi) => mi.ingredientId)));
  const ings = ingIds.length === 0 ? [] : await db.ingredients.bulkGet(ingIds);
  const ingMap = new Map<number, (typeof ings)[number] & object>();
  ings.forEach((ig) => { if (ig && ig.id !== undefined) ingMap.set(ig.id, ig); });

  // Sum nutrients per day.
  const perDay = new Map<number, NutrientTotals>();
  for (const entry of eaten) {
    const meal = mealMap.get(entry.mealId);
    if (!meal) continue;
    const items = miByMeal.get(entry.mealId) ?? [];
    const totalForMeal = items.reduce<NutrientTotals>((acc, mi) => {
      const ing = ingMap.get(mi.ingredientId);
      if (!ing) return acc;
      const grams = gramsEquivalent(mi);
      return addTotals(acc, scaleTotals(nutrientsPer100g(ing), grams / 100));
    }, { ...ZERO_TOTALS });
    const perServing = divideTotals(totalForMeal, Math.max(1, meal.servings));
    const contribution = scaleTotals(perServing, entry.servings);
    const existing = perDay.get(entry.date) ?? { ...ZERO_TOTALS };
    perDay.set(entry.date, addTotals(existing, contribution));
  }

  const daysWithData = perDay.size;
  const totalAcrossDays = Array.from(perDay.values()).reduce<NutrientTotals>(
    (a, b) => addTotals(a, b),
    { ...ZERO_TOTALS },
  );
  const dailyAvg = daysWithData === 0
    ? { ...ZERO_TOTALS }
    : divideTotals(totalAcrossDays, daysWithData);

  // Top meals by frequency.
  const counts = new Map<string, number>();
  for (const entry of eaten) {
    const name = mealMap.get(entry.mealId)?.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const topMeals = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const goals = await getGoals();

  return {
    daysWithData,
    dailyAvg,
    topMeals,
    goals: {
      targetSodiumMg: goals.targetSodiumMg,
      targetPotassiumMg: goals.targetPotassiumMg,
    },
  };
}

export function buildUserPrompt(data: NutritionPromptData): string {
  const { dailyAvg, daysWithData, topMeals, goals } = data;
  const round = (n: number) => Math.round(n);

  const lines: string[] = [
    `Last ${WINDOW_DAYS} days of eaten meals (averages per day across ${daysWithData} day${daysWithData === 1 ? "" : "s"} with data):`,
    `- Energy: ${round(dailyAvg.energyKj)} kJ (~${round(dailyAvg.energyKcal)} kcal)`,
    `- Protein: ${round(dailyAvg.proteinG)} g`,
    `- Carbs: ${round(dailyAvg.carbsG)} g`,
    `- Fat: ${round(dailyAvg.fatG)} g`,
    `- Fibre: ${round(dailyAvg.fibreG)} g  (NHMRC AI ~${NHMRC.fibreG} g)`,
    `- Sodium: ${round(dailyAvg.sodiumMg)} mg  (NHMRC suggested ≤ ${NHMRC.sodiumMgUpper} mg${goals.targetSodiumMg ? `, user goal ≤ ${goals.targetSodiumMg}` : ""})`,
    `- Potassium: ${round(dailyAvg.potassiumMg)} mg  (NHMRC AI ~${NHMRC.potassiumMg} mg${goals.targetPotassiumMg ? `, user goal ≥ ${goals.targetPotassiumMg}` : ""})`,
    `- Calcium: ${round(dailyAvg.calciumMg)} mg  (RDI ${NHMRC.calciumMg} mg)`,
    `- Magnesium: ${round(dailyAvg.magnesiumMg)} mg  (RDI ${NHMRC.magnesiumMg} mg)`,
    "",
  ];

  if (topMeals.length > 0) {
    lines.push("Meals eaten most often:");
    for (const m of topMeals) lines.push(`- ${m.name} (${m.count}×)`);
  } else {
    lines.push("No meals marked as eaten in this window.");
  }

  lines.push(
    "",
    "Give your three-paragraph observation as instructed. Treat anything within 80% of reference as fine.",
  );
  return lines.join("\n");
}

/** End-to-end: gather, prompt, call Groq, return analysis text. */
export async function analyseNutrition(apiKey: string, signal?: AbortSignal): Promise<string> {
  const data = await gatherPromptData();
  if (data.daysWithData === 0) {
    return [
      "Looking good",
      "(no data yet — tick a few meals as eaten on the Plan tab and try again)",
      "",
      "Worth more attention",
      "(nothing to analyse without eaten meals in the last two weeks)",
      "",
      "Practical suggestions",
      "Plan a few meals on the Plan tab, tick them when you eat them, then come back here.",
    ].join("\n");
  }

  const messages: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(data) },
  ];

  return chatCompletion({
    apiKey,
    messages,
    temperature: 0.4,
    maxTokens: 500,
    signal,
  });
}
