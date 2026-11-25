import type { LabelExtraction } from "./vision";

/**
 * Demo "photos" for running without an AI key. Each sample is what the label
 * reader would return for that bottle; it then goes through exactly the same
 * normalisation and checks as a real photo.
 */
export interface SampleBottle {
  id: string;
  title: string;
  subtitle: string;
  tone: "green" | "blue" | "amber" | "rose" | "slate";
  extraction: LabelExtraction;
}

const label = (item: LabelExtraction["items"][number]): LabelExtraction => ({ documentType: "label", legibility: "good", items: [item] });

export const SAMPLE_BOTTLES: SampleBottle[] = [
  {
    id: "actara",
    title: "Actara",
    subtitle: "Syngenta · Thiamethoxam 25% WG",
    tone: "green",
    extraction: label({ brand: "Actara", manufacturer: "Syngenta India Pvt Ltd", activeIngredients: [{ name: "Thiamethoxam", concentration: 25, unit: "%" }], formulationType: "WG", registrationNumber: "CIR-XXXX(demo)", batchNumber: "B2607", manufactureDate: "2026-03", expiryDate: "2028-02", purchaseDate: null }),
  },
  {
    id: "confidor",
    title: "Confidor",
    subtitle: "Bayer · Imidacloprid 17.8% SL",
    tone: "blue",
    extraction: label({ brand: "Confidor", manufacturer: "Bayer CropScience Ltd", activeIngredients: [{ name: "Imidacloprid", concentration: 17.8, unit: "%" }], formulationType: "SL", registrationNumber: "CIR-XXXX(demo)", batchNumber: "C1189", manufactureDate: "2026-01", expiryDate: "2027-12", purchaseDate: null }),
  },
  {
    id: "acetamiprid",
    title: "Local brand",
    subtitle: "Acetamiprid 20% SP",
    tone: "amber",
    extraction: label({ brand: "Kisan Shakti", manufacturer: "Regional formulator", activeIngredients: [{ name: "Acetamiprid", concentration: 20, unit: "%" }], formulationType: "SP", registrationNumber: "CIR-XXXX(demo)", batchNumber: "KS-0412", manufactureDate: "2026-05", expiryDate: "2028-04", purchaseDate: null }),
  },
  {
    id: "coragen",
    title: "Coragen",
    subtitle: "FMC · Chlorantraniliprole 18.5% SC",
    tone: "slate",
    extraction: label({ brand: "Coragen", manufacturer: "FMC India Pvt Ltd", activeIngredients: [{ name: "Chlorantraniliprole", concentration: 18.5, unit: "%" }], formulationType: "SC", registrationNumber: "CIR-XXXX(demo)", batchNumber: "F7731", manufactureDate: "2026-02", expiryDate: "2028-01", purchaseDate: null }),
  },
  {
    id: "expired",
    title: "Old stock",
    subtitle: "Profenofos 50% EC · expired",
    tone: "slate",
    extraction: label({ brand: "Curacron", manufacturer: "Syngenta India Pvt Ltd", activeIngredients: [{ name: "Profenofos", concentration: 50, unit: "%" }], formulationType: "EC", registrationNumber: "CIR-XXXX(demo)", batchNumber: "P0921", manufactureDate: "2023-09", expiryDate: "2025-08", purchaseDate: null }),
  },
  {
    id: "suspect",
    title: "Suspect bottle",
    subtitle: "'Thiamethoxam 30% EC' · no CIR no.",
    tone: "rose",
    extraction: label({ brand: "Super Actara Gold", manufacturer: null, activeIngredients: [{ name: "Thiamethoxum", concentration: 30, unit: "%" }], formulationType: "EC", registrationNumber: null, batchNumber: null, manufactureDate: null, expiryDate: null, purchaseDate: null }),
  },
  {
    id: "bill",
    title: "Shop bill",
    subtitle: "3 items from last month",
    tone: "slate",
    extraction: {
      documentType: "bill",
      legibility: "partial",
      items: [
        { brand: "Pegasus", manufacturer: "Syngenta", activeIngredients: [{ name: "Diafenthiuron", concentration: 50, unit: "%" }], formulationType: "WP", registrationNumber: null, batchNumber: null, manufactureDate: null, expiryDate: null, purchaseDate: "2026-10-04" },
        { brand: null, manufacturer: null, activeIngredients: [{ name: "Lambda cyhalothrin", concentration: 5, unit: "%" }], formulationType: "EC", registrationNumber: null, batchNumber: null, manufactureDate: null, expiryDate: null, purchaseDate: "2026-10-04" },
        { brand: "Ulala", manufacturer: "UPL", activeIngredients: [{ name: "Flonicamid", concentration: 50, unit: "%" }], formulationType: "WG", registrationNumber: null, batchNumber: null, manufactureDate: null, expiryDate: null, purchaseDate: "2026-10-18" },
      ],
    },
  },
];

export const sampleById = (id: string) => SAMPLE_BOTTLES.find((s) => s.id === id);
