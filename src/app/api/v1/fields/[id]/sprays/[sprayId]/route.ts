import { HttpError, handle } from "@/lib/http";
import { deleteSpray } from "@/lib/repo";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/v1/fields/[id]/sprays/[sprayId]">) => {
  const { id, sprayId } = await ctx.params;
  if (!(await deleteSpray(id, sprayId))) throw new HttpError(404, "NOT_FOUND", "Spray not found");
  return new Response(null, { status: 204 });
});
