/**
 * Singleton goals row. Always stored under id=1 in the `goals` Dexie table.
 *
 * All fields are optional — leaving one undefined means "no goal set" and the
 * UI hides the corresponding progress indicator.
 *
 * Defaults (returned by `defaultGoals()`) follow Australian Heart Foundation
 * and NHMRC guidance for adults at moderate CVD risk:
 * - BP target 130/80 mmHg (rolling 7-day average)
 * - Sodium upper limit 2,000 mg/day (~5 g salt)
 * - Potassium target 3,800 mg/day (AU NRV)
 * - 7 readings per week (one per day)
 *
 * Treat all defaults as starting points the user can adjust.
 */
export interface Goals {
  id?: number; // always 1 when persisted
  targetSystolic?: number;
  targetDiastolic?: number;
  /** Upper bound — daily intake should be at-or-below this. */
  targetSodiumMg?: number;
  /** Lower bound — daily intake should be at-or-above this. */
  targetPotassiumMg?: number;
  /** Lower bound — count of BP readings logged in a week. */
  targetReadingsPerWeek?: number;
}

export function defaultGoals(): Goals {
  return {
    id: 1,
    targetSystolic: 130,
    targetDiastolic: 80,
    targetSodiumMg: 2000,
    targetPotassiumMg: 3800,
    targetReadingsPerWeek: 7,
  };
}
