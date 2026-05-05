/**
 * Direct browser → Groq API call. Bearer token auth; the key is the user's own,
 * stored only in IndexedDB on this device. No backend, no proxy.
 *
 * See https://console.groq.com/docs/quickstart for the schema (Groq is OpenAI-compatible).
 */

const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";

/** Default model — strong reasoning, generous free tier. */
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqError {
  kind: "auth" | "rate-limit" | "network" | "server" | "unknown";
  message: string;
}

export class GroqApiError extends Error {
  constructor(public detail: GroqError) {
    super(detail.message);
  }
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
}

export async function chatCompletion(input: {
  apiKey: string;
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  if (!input.apiKey) {
    throw new GroqApiError({ kind: "auth", message: "No Groq API key set." });
  }

  let resp: Response;
  try {
    resp = await fetch(GROQ_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model ?? DEFAULT_GROQ_MODEL,
        messages: input.messages,
        temperature: input.temperature ?? 0.5,
        max_tokens: input.maxTokens ?? 600,
      }),
      signal: input.signal,
    });
  } catch (e) {
    throw new GroqApiError({
      kind: "network",
      message: `Network error reaching Groq: ${(e as Error).message}`,
    });
  }

  if (!resp.ok) {
    const text = await safeText(resp);
    if (resp.status === 401 || resp.status === 403) {
      throw new GroqApiError({
        kind: "auth",
        message: "Groq rejected the API key. Check it in Settings.",
      });
    }
    if (resp.status === 429) {
      throw new GroqApiError({
        kind: "rate-limit",
        message: "Groq rate limit hit. Wait a minute and try again.",
      });
    }
    if (resp.status >= 500) {
      throw new GroqApiError({
        kind: "server",
        message: `Groq server error (${resp.status}). Try again shortly.`,
      });
    }
    throw new GroqApiError({
      kind: "unknown",
      message: `Groq returned ${resp.status}: ${text.slice(0, 200)}`,
    });
  }

  let data: ChatCompletionResponse;
  try {
    data = (await resp.json()) as ChatCompletionResponse;
  } catch (e) {
    throw new GroqApiError({
      kind: "unknown",
      message: `Couldn't parse Groq response: ${(e as Error).message}`,
    });
  }
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) {
    throw new GroqApiError({
      kind: "unknown",
      message: "Groq returned an empty response.",
    });
  }
  return content;
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
