-- Dealer Copilot schema.
-- Reference data (approved uses, MoA groups, products, pests) is versioned as
-- JSON in data/ and loaded by the engine; the database only holds what
-- happens at the counter.

create extension if not exists pgcrypto;

create table if not exists dealers (
  id           text primary key,
  name         text not null,
  shop_name    text not null,
  district_id  text not null,
  created_at   timestamptz not null default now()
);

-- Farmers are identified by a salted hash of their phone number. The raw
-- number is never stored; only the last 4 digits are kept for display.
create table if not exists farmers (
  id           uuid primary key default gen_random_uuid(),
  phone_hash   text not null unique,
  phone_last4  text not null,
  name         text,
  village      text,
  district_id  text not null,
  created_at   timestamptz not null default now()
);

create table if not exists fields (
  id                 uuid primary key default gen_random_uuid(),
  farmer_id          uuid not null references farmers(id) on delete cascade,
  label              text not null,
  crop               text not null check (crop in ('cotton', 'paddy', 'tomato', 'chilli')),
  sowing_date        date not null,
  area_acres         numeric(6, 2) not null check (area_acres > 0),
  next_harvest_date  date,
  passport_token     text not null unique default encode(gen_random_bytes(8), 'hex'),
  created_at         timestamptz not null default now()
);
create index if not exists fields_farmer_idx on fields (farmer_id);

-- Every spray that went on a field, whatever the brand or shop.
create table if not exists spray_events (
  id           uuid primary key default gen_random_uuid(),
  field_id     uuid not null references fields(id) on delete cascade,
  sprayed_on   date not null,
  form_key     text not null,
  label        text not null,
  product_id   text,
  company      text,
  actives      text[] not null,
  groups       text[] not null,
  source       text not null check (source in ('scan', 'manual', 'sale', 'passport')),
  dealer_id    text references dealers(id),
  created_at   timestamptz not null default now()
);
create index if not exists spray_events_field_idx on spray_events (field_id, sprayed_on);

create table if not exists consultations (
  id                     uuid primary key default gen_random_uuid(),
  dealer_id              text not null references dealers(id),
  field_id               uuid not null references fields(id) on delete cascade,
  pest_id                text not null,
  diagnosis_source       text not null check (diagnosis_source in ('photo', 'manual')),
  diagnosis_confidence   numeric(4, 3),
  options_total          int not null,
  options_recommended    int not null,
  options_blocked        int not null,
  requested_form_key     text,
  requested_status       text check (requested_status in ('recommended', 'caution', 'blocked', 'not_approved')),
  chosen_form_key        text,
  chosen_status          text check (chosen_status in ('recommended', 'caution', 'blocked')),
  created_at             timestamptz not null default now()
);
create index if not exists consultations_created_idx on consultations (created_at);

-- Which rules fired in a consultation (aggregated per code).
create table if not exists rule_hits (
  consultation_id  uuid not null references consultations(id) on delete cascade,
  code             text not null,
  severity         text not null,
  hits             int not null,
  primary key (consultation_id, code)
);

-- Digital sale record: the dealer -> farmer traceability link the draft
-- Pesticides Management Bill 2025 asks for.
create table if not exists sales (
  id               uuid primary key default gen_random_uuid(),
  trace_id         text not null unique,
  consultation_id  uuid references consultations(id) on delete set null,
  dealer_id        text not null references dealers(id),
  field_id         uuid not null references fields(id) on delete cascade,
  product_id       text,
  form_key         text not null,
  label            text not null,
  quantity         numeric(10, 2),
  unit             text,
  created_at       timestamptz not null default now()
);

create table if not exists trap_counts (
  id           uuid primary key default gen_random_uuid(),
  dealer_id    text references dealers(id),
  district_id  text not null,
  pest_id      text not null,
  count_date   date not null,
  moths        int not null check (moths >= 0),
  trap_label   text,
  created_at   timestamptz not null default now()
);
create index if not exists trap_counts_district_idx on trap_counts (district_id, pest_id, count_date);
