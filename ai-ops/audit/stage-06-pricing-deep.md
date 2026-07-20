# Stage 06 — Live Pricing (Pricing Agent) — DEEP Audit

> Recursive audit loop, **pricing deep-dive**. The owner doubted the earlier "pricing consistent" verdict (Pass 4/5) as too shallow. Scope: customer-journey **Stage 6** (+ Stage 14 pricing touchpoints) — billable area/MOQ, base rate + fabric $/m² + margin, option/motor/remote/solar surcharges, tax, shipping, discount/promo, and **price consistency across all three `calculate` endpoints**. Read-only; every defect reproduced against the running app on `http://localhost:3001` or against `backend/database.json` via node. No writes, no fixes applied. Fixes are recommendation-only and need owner approval.
>
> **Why the prior verdict was shallow (root):** Pass 5 declared "Stage 6/9 pricing consistent end-to-end" after testing `/api/v1/pricing/calculate`, `/api/cart`, and `/api/calculate-order-total` — **all three of which resolve through the same `extendedPricingEngine`**. It never tested `/api/calculate-price`, which runs a **different** engine, nor did it test tax across states, promo application, or MOQ-on-options. Those are exactly where the defects are.

## Severity key
P0 security/data-loss · P1 checkout/pricing/tax/discount failure · P2 major workflow/margin failure · P3 partial feature / consistency · P4 cosmetic.

## Surface audited
- **Engines:** `services/extended-pricing-engine.js` (`calculateCustomerPrice`, m²+margin — the authoritative one) and `services/pricing-engine.js` (`calculateProductPrice`, `base_price`×dimension-multiplier — legacy).
- **Endpoints:** `POST /api/calculate-price` (`server.js:1432` → **base** engine), `POST /api/v1/pricing/calculate` (`server.js:1464` → **extended** engine), `POST /api/calculate-order-total` (`server.js:1558` → **extended** engine per-line, but **inline** tax/shipping/discount), `POST /api/v1/promo/validate` (`server.js:14078`).
- **Import/config:** `services/excel-pricing-service.js`, `services/price-import-service.js`, `config/system-config.js` (50-state tax table, shipping zones), `database.json` (`manufacturerPrices`, `customerPriceRules`, `promotions`).
- **Note (per task):** the metal-bean-chain option ($1.50/m², `extended-pricing-engine.js:765-789`) is treated as current code, not a defect.

## What is already correct (verified, no change)
- **The extended engine is internally consistent.** `/api/v1/pricing/calculate`, `/api/cart`, `/api/calculate-order-total` return the **same** `lineTotal` for an identical config (re-confirmed: roller `82086K` 24×36 manual → all `$21.82`). Pass 4/5's finding holds *for those three*.
- **Dimension guards:** negative width → `400 "Invalid width: must be greater than 0"`; zero rejected; fractional inches (`"60 3/4"`) parsed; over-max silently clamped to 144×120 **with** structured `dimensionWarnings`.
- **Accessories are not multiplied by quantity** (`lineTotal = unitPrice*qty + accessoriesTotal`, `extended-pricing-engine.js:217`); per-unit options are.
- **Server-authoritative:** cart/order recompute server-side and ignore client-supplied price.
- **Unpriced fabric** falls back to a per-type default $/m² with an explicit `source:"fallback"` marker; case-insensitive fabric lookup.

---

## CONFIRMED defects

