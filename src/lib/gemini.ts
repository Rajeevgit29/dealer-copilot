import "server-only";

/**
 * Minimal Gemini client (REST, no SDK) for structured extraction from photos.
 * The model only ever returns facts as JSON that we validate; it never makes
 * the recommendation. Decisions stay in the deterministic rules engine.
 *
 * Resilience: each model gets a short per-attempt timeout; on overload (429/503),
 * server errors or timeouts we fall through to the next model in the chain, so
 * a dealer at the counter is never left waiting on one busy model.
 */

export class AiDisabledError extends Error {
  constructor() {
    super("Photo reading is turned off. Set GEMINI_API_KEY to enable it.");
  }
}

export class AiError extends Error {}

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

/** Primary model first, then fallbacks (GEMINI_FALLBACK_MODELS, comma-separated). */
export function modelChain(): string[] {
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-flash-lite-latest,gemini-flash-latest")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}
export const aiModel = () => modelChain()[0];

export interface ImagePart {
  mimeType: string;
  base64: string;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  images: ImagePart[];
  schema: Record<string, unknown>;
  /** Per-model attempt timeout. */
  timeoutMs?: number;
}): Promise<{ data: T; model: string; latencyMs: number; attempts: { model: string; outcome: string; ms: number }[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiDisabledError();
  const started = Date.now();
  const attempts: { model: string; outcome: string; ms: number }[] = [];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [
      {
        role: "user",
        parts: [{ text: opts.prompt }, ...opts.images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } }))],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: opts.schema },
  });

  for (const model of modelChain()) {
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
        body,
      });
    } catch (e) {
      attempts.push({ model, outcome: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", ms: Date.now() - t0 });
      continue;
    }
    if (!res.ok) {
      attempts.push({ model, outcome: `http_${res.status}`, ms: Date.now() - t0 });
      if (RETRYABLE.has(res.status) || res.status === 404) continue;
      const text = await res.text().catch(() => "");
      throw new AiError(`Gemini ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      const data = JSON.parse(text) as T;
      attempts.push({ model, outcome: "ok", ms: Date.now() - t0 });
      return { data, model, latencyMs: Date.now() - started, attempts };
    } catch {
      attempts.push({ model, outcome: "invalid_json", ms: Date.now() - t0 });
    }
  }
  console.warn("Gemini: every model failed", attempts);
  throw new AiError(`All models failed: ${attempts.map((a) => `${a.model}=${a.outcome}`).join(", ")}`);
}
