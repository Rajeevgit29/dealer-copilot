import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiDisabledError, AiError, generateJson, modelChain } from "../src/lib/gemini";

const ok = (payload: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 });
const status = (code: number) => new Response(JSON.stringify({ error: { code, message: "x" } }), { status: code });
const call = () => generateJson<{ a: number }>({ system: "s", prompt: "p", images: [], schema: {}, timeoutMs: 50 });
const modelOf = (url: unknown) => decodeURIComponent(String(url)).match(/models\/([^:]+):/)?.[1];

describe("Gemini client: model fallback", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "primary");
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "backup-1, backup-2");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds the chain from env, primary first, without duplicates", () => {
    vi.stubEnv("GEMINI_FALLBACK_MODELS", "backup-1,primary,backup-1");
    expect(modelChain()).toEqual(["primary", "backup-1"]);
  });

  it("uses the primary model when it answers", async () => {
    const fetch = vi.fn(async () => ok({ a: 1 }));
    vi.stubGlobal("fetch", fetch);
    const r = await call();
    expect(r.data).toEqual({ a: 1 });
    expect(r.model).toBe("primary");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls through on overload (503) and rate limit (429)", async () => {
    const fetch = vi.fn(async (url: unknown) => (modelOf(url) === "backup-2" ? ok({ a: 2 }) : modelOf(url) === "primary" ? status(503) : status(429)));
    vi.stubGlobal("fetch", fetch);
    const r = await call();
    expect(r.model).toBe("backup-2");
    expect(r.attempts.map((a) => a.outcome)).toEqual(["http_503", "http_429", "ok"]);
  });

  it("falls through when a model times out", async () => {
    const fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (modelOf(url) === "primary") {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("t"), { name: "TimeoutError" }))));
      }
      return ok({ a: 3 });
    });
    vi.stubGlobal("fetch", fetch);
    const r = await call();
    expect(r.model).toBe("backup-1");
    expect(r.attempts[0].outcome).toBe("timeout");
  });

  it("does not retry a bad request (400)", async () => {
    const fetch = vi.fn(async () => status(400));
    vi.stubGlobal("fetch", fetch);
    await expect(call()).rejects.toBeInstanceOf(AiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("raises AiError when every model fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => status(503)));
    await expect(call()).rejects.toThrow(/All models failed/);
  });

  it("is disabled without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(call()).rejects.toBeInstanceOf(AiDisabledError);
  });
});
