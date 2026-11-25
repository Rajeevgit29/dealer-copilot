import "server-only";
import { assessHours, districtById, sprayWindows, type HourlyWeather } from "@/engine";

const cache = new Map<string, { at: number; data: HourlyWeather }>();
const TTL = 30 * 60_000;

async function fetchHourly(lat: number, lon: number): Promise<HourlyWeather> {
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m` +
    `&forecast_days=2&timezone=Asia%2FKolkata`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = (await res.json()) as {
    hourly: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[]; precipitation: number[]; precipitation_probability: (number | null)[]; wind_speed_10m: number[] };
  };
  const data: HourlyWeather = {
    time: j.hourly.time,
    temperature: j.hourly.temperature_2m,
    humidity: j.hourly.relative_humidity_2m,
    precipitation: j.hourly.precipitation,
    precipProbability: j.hourly.precipitation_probability.map((p) => p ?? 0),
    wind: j.hourly.wind_speed_10m,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

function nowLocalHour() {
  const ist = new Date(Date.now() + 5.5 * 3_600_000);
  return `${ist.toISOString().slice(0, 13)}:00`;
}

export async function sprayWindowFor(districtId: string) {
  const d = districtById(districtId);
  if (!d) return { available: false as const, reason: "Unknown district" };
  try {
    const hourly = await fetchHourly(d.lat, d.lon);
    const all = assessHours(hourly);
    const nowKey = nowLocalHour();
    const idx = Math.max(0, all.findIndex((h) => h.time >= nowKey));
    const upcoming = all.slice(idx);
    const now = upcoming[0];
    return {
      available: true as const,
      district: d.name,
      now,
      windows: sprayWindows(upcoming).slice(0, 3),
      hours: upcoming.slice(0, 36),
      source: "Open-Meteo forecast",
    };
  } catch (e) {
    return { available: false as const, reason: e instanceof Error ? e.message : "Weather unavailable" };
  }
}
