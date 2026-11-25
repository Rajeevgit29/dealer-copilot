import type { Metadata } from "next";
import { APPROVED_USES, DATA_SOURCE } from "@/engine";
import { Disclaimer, SiteNav } from "@/components/brand";
import { cx } from "@/components/cx";
import { openApiSpec } from "@/lib/openapi";

export const metadata: Metadata = { title: "API" };

const METHOD_TONE: Record<string, string> = {
  get: "bg-info-soft text-info",
  post: "bg-good-soft text-good",
  patch: "bg-warn-soft text-warn",
  delete: "bg-bad-soft text-bad",
};

const EXAMPLE_REQ = `curl -X POST http://localhost:4700/api/v1/recommend \\
  -H 'content-type: application/json' \\
  -d '{
    "field":   { "crop": "cotton", "sowingDate": "2026-06-20", "areaAcres": 2 },
    "history": [
      { "date": "2026-09-25", "formKey": "thiamethoxam@25|WG",   "label": "Actara",     "actives": ["thiamethoxam"] },
      { "date": "2026-10-12", "formKey": "imidacloprid@17.8|SL", "label": "Confidor",   "actives": ["imidacloprid"] },
      { "date": "2026-10-28", "formKey": "acetamiprid@20|SP",    "label": "Local 20 SP", "actives": ["acetamiprid"] }
    ],
    "pestId": "whitefly"
  }'`;

const EXAMPLE_RES = `{
  "groupUseCounts": { "IRAC:4A": 3 },
  "summary": { "recommended": 41, "caution": 0, "blocked": 25, "total": 66 },
  "options": [
    {
      "formulation": "Cyantraniliprole 10.26 % OD",
      "groups": [{ "code": "IRAC:28", "name": "Diamides" }],
      "status": "recommended",
      "dose": { "perAcre": { "min": 365, "max": 365 }, "unit": "ml", "forField": { "max": 730 } },
      "phiDays": 7,
      "reasons": [{ "code": "NEW_GROUP", "severity": "good", "en": "New mode of action…", "hi": "…" }],
      "source": { "doc": "mup_insecticide_2026.pdf", "asOn": "2026-09-30", "page": 19 }
    },
    …
    {
      "formulation": "Thiamethoxam 25 % WG",
      "status": "blocked",
      "reasons": [{ "code": "SAME_GROUP_AS_LAST_SPRAY", "severity": "block", … }]
    }
  ]
}`;

