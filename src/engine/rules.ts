import { daysBetween } from "./dates";
import { computeDose } from "./dose";
import { msg } from "./messages";
import {
  approvedFor,
  approvedRowsForFormKey,
  brandProductsByFormKey,
  cropById,
  DATA_SOURCE,
  formKey,
  isLiquid,
  isRegisteredFormKey,
  moaFor,
  productsByFormKey,
} from "./reference";
import type {
  ApprovedUse,
  FieldContext,
  MoaGroup,
  Option,
  OptionStatus,
  Reason,
  RecommendInput,
  RecommendResult,
  SprayEvent,
} from "./types";

/** Policy knobs. Defaults follow IRAC/FRAC rotation guidance in simplified form. */
export const POLICY = {
  /** A spray older than this is treated as a different pest generation. */
  consecutiveWindowDays: 30,
  /** Uses of one group per season before we warn / block. */
  seasonWarnAt: 2,
  seasonBlockAt: 3,
  /** Cotton: avoid pyrethroids before this crop age (whitefly resurgence). */
  pyrethroidCottonMinAge: 90,
};

const METHOD_RANK: Record<string, number> = { spray: 0, granules: 1, soil_drench: 2, nursery: 3, seed_treatment: 4 };
const STATUS_RANK: Record<OptionStatus, number> = { recommended: 0, caution: 1, blocked: 2 };

export interface Season {
  cropAgeDays: number;
  daysToHarvest: number | null;
  lastSpray: SprayEvent | null;
  groupUseCounts: Record<string, number>;
  flowering: boolean;
}

