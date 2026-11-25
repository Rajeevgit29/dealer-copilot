"use client";

import { useState } from "react";
import { Beaker, ChevronDown, CircleCheck, CircleX, ExternalLink, Info, ShieldCheck, TriangleAlert, X } from "lucide-react";
import type { Option, Reason, RecommendResult } from "@/engine";
import { Badge, Button, Card, Sheet, Skeleton } from "../ui";
import { MoaChip } from "../moa";
import { useLang } from "../lang";
import { cx } from "../cx";
import { ProductSearch, type ProductHit } from "./product-search";
import { WeatherStrip, type WeatherResp } from "./conditions";
import { api, ApiError } from "@/lib/api-client";
import { fmtPacks, fmtQty, fmtRange } from "@/lib/format";
import { pestFor } from "@/lib/ref-lite";

const STATUS_TONE = { recommended: "good", caution: "warn", blocked: "bad" } as const;

export function ReasonLine({ r, compact }: { r: Reason; compact?: boolean }) {
  const { pick } = useLang();
  const Icon = r.severity === "block" ? CircleX : r.severity === "warn" ? TriangleAlert : r.severity === "good" ? CircleCheck : Info;
  return (
    <li className={cx("flex gap-2 leading-5", compact ? "text-[12px]" : "text-[12.5px]", r.severity === "block" ? "text-bad" : r.severity === "warn" ? "text-warn" : r.severity === "good" ? "text-good" : "text-ink-2")}>
      <Icon className="mt-[3px] size-3.5 shrink-0" />
      <span>{pick(r)}</span>
    </li>
  );
}

function StatusBadge({ status }: { status: Option["status"] }) {
  const { t } = useLang();
  return (
    <Badge tone={STATUS_TONE[status]}>
      {status === "recommended" ? <ShieldCheck className="size-3" /> : status === "caution" ? <TriangleAlert className="size-3" /> : <CircleX className="size-3" />}
      {t(status)}
    </Badge>
  );
}

