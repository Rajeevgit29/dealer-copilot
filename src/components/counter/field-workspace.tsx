"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, MapPin, MousePointerClick, Sprout } from "lucide-react";
import type { Option, RecommendResult } from "@/engine";
import { Badge, Card } from "../ui";
import { useLang } from "../lang";
import { PassportTimeline, type Spray } from "./passport-timeline";
import { AddSpraySheet, type SampleMeta } from "./add-spray-sheet";
import { HarvestPicker, ProblemPicker } from "./problem-picker";
import { AdvicePanel } from "./advice";
import { SellSheet } from "./sell-sheet";
import { useWeather } from "./conditions";
import { api } from "@/lib/api-client";
import { cropById, districtById, type CropId } from "@/lib/ref-lite";
import { daysAgo, todayLocal } from "@/lib/format";

export interface FieldData {
  field: { id: string; label: string; crop: CropId; sowing_date: string; area_acres: string; next_harvest_date: string | null; passport_token: string };
  farmer: { id: string; name: string | null; village: string | null; phone_last4: string; district_id: string };
  sprays: Spray[];
}

export function FieldWorkspace({ initial, dealerId, aiEnabled, samples }: { initial: FieldData; dealerId: string; aiEnabled: boolean; samples: SampleMeta[] }) {
  const { t, lang } = useLang();
  const [data, setData] = useState(initial);
  const [pest, setPest] = useState<{ id: string; source: "photo" | "manual"; confidence?: number } | null>(null);
  const [harvest, setHarvest] = useState<string | null>(initial.field.next_harvest_date);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selling, setSelling] = useState<Option | null>(null);
  const [requested, setRequested] = useState<string | null>(null);
  const adviceRef = useRef<HTMLDivElement>(null);
  const weather = useWeather(data.farmer.district_id);

  const { field, farmer, sprays } = data;
  const crop = cropById(field.crop);
  const today = todayLocal();
  const area = Number(field.area_acres);

  const reload = useCallback(async () => {
    setData(await api.get<FieldData>(`/api/v1/fields/${field.id}`));
  }, [field.id]);

  const body = {
    field: { crop: field.crop, sowingDate: field.sowing_date, areaAcres: area, nextHarvestDate: harvest },
    history: sprays.map((s) => ({ date: s.sprayed_on, formKey: s.form_key, label: s.label, actives: s.actives })),
    pestId: pest?.id,
  };
  const bodyKey = JSON.stringify(body);

  useEffect(() => {
    if (!pest) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state while the engine runs
    setLoading(true);
    api
      .post<RecommendResult>("/api/v1/recommend", JSON.parse(bodyKey))
      .then((r) => alive && setResult(r))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [bodyKey, pest]);

  const pickPest = (id: string, source: "photo" | "manual", confidence?: number) => {
    setPest({ id, source, confidence });
    setRequested(null);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(() => adviceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  };

  const avoidGroups = result
    ? [...new Set([...(result.lastSpray?.groups ?? []), ...Object.entries(result.groupUseCounts).filter(([, n]) => n >= 2).map(([g]) => g)])]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/counter" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <a href={`/passport/${field.passport_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          {t("openPassport")}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      <Card className="flex items-center gap-3.5 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Sprout className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{farmer.name ?? "Farmer"}</h1>
            <span className="text-[12.5px] text-faint tabular">•••• {farmer.phone_last4}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <Badge tone="brand">{lang === "hi" ? crop?.hi : crop?.en}</Badge>
            <span className="tabular">
              {daysAgo(field.sowing_date, today)} {t("daysOld")} · {area} {t("acres")}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {farmer.village ? `${farmer.village}, ` : ""}
              {districtById(farmer.district_id)?.name}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <PassportTimeline
            sprays={sprays}
            currentDealerId={dealerId}
            onAdd={() => setAddOpen(true)}
            onRemove={async (id) => {
              await api.del(`/api/v1/fields/${field.id}/sprays/${id}`);
              reload();
            }}
          />
          <ProblemPicker crop={field.crop} value={pest?.id ?? null} onChange={pickPest} aiEnabled={aiEnabled} />
          <HarvestPicker
            value={harvest}
            sowingDate={field.sowing_date}
            estimatedDays={result && !harvest ? result.daysToHarvest : null}
            onChange={(v) => {
              setHarvest(v);
              api.patch(`/api/v1/fields/${field.id}`, { nextHarvestDate: v }).catch(() => {});
            }}
          />
        </div>

        <div ref={adviceRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-20">
          {pest ? (
            <AdvicePanel result={result} loading={loading} weather={weather} areaAcres={area} fieldCtx={{ body }} onSell={setSelling} onRequested={setRequested} />
          ) : (
            <Card className="hidden flex-col items-center px-8 py-16 text-center lg:flex">
              <span className="mb-3 grid size-11 place-items-center rounded-full bg-sunken text-muted">
                <MousePointerClick className="size-5" />
              </span>
              <div className="text-[14.5px] font-medium">{lang === "hi" ? "समस्या चुनें" : "Pick the problem"}</div>
              <p className="mt-1 max-w-xs text-[13px] leading-5 text-muted">
                {lang === "hi"
                  ? "इस खेत के छिड़काव इतिहास के आधार पर केवल स्वीकृत और रोटेशन-सुरक्षित विकल्प दिखेंगे।"
                  : "You will see only label-approved options that are safe to rotate after this field's spray history."}
              </p>
            </Card>
          )}
        </div>
      </div>

      <AddSpraySheet open={addOpen} onClose={() => setAddOpen(false)} fieldId={field.id} aiEnabled={aiEnabled} samples={samples} onAdded={reload} />
      <SellSheet
        option={selling}
        onClose={() => setSelling(null)}
        onSold={() => {
          setPest(null);
          setResult(null);
          setRequested(null);
          reload();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        ctx={{
          fieldId: field.id,
          pestId: pest?.id ?? "",
          crop: field.crop,
          areaAcres: area,
          farmerName: farmer.name,
          phoneLast4: farmer.phone_last4,
          diagnosisSource: pest?.source ?? "manual",
          diagnosisConfidence: pest?.confidence ?? null,
          requestedFormKey: requested,
          avoidGroups,
        }}
      />
    </div>
  );
}
