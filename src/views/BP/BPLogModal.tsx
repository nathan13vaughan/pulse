import { useMemo, useState } from "react";
import { db } from "../../db";
import { categoryFor } from "../../models/BPReading";
import { Modal } from "../../components/Modal";
import { NumericStepper } from "../../components/NumericStepper";
import { TagChips } from "../../components/TagChips";
import { CategoryBadge } from "../../components/CategoryBadge";

const PRESET_TAGS = [
  "morning", "evening", "post-meal", "pre-meal",
  "post-exercise", "stressed", "rested", "caffeine",
];

/** Formats a Date for a `<input type="datetime-local">` value (local timezone, no tz suffix). */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BPLogModal({ open, onClose }: Props) {
  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [pulseText, setPulseText] = useState("");
  const [timestamp, setTimestamp] = useState(() => toLocalInputValue(new Date()));
  const [tags, setTags] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState("");

  const previewCategory = useMemo(() => categoryFor(systolic, diastolic), [systolic, diastolic]);

  const reset = () => {
    setSystolic(120);
    setDiastolic(80);
    setPulseText("");
    setTimestamp(toLocalInputValue(new Date()));
    setTags(new Set());
    setNotes("");
  };

  const close = () => { reset(); onClose(); };

  const save = async () => {
    const ts = new Date(timestamp).getTime();
    const pulse = parseInt(pulseText, 10);
    await db.readings.add({
      timestamp: ts,
      systolic,
      diastolic,
      pulse: Number.isFinite(pulse) ? pulse : undefined,
      contextTags: Array.from(tags).sort(),
      notes: notes.trim() || undefined,
    });
    close();
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New reading"
      primaryAction={{ label: "Save", onClick: save }}
    >
      <div className="form-stack">
        <NumericStepper label="Systolic" value={systolic} onChange={setSystolic} min={60} max={260} unit="mmHg" />
        <NumericStepper label="Diastolic" value={diastolic} onChange={setDiastolic} min={40} max={160} unit="mmHg" />

        <div className="field">
          <label className="field-label" htmlFor="pulse">Pulse <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
          <input
            id="pulse"
            className="text-input"
            inputMode="numeric"
            placeholder="bpm"
            value={pulseText}
            onChange={(e) => setPulseText(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>

        <div className="card preview">
          <div>
            <div className="section-label">Preview</div>
            <div className="preview__numbers mono">
              <span>{systolic}</span>
              <span className="muted"> / </span>
              <span>{diastolic}</span>
            </div>
          </div>
          <CategoryBadge category={previewCategory} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="ts">When</label>
          <input
            id="ts"
            type="datetime-local"
            className="datetime-input"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="field-label">Context</div>
          <TagChips options={PRESET_TAGS} selected={tags} onToggle={toggleTag} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className="textarea-input"
            placeholder="How did you feel?"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
