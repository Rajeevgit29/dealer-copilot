import approvedJson from "../../data/generated/approved_uses.json";
import moaJson from "../../data/reference/moa.json";
import pestsJson from "../../data/reference/pests.json";
import cropsJson from "../../data/reference/crops.json";
import districtsJson from "../../data/reference/districts.json";
import productsJson from "../../data/reference/products.json";
import type { Active, ActiveMoa, ApprovedUse, CropId, MoaGroup, Product } from "./types";

// ---------------------------------------------------------------------------
// Static reference data, indexed once per process.
// ---------------------------------------------------------------------------

export const DATA_SOURCE = {
  name: approvedJson.source,
  asOn: approvedJson.asOn,
  url: approvedJson.sourceUrl,
};

export const APPROVED_USES = approvedJson.rows as unknown as ApprovedUse[];

export interface Crop {
  id: CropId;
  en: string;
  hi: string;
  firstHarvestDays: number;
  multiPick: boolean;
  flowering: [number, number] | null;
}
export const CROPS = cropsJson.crops as Crop[];
export const cropById = (id: string) => CROPS.find((c) => c.id === id);

export interface Pest {
  id: string;
  crop: CropId;
  kind: "insect" | "mite" | "disease";
  en: string;
  hi: string;
  sci: string;
  signs: string;
  trap?: { etlMothsPerTrapPerDay: number; consecutiveDays: number; trapsPerHa: number; source: string; sourceUrl: string };
}
export const PESTS = pestsJson.pests as Pest[];
export const pestsForCrop = (crop: string) => PESTS.filter((p) => p.crop === crop);
export const pestFor = (crop: string, id: string) => PESTS.find((p) => p.crop === crop && p.id === id);

export interface District {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  crops: CropId[];
}
export const DISTRICTS = districtsJson.districts as District[];
export const districtById = (id: string) => DISTRICTS.find((d) => d.id === id);

// ---------------------------------------------------------------------------
// Mode of action
// ---------------------------------------------------------------------------

type MoaEntry = string | { group: string | null; confidence?: string; note?: string };
const GROUP_META = moaJson.groups as Record<string, Omit<MoaGroup, "code" | "short" | "scheme">>;
const ACTIVE_MOA = moaJson.actives as Record<string, MoaEntry>;

export function groupByCode(code: string): MoaGroup | null {
  const meta = GROUP_META[code];
  if (!meta) return null;
  const [scheme, short] = code.includes(":") ? (code.split(":") as [MoaGroup["scheme"], string]) : (["PHER", "PHER"] as const);
  return { code, short, scheme, ...meta };
}

export const ALL_GROUPS: MoaGroup[] = Object.keys(GROUP_META)
  .map((c) => groupByCode(c))
  .filter((g): g is MoaGroup => g !== null);

export function moaFor(active: string): ActiveMoa {
  const name = canonicalActive(active);
  const entry = ACTIVE_MOA[name];
  if (entry === undefined) return { active: name, group: null, confidence: "check", note: "Not in the reference table" };
  if (typeof entry === "string") return { active: name, group: groupByCode(entry), confidence: "ok" };
  return {
    active: name,
    group: entry.group ? groupByCode(entry.group) : null,
    confidence: entry.confidence === "check" ? "check" : "ok",
    note: entry.note,
  };
}

