import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveGoals } from "../../db";
import { defaultGoals, type Goals } from "../../models/Goals";

export function GoalsSection() {
  const stored = useLiveQuery(() => db.goals.get(1), [], undefined);
  const [draft, setDraft] = useState<Goals>(defaultGoals());
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Sync the draft to whatever's in the DB (or the defaults) on mount/changes.
  useEffect(() => {
    if (stored !== undefined) setDraft(stored ?? defaultGoals());
  }, [stored]);

  const update = (patch: Partial<Goals>) => setDraft((prev) => ({ ...prev, ...patch }));

  const onSave = async () => {
    await saveGoals(draft);
    setSavedAt(Date.now());
  };

  const onResetDefaults = async () => {
    const def = defaultGoals();
    await saveGoals(def);
    setDraft(def);
    setSavedAt(Date.now());
  };

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Goals</h2>
      <p className="muted settings-fineprint">
        Defaults follow Australian Heart Foundation and NHMRC guidance for adults at moderate CVD risk.
        Adjust to whatever you and your GP have agreed on.
      </p>

      <div className="goals-grid">
        <NumberRow
          label="Target systolic"
          suffix="mmHg"
          value={draft.targetSystolic}
          onChange={(v) => update({ targetSystolic: v })}
        />
        <NumberRow
          label="Target diastolic"
          suffix="mmHg"
          value={draft.targetDiastolic}
          onChange={(v) => update({ targetDiastolic: v })}
        />
        <NumberRow
          label="Daily sodium limit"
          suffix="mg"
          value={draft.targetSodiumMg}
          onChange={(v) => update({ targetSodiumMg: v })}
        />
        <NumberRow
          label="Daily potassium target"
          suffix="mg"
          value={draft.targetPotassiumMg}
          onChange={(v) => update({ targetPotassiumMg: v })}
        />
        <NumberRow
          label="Readings per week"
          suffix="/ week"
          value={draft.targetReadingsPerWeek}
          onChange={(v) => update({ targetReadingsPerWeek: v })}
        />
      </div>

      <div className="settings-actions">
        <button type="button" className="btn btn--primary" onClick={onSave}>
          Save goals
        </button>
        <button type="button" className="btn btn--ghost" onClick={onResetDefaults}>
          Reset to defaults
        </button>
      </div>
      {savedAt ? <p className="muted settings-status">Saved.</p> : null}
    </section>
  );
}

interface NumberRowProps {
  label: string;
  suffix: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}

function NumberRow({ label, suffix, value, onChange }: NumberRowProps) {
  return (
    <label className="goals-row">
      <span className="goals-row__label">{label}</span>
      <span className="goals-row__field">
        <input
          type="number"
          inputMode="numeric"
          className="text-input goals-row__input"
          value={value ?? ""}
          min={0}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
        />
        <span className="goals-row__suffix muted">{suffix}</span>
      </span>
    </label>
  );
}
