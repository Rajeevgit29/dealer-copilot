import "server-only";
import { z } from "zod";
import {
  brandProductsByFormKey,
  canonicalActive,
  formKey,
  groupsFor,
  isRegisteredFormKey,
  moaFor,
  pestsForCrop,
  PRODUCTS,
  todayIso,
  type CropId,
} from "@/engine";
import { generateJson, type ImagePart } from "./gemini";

// ---------------------------------------------------------------------------
// Label / bill reading
// ---------------------------------------------------------------------------

const LabelItem = z.object({
  brand: z.string().nullish(),
  manufacturer: z.string().nullish(),
  activeIngredients: z.array(z.object({ name: z.string(), concentration: z.number().nullish(), unit: z.string().nullish() })).default([]),
  formulationType: z.string().nullish(),
  registrationNumber: z.string().nullish(),
  batchNumber: z.string().nullish(),
  manufactureDate: z.string().nullish(),
  expiryDate: z.string().nullish(),
  purchaseDate: z.string().nullish(),
});
export const LabelExtraction = z.object({
  documentType: z.enum(["label", "bill", "other"]),
  legibility: z.enum(["good", "partial", "poor"]),
  items: z.array(LabelItem).default([]),
});
export type LabelExtraction = z.infer<typeof LabelExtraction>;

const LABEL_SCHEMA = {
  type: "OBJECT",
  properties: {
    documentType: { type: "STRING", enum: ["label", "bill", "other"] },
    legibility: { type: "STRING", enum: ["good", "partial", "poor"] },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          brand: { type: "STRING", nullable: true },
          manufacturer: { type: "STRING", nullable: true },
          activeIngredients: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { name: { type: "STRING" }, concentration: { type: "NUMBER", nullable: true }, unit: { type: "STRING", nullable: true } },
              required: ["name"],
            },
          },
          formulationType: { type: "STRING", nullable: true },
          registrationNumber: { type: "STRING", nullable: true },
          batchNumber: { type: "STRING", nullable: true },
          manufactureDate: { type: "STRING", nullable: true },
          expiryDate: { type: "STRING", nullable: true },
          purchaseDate: { type: "STRING", nullable: true },
        },
        required: ["activeIngredients"],
      },
    },
  },
  required: ["documentType", "legibility", "items"],
};

const LABEL_SYSTEM = `You read photos of Indian agrochemical product labels and shop bills.
Copy only what is printed. Never guess or fill in from memory: if a field is not visible, return null.
Active ingredient names: use the chemical name as printed (e.g. "Thiamethoxam"), concentration as a number (25 for "25% WG").
Formulation type: the code after the concentration (EC, SC, WG, WP, SL, SP, SG, OD, ZC, CS, GR, DF, ...).
Registration number: the CIR / Regn. No. printed on Indian labels.
Dates: ISO format (YYYY-MM-DD, or YYYY-MM if the day is not printed).
For a bill, return one item per pesticide line.`;

export interface ScannedItem {
  brand: string | null;
  manufacturer: string | null;
  actives: { name: string; concentration: number | null; group: string | null; groupShort: string | null; groupName: string | null }[];
  formType: string | null;
  formKey: string;
  registered: boolean;
  matchedProductId: string | null;
  label: string;
  groups: string[];
  checks: { level: "ok" | "warn" | "bad"; en: string; hi: string }[];
  raw: z.infer<typeof LabelItem>;
}

