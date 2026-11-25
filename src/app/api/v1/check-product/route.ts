import { checkFormulation, groupsFor, todayIso } from "@/engine";
import { body, handle, json } from "@/lib/http";
import { CheckProductBody } from "@/lib/schemas";

/** "Can this farmer spray X?" for one specific product. */
export const POST = handle(async (req: Request) => {
  const input = await body(req, CheckProductBody);
  const history = input.history.map((h) => ({ ...h, groups: groupsFor(h.actives).map((g) => g.code) }));
  return json(checkFormulation(input.formKey, { field: input.field, history, pestId: input.pestId, today: input.today ?? todayIso() }));
});
