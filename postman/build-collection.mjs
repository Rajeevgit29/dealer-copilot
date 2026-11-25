// Generates postman/dealer-copilot.postman_collection.json (Postman v2.1).
// Run: node postman/build-collection.mjs && postman collection run postman/dealer-copilot.postman_collection.json
import { writeFileSync } from "node:fs";

const json = (body) => ({ mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } });
const req = (name, method, path, { body, tests, query } = {}) => ({
  name,
  request: {
    method,
    header: body ? [{ key: "content-type", value: "application/json" }] : [],
    url: { raw: `{{baseUrl}}${path}${query ? "?" + query : ""}`, host: ["{{baseUrl}}"], path: path.split("/").filter(Boolean), query: query ? query.split("&").map((kv) => ({ key: kv.split("=")[0], value: kv.split("=")[1] })) : undefined },
    body: body ? json(body) : undefined,
  },
  event: [{ listen: "test", script: { type: "text/javascript", exec: tests.trim().split("\n") } }],
});

const demoField = { crop: "cotton", sowingDate: "2026-06-20", areaAcres: 2 };
const threeBottles = [
  { date: "2026-09-25", formKey: "thiamethoxam@25|WG", label: "Actara", actives: ["thiamethoxam"] },
  { date: "2026-10-12", formKey: "imidacloprid@17.8|SL", label: "Confidor", actives: ["imidacloprid"] },
  { date: "2026-10-28", formKey: "acetamiprid@20|SP", label: "Local 20 SP", actives: ["acetamiprid"] },
];

