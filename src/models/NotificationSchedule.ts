import type { MealSlot } from "./Meal";

export type NotificationKind = "bpReminder" | "mealReminder";

export interface NotificationSchedule {
  id?: number;
  type: NotificationKind;
  hour: number;
  minute: number;
  /**
   * Active weekdays in JavaScript convention: 0 = Sun … 6 = Sat.
   * (Different from Apple's Calendar, which uses 1 = Sun … 7 = Sat.)
   */
  weekdays: number[];
  mealSlot?: MealSlot;
  isEnabled: boolean;
  customMessage?: string;
}
