import { HttpError, handle, json } from "@/lib/http";
import { sprayWindowFor } from "@/lib/weather";

export const GET = handle(async (req: Request) => {
  const district = new URL(req.url).searchParams.get("district");
  if (!district) throw new HttpError(400, "BAD_REQUEST", "district is required");
  return json(await sprayWindowFor(district));
});
