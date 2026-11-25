import { pestFor } from "@/engine";
import { HttpError, handle, json } from "@/lib/http";
import { diagnose, imagesFromForm } from "@/lib/vision";

const CROPS = new Set(["cotton", "paddy", "tomato", "chilli"]);

/** Photo -> up to 3 likely pests/diseases for the crop (multipart: image, crop). */
export const POST = handle(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "BAD_REQUEST", "Send multipart/form-data with image and crop");
  const crop = String(form.get("crop") ?? "");
  if (!CROPS.has(crop)) throw new HttpError(400, "BAD_CROP", "crop must be cotton, paddy, tomato or chilli");
  let images;
  try {
    images = await imagesFromForm(form);
  } catch (e) {
    throw new HttpError(400, "BAD_IMAGE", e instanceof Error ? e.message : "Invalid image");
  }
  const { diagnosis, model, latencyMs } = await diagnose(crop as "cotton", images);
  return json({
    ...diagnosis,
    candidates: diagnosis.candidates.map((c) => ({ ...c, pest: pestFor(crop, c.pestId) })),
    model,
    latencyMs,
  });
});
