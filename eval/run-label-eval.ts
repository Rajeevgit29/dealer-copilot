/**
 * Label-reader evaluation: posts every image in eval/fixtures/labels to the
 * running API (/api/v1/scan-label) and scores it against expected.json.
 *
 *   npm run dev            # in another terminal, with GEMINI_API_KEY set
 *   npm run eval:labels    # BASE_URL=http://localhost:4700 by default
 *
 * Add real photos by dropping them in the folder and adding an entry to expected.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:4700";
const DIR = join(process.cwd(), "eval", "fixtures", "labels");

interface Expected {
  file: string;
  kind: "label" | "bill";
  items: { formKey: string; registered: boolean; mustHaveChecks?: string[]; mustNotHaveChecks?: string[] }[];
}
interface Item {
  formKey: string;
  registered: boolean;
  checks: { level: string; en: string }[];
}

async function scan(file: string) {
  const form = new FormData();
  const bytes = readFileSync(join(DIR, file));
  form.append("image", new Blob([bytes], { type: "image/png" }), file);
  const started = Date.now();
  const res = await fetch(`${BASE}/api/v1/scan-label`, { method: "POST", body: form });
  const body = (await res.json()) as { items?: Item[]; error?: { code: string; message: string } };
  return { status: res.status, ms: Date.now() - started, body };
}

async function main() {
  const { fixtures } = JSON.parse(readFileSync(join(DIR, "expected.json"), "utf8")) as { fixtures: Expected[] };
  let itemsExpected = 0;
  let formKeyHits = 0;
  let registeredHits = 0;
  let checkHits = 0;
  let checkTotal = 0;
  let extra = 0;
  const latencies: number[] = [];
  const rows: unknown[] = [];

  console.log(`Label reader evaluation against ${BASE}\n`);
  for (const f of fixtures) {
    const { status, ms, body } = await scan(f.file);
    latencies.push(ms);
    if (status !== 200 || !body.items) {
      console.log(`FAIL  ${f.file.padEnd(8)} HTTP ${status} ${body.error?.code ?? ""} ${body.error?.message ?? ""}`);
      itemsExpected += f.items.length;
      rows.push({ file: f.file, status, error: body.error });
      continue;
    }
    const got = body.items;
    extra += Math.max(0, got.length - f.items.length);
    const notes: string[] = [];
    for (const exp of f.items) {
      itemsExpected++;
      const match = got.find((g) => g.formKey === exp.formKey);
      if (!match) {
        notes.push(`missing ${exp.formKey} (got ${got.map((g) => g.formKey).join(", ") || "nothing"})`);
        continue;
      }
      formKeyHits++;
      if (match.registered === exp.registered) registeredHits++;
      else notes.push(`registered=${match.registered}, expected ${exp.registered}`);
      const text = match.checks.map((c) => c.en).join(" | ");
      for (const c of exp.mustHaveChecks ?? []) {
        checkTotal++;
        if (text.includes(c)) checkHits++;
        else notes.push(`missing check "${c}"`);
      }
      for (const c of exp.mustNotHaveChecks ?? []) {
        checkTotal++;
        if (!text.includes(c)) checkHits++;
        else notes.push(`unexpected check "${c}"`);
      }
    }
    console.log(`${notes.length ? "FAIL" : "pass"}  ${f.file.padEnd(8)} ${String(ms).padStart(5)} ms  ${got.map((g) => g.formKey).join(", ")}${notes.length ? "\n        " + notes.join("\n        ") : ""}`);
    rows.push({ file: f.file, ms, got: got.map((g) => ({ formKey: g.formKey, registered: g.registered, checks: g.checks.map((c) => `${c.level}: ${c.en}`) })), notes });
  }

  latencies.sort((a, b) => a - b);
  const p = (q: number) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))];
  const summary = {
    images: fixtures.length,
    itemsExpected,
    formulationAccuracy: `${formKeyHits}/${itemsExpected}`,
    registrationCheck: `${registeredHits}/${formKeyHits}`,
    labelChecks: `${checkHits}/${checkTotal}`,
    extraItems: extra,
    latencyMs: { p50: p(0.5), max: latencies.at(-1) },
  };
  console.log("\n" + JSON.stringify(summary, null, 2));
  writeFileSync(join(process.cwd(), "eval", "last-label-run.json"), JSON.stringify({ at: new Date().toISOString(), base: BASE, summary, rows }, null, 2) + "\n");
  if (formKeyHits !== itemsExpected) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  console.error("Is the dev server running with GEMINI_API_KEY set?");
  process.exit(1);
});
