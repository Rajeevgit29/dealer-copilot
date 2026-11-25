/**
 * Seed a SYNTHETIC Kharif-2026 season so the insights dashboard has data.
 * Nothing here is real farmer data. Every consultation is run through the
 * real rules engine, so rule hits and outcomes are what the engine decided.
 *
 * Usage: npm run db:seed   (wipes counter tables first)
 */
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import {
  addDays,
  brandProductsByFormKey,
  daysBetween,
  DISTRICTS,
  formKey,
  groupsFor,
  productById,
  recommend,
  type CropId,
  type Option,
  type SprayEvent,
} from "../src/engine";
import { hashPhone } from "../src/lib/phone";

try {
  process.loadEnvFile(".env.local");
} catch {}

const TODAY = process.env.SEED_TODAY ?? "2026-11-09";
const ROLLOUT = "2026-09-01"; // copilot "goes live" at demo dealers

// ---------------------------------------------------------------- PRNG
let seed = 20261109;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const weighted = <T,>(pairs: [T, number][]) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

// ---------------------------------------------------------------- shape of the season
const SOWING: Record<CropId, [string, number]> = {
  cotton: ["2026-06-05", 40],
  paddy: ["2026-06-25", 35],
  chilli: ["2026-07-15", 45],
  tomato: ["2026-08-01", 55],
};

const PEST_MIX: Record<CropId, [string, number][]> = {
  cotton: [["whitefly", 26], ["pink_bollworm", 20], ["jassid", 14], ["american_bollworm", 9], ["thrips", 9], ["aphid", 8], ["spodoptera", 5], ["mites", 3], ["leaf_spot", 3], ["grey_mildew", 3]],
  paddy: [["stem_borer", 26], ["bph", 22], ["leaf_folder", 18], ["blast", 14], ["sheath_blight", 12], ["false_smut", 4], ["brown_spot", 4]],
  chilli: [["thrips", 34], ["mites", 16], ["fruit_borer", 12], ["anthracnose", 16], ["whitefly", 8], ["powdery_mildew", 8], ["aphid", 6]],
  tomato: [["fruit_borer", 26], ["whitefly", 18], ["late_blight", 16], ["early_blight", 16], ["leaf_miner", 10], ["tuta", 8], ["thrips", 6]],
};

// How strongly farmers in a district keep buying the same chemistry before the copilot.
const REPEAT_BIAS: Record<string, number> = {
  yavatmal: 0.72, jalna: 0.66, guntur: 0.7, bathinda: 0.62, sirsa: 0.6, adilabad: 0.58, wardha: 0.5, amravati: 0.5,
  akola: 0.48, jalgaon: 0.45, warangal: 0.55, khammam: 0.52, raichur: 0.42, thanjavur: 0.4, kolar: 0.46, nashik: 0.44,
};
// Groups farmers reach for by habit (cheap, familiar).
const HABIT_GROUPS = new Set(["IRAC:4A", "IRAC:3A", "IRAC:1B", "IRAC:28", "FRAC:11", "FRAC:3"]);

const PBW_PEAK: Record<string, [number, string]> = {
  yavatmal: [15, "2026-11-01"], jalna: [12, "2026-10-28"], adilabad: [11, "2026-10-20"], bathinda: [9, "2026-10-10"],
  sirsa: [12, "2026-11-03"], wardha: [8, "2026-10-25"], amravati: [7, "2026-10-18"], akola: [9, "2026-10-30"],
  jalgaon: [5, "2026-10-12"], warangal: [6, "2026-10-15"], raichur: [4, "2026-10-08"],
};

const SHOPS = ["Shree Krishna Agro Kendra", "Kisan Seva Kendra", "Om Sai Agro Agencies", "Jai Kisan Krishi Seva", "Balaji Agro Traders", "Annapurna Krishi Kendra", "Ganesh Krishi Bhandar", "Laxmi Agro Services", "Vinayak Agro Centre", "Bhumi Krishi Seva Kendra"];
const OWNERS = ["Ramesh", "Sunil", "Prakash", "Mahesh", "Anil", "Venkat", "Srinivas", "Gurpreet", "Rajesh", "Murugan", "Naresh", "Santosh"];
const FARMERS = ["Suresh", "Vitthal", "Dnyaneshwar", "Balu", "Ravi", "Lakshmi", "Narsimha", "Harpal", "Baldev", "Kumar", "Anand", "Savita", "Ganesh", "Sakharam", "Ramu", "Muthu", "Shankar", "Gopal", "Sunita", "Krishna"];
const VILLAGES = ["Ner", "Pusad", "Arni", "Ghatanji", "Wani", "Kalamb", "Malegaon", "Shirur", "Karanja", "Hinganghat", "Pandhurna", "Mudhol"];

type Pg = Client;

function sprayOf(o: Pick<Option, "formKey" | "formulation" | "actives">, date: string, label?: string): SprayEvent {
  const actives = o.actives.map((a) => a.active);
  return { date, formKey: o.formKey, label: label ?? o.formulation, actives, groups: groupsFor(actives).map((g) => g.code) };
}