### PK-P01 — The three `calculate` endpoints do NOT agree: `/api/calculate-price` uses a different engine and returns a wildly different price 🔴
- **Route/code:** `POST /api/calculate-price` (`server.js:1432`) calls `pricingEngine.calculateProductPrice` (`services/pricing-engine.js:44`) — `base_price × dimensionMultiplier` with **no fabric $/m² and no margin**. The other two endpoints call `extendedPricingEngine.calculateCustomerPrice`.
- **Severity:** **P1** · **Category:** Pricing correctness / determinism (blueprint §4 "price identical everywhere it is shown").
- **Root cause:** two competing priced engines are wired to two public endpoints for the *same* task. The base engine ignores `fabricCode` (only adds `fabric.priceAdjustment`, which is 0 for these fabrics) and prices purely off `product.base_price` (40) × a dimension multiplier floored at 1.0. Its option pricing is a **separate hardcoded table** (motor `$45/$47/$55`, remote `$4.40/$6.60/$8.80`, solar `$15`, smartHub `$23.50` — `pricing-engine.js:162-199`) that also disagrees with the extended engine's DB-driven option costs.
- **Real example (reproduced live, identical input):**
  - `/api/v1/pricing/calculate` roller `82086K` 24×36 manual → **`unitPrice 21.82`** (mfrCost 15.59 + 40% margin).
  - `/api/calculate-price` same product/size → **`unitPrice 40.00`** (`base_price 40 × 1.0`, fabric & margin ignored).
  - **83% divergence for one 24×36 roller shade.** Whichever integration calls `/api/calculate-price` quotes a price the authoritative engine disagrees with.
- **Reachability caveat (fair):** the storefront (`pk-product.js`, `product.github-original.html`, `zebra-product.html`) calls only `/api/v1/pricing/calculate`. `/api/calculate-price` is a live, unauthenticated, POSTable endpoint but is **not currently consumed by the storefront** — which is precisely why the earlier pass missed it. It is a latent P1 the moment any client, admin tool, or integration hits it.
- **Proposed fix (recommendation-only, native-first):** retire `/api/calculate-price` or make it delegate to `extendedPricingEngine.calculateCustomerPrice` (single source of truth). Do not maintain two priced engines.

### PK-P02 — `/api/calculate-order-total` hardcodes CA 7.25% tax, ignoring destination state and the 50-state tax table 🔴
- **Route/code:** `server.js:1604-1606` — `const taxRate = 0.0725; const taxAmount = subtotal * taxRate;` labelled `"California Sales Tax"`. The endpoint receives `shippingAddress` but never reads its state.
- **Severity:** **P1** · **Category:** Tax calculation (per-state rate lookup).
- **Root cause:** the authoritative per-state path exists — `config/system-config.js` ships a full 50-state table (`getTax().rules`), and `extended-pricing-engine.js:972` (`calculateTax`) and `services/tax-service.js:157` both do a `region` lookup — but the order-total endpoint **bypasses all of them** with a single hardcoded constant. It even disagrees with the config's own CA rate.
- **Real example (reproduced live):**
  - `POST /api/calculate-order-total {items:[…], shippingAddress:{state:"OR"}}` → `tax:{rate:0.0725, amount:1.58, description:"California Sales Tax"}`. **Oregon has 0% state sales tax**, yet the customer is taxed 7.25%.
  - The config table says **CA = 0.0898 (8.98%)**, not 7.25% — so even California buyers are taxed at the wrong rate. Every state is either over- or under-charged.
- **Proposed fix:** compute tax via `systemConfig.getTax()` region lookup keyed on `shippingAddress.state` (the same table `tax-service`/extended engine already use), and round once at whole-cent precision.

### PK-P03 — `/api/calculate-order-total` silently ignores `promoCode`; discount is always $0 🔴
- **Route/code:** `server.js:1560` destructures `promoCode` from the body but **never uses it**; the response hardcodes `discount: { code: null, amount: 0, description: null }` (`server.js:1619`).
- **Severity:** **P1** · **Category:** Discount / promo application.
- **Root cause:** the "ONLY source of truth for order pricing" (its own comment, `server.js:1556`) has no discount logic at all. Promo validation lives in a *separate*, unwired endpoint (`/api/v1/promo/validate`), and the base engine's `applyDiscounts` (`pricing-engine.js:411`) is dead code (no route calls `pricingEngine.calculateOrderTotal`).
- **Real example (reproduced live):** `POST /api/calculate-order-total {items:[zebra 140×115 ×5], promoCode:"FLAT50"}` → `subtotal 1030.29`, `discount {code:null, amount:0}`, `grandTotal 1104.99`. `FLAT50` ("$50 off orders over $500", `minOrderAmount:500`, active) qualifies but is **not applied** — the customer is charged full price.
- **Proposed fix:** apply the validated promo (percentage/fixed, with min-order + clamp `discount ≤ subtotal`) inside the order-total calc, or funnel discounting through Shopify Discounts natively; never accept `promoCode` and drop it.

