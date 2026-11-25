"use client";

import dynamic from "next/dynamic";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, CircleAlert, FlaskConical, TriangleAlert } from "lucide-react";
import { Badge, Card, Skeleton } from "../ui";
import { MoaChip, groupColor } from "../moa";
import { cx } from "../cx";
import { fmtDate, pct } from "@/lib/format";

const DistrictMap = dynamic(() => import("./map").then((m) => m.DistrictMap), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

export interface DistrictStat {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  fields: number;
  consultations: number;
  repeatRate: number;
  beforeRate: number | null;
  afterRate: number | null;
  beforePairs: number;
  topGroup: { code: string; short: string; name: string } | null;
  topPest: string | null;
  trap: { level: "above" | "watch" | "below" | "no_data"; latest: number | null; streak: number } | null;
}

export interface DashboardData {
  today: string;
  rollout: string;
  totals: { dealers: number; farmers: number; fields: number; sprays: number; consultations: number; prevented: number; asked_blocked: number; traced_sales: number };
  before: { pairs: number; repeats: number };
  after: { pairs: number; repeats: number };
  weekly: { week: string; rate: number | null; pairs: number }[];
  districts: DistrictStat[];
  mix: Record<string, number | string>[];
  mixKeys: { code: string; label: string }[];
  rules: { code: string; severity: string; consultations: number }[];
  companies: { company: string; n: number }[];
  alerts: { tone: "bad" | "warn"; title: string; body: string }[];
}

const RULE_LABEL: Record<string, string> = {
  SAME_GROUP_AS_LAST_SPRAY: "Same group as last spray",
  PHI_EXCEEDS_HARVEST: "Waiting period past harvest",
  GROUP_SEASON_LIMIT: "Group overused this season",
  BEE_HAZARD_FLOWERING: "Bee hazard during flowering",
  PYRETHROID_EARLY_COTTON: "Early-season pyrethroid (cotton)",
  HIGH_RISK_FUNGICIDE: "High-risk fungicide repeated",
  UNKNOWN_GROUP: "Mode of action unconfirmed",
};

const axis = { fontSize: 11, fill: "#75716a" };
const tooltipStyle = { borderRadius: 10, border: "1px solid #e4e1da", fontSize: 12, boxShadow: "0 10px 30px -10px rgb(27 26 23 / 0.25)" };

export function riskColor(rate: number | null) {
  if (rate == null) return "#bdb8ae";
  return rate >= 0.65 ? "#c2433b" : rate >= 0.5 ? "#c98a1b" : "#2f8a5f";
}

export function Dashboard({ data }: { data: DashboardData }) {
  const beforeRate = data.before.pairs ? data.before.repeats / data.before.pairs : 0;
  const afterRate = data.after.pairs ? data.after.repeats / data.after.pairs : 0;
  const companyTotal = data.companies.reduce((s, c) => s + c.n, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="warn">
              <FlaskConical className="size-3" /> Simulated data
            </Badge>
            <span className="text-[12px] text-muted">Synthetic Kharif 2026 season · {data.districts.length} districts · as of {fmtDate(data.today)}</span>
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight">Resistance pressure, district by district</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-6 text-muted">
            What dealers in the network actually sold, across every brand, aggregated from counter consultations. No farmer-level data leaves the counter.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Fields with a spray passport" value={data.totals.fields.toLocaleString("en-IN")} sub={`${data.totals.sprays.toLocaleString("en-IN")} sprays recorded`} />
        <Kpi label="Counter consultations" value={data.totals.consultations.toLocaleString("en-IN")} sub={`${data.totals.dealers} dealers`} />
        <Kpi
          label="Back-to-back same group"
          value={
            <span className="flex items-baseline gap-2">
              <span className="text-faint line-through decoration-1">{pct(data.before.repeats, data.before.pairs)}%</span>
              <span className="text-good">{pct(data.after.repeats, data.after.pairs)}%</span>
            </span>
          }
          sub="before → after copilot rollout"
        />
        <Kpi label="Risky requests switched" value={data.totals.prevented.toLocaleString("en-IN")} sub={`of ${data.totals.asked_blocked} blocked requests (${pct(data.totals.prevented, data.totals.asked_blocked)}%)`} tone="good" />
        <Kpi label="Sales with a trace ID" value={data.totals.traced_sales.toLocaleString("en-IN")} sub="dealer → farmer, digital" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="self-start p-5 lg:col-span-2">
          <ChartHead title="Share of sprays that repeat the previous spray's group" sub={`Weekly, all fields. Rollout of the copilot at demo dealers on ${fmtDate(data.rollout)}.`} />
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#efede8" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w: string) => fmtDate(w)} tick={axis} tickLine={false} axisLine={{ stroke: "#e4e1da" }} minTickGap={28} />
                <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={axis} tickLine={false} axisLine={false} domain={[0, 1]} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(w) => `Week of ${fmtDate(String(w))}`} formatter={(v) => [`${Math.round(Number(v) * 100)}%`, "Repeat rate"]} />
                <ReferenceLine x={data.weekly.find((w) => w.week >= data.rollout)?.week} stroke="#1b1a17" strokeDasharray="3 3" label={{ value: "Copilot live", position: "insideTopLeft", fontSize: 11, fill: "#45423c" }} />
                <Line type="monotone" dataKey="rate" stroke="#1f5c3a" strokeWidth={2.2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Before: {Math.round(beforeRate * 100)}% of sprays repeated the last group within 30 days. After: {Math.round(afterRate * 100)}%. Simulated; the farmer behaviour model is in <code className="font-mono text-[11px]">db/seed.ts</code>.
          </p>
        </Card>

        <Card className="flex flex-col self-start p-5">
          <ChartHead title="Alerts for field teams" icon={<Bell className="size-4" />} />
          <ul className="mt-3 max-h-[21rem] flex-1 space-y-2.5 overflow-y-auto pr-1">
            {data.alerts.length === 0 ? <li className="text-[13px] text-muted">No alerts.</li> : null}
            {data.alerts.map((a, i) => (
              <li key={i} className={cx("rounded-xl px-3.5 py-3", a.tone === "bad" ? "bg-bad-soft" : "bg-warn-soft")}>
                <div className={cx("flex items-center gap-1.5 text-[13px] font-semibold", a.tone === "bad" ? "text-bad" : "text-warn")}>
                  {a.tone === "bad" ? <CircleAlert className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
                  {a.title}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-ink-2">{a.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="p-5 pb-3">
            <ChartHead title="Where resistance pressure built up before the copilot" sub="Colour = share of sprays that repeated the previous group (Jul–Aug). Size = fields tracked." />
            <div className="mt-2 flex gap-4 text-[11.5px] text-muted">
              {[
                ["< 50%", "#2f8a5f"],
                ["50–65%", "#c98a1b"],
                ["≥ 65%", "#c2433b"],
                ["no early-season data", "#bdb8ae"],
              ].map(([l, c]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="h-[380px] border-t border-line">
            <DistrictMap districts={data.districts} />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <ChartHead title="What the rules caught" sub="Consultations in which each rule removed or flagged an option." />
          <ul className="mt-4 space-y-3">
            {data.rules.map((r) => {
              const max = data.rules[0]?.consultations || 1;
              return (
                <li key={r.code + r.severity}>
                  <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
                    <span className="text-ink-2">
                      {RULE_LABEL[r.code] ?? r.code}
                      {r.severity === "block" ? <span className="ml-1.5 text-[11px] text-bad">blocks</span> : <span className="ml-1.5 text-[11px] text-warn">warns</span>}
                    </span>
                    <span className="font-medium tabular">{r.consultations.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-sunken">
                    <div className={cx("h-1.5 rounded-full", r.severity === "block" ? "bg-bad/70" : "bg-warn/60")} style={{ width: `${(r.consultations / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-3">
          <ChartHead title="Districts" sub="Back-to-back repeat rate before and after the copilot went live. Trap status uses the ICAR-CICR pink bollworm threshold." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-y border-line bg-canvas text-[11.5px] uppercase tracking-[0.05em] text-muted">
                <th className="px-5 py-2.5 font-medium">District</th>
                <th className="px-3 py-2.5 text-right font-medium">Fields</th>
                <th className="px-3 py-2.5 font-medium">Repeats before (Jul–Aug)</th>
                <th className="px-3 py-2.5 font-medium">Since rollout</th>
                <th className="px-3 py-2.5 font-medium">Most-sprayed group</th>
                <th className="px-3 py-2.5 font-medium">Top problem (30 days)</th>
                <th className="px-5 py-2.5 font-medium">PBW traps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.districts.map((d) => (
                <tr key={d.id} className="hover:bg-canvas/60">
                  <td className="px-5 py-3">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-[12px] text-muted">{d.state}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular">{d.fields}</td>
                  <td className="px-3 py-3">
                    {d.beforeRate != null ? (
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-24 rounded-full bg-sunken">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, d.beforeRate * 100)}%`, background: riskColor(d.beforeRate) }} />
                        </div>
                        <span className="w-9 tabular">{Math.round(d.beforeRate * 100)}%</span>
                      </div>
                    ) : (
                      <span className="text-faint">not enough data</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular text-good">{d.afterRate != null ? `${Math.round(d.afterRate * 100)}%` : "—"}</td>
                  <td className="px-3 py-3">{d.topGroup ? <MoaChip code={d.topGroup.code} short={d.topGroup.short} name={d.topGroup.name} size="sm" /> : "—"}</td>
                  <td className="px-3 py-3 text-ink-2">{d.topPest ?? "—"}</td>
                  <td className="px-5 py-3">
                    {d.trap ? (
                      <Badge tone={d.trap.level === "above" ? "bad" : d.trap.level === "watch" ? "warn" : "good"}>
                        {d.trap.level === "above" ? "Above ETL" : d.trap.level === "watch" ? "Watch" : "Below ETL"} · {d.trap.latest ?? "—"}
                      </Badge>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <ChartHead title="Chemistry mix over the season" sub="Sprays per week by mode-of-action group, every brand included." />
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.mix} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#efede8" vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w: string) => fmtDate(w)} tick={axis} tickLine={false} axisLine={{ stroke: "#e4e1da" }} minTickGap={28} />
                <YAxis tick={axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(w) => `Week of ${fmtDate(String(w))}`} />
                {data.mixKeys.map((k) => (
                  <Area key={k.code} type="monotone" dataKey={k.code} name={k.label} stackId="1" stroke={k.code === "Other" ? "#bdb8ae" : groupColor(k.code).dot} fill={k.code === "Other" ? "#e4e1da" : groupColor(k.code).dot} fillOpacity={0.55} strokeWidth={1} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-ink-2">
            {data.mixKeys.map((k) => (
              <span key={k.code} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: k.code === "Other" ? "#d3cfc6" : groupColor(k.code).dot }} />
                {k.label}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <ChartHead title="Who's in the tank" sub="Share of sprays by manufacturer, last 60 days. Generics are what a brand-only sales view never sees." />
          <ul className="mt-4 space-y-3">
            {data.companies.slice(0, 8).map((c) => (
              <li key={c.company}>
                <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
                  <span className={cx("text-ink-2", c.company === "Syngenta" && "font-medium text-ink")}>{c.company}</span>
                  <span className="tabular text-muted">
                    <span className="font-medium text-ink">{pct(c.n, companyTotal)}%</span> · {c.n}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-sunken">
                  <div className={cx("h-1.5 rounded-full", c.company === "Syngenta" ? "bg-brand" : c.company.startsWith("Generic") ? "bg-ink/35" : "bg-ink/60")} style={{ width: `${(c.n / (data.companies[0]?.n || 1)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "good" }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] leading-4 text-muted">{label}</div>
      <div className={cx("mt-2 text-[24px] font-semibold leading-none tracking-tight tabular", tone === "good" && "text-good")}>{value}</div>
      {sub ? <div className="mt-1.5 text-[11.5px] leading-4 text-muted">{sub}</div> : null}
    </Card>
  );
}

function ChartHead({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div>
      <h2 className="flex items-center gap-1.5 text-[14.5px] font-semibold tracking-tight">
        {icon}
        {title}
      </h2>
      {sub ? <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{sub}</p> : null}
    </div>
  );
}
