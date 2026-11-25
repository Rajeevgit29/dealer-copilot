import { HttpError, body, handle, json } from "@/lib/http";
import { createFarmer, findFarmerByPhone } from "@/lib/repo";
import { FarmerBody } from "@/lib/schemas";

/** Look up a farmer by phone. The number is hashed; it is never stored or returned. */
export const GET = handle(async (req: Request) => {
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const res = await findFarmerByPhone(phone);
  if ("error" in res) throw new HttpError(400, "INVALID_PHONE", "Enter a 10-digit Indian mobile number");
  return json(res);
});

export const POST = handle(async (req: Request) => {
  const input = await body(req, FarmerBody);
  try {
    return json({ farmer: await createFarmer(input) }, 201);
  } catch (e) {
    if (e instanceof Error && e.message === "invalid_phone") throw new HttpError(400, "INVALID_PHONE", "Enter a 10-digit Indian mobile number");
    throw e;
  }
});