### PK-P04 — `/api/v1/promo/validate` rejects every real promo code (schema drift: reads `p.active` / `promo.value` that don't exist) 🟠
- **Route/code:** `server.js:14090` `promoCodes.find(p => p.code === code?.toUpperCase() && p.active)` and `server.js:14105-14108` reads `promo.value`.
- **Severity:** **P2** · **Category:** Discount / promo (feature non-functional).
- **Root cause:** field-name drift between the seeded `db.promotions` and the endpoint. The 5 seeded promos use `isActive` + `discountPercent`/`discountAmount`; the 6th (`SAVE20`) uses `status:"active"` + `value`. **None** has a boolean `active` field, so the `&& p.active` filter fails for all of them; and `promo.value` is `undefined` for the `discountPercent`-style promos even if matched.
- **Real example (reproduced via node against real `database.json`):** simulating the exact endpoint logic — `SAVE10`, `FLAT50`, `WELCOME15`, and even `SAVE20` all resolve to **"Invalid promo code"** (`p.active` undefined for every record). (Endpoint is `apiKeyAuth`-gated, so reproduced against the DB rather than over HTTP.)
- **Proposed fix:** normalize the promotion schema (one of `isActive`/`status`, one of `discountPercent`/`value`) and read it consistently; add a validation test asserting each seeded code validates. Prefer Shopify-native discounts long-term.

### PK-P05 — Minimum billable area (MOQ) is applied to the fabric but NOT consistently to per-m² options 🟠
- **Fn:** `extended-pricing-engine.js` — `getManufacturerCost` floors fabric area with per-type `MIN_AREA` (`roller 1.2`, `zebra 1.5`, `roman 1.5`, `:328-336`), but `calculateOptionCosts` **hardcodes `const minArea = 1.2`** for all product types (`:615-619`), and prices per-m² options (metal-bead chain, sqm valance, sqm bottom rail, solar) off that separate area.
- **Severity:** **P3** · **Category:** MOQ / billable-area consistency.
- **Root cause:** two independent area computations with different minimums. For a zebra/roman shade whose raw area is below 1.5 m², the fabric is billed at 1.5 m² while per-m² options are billed at 1.2 m² (or the raw area if between 1.2 and 1.5) — the option MOQ silently under-applies.
- **Real example (reproduced live):** zebra `83003L` 30×50 manual + `chainType:"metal-bead"` → response shows `dimensions.squareMeters 1.5, minAreaApplied true` (fabric floored to 1.5) but `options.breakdown[0]` (Metal Bead Chain) `price 1.80` = `$1.50 × 1.2 m²`, **not** `$1.50 × 1.5 = $2.25`. Chain under-charged by $0.45 on this unit; the two engines disagree on the shade's own billable area.
- **Proposed fix:** compute billable area once (per-type MOQ) and pass it into `calculateOptionCosts`; drop the hardcoded `1.2`.

### PK-P06 — Per-fabric `manualMargin` (import-defaulted to 40%) silently overrides every configured `customerPriceRule`, so per-type/product margins are dead 🟠
- **Fn:** `extended-pricing-engine.js:466-480` — `applyMarginRules` treats per-fabric `fabricMargin` as **Priority 1**, returning before `customerPriceRules` are ever consulted. `getManufacturerCost` sets `fabricMargin = priceRecord.manualMargin` (`:365`). `excel-pricing-service.js:458` defaults `manualMargin: record.manualMargin || 40` on **every** imported fabric.
- **Severity:** **P2** · **Category:** Margin application (systematic margin leakage).
- **Root cause:** because import stamps `40` on every fabric, the fabric-level margin almost always exists, so the admin-configured `customerPriceRules` (per-type and product-specific) never fire. The margin table in the admin portal is effectively inert.
- **Real example (reproduced live):**
  - Zebra `83003L` manual → `margin.percentage 40`, though `cpr-default-zebra` is **45%** (`marginValue:45`, active). Zebra sells 5 points under the configured margin.
  - Roller `82086K` manual → `margin 40%`, though the product-specific rule `cpr-prod-81ccd028` ("Affordable Custom Roller Blinds Margin", **50%**, priority 10) is active and should win. It is dead.
  - By extension: honeycomb default rule is 50%, roman 45% — both overridden to whatever the fabric's `manualMargin` is (40 by import default).
