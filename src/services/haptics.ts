/**
 * Thin wrapper around the Web Vibration API. Provides semantic verbs so
 * call sites read clearly. iOS Safari does NOT honour navigator.vibrate
 * (Apple's deliberate decision), so this is effectively Android-only —
 * but it costs ~1KB and degrades gracefully where unsupported.
 */

function pulse(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  // Optional-chain the call: if `vibrate` isn't supported, this is a no-op.
  // Any thrown error from a flaky implementation is swallowed.
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no-op */
  }
}

export const haptic = {
  /** Light tap — buttons, toggles. */
  tap: () => pulse(8),
  /** Mid-weight switch — tab change, segmented control selection. */
  switch: () => pulse(15),
  /** Crisp success — saving a reading, completing a task. */
  success: () => pulse([10, 60, 30]),
  /** Sharp warning — destructive confirmation, deletion. */
  warn: () => pulse([0, 30, 60, 30]),
};
