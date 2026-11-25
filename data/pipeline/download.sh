#!/usr/bin/env bash
# Download the CIB&RC "Major Uses of Pesticides" PDFs (as on 30.09.2026) from PPQS.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p data/raw
B="https://ppqs.gov.in/sites/default/files"
curl -fsSL -A "Mozilla/5.0" -o data/raw/mup_insecticide_2026.pdf "$B/MUP%20%28insecticide%29%20%2030.09.2026.pdf"
curl -fsSL -A "Mozilla/5.0" -o data/raw/mup_fungicide_2026.pdf  "$B/Fungicide%20MUP%20%20as%20on%2030.09.2026.pdf"
curl -fsSL -A "Mozilla/5.0" -o data/raw/mup_herbicide_2026.pdf  "$B/4.%20Herbicides%20MUP%20as%20on%2030.09.2026.pdf"
echo "Saved to data/raw/"