/** Turn raw extraction into normalised, checked items. Pure apart from today's date. */
export function postProcessLabel(extraction: LabelExtraction, today = todayIso()): ScannedItem[] {
  return extraction.items
    .filter((it) => it.activeIngredients.length > 0)
    .map((it) => {
      const actives = it.activeIngredients.map((a) => ({ name: canonicalActive(a.name), concentration: a.concentration ?? null }));
      const formType = it.formulationType ? it.formulationType.toUpperCase().replace(/[^A-Z]/g, "") : null;
      const key = formKey(actives, formType);
      const registered = isRegisteredFormKey(key);
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
      const brandNorm = norm(it.brand ?? "");
      const mentions = (b: string) => brandNorm.length > 0 && norm(b).length >= 4 && brandNorm.includes(norm(b));
      // Prefer a brand with the same formulation; otherwise any brand named on the label (look-alike check).
      const brandMatch = brandProductsByFormKey(key).find((p) => mentions(p.brand)) ?? PRODUCTS.find((p) => !p.generic && mentions(p.brand));
      const checks: ScannedItem["checks"] = [];
      if (!registered) {
        checks.push({
          level: "bad",
          en: "This formulation (ingredient + strength + type) is not in the CIB&RC registered list. Possible spurious or misread label.",
          hi: "यह फ़ॉर्मूलेशन CIB&RC पंजीकृत सूची में नहीं है। नकली हो सकता है या लेबल ठीक से नहीं पढ़ा गया।",
        });
      } else {
        checks.push({ level: "ok", en: "Formulation is in the CIB&RC registered list.", hi: "फ़ॉर्मूलेशन CIB&RC सूची में पंजीकृत है।" });
      }
      if (brandMatch && brandMatch.formKey !== key) {
        checks.push({
          level: "bad",
          en: `Brand "${brandMatch.brand}" is normally ${brandMatch.formulation}. The label shows something different.`,
          hi: `"${brandMatch.brand}" ब्रांड आमतौर पर ${brandMatch.formulation} होता है। लेबल पर कुछ और लिखा है।`,
        });
      }
      if (it.expiryDate && it.expiryDate.slice(0, 10) < today) {
        checks.push({ level: "bad", en: `Expired on ${it.expiryDate}.`, hi: `${it.expiryDate} को एक्सपायर हो चुका है।` });
      }
      if (extraction.documentType === "label" && !it.registrationNumber) {
        checks.push({ level: "warn", en: "No CIR registration number found on the label.", hi: "लेबल पर CIR पंजीकरण संख्या नहीं मिली।" });
      }
      if (actives.some((a) => a.concentration == null) || !formType) {
        checks.push({ level: "warn", en: "Strength or formulation type not readable. Confirm with the dealer.", hi: "दवा की मात्रा या प्रकार साफ़ नहीं पढ़ा गया।" });
      }
      const groups = groupsFor(actives.map((a) => a.name));
      return {
        brand: it.brand ?? null,
        manufacturer: it.manufacturer ?? null,
        actives: actives.map((a) => {
          const m = moaFor(a.name);
          return { ...a, group: m.group?.code ?? null, groupShort: m.group?.short ?? null, groupName: m.group?.name ?? null };
        }),
        formType,
        formKey: key,
        registered,
        matchedProductId: brandMatch?.formKey === key ? brandMatch.id : null,
        label: brandMatch?.formKey === key ? brandMatch.brand : it.brand || actives.map((a) => `${a.name} ${a.concentration ?? ""}%`).join(" + ") + (formType ? ` ${formType}` : ""),
        groups: groups.map((g) => g.code),
        checks,
        raw: it,
      };
    });
}

export async function readLabel(images: ImagePart[]) {
  const { data, model, latencyMs } = await generateJson<unknown>({
    system: LABEL_SYSTEM,
    prompt: "Read this pesticide label or shop bill.",
    images,
    schema: LABEL_SCHEMA,
  });
  const extraction = LabelExtraction.parse(data);
  return { extraction, items: postProcessLabel(extraction), model, latencyMs };
}

// ---------------------------------------------------------------------------
// Pest / disease diagnosis
// ---------------------------------------------------------------------------

export const Diagnosis = z.object({
  candidates: z
    .array(z.object({ pestId: z.string(), confidence: z.number().min(0).max(1), evidence: z.string() }))
    .max(3),
  plantLooksHealthy: z.boolean(),
  imageUsable: z.boolean(),
  followUpQuestion: z.string().nullish(),
});
export type Diagnosis = z.infer<typeof Diagnosis>;

export async function diagnose(crop: CropId, images: ImagePart[]) {
  const pests = pestsForCrop(crop);
  const schema = {
    type: "OBJECT",
    properties: {
      candidates: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            pestId: { type: "STRING", enum: pests.map((p) => p.id) },
            confidence: { type: "NUMBER" },
            evidence: { type: "STRING" },
          },
          required: ["pestId", "confidence", "evidence"],
        },
      },
      plantLooksHealthy: { type: "BOOLEAN" },
      imageUsable: { type: "BOOLEAN" },
      followUpQuestion: { type: "STRING", nullable: true },
    },
    required: ["candidates", "plantLooksHealthy", "imageUsable"],
  };
  const list = pests.map((p) => `- ${p.id}: ${p.en} (${p.sci}). Signs: ${p.signs}`).join("\n");
  const { data, model, latencyMs } = await generateJson<unknown>({
    system: `You are an agronomy assistant helping an agri-input dealer in India identify crop problems from a farmer's photo.
Only choose from the provided list. Give at most 3 candidates with honest confidence (0-1). Evidence = what you actually see.
If the photo is unclear, set imageUsable=false. If confidence is below 0.6, ask ONE short follow-up question the dealer can ask the farmer.
Never recommend a product.`,
    prompt: `Crop: ${crop}. Possible problems:\n${list}`,
    images,
    schema,
  });
  const parsed = Diagnosis.parse(data);
  const ids = new Set(pests.map((p) => p.id));
  parsed.candidates = parsed.candidates.filter((c) => ids.has(c.pestId)).sort((a, b) => b.confidence - a.confidence);
  return { diagnosis: parsed, model, latencyMs };
}

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------

const MAX_BYTES = 6 * 1024 * 1024;
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function imagesFromForm(form: FormData, field = "image"): Promise<ImagePart[]> {
  const files = form.getAll(field).filter((f): f is File => f instanceof File);
  if (!files.length) throw new Error("No image uploaded");
  return Promise.all(
    files.slice(0, 4).map(async (f) => {
      if (!OK_TYPES.has(f.type)) throw new Error(`Unsupported image type: ${f.type || "unknown"}`);
      if (f.size > MAX_BYTES) throw new Error("Image is larger than 6 MB");
      return { mimeType: f.type, base64: Buffer.from(await f.arrayBuffer()).toString("base64") };
    }),
  );
}
