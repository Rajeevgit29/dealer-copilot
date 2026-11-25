import { DATA_SOURCE, APPROVED_USES } from "@/engine";
import { aiEnabled, aiModel } from "@/lib/gemini";
import { q1 } from "@/lib/db";
import { handle, json } from "@/lib/http";

export const GET = handle(async () => {
  const db = await q1<{ ok: number }>("select 1 as ok").then(() => true).catch(() => false);
  return json({ ok: db, db, ai: { enabled: aiEnabled(), model: aiModel() }, data: { ...DATA_SOURCE, approvedUses: APPROVED_USES.length } }, db ? 200 : 503);
});
