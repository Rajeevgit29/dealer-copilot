/** Browser-side helpers for calling the v1 API with a consistent error shape. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } }).error;
    throw new ApiError(res.status, e?.code ?? "HTTP_" + res.status, e?.message ?? "Request failed", e?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => fetch(path, { cache: "no-store" }).then((r) => parse<T>(r)),
  post: <T>(path: string, body: unknown) =>
    fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => parse<T>(r)),
  patch: <T>(path: string, body: unknown) =>
    fetch(path, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => parse<T>(r)),
  del: (path: string) => fetch(path, { method: "DELETE" }).then((r) => parse<void>(r)),
  upload: <T>(path: string, form: FormData) => fetch(path, { method: "POST", body: form }).then((r) => parse<T>(r)),
};
