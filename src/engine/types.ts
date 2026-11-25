export type CropId = "cotton" | "paddy" | "tomato" | "chilli";
export type Method = "spray" | "granules" | "soil_drench" | "seed_treatment" | "nursery";

export interface Active {
  name: string;
  concentration: number | null;
  unit: string;
}

export interface Range {
  min: number;
  max: number;
}

/** One row of the CIB&RC approved-use table (data/generated/approved_uses.json). */
export interface ApprovedUse {
  id: string;
  kind: "insecticide" | "fungicide";
  formulation: string;
  formType: string | null;
  liquid: boolean | null;
  method: Method;
  actives: Active[];
  crop: CropId;
  pests: string[];
  pestRaw: string;
  genericBollwormClaim: boolean;
  doseAiRaw: string;
  doseFormulationRaw: string;
  doseFormulationPerHa: Range | null;
  waterRaw: string;
  waterPerHa: Range | null;
  phiDays: number | null;
  phiRaw: string;
  source: { doc: string; asOn: string; page: number };
}

export interface MoaGroup {
  /** e.g. "IRAC:4A", "FRAC:11", "PHER" */
  code: string;
  /** Short code shown on chips, e.g. "4A", "11", "M03" */
  short: string;
  scheme: "IRAC" | "FRAC" | "PHER";
  name: string;
  profile?: "broad" | "neutral" | "selective";
  risk?: "low" | "medium" | "high";
  beeHazard?: boolean;
  noResistanceRisk?: boolean;
}

export interface ActiveMoa {
  active: string;
  group: MoaGroup | null;
  confidence: "ok" | "check";
  note?: string;
}

export interface Product {
  id: string;
  brand: string;
  company: string | null;
  /** true when this is a generic "any brand" entry derived from the approved-use table */
  generic: boolean;
  formulation: string;
  formKey: string;
  formType: string | null;
  liquid: boolean;
  actives: Active[];
  packs: number[];
}

/** A spray that already went on the field. */
export interface SprayEvent {
  date: string; // ISO date
  formKey: string;
  label: string; // brand or formulation shown to the user
  actives: string[];
  groups: string[]; // MoA codes, e.g. ["IRAC:4A"]
  source?: "scan" | "manual" | "sale" | "passport";
}

export interface FieldContext {
  crop: CropId;
  sowingDate: string; // ISO date
  areaAcres: number;
  /** Next harvest or picking date, if known. */
  nextHarvestDate?: string | null;
}

export type Severity = "block" | "warn" | "info" | "good";

export type ReasonCode =
  | "NOT_APPROVED"
  | "SAME_GROUP_AS_LAST_SPRAY"
  | "GROUP_SEASON_LIMIT"
  | "GROUP_USED_BEFORE"
  | "PHI_EXCEEDS_HARVEST"
  | "PHI_UNKNOWN"
  | "UNKNOWN_GROUP"
  | "BEE_HAZARD_FLOWERING"
  | "PYRETHROID_EARLY_COTTON"
  | "HIGH_RISK_FUNGICIDE"
  | "NEW_GROUP"
  | "SELECTIVE"
  | "NO_RESISTANCE_RISK"
  | "GENERIC_BOLLWORM_CLAIM"
  | "SPECIAL_METHOD";

export interface Reason {
  code: ReasonCode;
  severity: Severity;
  en: string;
  hi: string;
}

export interface Dose {
  perAcre: Range;
  unit: "ml" | "g";
  waterPerAcre: Range | null;
  forField: Range;
  packs: { size: number; count: number }[] | null;
}

export type OptionStatus = "recommended" | "caution" | "blocked";

export interface Option {
  formKey: string;
  formulation: string;
  kind: "insecticide" | "fungicide";
  method: Method;
  actives: ActiveMoa[];
  groups: MoaGroup[];
  approvedUseId: string;
  pestRaw: string;
  phiDays: number | null;
  dose: Dose | null;
  doseRaw: string;
  products: Pick<Product, "id" | "brand" | "company" | "generic">[];
  status: OptionStatus;
  score: number;
  reasons: Reason[];
  source: ApprovedUse["source"];
}

export interface RecommendInput {
  field: FieldContext;
  history: SprayEvent[];
  pestId: string;
  today: string;
}

export interface RecommendResult {
  crop: CropId;
  pestId: string;
  cropAgeDays: number;
  daysToHarvest: number | null;
  lastSpray: SprayEvent | null;
  groupUseCounts: Record<string, number>;
  options: Option[];
  summary: { recommended: number; caution: number; blocked: number; total: number };
  dataSource: { name: string; asOn: string; url: string };
}
