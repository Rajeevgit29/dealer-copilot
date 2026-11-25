import Link from "next/link";
import { ArrowRight, Check, CircleX, ScanLine, ShieldAlert, ShieldCheck, Shuffle } from "lucide-react";
import { APPROVED_USES, DATA_SOURCE } from "@/engine";
import { Disclaimer, SiteNav } from "@/components/brand";
import { MoaChip } from "@/components/moa";

const FACTS = [
  {
    stat: "52%",
    text: "of Indian farmers take plant-protection advice from the pesticide dealer, more than from extension officers.",
    src: "ICAR study on sources of pest-management advice",
    href: "https://epubs.icar.org.in/index.php/TJRA/article/download/133727/49388/351792",
  },
  {
    stat: "$307M",
    text: "and 11.4 years to discover, develop and register one new crop-protection active ingredient. Resistance shortens its useful life.",
    src: "AgbioInvestor for CropLife International, 2026",
    href: "https://www.agribusinessglobal.com/agrochemicals/innovation-delayed-is-progress-denied-new-study-reveals-307m-cost-and-11-year-path-to-crop-protection-innovation/",
  },
  {
    stat: "40–50%",
    text: "of north India's cotton was lost in the 2015 whitefly outbreak, after resistance to almost all insecticides and indiscriminate mixtures.",
    src: "ICAR-CICR",
    href: "https://cicr.icar.gov.in/wp-content/uploads/PA_24_Whitefly.pdf",
  },
  {
    stat: "25 of 66",
    text: "formulations approved for whitefly on cotton contain a neonicotinoid (IRAC 4A), before counting the many brands each is sold under.",
    src: "Computed from the CIB&RC approved-use list, 30 Sep 2026",
    href: "https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted">
                <span className="size-1.5 rounded-full bg-brand" />
                Prototype for agri-input dealers in India
              </div>
              <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[46px]">
                Every spray recommendation in India is made without knowing what was sprayed before.
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-2">
                Farmers switch brands and believe they have switched chemistry. Dealer Copilot gives the shop counter a memory: it reads the empty bottles, works out the mode of action behind
                every brand, and recommends only label-approved options that rotate.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link href="/counter" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[14.5px] font-medium text-white hover:bg-ink-2">
                  Open the dealer counter
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/insights" className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-5 text-[14.5px] font-medium hover:border-line-strong">
                  HQ insights
                </Link>
                <Link href="/developers" className="inline-flex h-11 items-center rounded-xl px-4 text-[14.5px] font-medium text-ink-2 hover:bg-sunken">
                  API
                </Link>
              </div>
              <p className="mt-4 text-[12.5px] text-muted">
                Try the demo farmer at the counter: <span className="font-medium text-ink-2 tabular">98765 43210</span>
              </p>
            </div>

            <ExampleCard />
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.stat} className="bg-surface px-6 py-7">
                <div className="text-[30px] font-semibold tracking-tight tabular">{f.stat}</div>
                <p className="mt-2 text-[13.5px] leading-6 text-ink-2">{f.text}</p>
                <a href={f.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[11.5px] text-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
                  {f.src}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-[24px] font-semibold tracking-tight">At the counter, in under a minute</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted">
            The dealer already decides what most farmers spray. The copilot puts the field&apos;s history and the legal label claims in front of them at that moment.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ScanLine,
                title: "Scan what was sprayed",
                body: "Photograph empty bottles or the last bill. The label's active ingredient is mapped to its IRAC/FRAC group, whatever the brand or shop.",
              },
              {
                icon: ShieldCheck,
                title: "Check it against the label",
                body: `Only uses approved by CIB&RC for that crop and pest are offered: ${APPROVED_USES.length} approved-use rows parsed from the government list, with dose and waiting period.`,
              },
              {
                icon: Shuffle,
                title: "Rotate, don't repeat",
                body: "Options that repeat the last spray's group, overuse a group, or break the pre-harvest interval are blocked, with the reason in Hindi and English.",
              },
            ].map((s, i) => (
              <div key={s.title} className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                    <s.icon className="size-4.5" />
                  </span>
                  <span className="text-[12px] font-medium text-faint tabular">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <h3 className="text-[16px] font-semibold tracking-tight">What is real in this prototype</h3>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-6 text-ink-2">
                {[
                  `Approved uses, doses and waiting periods from ${DATA_SOURCE.name}, as on ${DATA_SOURCE.asOn}, parsed from the official PDFs`,
                  "IRAC and FRAC mode-of-action groups for every active ingredient in that list",
                  "ICAR-CICR pink bollworm trap threshold (8 moths per trap, 3 days in a row)",
                  "Live spray-window weather from Open-Meteo for each district",
                  "Photo reading of labels, bills and crop problems via Gemini, when an API key is set",
                ].map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <Check className="mt-1 size-4 shrink-0 text-good" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <h3 className="text-[16px] font-semibold tracking-tight">What is simulated</h3>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-6 text-ink-2">
                {[
                  "The season of counter activity behind the HQ dashboard: 32 fictional dealers and ~680 fields, generated by a documented behaviour model. Every consultation in it was still decided by the real rules engine",
                  "Sample bottles, used when photo reading is switched off",
                  "Brand pack sizes, which should be verified before use",
                ].map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-warn" />
                    {x}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[13px] leading-6 text-muted">
                The AI only reads photos and returns facts as validated JSON. Every recommendation is made by deterministic, unit-tested rules, so it can be audited by an agronomist.
              </p>
            </div>
          </div>
          <Disclaimer className="mt-10 max-w-3xl" />
        </section>
      </main>
    </>
  );
}

/** Static illustration of the real counter flow (same components and data shapes). */
function ExampleCard() {
  const rows = [
    { date: "28 Oct", label: "Acetamiprid 20% SP", by: "local brand" },
    { date: "12 Oct", label: "Confidor", by: "Bayer · imidacloprid" },
    { date: "25 Sep", label: "Actara", by: "Syngenta · thiamethoxam" },
  ];
  return (
    <div className="relative">
      <div className="rounded-[22px] border border-line bg-surface p-4 shadow-[var(--shadow-pop)] sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold">Suresh · Cotton, 2 acres</div>
            <div className="text-[12px] text-muted">Spray passport · Yavatmal</div>
          </div>
          <span className="rounded-md bg-sunken px-2 py-1 text-[11px] text-muted">142 days</span>
        </div>
        <div className="mt-3 flex gap-2.5 rounded-xl bg-bad-soft px-3 py-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-bad" />
          <div className="text-[12.5px] leading-5">
            <span className="font-semibold text-bad">3 sprays in a row from IRAC 4A.</span> <span className="text-ink-2">Three brands, one chemistry.</span>
          </div>
        </div>
        <ol className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.date} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2">
              <span className="w-11 text-[11.5px] text-muted tabular">{r.date}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{r.label}</span>
                <span className="block truncate text-[11px] text-muted">{r.by}</span>
              </span>
              <MoaChip code="IRAC:4A" short="4A" size="sm" />
            </li>
          ))}
        </ol>
        <div className="mt-4 border-t border-line pt-3.5">
          <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">Whitefly · options</div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">Spiromesifen 22.9% SC</span>
                <span className="block text-[11px] text-muted">245 ml/acre · 10 days before harvest</span>
              </span>
              <MoaChip code="IRAC:23" short="23" size="sm" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 opacity-70">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                  <CircleX className="size-3.5 text-bad" /> Thiamethoxam 25% WG
                </span>
                <span className="block text-[11px] text-bad">Same group as the last spray</span>
              </span>
              <MoaChip code="IRAC:4A" short="4A" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
