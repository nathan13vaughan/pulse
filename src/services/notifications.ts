import { db } from "../db";
import type { MealSlot } from "../models/Meal";
import { startOfDay } from "./dateUtils";

/** Native Notification API permission state. */
export type NotificationStatus = "default" | "granted" | "denied" | "unsupported";

export function getNotificationStatus(): NotificationStatus {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as NotificationStatus;
}

export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (typeof Notification === "undefined") return "unsupported";
  const result = await Notification.requestPermission();
  return result as NotificationStatus;
}

/** Detect whether we're running as an installed PWA (standalone mode). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari uses navigator.standalone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True iff the user is on iOS Safari (where push needs Add-to-Home-Screen first). */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

// MARK: - Suppression rules

/** True if a BP reading exists in the last 60 minutes. */
async function shouldSuppressBPReminder(now: number = Date.now()): Promise<boolean> {
  const cutoff = now - 60 * 60 * 1000;
  const count = await db.readings.where("timestamp").above(cutoff).count();
  return count > 0;
}

/** True if today's matching meal-plan slot is already eaten. */
async function shouldSuppressMealReminder(slot: MealSlot, now: number = Date.now()): Promise<boolean> {
  const today = startOfDay(now);
  const entries = await db.mealPlan
    .where("[date+slot]")
    .equals([today, slot])
    .filter((e) => e.wasEaten)
    .count();
  return entries > 0;
}

// MARK: - Foreground ticker

/**
 * The web has no native cron/scheduled notifications without a push server.
 * As a pragmatic substitute we keep a setInterval running while the app/PWA is open;
 * each minute we check schedules due to fire and post a Notification.
 *
 * Limitation surfaced to the user in Settings: reminders only fire while the
 * app is open in a tab or recently used as an installed PWA.
 */
let tickerInterval: number | null = null;
const firedThisMinute = new Set<string>();

export function startNotificationTicker(): void {
  if (tickerInterval !== null) return;
  // First check happens after 1s so we don't fire on every page reload immediately.
  tickerInterval = window.setInterval(() => void tick(), 30 * 1000);
}

export function stopNotificationTicker(): void {
  if (tickerInterval !== null) {
    window.clearInterval(tickerInterval);
    tickerInterval = null;
  }
}

async function tick(): Promise<void> {
  if (getNotificationStatus() !== "granted") return;
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun … 6 = Sat (matches our schema)
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}-${minute}`;
  // Wipe stale fired-keys: keep only the current minute.
  for (const k of firedThisMinute) {
    if (!k.startsWith(minuteKey + ":")) firedThisMinute.delete(k);
  }

  const schedules = await db.notificationSchedules.toArray();
  for (const s of schedules) {
    if (!s.isEnabled) continue;
    if (!s.weekdays.includes(dow)) continue;
    if (s.hour !== hour || s.minute !== minute) continue;
    const dedupeKey = `${minuteKey}:${s.id ?? "x"}`;
    if (firedThisMinute.has(dedupeKey)) continue;

    if (s.type === "bpReminder" && await shouldSuppressBPReminder(now.getTime())) continue;
    if (s.type === "mealReminder" && s.mealSlot && await shouldSuppressMealReminder(s.mealSlot, now.getTime())) continue;

    const title = s.type === "bpReminder" ? "Time for a reading" : `${s.mealSlot ?? "Meal"} reminder`;
    const body = s.customMessage ??
      (s.type === "bpReminder"
        ? "A quick measurement keeps your trend honest."
        : "Don't forget to log what you eat.");

    try {
      new Notification(title, { body, icon: "/icons/icon-192.png", tag: `pulse-${s.id}` });
      firedThisMinute.add(dedupeKey);
    } catch (err) {
      console.warn("Notification failed", err);
    }
  }
}
