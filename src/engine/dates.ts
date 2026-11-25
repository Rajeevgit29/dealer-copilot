const DAY = 86_400_000;

const toUtc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from a to b (b - a), using calendar dates only. */
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY);

export const addDays = (iso: string, n: number) => new Date(toUtc(iso) + n * DAY).toISOString().slice(0, 10);

export const todayIso = (now = new Date()) => {
  // India Standard Time calendar date.
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  return ist.toISOString().slice(0, 10);
};
