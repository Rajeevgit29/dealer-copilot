export interface HourlyWeather {
  time: string[]; // local ISO "2026-11-09T06:00"
  temperature: number[]; // °C
  humidity: number[]; // %
  precipitation: number[]; // mm
  precipProbability: number[]; // %
  wind: number[]; // km/h at 10 m
}

export type HourVerdict = "good" | "ok" | "bad";

export interface HourAssessment {
  time: string;
  verdict: HourVerdict;
  reasons: string[];
  temperature: number;
  wind: number;
  precipProbability: number;
}

/** Defaults for ground (knapsack/boom) spraying. Conservative, configurable. */
export const SPRAY_LIMITS = {
  rainFreeHours: 4,
  rainMm: 0.2,
  rainProbability: 40,
  maxWind: 15,
  minWind: 3,
  maxTemp: 35,
  dayStart: 6,
  dayEnd: 18,
};

const hourOf = (t: string) => Number(t.slice(11, 13));

export function assessHours(w: HourlyWeather, limits = SPRAY_LIMITS): HourAssessment[] {
  return w.time.map((time, i) => {
    const reasons: string[] = [];
    let verdict: HourVerdict = "good";
    const h = hourOf(time);
    if (h < limits.dayStart || h >= limits.dayEnd) {
      verdict = "bad";
      reasons.push("dark");
    }
    const ahead = (arr: number[]) => arr.slice(i, i + limits.rainFreeHours);
    if (ahead(w.precipitation).some((p) => p >= limits.rainMm) || ahead(w.precipProbability).some((p) => p >= limits.rainProbability)) {
      verdict = "bad";
      reasons.push("rain");
    }
    if (w.wind[i] > limits.maxWind) {
      verdict = "bad";
      reasons.push("wind");
    } else if (w.wind[i] < limits.minWind && verdict === "good") {
      verdict = "ok";
      reasons.push("calm");
    }
    if (w.temperature[i] > limits.maxTemp) {
      verdict = "bad";
      reasons.push("heat");
    }
    return { time, verdict, reasons, temperature: w.temperature[i], wind: w.wind[i], precipProbability: w.precipProbability[i] };
  });
}

export interface SprayWindow {
  start: string;
  end: string;
  hours: number;
}

/** Contiguous daylight runs of good/ok hours (at least `minHours` long). */
export function sprayWindows(hours: HourAssessment[], minHours = 2): SprayWindow[] {
  const out: SprayWindow[] = [];
  let start = -1;
  for (let i = 0; i <= hours.length; i++) {
    const ok = i < hours.length && hours[i].verdict !== "bad";
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (i - start >= minHours) out.push({ start: hours[start].time, end: hours[i - 1].time, hours: i - start });
      start = -1;
    }
  }
  return out;
}