export function seasonContext(field: FieldContext, history: SprayEvent[], today: string): Season {
  const crop = cropById(field.crop);
  const cropAgeDays = Math.max(0, daysBetween(field.sowingDate, today));
  let daysToHarvest: number | null = null;
  if (field.nextHarvestDate) daysToHarvest = daysBetween(today, field.nextHarvestDate);
  else if (crop && cropAgeDays < crop.firstHarvestDays) daysToHarvest = crop.firstHarvestDays - cropAgeDays;

  const season = history
    .filter((h) => h.date >= field.sowingDate && h.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = season.at(-1) ?? null;
  const lastSpray = last && daysBetween(last.date, today) <= POLICY.consecutiveWindowDays ? last : null;

  const groupUseCounts: Record<string, number> = {};
  for (const ev of season) for (const code of new Set(ev.groups)) groupUseCounts[code] = (groupUseCounts[code] ?? 0) + 1;

  const flowering = !!crop?.flowering && cropAgeDays >= crop.flowering[0] && cropAgeDays <= crop.flowering[1];
  return { cropAgeDays, daysToHarvest, lastSpray, groupUseCounts, flowering };
}

/** Apply every rotation / safety rule to one formulation. Pure: no I/O. */
export function evaluate(
  row: Pick<ApprovedUse, "actives" | "phiDays" | "method" | "genericBollwormClaim" | "crop">,
  season: Season,
): { reasons: Reason[]; status: OptionStatus; score: number; groups: MoaGroup[] } {
  const reasons: Reason[] = [];
  const moas = row.actives.map((a) => moaFor(a.name));
  const groups = [...new Map(moas.filter((m) => m.group).map((m) => [m.group!.code, m.group!])).values()];

  if (row.method !== "spray") reasons.push(msg.specialMethod(row.method));

  let allNew = groups.length > 0;
  for (const grp of groups) {
    if (grp.noResistanceRisk) continue;
    const used = season.groupUseCounts[grp.code] ?? 0;
    if (used > 0) allNew = false;
    if (season.lastSpray?.groups.includes(grp.code)) {
      reasons.push(msg.sameAsLast(grp, season.lastSpray.label));
    } else if (used >= POLICY.seasonBlockAt) {
      reasons.push(msg.seasonLimit(grp, used, true));
    } else if (used >= POLICY.seasonWarnAt) {
      reasons.push(msg.seasonLimit(grp, used, false));
    } else if (used === 1) {
      reasons.push(msg.usedBefore(grp));
    }
    if (grp.risk === "high" && used >= 1) reasons.push(msg.highRiskFungicide(grp));
  }
  for (const m of moas) if (!m.group && m.active !== "mepiquat chloride") reasons.push(msg.unknownGroup(m.active));

  if (season.daysToHarvest != null && row.phiDays != null && row.phiDays > season.daysToHarvest) {
    reasons.push(msg.phiExceeds(row.phiDays, Math.max(0, season.daysToHarvest)));
  } else if (row.phiDays == null) {
    reasons.push(msg.phiUnknown());
  }

  const broadOrBee = groups.some((x) => x.beeHazard || x.code === "IRAC:1B" || x.code === "IRAC:3A" || x.code === "IRAC:2B");
  if (season.flowering && broadOrBee) reasons.push(msg.beeHazard());
  if (row.crop === "cotton" && season.cropAgeDays < POLICY.pyrethroidCottonMinAge && groups.some((x) => x.code === "IRAC:3A")) {
    reasons.push(msg.pyrethroidEarly());
  }

  if (groups.some((x) => x.noResistanceRisk)) reasons.push(msg.noResistance());
  else if (groups.length && groups.every((x) => x.profile === "selective")) reasons.push(msg.selective());
  if (allNew && !groups.some((x) => x.noResistanceRisk)) reasons.push(msg.newGroup());
  if (row.genericBollwormClaim) reasons.push(msg.genericBollworm());

  const status: OptionStatus = reasons.some((r) => r.severity === "block")
    ? "blocked"
    : reasons.some((r) => r.severity === "warn")
      ? "caution"
      : "recommended";

  let score = 100;
  for (const rr of reasons) score += rr.severity === "block" ? -100 : rr.severity === "warn" ? -20 : rr.severity === "good" ? 8 : 0;
  if (groups.some((x) => x.profile === "broad")) score -= 6;
  score -= Math.min(15, (row.phiDays ?? 10) / 4);
  score -= (METHOD_RANK[row.method] ?? 3) * 6;
  return { reasons, status, score: Math.round(score), groups };
}

function toOption(rows: ApprovedUse[], season: Season, areaAcres: number): Option {
  // Several rows can describe the same formulation for this crop+pest; prefer a spray row with a parsable dose.
  const row = [...rows].sort(
    (a, b) =>
      (METHOD_RANK[a.method] ?? 9) - (METHOD_RANK[b.method] ?? 9) ||
      Number(!a.doseFormulationPerHa) - Number(!b.doseFormulationPerHa) ||
      (a.phiDays ?? 99) - (b.phiDays ?? 99),
  )[0];
  const key = formKey(row.actives, row.formType);
  const { reasons, status, score, groups } = evaluate(row, season);
  const brands = brandProductsByFormKey(key);
  const packs = brands[0]?.packs ?? productsByFormKey(key)[0]?.packs ?? [100, 250, 500, 1000];
  const liquid = row.liquid ?? isLiquid(row.formType);
  return {
    formKey: key,
    formulation: row.formulation,
    kind: row.kind,
    method: row.method,
    actives: row.actives.map((a) => moaFor(a.name)),
    groups,
    approvedUseId: row.id,
    pestRaw: row.pestRaw,
    phiDays: row.phiDays,
    dose: computeDose(row.doseFormulationPerHa, row.waterPerHa, liquid, areaAcres, packs),
    doseRaw: row.doseFormulationRaw,
    products: [
      ...brands.map((p) => ({ id: p.id, brand: p.brand, company: p.company, generic: false })),
      { id: `generic:${key}`, brand: "Any brand", company: null, generic: true },
    ],
    status,
    score,
    reasons,
    source: row.source,
  };
}

/** Rank every approved option for a crop + pest against the field's spray history. */
export function recommend(input: RecommendInput): RecommendResult {
  const { field, history, pestId, today } = input;
  const season = seasonContext(field, history, today);
  const byKey = new Map<string, ApprovedUse[]>();
  for (const row of approvedFor(field.crop, pestId)) {
    if (row.method === "seed_treatment" || row.method === "nursery") continue;
    const k = formKey(row.actives, row.formType);
    byKey.set(k, [...(byKey.get(k) ?? []), row]);
  }
  const options = [...byKey.values()]
    .map((rows) => toOption(rows, season, field.areaAcres))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.score - a.score || a.formulation.localeCompare(b.formulation));

  const summary = { recommended: 0, caution: 0, blocked: 0, total: options.length };
  for (const o of options) summary[o.status]++;

  return {
    crop: field.crop,
    pestId,
    cropAgeDays: season.cropAgeDays,
    daysToHarvest: season.daysToHarvest,
    lastSpray: season.lastSpray,
    groupUseCounts: season.groupUseCounts,
    options,
    summary,
    dataSource: DATA_SOURCE,
  };
}

