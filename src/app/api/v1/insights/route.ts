import { handle, json } from "@/lib/http";
import { insights } from "@/lib/repo";

export const GET = handle(async () => json(await insights()));