const collection = {
  info: {
    name: "Dealer Copilot API",
    description: "Contract and behaviour tests for the Dealer Copilot API. Read-only except where noted; the consultation test is rejected by the server before anything is written.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [{ key: "baseUrl", value: "http://localhost:4700" }],
  item: [
    {
      name: "Platform",
      item: [
        req("Health", "GET", "/api/v1/health", {
          tests: `
pm.test("200 and database up", () => { pm.response.to.have.status(200); pm.expect(pm.response.json().db).to.eql(true); });
pm.test("approved-use table is loaded", () => pm.expect(pm.response.json().data.approvedUses).to.be.above(500));`,
        }),
        req("OpenAPI spec", "GET", "/api/openapi.json", {
          tests: `
const s = pm.response.json();
pm.test("is OpenAPI 3", () => pm.expect(s.openapi).to.match(/^3\\./));
pm.test("documents the stateless advice endpoints", () => ["/api/v1/recommend", "/api/v1/check-product", "/api/v1/tank-mix"].forEach((p) => pm.expect(s.paths).to.have.property(p)));
pm.test("request schemas generated from zod", () => pm.expect(s.components.schemas).to.have.property("RecommendRequest"));`,
        }),
        req("Reference data", "GET", "/api/v1/reference", {
          tests: `
const r = pm.response.json();
pm.test("four crops", () => pm.expect(r.crops.map((c) => c.id)).to.have.members(["cotton", "paddy", "tomato", "chilli"]));
pm.test("pests have Hindi names", () => r.pests.forEach((p) => pm.expect(p.hi).to.be.a("string").and.not.empty));
pm.test("data source is CIB&RC", () => pm.expect(r.dataSource.name).to.include("CIB&RC"));`,
        }),
      ],
    },
    {
      name: "Advice (stateless)",
      item: [
        req("Recommend: three brands, one chemistry", "POST", "/api/v1/recommend", {
          body: { field: demoField, history: threeBottles, pestId: "whitefly", today: "2026-11-09" },
          tests: `
const r = pm.response.json();
pm.test("200", () => pm.response.to.have.status(200));
pm.test("counts three Group 4A sprays", () => pm.expect(r.groupUseCounts["IRAC:4A"]).to.eql(3));
pm.test("every neonicotinoid option is blocked", () => {
  const neo = r.options.filter((o) => o.groups.some((g) => g.code === "IRAC:4A"));
  pm.expect(neo.length).to.be.above(0);
  neo.forEach((o) => pm.expect(o.status).to.eql("blocked"));
});
pm.test("top option is usable and from another group", () => {
  pm.expect(r.options[0].status).to.not.eql("blocked");
  pm.expect(r.options[0].groups.map((g) => g.code)).to.not.include("IRAC:4A");
});
pm.test("every option cites its CIB&RC page", () => r.options.forEach((o) => pm.expect(o.source.page).to.be.a("number")));
pm.test("reasons are bilingual", () => r.options[0].reasons.forEach((x) => { pm.expect(x.en).to.be.a("string"); pm.expect(x.hi).to.be.a("string"); }));
pm.test("responds quickly", () => pm.expect(pm.response.responseTime).to.be.below(1500));`,
        }),
        req("Recommend: waiting period blocks near harvest", "POST", "/api/v1/recommend", {
          body: { field: { crop: "tomato", sowingDate: "2026-08-01", areaAcres: 1, nextHarvestDate: "2026-11-11" }, history: [], pestId: "fruit_borer", today: "2026-11-09" },
          tests: `
const r = pm.response.json();
pm.test("2 days to harvest", () => pm.expect(r.daysToHarvest).to.eql(2));
pm.test("options with a longer waiting period are blocked", () => r.options.filter((o) => o.phiDays > 2).forEach((o) => {
  pm.expect(o.status).to.eql("blocked");
  pm.expect(o.reasons.map((x) => x.code)).to.include("PHI_EXCEEDS_HARVEST");
}));`,
        }),
        req("Recommend: validation error", "POST", "/api/v1/recommend", {
          body: { field: { crop: "wheat" }, pestId: "x" },
          tests: `
pm.test("400 VALIDATION", () => { pm.response.to.have.status(400); pm.expect(pm.response.json().error.code).to.eql("VALIDATION"); });`,
        }),
        req("Recommend: unknown pest", "POST", "/api/v1/recommend", {
          body: { field: demoField, history: [], pestId: "dragon" },
          tests: `
pm.test("400 BAD_PEST", () => { pm.response.to.have.status(400); pm.expect(pm.response.json().error.code).to.eql("BAD_PEST"); });`,
        }),
        req("Check product: Actara on chilli thrips", "POST", "/api/v1/check-product", {
          body: { field: { crop: "chilli", sowingDate: "2026-07-01", areaAcres: 1 }, history: [], pestId: "thrips", formKey: "thiamethoxam@25|WG" },
          tests: `
const r = pm.response.json();
pm.test("not approved for this crop", () => { pm.expect(r.approved).to.eql(false); pm.expect(r.reasons[0].en).to.match(/not approved for this crop/i); });`,
        }),
        req("Check product: unregistered formulation", "POST", "/api/v1/check-product", {
          body: { field: demoField, history: [], pestId: "whitefly", formKey: "thiamethoxam@30|EC" },
          tests: `
pm.test("flagged as not in the registered list", () => pm.expect(pm.response.json().reasons[0].en).to.include("not in the CIB&RC registered list"));`,
        }),
        req("Tank mix: two neonicotinoids", "POST", "/api/v1/tank-mix", {
          body: { items: [{ label: "Actara", actives: ["thiamethoxam"] }, { label: "Confidor", actives: ["imidacloprid"] }] },
          tests: `
const r = pm.response.json();
pm.test("one same-group warning", () => { pm.expect(r.issues).to.have.length(1); pm.expect(r.issues[0].severity).to.eql("warn"); });`,
        }),
        req("Products: search by brand", "GET", "/api/v1/products", {
          query: "q=actara",
          tests: `
const p = pm.response.json().products[0];
pm.test("Actara first, mapped to IRAC 4A", () => { pm.expect(p.brand).to.eql("Actara"); pm.expect(p.groups[0].code).to.eql("IRAC:4A"); });`,
        }),
      ],
    },
    {
      name: "Vision (demo samples)",
      item: [
        req("Scan: suspect bottle", "POST", "/api/v1/scan-label", {
          body: { sampleId: "suspect" },
          tests: `
const it = pm.response.json().items[0];
pm.test("OCR typo normalised", () => pm.expect(it.actives[0].name).to.eql("thiamethoxam"));
pm.test("not registered", () => pm.expect(it.registered).to.eql(false));
pm.test("look-alike brand flagged", () => pm.expect(it.checks.map((c) => c.en).join(" ")).to.include('Brand "Actara" is normally'));`,
        }),
        req("Scan: shop bill with three items", "POST", "/api/v1/scan-label", {
          body: { sampleId: "bill" },
          tests: `
const items = pm.response.json().items;
pm.test("three items", () => pm.expect(items).to.have.length(3));
pm.test("each mapped to a mode of action", () => items.forEach((i) => pm.expect(i.groups.length).to.be.above(0)));`,
        }),
      ],
    },
    {
      name: "Counter",
      item: [
        req("Farmer lookup: invalid phone", "GET", "/api/v1/farmers", {
          query: "phone=12345",
          tests: `
pm.test("400 INVALID_PHONE", () => { pm.response.to.have.status(400); pm.expect(pm.response.json().error.code).to.eql("INVALID_PHONE"); });`,
        }),
        req("Farmer lookup: demo farmer", "GET", "/api/v1/farmers", {
          query: "phone=9876543210",
          tests: `
const r = pm.response.json();
pm.test("found, phone never returned", () => { pm.expect(r.farmer.phone_last4).to.eql("3210"); pm.expect(JSON.stringify(r)).to.not.include("9876543210"); });
pm.collectionVariables.set("fieldId", r.fields[0].id);`,
        }),
        req("Field with spray history", "GET", "/api/v1/fields/{{fieldId}}", {
          tests: `
const r = pm.response.json();
pm.test("has a spray history with MoA groups", () => { pm.expect(r.sprays.length).to.be.at.least(3); r.sprays.forEach((s) => pm.expect(s.groups).to.be.an("array")); });`,
        }),
        req("Consultation: selling a blocked option is refused", "POST", "/api/v1/consultations", {
          body: { fieldId: "{{fieldId}}", pestId: "whitefly", chosen: { formKey: "thiamethoxam@25|WG", label: "Actara" } },
          tests: `
pm.test("409 BLOCKED (server re-runs the rules)", () => { pm.response.to.have.status(409); pm.expect(pm.response.json().error.code).to.eql("BLOCKED"); });`,
        }),
      ],
    },
    {
      name: "Monitoring",
      item: [
        req("Traps: pink bollworm in Yavatmal", "GET", "/api/v1/traps", {
          query: "district=yavatmal&pest=pink_bollworm",
          tests: `
const r = pm.response.json();
pm.test("ICAR-CICR threshold", () => { pm.expect(r.threshold.etlMothsPerTrapPerDay).to.eql(8); pm.expect(r.threshold.consecutiveDays).to.eql(3); });
pm.test("status is one of the known levels", () => pm.expect(["above", "watch", "below", "no_data"]).to.include(r.status.level));`,
        }),
        req("Weather: spray window", "GET", "/api/v1/weather", {
          query: "district=yavatmal",
          tests: `
const r = pm.response.json();
pm.test("200 with availability flag", () => { pm.response.to.have.status(200); pm.expect(r).to.have.property("available"); });
if (r.available) pm.test("hours are assessed", () => pm.expect(["good", "ok", "bad"]).to.include(r.now.verdict));`,
        }),
        req("Insights", "GET", "/api/v1/insights", {
          tests: `
const r = pm.response.json();
pm.test("aggregates only", () => { pm.expect(r.totals.fields).to.be.above(0); pm.expect(JSON.stringify(r)).to.not.include("phone_hash"); });`,
        }),
      ],
    },
  ],
};

writeFileSync(new URL("./dealer-copilot.postman_collection.json", import.meta.url), JSON.stringify(collection, null, 2) + "\n");
console.log("wrote postman/dealer-copilot.postman_collection.json");
