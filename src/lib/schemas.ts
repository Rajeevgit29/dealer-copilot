import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const crop = z.enum(["cotton", "paddy", "tomato", "chilli"]);

export const SprayEventIn = z
  .object({
    date: isoDate,
    formKey: z.string().min(3),
    label: z.string().min(1).max(120),
    actives: z.array(z.string().min(2)).min(1),
  })
  .meta({ id: "SprayEvent" });

export const FieldContextIn = z
  .object({
    crop,
    sowingDate: isoDate,
    areaAcres: z.number().positive().max(500),
    nextHarvestDate: isoDate.nullish(),
  })
  .meta({ id: "FieldContext" });

export const RecommendBody = z
  .object({
    field: FieldContextIn,
    history: z.array(SprayEventIn).max(60).default([]),
    pestId: z.string().min(2),
    today: isoDate.optional(),
  })
  .meta({ id: "RecommendRequest", description: "Stateless: send the field and its spray history, get ranked options. No database needed." });

export const CheckProductBody = RecommendBody.extend({ formKey: z.string().min(3) }).meta({ id: "CheckProductRequest" });

export const TankMixBody = z
  .object({ items: z.array(z.object({ label: z.string().min(1), actives: z.array(z.string().min(2)).min(1) })).min(2).max(6) })
  .meta({ id: "TankMixRequest" });

export const FarmerBody = z
  .object({
    phone: z.string().min(10).max(16),
    name: z.string().max(60).nullish(),
    village: z.string().max(60).nullish(),
    districtId: z.string().min(2),
  })
  .meta({ id: "FarmerRequest" });

export const FieldBody = z
  .object({
    label: z.string().min(1).max(60).default("Main field"),
    crop,
    sowingDate: isoDate,
    areaAcres: z.number().positive().max(500),
    nextHarvestDate: isoDate.nullish(),
  })
  .meta({ id: "FieldRequest" });

export const FieldPatchBody = z.object({ nextHarvestDate: isoDate.nullable() }).meta({ id: "FieldPatch" });

export const SprayBody = z
  .object({
    date: isoDate,
    formKey: z.string().min(3),
    label: z.string().min(1).max(120),
    productId: z.string().nullish(),
    actives: z.array(z.string().min(2)).min(1),
    source: z.enum(["scan", "manual", "passport"]).default("manual"),
  })
  .meta({ id: "SprayRequest" });

export const ConsultationBody = z
  .object({
    fieldId: z.uuid(),
    pestId: z.string().min(2),
    diagnosisSource: z.enum(["photo", "manual"]).default("manual"),
    diagnosisConfidence: z.number().min(0).max(1).nullish(),
    requestedFormKey: z.string().nullish(),
    chosen: z
      .object({ formKey: z.string().min(3), productId: z.string().nullish(), label: z.string().min(1).max(120) })
      .nullish(),
  })
  .meta({ id: "ConsultationRequest", description: "The server re-runs the rules on the stored history; the client cannot sell a blocked option." });

export const TrapBody = z
  .object({
    districtId: z.string().min(2),
    pestId: z.string().default("pink_bollworm"),
    date: isoDate,
    moths: z.number().int().min(0).max(500),
    trapLabel: z.string().max(40).nullish(),
  })
  .meta({ id: "TrapCountRequest" });

export const ScanSampleBody = z.object({ sampleId: z.string() }).meta({ id: "ScanSampleRequest" });
