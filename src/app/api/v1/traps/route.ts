import { pestFor, todayIso, trapStatus } from "@/engine";
import { HttpError, body, dealerId, handle, json } from "@/lib/http";
import { addTrapCount, trapReadings } from "@/lib/repo";
import { TrapBody } from "@/lib/schemas";

export const GET = handle(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const district = p.get("district");
  const pest = p.get("pest") ?? "pink_bollworm";
  if (!district) throw new HttpError(400, "BAD_REQUEST", "district is required");
  const readings = await trapReadings(district, pest);
  const etl = pestFor("cotton", pest)?.trap;
  return json({
    readings,
    status: trapStatus(readings, todayIso(), etl?.etlMothsPerTrapPerDay, etl?.consecutiveDays),
    threshold: etl ?? null,
  });
});

export const POST = handle(async (req: Request) => {
  const input = await body(req, TrapBody);
  return json(await addTrapCount({ ...input, dealerId: await dealerId() }), 201);
});
