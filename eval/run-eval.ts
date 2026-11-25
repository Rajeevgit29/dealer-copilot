/**
 * Scenario evaluation for the rules engine, plus an optional LLM baseline.
 *
 *   npm run eval                 # engine scenarios (no network)
 *   GEMINI_API_KEY=... npm run eval -- --baseline
 *                                # also ask a plain LLM the same questions and
 *                                # measure how often it repeats a group or goes off-label
 */
import { writeFileSync } from "node:fs";
import {
  approvedFor,
  checkFormulation,
  formKey,
  groupsFor,
  PESTS,
  recommend,
  tankMix,
  type CropId,
  type RecommendResult,
  type SprayEvent,
} from "../src/engine";

try {
  process.loadEnvFile(".env.local");
} catch {}

const ev = (date: string, name: string, conc: number, ft: string, label?: string): SprayEvent => ({
  date,
  formKey: formKey([{ name, concentration: conc }], ft),
  label: label ?? `${name} ${conc}% ${ft}`,
  actives: [name],
  groups: groupsFor([name]).map((g) => g.code),
});

interface Scenario {
  id: string;
  story: string;
  crop: CropId;
  sowing: string;
  today: string;
  pest: string;
  nextHarvest?: string;
  history: SprayEvent[];
  expect: (r: RecommendResult) => string | null; // null = pass, else failure message
}

const usable = (r: RecommendResult) => r.options.filter((o) => o.status !== "blocked");

const SCENARIOS: Scenario[] = [
  {
    id: "three-brands-one-chemistry",
    story: "Cotton whitefly after Actara, Confidor and a local acetamiprid",
    crop: "cotton", sowing: "2026-06-20", today: "2026-11-09", pest: "whitefly",
    history: [ev("2026-09-25", "thiamethoxam", 25, "WG", "Actara"), ev("2026-10-12", "imidacloprid", 17.8, "SL", "Confidor"), ev("2026-10-28", "acetamiprid", 20, "SP")],
    expect: (r) => (usable(r).some((o) => o.groups.some((g) => g.code === "IRAC:4A")) ? "a 4A option is still usable" : usable(r).length ? null : "no usable option"),
  },
  {
    id: "one-neonic-ten-days-ago",
    story: "Cotton jassid, a neonicotinoid 10 days ago",
    crop: "cotton", sowing: "2026-06-20", today: "2026-08-30", pest: "jassid",
    history: [ev("2026-08-20", "imidacloprid", 17.8, "SL")],
    expect: (r) => (usable(r).some((o) => o.groups.some((g) => g.code === "IRAC:4A")) ? "4A not blocked right after a 4A spray" : null),
  },
  {
    id: "old-spray-is-a-new-generation",
    story: "Cotton jassid, the only neonicotinoid was 40 days ago",
    crop: "cotton", sowing: "2026-06-20", today: "2026-09-29", pest: "jassid",
    history: [ev("2026-08-20", "imidacloprid", 17.8, "SL")],
    expect: (r) => (r.options.some((o) => o.groups.some((g) => g.code === "IRAC:4A") && o.reasons.some((x) => x.code === "SAME_GROUP_AS_LAST_SPRAY")) ? "40-day-old spray treated as consecutive" : null),
  },
  {
    id: "two-days-to-picking",
    story: "Tomato fruit borer, picking in 2 days",
    crop: "tomato", sowing: "2026-08-01", today: "2026-11-09", pest: "fruit_borer", nextHarvest: "2026-11-11", history: [],
    expect: (r) => (usable(r).some((o) => o.phiDays != null && o.phiDays > 2) ? "an option with PHI > 2 days is usable" : null),
  },
  {
    id: "chilli-diamide-twice",
    story: "Chilli thrips after two diamide sprays",
    crop: "chilli", sowing: "2026-07-20", today: "2026-10-20", pest: "thrips",
    history: [ev("2026-09-20", "cyantraniliprole", 10.26, "OD"), ev("2026-10-08", "chlorantraniliprole", 18.5, "SC")],
    expect: (r) => (usable(r).some((o) => o.groups.some((g) => g.code === "IRAC:28")) ? "a diamide is still usable" : null),
  },
  {
    id: "paddy-strobilurin-then-blast",
    story: "Paddy blast, azoxystrobin was the last spray",
    crop: "paddy", sowing: "2026-06-25", today: "2026-09-15", pest: "blast",
    history: [ev("2026-09-01", "azoxystrobin", 23, "SC", "Amistar")],
    expect: (r) =>
      usable(r).some((o) => o.groups.some((g) => g.code === "FRAC:11"))
        ? "a QoI is still usable right after a QoI"
        : usable(r).some((o) => o.groups.some((g) => g.code === "FRAC:16.1"))
          ? null
          : "tricyclazole (FRAC 16.1) not offered",
  },
  {
    id: "pbw-pheromone",
    story: "Cotton pink bollworm, no history",
    crop: "cotton", sowing: "2026-06-20", today: "2026-09-10", pest: "pink_bollworm", history: [],
    expect: (r) => (r.options.some((o) => o.groups.some((g) => g.code === "PHER") && o.status !== "blocked") ? null : "pheromone option missing"),
  },
  {
    id: "early-pyrethroid",
    story: "Cotton American bollworm at 50 days",
    crop: "cotton", sowing: "2026-06-20", today: "2026-08-09", pest: "american_bollworm", history: [],
    expect: (r) => {
      const p = r.options.filter((o) => o.groups.length === 1 && o.groups[0].code === "IRAC:3A");
      return p.length && p.every((o) => o.status !== "recommended") ? null : "solo pyrethroids not flagged early in the season";
    },
  },
  {
    id: "paddy-bph-clean",
    story: "Paddy BPH, no history, 60 days old",
    crop: "paddy", sowing: "2026-06-25", today: "2026-08-24", pest: "bph", history: [],
    expect: (r) => (r.summary.recommended > 0 ? null : "nothing recommended"),
  },
];

