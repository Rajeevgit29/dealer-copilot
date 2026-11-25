"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ChevronRight, Phone, Plus, Sprout, UserPlus } from "lucide-react";
import { Button, Card, Input, Label, Segmented } from "../ui";
import { useLang } from "../lang";
import { cx } from "../cx";
import { api, ApiError } from "@/lib/api-client";
import { CROPS, cropById, type CropId } from "@/lib/ref-lite";
import { daysAgo, fmtDate, todayLocal } from "@/lib/format";

interface FieldSummary {
  id: string;
  label: string;
  crop: CropId;
  sowing_date: string;
  area_acres: string;
  sprays: number;
  last_spray: string | null;
}
interface Farmer {
  id: string;
  name: string | null;
  village: string | null;
  phone_last4: string;
}

const DEMO_PHONE = "98765 43210";

export function PhoneLookup({ districtId }: { districtId: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ farmer: Farmer | null; fields: FieldSummary[] } | null>(null);
  const [mode, setMode] = useState<"idle" | "newField">("idle");

  async function lookup(raw = phone) {
    setError(null);
    setLoading(true);
    setMode("idle");
    try {
      const r = await api.get<{ farmer: Farmer | null; fields: FieldSummary[] }>(`/api/v1/farmers?phone=${encodeURIComponent(raw)}`);
      setResult(r);
      if (r.farmer && r.fields.length === 0) setMode("newField");
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError ? e.message : "Could not look up the farmer");
    } finally {
      setLoading(false);
    }
  }

  const today = todayLocal();

  return (
    <Card className="overflow-hidden">
      <form
        className="p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <Label htmlFor="phone">{t("phone")}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center gap-2 text-[15px] text-muted">
              <Phone className="size-4" />
              +91
            </span>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="off"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setResult(null);
              }}
              className="h-12 pl-[4.6rem] text-[17px] tracking-wide tabular"
            />
          </div>
          <Button type="submit" size="lg" loading={loading} disabled={phone.replace(/\D/g, "").length < 10}>
            {t("find")}
          </Button>
        </div>
        {error ? <p className="mt-2 text-[13px] text-bad">{error}</p> : null}
        {!result && !error ? (
          <button
            type="button"
            onClick={() => {
              setPhone(DEMO_PHONE);
              lookup(DEMO_PHONE);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sunken px-2.5 py-1.5 text-[12.5px] text-ink-2 hover:bg-line"
          >
            {t("demoHint")}: <span className="font-medium tabular">{DEMO_PHONE}</span>
            <ArrowRight className="size-3.5" />
          </button>
        ) : null}
      </form>

      {result ? (
        <div className="animate-rise border-t border-line bg-canvas/60">
          {result.farmer ? (
            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold">{result.farmer.name ?? "Farmer"}</div>
                  <div className="text-[12.5px] text-muted">
                    {result.farmer.village ? `${result.farmer.village} · ` : ""}•••• {result.farmer.phone_last4}
                  </div>
                </div>
                {mode !== "newField" ? (
                  <Button variant="secondary" size="sm" onClick={() => setMode("newField")}>
                    <Plus className="size-3.5" />
                    {t("addField")}
                  </Button>
                ) : null}
              </div>
              {mode === "newField" ? (
                <NewFieldForm
                  onCancel={result.fields.length ? () => setMode("idle") : undefined}
                  onSubmit={async (f) => {
                    const r = await api.post<{ field: { id: string } }>(`/api/v1/farmers/${result.farmer!.id}/fields`, f);
                    router.push(`/counter/field/${r.field.id}`);
                  }}
                />
              ) : (
                <ul className="space-y-2">
                  {result.fields.map((f) => {
                    const crop = cropById(f.crop);
                    return (
                      <li key={f.id}>
                        <button
                          onClick={() => router.push(`/counter/field/${f.id}`)}
                          className="group flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                            <Sprout className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">
                              {lang === "hi" ? crop?.hi : crop?.en} · {f.label}
                            </span>
                            <span className="block text-[12.5px] text-muted tabular">
                              {daysAgo(f.sowing_date, today)} {t("daysOld")} · {Number(f.area_acres)} {t("acres")} · {f.sprays} {t("sprays")}
                              {f.last_spray ? ` · ${t("lastSpray")} ${fmtDate(f.last_spray, lang)}` : ""}
                            </span>
                          </span>
                          <ChevronRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <NewFarmer
              phone={phone}
              districtId={districtId}
              onCreated={(id) => router.push(`/counter/field/${id}`)}
            />
          )}
        </div>
      ) : null}
    </Card>
  );
}

type FieldInput = { label: string; crop: CropId; sowingDate: string; areaAcres: number };

function NewFieldForm({ onSubmit, onCancel }: { onSubmit: (f: FieldInput) => Promise<void>; onCancel?: () => void }) {
  const { t, lang } = useLang();
  const [crop, setCrop] = useState<CropId>("cotton");
  const [sowing, setSowing] = useState("2026-07-01");
  const [area, setArea] = useState("2");
  const [label, setLabel] = useState("Main field");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onSubmit({ label: label || "Main field", crop, sowingDate: sowing, areaAcres: Number(area) });
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Could not save");
          setBusy(false);
        }
      }}
    >
      <div>
        <Label>{t("crop")}</Label>
        <Segmented value={crop} onChange={setCrop} options={CROPS.map((c) => ({ value: c.id, label: lang === "hi" ? c.hi : c.en.replace(" (rice)", "") }))} className="w-full [&>button]:flex-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sowing">{t("sowing")}</Label>
          <Input id="sowing" type="date" value={sowing} max={todayLocal()} onChange={(e) => setSowing(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="area" hint={t("acres")}>
            {t("area")}
          </Label>
          <Input id="area" inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label htmlFor="flabel" hint={t("optional")}>
          {t("fieldName")}
        </Label>
        <Input id="flabel" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {error ? <p className="text-[13px] text-bad">{error}</p> : null}
      <div className="flex gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
        <Button type="submit" loading={busy} className="flex-1" disabled={!(Number(area) > 0)}>
          {t("continue")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}

function NewFarmer({ phone, districtId, onCreated }: { phone: string; districtId: string; onCreated: (fieldId: string) => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-muted">
          <UserPlus className="size-4" />
        </span>
        <div>
          <div className="text-[14px] font-medium">{t("noFarmer")}</div>
          <div className="text-[12.5px] text-muted">{t("newFarmer")} · +91 {phone}</div>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fname" hint={t("optional")}>
            {t("nameOpt")}
          </Label>
          <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fvillage" hint={t("optional")}>
            {t("village")}
          </Label>
          <Input id="fvillage" value={village} onChange={(e) => setVillage(e.target.value)} />
        </div>
      </div>
      <div className={cx("rounded-xl border border-line bg-surface p-3.5")}>
        <NewFieldForm
          onSubmit={async (f) => {
            const { farmer } = await api.post<{ farmer: { id: string } }>("/api/v1/farmers", { phone, name: name || null, village: village || null, districtId });
            const r = await api.post<{ field: { id: string } }>(`/api/v1/farmers/${farmer.id}/fields`, f);
            onCreated(r.field.id);
          }}
        />
      </div>
    </div>
  );
}
