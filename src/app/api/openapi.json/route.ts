import { openApiSpec } from "@/lib/openapi";

export const GET = (req: Request) => Response.json(openApiSpec(new URL(req.url).origin));
