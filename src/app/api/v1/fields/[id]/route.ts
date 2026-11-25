import { HttpError, body, handle, json } from "@/lib/http";
import { getField, updateFieldHarvest } from "@/lib/repo";
import { FieldPatchBody } from "@/lib/schemas";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/v1/fields/[id]">) => {
  const { id } = await ctx.params;
  const data = await getField(id);
  if (!data) throw new HttpError(404, "NOT_FOUND", "Field not found");
  return json(data);
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/v1/fields/[id]">) => {
  const { id } = await ctx.params;
  const { nextHarvestDate } = await body(req, FieldPatchBody);
  const field = await updateFieldHarvest(id, nextHarvestDate);
  if (!field) throw new HttpError(404, "NOT_FOUND", "Field not found");
  return json({ field });
});