/** Unique MoA groups for a list of actives (a mixture can carry two groups). */
export function groupsFor(actives: string[]): MoaGroup[] {
  const seen = new Map<string, MoaGroup>();
  for (const a of actives) {
    const g = moaFor(a).group;
    if (g && !seen.has(g.code)) seen.set(g.code, g);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Active-ingredient name matching (labels, OCR output, typed search)
// ---------------------------------------------------------------------------

const KNOWN_ACTIVES = Object.keys(ACTIVE_MOA);
const EXTRA_ALIASES: Record<string, string> = {
  "lambda cyhalothrin": "lambda-cyhalothrin",
  "l-cyhalothrin": "lambda-cyhalothrin",
  "emamectin": "emamectin benzoate",
  "chlorpyriphos": "chlorpyrifos",
  "kresoxim methyl": "kresoxim-methyl",
  "metalaxyl m": "metalaxyl-m",
  "mefenoxam": "metalaxyl-m",
  "thiophanate methyl": "thiophanate-methyl",
  "cartap": "cartap hydrochloride",
  "cartap hcl": "cartap hydrochloride",
  "alphacypermethrin": "alpha-cypermethrin",
  "alpha cypermethrin": "alpha-cypermethrin",
  "difenconazole": "difenoconazole",
  "streptomycin": "streptomycin sulphate",
  "copper oxy chloride": "copper oxychloride",
  "sulfur": "sulphur",
  "wettable sulphur": "sulphur",
  "propamocarb": "propamocarb hydrochloride",
};

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function canonicalActive(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (ACTIVE_MOA[s] !== undefined) return s;
  if (EXTRA_ALIASES[s]) return EXTRA_ALIASES[s];
  const hyphenless = s.replace(/-/g, " ");
  const direct = KNOWN_ACTIVES.find((k) => k.replace(/-/g, " ") === hyphenless);
  if (direct) return direct;
  // Tolerate small OCR errors on long names.
  if (s.length >= 7) {
    let best: string | null = null;
    let bestD = Infinity;
    for (const k of KNOWN_ACTIVES) {
      const d = levenshtein(hyphenless, k.replace(/-/g, " "));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best && bestD <= Math.max(1, Math.floor(s.length / 8))) return best;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Formulations and products
// ---------------------------------------------------------------------------

const LIQUID_TYPES = new Set(["EC", "SC", "SL", "OD", "ZC", "CS", "EW", "SE", "ME", "DC", "FS", "FLOWABLE", "CONCENTRATE", "OS"]);
export const isLiquid = (formType: string | null | undefined) => (formType ? LIQUID_TYPES.has(formType.toUpperCase()) : false);

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Stable key for a formulation: sorted actives with concentration + formulation type. */
export function formKey(actives: { name: string; concentration: number | null }[], formType: string | null): string {
  const parts = actives
    .map((a) => `${canonicalActive(a.name)}@${a.concentration == null ? "?" : round(a.concentration)}`)
    .sort();
  return `${parts.join("+")}|${(formType ?? "?").toUpperCase()}`;
}

const FORMULATION_BY_KEY = new Map<string, { label: string; actives: Active[]; formType: string | null; liquid: boolean }>();
for (const row of APPROVED_USES) {
  const key = formKey(row.actives, row.formType);
  if (!FORMULATION_BY_KEY.has(key)) {
    FORMULATION_BY_KEY.set(key, {
      label: row.formulation,
      actives: row.actives,
      formType: row.formType,
      liquid: row.liquid ?? isLiquid(row.formType),
    });
  }
}

export const isRegisteredFormKey = (key: string) => FORMULATION_BY_KEY.has(key);

const DEFAULT_PACKS_LIQUID = [100, 250, 500, 1000];
const DEFAULT_PACKS_SOLID = [100, 250, 500, 1000];

function prettyFormulation(actives: Active[], formType: string | null) {
  const a = actives
    .map((x) => `${x.name.replace(/\b\w/g, (c) => c.toUpperCase())} ${x.concentration ?? ""}${x.unit && x.unit !== "%" ? " " + x.unit : "%"}`)
    .join(" + ");
  return `${a} ${formType ?? ""}`.trim();
}

const brandProducts: Product[] = (productsJson.products as { id: string; brand: string; company: string; actives: [string, number][]; formType: string; packs: number[] }[]).map((p) => {
  const actives: Active[] = p.actives.map(([name, concentration]) => ({ name, concentration, unit: "%" }));
  const key = formKey(actives, p.formType);
  const reg = FORMULATION_BY_KEY.get(key);
  return {
    id: p.id,
    brand: p.brand,
    company: p.company,
    generic: false,
    formulation: reg?.label ?? prettyFormulation(actives, p.formType),
    formKey: key,
    formType: p.formType,
    liquid: isLiquid(p.formType),
    actives,
    packs: p.packs,
  };
});

const genericProducts: Product[] = [...FORMULATION_BY_KEY.entries()].map(([key, f], i) => ({
  id: `gen-${String(i + 1).padStart(4, "0")}`,
  brand: "Any brand",
  company: null,
  generic: true,
  formulation: f.label,
  formKey: key,
  formType: f.formType,
  liquid: f.liquid,
  actives: f.actives,
  packs: f.liquid ? DEFAULT_PACKS_LIQUID : DEFAULT_PACKS_SOLID,
}));

export const PRODUCTS: Product[] = [...brandProducts, ...genericProducts];
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const productsByFormKey = (key: string) => PRODUCTS.filter((p) => p.formKey === key);
export const brandProductsByFormKey = (key: string) => brandProducts.filter((p) => p.formKey === key);

/** Search by brand, company or active ingredient. Brands first. */
export function searchProducts(q: string, limit = 12): Product[] {
  const s = q.trim().toLowerCase();
  if (!s) return brandProducts.slice(0, limit);
  const score = (p: Product) => {
    const brand = p.brand.toLowerCase();
    if (!p.generic && brand.startsWith(s)) return 0;
    if (!p.generic && brand.includes(s)) return 1;
    if (p.actives.some((a) => a.name.startsWith(s))) return p.generic ? 3 : 2;
    if (p.formulation.toLowerCase().includes(s)) return p.generic ? 5 : 4;
    if (p.company?.toLowerCase().includes(s)) return 6;
    return 99;
  };
  return PRODUCTS.map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.p.formulation.length - b.p.formulation.length)
    .slice(0, limit)
    .map((x) => x.p);
}

// ---------------------------------------------------------------------------
// Approved uses
// ---------------------------------------------------------------------------

const APPROVED_INDEX = new Map<string, ApprovedUse[]>();
for (const row of APPROVED_USES) {
  for (const pest of row.pests) {
    const k = `${row.crop}:${pest}`;
    const list = APPROVED_INDEX.get(k) ?? [];
    list.push(row);
    APPROVED_INDEX.set(k, list);
  }
}

export const approvedFor = (crop: string, pest: string) => APPROVED_INDEX.get(`${crop}:${pest}`) ?? [];

export function approvedRowsForFormKey(crop: string, key: string): ApprovedUse[] {
  return APPROVED_USES.filter((r) => r.crop === crop && formKey(r.actives, r.formType) === key);
}
