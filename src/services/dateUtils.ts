/** Locale-aware date helpers. AU app: Monday-first weeks, en-AU formatting. */

export const AU_LOCALE = "en-AU";

/** Returns the start-of-day epoch ms for the given timestamp (or now). */
export function startOfDay(ms: number = Date.now()): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Returns the start-of-week (Monday 00:00) epoch ms for the given timestamp. */
export function startOfWeekMonday(ms: number = Date.now()): number {
  const d = new Date(startOfDay(ms));
  const dow = d.getDay(); // 0 = Sunday, 1 = Monday, … 6 = Saturday
  const offset = dow === 0 ? 6 : dow - 1; // Days since Monday
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatShort(ms: number): string {
  return new Date(ms).toLocaleDateString(AU_LOCALE, { day: "numeric", month: "short" });
}

export function formatWeekday(ms: number): string {
  return new Date(ms).toLocaleDateString(AU_LOCALE, { weekday: "long" });
}

export function formatLong(ms: number): string {
  return new Date(ms).toLocaleDateString(AU_LOCALE, { weekday: "long", day: "numeric", month: "long" });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(AU_LOCALE, { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(AU_LOCALE, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
