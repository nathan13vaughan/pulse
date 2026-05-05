import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { db } from "../../db";
import { categoryFor, type BPReading } from "../../models/BPReading";
import { CategoryBadge } from "../../components/CategoryBadge";
import { useAlert } from "../../components/AlertProvider";
import { formatDateTime } from "../../services/dateUtils";

interface Props {
  readings: BPReading[];
}

const SWIPE_REVEAL_PX = 88; // width of the action button
const SWIPE_OPEN_THRESHOLD = 36; // past this on release, snap open

export function BPReadingList({ readings }: Props) {
  const confirm = useAlert();
  const [revealedId, setRevealedId] = useState<number | null>(null);

  const onDelete = async (reading: BPReading) => {
    if (reading.id === undefined) return;
    setRevealedId(null);
    const ok = await confirm({
      title: "Delete this reading?",
      message: `${reading.systolic} / ${reading.diastolic} on ${formatDateTime(reading.timestamp)} will be removed from your history.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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
            <ReadingRow
              key={r.id}
              reading={r}
              isRevealed={revealedId === r.id}
              onReveal={() => setRevealedId(r.id ?? null)}
              onClose={() => setRevealedId((cur) => (cur === r.id ? null : cur))}
              onDelete={() => onDelete(r)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ReadingRowProps {
  reading: BPReading;
  isRevealed: boolean;
  onReveal: () => void;
  onClose: () => void;
  onDelete: () => void;
}

function ReadingRow({ reading, isRevealed, onReveal, onClose, onDelete }: ReadingRowProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const stateRef = useRef<{ startX: number; startY: number; direction: "none" | "h" | "v" }>({
    startX: 0,
    startY: 0,
    direction: "none",
  });

  // Sync inline drag offset with the revealed prop. Spring-back closes get
  // animated by the CSS transition since we're not in dragging mode.
  useEffect(() => {
    if (!dragging) setDragX(isRevealed ? -SWIPE_REVEAL_PX : 0);
  }, [isRevealed, dragging]);

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    stateRef.current = { startX: t.clientX, startY: t.clientY, direction: "none" };
  };

  const onTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    const dx = t.clientX - stateRef.current.startX;
    const dy = t.clientY - stateRef.current.startY;

    // Lock direction on first decisive movement so vertical scroll stays smooth
    // and horizontal swipes don't double as page scrolls.
    if (stateRef.current.direction === "none") {
      const total = Math.abs(dx) + Math.abs(dy);
      if (total < 8) return;
      stateRef.current.direction = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (stateRef.current.direction === "h") setDragging(true);
    }
    if (stateRef.current.direction !== "h") return;

    const base = isRevealed ? -SWIPE_REVEAL_PX : 0;
    const next = Math.min(0, Math.max(-SWIPE_REVEAL_PX, base + dx));
    setDragX(next);
  };

  const onTouchEnd = () => {
    setDragging(false);
    const wasHorizontal = stateRef.current.direction === "h";
    stateRef.current.direction = "none";
    if (!wasHorizontal) return;
    if (dragX < -SWIPE_OPEN_THRESHOLD) onReveal();
    else onClose();
  };

  return (
    <li className="reading-row-wrap" data-no-swipe="true">
      <button
        type="button"
        className="reading-row-action"
        onClick={onDelete}
        aria-label="Delete reading"
        tabIndex={isRevealed ? 0 : -1}
      >
        Delete
      </button>
      <div
        className={`reading-row-content ${dragging ? "reading-row-content--dragging" : ""}`}
        style={{ transform: `translateX(${dragX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => { if (isRevealed) onClose(); }}
      >
        <div className="reading-row__main">
          <div className="reading-row__numbers mono">
            <span>{reading.systolic}</span>
            <span className="muted"> / </span>
            <span>{reading.diastolic}</span>
            {reading.pulse !== undefined ? (
              <span className="reading-row__pulse"> · {reading.pulse} bpm</span>
            ) : null}
          </div>
          <div className="reading-row__meta">
            {formatDateTime(reading.timestamp)}
            {reading.contextTags.length > 0 ? <> · {reading.contextTags.join(" · ")}</> : null}
          </div>
        </div>
        <CategoryBadge category={categoryFor(reading.systolic, reading.diastolic)} />
      </div>
    </li>
  );
}
