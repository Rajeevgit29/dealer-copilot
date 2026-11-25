import { HttpError, body, dealerId, handle, json } from "@/lib/http";
import { addSpray, getField } from "@/lib/repo";
import { SprayBody } from "@/lib/schemas";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/fields/[id]/sprays">) => {
  const { id } = await ctx.params;
  if (!(await getField(id))) throw new HttpError(404, "NOT_FOUND", "Field not found");
  const input = await body(req, SprayBody);
  return json({ spray: await addSpray(id, { ...input, dealerId: await dealerId() }) }, 201);
});
