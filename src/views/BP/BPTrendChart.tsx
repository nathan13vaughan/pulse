import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BPReading } from "../../models/BPReading";
import { categoryFor } from "../../models/BPReading";
import { formatShort } from "../../services/dateUtils";
import { useChartColors } from "../../services/useChartColors";

const RANGES = [
  { key: "7d",  label: "7D",  days: 7   },
  { key: "30d", label: "30D", days: 30  },
  { key: "90d", label: "90D", days: 90  },
  { key: "all", label: "All", days: null as number | null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

interface Props {
  readings: BPReading[];
}

export function BPTrendChart({ readings }: Props) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const C = useChartColors();

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days;
    const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
    if (days == null) return sorted;
    const cutoff = Date.now() - days * 86_400_000;
    return sorted.filter((r) => r.timestamp >= cutoff);
  }, [readings, rangeKey]);

  const data = useMemo(
    () =>
      filtered.map((r) => ({
        ts: r.timestamp,
        systolic: r.systolic,
        diastolic: r.diastolic,
        category: categoryFor(r.systolic, r.diastolic),
      })),
    [filtered],
  );

  const averages = useMemo(() => {
    if (filtered.length === 0) return null;
    const sysAvg = Math.round(filtered.reduce((a, r) => a + r.systolic, 0) / filtered.length);
    const diaAvg = Math.round(filtered.reduce((a, r) => a + r.diastolic, 0) / filtered.length);
    return { sysAvg, diaAvg };
  }, [filtered]);

  const yMax = Math.max(180, ...data.map((d) => d.systolic + 10));

  return (
    <section className="card chart-card">
      <header className="chart-card__header">
        <h2 className="headline" style={{ fontSize: "var(--fs-title)", margin: 0 }}>Trend</h2>
        <div className="range-picker">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`range-picker__btn ${rangeKey === r.key ? "range-picker__btn--active" : ""}`}
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {data.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Not enough data for this range yet.</p>
      ) : (
        <>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <ReferenceArea y1={60} y2={120} fill={C.accentSoft} stroke="none" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => formatShort(v)}
                  tick={{ fontSize: 11, fill: C.muted }}
                  stroke={C.grid}
                />
                <YAxis
                  domain={[40, yMax]}
                  ticks={[40, 80, 120, 160, yMax]}
                  tick={{ fontSize: 11, fill: C.muted }}
                  stroke={C.grid}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "0.5px solid var(--color-border)",
                    borderRadius: "var(--r-sm)",
                    fontSize: "var(--fs-caption)",
                  }}
                  labelFormatter={(v) => formatShort(Number(v))}
                  formatter={(value, name) => [`${value} mmHg`, name === "systolic" ? "Sys" : "Dia"]}
                />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  stroke={C.accent}
                  strokeWidth={2}
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const idx = props.index ?? 0;
                    const cat = data[idx]?.category ?? "normal";
                    const colour = cat === "normal"
                      ? C.accent
                      : cat === "normalHigh"
                      ? C.amber
                      : C.warning;
                    return (
                      <circle
                        key={`dot-${idx}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={3.5}
                        fill={colour}
                        stroke="none"
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  stroke={C.muted}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {averages ? (
            <div className="averages">
              <div>
                <div className="section-label">Avg sys</div>
                <div className="mono averages__value">{averages.sysAvg}</div>
              </div>
              <div>
                <div className="section-label">Avg dia</div>
                <div className="mono averages__value">{averages.diaAvg}</div>
              </div>
              <div>
                <div className="section-label">Readings</div>
                <div className="mono averages__value">{filtered.length}</div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
