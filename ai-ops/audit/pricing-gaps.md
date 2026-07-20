# Manufacturer Pricing — GitHub code vs Zstarr PDF (6.26 Surya--Vijay Order_Quote (4).pdf)

Compared: our backend `extendedPricingEngine` manufacturerCost (from `manufacturerPrices` in database.json) vs the Zstarr EXW line amount. Fabric code from the PDF **Material** column (Description column ignored per owner). Control from the PDF **Control system** column (metal bean chain=manual, Motor am25=motorized). Tolerance for MISMATCH: |Δ| > $0.50.

| # | Ord | Style | Fabric | Ctrl | W×H(in) | our m² | our $/m² | GitHub cost | PDF amount | Δ$ | Δ% | Verdict |
|---|-----|-------|--------|------|---------|--------|----------|-------------|-----------|----|----|--------|
| 1 | Vijay | zebra | 83070B | chain | 34.4×82.4 | 1.829 | $17.63 | $32.24 | $47.61 | -15.37 | -32% | MISMATCH |
| 2 | Vijay | zebra | 83070B | chain | 34.4×82.4 | 1.829 | $17.63 | $32.24 | $47.57 | -15.33 | -32% | MISMATCH |
| 3 | Vijay | zebra | 83070B | chain | 34.4×82.1 | 1.822 | $17.63 | $32.12 | $47.44 | -15.32 | -32% | MISMATCH |
| 4 | Vijay | zebra | 83070B | chain | 34.5×82.2 | 1.830 | $17.63 | $32.26 | $47.62 | -15.36 | -32% | MISMATCH |
| 5 | Vijay | zebra | 83070B | chain | 34.5×82.2 | 1.830 | $17.63 | $32.26 | $47.58 | -15.32 | -32% | MISMATCH |
| 6 | Vijay | roller | 82082b | chain | 28.5×70.3 | 1.293 | $14.38 | $18.59 | $30.12 | -11.53 | -38% | MISMATCH |
| 7 | Vijay | roller | 82082b | chain | 28.5×70.3 | 1.293 | $14.38 | $18.59 | $30.17 | -11.58 | -38% | MISMATCH |
| 8 | Vijay | roller | 82082b | chain | 28.8×70.2 | 1.304 | $14.38 | $18.76 | $30.33 | -11.57 | -38% | MISMATCH |
| 9 | Vijay | roller | 82082b | chain | 30.6×70.2 | 1.386 | $14.38 | $19.93 | $31.95 | -12.02 | -38% | MISMATCH |
| 10 | Vijay | zebra | 83070B | chain | 22.4×70.3 | 1.500 | $17.63 | $26.45 | $40.14 | -13.69 | -34% | MISMATCH |
| 11 | Vijay | zebra | 83070B | chain | 22.5×70.3 | 1.500 | $17.63 | $26.45 | $40.14 | -13.69 | -34% | MISMATCH |
| 12 | Vijay | roller | 82082b | chain | 34.4×81.8 | 1.815 | $14.38 | $26.11 | $40.37 | -14.26 | -35% | MISMATCH |
| 13 | Vijay | roller | 82082b | chain | 34.7×81.9 | 1.833 | $14.38 | $26.37 | $40.75 | -14.38 | -35% | MISMATCH |
| 14 | Vijay | roller | 82082b | chain | 34.4×81.8 | 1.815 | $14.38 | $26.11 | $40.41 | -14.30 | -35% | MISMATCH |
| 15 | Vijay | roller | 82082b | chain | 34.2×58 | 1.280 | $14.38 | $18.40 | $29.93 | -11.53 | -39% | MISMATCH |
| 16 | Vijay | roller | 82082b | chain | 34.4×58.2 | 1.292 | $14.38 | $18.57 | $30.15 | -11.58 | -38% | MISMATCH |
| 17 | Vijay | roller | 82082b | chain | 34.5×58.2 | 1.295 | $14.38 | $18.63 | $30.23 | -11.60 | -38% | MISMATCH |
| 18 | Vijay | roller | 82082b | chain | 46.8×22.6 | 1.200 | $14.38 | $17.26 | $24.59 | -7.33 | -30% | MISMATCH |
| 19 | Vijay | roller | 82082b | chain | 46.4×22.7 | 1.200 | $14.38 | $17.26 | $24.59 | -7.33 | -30% | MISMATCH |
| 20 | Vijay | roller | 82082b | chain | 22.4×70.2 | 1.200 | $14.38 | $17.26 | $24.74 | -7.48 | -30% | MISMATCH |
| 21 | Vijay | roller | 82082b | chain | 22.3×70.3 | 1.200 | $14.38 | $17.26 | $24.66 | -7.40 | -30% | MISMATCH |
| 22 | Vijay | roller | 82082b | chain | 34.4×70.5 | 1.565 | $14.38 | $22.50 | $35.46 | -12.96 | -37% | MISMATCH |
| 23 | Vijay | roller | 82082b | chain | 34.4×70.4 | 1.562 | $14.38 | $22.47 | $35.45 | -12.98 | -37% | MISMATCH |
| 24 | Eymi | zebra | 83032B | AM25 | 34.4×82 | 1.820 | $18.32 | $33.34 | $90.71 | -57.37 | -63% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 25 | Eymi | zebra | 83032B | AM25 | 34.6×82 | 1.830 | $18.32 | $33.53 | $90.95 | -57.42 | -63% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 26 | Eymi | zebra | 83032B | AM25 | 34.5×82 | 1.825 | $18.32 | $33.44 | $90.83 | -57.39 | -63% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 27 | Eymi | zebra | 83047B | AM25 | 22.5×58.3 | 1.500 | $20.04 | $30.06 | $86.06 | -56.00 | -65% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 28 | Eymi | zebra | 83047B | AM25 | 34.4×58.2 | 1.500 | $20.04 | $30.06 | $86.06 | -56.00 | -65% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 29 | Eymi | zebra | 83047B | AM25 | 22.4×58.3 | 1.500 | $20.04 | $30.06 | $86.06 | -56.00 | -65% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 30 | Eymi | zebra | 83047B | AM25 | 34.4×70.3 | 1.560 | $20.04 | $31.27 | $87.34 | -56.07 | -64% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |
| 31 | Eymi | zebra | 83032B | AM25 | 34.4×70 | 1.553 | $18.32 | $28.46 | $84.38 | -55.92 | -66% | MISMATCH* (PDF bundles AM25 motor; GitHub=fabric only) |

**Result: 31/31 records MISMATCH** (23 manual = direct comparison; 8 motorized flagged separately because the PDF line bundles the AM25 motor that our engine adds as a separate option cost).