/** Pick what a farmer would buy without the copilot: habit + repetition. */
function naiveChoice(options: Option[], history: SprayEvent[], district: string): Option | null {
  const sprayable = options.filter((o) => o.method === "spray");
  if (!sprayable.length) return null;
  const last = history.at(-1);
  if (last && rand() < (REPEAT_BIAS[district] ?? 0.45)) {
    const same = sprayable.filter((o) => o.groups.some((g) => last.groups.includes(g.code)));
    if (same.length) return pick(same);
  }
  return weighted(sprayable.map((o) => [o, o.groups.some((g) => HABIT_GROUPS.has(g.code)) ? 5 : 1] as [Option, number]));
}

function brandFor(key: string): { productId: string | null; label: string | null; company: string | null } {
  const brands = brandProductsByFormKey(key);
  if (brands.length && rand() < 0.6) {
    const b = pick(brands);
    return { productId: b.id, label: b.brand, company: b.company };
  }
  return { productId: null, label: null, company: null };
}

async function main() {
  const db: Pg = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query("truncate trap_counts, sales, rule_hits, consultations, spray_events, fields, farmers, dealers restart identity cascade");

  // ---------------------------------------------------------- dealers
  const dealersByDistrict = new Map<string, string[]>();
  let shopIdx = 0;
  for (const d of DISTRICTS) {
    const ids: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const id = `dealer-${d.id}-${i}`;
      const shop = SHOPS[shopIdx++ % SHOPS.length];
      await db.query("insert into dealers (id, name, shop_name, district_id) values ($1,$2,$3,$4)", [id, `${pick(OWNERS)} ${pick(["Patil", "Reddy", "Singh", "Rao", "Jadhav", "Kumar", "Deshmukh"])}`, shop, d.id]);
      ids.push(id);
    }
    dealersByDistrict.set(d.id, ids);
  }
  // A fixed dealer for the walkthrough.
  await db.query("update dealers set name = 'Ramesh Patil', shop_name = 'Shree Krishna Agro Kendra' where id = 'dealer-yavatmal-1'");

  let nFields = 0;
  let nSprays = 0;
  let nConsults = 0;

  // ---------------------------------------------------------- farmers, fields, season
  for (const d of DISTRICTS) {
    const nFarmers = between(34, 52);
    for (let f = 0; f < nFarmers; f++) {
      const phone = `9${String(between(100000000, 999999999))}`;
      const farmer = await db.query<{ id: string }>(
        "insert into farmers (phone_hash, phone_last4, name, village, district_id) values ($1,$2,$3,$4,$5) on conflict (phone_hash) do nothing returning id",
        [hashPhone(phone), phone.slice(-4), pick(FARMERS), pick(VILLAGES), d.id],
      );
      if (!farmer.rows[0]) continue;
      const crop = pick(d.crops);
      const [start, spread] = SOWING[crop];
      const sowing = addDays(start, between(0, spread));
      if (sowing > addDays(TODAY, -25)) continue;
      const area = Math.round((0.5 + rand() ** 1.6 * 5) * 2) / 2;
      const field = await db.query<{ id: string }>(
        "insert into fields (farmer_id, label, crop, sowing_date, area_acres) values ($1,$2,$3,$4,$5) returning id",
        [farmer.rows[0].id, "Main field", crop, sowing, area],
      );
      const fieldId = field.rows[0].id;
      nFields++;

      const history: SprayEvent[] = [];
      let date = addDays(sowing, between(22, 34));
      while (date <= TODAY) {
        const pestId = weighted(PEST_MIX[crop]);
        const dealer = pick(dealersByDistrict.get(d.id)!);
        const ctx = { crop, sowingDate: sowing, areaAcres: area };
        const rec = recommend({ field: ctx, history, pestId, today: date });
        const naive = naiveChoice(rec.options, history, d.id);
        if (!naive) {
          date = addDays(date, between(10, 20));
          continue;
        }

        let chosen = naive;
        let source: SprayEvent["source"] = rand() < 0.5 ? "manual" : "scan";
        if (date >= ROLLOUT && rand() < 0.85) {
          // Consultation at a copilot dealer.
          const asked = rand() < 0.55 ? naive : null;
          const usable = rec.options.filter((o) => o.status !== "blocked" && o.method === "spray");
          const best = usable.find((o) => o.status === "recommended") ?? usable[0] ?? naive;
          const keepAsked = asked && asked.status !== "blocked";
          chosen = keepAsked ? asked : rand() < 0.88 ? best : naive; // dealers sometimes override
          source = "sale";

          const created = `${date}T${String(between(4, 12)).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}:00Z`;
          const c = await db.query<{ id: string }>(
            `insert into consultations (dealer_id, field_id, pest_id, diagnosis_source, diagnosis_confidence, options_total, options_recommended, options_blocked,
               requested_form_key, requested_status, chosen_form_key, chosen_status, created_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
            [
              dealer, fieldId, pestId, rand() < 0.6 ? "photo" : "manual", rand() < 0.6 ? 0.62 + rand() * 0.35 : null,
              rec.summary.total, rec.summary.recommended, rec.summary.blocked,
              asked?.formKey ?? null, asked?.status ?? null, chosen.formKey, chosen.status, created,
            ],
          );
          const hits = new Map<string, { severity: string; n: number }>();
          for (const o of rec.options) for (const r of o.reasons) if (r.severity === "block" || r.severity === "warn") {
            const h = hits.get(r.code) ?? { severity: r.severity, n: 0 };
            h.n++;
            hits.set(r.code, h);
          }
          for (const [code, h] of hits) {
            await db.query("insert into rule_hits (consultation_id, code, severity, hits) values ($1,$2,$3,$4)", [c.rows[0].id, code, h.severity, h.n]);
          }
          const brand = brandFor(chosen.formKey);
          const qty = chosen.dose?.forField.max ?? null;
          await db.query(
            "insert into sales (trace_id, consultation_id, dealer_id, field_id, product_id, form_key, label, quantity, unit, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [`DC-${date.replaceAll("-", "").slice(2)}-${randomBytes(3).toString("hex").toUpperCase()}`, c.rows[0].id, dealer, fieldId, brand.productId, chosen.formKey, brand.label ?? chosen.formulation, qty, chosen.dose?.unit ?? null, created],
          );
          nConsults++;
        }

        const brand = brandFor(chosen.formKey);
        const ev = sprayOf(chosen, date, brand.label ?? chosen.formulation);
        history.push(ev);
        await db.query(
          "insert into spray_events (field_id, sprayed_on, form_key, label, product_id, company, actives, groups, source, dealer_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [fieldId, date, ev.formKey, ev.label, brand.productId, brand.company, ev.actives, ev.groups, source, dealer],
        );
        nSprays++;
        date = addDays(date, between(11, 21));
      }
    }
  }

  // ---------------------------------------------------------- the walkthrough farmer (three brands, one chemistry)
  const demoPhone = "9876543210";
  const demoFarmer = await db.query<{ id: string }>(
    "insert into farmers (phone_hash, phone_last4, name, village, district_id) values ($1,$2,'Suresh Jadhav','Ner','yavatmal') on conflict (phone_hash) do update set name = excluded.name returning id",
    [hashPhone(demoPhone), demoPhone.slice(-4)],
  );
  const demoField = await db.query<{ id: string }>(
    "insert into fields (farmer_id, label, crop, sowing_date, area_acres, passport_token) values ($1,'Field near the canal','cotton','2026-06-20',2,'demo-suresh-cotton') returning id",
    [demoFarmer.rows[0].id],
  );
  const demoSprays: [string, string | null, [string, number], string, string][] = [
    ["2026-09-25", "syn-actara", ["thiamethoxam", 25], "WG", "dealer-yavatmal-1"],
    ["2026-10-12", "bay-confidor", ["imidacloprid", 17.8], "SL", "dealer-yavatmal-2"],
    ["2026-10-28", null, ["acetamiprid", 20], "SP", "dealer-yavatmal-2"],
  ];
  for (const [date, productId, [name, conc], ft, dealer] of demoSprays) {
    const p = productId ? productById(productId) : null;
    const key = formKey([{ name, concentration: conc }], ft);
    await db.query(
      "insert into spray_events (field_id, sprayed_on, form_key, label, product_id, company, actives, groups, source, dealer_id) values ($1,$2,$3,$4,$5,$6,$7,$8,'scan',$9)",
      [demoField.rows[0].id, date, key, p?.brand ?? "Acetamiprid 20% SP (local brand)", productId, p?.company ?? null, [name], groupsFor([name]).map((g) => g.code), dealer],
    );
  }

  // ---------------------------------------------------------- pheromone traps (pink bollworm)
  let nTraps = 0;
  for (const [districtId, [peak, peakDate]] of Object.entries(PBW_PEAK)) {
    const dealer = dealersByDistrict.get(districtId)![0];
    for (let date = "2026-08-15"; date <= TODAY; date = addDays(date, 1)) {
      if (rand() < 0.12) continue; // missed readings
      const x = daysBetween(peakDate, date) / 16;
      const mean = 1 + peak * Math.exp(-x * x);
      const moths = Math.max(0, Math.round(mean + (rand() - 0.5) * mean * 0.6));
      await db.query("insert into trap_counts (dealer_id, district_id, pest_id, count_date, moths, trap_label) values ($1,$2,'pink_bollworm',$3,$4,'Trap 1')", [dealer, districtId, date, moths]);
      nTraps++;
    }
  }

  console.log({ fields: nFields, sprays: nSprays, consultations: nConsults, trapReadings: nTraps, today: TODAY });
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
