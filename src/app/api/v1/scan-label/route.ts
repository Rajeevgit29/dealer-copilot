import { HttpError, handle, json, body } from "@/lib/http";
import { sampleById } from "@/lib/samples";
import { imagesFromForm, postProcessLabel, readLabel } from "@/lib/vision";
import { ScanSampleBody } from "@/lib/schemas";

/** Read a bottle label or shop bill. Multipart `image` (needs GEMINI_API_KEY) or JSON { sampleId } for demo bottles. */
export const POST = handle(async (req: Request) => {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const { sampleId } = await body(req, ScanSampleBody);
    const sample = sampleById(sampleId);
    if (!sample) throw new HttpError(404, "NOT_FOUND", "Unknown sample");
    return json({ mode: "sample", extraction: sample.extraction, items: postProcessLabel(sample.extraction) });
  }
  let images;
  try {
    images = await imagesFromForm(await req.formData());
  } catch (e) {
    throw new HttpError(400, "BAD_IMAGE", e instanceof Error ? e.message : "Invalid image");
  }
  const out = await readLabel(images);
  return json({ mode: "ai", ...out });
});
