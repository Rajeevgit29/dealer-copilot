import "server-only";
import { cookies, headers } from "next/headers";
import { ZodError, type ZodType } from "zod";
import { AiDisabledError, AiError } from "./gemini";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be JSON");
  }
  return schema.parse(raw);
}

/** Wrap a route handler: consistent error envelope { error: { code, message, details } }. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message, details: e.details } }, e.status);
      if (e instanceof ZodError) return json({ error: { code: "VALIDATION", message: "Invalid request", details: e.issues } }, 400);
      if (e instanceof AiDisabledError) return json({ error: { code: "AI_DISABLED", message: e.message } }, 503);
      if (e instanceof AiError) return json({ error: { code: "AI_ERROR", message: "Could not read the photo. Try a clearer, closer photo." } }, 502);
      console.error(e);
      return json({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
    }
  };
}

export const DEFAULT_DEALER = "dealer-yavatmal-1";

/** Which dealer is calling: x-dealer-id header (API clients) or the counter app cookie. */
export async function dealerId(): Promise<string> {
  const h = await headers();
  const fromHeader = h.get("x-dealer-id");
  if (fromHeader) return fromHeader;
  const c = await cookies();
  return c.get("dc_dealer")?.value ?? DEFAULT_DEALER;
}
