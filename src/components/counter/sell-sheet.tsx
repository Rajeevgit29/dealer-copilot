"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircleCheck, CircleX, MessageCircle, Printer, ScrollText } from "lucide-react";
import type { Option } from "@/engine";
import { Button, Sheet } from "../ui";
import { MoaChip } from "../moa";
import { useLang } from "../lang";
import { cx } from "../cx";
import { api, ApiError } from "@/lib/api-client";
import { fmtPacks, fmtQty, fmtRange } from "@/lib/format";
import { cropById, groupShort, pestFor, type CropId } from "@/lib/ref-lite";

interface SaleCtx {
  fieldId: string;
  pestId: string;
  crop: CropId;
  areaAcres: number;
  farmerName: string | null;
  phoneLast4: string;
  diagnosisSource: "photo" | "manual";
  diagnosisConfidence?: number | null;
  requestedFormKey: string | null;
  avoidGroups: string[];
}

export function SellSheet({ option, ctx, onClose, onSold }: { option: Option | null; ctx: SaleCtx; onClose: () => void; onSold: () => void }) {
  const { t, lang } = useLang();
  const [productId, setProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ traceId: string; passportToken: string } | null>(null);

  const brands = option?.products ?? [];
  const chosenBrand = brands.find((p) => p.id === productId) ?? brands[0];
  const label = chosenBrand && !chosenBrand.generic ? chosenBrand.brand : option?.formulation ?? "";

  const slip = useMemo(() => (option ? buildSlip(lang, option, label, ctx, done?.traceId, done ? `${location.origin}/passport/${done.passportToken}` : undefined) : ""), [lang, option, label, ctx, done]);

  if (!option) return null;

  async function record() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ sale: { trace_id: string } | null; passportToken: string }>("/api/v1/consultations", {
        fieldId: ctx.fieldId,
        pestId: ctx.pestId,
        diagnosisSource: ctx.diagnosisSource,
        diagnosisConfidence: ctx.diagnosisConfidence ?? null,
        requestedFormKey: ctx.requestedFormKey,
        chosen: { formKey: option!.formKey, productId: chosenBrand && !chosenBrand.generic ? chosenBrand.id : null, label },
      });
      setDone({ traceId: r.sale!.trace_id, passportToken: r.passportToken });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record the sale");
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (done) onSold();
    setDone(null);
    setProductId(null);
    setError(null);
    onClose();
  };

  return (
    <Sheet
      open={!!option}
      onClose={close}
      title={done ? t("saleDone") : t("chooseBrand")}
      footer={
        done ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={close}>
              {lang === "hi" ? "बंद करें" : "Done"}
            </Button>
            <Link href="/counter" className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-white hover:bg-ink-2">
              {t("newConsult")}
            </Link>
          </div>
        ) : (
          <Button className="w-full" size="lg" loading={busy} onClick={record}>
            {t("recordSale")}
          </Button>
        )
      }
    >
      {!done ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-canvas p-3.5">
            <div className="text-[14.5px] font-semibold">{option.formulation}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {option.groups.map((g) => (
                <MoaChip key={g.code} code={g.code} short={g.short} name={g.name} size="sm" />
              ))}
            </div>
            {option.dose ? (
              <div className="mt-2.5 text-[13px] text-ink-2 tabular">
                {fmtRange(option.dose.perAcre, option.dose.unit)} {t("perAcre")} · <span className="font-semibold text-ink">{fmtQty(option.dose.forField.max, option.dose.unit)}</span> {t("forField")}
                {option.dose.packs ? <span className="text-muted"> ({fmtPacks(option.dose.packs, option.dose.unit)})</span> : null}
              </div>
            ) : null}
          </div>
          <div role="radiogroup" className="space-y-1.5">
            {brands.map((b) => {
              const active = (chosenBrand?.id ?? "") === b.id;
              return (
                <button
                  key={b.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setProductId(b.id)}
                  className={cx("flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-colors", active ? "border-ink bg-surface" : "border-line hover:border-line-strong")}
                >
                  <span>
                    <span className="block text-[14px] font-medium">{b.generic ? (lang === "hi" ? "कोई भी ब्रांड" : "Any brand") : b.brand}</span>
                    <span className="block text-[12px] text-muted">{b.generic ? option.formulation : b.company}</span>
                  </span>
                  <span className={cx("grid size-5 place-items-center rounded-full border", active ? "border-ink bg-ink" : "border-line-strong")}>
                    {active ? <span className="size-2 rounded-full bg-white" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {error ? (
            <div className="flex gap-2 rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
              <CircleX className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-good-soft p-3.5">
            <CircleCheck className="size-6 shrink-0 text-good" />
            <div>
              <div className="text-[14px] font-semibold text-good">{t("saleDone")}</div>
              <div className="text-[12.5px] text-ink-2">
                {t("traceId")}: <span className="font-mono font-medium">{done.traceId}</span>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <ScrollText className="size-3.5" />
              {lang === "hi" ? "किसान के लिए पर्ची" : "Farmer slip"}
            </div>
            <pre className={cx("whitespace-pre-wrap rounded-2xl border border-line bg-canvas p-3.5 font-sans text-[13px] leading-[1.6] text-ink", lang === "hi" && "deva")}>{slip}</pre>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(slip)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1f7a4d] px-3 text-[13px] font-medium text-white hover:bg-[#19663f]"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
            <a
              href={`/passport/${done.passportToken}?print=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium hover:bg-canvas"
            >
              <Printer className="size-4" />
              {t("print")}
            </a>
            <a
              href={`/passport/${done.passportToken}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium hover:bg-canvas"
            >
              {t("passport")}
            </a>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function buildSlip(lang: "en" | "hi", o: Option, label: string, ctx: SaleCtx, traceId?: string, passportUrl?: string) {
  const crop = cropById(ctx.crop);
  const pest = pestFor(ctx.crop, ctx.pestId);
  const groups = o.groups.map((g) => `${g.scheme === "FRAC" ? "FRAC" : g.scheme === "PHER" ? "" : "IRAC"} ${g.short}`.trim()).join(" + ");
  const dose = o.dose;
  const product = label === o.formulation ? o.formulation : `${label} (${o.formulation})`;
  const avoid = [...new Set([...o.groups.map((g) => g.code), ...ctx.avoidGroups])].filter((c) => c !== "PHER").map(groupShort).join(", ");
  if (lang === "hi") {
    return [
      `छिड़काव सलाह`,
      `किसान: ${ctx.farmerName ?? ""} (•••• ${ctx.phoneLast4}) · ${crop?.hi}, ${ctx.areaAcres} एकड़`,
      `समस्या: ${pest?.hi}`,
      `दवा: ${product} · ग्रुप ${groups}`,
      dose ? `मात्रा: ${fmtRange(dose.perAcre, dose.unit)} प्रति एकड़${dose.waterPerAcre ? `, ${fmtRange(dose.waterPerAcre, "L")} पानी में` : ""}। कुल ${fmtQty(dose.forField.max, dose.unit)}।` : `मात्रा: लेबल के अनुसार`,
      o.phiDays != null ? `छिड़काव के बाद ${o.phiDays} दिन तक तुड़ाई न करें।` : `तुड़ाई से पहले लेबल पर प्रतीक्षा अवधि देखें।`,
      avoid ? `अगली बार ग्रुप ${avoid} की दवा न लें — दूसरा ग्रुप चुनें।` : "",
      `दस्ताने और मास्क पहनें। हवा की दिशा में छिड़काव करें। खाली बोतल दोबारा इस्तेमाल न करें।`,
      traceId ? `ट्रेस आईडी: ${traceId}` : "",
      passportUrl ? `छिड़काव पासपोर्ट: ${passportUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Spray advice`,
    `Farmer: ${ctx.farmerName ?? ""} (•••• ${ctx.phoneLast4}) · ${crop?.en}, ${ctx.areaAcres} acres`,
    `Problem: ${pest?.en}`,
    `Product: ${product} · group ${groups}`,
    dose ? `Dose: ${fmtRange(dose.perAcre, dose.unit)} per acre${dose.waterPerAcre ? ` in ${fmtRange(dose.waterPerAcre, "L")} water` : ""}. Total ${fmtQty(dose.forField.max, dose.unit)}.` : `Dose: as per label`,
    o.phiDays != null ? `Do not harvest for ${o.phiDays} days after spraying.` : `Check the label waiting period before harvest.`,
    avoid ? `Next spray: do not use group ${avoid}. Choose a different group.` : "",
    `Wear gloves and a mask. Spray with the wind. Do not reuse the empty container.`,
    traceId ? `Trace ID: ${traceId}` : "",
    passportUrl ? `Spray passport: ${passportUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
