"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CloudRain, Sun, Thermometer, Wind } from "lucide-react";
import { Card, Skeleton } from "../ui";
import { useLang } from "../lang";
import { cx } from "../cx";
import { api } from "@/lib/api-client";
import { dayLabel, fmtHour, todayLocal } from "@/lib/format";

export interface WeatherHour {
  time: string;
  verdict: "good" | "ok" | "bad";
  reasons: string[];
  temperature: number;
  wind: number;
  precipProbability: number;
}
export type WeatherResp =
  | { available: true; district: string; now: WeatherHour; windows: { start: string; end: string; hours: number }[]; hours: WeatherHour[]; source: string }
  | { available: false; reason: string };

const REASON: Record<string, { en: string; hi: string }> = {
  rain: { en: "rain expected within 4 hours", hi: "4 घंटे में बारिश" },
  wind: { en: "too windy (drift)", hi: "तेज़ हवा (दवा उड़ेगी)" },
  heat: { en: "too hot", hi: "बहुत गर्मी" },
  dark: { en: "after daylight hours", hi: "रोशनी नहीं" },
  calm: { en: "very calm air, watch for drift layers", hi: "हवा बहुत शांत" },
};

export function useWeather(districtId: string) {
  const [w, setW] = useState<WeatherResp | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .get<WeatherResp>(`/api/v1/weather?district=${districtId}`)
      .then((r) => alive && setW(r))
      .catch(() => alive && setW({ available: false, reason: "Weather unavailable" }));
    return () => {
      alive = false;
    };
  }, [districtId]);
  return w;
}

export function WeatherStrip({ w, compact }: { w: WeatherResp | null; compact?: boolean }) {
  const { t, lang } = useLang();
  if (!w) return <Skeleton className={compact ? "h-14" : "h-28"} />;
  if (!w.available) return <div className="rounded-xl bg-sunken px-3.5 py-3 text-[13px] text-muted">{t("sprayWeather")}: {w.reason}</div>;
  const v = w.now.verdict;
  const today = todayLocal();
  const next = w.windows.find((x) => x.start > w.now.time) ?? w.windows[0];
  const joined = w.now.reasons.map((r) => (lang === "hi" ? REASON[r]?.hi : REASON[r]?.en) ?? r).join(", ");
  const reasons = joined ? joined[0].toUpperCase() + joined.slice(1) : "";
  return (
    <div className={cx("rounded-xl px-3.5 py-3", v === "bad" ? "bg-warn-soft" : "bg-good-soft")}>
      <div className="flex items-start gap-3">
        <span className={cx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface/70", v === "bad" ? "text-warn" : "text-good")}>
          {w.now.reasons.includes("rain") ? <CloudRain className="size-4" /> : w.now.reasons.includes("wind") ? <Wind className="size-4" /> : <Sun className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className={cx("text-[14px] font-semibold", v === "bad" ? "text-warn" : "text-good")}>{v === "good" ? t("goodNow") : v === "ok" ? t("okNow") : t("badNow")}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-2">
            {reasons ? `${reasons}. ` : ""}
            {next && (v === "bad" || next.start !== w.now.time) ? (
              <>
                {t("nextWindow")}: <span className="font-medium">{dayLabel(next.start, today, lang)}, {fmtHour(next.start)}–{fmtHour(next.end, 1)}</span>
              </>
            ) : null}
          </div>
          {!compact ? (
            <div className="mt-2 flex gap-3 text-[12px] text-ink-2 tabular">
              <span className="inline-flex items-center gap-1">
                <Thermometer className="size-3.5" />
                {Math.round(w.now.temperature)}°C
              </span>
              <span className="inline-flex items-center gap-1">
                <Wind className="size-3.5" />
                {Math.round(w.now.wind)} km/h
              </span>
              <span className="inline-flex items-center gap-1">
                <CloudRain className="size-3.5" />
                {w.now.precipProbability}%
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {!compact ? <HourBar hours={w.hours.slice(0, 24)} /> : null}
    </div>
  );
}

function HourBar({ hours }: { hours: WeatherHour[] }) {
  return (
    <div className="mt-3">
      <div className="flex gap-[2px]">
        {hours.map((h) => (
          <div
            key={h.time}
            title={`${fmtHour(h.time)}: ${h.verdict}${h.reasons.length ? " (" + h.reasons.join(", ") + ")" : ""}`}
            className={cx("h-2 flex-1 rounded-[2px]", h.verdict === "good" ? "bg-good/70" : h.verdict === "ok" ? "bg-good/35" : h.reasons.includes("dark") ? "bg-ink/10" : "bg-warn/50")}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted tabular">
        <span>{fmtHour(hours[0].time)}</span>
        <span>{fmtHour(hours[Math.floor(hours.length / 2)].time)}</span>
        <span>{fmtHour(hours[hours.length - 1].time)}</span>
      </div>
    </div>
  );
}

export function WeatherCard({ districtId }: { districtId: string }) {
  const { t } = useLang();
  const w = useWeather(districtId);
  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-ink-2">{t("sprayWeather")}</h3>
        <span className="text-[11px] text-faint">Open-Meteo</span>
      </div>
      <WeatherStrip w={w} />
    </Card>
  );
}

interface TrapResp {
  readings: { date: string; moths: number }[];
  status: { level: "above" | "watch" | "below" | "no_data"; streak: number; latest: number | null; etl: number; consecutiveDays: number };
}

export function TrapCard({ districtId }: { districtId: string }) {
  const { t } = useLang();
  const [d, setD] = useState<TrapResp | null>(null);
  useEffect(() => {
    api.get<TrapResp>(`/api/v1/traps?district=${districtId}&pest=pink_bollworm`).then(setD).catch(() => setD(null));
  }, [districtId]);
  const level = d?.status.level;
  const max = Math.max(d?.status.etl ?? 8, ...(d?.readings.map((r) => r.moths) ?? [0]));
  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[13px] font-medium text-ink-2">{t("traps")}</h3>
        <Link href="/counter/traps" className="inline-flex items-center gap-0.5 text-[12px] text-muted hover:text-ink">
          {t("logTrap")}
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {!d ? (
        <Skeleton className="h-28" />
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <div className={cx("text-[14px] font-semibold", level === "above" ? "text-bad" : level === "watch" ? "text-warn" : "text-good")}>
              {level === "above" ? t("above") : level === "watch" ? t("watch") : level === "below" ? t("below") : t("noData")}
            </div>
            {d.status.latest != null ? (
              <div className="text-[12px] text-muted tabular">
                <span className="text-[15px] font-semibold text-ink">{d.status.latest}</span> moths/trap · ETL {d.status.etl}
              </div>
            ) : null}
          </div>
          <div className="relative mt-3 flex h-16 items-end gap-[3px]">
            <div className="absolute inset-x-0 border-t border-dashed border-bad/50" style={{ bottom: `${(d.status.etl / max) * 100}%` }} />
            {d.readings.slice(-14).map((r) => (
              <div
                key={r.date}
                title={`${r.date}: ${r.moths}`}
                className={cx("flex-1 rounded-t-[3px]", r.moths >= d.status.etl ? "bg-bad/70" : "bg-ink/20")}
                style={{ height: `${Math.max(4, (r.moths / max) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-4 text-muted">ICAR-CICR threshold: {d.status.etl} moths per trap on {d.status.consecutiveDays} days in a row.</p>
        </>
      )}
    </Card>
  );
}
