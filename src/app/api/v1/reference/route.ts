import { ALL_GROUPS, CROPS, DATA_SOURCE, DISTRICTS, PESTS } from "@/engine";
import { aiEnabled } from "@/lib/gemini";
import { SAMPLE_BOTTLES } from "@/lib/samples";
import { handle, json } from "@/lib/http";

export const GET = handle(async () =>
  json({
    crops: CROPS,
    pests: PESTS,
    districts: DISTRICTS,
    groups: ALL_GROUPS,
    samples: SAMPLE_BOTTLES.map(({ id, title, subtitle, tone }) => ({ id, title, subtitle, tone })),
    ai: { enabled: aiEnabled() },
    dataSource: DATA_SOURCE,
  }),
);
