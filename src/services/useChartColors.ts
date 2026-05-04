import { useEffect, useState } from "react";

/**
 * Reads chart-relevant CSS variables off the root element so Recharts
 * can pick up the active light/dark palette. Re-runs when the OS theme changes.
 *
 * Recharts can't accept `var(--…)` directly as `stroke`/`fill` props because
 * they go straight into SVG attributes; resolving them at render time is the
 * cleanest workaround.
 */
export interface ChartColors {
  accent: string;
  accentSoft: string;
  warning: string;
  amber: string;
  muted: string;
  grid: string;
  surface: string;
  border: string;
}

function read(): ChartColors {
  if (typeof window === "undefined") {
    return {
      accent: "#2d5a3d",
      accentSoft: "rgba(45, 90, 61, 0.12)",
      warning: "#b8543a",
      amber: "#d49e3a",
      muted: "#8e8478",
      grid: "rgba(0, 0, 0, 0.06)",
      surface: "#fcfbf8",
      border: "rgba(0, 0, 0, 0.08)",
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string) => styles.getPropertyValue(name).trim();
  return {
    accent: get("--color-accent"),
    accentSoft: get("--color-accent-soft"),
    warning: get("--color-warning"),
    amber: get("--color-amber"),
    muted: get("--color-text-muted"),
    grid: get("--chart-grid"),
    surface: get("--chart-tooltip-bg"),
    border: get("--color-border"),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(read);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(read());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return colors;
}
