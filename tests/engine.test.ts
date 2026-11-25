import { describe, expect, it } from "vitest";
import {
  checkFormulation,
  computeDose,
  formKey,
  groupsFor,
  moaFor,
  packPlan,
  productById,
  recommend,
  sprayWindows,
  assessHours,
  tankMix,
  trapStatus,
  canonicalActive,
  type SprayEvent,
} from "../src/engine";

const spray = (date: string, productId: string): SprayEvent => {
  const p = productById(productId)!;
  const actives = p.actives.map((a) => a.name);
  return { date, formKey: p.formKey, label: p.brand, actives, groups: groupsFor(actives).map((g) => g.code) };
};

const generic = (date: string, name: string, conc: number, formType: string): SprayEvent => {
  const key = formKey([{ name, concentration: conc }], formType);
  return { date, formKey: key, label: `${name} ${conc}% ${formType}`, actives: [name], groups: groupsFor([name]).map((g) => g.code) };
};

const cottonField = { crop: "cotton" as const, sowingDate: "2026-06-20", areaAcres: 2 };

describe("mode-of-action lookup", () => {
  it("maps Syngenta and competitor neonicotinoids to the same IRAC group", () => {
    expect(moaFor("thiamethoxam").group?.code).toBe("IRAC:4A");
    expect(moaFor("Imidacloprid").group?.code).toBe("IRAC:4A");
    expect(moaFor("acetamiprid").group?.code).toBe("IRAC:4A");
    expect(moaFor("azoxystrobin").group?.code).toBe("FRAC:11");
  });

  it("tolerates OCR typos and spelling variants", () => {
    expect(canonicalActive("Thiamethoxum")).toBe("thiamethoxam");
    expect(canonicalActive("Lambda Cyhalothrin")).toBe("lambda-cyhalothrin");
    expect(canonicalActive("Chlorpyriphos")).toBe("chlorpyrifos");
  });
});

describe("the three-bottle demo: three brands, one chemistry", () => {
  const history = [
    spray("2026-08-20", "syn-actara"), // Syngenta, thiamethoxam
    spray("2026-09-05", "bay-confidor"), // Bayer, imidacloprid
    generic("2026-09-22", "acetamiprid", 20, "SP"), // local brand
  ];
  const result = recommend({ field: cottonField, history, pestId: "whitefly", today: "2026-10-01" });

  it("counts three uses of Group 4A this season", () => {
    expect(result.groupUseCounts["IRAC:4A"]).toBe(3);
  });

  it("blocks every Group 4A option for whitefly", () => {
    const neonic = result.options.filter((o) => o.groups.some((g) => g.code === "IRAC:4A"));
    expect(neonic.length).toBeGreaterThan(0);
    for (const o of neonic) {
      expect(o.status).toBe("blocked");
      expect(o.reasons.map((r) => r.code)).toContain("SAME_GROUP_AS_LAST_SPRAY");
    }
  });

  it("still offers approved options from other groups, ranked first", () => {
    expect(result.summary.recommended + result.summary.caution).toBeGreaterThan(0);
    const top = result.options[0];
    expect(top.status).not.toBe("blocked");
    expect(top.groups.some((g) => g.code === "IRAC:4A")).toBe(false);
  });
});

describe("pre-harvest interval", () => {
  it("blocks options whose waiting period runs past the next picking", () => {
    const result = recommend({
      field: { crop: "tomato", sowingDate: "2026-08-01", areaAcres: 1, nextHarvestDate: "2026-11-11" },
      history: [],
      pestId: "fruit_borer",
      today: "2026-11-09",
    });
    expect(result.daysToHarvest).toBe(2);
    const blocked = result.options.filter((o) => o.phiDays != null && o.phiDays > 2);
    expect(blocked.length).toBeGreaterThan(0);
    for (const o of blocked) expect(o.reasons.map((r) => r.code)).toContain("PHI_EXCEEDS_HARVEST");
  });
});

describe("label approval", () => {
  const input = { field: { crop: "chilli" as const, sowingDate: "2026-07-01", areaAcres: 1 }, history: [], pestId: "thrips", today: "2026-10-01" };

  it("explains when a product is registered but not for this crop", () => {
    const actara = productById("syn-actara")!;
    const res = checkFormulation(actara.formKey, input);
    expect(res.approved).toBe(false);
    if (!res.approved) expect(res.reasons[0].en).toMatch(/not approved for this crop/i);
  });

  it("flags formulations that are not in the registered list at all", () => {
    const res = checkFormulation(formKey([{ name: "thiamethoxam", concentration: 33 }], "EC"), input);
    expect(res.approved).toBe(false);
    if (!res.approved) expect(res.reasons[0].en).toMatch(/not in the CIB&RC registered list/i);
  });

  it("only ever recommends formulations approved for the crop and pest", () => {
    const result = recommend({ ...input, history: [] });
    for (const o of result.options) {
      const res = checkFormulation(o.formKey, input);
      expect(res.approved).toBe(true);
    }
  });
});

