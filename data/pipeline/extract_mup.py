"""
Extract the government's "Major Uses of Pesticides" (CIB&RC, PPQS) tables into
structured JSON that the Dealer Copilot rules engine can query.

Source PDFs (public, published by the Directorate of Plant Protection,
Quarantine & Storage, Govt. of India):
  https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides

Usage (run from the repo root, PDFs passed as arguments):
  python3 -I data/pipeline/extract_mup.py \
      --insecticide data/raw/mup_insecticide_2026.pdf \
      --fungicide   data/raw/mup_fungicide_2026.pdf \
      --as-on 2026-09-30 \
      --out data/generated/approved_uses.json

The PDF tables are irregular (merged cells, rows that continue across pages,
multi-line cells). The parser is deliberately conservative: a row that cannot
be read with confidence is skipped and counted, never guessed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field

import pdfplumber

# --------------------------------------------------------------------------
# Crops we support in the prototype and the spellings used in the PDFs.
# --------------------------------------------------------------------------
CROPS = {
    "cotton": re.compile(r"^\s*cotton\b", re.I),
    "paddy": re.compile(r"^\s*(rice|paddy)\b", re.I),
    "tomato": re.compile(r"^\s*tomato\b", re.I),
    "chilli": re.compile(r"^\s*chill?i(es)?\b|^\s*chili\b", re.I),
}

# Canonical pest / disease ids per crop. A raw cell such as
# "Jassid, aphids, thrips, whiteflies" maps to several ids.
PESTS: dict[str, list[tuple[str, re.Pattern[str]]]] = {
    "cotton": [
        ("whitefly", re.compile(r"white\s*-?\s*fl", re.I)),
        ("jassid", re.compile(r"jassid|leaf\s*-?\s*hopper|amrasca", re.I)),
        ("aphid", re.compile(r"aphid", re.I)),
        ("thrips", re.compile(r"thrip", re.I)),
        ("pink_bollworm", re.compile(r"pink|pectinophora", re.I)),
        ("american_bollworm", re.compile(r"american|helicoverpa|heliothis", re.I)),
        ("spotted_bollworm", re.compile(r"spotted|earias", re.I)),
        ("spodoptera", re.compile(r"spodoptera|tobacco\s+caterpillar", re.I)),
        ("mites", re.compile(r"mite", re.I)),
        ("mealybug", re.compile(r"mealy", re.I)),
        ("leaf_spot", re.compile(r"alternaria|leaf\s*spot", re.I)),
        ("grey_mildew", re.compile(r"gr[ae]y\s*mildew", re.I)),
    ],
    "paddy": [
        ("stem_borer", re.compile(r"stem\s*-?\s*borer|scirpophaga", re.I)),
        ("leaf_folder", re.compile(r"leaf\s*-?\s*folder|cnaphalocrocis", re.I)),
        ("bph", re.compile(r"brown\s+plant\s*-?\s*hopper|nilaparvata|\bbph\b", re.I)),
        ("gall_midge", re.compile(r"gall\s*midge", re.I)),
        ("green_leafhopper", re.compile(r"green\s+leaf\s*-?\s*hopper|\bglh\b", re.I)),
        ("blast", re.compile(r"blast", re.I)),
        ("sheath_blight", re.compile(r"sheath\s*blight", re.I)),
        ("brown_spot", re.compile(r"brown\s*(leaf\s*)?spot", re.I)),
        ("false_smut", re.compile(r"false\s*smut", re.I)),
    ],
    "tomato": [
        ("fruit_borer", re.compile(r"fruit\s*-?\s*borer|helicoverpa", re.I)),
        ("whitefly", re.compile(r"white\s*-?\s*fl", re.I)),
        ("leaf_miner", re.compile(r"leaf\s*-?\s*miner", re.I)),
        ("tuta", re.compile(r"tuta|pin\s*-?\s*worm", re.I)),
        ("thrips", re.compile(r"thrip", re.I)),
        ("mites", re.compile(r"mite", re.I)),
        ("early_blight", re.compile(r"early\s*blight", re.I)),
        ("late_blight", re.compile(r"late\s*blight", re.I)),
        ("powdery_mildew", re.compile(r"powdery", re.I)),
    ],
    "chilli": [
        ("thrips", re.compile(r"thrip", re.I)),
        ("mites", re.compile(r"mite", re.I)),
        ("fruit_borer", re.compile(r"fruit\s*-?\s*borer|helicoverpa", re.I)),
        ("aphid", re.compile(r"aphid", re.I)),
        ("whitefly", re.compile(r"white\s*-?\s*fl", re.I)),
        ("anthracnose", re.compile(r"anthracnose|fruit\s*-?\s*rot|die\s*-?\s*back", re.I)),
        ("powdery_mildew", re.compile(r"powdery", re.I)),
    ],
}

# A bare "bollworm(s)" claim on cotton covers the bollworm complex.
GENERIC_BOLLWORM = re.compile(r"boll\s*-?\s*worm", re.I)

SECTION_WORDS = re.compile(
    r"^(agricultural use|combination product|crop|insecticides|fungicides|"
    r"\d+\.\s|approved uses|public health|household|common name)",
    re.I,
)

FORM_TYPES = (
    "WDG WG WP SP SG DF EC SC SL OD ZC CS EW SE ME DC GR CG FS DS DP WS "
    "GEL FLOWABLE CONCENTRATE DUST GRANULES"
).split()
FORM_TYPE_RE = re.compile(r"\b(" + "|".join(FORM_TYPES) + r")\b\s*$", re.I)

LIQUID_TYPES = {"EC", "SC", "SL", "OD", "ZC", "CS", "EW", "SE", "ME", "DC", "FS", "FLOWABLE", "CONCENTRATE"}

# Spelling variants and typos found in the source PDF -> one canonical name.
ALIASES = {
    "chlorpyriphos": "chlorpyrifos",
    "difenconazole": "difenoconazole",
    "flubendamide": "flubendiamide",
    "kresoxim methyl": "kresoxim-methyl",
    "lambda cyhalothrin": "lambda-cyhalothrin",
    "thiophanatemethyl": "thiophanate-methyl",
    "thiophanate methyl": "thiophanate-methyl",
    "metalaxyl m": "metalaxyl-m",
    "fenobucarb (bpmc)": "fenobucarb",
    "(streptomycin sulphate": "streptomycin sulphate",
    "pyrifluinazon": "pyrifluquinazon",
    "spiropidon": "spiropidion",
    "copper sulphate pentahydrate": "copper sulphate",
    "tribasic copper sulfate": "copper sulphate",
    "cartap hydrofipronil ide": "cartap hydrochloride",  # typo in source PDF
    "alphacypermethrin": "alpha-cypermethrin",
    "ethofenoprox": "etofenprox",
    "kitazin": "iprobenfos",
    "validamycin3%l": "validamycin",
}

SPECIAL_METHOD = [
    ("seed_treatment", re.compile(r"seed\s*(dress|treat)|per\s*kg\s*(of\s*)?seed|/kg\s*seed", re.I)),
    ("soil_drench", re.compile(r"drench", re.I)),
    ("nursery", re.compile(r"nursery|seedling", re.I)),
]


def detect_method(form_type: str | None, *texts: str | None) -> str:
    joined = " ".join(t for t in texts if t)
    for method, rx in SPECIAL_METHOD:
        if rx.search(joined):
            return method
    if form_type in {"GR", "CG", "DP", "GRANULES", "DUST"}:
        return "granules"
    return "spray"


def clean(cell: str | None) -> str | None:
    if cell is None:
        return None
    return re.sub(r"\s+", " ", cell.replace("\n", " ")).strip()


@dataclass
class Active:
    name: str
    concentration: float | None
    unit: str


def parse_formulation(label: str) -> tuple[list[Active], str | None]:
    """'Acetamiprid 25% + Bifenthrin 25 % WG' -> actives + form type."""
    text = label.replace("w/w", "").replace("w/v", "").replace("W/W", "").replace("W/V", "")
    m = FORM_TYPE_RE.search(text)
    form_type = m.group(1).upper() if m else None
    if m:
        text = text[: m.start()]
    actives: list[Active] = []
    for part in re.split(r"\+", text):
        part = part.strip()
        if not part:
            continue
        mm = re.match(r"^(.*?)[\s(]*([\d]+(?:\.\d+)?)\s*(%|g\s*/\s*l|gm\s*/\s*l|g/kg)?", part, re.I)
        if mm and mm.group(1).strip():
            name = mm.group(1).strip(" .,-")
            conc = float(mm.group(2))
            unit = (mm.group(3) or "%").replace(" ", "").lower()
        else:
            name, conc, unit = part.strip(" .,-"), None, ""
        name = re.sub(r"\s+", " ", name).lower()
        name = ALIASES.get(name, name)
        actives.append(Active(name=name, concentration=conc, unit=unit))
    return actives, form_type


NUM = r"(\d+(?:\.\d+)?)"
RANGE_RE = re.compile(rf"^{NUM}\s*(?:[-–—to]+\s*{NUM})?\s*(gm|g|ml|kg|l|lit\.?|litre|liter)?\.?$", re.I)


def parse_per_ha(raw: str | None) -> dict | None:
    """'50 – 100' -> {min: 50, max: 100}. Percent / per-litre doses -> None."""
    if not raw:
        return None
    s = raw.replace(",", "").strip()
    s = re.sub(r"\s*(/|per)\s*(ha|hectare)\b\.?", "", s, flags=re.I).strip()
    if "%" in s or "/" in s:
        return None
    m = RANGE_RE.match(s)
    if not m:
        return None
    lo = float(m.group(1))
    hi = float(m.group(2)) if m.group(2) else lo
    unit = (m.group(3) or "").lower()
    factor = 1000.0 if unit in {"kg", "l", "lit", "lit.", "litre", "liter"} else 1.0
    return {"min": lo * factor, "max": hi * factor}


def parse_phi(raw: str | None) -> int | None:
    if not raw:
        return None
    m = re.match(r"^\s*(\d{1,3})\b", raw)
    return int(m.group(1)) if m else None


@dataclass
class Stats:
    rows_seen: int = 0
    rows_kept: int = 0
    skipped: Counter = field(default_factory=Counter)


def extract(path: str, kind: str, as_on: str, stats: Stats) -> list[dict]:
    out: list[dict] = []
    formulation: str | None = None
    last_crop: str | None = None
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            for table in page.extract_tables():
                for row in table:
                    cells = [clean(c) for c in row]
                    if not any(cells):
                        continue
                    first = cells[0]
                    rest = [c for c in cells[1:] if c]
                    # Formulation header: a single filled cell.
                    if first and not rest:
                        if SECTION_WORDS.match(first):
                            continue
                        if re.search(r"\d", first) and not CROPS_ANY.match(first):
                            formulation = first
                            last_crop = None
                        continue
                    if not formulation:
                        continue
                    if first and SECTION_WORDS.match(first):
                        continue
                    stats.rows_seen += 1
                    crop_raw = first or last_crop
                    if first:
                        last_crop = first
                    values = [c for c in cells[1:] if c is not None]
                    if len(values) > 5:
                        values = [c for c in values if c != ""]
                    if len(values) != 5:
                        stats.skipped["unexpected_columns"] += 1
                        continue
                    pest_raw, ai_raw, form_raw, water_raw, phi_raw = values
                    crop_id = next((cid for cid, rx in CROPS.items() if crop_raw and rx.match(crop_raw)), None)
                    if not crop_id:
                        stats.skipped["other_crop"] += 1
                        continue
                    pest_ids = [pid for pid, rx in PESTS[crop_id] if rx.search(pest_raw or "")]
                    generic = False
                    if crop_id == "cotton" and GENERIC_BOLLWORM.search(pest_raw or "") and not any(
                        p in pest_ids for p in ("pink_bollworm", "american_bollworm", "spotted_bollworm")
                    ):
                        pest_ids += ["pink_bollworm", "american_bollworm", "spotted_bollworm"]
                        generic = True
                    if not pest_ids:
                        stats.skipped["unmapped_pest"] += 1
                        continue
                    actives, form_type = parse_formulation(formulation)
                    dose = parse_per_ha(form_raw)
                    out.append(
                        {
                            "kind": kind,
                            "formulation": formulation,
                            "formType": form_type,
                            "liquid": (form_type in LIQUID_TYPES) if form_type else None,
                            "method": detect_method(form_type, form_raw, water_raw, pest_raw, formulation),
                            "actives": [a.__dict__ for a in actives],
                            "crop": crop_id,
                            "cropRaw": crop_raw,
                            "pests": sorted(set(pest_ids)),
                            "pestRaw": pest_raw,
                            "genericBollwormClaim": generic,
                            "doseAiRaw": ai_raw,
                            "doseFormulationRaw": form_raw,
                            "doseFormulationPerHa": dose,
                            "waterRaw": water_raw,
                            "waterPerHa": parse_per_ha(water_raw),
                            "phiDays": parse_phi(phi_raw),
                            "phiRaw": phi_raw,
                            "source": {"doc": path.split("/")[-1], "asOn": as_on, "page": page_no},
                        }
                    )
                    stats.rows_kept += 1
    return out


CROPS_ANY = re.compile("|".join(rx.pattern for rx in CROPS.values()), re.I)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--insecticide", required=True)
    ap.add_argument("--fungicide", required=True)
    ap.add_argument("--as-on", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    stats = Stats()
    rows = extract(args.insecticide, "insecticide", args.as_on, stats)
    rows += extract(args.fungicide, "fungicide", args.as_on, stats)
    for i, r in enumerate(rows, start=1):
        r["id"] = f"au_{i:04d}"

    payload = {
        "source": "CIB&RC Major Uses of Pesticides (PPQS, Govt. of India)",
        "sourceUrl": "https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides",
        "asOn": args.as_on,
        "disclaimer": "Compiled by CIB&RC for guidance, not for legal purposes. Always follow the product label.",
        "stats": {"rowsSeen": stats.rows_seen, "rowsKept": stats.rows_kept, "skipped": dict(stats.skipped)},
        "rows": rows,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(json.dumps(payload["stats"], indent=1))
    print("formulations:", len({r["formulation"] for r in rows}))
    print("by crop:", Counter(r["crop"] for r in rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
