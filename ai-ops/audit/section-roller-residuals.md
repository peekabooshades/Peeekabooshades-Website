# Section K — Roller-Shades Pricing Residuals (BUG-B002 / BUG-B003) — Audit

> Section **K** of the recursive audit loop (controlled-parallel mode). Scope: re-verify the two open roller-shades pricing residuals from Audit Pass 2/4 — **BUG-B002** (default fabric `82143A` unpriced → first price is an estimate) and **BUG-B003** (pricing slug fragility → misroute/silent failure). Reproduced **read-only** against the running app on `http://localhost:3001`; the only POST used was `POST /api/v1/pricing/calculate`, a pure price computation that does not write `database.json`. No source, data, server state, or `product.html` was touched. Native-first, recommendation-only.

## Severity key
P0 security/payment/data-loss/outage · P1 checkout/pricing/order/invoice failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **Authoritative engine:** `POST /api/v1/pricing/calculate` (`backend/server.js:1464`) → `extendedPricingEngine.calculateCustomerPrice` → `resolveManufacturerCost` (`backend/services/extended-pricing-engine.js:317-448`). Cost source is the `db.manufacturerPrices` table, keyed by `fabricCode` + `productType` (`extended-pricing-engine.js:343-347`); a fabric found there returns `source:'manufacturer_price'`, a fabric not found returns `source:'fallback'` at `$14/m²` (`DEFAULT_PRICE_PER_SQ_METER.roller`, `:429`).
- **Product page pricing JS:** `frontend/public/assets/theme/pk-product.js` — live calculator `window.calculatePriceFromAPI` (`:3771`) driven by embedded table `window.PK_ROLLER_PRICING` (`:3769`, 158 codes); estimate label at `:3830`; API path + `fallbackPriceCalculation` (`:2430`, `pricePerSqMeter=20`); default-fabric fallback `|| '82143A'` (`:2636`); slug derivation `window.location.pathname.split('/').pop()` (`:2089`, `:2148`).
- **Product route:** `app.get('/product/:slug', ...)` (`backend/server.js:6143`).

## What is already correct (verified, no change)
- **Default roller fabric `82143A` is now priced end-to-end.** The authoritative engine returns a real manufacturer price for it, and the frontend embedded table also contains it — so the first price on load is authoritative, not an estimate (see BUG-B002 → RESOLVED below).
- **Happy-path engine determinism holds:** `82143A` and `82032A` both resolve `source:'manufacturer_price'`, 40% margin, unitPrice **$33.45** for 24×36 — consistent with Pass 4/5 findings.
- **Perimeter unchanged:** the calculate endpoint is a pure read (no DB write), and unknown fabrics degrade to a labeled fallback rather than erroring.

---

## RESOLVED since filing

### BUG-B002 — Default fabric `82143A` unpriced → first price is an estimate → **RESOLVED**
- **Original claim (Pass 2/4):** the default-selected roller fabric `82143A` had no authoritative price, so the customer's very first price was the non-authoritative estimate ("* Estimated — this fabric code is not yet in the price list").
- **Current state (re-reproduced, verified fixed):** `82143A` is now present in **both** pricing sources.
  - **Server engine — real example:** `POST /api/v1/pricing/calculate {"productSlug":"affordable-custom-roller-blinds","fabricCode":"82143A","width":24,"height":36,"options":{}}` →
    `"manufacturerCost":{"unitCost":23.89,"source":"manufacturer_price",...},"margin":{...40...},"unitPrice":33.45`.
    `source` is **`manufacturer_price`**, not `fallback` — the engine no longer estimates the default fabric.
  - **Frontend — real example:** `window.PK_ROLLER_PRICING["82143A"] = [19.91,23.15,40,40]` (`pk-product.js:3769`). In `calculatePriceFromAPI` (`:3785-3788`), a table hit sets `priced=true`, so the estimate branch (`:3830`, `if(!priced) …`) does **not** fire on first load. No "not yet in the price list" label is rendered for the default fabric.
- **Verdict:** the specific BUG-B002 mechanism is gone. Closing it as resolved per loop discipline (item fixed by adding `82143*`/`82032*` prices to `manufacturerPrices` + `PK_ROLLER_PRICING`).

### RESIDUAL-K1 — Fabric price-coverage gap (B002-adjacent, still open, P3)
- **Not** BUG-B002 (default is fine), but the estimate/fallback machinery it exposed is still live and still fires for many **non-default** roller fabrics.
- **Justification (root cause):** `PK_ROLLER_PRICING` carries 158 codes but the roller fabric catalog (`GET /api/product-page-data`) exposes ~82 active `82xxx` codes, **49 of which are absent from the table** (e.g. `82142A-E`, `82168A-E`, `82176A-G`, `82178A-E`, `82180A-E`). Selecting any of these drives the frontend to `priced=false` → `$14/m²`, **100% margin** (`pk-product.js:3787-3789`), and the "* Estimated" label (`:3830`). The server engine independently returns `source:'fallback'` (`$14/m²`) for the same codes — a *different* number from the frontend's 100%-margin estimate, echoing the BUG-B001 dual-path smell.
- **Real example (reproduced):**
  - `POST …/calculate {fabricCode:"82142A", 24×36}` → `source:"fallback"`, `unitCost:16.8`, `unitPrice:40`.
  - Same fabric in the page calculator → estimate branch, `$14/m² × 1.2 m² × (1+100%) = $33.60`, with the "not yet in the price list" label.
  - Two different estimated numbers ($40 engine vs $33.60 page) for one unpriced 24×36 shade.
