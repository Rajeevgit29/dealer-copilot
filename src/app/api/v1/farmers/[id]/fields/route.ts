import { body, handle, json } from "@/lib/http";
import { createField } from "@/lib/repo";
import { FieldBody } from "@/lib/schemas";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/v1/farmers/[id]/fields">) => {
  const { id } = await ctx.params;
  const input = await body(req, FieldBody);
  return json({ field: await createField(id, input) }, 201);
});
