"use client";

import { useRef, useState } from "react";
import { Camera, Check, CircleAlert, CircleCheck, CircleX, ImageUp, Info, Plus, TriangleAlert } from "lucide-react";
import { Button, Input, Label, Segmented, Sheet, Spinner } from "../ui";
import { MoaChip } from "../moa";
import { useLang } from "../lang";
import { cx } from "../cx";
import { ProductSearch, type ProductHit } from "./product-search";
import { api, ApiError } from "@/lib/api-client";
import { groupName, groupShort } from "@/lib/ref-lite";
import { todayLocal } from "@/lib/format";

export interface ScannedItem {
  label: string;
  brand: string | null;
  manufacturer: string | null;
  formKey: string;
  registered: boolean;
  matchedProductId: string | null;
  actives: { name: string; concentration: number | null; group: string | null; groupShort: string | null; groupName: string | null }[];
  formType: string | null;
  groups: string[];
  checks: { level: "ok" | "warn" | "bad"; en: string; hi: string }[];
  raw: { purchaseDate?: string | null };
}

export interface SampleMeta {
  id: string;
  title: string;
  subtitle: string;
  tone: "green" | "blue" | "amber" | "rose" | "slate";
}

const TONE: Record<SampleMeta["tone"], string> = {
  green: "from-[#e5f2ec] to-[#d4e9dc] text-[#1d5e40]",
  blue: "from-[#e9eefb] to-[#d9e2f6] text-[#2c4a8a]",
  amber: "from-[#fbf1dc] to-[#f4e3bd] text-[#7a5100]",
  rose: "from-[#f9e8ef] to-[#f1d3df] text-[#83294f]",
  slate: "from-[#efede8] to-[#e2dfd8] text-[#45423c]",
};

type Tab = "samples" | "scan" | "search";

