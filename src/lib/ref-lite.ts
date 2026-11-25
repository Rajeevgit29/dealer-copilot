/** Client-safe reference data (small JSON only; never import the engine in client components). */
import cropsJson from "../../data/reference/crops.json";
import pestsJson from "../../data/reference/pests.json";
import districtsJson from "../../data/reference/districts.json";
import moaJson from "../../data/reference/moa.json";

export type CropId = "cotton" | "paddy" | "tomato" | "chilli";

export const CROPS = cropsJson.crops as { id: CropId; en: string; hi: string; firstHarvestDays: number; multiPick: boolean; flowering: [number, number] | null }[];
export const cropById = (id: string) => CROPS.find((c) => c.id === id);

export const PESTS = pestsJson.pests as { id: string; crop: CropId; kind: "insect" | "mite" | "disease"; en: string; hi: string; sci: string; signs: string; trap?: { etlMothsPerTrapPerDay: number; consecutiveDays: number; source: string; sourceUrl: string } }[];
export const pestFor = (crop: string, id: string) => PESTS.find((p) => p.crop === crop && p.id === id);
export const pestsForCrop = (crop: string) => PESTS.filter((p) => p.crop === crop);

export const DISTRICTS = districtsJson.districts as { id: string; name: string; state: string; lat: number; lon: number; crops: CropId[] }[];
export const districtById = (id: string) => DISTRICTS.find((d) => d.id === id);

const GROUPS = moaJson.groups as Record<string, { name: string }>;
export const groupName = (code: string) => GROUPS[code]?.name ?? code;
export const groupShort = (code: string) => (code.includes(":") ? code.split(":")[1] : code);
