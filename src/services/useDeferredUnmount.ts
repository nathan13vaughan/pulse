import { useEffect, useState } from "react";

/**
 * Holds the most recent non-null value for `durationMs` after `value` becomes null,
 * then drops it. Used to keep modal components mounted long enough to play their
 * close animation before React tears them out of the DOM.
 *
 * Pattern in the parent:
 *   const [editing, setEditing] = useState<X | null>(null);
 *   const editingDeferred = useDeferredUnmount(editing, 320);
 *   {editingDeferred ? (
 *     <SomeModal
 *       data={editingDeferred}
 *       open={Boolean(editing)}
 *       onClose={() => setEditing(null)}
 *     />
 *   ) : null}
 */
export function useDeferredUnmount<T>(value: T | null, durationMs: number): T | null {
  const [held, setHeld] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setHeld(value);
      return;
    }
    const t = window.setTimeout(() => setHeld(null), durationMs);
    return () => window.clearTimeout(t);
  }, [value, durationMs]);

  return held;
}
