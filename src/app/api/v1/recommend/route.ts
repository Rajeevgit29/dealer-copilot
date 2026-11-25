import { groupsFor, pestFor, recommend, todayIso } from "@/engine";
import { HttpError, body, handle, json } from "@/lib/http";
import { RecommendBody } from "@/lib/schemas";

/** Stateless ranking: field + spray history in, approved options with reasons out. */
export const POST = handle(async (req: Request) => {
  const input = await body(req, RecommendBody);
  if (!pestFor(input.field.crop, input.pestId)) throw new HttpError(400, "BAD_PEST", `Unknown pest '${input.pestId}' for ${input.field.crop}`);
  const history = input.history.map((h) => ({ ...h, groups: groupsFor(h.actives).map((g) => g.code) }));
  return json(recommend({ field: input.field, history, pestId: input.pestId, today: input.today ?? todayIso() }));
});
