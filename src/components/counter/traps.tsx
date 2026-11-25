"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Minus, Plus } from "lucide-react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, Input, Label, Skeleton } from "../ui";
import { useLang } from "../lang";
import { cx } from "../cx";
import { api, ApiError } from "@/lib/api-client";
import { fmtDate, todayLocal } from "@/lib/format";

interface TrapResp {
  readings: { date: string; moths: number; readings: number }[];
  status: { level: "above" | "watch" | "below" | "no_data"; streak: number; latest: number | null; etl: number; consecutiveDays: number };
  threshold: { etlMothsPerTrapPerDay: number; consecutiveDays: number; trapsPerHa: number; source: string; sourceUrl: string } | null;
}

export function TrapLog({ districtId, districtName }: { districtId: string; districtName: string }) {
  const { t, lang } = useLang();
  const [data, setData] = useState<TrapResp | null>(null);
  const [moths, setMoths] = useState(0);
  const [date, setDate] = useState(todayLocal());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.get<TrapResp>(`/api/v1/traps?district=${districtId}&pest=pink_bollworm`).then(setData), [districtId]);
  useEffect(() => {
    load();
  }, [load]);

  const level = data?.status.level;
  const levelText = level === "above" ? t("above") : level === "watch" ? t("watch") : level === "below" ? t("below") : t("noData");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/counter" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{t("traps")}</h1>
        <p className="mt-1 text-[13px] leading-5 text-muted">
          {lang === "hi"
            ? `${districtName} में फेरोमोन ट्रैप की रोज़ की गिनती। सीमा पार होने पर ही छिड़काव की सलाह दें।`
            : `Daily pheromone-trap counts for ${districtName}. Advise a spray only when the threshold is crossed, not on a fixed calendar.`}
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <Label>{lang === "hi" ? "आज प्रति ट्रैप पतंगे" : "Moths per trap"}</Label>
            <div className="flex items-center gap-2">
              <button onClick={() => setMoths((m) => Math.max(0, m - 1))} className="grid size-12 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas" aria-label="Decrease">
                <Minus className="size-4" />
              </button>
              <Input inputMode="numeric" value={moths} onChange={(e) => setMoths(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))} className="h-12 w-20 text-center text-[20px] font-semibold tabular" />
              <button onClick={() => setMoths((m) => m + 1)} className="grid size-12 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas" aria-label="Increase">
                <Plus className="size-4" />
              </button>
            </div>
          </div>
          <div className="w-36">
            <Label htmlFor="tdate">{lang === "hi" ? "तारीख" : "Date"}</Label>
            <Input id="tdate" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} className="h-12" />
          </div>
        </div>
        {error ? <p className="mt-2 text-[13px] text-bad">{error}</p> : null}
        <Button
          size="lg"
          className="mt-3.5 w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.post("/api/v1/traps", { districtId, pestId: "pink_bollworm", date, moths });
              setSaved(true);
              setTimeout(() => setSaved(false), 1800);
              await load();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Could not save");
            } finally {
              setBusy(false);
            }
          }}
        >
          {saved ? (lang === "hi" ? "दर्ज हो गया" : "Saved") : t("save")}
        </Button>
      </Card>

      <Card className="p-4">
        {!data ? (
          <Skeleton className="h-56" />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className={cx("text-[16px] font-semibold", level === "above" ? "text-bad" : level === "watch" ? "text-warn" : "text-good")}>{levelText}</div>
                <div className="text-[12.5px] text-muted">
                  {data.status.streak > 0
                    ? lang === "hi"
                      ? `लगातार ${data.status.streak} दिन सीमा से ऊपर`
                      : `${data.status.streak} day${data.status.streak > 1 ? "s" : ""} in a row at or above ${data.status.etl}`
                    : lang === "hi"
                      ? "आज सीमा से नीचे"
                      : `Latest reading below ${data.status.etl}`}
                </div>
              </div>
              {data.status.latest != null ? (
                <div className="text-right">
                  <div className="text-[24px] font-semibold tracking-tight tabular">{data.status.latest}</div>
                  <div className="text-[11.5px] text-muted">latest</div>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className="w-4 border-t border-dashed border-bad" /> ETL {data.status.etl} moths/trap
            </div>
            <div className="mt-2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.readings} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={(d: string) => fmtDate(d)} tick={{ fontSize: 11, fill: "#75716a" }} tickLine={false} axisLine={{ stroke: "#e4e1da" }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "#75716a" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#efede8" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e4e1da", fontSize: 12 }}
                    labelFormatter={(d) => fmtDate(String(d))}
                    formatter={(v) => [`${v} moths/trap`, ""]}
                  />
                  <ReferenceLine y={data.status.etl} stroke="#a8251f" strokeDasharray="4 4" />
                  <Bar dataKey="moths" radius={[4, 4, 0, 0]} maxBarSize={18}>
                    {data.readings.map((r) => (
                      <Cell key={r.date} fill={r.moths >= data.status.etl ? "#c2433b" : "#bdb8ae"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {data.threshold ? (
              <p className="mt-3 text-[12px] leading-5 text-muted">
                {lang === "hi"
                  ? `सीमा (ETL): ${data.threshold.etlMothsPerTrapPerDay} पतंगे प्रति ट्रैप, लगातार ${data.threshold.consecutiveDays} दिन। ${data.threshold.trapsPerHa} ट्रैप प्रति हेक्टेयर लगाएं।`
                  : `Threshold (ETL): ${data.threshold.etlMothsPerTrapPerDay} moths per trap on ${data.threshold.consecutiveDays} consecutive days, with ${data.threshold.trapsPerHa} traps per hectare.`}{" "}
                <a href={data.threshold.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline decoration-line-strong underline-offset-2 hover:text-ink">
                  {data.threshold.source}
                  <ExternalLink className="size-3" />
                </a>
              </p>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
