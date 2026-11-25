const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_HI = ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस"];

export function fmtDate(iso: string | null | undefined, lang: "en" | "hi" = "en") {
  if (!iso) return "—";
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${(lang === "hi" ? MONTHS_HI : MONTHS)[m - 1]}`;
}

export function fmtDateLong(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11-10T06:00" -> "6 am" */
export function fmtHour(iso: string, addHours = 0) {
  const h = (Number(iso.slice(11, 13)) + addHours) % 24;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

export function dayLabel(iso: string, todayIso: string, lang: "en" | "hi" = "en") {
  const a = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const b = Date.UTC(+todayIso.slice(0, 4), +todayIso.slice(5, 7) - 1, +todayIso.slice(8, 10));
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return lang === "hi" ? "आज" : "Today";
  if (diff === 1) return lang === "hi" ? "कल" : "Tomorrow";
  return fmtDate(iso, lang);
}

export function daysAgo(iso: string, todayIso: string) {
  const a = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const b = Date.UTC(+todayIso.slice(0, 4), +todayIso.slice(5, 7) - 1, +todayIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export const todayLocal = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export const fmtQty = (n: number, unit: string) => (unit === "ml" && n >= 1000 ? `${+(n / 1000).toFixed(2)} L` : unit === "g" && n >= 1000 ? `${+(n / 1000).toFixed(2)} kg` : `${n} ${unit}`);

export const fmtRange = (r: { min: number; max: number }, unit: string) => (r.min === r.max ? fmtQty(r.max, unit) : `${fmtQty(r.min, unit).replace(` ${unit}`, "")}–${fmtQty(r.max, unit)}`);

export const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

export const addDaysIso = (iso: string, n: number) => {
  const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
};

/** [{size:500,count:1},{size:250,count:2}] -> "500 ml + 2 × 250 ml" */
export const fmtPacks = (packs: { size: number; count: number }[], unit: string) =>
  packs.map((p) => `${p.count > 1 ? `${p.count} × ` : ""}${fmtQty(p.size, unit)}`).join(" + ");
