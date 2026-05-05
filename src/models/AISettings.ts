/**
 * Singleton row (id=1) for the optional Groq AI integration.
 *
 * The API key never leaves the device — it's typed into Settings and lives in
 * IndexedDB. It's deliberately excluded from JSON exports to avoid leaking via
 * shared backup files.
 */
export interface AISettings {
  id?: number;
  /** Groq API key — bearer token used directly against api.groq.com. */
  groqApiKey?: string;
  /** Cached most recent analysis text. */
  lastResponse?: string;
  /** When the cached response was generated (epoch ms). */
  lastAnalyzedAt?: number;
}