/** Check one product the farmer asked for by name ("Can I spray X?"). */
export function checkFormulation(key: string, input: RecommendInput) {
  const { field, history, pestId, today } = input;
  const season = seasonContext(field, history, today);
  const forPest = approvedFor(field.crop, pestId).filter((r) => formKey(r.actives, r.formType) === key);
  if (forPest.length) {
    const option = toOption(forPest, season, field.areaAcres);
    return { approved: true as const, option };
  }
  const forCrop = approvedRowsForFormKey(field.crop, key);
  const detail = forCrop.length ? "pest" : isRegisteredFormKey(key) ? "crop" : "unregistered";
  return { approved: false as const, reasons: [msg.notApproved(detail)], approvedPests: [...new Set(forCrop.flatMap((r) => r.pests))] };
}

export interface MixIssue {
  severity: "block" | "warn";
  en: string;
  hi: string;
}

/** Tank-mix sanity check for products the farmer wants to spray together. */
export function tankMix(items: { label: string; actives: string[] }[]): { issues: MixIssue[]; groups: string[] } {
  const issues: MixIssue[] = [];
  const activeSeen = new Map<string, string>();
  const groupSeen = new Map<string, string>();
  for (const it of items) {
    for (const a of it.actives) {
      const m = moaFor(a);
      const prev = activeSeen.get(m.active);
      if (prev && prev !== it.label) {
        issues.push({
          severity: "block",
          en: `${it.label} and ${prev} contain the same active ingredient (${m.active}). This is a double dose, not a mix.`,
          hi: `${it.label} और ${prev} में एक ही दवा (${m.active}) है। यह दोगुनी खुराक है, मिश्रण नहीं।`,
        });
      }
      activeSeen.set(m.active, it.label);
      if (m.group) {
        const prevG = groupSeen.get(m.group.code);
        if (prevG && prevG !== it.label && !prev) {
          issues.push({
            severity: "warn",
            en: `${it.label} and ${prevG} are both Group ${m.group.short}. Mixing them adds resistance pressure without a second mode of action.`,
            hi: `${it.label} और ${prevG} दोनों ग्रुप ${m.group.short} के हैं। इन्हें मिलाने से फायदा नहीं, प्रतिरोध बढ़ता है।`,
          });
        }
        groupSeen.set(m.group.code, it.label);
      }
    }
  }
  if (items.length > 2) {
    issues.push({
      severity: "warn",
      en: `${items.length} products in one tank. Labels do not cover this mix; physical compatibility and crop safety are untested.`,
      hi: `एक टंकी में ${items.length} दवाएं। लेबल में ऐसा मिश्रण नहीं है; फसल को नुकसान हो सकता है।`,
    });
  }
  return { issues: dedupe(issues), groups: [...groupSeen.keys()] };
}

const dedupe = (xs: MixIssue[]) => [...new Map(xs.map((x) => [x.en, x])).values()];
