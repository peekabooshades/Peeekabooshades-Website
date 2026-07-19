# Stage 4 (Measure) + Stage 5 (Configure) — Audit + Fixes (Section C)

> Read-only audit → native-first backend fixes, reproduced against `http://localhost:3001` with sample data (product `affordable-custom-roller-blinds`, real option/pricing data in `database.json`). Skills: `measurement-validate`, `sku-generate`. No front-end redesign. (Doc authored by orchestrator after the section-agent applied+verified the fixes but was cut off before writing; every item below re-verified live.)

## CONFIRMED defects (reproduced) — all FIXED + verified

### BUG-M001 — Dimensions didn't parse fractional inches; garbage silently truncated (Stage 4.2/4.3) · P2
- **Root cause:** `ExtendedPricingEngine.validateDimension` used `parseFloat(value)`. `parseFloat("24 1/2")` → `24` (fraction dropped); `parseFloat("24abc")` → `24` (garbage silently accepted). Custom shades are ordered to fractional sizes, so dropped fractions = wrong-size product.
- **Real-time example (before):** `width:"24 1/2"` priced as 24"; `width:"24abc"` priced as 24" (200 OK).
- **Fix (verified):** added `parseDimensionValue()` — accepts `"60"`, `"60.5"`, `"60 3/4"`, `"60-3/4"`, `"3/4"`; returns NaN for garbage. `validateDimension` now uses it.
  - `width:"24 1/2"` → parses to 24.5, prices normally (lineTotal $99.60). `width:"24abc"` → **400 `Invalid width: must be a number`** (no longer silently truncated).

### BUG-M002 — Min/max auto-correction was silent (Stage 4.3) · P3
- **Root cause:** `validateDimension` clamped out-of-range values to min/max and returned them with no signal, so a customer entering an impossible size got a *different* size priced with no warning.
- **Real-time example (before):** `width:200` (max 144") → priced at 144" silently.
- **Fix (verified):** optional `warnings` accumulator; result now carries `dimensionWarnings[]` + `dimensionAdjusted`. `width:200` → `dimensionAdjusted:true`, warning `Entered width 200" exceeds the maximum 144"; adjusted to 144".` (Backward-compatible — arg defaults to null.)

### BUG-M003 — No SKU generated from the configuration (Stage 5.4) · P2
- **Root cause:** the pricing/cart result had no variant SKU; `sku-generate` skill unimplemented, so cart/order lines had no stable identifier for the exact fabric+control build.
- **Real-time example (before):** cart item had no `sku` field.
- **Fix (verified):** `generateSku({productType, fabricCode, options})` → e.g. **`RS-82032A-MOT`**; surfaced on the pricing result and persisted on the cart line (`server.js` cart build).

### BUG-M004 — Motor/remote/solar options lacked conditional-display metadata (Stage 5.3) · P3
- **Root cause:** `defaultProductOptions` for `motorType`/`remoteType`/`solarType` had no display gate, so motor-only options are presented regardless of control type (spec 5.3: "motor options only if motorized").
- **Fix (verified):** added `showWhen: { controlType: "motorized" }` to those three option groups (`server.js`), giving the client a declarative gate. No front-end redesign — data only.

## Verification summary (live, after fixes)
- Canonical pricing unchanged: roller `82032A` motorized 24×36 → **$99.60** (no regression from engine edits).
- `"24 1/2"` → priced normally; `"24abc"` → 400; `width:200` → adjusted-to-144 warning; SKU `RS-82032A-MOT` present.
- Diff is additive: `extended-pricing-engine.js` +93/−5, `server.js` +8/−0. `product.html` untouched (2051 lines). `database.json` not committed (data).

## Pending (needs owner approval / out of safe scope)
- Frontend consumption of `showWhen` and `dimensionWarnings` (surfacing the adjustment message to the shopper) is a client change beyond a safe data fix — follow-up.
- Deduction-rule ownership (4.4: who owns inside-mount deduction) is documented in the journey but not enforced server-side; confirm intended rule before adding.

## Pricing gaps
None new in this section (canonical fabrics priced). See `pricing-gaps.md` for the running list.
