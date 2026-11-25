import type { Dose, Range } from "./types";

export const HA_PER_ACRE = 0.404686;

// Always round up: a quantity below the label rate under-doses the pest.
const ceilTo = (n: number, step: number) => Math.ceil(n / step - 1e-9) * step;
const niceQty = (n: number) => (n >= 100 ? ceilTo(n, 5) : n >= 10 ? ceilTo(n, 1) : Math.ceil(n * 10 - 1e-9) / 10);

const scale = (r: Range, f: number): Range => ({ min: niceQty(r.min * f), max: niceQty(r.max * f) });

/**
 * Pack combination that covers `need`, trading off leftover product against
 * the number of packs (each extra pack costs ~8% of the need). Pack sizes are
 * few, so a bounded search is fine.
 */
export function packPlan(need: number, sizes: number[]): { size: number; count: number }[] | null {
  const packs = [...new Set(sizes)].filter((s) => s > 0).sort((a, b) => b - a);
  if (!packs.length || need <= 0) return null;
  const perPack = need * 0.08;
  let best: { counts: number[]; cost: number } | null = null;
  const counts = new Array(packs.length).fill(0);
  const maxEach = packs.map((s) => Math.ceil(need / s));
  const walk = (i: number, total: number, n: number) => {
    if (n > 12) return;
    if (total >= need) {
      const cost = total - need + n * perPack;
      if (!best || cost < best.cost - 1e-9) best = { counts: [...counts], cost };
      return;
    }
    if (i === packs.length) return;
    for (let c = maxEach[i]; c >= 0; c--) {
      counts[i] = c;
      walk(i + 1, total + c * packs[i], n + c);
    }
    counts[i] = 0;
  };
  walk(0, 0, 0);
  if (!best) return null;
  const chosen = best as { counts: number[] };
  return packs.map((size, i) => ({ size, count: chosen.counts[i] })).filter((p) => p.count > 0);
}

/**
 * Convert a per-hectare label dose into per-acre and whole-field quantities.
 * Uses the top of the label range for the quantity to sell: IRAC advises the
 * full label rate, because under-dosing selects for resistance.
 */
export function computeDose(perHa: Range | null, waterPerHa: Range | null, liquid: boolean, areaAcres: number, packs: number[]): Dose | null {
  if (!perHa) return null;
  const perAcre = scale(perHa, HA_PER_ACRE);
  const forField = scale(perHa, HA_PER_ACRE * areaAcres);
  return {
    perAcre,
    unit: liquid ? "ml" : "g",
    waterPerAcre: waterPerHa ? scale(waterPerHa, HA_PER_ACRE) : null,
    forField,
    packs: packPlan(perHa.max * HA_PER_ACRE * areaAcres, packs),
  };
}