export function OptionCard({ o, areaAcres, onSell, highlight }: { o: Option; areaAcres: number; onSell?: (o: Option) => void; highlight?: boolean }) {
  const { t, lang } = useLang();
  const brands = o.products.filter((p) => !p.generic);
  return (
    <article className={cx("animate-rise rounded-2xl border bg-surface p-4", highlight ? "border-ink shadow-[var(--shadow-pop)]" : "border-line")}>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={o.status} />
        <a
          href={`https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-faint hover:text-muted"
          title={`Label claim: “${o.pestRaw}” (${o.source.doc}, page ${o.source.page})`}
        >
          CIB&amp;RC p.{o.source.page}
          <ExternalLink className="size-3" />
        </a>
      </div>
      <h4 className="mt-2 text-[15.5px] font-semibold leading-snug tracking-tight">{o.formulation}</h4>
      <p className="mt-0.5 text-[12.5px] text-muted">
        {brands.length ? (
          <>
            {brands.map((b) => `${b.brand} (${b.company})`).join(", ")} <span className="text-faint">· {lang === "hi" ? "या कोई भी ब्रांड" : "or any brand"}</span>
          </>
        ) : lang === "hi" ? (
          "कोई भी पंजीकृत ब्रांड"
        ) : (
          "Any registered brand"
        )}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {o.groups.map((g) => (
          <MoaChip key={g.code} code={g.code} short={g.short} name={g.name} />
        ))}
        {o.method !== "spray" ? <Badge tone="info">{o.method.replace("_", " ")}</Badge> : null}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line sm:grid-cols-4">
        <Cell label={t("perAcre")} value={o.dose ? fmtRange(o.dose.perAcre, o.dose.unit) : o.doseRaw || "See label"} />
        <Cell
          label={`${t("forField")} (${areaAcres} ac)`}
          value={o.dose ? fmtQty(o.dose.forField.max, o.dose.unit) : "—"}
          sub={o.dose?.packs ? fmtPacks(o.dose.packs, o.dose.unit) : undefined}
        />
        <Cell label={t("water")} value={o.dose?.waterPerAcre ? fmtRange(o.dose.waterPerAcre, "L") : "—"} />
        <Cell label={t("phi")} value={o.phiDays != null ? `${o.phiDays} ${t("days")}` : "—"} />
      </dl>

      <ul className="mt-3 space-y-1">
        {o.reasons.map((r, i) => (
          <ReasonLine key={i} r={r} />
        ))}
      </ul>
      {onSell && o.status !== "blocked" ? (
        <div className="mt-3.5 flex justify-end">
          <Button onClick={() => onSell(o)}>{t("sell")}</Button>
        </div>
      ) : null}
    </article>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-canvas px-3 py-2">
      <dt className="text-[11px] leading-4 text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-semibold tabular">{value}</dd>
      {sub ? <dd className="text-[11px] text-muted tabular">{sub}</dd> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AdvicePanel({
  result,
  loading,
  weather,
  areaAcres,
  fieldCtx,
  onSell,
  onRequested,
}: {
  result: RecommendResult | null;
  loading: boolean;
  weather: WeatherResp | null;
  areaAcres: number;
  fieldCtx: { body: unknown };
  onSell: (o: Option) => void;
  onRequested: (formKey: string | null) => void;
}) {
  const { t, lang, pick } = useLang();
  const [showAll, setShowAll] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);
  const [asked, setAsked] = useState<{ product: ProductHit; res: { approved: true; option: Option } | { approved: false; reasons: Reason[]; approvedPests: string[] } } | null>(null);
  const [askedBusy, setAskedBusy] = useState(false);

  if (!result) {
    return loading ? (
      <Card className="space-y-3 p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-14" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </Card>
    ) : null;
  }

  const usable = result.options.filter((o) => o.status !== "blocked");
  const blocked = result.options.filter((o) => o.status === "blocked");
  const visible = showAll ? usable : usable.slice(0, 4);
  const pest = pestFor(result.crop, result.pestId);

  // Group blocked options by their first blocking reason.
  const byReason = new Map<string, { reason: Reason; options: Option[] }>();
  for (const o of blocked) {
    const r = o.reasons.find((x) => x.severity === "block")!;
    const g = byReason.get(r.code) ?? { reason: r, options: [] };
    g.options.push(o);
    byReason.set(r.code, g);
  }

  async function checkAsked(p: ProductHit) {
    setAskedBusy(true);
    try {
      const res = await api.post<{ approved: true; option: Option } | { approved: false; reasons: Reason[]; approvedPests: string[] }>("/api/v1/check-product", {
        ...(fieldCtx.body as object),
        formKey: p.formKey,
      });
      setAsked({ product: p, res });
      onRequested(p.formKey);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Check failed");
    } finally {
      setAskedBusy(false);
    }
  }

  return (
    <section className={cx("space-y-3 transition-opacity", loading && "opacity-60")}>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">{lang === "hi" ? pest?.hi : pest?.en}</div>
            <h2 className="text-[17px] font-semibold tracking-tight">{t("options")}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {result.summary.recommended ? (
                <Badge tone="good">
                  {result.summary.recommended} {t("recommended").toLowerCase()}
                </Badge>
              ) : null}
              {result.summary.caution ? (
                <Badge tone="warn">
                  {result.summary.caution} {t("caution").toLowerCase()}
                </Badge>
              ) : null}
              {result.summary.blocked ? (
                <Badge tone="bad">
                  {result.summary.blocked} {t("blocked").toLowerCase()}
                </Badge>
              ) : null}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMixOpen(true)}>
            <Beaker className="size-3.5" />
            {t("tankMix")}
          </Button>
        </div>
        <div className="mt-3.5">
          <WeatherStrip w={weather} compact />
        </div>

        <div className="mt-4 border-t border-line pt-3.5">
          <div className="mb-2 text-[13px] font-medium text-ink-2">{t("checkAsked")}</div>
          {asked ? (
            <div className="animate-rise rounded-xl border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{asked.product.generic ? asked.product.formulation : asked.product.brand}</div>
                  <div className="truncate text-[12px] text-muted">{asked.product.formulation}</div>
                </div>
                <button
                  onClick={() => {
                    setAsked(null);
                    onRequested(null);
                  }}
                  className="grid size-7 place-items-center rounded-lg text-muted hover:bg-sunken"
                  aria-label="Clear"
                >
                  <X className="size-4" />
                </button>
              </div>
              {asked.res.approved ? (
                <div className="mt-2">
                  <StatusBadge status={asked.res.option.status} />
                  <ul className="mt-2 space-y-1">
                    {asked.res.option.reasons.map((r, i) => (
                      <ReasonLine key={i} r={r} />
                    ))}
                  </ul>
                  {asked.res.option.status !== "blocked" ? (
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => asked.res.approved && onSell(asked.res.option)}>
                        {t("sell")}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[12.5px] text-ink-2">{lang === "hi" ? "नीचे सुझाए गए विकल्प देखें।" : "Offer one of the recommended options below instead."}</p>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  <Badge tone="bad">
                    <CircleX className="size-3" />
                    {lang === "hi" ? "स्वीकृत नहीं" : "Not approved"}
                  </Badge>
                  <ul className="mt-2 space-y-1">
                    {asked.res.reasons.map((r, i) => (
                      <ReasonLine key={i} r={r} />
                    ))}
                  </ul>
                  {asked.res.approvedPests.length ? (
                    <p className="mt-1.5 text-[12px] text-muted">
                      {lang === "hi" ? "इस फसल पर स्वीकृत: " : "On this crop it is approved for: "}
                      {asked.res.approvedPests.map((id) => (lang === "hi" ? pestFor(result.crop, id)?.hi : pestFor(result.crop, id)?.en) ?? id).join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : askedBusy ? (
            <Skeleton className="h-11" />
          ) : (
            <ProductSearch onPick={checkAsked} placeholder={lang === "hi" ? "किसान ने जो दवा माँगी, उसका नाम" : "Name of the product the farmer asked for"} />
          )}
        </div>
      </Card>

      {usable.length === 0 ? (
        <Card className="p-5 text-[13.5px] leading-6 text-ink-2">
          {lang === "hi"
            ? "इस खेत के लिए अभी कोई स्वीकृत और सुरक्षित विकल्प नहीं है। कृषि विज्ञान केंद्र (KVK) या कंपनी के कृषि विशेषज्ञ से संपर्क करें।"
            : "No approved option is safe for this field right now. Refer the farmer to the local KVK or a company agronomist."}
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((o, i) => (
            <OptionCard key={o.formKey} o={o} areaAcres={areaAcres} onSell={onSell} highlight={i === 0 && o.status === "recommended"} />
          ))}
          {usable.length > visible.length ? (
            <Button variant="secondary" className="w-full" onClick={() => setShowAll(true)}>
              {lang === "hi" ? `सभी ${usable.length} विकल्प दिखाएं` : `Show all ${usable.length} options`}
              <ChevronDown className="size-4" />
            </Button>
          ) : null}
        </div>
      )}

      {blocked.length ? (
        <details className="group rounded-2xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-[13.5px] font-medium">
              {t("showBlocked")} <span className="text-muted tabular">({blocked.length})</span>
            </span>
            <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-line px-4 py-4">
            {[...byReason.values()]
              .sort((a, b) => b.options.length - a.options.length)
              .map(({ reason, options }) => (
                <div key={reason.code}>
                  <div className="mb-2 flex items-start gap-2 text-[13px] font-medium text-bad">
                    <CircleX className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {reasonTitle(reason.code, lang)} <span className="font-normal text-muted tabular">· {options.length}</span>
                    </span>
                  </div>
                  <ul className="space-y-1.5 pl-5.5">
                    {options.map((o) => (
                      <li key={o.formKey} className="rounded-lg bg-canvas px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">{o.formulation}</span>
                          <span className="flex gap-1">
                            {o.groups.map((g) => (
                              <MoaChip key={g.code} code={g.code} short={g.short} size="sm" />
                            ))}
                          </span>
                        </div>
                        <div className="mt-1 text-[12px] leading-4 text-muted">{pick(o.reasons.find((x) => x.severity === "block")!)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </details>
      ) : null}

      <p className="px-1 text-[11.5px] leading-4 text-faint">
        {lang === "hi" ? "स्रोत" : "Source"}: {result.dataSource.name}, as on {result.dataSource.asOn}. Doses are converted from per-hectare label claims; quantities round up to the full label rate.
      </p>

      <TankMixSheet open={mixOpen} onClose={() => setMixOpen(false)} />
    </section>
  );
}

function reasonTitle(code: string, lang: "en" | "hi") {
  const T: Record<string, [string, string]> = {
    SAME_GROUP_AS_LAST_SPRAY: ["Same mode of action as the last spray", "पिछले छिड़काव जैसा ही ग्रुप"],
    PHI_EXCEEDS_HARVEST: ["Waiting period runs past the harvest", "प्रतीक्षा अवधि तुड़ाई से लंबी"],
    GROUP_SEASON_LIMIT: ["Group already used too often this season", "इस सीज़न में ग्रुप बहुत बार इस्तेमाल हुआ"],
    NOT_APPROVED: ["Not approved", "स्वीकृत नहीं"],
  };
  return (T[code] ?? [code, code])[lang === "hi" ? 1 : 0];
}

// ---------------------------------------------------------------------------

function TankMixSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, pick } = useLang();
  const [items, setItems] = useState<ProductHit[]>([]);
  const [res, setRes] = useState<{ issues: { severity: "block" | "warn"; en: string; hi: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        setItems([]);
        setRes(null);
      }}
      title={lang === "hi" ? "टंकी मिश्रण जाँच" : "Tank-mix check"}
      footer={
        <Button
          className="w-full"
          disabled={items.length < 2}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setRes(await api.post("/api/v1/tank-mix", { items: items.map((p) => ({ label: p.generic ? p.formulation : p.brand, actives: p.actives })) }));
            } finally {
              setBusy(false);
            }
          }}
        >
          {lang === "hi" ? "जाँचें" : "Check the mix"}
        </Button>
      }
    >
      <p className="mb-3 text-[13px] leading-5 text-muted">
        {lang === "hi"
          ? "किसान जो दवाएं एक साथ मिलाना चाहता है, उन्हें जोड़ें। एक जैसी दवा या एक ही ग्रुप दोबारा मिलाने पर चेतावनी मिलेगी।"
          : "Add the products the farmer wants to mix in one tank. Duplicated ingredients and same-group mixes are flagged."}
      </p>
      {items.length ? (
        <ul className="mb-3 space-y-1.5">
          {items.map((p, i) => (
            <li key={`${p.id}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium">{p.generic ? p.formulation : p.brand}</span>
                <span className="block truncate text-[12px] capitalize text-muted">{p.actives.join(" + ")}</span>
              </span>
              <span className="flex items-center gap-1">
                {p.groups.map((g) => (
                  <MoaChip key={g.code} code={g.code} short={g.short} size="sm" />
                ))}
                <button
                  onClick={() => {
                    setItems(items.filter((_, j) => j !== i));
                    setRes(null);
                  }}
                  className="ml-1 grid size-7 place-items-center rounded-lg text-muted hover:bg-surface"
                  aria-label="Remove"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length < 6 ? (
        <ProductSearch
          key={items.length}
          onPick={(p) => {
            setItems([...items, p]);
            setRes(null);
          }}
        />
      ) : null}
      {res ? (
        <div className="mt-4 animate-rise">
          {res.issues.length === 0 ? (
            <div className="flex gap-2 rounded-xl bg-good-soft px-3.5 py-3 text-[13px] text-good">
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              {lang === "hi" ? "कोई दोहराव नहीं मिला। फिर भी लेबल पर मिश्रण की जानकारी देखें।" : "No duplicated ingredients or groups. Still check physical compatibility on the labels."}
            </div>
          ) : (
            <ul className="space-y-2">
              {res.issues.map((x, i) => (
                <li key={i} className={cx("flex gap-2 rounded-xl px-3.5 py-3 text-[13px] leading-5", x.severity === "block" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn")}>
                  {x.severity === "block" ? <CircleX className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
                  {pick(x)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
