import { db } from "../../db";
import { categoryFor, type BPReading } from "../../models/BPReading";
import { CategoryBadge } from "../../components/CategoryBadge";
import { formatDateTime } from "../../services/dateUtils";

interface Props {
  readings: BPReading[];
}

export function BPReadingList({ readings }: Props) {
  const onDelete = async (reading: BPReading) => {
    if (reading.id === undefined) return;
    await db.readings.delete(reading.id);
  };

  return (
    <section className="reading-list-section">
      <header className="reading-list__header">
        <h2 className="headline" style={{ fontSize: "var(--fs-title)" }}>History</h2>
        <span className="muted" style={{ fontSize: "var(--fs-caption)" }}>
          {readings.length} total
        </span>
      </header>

      {readings.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Log a reading to start your history.</p>
        </div>
      ) : (
        <ul className="reading-list">
          {readings.map((r) => (
            <li key={r.id} className="reading-row">
              <div className="reading-row__main">
                <div className="reading-row__numbers mono">
                  <span>{r.systolic}</span>
                  <span className="muted"> / </span>
                  <span>{r.diastolic}</span>
                  {r.pulse !== undefined ? <span className="reading-row__pulse"> · {r.pulse} bpm</span> : null}
                </div>
                <div className="reading-row__meta">
                  {formatDateTime(r.timestamp)}
                  {r.contextTags.length > 0 ? <> · {r.contextTags.join(" · ")}</> : null}
                </div>
              </div>
              <CategoryBadge category={categoryFor(r.systolic, r.diastolic)} />
              <button
                type="button"
                className="icon-btn reading-row__delete"
                onClick={() => onDelete(r)}
                aria-label="Delete reading"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6M14 11v6"></path>
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
