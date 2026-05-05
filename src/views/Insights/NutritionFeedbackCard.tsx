import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateAISettings } from "../../db";
import { analyseNutrition } from "../../services/nutritionAnalyzer";
import { GroqApiError } from "../../services/groq";
import { formatDateTime } from "../../services/dateUtils";

export function NutritionFeedbackCard() {
  const settings = useLiveQuery(() => db.aiSettings.get(1), [], undefined);
  const apiKey = settings?.groqApiKey ?? "";
  const cachedResponse = settings?.lastResponse;
  const cachedAt = settings?.lastAnalyzedAt;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAnalyse = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const text = await analyseNutrition(apiKey);
      await updateAISettings({ lastResponse: text, lastAnalyzedAt: Date.now() });
    } catch (e) {
      setError(e instanceof GroqApiError ? e.message : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card insights-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-sm)" }}>
        <h2 className="headline" style={{ fontSize: "var(--fs-title)", margin: 0 }}>
          Nutrition feedback
        </h2>
        <span className="muted" style={{ fontSize: "var(--fs-micro)" }}>via Groq</span>
      </div>

      {!apiKey ? (
        <p className="muted" style={{ margin: "var(--sp-xs) 0 0" }}>
          Add your Groq API key in <Link to="/settings">Settings</Link> to enable AI-powered
          observations on your last 14 days of eaten meals.
        </p>
      ) : (
        <>
          {cachedResponse ? (
            <pre className="ai-feedback__text">{cachedResponse}</pre>
          ) : (
            <p className="muted" style={{ margin: "var(--sp-xs) 0" }}>
              No analysis yet — tap the button below to run one. Uses ~500 tokens (~$0 on Groq's free tier).
            </p>
          )}

          {error ? (
            <p className="muted" style={{ color: "var(--color-warning)", margin: 0 }}>
              {error}
            </p>
          ) : null}

          <div className="ai-feedback__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={onAnalyse}
              disabled={loading}
            >
              {loading ? "Analysing…" : cachedResponse ? "Refresh" : "Analyse"}
            </button>
            {cachedAt ? (
              <span className="muted" style={{ fontSize: "var(--fs-caption)" }}>
                Last analysed {formatDateTime(cachedAt)}
              </span>
            ) : null}
          </div>

          <p className="muted insights-narrative" style={{ marginTop: "var(--sp-xs)" }}>
            General nutrition observations only. Not medical advice. Talk to your GP if you're
            making any meaningful changes.
          </p>
        </>
      )}
    </section>
  );
}
