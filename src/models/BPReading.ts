export type BPCategory = "normal" | "elevated" | "stage1" | "stage2" | "crisis";

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
  elevated: "Elevated",
  stage1: "Stage 1",
  stage2: "Stage 2",
  crisis: "Crisis",
};

/** AHA bands. Will swap to Australian Heart Foundation bands later — see CLAUDE.md. */
export function categoryFor(systolic: number, diastolic: number): BPCategory {
  if (systolic >= 180 || diastolic >= 120) return "crisis";
  if (systolic >= 140 || diastolic >= 90) return "stage2";
  if (systolic >= 130 || diastolic >= 80) return "stage1";
  if (systolic >= 120 && diastolic < 80) return "elevated";
  return "normal";
}