- **Proposed fix:** decide the intended precedence explicitly. If product/type rules are meant to be the floor, consult `customerPriceRules` and take `max(fabricMargin, ruleMargin)` or invert the priority; and stop import-defaulting `manualMargin` to a hardcoded 40 (leave null so the rule engine governs).

---

## Latent risks (not reproduced with current data — flagged for the owner, no fix)
- **`maxCustomerPrice` ceiling can drive customer price below manufacturer cost (negative margin).** `extended-pricing-engine.js:582-585`: when `customerPrice > maxCustomerPrice`, it sets `customerPrice = maxCustomerPrice` and `marginAmount = customerPrice - manufacturerCost` (can go negative) with **no floor at cost**. No current `customerPriceRule` sets `maxCustomerPrice`, so not reproducible today — but a future rule with a low cap would sell below cost. Recommend clamping `customerPrice ≥ manufacturerCost`.
- **Fixed-discount has no clamp → negative line/total.** `pricing-engine.js:451-459` returns `promo.discountValue` unclamped and `:278` computes `subtotal - discount + …`. Path is currently **dead** (no route calls it), but if revived a `$50` fixed promo on a `$30` order goes negative. Clamp `discount ≤ subtotal` when wiring discounts.
- **No-margin fabric sells at zero profit.** `applyMarginRules:527-544` returns `customerPrice = manufacturerCost` (0 profit) with a console-only `CRITICAL` warning when no margin is found. Surfaced as `zeroProfit:true` in the response but not blocked.
- **Cordless-missing pricing warning is computed but not returned to the caller.** `getManufacturerCost:376` builds `cordlessPricingWarning` and returns it as `manufacturerCost.warning`, but `calculateCustomerPrice` only surfaces `marginResult.warning` (`:302`) — so a cordless config silently falls back to the manual $/m² with no customer-visible flag.

## Shipping consistency note (P3)
`/api/calculate-order-total` hardcodes **free ≥ $99 / else $9.99 flat** (`server.js:1609`), but `config/system-config.js` sets `freeShippingThreshold:499` with weight-tiered zone rates (`9.99/14.99/24.99/39.99`) that the extended engine's `calculateShipping` honors. Order-total's flat rule disagrees with config and with the zone engine — same divergence class as PK-P02 (endpoint bypasses the config it claims to source from).

## Cross-references
- **Unrounded fractional-cent tax stored at checkout** is already filed as **BUG-G003** (`stage-14-invoicing.md`) and fixed there; PK-P02 is the upstream *rate* defect (hardcoded/ignores state) feeding it.
- PK-P01/P02/P03 are the concrete evidence the Pass-5 "consistent end-to-end" verdict was scoped only to the three extended-engine paths.

---

## Summary
**6 confirmed pricing defects** (3× P1, 3× P2/P3) + 4 latent risks: the three `calculate` endpoints do **not** agree (`/api/calculate-price` off by ~83%), order-total **hardcodes CA 7.25% tax ignoring destination state** and **drops all promo codes**, the promo-validate endpoint **rejects every real code** (schema drift), MOQ is **under-applied to per-m² options**, and per-fabric `manualMargin` (import-defaulted 40%) **silently nullifies every configured margin rule** — the owner's doubt about "pricing consistent" was well founded.

**Counts by severity:** P0: 0 · **P1: 3** (PK-P01, PK-P02, PK-P03) · **P2: 2** (PK-P04, PK-P06) · **P3: 1** (PK-P05) · latent/robustness: 4.
