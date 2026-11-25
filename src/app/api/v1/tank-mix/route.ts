import { tankMix } from "@/engine";
import { body, handle, json } from "@/lib/http";
import { TankMixBody } from "@/lib/schemas";

export const POST = handle(async (req: Request) => json(tankMix((await body(req, TankMixBody)).items)));