// Invariants checked across every crop x pest combination.
function invariants(): string[] {
  const fails: string[] = [];
  const combos: [CropId, string][] = PESTS.map((p) => [p.crop, p.id]);
  for (const [crop, pest] of combos) {
    const input = { field: { crop, sowingDate: "2026-07-01", areaAcres: 1 }, history: [], pestId: pest, today: "2026-09-01" };
    const r = recommend(input);
    for (const o of r.options) {
      if (!checkFormulation(o.formKey, input).approved) fails.push(`${crop}/${pest}: ${o.formulation} recommended but not approved`);
      if (o.dose && o.dose.forField.max + 1e-9 < o.dose.perAcre.max) fails.push(`${crop}/${pest}: field dose below per-acre dose`);
    }
  }
  const mix = tankMix([{ label: "A", actives: ["thiamethoxam"] }, { label: "B", actives: ["thiamethoxam"] }]);
  if (!mix.issues.some((i) => i.severity === "block")) fails.push("duplicate active in tank mix not blocked");
  return fails;
}

async function baseline(results: { id: string; story: string; history: SprayEvent[]; crop: CropId; pest: string; lastGroups: string[] }[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log("\nBaseline skipped: set GEMINI_API_KEY to compare against a plain LLM.");
    return null;
  }
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  let repeats = 0;
  let offLabel = 0;
  let answered = 0;
  for (const s of results) {
    const prompt = `I am an agri-input dealer in India. A farmer's ${s.crop} field has ${s.pest.replace("_", " ")}. ` +
      `Sprays so far this season: ${s.history.map((h) => `${h.date}: ${h.label}`).join("; ") || "none"}. ` +
      `Which one pesticide should I sell? Reply as JSON {"activeIngredient": string, "concentrationPercent": number, "formulationType": string}.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    if (!res.ok) continue;
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    try {
      const a = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { activeIngredient: string; concentrationPercent: number; formulationType: string };
      answered++;
      const groups = groupsFor([a.activeIngredient]).map((g) => g.code);
      if (groups.some((g) => s.lastGroups.includes(g))) repeats++;
      const k = formKey([{ name: a.activeIngredient, concentration: a.concentrationPercent }], a.formulationType);
      const ok = approvedFor(s.crop, s.pest).some((r) => formKey(r.actives, r.formType) === k);
      if (!ok) offLabel++;
      console.log(`  ${s.id.padEnd(30)} LLM → ${a.activeIngredient} ${a.concentrationPercent}% ${a.formulationType}${groups.some((g) => s.lastGroups.includes(g)) ? "  [repeats last group]" : ""}${ok ? "" : "  [not an approved use]"}`);
    } catch {}
  }
  return { model, answered, repeats, offLabel };
}

async function main() {
  console.log("Dealer Copilot · scenario evaluation\n");
  const rows: { id: string; pass: boolean; note: string; recommended: number; blocked: number }[] = [];
  for (const s of SCENARIOS) {
    const r = recommend({ field: { crop: s.crop, sowingDate: s.sowing, areaAcres: 2, nextHarvestDate: s.nextHarvest ?? null }, history: s.history, pestId: s.pest, today: s.today });
    const fail = s.expect(r);
    rows.push({ id: s.id, pass: !fail, note: fail ?? s.story, recommended: r.summary.recommended, blocked: r.summary.blocked });
    console.log(`${fail ? "FAIL" : "pass"}  ${s.id.padEnd(30)} ${String(r.summary.recommended).padStart(3)} rec ${String(r.summary.blocked).padStart(3)} blocked   ${fail ?? s.story}`);
  }
  const inv = invariants();
  console.log(`\nInvariants across every crop × pest: ${inv.length ? inv.length + " failures" : "all hold"}`);
  inv.slice(0, 10).forEach((f) => console.log("  - " + f));

  const passed = rows.filter((r) => r.pass).length;
  console.log(`\nScenarios: ${passed}/${rows.length} passed`);

  let base = null;
  if (process.argv.includes("--baseline")) {
    console.log("\nBaseline: plain LLM, same questions, no rules");
    base = await baseline(SCENARIOS.map((s) => ({ id: s.id, story: s.story, history: s.history, crop: s.crop, pest: s.pest, lastGroups: s.history.at(-1)?.groups ?? [] })));
    if (base) console.log(`  ${base.model}: ${base.repeats}/${base.answered} answers repeat the last spray's group, ${base.offLabel}/${base.answered} are not an approved use (copilot: 0 and 0 by construction)`);
  }

  writeFileSync("eval/last-run.json", JSON.stringify({ at: new Date().toISOString(), scenarios: rows, invariantFailures: inv, baseline: base }, null, 2) + "\n");
  if (passed !== rows.length || inv.length) process.exit(1);
}

main();
