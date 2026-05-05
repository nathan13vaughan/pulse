import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { categoryFor } from "../../models/BPReading";
import { CategoryBadge } from "../../components/CategoryBadge";
import { LargeTitlePage } from "../../components/LargeTitlePage";
import { formatDateTime } from "../../services/dateUtils";
import { BPLogModal } from "./BPLogModal";
import { BPReadingList } from "./BPReadingList";
import { BPTrendChart } from "./BPTrendChart";
import "./bp.css";

export default function BPView() {
  const readings = useLiveQuery(
    () => db.readings.orderBy("timestamp").reverse().toArray(),
    [],
    [],
  );
  const [logOpen, setLogOpen] = useState(false);

  const latest = readings?.[0];

  return (
    <LargeTitlePage
      title="Pressure"
      trailing={
        <button
          type="button"
          className="icon-btn icon-btn--accent"
          onClick={() => setLogOpen(true)}
          aria-label="Log a reading"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      {latest ? (
        <section className="card hero">
          <div className="section-label">Latest reading</div>
          <div className="hero__numbers">
            <span className="hero__sys mono">{latest.systolic}</span>
            <span className="hero__slash">/</span>
            <span className="hero__dia mono">{latest.diastolic}</span>
            <span className="hero__unit">mmHg</span>
          </div>
          <div className="hero__meta">
            <CategoryBadge category={categoryFor(latest.systolic, latest.diastolic)} />
            <span className="muted"> · {formatDateTime(latest.timestamp)}</span>
          </div>
        </section>
      ) : (
        <section className="card">
          <h2 className="headline" style={{ marginTop: 0 }}>No readings yet</h2>
          <p className="muted" style={{ margin: 0 }}>Tap + to log your first measurement.</p>
        </section>
      )}

      <BPTrendChart readings={readings ?? []} />
      <BPReadingList readings={readings ?? []} />

      <BPLogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </LargeTitlePage>
  );
}
