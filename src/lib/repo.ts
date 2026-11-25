import "server-only";
import { randomBytes } from "node:crypto";
import { groupsFor, productById, todayIso, type CropId, type Option, type SprayEvent } from "@/engine";
import { q, q1, tx } from "./db";
import { hashPhone, normalisePhone } from "./phone";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface DealerRow {
  id: string;
  name: string;
  shop_name: string;
  district_id: string;
}

export interface FarmerRow {
  id: string;
  phone_last4: string;
  name: string | null;
  village: string | null;
  district_id: string;
}

export interface FieldRow {
  id: string;
  farmer_id: string;
  label: string;
  crop: CropId;
  sowing_date: string;
  area_acres: string;
  next_harvest_date: string | null;
  passport_token: string;
}

export interface SprayRow {
  id: string;
  field_id: string;
  sprayed_on: string;
  form_key: string;
  label: string;
  product_id: string | null;
  company: string | null;
  actives: string[];
  groups: string[];
  source: NonNullable<SprayEvent["source"]>;
  dealer_id: string | null;
  shop_name: string | null;
}

const DATE = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`;
const FIELD_COLS = `id, farmer_id, label, crop, ${DATE("sowing_date")} as sowing_date, area_acres, ${DATE("next_harvest_date")} as next_harvest_date, passport_token`;

export const toSprayEvent = (s: SprayRow): SprayEvent => ({
  date: s.sprayed_on,
  formKey: s.form_key,
  label: s.label,
  actives: s.actives,
  groups: s.groups,
  source: s.source,
});

// ---------------------------------------------------------------------------
// Dealers
// ---------------------------------------------------------------------------

export const listDealers = () => q<DealerRow>("select id, name, shop_name, district_id from dealers order by district_id, id");
export const getDealer = (id: string) => q1<DealerRow>("select id, name, shop_name, district_id from dealers where id = $1", [id]);

export async function dealerToday(dealerId: string) {
  const today = todayIso();
  return q1<{ consultations: number; sales: number; prevented: number }>(
    `select
       (select count(*)::int from consultations where dealer_id = $1 and created_at::date = $2) as consultations,
       (select count(*)::int from sales where dealer_id = $1 and created_at::date = $2) as sales,
       (select count(*)::int from consultations where dealer_id = $1 and requested_status = 'blocked' and chosen_form_key <> requested_form_key) as prevented`,
    [dealerId, today],
  );
}

export async function recentConsultations(dealerId: string, limit = 8) {
  return q<{ id: string; created_at: string; pest_id: string; crop: CropId; farmer_name: string | null; phone_last4: string; field_id: string; chosen_status: string | null; label: string | null; requested_status: string | null }>(
    `select c.id, c.created_at, c.pest_id, f.crop, fa.name as farmer_name, fa.phone_last4, f.id as field_id, c.chosen_status, s.label, c.requested_status
       from consultations c
       join fields f on f.id = c.field_id
       join farmers fa on fa.id = f.farmer_id
       left join sales s on s.consultation_id = c.id
      where c.dealer_id = $1
      order by c.created_at desc
      limit $2`,
    [dealerId, limit],
  );
}

// ---------------------------------------------------------------------------
// Farmers & fields
// ---------------------------------------------------------------------------

export async function findFarmerByPhone(phoneRaw: string) {
  const phone = normalisePhone(phoneRaw);
  if (!phone) return { error: "invalid_phone" as const };
  const farmer = await q1<FarmerRow>("select id, phone_last4, name, village, district_id from farmers where phone_hash = $1", [hashPhone(phone)]);
  if (!farmer) return { farmer: null, fields: [] as (FieldRow & { sprays: number; last_spray: string | null })[] };
  const fields = await q<FieldRow & { sprays: number; last_spray: string | null }>(
    `select * from (
       select ${FIELD_COLS}, created_at,
              (select count(*)::int from spray_events s where s.field_id = fields.id) as sprays,
              (select ${DATE("max(sprayed_on)")} from spray_events s where s.field_id = fields.id) as last_spray
         from fields where farmer_id = $1) f
      order by f.created_at`,
    [farmer.id],
  );
  return { farmer, fields };
}

export async function createFarmer(input: { phone: string; name?: string | null; village?: string | null; districtId: string }) {
  const phone = normalisePhone(input.phone);
  if (!phone) throw new Error("invalid_phone");
  return q1<FarmerRow>(
    `insert into farmers (phone_hash, phone_last4, name, village, district_id) values ($1,$2,$3,$4,$5)
     on conflict (phone_hash) do update set name = coalesce(excluded.name, farmers.name), village = coalesce(excluded.village, farmers.village)
     returning id, phone_last4, name, village, district_id`,
    [hashPhone(phone), phone.slice(-4), input.name || null, input.village || null, input.districtId],
  );
}

export async function createField(farmerId: string, input: { label: string; crop: CropId; sowingDate: string; areaAcres: number; nextHarvestDate?: string | null }) {
  return q1<FieldRow>(
    `insert into fields (farmer_id, label, crop, sowing_date, area_acres, next_harvest_date) values ($1,$2,$3,$4,$5,$6) returning ${FIELD_COLS}`,
    [farmerId, input.label, input.crop, input.sowingDate, input.areaAcres, input.nextHarvestDate || null],
  );
}

export async function updateFieldHarvest(fieldId: string, nextHarvestDate: string | null) {
  return q1<FieldRow>(`update fields set next_harvest_date = $2 where id = $1 returning ${FIELD_COLS}`, [fieldId, nextHarvestDate]);
}

async function sprays(where: string, param: string) {
  return q<SprayRow>(
    `select s.id, s.field_id, ${DATE("s.sprayed_on")} as sprayed_on, s.form_key, s.label, s.product_id, s.company, s.actives, s.groups, s.source, s.dealer_id, d.shop_name
       from spray_events s left join dealers d on d.id = s.dealer_id
      where ${where} = $1 order by s.sprayed_on, s.created_at`,
    [param],
  );
}

export async function getField(fieldId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(fieldId)) return null;
  const field = await q1<FieldRow>(`select ${FIELD_COLS} from fields where id = $1`, [fieldId]);
  if (!field) return null;
  const farmer = await q1<FarmerRow>("select id, phone_last4, name, village, district_id from farmers where id = $1", [field.farmer_id]);
  return { field, farmer: farmer!, sprays: await sprays("s.field_id", fieldId) };
}

export async function getFieldByPassport(token: string) {
  const field = await q1<FieldRow>(`select ${FIELD_COLS} from fields where passport_token = $1`, [token]);
  if (!field) return null;
  const farmer = await q1<FarmerRow>("select id, phone_last4, name, village, district_id from farmers where id = $1", [field.farmer_id]);
  return { field, farmer: farmer!, sprays: await sprays("s.field_id", field.id) };
}

export async function addSpray(
  fieldId: string,
  input: { date: string; formKey: string; label: string; productId?: string | null; actives: string[]; source: SprayEvent["source"]; dealerId?: string | null },
) {
  const product = input.productId ? productById(input.productId) : null;
  const groups = groupsFor(input.actives).map((g) => g.code);
  return q1<SprayRow>(
    `insert into spray_events (field_id, sprayed_on, form_key, label, product_id, company, actives, groups, source, dealer_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning id, field_id, ${DATE("sprayed_on")} as sprayed_on, form_key, label, product_id, company, actives, groups, source, dealer_id, null::text as shop_name`,
    [fieldId, input.date, input.formKey, input.label, product && !product.generic ? product.id : null, product?.company ?? null, input.actives, groups, input.source, input.dealerId ?? null],
  );
}

export async function deleteSpray(fieldId: string, sprayId: string) {
  const rows = await q<{ id: string }>("delete from spray_events where id = $1 and field_id = $2 returning id", [sprayId, fieldId]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Consultation + sale (one transaction)
// ---------------------------------------------------------------------------

export async function recordConsultation(input: {
  dealerId: string;
  fieldId: string;
  pestId: string;
  diagnosisSource: "photo" | "manual";
  diagnosisConfidence?: number | null;
  options: Option[];
  requested?: { formKey: string; status: "recommended" | "caution" | "blocked" | "not_approved" } | null;
  chosen?: { option: Option; productId?: string | null; label: string; quantity: number | null; unit: string | null } | null;
}) {
  const today = todayIso();
  return tx(async (c) => {
    const summary = { total: input.options.length, recommended: 0, blocked: 0 };
    for (const o of input.options) {
      if (o.status === "recommended") summary.recommended++;
      if (o.status === "blocked") summary.blocked++;
    }
    const cons = await c.query<{ id: string }>(
      `insert into consultations (dealer_id, field_id, pest_id, diagnosis_source, diagnosis_confidence, options_total, options_recommended, options_blocked,
         requested_form_key, requested_status, chosen_form_key, chosen_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [
        input.dealerId, input.fieldId, input.pestId, input.diagnosisSource, input.diagnosisConfidence ?? null,
        summary.total, summary.recommended, summary.blocked,
        input.requested?.formKey ?? null, input.requested?.status ?? null,
        input.chosen?.option.formKey ?? null, input.chosen?.option.status ?? null,
      ],
    );
    const consultationId = cons.rows[0].id;
    const hits = new Map<string, { severity: string; n: number }>();
    for (const o of input.options)
      for (const r of o.reasons)
        if (r.severity === "block" || r.severity === "warn") {
          const h = hits.get(r.code) ?? { severity: r.severity, n: 0 };
          h.n++;
          hits.set(r.code, h);
        }
    for (const [code, h] of hits) {
      await c.query("insert into rule_hits (consultation_id, code, severity, hits) values ($1,$2,$3,$4)", [consultationId, code, h.severity, h.n]);
    }

    let sale: { trace_id: string; id: string } | null = null;
    if (input.chosen) {
      const traceId = `DC-${today.replaceAll("-", "").slice(2)}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const s = await c.query<{ id: string; trace_id: string }>(
        `insert into sales (trace_id, consultation_id, dealer_id, field_id, product_id, form_key, label, quantity, unit)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, trace_id`,
        [traceId, consultationId, input.dealerId, input.fieldId, input.chosen.productId ?? null, input.chosen.option.formKey, input.chosen.label, input.chosen.quantity, input.chosen.unit],
      );
      sale = s.rows[0];
      const product = input.chosen.productId ? productById(input.chosen.productId) : null;
      const actives = input.chosen.option.actives.map((a) => a.active);
      await c.query(
        `insert into spray_events (field_id, sprayed_on, form_key, label, product_id, company, actives, groups, source, dealer_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'sale',$9)`,
        [input.fieldId, today, input.chosen.option.formKey, input.chosen.label, product && !product.generic ? product.id : null, product?.company ?? null, actives, groupsFor(actives).map((g) => g.code), input.dealerId],
      );
    }
    return { consultationId, sale };
  });
}

// ---------------------------------------------------------------------------
// Traps
// ---------------------------------------------------------------------------

export async function addTrapCount(input: { dealerId: string; districtId: string; pestId: string; date: string; moths: number; trapLabel?: string | null }) {
  return q1<{ id: string }>(
    "insert into trap_counts (dealer_id, district_id, pest_id, count_date, moths, trap_label) values ($1,$2,$3,$4,$5,$6) returning id",
    [input.dealerId, input.districtId, input.pestId, input.date, input.moths, input.trapLabel ?? null],
  );
}

export async function trapReadings(districtId: string, pestId: string, days = 21) {
  return q<{ date: string; moths: number; readings: number }>(
    `select ${DATE("count_date")} as date, max(moths)::int as moths, count(*)::int as readings
       from trap_counts where district_id = $1 and pest_id = $2 and count_date > $3::date - $4::int
      group by count_date order by count_date`,
    [districtId, pestId, todayIso(), days],
  );
}

// ---------------------------------------------------------------------------
// Insights (Syngenta HQ view). All aggregates; no farmer-level data leaves here.
// ---------------------------------------------------------------------------

/** Date the copilot went live at the demo dealers (synthetic data). */
export const ROLLOUT = "2026-09-01";

export async function insights() {
  const today = todayIso();
  const [totals] = await q<{ dealers: number; farmers: number; fields: number; sprays: number; consultations: number; prevented: number; asked_blocked: number; traced_sales: number }>(
    `select (select count(*)::int from dealers) dealers,
            (select count(*)::int from farmers) farmers,
            (select count(*)::int from fields) fields,
            (select count(*)::int from spray_events) sprays,
            (select count(*)::int from consultations) consultations,
            (select count(*)::int from consultations where requested_status = 'blocked' and chosen_form_key <> requested_form_key) prevented,
            (select count(*)::int from consultations where requested_status = 'blocked') asked_blocked,
            (select count(*)::int from sales) traced_sales`,
  );

  const repeatCte = `with ordered as (
      select s.field_id, s.sprayed_on, s.groups,
             lag(s.groups) over (partition by s.field_id order by s.sprayed_on, s.created_at) as prev_groups,
             lag(s.sprayed_on) over (partition by s.field_id order by s.sprayed_on, s.created_at) as prev_date
        from spray_events s)`;

  const districts = await q<{ district_id: string; fields: number; sprays: number; pairs: number; repeats: number; before_pairs: number; before_repeats: number; after_pairs: number; after_repeats: number; top_group: string | null; top_pest: string | null; consultations: number }>(
    `${repeatCte},
     per_field as (select o.*, fa.district_id from ordered o join fields f on f.id = o.field_id join farmers fa on fa.id = f.farmer_id),
     grp as (
       select district_id, g, count(*) n, row_number() over (partition by district_id order by count(*) desc) rk
         from per_field, unnest(groups) g group by district_id, g),
     pest as (
       select d.district_id, c.pest_id, count(*) n, row_number() over (partition by d.district_id order by count(*) desc) rk
         from consultations c join dealers d on d.id = c.dealer_id where c.created_at > $1::date - 30 group by d.district_id, c.pest_id)
     select p.district_id,
            count(distinct p.field_id)::int fields,
            count(*)::int sprays,
            count(*) filter (where prev_groups is not null)::int pairs,
            count(*) filter (where prev_groups && groups and sprayed_on - prev_date <= 30)::int repeats,
            count(*) filter (where prev_groups is not null and sprayed_on < $2::date)::int before_pairs,
            count(*) filter (where prev_groups && groups and sprayed_on - prev_date <= 30 and sprayed_on < $2::date)::int before_repeats,
            count(*) filter (where prev_groups is not null and sprayed_on >= $2::date)::int after_pairs,
            count(*) filter (where prev_groups && groups and sprayed_on - prev_date <= 30 and sprayed_on >= $2::date)::int after_repeats,
            (select g from grp where grp.district_id = p.district_id and rk = 1) top_group,
            (select pest_id from pest where pest.district_id = p.district_id and rk = 1) top_pest,
            (select count(*)::int from consultations c join dealers d on d.id = c.dealer_id where d.district_id = p.district_id) consultations
       from per_field p group by p.district_id`,
    [today, ROLLOUT],
  );

  const weekly = await q<{ week: string; pairs: number; repeats: number }>(
    `${repeatCte}
     select to_char(date_trunc('week', sprayed_on), 'YYYY-MM-DD') week,
            count(*) filter (where prev_groups is not null)::int pairs,
            count(*) filter (where prev_groups && groups and sprayed_on - prev_date <= 30)::int repeats
       from ordered where sprayed_on >= '2026-07-01' group by 1 order by 1`,
  );

  const groupMix = await q<{ week: string; group_code: string; n: number }>(
    `select to_char(date_trunc('week', sprayed_on), 'YYYY-MM-DD') week, g group_code, count(*)::int n
       from spray_events, unnest(groups) g where sprayed_on >= '2026-07-01' group by 1, 2 order by 1`,
  );

  const pestWeekly = await q<{ week: string; pest_id: string; n: number }>(
    `select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') week, pest_id, count(*)::int n
       from consultations group by 1, 2 order by 1`,
  );

  const rules = await q<{ code: string; severity: string; consultations: number }>(
    `select code, severity, count(distinct consultation_id)::int consultations from rule_hits group by 1, 2 order by 3 desc`,
  );

  const companies = await q<{ company: string; n: number }>(
    `select coalesce(company, 'Generic / other') company, count(*)::int n from spray_events where sprayed_on > $1::date - 60 group by 1 order by 2 desc`,
    [today],
  );

  const traps = await q<{ district_id: string; date: string; moths: number }>(
    `select district_id, ${DATE("count_date")} date, max(moths)::int moths from trap_counts
      where pest_id = 'pink_bollworm' and count_date > $1::date - 21 group by 1, 2 order by 1, 2`,
    [today],
  );

  return { today, totals, districts, weekly, groupMix, pestWeekly, rules, companies, traps };
}

// ---------------------------------------------------------------------------
// Demo reset: put the walkthrough farmer back to "three brands, one chemistry".
// ---------------------------------------------------------------------------

export const DEMO_PASSPORT = "demo-suresh-cotton";

export async function resetDemo() {
  const field = await q1<{ id: string }>("select id from fields where passport_token = $1", [DEMO_PASSPORT]);
  if (!field) return false;
  await tx(async (c) => {
    await c.query("delete from consultations where field_id = $1", [field.id]);
    await c.query("delete from spray_events where field_id = $1", [field.id]);
    await c.query("update fields set next_harvest_date = null where id = $1", [field.id]);
    const rows: [string, string | null, string, string, string, string, string][] = [
      ["2026-09-25", "syn-actara", "Actara", "Syngenta", "thiamethoxam", "thiamethoxam@25|WG", "dealer-yavatmal-1"],
      ["2026-10-12", "bay-confidor", "Confidor", "Bayer", "imidacloprid", "imidacloprid@17.8|SL", "dealer-yavatmal-2"],
      ["2026-10-28", null, "Acetamiprid 20% SP (local brand)", "", "acetamiprid", "acetamiprid@20|SP", "dealer-yavatmal-2"],
    ];
    for (const [date, productId, label, company, active, key, dealer] of rows) {
      await c.query(
        `insert into spray_events (field_id, sprayed_on, form_key, label, product_id, company, actives, groups, source, dealer_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'scan',$9)`,
        [field.id, date, key, label, productId, company || null, [active], groupsFor([active]).map((g) => g.code), dealer],
      );
    }
  });
  return true;
}
