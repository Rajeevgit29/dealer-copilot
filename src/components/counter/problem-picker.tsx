"use client";

import { useRef, useState } from "react";
import { Bug, Camera, Check, Info, Leaf, Sparkles } from "lucide-react";
import { Card, Spinner } from "../ui";
import { useLang } from "../lang";
import { cx } from "../cx";
import { api, ApiError } from "@/lib/api-client";
import { pestsForCrop, type CropId } from "@/lib/ref-lite";
import { addDaysIso, daysAgo, fmtDate, todayLocal } from "@/lib/format";

interface Candidate {
  pestId: string;
  confidence: number;
  evidence: string;
  pest?: { en: string; hi: string };
}

export function ProblemPicker({
  crop,
  value,
  onChange,
  aiEnabled,
}: {
  crop: CropId;
  value: string | null;
  onChange: (pestId: string, source: "photo" | "manual", confidence?: number) => void;
  aiEnabled: boolean;
}) {
  const { t, lang } = useLang();
  const pests = pestsForCrop(crop);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<{ candidates: Candidate[]; followUpQuestion?: string | null; imageUsable: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function diagnose(file: File) {
    setBusy(true);
    setDiag(null);
    setNote(null);
    const form = new FormData();
    form.append("image", file);
    form.append("crop", crop);
    try {
      const r = await api.upload<{ candidates: Candidate[]; followUpQuestion?: string | null; imageUsable: boolean }>("/api/v1/diagnose", form);
      setDiag(r);
      if (!r.imageUsable) setNote(lang === "hi" ? "फोटो साफ़ नहीं है। पत्ती के पास से दोबारा फोटो लें।" : "The photo is not clear enough. Take a closer photo of the affected leaf.");
    } catch (e) {
      setNote(e instanceof ApiError && e.code === "AI_DISABLED" ? t("aiOff") : e instanceof ApiError ? e.message : "Could not diagnose");
    } finally {
      setBusy(false);
    }
  }

  const groups: [string, typeof pests][] = [
    [t("insects"), pests.filter((p) => p.kind !== "disease")],
    [t("diseases"), pests.filter((p) => p.kind === "disease")],
  ];

  return (
    <Card as="section" className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{t("problem")}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{t("problemSub")}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) diagnose(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => (aiEnabled ? fileRef.current?.click() : setNote(t("aiOff")))}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium hover:bg-canvas"
        >
          {busy ? <Spinner /> : <Camera className="size-3.5" />}
          {t("photoDiagnose")}
        </button>
      </div>

      {note ? (
        <div className="mb-3 flex gap-2 rounded-xl bg-info-soft px-3.5 py-2.5 text-[12.5px] leading-5 text-info">
          <Info className="mt-0.5 size-4 shrink-0" />
          {note}
        </div>
      ) : null}

      {diag?.candidates.length ? (
        <div className="mb-4 animate-rise rounded-xl border border-line bg-canvas p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
            <Sparkles className="size-3.5" /> {lang === "hi" ? "फोटो से संभावित समस्या" : "Likely from the photo"}
          </div>
          <ul className="space-y-1.5">
            {diag.candidates.map((c) => (
              <li key={c.pestId}>
                <button onClick={() => onChange(c.pestId, "photo", c.confidence)} className="w-full rounded-lg bg-surface px-3 py-2 text-left hover:ring-1 hover:ring-line-strong">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-medium">{lang === "hi" ? c.pest?.hi : c.pest?.en}</span>
                    <span className="text-[12px] text-muted tabular">{Math.round(c.confidence * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-sunken">
                    <div className="h-1 rounded-full bg-ink/60" style={{ width: `${c.confidence * 100}%` }} />
                  </div>
                  <div className="mt-1.5 text-[12px] leading-4 text-muted">{c.evidence}</div>
                </button>
              </li>
            ))}
          </ul>
          {diag.followUpQuestion ? <p className="mt-2 text-[12.5px] text-ink-2">Ask the farmer: {diag.followUpQuestion}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {groups.map(([title, list]) =>
          list.length ? (
            <div key={title}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">
                {title === t("diseases") ? <Leaf className="size-3" /> : <Bug className="size-3" />}
                {title}
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {list.map((p) => {
                  const active = value === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onChange(p.id, "manual")}
                      title={p.signs}
                      aria-pressed={active}
                      className={cx(
                        "relative rounded-xl border px-3 py-2 text-left transition-all",
                        active ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-line-strong",
                      )}
                    >
                      <span className={cx("block truncate text-[13px] font-medium", lang === "hi" && "deva")}>{lang === "hi" ? p.hi : p.en}</span>
                      <span className={cx("block truncate text-[11.5px]", active ? "text-white/70" : "text-muted", lang !== "hi" && "deva")}>{lang === "hi" ? p.en : p.hi}</span>
                      {active ? <Check className="absolute right-2 top-2 size-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null,
        )}
      </div>
    </Card>
  );
}

export function HarvestPicker({
  value,
  onChange,
  sowingDate,
  estimatedDays,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  sowingDate: string;
  estimatedDays: number | null;
}) {
  const { t, lang } = useLang();
  const today = todayLocal();
  const current = value ? daysAgo(today, value) : null;
  const presets = [3, 7, 14, 21];
  return (
    <Card as="section" className="p-4">
      <h2 className="text-[15px] font-semibold tracking-tight">{t("harvest")}</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">{t("harvestSub")}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {presets.map((d) => (
          <button
            key={d}
            onClick={() => onChange(addDaysIso(today, d))}
            className={cx("h-8 rounded-lg border px-3 text-[13px] tabular transition-colors", current === d ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-line-strong")}
          >
            {t("inDays", { n: d })}
          </button>
        ))}
        <button
          onClick={() => onChange(null)}
          className={cx("h-8 rounded-lg border px-3 text-[13px] transition-colors", value === null ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-line-strong")}
        >
          {t("notSoon")}
        </button>
        <input
          type="date"
          aria-label="Custom harvest date"
          min={today}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink-2"
        />
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {value
          ? `${lang === "hi" ? "तुड़ाई" : "Harvest"} ${fmtDate(value, lang)} · ${current} ${t("days")}`
          : estimatedDays != null
            ? lang === "hi"
              ? `बुवाई ${fmtDate(sowingDate, lang)} से अनुमान: पहली तुड़ाई ${estimatedDays} दिन में`
              : `Estimated from sowing (${fmtDate(sowingDate)}): first harvest in about ${estimatedDays} days`
            : lang === "hi"
              ? "तुड़ाई की तारीख नहीं दी गई — प्रतीक्षा अवधि जाँची नहीं जाएगी"
              : "No harvest date set, so waiting periods are not checked"}
      </p>
    </Card>
  );
}
