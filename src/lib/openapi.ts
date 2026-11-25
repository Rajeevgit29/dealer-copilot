import { z } from "zod";
import * as S from "./schemas";

// Make sure every schema with an id is registered before conversion.
void S;

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const jsonBody = (id: string) => ({ required: true, content: { "application/json": { schema: ref(id) } } });
const ok = (description: string) => ({ description, content: { "application/json": { schema: { type: "object" } } } });
const errors = {
  "400": { description: "Validation error", content: { "application/json": { schema: ref("Error") } } },
  "500": { description: "Server error", content: { "application/json": { schema: ref("Error") } } },
};

export function openApiSpec(origin: string) {
  const { schemas } = z.toJSONSchema(z.globalRegistry, { target: "openapi-3.0", uri: (id) => `#/components/schemas/${id}` }) as {
    schemas: Record<string, unknown>;
  };
  return {
    openapi: "3.0.3",
    info: {
      title: "Dealer Copilot API",
      version: "1.0.0",
      description:
        "Rotation-safe, label-approved crop protection advice for agri-input dealers. The /recommend, /check-product and /tank-mix endpoints are stateless and can be embedded in any retailer app.",
    },
    servers: [{ url: origin }],
    tags: [
      { name: "Advice", description: "Stateless rules engine" },
      { name: "Vision", description: "Photo reading (label, bill, pest)" },
      { name: "Counter", description: "Farmers, fields, spray history, sales" },
      { name: "Monitoring", description: "Traps, weather, insights" },
    ],
    paths: {
      "/api/v1/recommend": {
        post: { tags: ["Advice"], summary: "Rank approved options for a crop + pest against the spray history", requestBody: jsonBody("RecommendRequest"), responses: { "200": ok("Ranked options with reasons"), ...errors } },
      },
      "/api/v1/check-product": {
        post: { tags: ["Advice"], summary: "Can this field be sprayed with this formulation?", requestBody: jsonBody("CheckProductRequest"), responses: { "200": ok("Approval + reasons"), ...errors } },
      },
      "/api/v1/tank-mix": {
        post: { tags: ["Advice"], summary: "Check products the farmer wants to mix in one tank", requestBody: jsonBody("TankMixRequest"), responses: { "200": ok("Issues"), ...errors } },
      },
      "/api/v1/products": {
        get: { tags: ["Advice"], summary: "Search brands and registered formulations", parameters: [{ name: "q", in: "query", schema: { type: "string" } }], responses: { "200": ok("Products") } },
      },
      "/api/v1/reference": { get: { tags: ["Advice"], summary: "Crops, pests, districts, MoA groups, data source", responses: { "200": ok("Reference data") } } },
      "/api/v1/scan-label": {
        post: {
          tags: ["Vision"],
          summary: "Read a pesticide label or shop bill",
          description: "multipart/form-data with `image` (requires GEMINI_API_KEY), or JSON { sampleId } for a demo bottle.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" } }, required: ["image"] } },
              "application/json": { schema: ref("ScanSampleRequest") },
            },
          },
          responses: { "200": ok("Normalised items with MoA groups and label checks"), "503": { description: "AI disabled" }, ...errors },
        },
      },
      "/api/v1/diagnose": {
        post: {
          tags: ["Vision"],
          summary: "Likely pests/diseases from a crop photo",
          requestBody: {
            required: true,
            content: { "multipart/form-data": { schema: { type: "object", properties: { image: { type: "string", format: "binary" }, crop: { type: "string", enum: ["cotton", "paddy", "tomato", "chilli"] } }, required: ["image", "crop"] } } },
          },
          responses: { "200": ok("Up to 3 candidates with confidence"), "503": { description: "AI disabled" }, ...errors },
        },
      },
      "/api/v1/farmers": {
        get: { tags: ["Counter"], summary: "Find a farmer by phone (hashed lookup)", parameters: [{ name: "phone", in: "query", required: true, schema: { type: "string" } }], responses: { "200": ok("Farmer and fields"), ...errors } },
        post: { tags: ["Counter"], summary: "Create or update a farmer", requestBody: jsonBody("FarmerRequest"), responses: { "201": ok("Farmer"), ...errors } },
      },
      "/api/v1/farmers/{id}/fields": {
        post: { tags: ["Counter"], summary: "Add a field", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], requestBody: jsonBody("FieldRequest"), responses: { "201": ok("Field"), ...errors } },
      },
      "/api/v1/fields/{id}": {
        get: { tags: ["Counter"], summary: "Field with farmer and spray history", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": ok("Field"), "404": { description: "Not found" } } },
        patch: { tags: ["Counter"], summary: "Set next harvest / picking date", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], requestBody: jsonBody("FieldPatch"), responses: { "200": ok("Field"), ...errors } },
      },
      "/api/v1/fields/{id}/sprays": {
        post: { tags: ["Counter"], summary: "Add a past spray to the field's history", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], requestBody: jsonBody("SprayRequest"), responses: { "201": ok("Spray"), ...errors } },
      },
      "/api/v1/fields/{id}/sprays/{sprayId}": {
        delete: {
          tags: ["Counter"],
          summary: "Remove a spray entered by mistake",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "sprayId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: { "204": { description: "Deleted" }, "404": { description: "Not found" } },
        },
      },
      "/api/v1/consultations": {
        post: {
          tags: ["Counter"],
          summary: "Record a consultation and the sale (digital trace id)",
          parameters: [{ name: "x-dealer-id", in: "header", schema: { type: "string" } }],
          requestBody: jsonBody("ConsultationRequest"),
          responses: { "201": ok("Consultation + sale trace id"), "409": { description: "Chosen option is blocked" }, "422": { description: "Not approved" }, ...errors },
        },
      },
      "/api/v1/traps": {
        get: { tags: ["Monitoring"], summary: "Trap readings + threshold status", parameters: [{ name: "district", in: "query", required: true, schema: { type: "string" } }, { name: "pest", in: "query", schema: { type: "string" } }], responses: { "200": ok("Readings") } },
        post: { tags: ["Monitoring"], summary: "Log a pheromone trap count", requestBody: jsonBody("TrapCountRequest"), responses: { "201": ok("Saved"), ...errors } },
      },
      "/api/v1/weather": {
        get: { tags: ["Monitoring"], summary: "Spray window for the next 36 hours", parameters: [{ name: "district", in: "query", required: true, schema: { type: "string" } }], responses: { "200": ok("Hours and windows") } },
      },
      "/api/v1/insights": { get: { tags: ["Monitoring"], summary: "Aggregated resistance-pressure and pest data", responses: { "200": ok("Insights") } } },
      "/api/v1/health": { get: { tags: ["Monitoring"], summary: "Health check", responses: { "200": ok("OK"), "503": { description: "Database down" } } } },
    },
    components: {
      schemas: {
        ...schemas,
        Error: {
          type: "object",
          properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} }, required: ["code", "message"] } },
        },
      },
    },
  };
}
