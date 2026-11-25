import { recommend, todayIso } from "@/engine";
import { HttpError, body, dealerId, handle, json } from "@/lib/http";
import { getDealer, getField, recordConsultation, toSprayEvent } from "@/lib/repo";
import { ConsultationBody } from "@/lib/schemas";

/**
 * Record a counter consultation and (optionally) the sale. The rules are re-run
 * here on the stored history, so a client cannot record a sale of a blocked option.
 */
export const POST = handle(async (req: Request) => {
  const input = await body(req, ConsultationBody);
  const dealer = await getDealer(await dealerId());
  if (!dealer) throw new HttpError(401, "UNKNOWN_DEALER", "Unknown dealer");
  const data = await getField(input.fieldId);
  if (!data) throw new HttpError(404, "NOT_FOUND", "Field not found");
  const { field, sprays } = data;
  const result = recommend({
    field: { crop: field.crop, sowingDate: field.sowing_date, areaAcres: Number(field.area_acres), nextHarvestDate: field.next_harvest_date },
    history: sprays.map(toSprayEvent),
    pestId: input.pestId,
    today: todayIso(),
  });

  let requested = null;
  if (input.requestedFormKey) {
    const o = result.options.find((x) => x.formKey === input.requestedFormKey);
    requested = { formKey: input.requestedFormKey, status: o ? o.status : ("not_approved" as const) };
  }

  let chosen = null;
  if (input.chosen) {
    const option = result.options.find((x) => x.formKey === input.chosen!.formKey);
    if (!option) throw new HttpError(422, "NOT_APPROVED", "This product is not approved for this crop and pest");
    if (option.status === "blocked") {
      throw new HttpError(409, "BLOCKED", "This option is blocked by the rules for this field", option.reasons.filter((r) => r.severity === "block"));
    }
    chosen = { option, productId: input.chosen.productId, label: input.chosen.label, quantity: option.dose?.forField.max ?? null, unit: option.dose?.unit ?? null };
  }

  const saved = await recordConsultation({
    dealerId: dealer.id,
    fieldId: field.id,
    pestId: input.pestId,
    diagnosisSource: input.diagnosisSource,
    diagnosisConfidence: input.diagnosisConfidence,
    options: result.options,
    requested,
    chosen,
  });
  return json({ ...saved, passportToken: field.passport_token }, 201);
});