describe("cotton-specific advice", () => {
  it("warns about pyrethroids early in the season", () => {
    const result = recommend({ field: cottonField, history: [], pestId: "american_bollworm", today: "2026-08-10" });
    const pyre = result.options.find((o) => o.groups.some((g) => g.code === "IRAC:3A") && o.groups.length === 1);
    expect(pyre).toBeDefined();
    expect(pyre!.reasons.map((r) => r.code)).toContain("PYRETHROID_EARLY_COTTON");
  });

  it("offers pheromone mating disruption for pink bollworm with no resistance pressure", () => {
    const result = recommend({ field: cottonField, history: [], pestId: "pink_bollworm", today: "2026-09-10" });
    const pher = result.options.find((o) => o.groups.some((g) => g.code === "PHER"));
    expect(pher).toBeDefined();
    expect(pher!.reasons.map((r) => r.code)).toContain("NO_RESISTANCE_RISK");
  });
});

describe("dose and packs", () => {
  it("converts a per-hectare dose to acres and picks packs that cover the full label rate", () => {
    const dose = computeDose({ min: 200, max: 200 }, { min: 500, max: 750 }, false, 2, [100, 250, 500])!;
    expect(dose.unit).toBe("g");
    expect(dose.perAcre.max).toBe(81);
    expect(dose.forField.max).toBe(165);
    expect(dose.packs).toEqual([{ size: 100, count: 2 }]);
  });

  it("returns null when the label dose is not per hectare", () => {
    expect(computeDose(null, null, true, 1, [100])).toBeNull();
  });

  it("finds the least-waste pack plan", () => {
    expect(packPlan(340, [250, 100])).toEqual([
      { size: 250, count: 1 },
      { size: 100, count: 1 },
    ]);
  });
});

describe("tank mix", () => {
  it("blocks two products with the same active ingredient", () => {
    const res = tankMix([
      { label: "Actara", actives: ["thiamethoxam"] },
      { label: "Local thiamethoxam", actives: ["thiamethoxam"] },
    ]);
    expect(res.issues.some((i) => i.severity === "block")).toBe(true);
  });

  it("warns when two products share a mode of action", () => {
    const res = tankMix([
      { label: "Actara", actives: ["thiamethoxam"] },
      { label: "Confidor", actives: ["imidacloprid"] },
    ]);
    expect(res.issues.map((i) => i.severity)).toEqual(["warn"]);
  });

  it("warns about cocktails of more than two products", () => {
    const res = tankMix([
      { label: "A", actives: ["thiamethoxam"] },
      { label: "B", actives: ["chlorantraniliprole"] },
      { label: "C", actives: ["azoxystrobin"] },
    ]);
    expect(res.issues.some((i) => /3 products/.test(i.en))).toBe(true);
  });
});

describe("pheromone trap threshold (ICAR-CICR pink bollworm)", () => {
  it("is above threshold after 3 consecutive days at 8+ moths", () => {
    const s = trapStatus(
      [
        { date: "2026-09-08", moths: 9 },
        { date: "2026-09-09", moths: 11 },
        { date: "2026-09-10", moths: 8 },
      ],
      "2026-09-10",
    );
    expect(s.level).toBe("above");
    expect(s.streak).toBe(3);
  });

  it("is on watch when the run is broken", () => {
    const s = trapStatus(
      [
        { date: "2026-09-08", moths: 9 },
        { date: "2026-09-09", moths: 4 },
        { date: "2026-09-10", moths: 10 },
      ],
      "2026-09-10",
    );
    expect(s.level).toBe("watch");
  });
});

describe("spray window", () => {
  const hours = (n: number, overrides: Partial<Record<"rain" | "wind", Record<number, number>>> = {}) => {
    const time = Array.from({ length: n }, (_, i) => `2026-11-09T${String(i).padStart(2, "0")}:00`);
    return {
      time,
      temperature: time.map(() => 28),
      humidity: time.map(() => 60),
      precipitation: time.map((_, i) => overrides.rain?.[i] ?? 0),
      precipProbability: time.map((_, i) => (overrides.rain?.[i] ? 90 : 5)),
      wind: time.map((_, i) => overrides.wind?.[i] ?? 8),
    };
  };

  it("finds the daylight window and rejects hours before rain", () => {
    const assessed = assessHours(hours(24, { rain: { 12: 2 } }));
    expect(assessed[10].reasons).toContain("rain");
    const windows = sprayWindows(assessed);
    expect(windows[0]).toMatchObject({ start: "2026-11-09T06:00", end: "2026-11-09T08:00" });
  });

  it("rejects windy hours", () => {
    const assessed = assessHours(hours(24, { wind: { 7: 22 } }));
    expect(assessed[7].verdict).toBe("bad");
    expect(assessed[7].reasons).toContain("wind");
  });
});
