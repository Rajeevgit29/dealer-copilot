import type { Metadata } from "next";
import { districtById, groupByCode, PESTS, trapStatus } from "@/engine";
import { SiteNav, Disclaimer } from "@/components/brand";
import { Dashboard, type DashboardData } from "@/components/insights/dashboard";
import { insights, ROLLOUT } from "@/lib/repo";

export const metadata: Metadata = { title: "HQ insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const raw = await insights();

  const trapsBy = new Map<string, { date: string; moths: number }[]>();
  for (const t of raw.traps) trapsBy.set(t.district_id, [...(trapsBy.get(t.district_id) ?? []), { date: t.date, moths: t.moths }]);

  const districts = raw.districts
    .map((d) => {
      const meta = districtById(d.district_id)!;
      const traps = trapsBy.get(d.district_id);
      const status = traps ? trapStatus(traps, raw.today) : null;
      const g = d.top_group ? groupByCode(d.top_group) : null;
      return {
        id: d.district_id,
        name: meta.name,
        state: meta.state,
        lat: meta.lat,
        lon: meta.lon,
        fields: d.fields,
        consultations: d.consultations,
        repeatRate: d.pairs ? d.repeats / d.pairs : 0,
        beforeRate: d.before_pairs >= 10 ? d.before_repeats / d.before_pairs : null,
        afterRate: d.after_pairs >= 10 ? d.after_repeats / d.after_pairs : null,
        beforePairs: d.before_pairs,
        topGroup: g ? { code: g.code, short: g.short, name: g.name } : null,
        topPest: d.top_pest ? (PESTS.find((p) => p.id === d.top_pest)?.en ?? d.top_pest) : null,
        trap: status ? { level: status.level, latest: status.latest, streak: status.streak } : null,
      };
    })
    .sort((a, b) => (b.beforeRate ?? -1) - (a.beforeRate ?? -1));

  const sum = (rows: { pairs: number; repeats: number }[]) => rows.reduce((s, r) => ({ pairs: s.pairs + r.pairs, repeats: s.repeats + r.repeats }), { pairs: 0, repeats: 0 });
  const before = sum(raw.weekly.filter((w) => w.week < ROLLOUT));
  const after = sum(raw.weekly.filter((w) => w.week >= ROLLOUT));

  // Weekly MoA mix: top groups + "Other".
  const totals = new Map<string, number>();
  for (const r of raw.groupMix) totals.set(r.group_code, (totals.get(r.group_code) ?? 0) + r.n);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
  const weeks = [...new Set(raw.groupMix.map((r) => r.week))].sort();
  const mix = weeks.map((week) => {
    const row: Record<string, number | string> = { week };
    let other = 0;
    for (const r of raw.groupMix.filter((x) => x.week === week)) {
      if (top.includes(r.group_code)) row[r.group_code] = r.n;
      else other += r.n;
    }
    row.Other = other;
    return row;
  });

  const alerts: DashboardData["alerts"] = [];
  for (const d of districts) {
    if (d.trap?.level === "above") alerts.push({ tone: "bad", title: `${d.name}: pink bollworm above threshold`, body: `${d.trap.streak} days at or above 8 moths/trap (latest ${d.trap.latest}). Field teams should push trap-based spraying, not calendar sprays.` });
    else if (d.trap?.level === "watch") alerts.push({ tone: "warn", title: `${d.name}: pink bollworm rising`, body: `Latest trap count ${d.trap.latest}. One more day above 8 crosses the ICAR-CICR threshold.` });
  }
  for (const d of districts.filter((x) => (x.beforeRate ?? 0) >= 0.7).slice(0, 2)) {
    alerts.push({
      tone: "warn",
      title: `${d.name}: ${Math.round(d.beforeRate! * 100)}% back-to-back repeats before rollout`,
      body: `Most-sprayed chemistry: ${d.topGroup ? `group ${d.topGroup.short} (${d.topGroup.name})` : "n/a"}. Candidate district for a resistance-monitoring bioassay.`,
    });
  }

  const data: DashboardData = {
    today: raw.today,
    rollout: ROLLOUT,
    totals: raw.totals,
    before,
    after,
    weekly: raw.weekly.map((w) => ({ week: w.week, rate: w.pairs >= 15 ? w.repeats / w.pairs : null, pairs: w.pairs })),
    districts,
    mix,
    mixKeys: [...top, "Other"].map((code) => ({ code, label: code === "Other" ? "Other" : `${groupByCode(code)?.short} · ${groupByCode(code)?.name}` })),
    rules: raw.rules.slice(0, 7),
    companies: raw.companies,
    alerts: alerts.slice(0, 6),
  };

  return (
    <>
      <SiteNav active="/insights" />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Dashboard data={data} />
        <Disclaimer className="mt-10 max-w-3xl" />
      </main>
    </>
  );
}