- **Proposed fix (native-first, recommendation-only, needs approval):** import manufacturer prices for the remaining active `82xxx` codes into `manufacturerPrices` and regenerate `PK_ROLLER_PRICING` from that single source (the `price-calculate` / `fabric-swatch-import` path), so no active swatch falls to fallback; for any genuinely unpriced code show "price on request" instead of an invented estimate. (Tracks the still-open BUG-B001 residual — do not fold into a B002 close.)

---

## CONFIRMED defects

### BUG-B003 — Pricing slug fragility: `pathname.split('/').pop()` + exact-match lookup → silent price failure (still present) 🟠
- **Route/code:** `POST /api/v1/pricing/calculate` (`backend/server.js:1464`); lookup `db.products.find(p => p.slug === productSlug)` (`server.js:1470`) with **no normalization**; frontend derives `const productSlug = window.location.pathname.split('/').pop()` (`pk-product.js:2089`, `:2148`) with **no trailing-slash/segment guard**.
- **Severity:** **P2** · **Category:** Robustness / silent failure (pricing).
- **Justification (root cause):** the slug is taken verbatim from the URL tail and matched by strict `===` against the stored slug. Any URL tail that is not exactly the stored slug — most reachably an **empty segment from a trailing slash** — yields `{"success":false,"error":"Product not found"}`, and the page's price silently fails to update. Unchanged from the VER-A001/BUG-B003 filing; both the fragile frontend derivation and the un-normalized server lookup are still in place.
- **Real example — frontend-reproducible (trailing slash):**
  - `GET /product/affordable-custom-roller-blinds/` → **HTTP 200** (the `/product/:slug` route serves the page with the trailing slash).
  - But in the browser `window.location.pathname` = `"/product/affordable-custom-roller-blinds/"`, so `.split('/').pop()` = **`""`** (empty). The page then POSTs `productSlug:""`.
  - Reproduced equivalently: `POST …/calculate {"productSlug":"","fabricCode":"82032A",24×36}` → **`{"success":false,"error":"Product not found"}`**. A customer who lands on the trailing-slash variant sees the page render but the live price never resolves.
- **Real example — direct-API / server-side (query or hash tail):**
  - `POST …/calculate {"productSlug":"affordable-custom-roller-blinds?utm_source=fb", ...}` → **"Product not found."**
  - `POST …/calculate {"productSlug":"affordable-custom-roller-blinds?x=1", ...}` → **"Product not found."**
- **Honest refinement of the original filing (loop discipline):** the original BUG-B003 example cited a `?x=1` URL breaking the page. In the *browser*, `window.location.pathname` already excludes the query string, so a `?utm=`/`?x=1` tail does **not** by itself corrupt the frontend-derived slug — the query-tail failure is real only for **direct API callers / server-side slug construction**. The **trailing-slash** case is the genuinely browser-reproducible failure and is the stronger evidence. Net: BUG-B003 is **still a confirmed defect**, with the reproduction sharpened.
- **Proposed fix (native-first, recommendation-only, needs approval):**
  1. **Server (primary):** normalize before lookup — strip query/hash and trailing slash, e.g. match on `productSlug.split(/[?#]/)[0].replace(/\/+$/,'')`; optionally fall back to matching the last non-empty path segment. Low-risk, backward-compatible.
  2. **Frontend:** derive the slug from a server-rendered data attribute on the product container (authoritative) rather than `pathname.pop()`; if the URL tail must be used, filter empties: `pathname.split('/').filter(Boolean).pop()`.
  3. Add a regression assertion: trailing-slash and `?utm=` variants of a live product URL must still price.

---

## Summary
BUG-B002 is **RESOLVED** (default fabric `82143A` now priced by both the server engine, `source:manufacturer_price`, and the frontend table) — one B002-adjacent residual remains (RESIDUAL-K1, P3: 49 active roller fabrics still fall to divergent estimate/fallback pricing). **BUG-B003 is still a CONFIRMED P2 defect** — the trailing-slash URL serves HTTP 200 but `pathname.split('/').pop()` yields `""`, and the un-normalized `slug === productSlug` lookup returns "Product not found," silently breaking the live price; query/hash tails break direct API callers. Recommendation-only; no code changed.
