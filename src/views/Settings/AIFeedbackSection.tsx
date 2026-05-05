import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateAISettings } from "../../db";

export function AIFeedbackSection() {
  const stored = useLiveQuery(() => db.aiSettings.get(1), [], undefined);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (stored !== undefined) setDraft(stored?.groqApiKey ?? "");
  }, [stored]);

  const onSave = async () => {
    await updateAISettings({ groqApiKey: draft.trim() || undefined });
    setSavedAt(Date.now());
  };

  const onClear = async () => {
    await updateAISettings({ groqApiKey: undefined, lastResponse: undefined, lastAnalyzedAt: undefined });
    setDraft("");
    setSavedAt(Date.now());
  };

  const hasKey = Boolean(stored?.groqApiKey);

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">AI nutrition feedback</h2>
      <p className="muted settings-fineprint">
        Optional. The Insights tab can analyse your last 14 days of eaten meals using Groq's
        free-tier API and surface nutrient gaps. Your key is stored only on this device — never
        committed to the repo, never sent anywhere except api.groq.com when you tap Analyse.
      </p>

      <div className="field" style={{ marginTop: "var(--sp-sm)" }}>
        <label className="field-label" htmlFor="groq-key">Groq API key</label>
        <div className="row-add">
          <input
            id="groq-key"
            type={reveal ? "text" : "password"}
            className="text-input"
            placeholder="gsk_..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn--ghost" onClick={() => setReveal((v) => !v)}>
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div className="settings-actions" style={{ marginTop: "var(--sp-sm)" }}>
        <button type="button" className="btn btn--primary" onClick={onSave} disabled={!draft.trim()}>
          {hasKey ? "Update key" : "Save key"}
        </button>
        {hasKey ? (
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            Remove key
          </button>
        ) : null}
      </div>

      {savedAt ? <p className="muted settings-status">Saved.</p> : null}

      <p className="muted settings-fineprint" style={{ marginTop: "var(--sp-sm)" }}>
        Get a free key at console.groq.com → API Keys. Llama 3.3 70B has a generous free tier; you
        likely won't pay anything for personal use.
      </p>
    </section>
  );
}