export function AddSpraySheet({
  open,
  onClose,
  fieldId,
  aiEnabled,
  samples,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  fieldId: string;
  aiEnabled: boolean;
  samples: SampleMeta[];
  onAdded: () => void;
}) {
  const { t, pick, lang } = useLang();
  const [tab, setTab] = useState<Tab>(aiEnabled ? "scan" : "samples");
  const [date, setDate] = useState(todayLocal());
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setItems(null);
    setError(null);
  };

  async function scanSample(id: string) {
    reset();
    setBusy(id);
    try {
      const r = await api.post<{ items: ScannedItem[] }>("/api/v1/scan-label", { sampleId: id });
      setItems(r.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not read");
    } finally {
      setBusy(null);
    }
  }

  async function scanFile(file: File) {
    reset();
    setBusy("upload");
    const form = new FormData();
    form.append("image", file);
    try {
      const r = await api.upload<{ items: ScannedItem[] }>("/api/v1/scan-label", form);
      setItems(r.items);
      if (!r.items.length) setError("No pesticide found in the photo. Try a closer photo of the label.");
    } catch (e) {
      setError(e instanceof ApiError ? (e.code === "AI_DISABLED" ? t("aiOff") : e.message) : "Could not read the photo");
    } finally {
      setBusy(null);
    }
  }

  async function add(key: string, body: { formKey: string; label: string; productId?: string | null; actives: string[]; source: "scan" | "manual"; date?: string }) {
    setBusy(key);
    setError(null);
    try {
      await api.post(`/api/v1/fields/${fieldId}/sprays`, { ...body, date: body.date ?? date });
      setAdded((s) => new Set(s).add(key));
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  const close = () => {
    reset();
    setAdded(new Set());
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("addSpray")}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted">{added.size ? `${added.size} added to the passport` : ""}</span>
          <Button onClick={close} variant={added.size ? "primary" : "secondary"}>
            {added.size ? "Done" : t("cancel")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Segmented<Tab>
            value={tab}
            onChange={(v) => {
              setTab(v);
              reset();
            }}
            options={[
              { value: "scan", label: t("scan") },
              { value: "samples", label: t("samples") },
              { value: "search", label: t("search") },
            ]}
          />
          <div className="w-40">
            <Label htmlFor="sdate">{t("sprayDate")}</Label>
            <Input id="sdate" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className="h-9 text-[14px]" />
          </div>
        </div>

        {tab === "scan" ? (
          <div>
            {!aiEnabled ? (
              <div className="mb-3 flex gap-2.5 rounded-xl bg-info-soft px-3.5 py-3 text-[12.5px] leading-5 text-info">
                <Info className="mt-0.5 size-4 shrink-0" />
                {t("aiOff")}
              </div>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) scanFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy === "upload"}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-canvas px-4 py-7 text-center transition-colors hover:bg-sunken disabled:opacity-60"
            >
              {busy === "upload" ? <Spinner className="size-5" /> : <Camera className="size-5 text-ink-2" />}
              <span className="text-[14px] font-medium">{busy === "upload" ? "Reading label…" : lang === "hi" ? "बोतल या बिल की फोटो लें" : "Take a photo of the bottle or bill"}</span>
              <span className="flex items-center gap-1 text-[12px] text-muted">
                <ImageUp className="size-3.5" /> JPG, PNG or HEIC · up to 6 MB
              </span>
            </button>
          </div>
        ) : null}

        {tab === "samples" ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {samples.map((s) => (
              <button
                key={s.id}
                onClick={() => scanSample(s.id)}
                className={cx(
                  "relative flex h-[104px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-left transition-transform hover:-translate-y-0.5",
                  TONE[s.tone],
                  busy === s.id && "opacity-70",
                )}
              >
                <span className="text-[14px] font-semibold leading-tight">{s.title}</span>
                <span className="text-[11.5px] leading-4 opacity-80">{s.subtitle}</span>
                {busy === s.id ? <Spinner className="absolute right-3 top-3" /> : null}
              </button>
            ))}
          </div>
        ) : null}

        {tab === "search" ? (
          <ProductSearch
            autoFocus
            onPick={(p: ProductHit) =>
              add(`search:${p.id}`, { formKey: p.formKey, label: p.generic ? p.formulation : p.brand, productId: p.generic ? null : p.id, actives: p.actives, source: "manual" })
            }
          />
        ) : null}

        {error ? (
          <div className="flex gap-2 rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {items ? (
          <ul className="space-y-2.5">
            {items.map((it, i) => {
              const key = `item:${i}:${it.formKey}`;
              const bad = it.checks.some((c) => c.level === "bad");
              return (
                <li key={key} className="animate-rise rounded-2xl border border-line p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-semibold">{it.label}</div>
                      <div className="text-[12.5px] capitalize text-muted">
                        {it.actives.map((a) => `${a.name} ${a.concentration ?? "?"}%`).join(" + ")} {it.formType}
                        {it.manufacturer ? ` · ${it.manufacturer}` : ""}
                      </div>
                    </div>
                    {added.has(key) ? (
                      <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-good-soft px-2.5 text-[12.5px] font-medium text-good">
                        <Check className="size-3.5" /> Added
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={bad ? "secondary" : "primary"}
                        loading={busy === key}
                        onClick={() =>
                          add(key, {
                            formKey: it.formKey,
                            label: it.label,
                            productId: it.matchedProductId,
                            actives: it.actives.map((a) => a.name),
                            source: "scan",
                            date: it.raw.purchaseDate ?? undefined,
                          })
                        }
                      >
                        <Plus className="size-3.5" />
                        {t("add")}
                      </Button>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {it.groups.length ? (
                      it.groups.map((g) => <MoaChip key={g} code={g} short={groupShort(g)} name={groupName(g)} size="sm" />)
                    ) : (
                      <span className="text-[12px] text-muted">Mode of action unknown</span>
                    )}
                  </div>
                  <ul className="mt-2.5 space-y-1">
                    {it.checks.map((c, j) => (
                      <li key={j} className={cx("flex gap-2 text-[12.5px] leading-5", c.level === "bad" ? "text-bad" : c.level === "warn" ? "text-warn" : "text-good")}>
                        {c.level === "bad" ? <CircleX className="mt-0.5 size-3.5 shrink-0" /> : c.level === "warn" ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> : <CircleCheck className="mt-0.5 size-3.5 shrink-0" />}
                        <span>{pick(c)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Sheet>
  );
}
