import { addDays } from "./dates";

export interface TrapReading {
  date: string;
  moths: number;
}

export type TrapLevel = "above" | "watch" | "below" | "no_data";

/**
 * Economic-threshold check for pheromone-trap counts.
 * Default threshold follows ICAR-CICR for pink bollworm: 8 moths per trap per
 * day on 3 consecutive days.
 */
export function trapStatus(readings: TrapReading[], today: string, etl = 8, consecutiveDays = 3) {
  const byDate = new Map<string, number>();
  for (const r of readings) byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, r.moths));
  const recent = [...byDate.entries()].filter(([d]) => d <= today && d > addDays(today, -14)).sort(([a], [b]) => a.localeCompare(b));
  if (!recent.length) return { level: "no_data" as TrapLevel, streak: 0, latest: null as number | null, etl, consecutiveDays };

  // Longest run of consecutive calendar days at or above the threshold, ending on the latest reading.
  let streak = 0;
  let cursor = recent.at(-1)![0];
  while (byDate.has(cursor) && byDate.get(cursor)! >= etl) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  const latest = recent.at(-1)![1];
  const level: TrapLevel = streak >= consecutiveDays ? "above" : latest >= etl || streak > 0 || latest >= etl * 0.6 ? "watch" : "below";
  return { level, streak, latest, etl, consecutiveDays };
}
