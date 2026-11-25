"use client";

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Card, Empty } from "../ui";
import { useLang } from "../lang";
import { cx } from "../cx";
import { PhoneLookup } from "./phone-lookup";
import { TrapCard, WeatherCard } from "./conditions";
import { cropById, pestFor, type CropId } from "@/lib/ref-lite";
import { fmtDate } from "@/lib/format";

export interface RecentItem {
  id: string;
  created_at: string;
  pest_id: string;
  crop: CropId;
  farmer_name: string | null;
  phone_last4: string;
  field_id: string;
  chosen_status: string | null;
  label: string | null;
  requested_status: string | null;
}

export function CounterHome({
  dealerName,
  districtId,
  districtName,
  hasCotton,
  stats,
  recent,
}: {
  dealerName: string;
  districtId: string;
  districtName: string;
  hasCotton: boolean;
  stats: { consultations: number; sales: number; prevented: number };
  recent: RecentItem[];
}) {
  const { t, lang } = useLang();
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="pt-1">
        <p className="text-[13px] text-muted">{lang === "hi" ? "नमस्ते" : "Namaste"}, {dealerName.split(" ")[0]}</p>
        <h1 className="text-[22px] font-semibold tracking-tight">{lang === "hi" ? "आज किस किसान की मदद करें?" : "Who's at the counter?"}</h1>
      </div>

      <PhoneLookup districtId={districtId} />

      <div className={cx("grid gap-4", hasCotton && "sm:grid-cols-2")}>
        <WeatherCard districtId={districtId} />
        {hasCotton ? <TrapCard districtId={districtId} /> : null}
      </div>

      <Card className="grid grid-cols-3 divide-x divide-line">
        {[
          { k: t("consultations"), v: stats.consultations, sub: t("today") },
          { k: t("sales"), v: stats.sales, sub: t("today") },
          { k: t("prevented"), v: stats.prevented, sub: lang === "hi" ? "इस सीज़न" : "this season", good: true },
        ].map((s) => (
          <div key={String(s.k)} className="p-3.5 sm:p-4">
            <div className="text-[11.5px] leading-4 text-muted">{s.k}</div>
            <div className={cx("mt-1 text-[22px] font-semibold tracking-tight tabular", s.good && "text-good")}>{s.v}</div>
            <div className="text-[11px] text-faint">{s.sub}</div>
          </div>
        ))}
      </Card>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium text-ink-2">{t("recent")}</h2>
          <span className="text-[11.5px] text-faint">{districtName}</span>
        </div>
        <Card>
          {recent.length === 0 ? (
            <Empty title={lang === "hi" ? "अभी कोई परामर्श नहीं" : "No consultations yet"} />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => {
                const pest = pestFor(r.crop, r.pest_id);
                const crop = cropById(r.crop);
                const switched = r.requested_status === "blocked";
                return (
                  <li key={r.id}>
                    <Link href={`/counter/field/${r.field_id}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-canvas/70">
                      <div className="w-12 shrink-0 text-[12px] text-muted tabular">{fmtDate(r.created_at.slice(0, 10), lang)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">
                          {r.farmer_name ?? "Farmer"} <span className="font-normal text-faint">•••• {r.phone_last4}</span>
                        </div>
                        <div className="truncate text-[12.5px] text-muted">
                          {lang === "hi" ? crop?.hi : crop?.en.replace(" (rice)", "")} · {lang === "hi" ? pest?.hi : pest?.en}
                          {r.label ? ` → ${r.label}` : ""}
                        </div>
                      </div>
                      {switched ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-good-soft px-1.5 py-0.5 text-[11px] font-medium text-good" title="Farmer asked for a blocked product; switched to a safe one">
                          <ShieldCheck className="size-3" />
                          {lang === "hi" ? "बदला" : "Switched"}
                        </span>
                      ) : null}
                      <ChevronRight className="size-4 text-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
