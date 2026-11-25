import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { cropById, daysBetween, districtById, groupByCode, todayIso } from "@/engine";
import { LogoMark } from "@/components/brand";
import { MoaChip, groupColor } from "@/components/moa";
import { getFieldByPassport } from "@/lib/repo";
import { fmtDate, fmtDateLong } from "@/lib/format";
import { AutoPrint, PrintButton } from "./print";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spray passport", robots: { index: false } };

export default async function PassportPage(props: PageProps<"/passport/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const data = await getFieldByPassport(token);
  if (!data) notFound();
  const { field, farmer, sprays } = data;
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/passport/${token}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#1b1a17", light: "#ffffff00" } });
  const crop = cropById(field.crop);
  const today = todayIso();
  const sorted = [...sprays].sort((a, b) => b.sprayed_on.localeCompare(a.sprayed_on));

  const counts = new Map<string, number>();
  for (const s of sprays) for (const g of new Set(s.groups)) counts.set(g, (counts.get(g) ?? 0) + 1);
  const last = sorted[0];
  const recent = last && daysBetween(last.sprayed_on, today) <= 30;
  const avoid = [...new Set([...(recent ? last.groups : []), ...[...counts].filter(([, n]) => n >= 2).map(([g]) => g)])].filter((g) => g !== "PHER");

  return (
    <div className="min-h-screen bg-canvas px-4 py-6 print:bg-white print:p-0">
      {sp.print ? <AutoPrint /> : null}
      <div className="mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <div>
              <div className="deva text-[15px] font-semibold leading-5">छिड़काव पासपोर्ट</div>
              <div className="text-[12px] leading-4 text-muted">Spray passport</div>
            </div>
          </div>
          <PrintButton />
        </header>

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[19px] font-semibold tracking-tight">{farmer.name ?? "Farmer"}</div>
              <div className="text-[13px] text-muted">
                {farmer.village ? `${farmer.village}, ` : ""}
                {districtById(farmer.district_id)?.name} · •••• {farmer.phone_last4}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
                <div>
                  <dt className="deva text-[11.5px] text-muted">फसल · Crop</dt>
                  <dd className="font-medium">
                    <span className="deva">{crop?.hi}</span> · {crop?.en}
                  </dd>
                </div>
                <div>
                  <dt className="deva text-[11.5px] text-muted">रकबा · Area</dt>
                  <dd className="font-medium tabular">{Number(field.area_acres)} acres</dd>
                </div>
                <div>
                  <dt className="deva text-[11.5px] text-muted">बुवाई · Sown</dt>
                  <dd className="font-medium tabular">{fmtDateLong(field.sowing_date)}</dd>
                </div>
                <div>
                  <dt className="deva text-[11.5px] text-muted">खेत · Field</dt>
                  <dd className="font-medium">{field.label}</dd>
                </div>
              </dl>
            </div>
            <div className="w-24 shrink-0 text-center">
              <div className="size-24 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="deva mt-1.5 text-[10.5px] leading-3 text-muted">किसी भी दुकान पर स्कैन करें</div>
            </div>
          </div>
        </section>

        {avoid.length ? (
          <section className="rounded-[var(--radius-card)] border border-bad/15 bg-bad-soft p-4">
            <div className="deva text-[14.5px] font-semibold text-bad">अगले छिड़काव में ये ग्रुप न लें</div>
            <div className="text-[12.5px] text-ink-2">Next spray: avoid these groups</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {avoid.map((g) => {
                const grp = groupByCode(g);
                return grp ? <MoaChip key={g} code={g} short={grp.short} name={grp.name} /> : null;
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="deva text-[14.5px] font-semibold">
            इस सीज़न के छिड़काव <span className="font-sans text-[12.5px] font-normal text-muted">· Sprays this season ({sprays.length})</span>
          </h2>
          {sorted.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">No sprays recorded yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {sorted.map((s) => (
                <li key={s.id} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: s.groups[0] ? groupColor(s.groups[0]).dot : "#a19d95" }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-medium">{s.label}</span>
                      <span className="shrink-0 text-[12px] text-muted tabular">{fmtDate(s.sprayed_on)}</span>
                    </div>
                    <div className="truncate text-[12px] capitalize text-muted">
                      {s.actives.join(" + ")}
                      {s.shop_name ? ` · ${s.shop_name}` : ""}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.groups.map((g) => {
                        const grp = groupByCode(g);
                        return grp ? <MoaChip key={g} code={g} short={grp.short} size="sm" /> : null;
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="deva space-y-1 rounded-[var(--radius-card)] bg-sunken p-4 text-[12.5px] leading-5 text-ink-2">
          <p>• दस्ताने, मास्क और पूरी बाजू के कपड़े पहनकर छिड़काव करें।</p>
          <p>• हवा की दिशा में छिड़काव करें, खाली बोतल दोबारा इस्तेमाल न करें।</p>
          <p>• लेबल पर लिखी प्रतीक्षा अवधि पूरी होने से पहले तुड़ाई न करें।</p>
        </section>

        <footer className="text-center text-[11px] leading-4 text-faint">
          Dealer Copilot prototype · Show this page at any agri-input shop so the next advice knows what was sprayed.
        </footer>
      </div>
    </div>
  );
}
