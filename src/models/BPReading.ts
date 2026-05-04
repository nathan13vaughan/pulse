/** Australian Heart Foundation BP categories — see CLAUDE.md. */
export type BPCategory = "normal" | "normalHigh" | "grade1" | "grade2" | "grade3";

export interface BPReading {
  id?: number;
  /** epoch ms */
  timestamp: number;
  systolic: number;
  diastolic: number;
  pulse?: number;
  contextTags: string[];
  notes?: string;
}

export const BP_CATEGORY_LABEL: Record<BPCategory, string> = {
  normal: "Normal",
  normalHigh: "Normal-high",
  grade1: "Grade 1",
  grade2: "Grade 2",
  grade3: "Grade 3",
};

/**
 * Australian Heart Foundation classification (Guideline for the diagnosis and
 * management of hypertension in adults — 2016, reaffirmed 2023).
 *
 * Whichever value (systolic or diastolic) lands in a higher band wins.
 * - Grade 3:        ≥180 / ≥110
 * - Grade 2:        160–179 / 100–109
 * - Grade 1:        140–159 / 90–99
 * - Normal-high:    120–139 / 80–89
 * - Normal:         <120 and <80
 *
 * No "elevated" tier in the AU scheme.
 */
export function categoryFor(systolic: number, diastolic: number): BPCategory {
  if (systolic >= 180 || diastolic >= 110) return "grade3";
  if (systolic >= 160 || diastolic >= 100) return "grade2";
  if (systolic >= 140 || diastolic >= 90) return "grade1";
  if (systolic >= 120 || diastolic >= 80) return "normalHigh";
  return "normal";
}