export default function DevelopersPage() {
  const spec = openApiSpec("http://localhost:4700");
  const endpoints = Object.entries(spec.paths).flatMap(([path, ops]) =>
    Object.entries(ops as Record<string, { summary: string; tags: string[] }>).map(([method, op]) => ({ path, method, summary: op.summary, tag: op.tags[0] })),
  );
  const tags = spec.tags.map((t) => t.name);

  return (
    <>
      <SiteNav active="/developers" />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-semibold tracking-tight">Drop the rules engine into any retailer app</h1>
          <p className="mt-2 text-[15px] leading-7 text-muted">
            The advice endpoints are stateless. A retailer app sends the field and its spray history and gets ranked, label-approved options with reasons in English and Hindi, with no database and
            no shared state. The counter UI in this repo is one client of this API.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <a href="/api/openapi.json" className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink-2">
              OpenAPI 3 spec
            </a>
            <a href="/api/v1/health" className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-[14px] font-medium hover:border-line-strong">
              Health check
            </a>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="text-[17px] font-semibold tracking-tight">Architecture</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1.2fr_auto_1fr] lg:items-stretch">
            <Box title="Clients" items={["Dealer counter (Next.js, mobile-first)", "Any retailer app via REST", "WhatsApp share links (wa.me)"]} />
            <Arrow />
            <Box
              title="API (Next.js route handlers)"
              strong
              items={["zod-validated requests → OpenAPI", "Vision: Gemini reads label / bill / pest photo → strict JSON, with model fallback", "Rules engine: pure TypeScript, unit-tested", "Server re-runs rules before any sale is recorded"]}
            />
            <Arrow />
            <Box title="Data" items={[`CIB&RC approved uses (${APPROVED_USES.length} rows, versioned JSON)`, "IRAC / FRAC MoA tables", "Postgres: fields, sprays, sales, traps", "Open-Meteo forecast (cached 30 min)"]} />
          </div>
          <p className="mt-3 max-w-3xl text-[13px] leading-6 text-muted">
            The model never chooses a product. It only turns pixels into facts (active ingredient, strength, formulation type, expiry), and those facts are checked against the registered list.
            Phone numbers are stored only as a salted HMAC.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-[17px] font-semibold tracking-tight">Endpoints</h2>
          <div className="mt-4 space-y-6">
            {tags.map((tag) => (
              <div key={tag}>
                <div className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.08em] text-faint">{tag}</div>
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                  {endpoints
                    .filter((e) => e.tag === tag)
                    .map((e) => (
                      <li key={e.method + e.path} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                        <span className={cx("w-14 rounded-md py-0.5 text-center font-mono text-[11px] font-semibold uppercase", METHOD_TONE[e.method])}>{e.method}</span>
                        <code className="font-mono text-[13px]">{e.path}</code>
                        <span className="text-[13px] text-muted">{e.summary}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">Example: the three-bottle field</h2>
            <pre className="mt-4 overflow-x-auto rounded-[var(--radius-card)] bg-ink p-4 font-mono text-[12px] leading-5 text-[#e9e6df]">{EXAMPLE_REQ}</pre>
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">Response (trimmed)</h2>
            <pre className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface p-4 font-mono text-[12px] leading-5 text-ink-2">{EXAMPLE_RES}</pre>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-[17px] font-semibold tracking-tight">Data provenance</h2>
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-canvas text-[11.5px] uppercase tracking-[0.05em] text-muted">
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">How it gets in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  ["Approved crop × pest × dose × waiting period", `${DATA_SOURCE.name}, as on ${DATA_SOURCE.asOn}`, "data/pipeline/extract_mup.py parses the official PDFs; rows it cannot read confidently are skipped and counted"],
                  ["Mode-of-action groups", "IRAC MoA classification, FRAC code list", "data/reference/moa.json; uncertain entries flagged 'check'"],
                  ["Pink bollworm trap threshold", "ICAR-CICR PBW management strategies (2019)", "data/reference/pests.json"],
                  ["Spray weather", "Open-Meteo hourly forecast", "Fetched per district, cached 30 minutes"],
                  ["Brand → formulation", "Public product listings", "data/reference/products.json; verify against the label"],
                  ["Counter activity on /insights", "Synthetic", "db/seed.ts, a documented behaviour model, decided by the real engine"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td className="px-4 py-3 font-medium">{a}</td>
                    <td className="px-4 py-3 text-ink-2">{b}</td>
                    <td className="px-4 py-3 text-muted">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-[17px] font-semibold tracking-tight">Run it locally</h2>
          <pre className="mt-4 overflow-x-auto rounded-[var(--radius-card)] bg-ink p-4 font-mono text-[12.5px] leading-6 text-[#e9e6df]">{`createdb dealer_copilot
cp .env.example .env.local        # add GEMINI_API_KEY to enable photo reading
npm install
npm run db:setup                  # migrations + synthetic season
npm run dev                       # http://localhost:4700
npm test                          # unit tests
npm run eval                      # scenario evaluation`}</pre>
        </section>

        <Disclaimer className="mt-12 max-w-3xl" />
      </main>
    </>
  );
}

function Box({ title, items, strong }: { title: string; items: string[]; strong?: boolean }) {
  return (
    <div className={cx("rounded-[var(--radius-card)] border p-4", strong ? "border-ink bg-surface" : "border-line bg-surface")}>
      <div className="text-[13px] font-semibold">{title}</div>
      <ul className="mt-2 space-y-1.5 text-[12.5px] leading-5 text-muted">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-faint lg:flex" aria-hidden>
      <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
        <path d="M0 6h24m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
