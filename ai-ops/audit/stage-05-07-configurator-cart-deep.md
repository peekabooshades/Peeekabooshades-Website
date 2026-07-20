# Stage 5 (Configure) + Stage 7 (Cart / Quote / Draft Order) — DEEP Audit (Section H)

> Deep second pass over the configurator business rules + cart/quote surface. Extends (does **not** repeat) `stage-04-05-measure-configure.md` (which covered dimension parsing, min/max clamp, first SKU wiring, motor display gate). **READ-ONLY.** Reproduced against the running app on `http://localhost:3001` (product `affordable-custom-roller-blinds`, real `manufacturerPrices`/`motorBrands`/`productContent` data in `backend/database.json`). Only `GET` + pure read-only `POST /api/v1/pricing/calculate` were issued (the configurator's own price path). No cart/quote/order writes; `db.cart` verified at **0 lines** after the run, `savedQuotes` 0, `draftOrders` 3 (baseline) — DB untouched. Fixes are **recommendation-only**, native-first, no front-end redesign.

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow/pricing-parity failure · P3 partial feature / integrity gap · P4 cosmetic.

## Surface audited
- **SKU generation (5.4):** `ExtendedPricingEngine.generateSku({productType, fabricCode, options})` (`backend/services/extended-pricing-engine.js:1080`), surfaced on every price result (`:258`) and persisted on the cart line (`backend/server.js:780`).
- **Option pricing + compatibility (5.2/5.3/6.3):** `calculateOptionCosts(options, db, w, h)` (`extended-pricing-engine.js:602`) — motor/remote/solar gated inside the `controlType === 'motorized'` block (`:664-743`); chain (`:768`), valance/cassette (`:791`), bottom rail (`:810`), accessories (`:829`).
- **Configurator price path:** `POST /api/v1/pricing/calculate` (`server.js:1464`); front-end payload builder `assets/theme/pk-product.js:2116-2158` (page) and client-side breakdown `:2330-2376`.
- **Add to cart (7.1):** `POST /api/cart` (`server.js:686`) — builds `pricingOptions` (`:722-745`), re-prices server-side, persists `configuration` verbatim + `price_snapshot`. Front-end payload `pk-product.js:2634-2675`.
- **Cart read / re-price:** `GET /api/cart/:sessionId` (`server.js:666`), `PUT /api/cart/:id` (`server.js:834`), checkout re-price `POST /api/calculate-order-total` (`server.js:1558`; caller `cart.html:508-520`).
- **Quote / draft-order (7.2/7.3):** public `POST /api/quotes` (`server.js:1316`); public `POST /api/quotes/save` → `savedQuotesService.saveQuote` (`services/saved-quotes-service.js:48`); `POST /api/quotes/:id/convert` (`server.js:16467`); admin `POST /api/admin/draft-orders` (`:10252`) + `/complete` (`:10326`).
- **Session / cart persistence:** `getSessionId()` (`frontend/public/js/app.js:10`) — localStorage-only key; cart rows keyed by `session_id`.

## What is already correct (verified, no change)
- **Cart price is server-authoritative on add.** `POST /api/cart` recomputes through `extendedPricingEngine.calculateCustomerPrice` and ignores the client-supplied `unitPrice` (front-end sends `unitPrice` at `pk-product.js:2672`; server never reads it). No client-price trust on add.
- **Configuration survives into the cart line.** `POST /api/cart` persists the entire `configuration` blob verbatim (`server.js:778`) — every selected option (fabric, mount, chain, motor, solar, accessories, roomLabel, dimensions) is stored and returned by `GET /api/cart/:sessionId`. No field-level data loss into the cart row itself (the defects below are about **pricing** of those fields and the **SKU**, not loss of the selections).
- **Checkout re-prices from scratch.** `POST /api/calculate-order-total` re-runs the engine per line with the current `quantity` (`server.js:1577-1586`), so the order total does not inherit a stale cart `line_total`.
- **Customer quote-convert re-prices.** `POST /api/quotes/:id/convert` returns items to be re-added to the cart (`server.js:16478`), which re-prices — the checkout total is protected even if the saved quote's displayed price was wrong (see BUG-H008).
- **Quote ownership is scoped** (`requireCustomerAuth` + `customerOwnsQuote`, `server.js:16409-16503`) and update strips identity/status fields (`:16434`) — a prior hardening (BUG-AC001), not re-litigated.
- **Motor default resolves** — motorized with no `motorBrand` still resolves a priced motor (`aok`, `$66.15`) rather than erroring the price call (this is also the root of BUG-H005).

---

## CONFIRMED defects

### BUG-H001 — SKU collides across genuinely different configurations (Stage 5.4)  🟠
- **Fn:** `generateSku` (`extended-pricing-engine.js:1080-1099`). SKU = `<TYPE>-[OPACITY]-<FABRIC>-<CONTROL>`.
- **Severity:** **P2** · **Category:** SKU determinism / uniqueness (blueprint 5.4 "Generate a **stable, unique** SKU… guarantee uniqueness **per valid variant**").
- **Root cause:** the SKU encodes only product type, optional opacity, fabric code, and control class. It **omits every other price- and build-affecting dimension**: width/height, mount type, motor brand + motor type, remote, solar, valance/cassette, bottom rail, chain type/side, roller type, accessories (smart hub / USB), and quantity. Two configurations that a manufacturer must build differently — and that price differently — collapse to the **same** SKU, so the SKU cannot serve as the per-variant identifier for a work order or inventory line.
- **Real example (reproduced, `POST /api/v1/pricing/calculate`):**
  - `82032A`, 24×36, `{controlType:motorized, mountType:outside, smartHubQty:2}` → **`RS-82032A-MOT`**, lineTotal **$165.40**.
  - `82032A`, 72×84, `{controlType:motorized}` → **`RS-82032A-MOT`** (identical SKU), lineTotal **$174.91**.
  - Same SKU, different size, different mount, different accessories, different price.
- **Proposed fix (recommendation-only):** extend `generateSku` to fold the build-defining fields into a deterministic, sorted suffix (e.g. dimensions bucket + short codes for mount/motor/valance/rail/accessory-qty), or append a short stable hash of the normalized config. Keep the human-readable prefix; guarantee "same normalized config → same SKU, different config → different SKU." Native-first: pure backend function change, no schema/UI impact.

### BUG-H002 — SKU is non-deterministic for the same physical shade (optional `lightFiltering` flips the opacity segment) (Stage 5.4)  🟡
- **Fn:** `generateSku` (`extended-pricing-engine.js:1094`) — opacity segment derived from the **client-supplied** `options.lightFiltering`, which is emitted only on some paths.
- **Severity:** **P3** · **Category:** SKU determinism.
- **Root cause:** opacity is intrinsic to the fabric, but the SKU reads it from a mutable request field. Whether the caller sends `lightFiltering` changes the SKU for the identical shade. (Latent in the current UI: the page calculate payload `pk-product.js:2116-2144` and the cart `pricingOptions` `server.js:722-745` **both omit** `lightFiltering`, so both currently yield the no-opacity SKU — they happen to agree. The determinism guarantee is nonetheless violated for any caller that does send it, e.g. a future integration or the admin tools.)
- **Real example (reproduced):** `82032A`, motorized — `{}` → **`RS-82032A-MOT`**; `{lightFiltering:"blackout"}` → **`RS-BO-82032A-MOT`**; `{lightFiltering:"light-filtering"}` → **`RS-LF-82032A-MOT`**. Three SKUs, one shade.
- **Proposed fix:** derive opacity from the fabric record (`manufacturerPrices`/`productContent` fabric metadata) keyed by `fabricCode`, not from a request field — so opacity is a function of the fabric and always present/consistent.

### BUG-H003 — Incompatible option combinations are silently accepted, neither priced nor rejected (Stage 5.2)  🟠
- **Fn:** `calculateOptionCosts` (`extended-pricing-engine.js:664-743`); no `validateConfiguration`/compatibility guard exists anywhere (`grep` for `incompatible|validateOptions|mutually exclusive|validateConfiguration` across `server.js` + `services/*` = **0 hits**).
- **Severity:** **P2** · **Category:** Option-dependency / compatibility enforcement (Configurator Agent responsibility: "Enforce option dependencies and incompatibilities"; journey 5.2).
- **Root cause:** motor, remote, and solar pricing live **inside** the `controlType === 'motorized'` branch. When a manual/cordless control is combined with `remoteType`/`solarType`/`motorBrand`, those fields are **silently dropped** from pricing while still being persisted into the cart's `configuration` blob. There is no server-side rule table that rejects a physically impossible combination or the reverse (motorized shade with a manual chain). The result: a work order can carry `controlType:manual` **plus** a solar panel + 15-channel remote, and the customer is charged for none of them.
- **Real example (reproduced):**
  - `{controlType:manual, remoteType:"remote-15ch", solarType:"yes", motorBrand:"aok"}`, 24×36 `82032A` → **200**, options breakdown **`[]`**, lineTotal **$33.45** (priced as a plain manual shade; remote/solar accepted and ignored).
  - vs `{controlType:motorized, …same…}` → breakdown `[motorization $66.15, solar $49.41]`, lineTotal **$149.01**.
  - `{controlType:cordless, motorBrand:"aok", motorType:"battery"}` → **200**, breakdown `[]` (contradictory `motorBrand` silently swallowed).
- **Proposed fix:** add a declarative compatibility/dependency rule set (JSON/metafield per the native-first ladder) enforced in the price/cart path — reject (or normalize with an explicit warning) combos like non-motorized + remote/solar/motor, and motorized + manual-chain. Return `400` with a specific message on hard-incompatible combos so the API matches the front-end's intent, not just the happy path.

### BUG-H004 — Chain-type surcharge differs across configurator, cart, and checkout (three prices for one option) (Stage 5.3/6.3/7.1)  🟠
- **Files:** page display `frontend/public/assets/theme/pk-product.js:2341-2342` + option markup `frontend/public/product.html:925`; cart re-price `server.js:722-745`; engine chain rule `extended-pricing-engine.js:768-789`; checkout re-price caller `frontend/public/cart.html:508-520`.
- **Severity:** **P2** · **Category:** Pricing parity (blueprint §4 "price identical across… configurator, cart") + revenue leak.
- **Root cause:** the metal/steel chain surcharge is computed **three different ways** and no path agrees:
  1. **Configurator page** adds a flat **+$5** client-side (`chainTypePrice = data-price` where steel chain is `data-price="5"` in `product.html:925`; `additionalOptionsTotal += chainTypePrice` at `pk-product.js:2342`). The page's own `calculate` request **does not** send `chainType` (`pk-product.js:2116-2144`), so the engine never sees it — the $5 is a pure client add-on.
  2. **Cart** (`POST /api/cart`) builds `pricingOptions` that **omit `chainType`** entirely (`server.js:722-745`), so the stored `line_total` includes **$0** for the chain — $5 lower than the page showed.
  3. **Checkout** (`POST /api/calculate-order-total`) is called by `cart.html` with the full `configuration` mapped to `options` (`cart.html:517`), so the engine's own metal-chain rule fires at **$1.50/m²** (≈ **$2.32** at 40×60) — different from both the $5 and the $0.
- **Real example (reproduced):** engine on `{controlType:manual, chainType:"metal-bead-chain"}`, 40×60 `82032A` → breakdown `[chain_type $2.32]`; the same steel-chain selection shows **+$5** on the product page and stores **+$0** in the cart line. A customer sees $5, the cart persists $0, checkout charges $2.32; the shade is built with a steel chain regardless. [NEEDS-WRITE-TEST: confirm the persisted cart `line_total` on a live `POST /api/cart` with `chainType:"bead-chain-metal"` — POST /api/cart is outside the read-only allowance.]
- **Proposed fix:** pick one authority (the engine's `chainType` rule), pass `chainType` through the page `calculate` payload **and** the cart `pricingOptions`, and delete the client-side `data-price` add-on so the configurator renders only the engine number. Same treatment resolves BUG-H004's sibling latent risk in BUG-H006.

### BUG-H005 — Required options are enforced only on the client; the API accepts and silently defaults them (Stage 5.2)  🟡
- **Files:** front-end guard `pk-product.js:2608-2621` (blocks add-to-cart without `motorBrand`/`motorType`); engine default `extended-pricing-engine.js:665-666` (`motorBrand || 'aok'`, `motorType || 'battery'`).
- **Severity:** **P3** · **Category:** Required-option enforcement.
- **Root cause:** `POST /api/v1/pricing/calculate` and `POST /api/cart` perform no required-field validation for a motorized configuration. A motorized request with no motor selection is priced against a silent `aok`/`battery` default rather than rejected, so a direct API caller (or a front-end regression) can produce a priced, add-to-cartable motorized line with no explicit motor choice.
- **Real example (reproduced):** `{controlType:motorized}` (no `motorBrand`/`motorType`), 24×36 `82032A` → **200**, motorization line `brand:aok $66.15` — defaulted, not rejected.
- **Proposed fix:** mirror the front-end requirement server-side — when `controlType` is motorized and `motorBrand`/`motorType` are absent, return `400` (or a structured "selection required" result) instead of defaulting.

### BUG-H006 — Cart drops `mountType`/`chainSide` from re-pricing while the page can charge them (latent parity gap) (Stage 6.3/7.1)  🟡
- **Files:** cart `pricingOptions` `server.js:722-745` (no `mountType`, no `chainType`, no `chainSide`); page adds `mountType` client-side `pk-product.js:2330-2337`; page sends `mountType` to `calculate` `pk-product.js:2122`.
- **Severity:** **P3** (currently latent — all `mountType` options are `data-price="0"` in `product.html:829,835`, so no live dollar divergence today) · **Category:** Configurator↔cart pricing parity.
- **Root cause:** the cart's option map is a hand-maintained subset that has drifted from what the page prices. `mountType` is priced on the page path (and by the engine, `extended-pricing-engine.js:749-763`) but never forwarded by the cart, so the moment a mount option is given a non-zero price, the cart under-charges relative to the configurator — the same class of bug as BUG-H004, waiting on a data change.
- **Real example:** page `calculate` with `{mountType:outside}` returns a `mount_type` breakdown slot (currently $0); the cart path cannot ever produce one because `mountType` is absent from `pricingOptions`. No live dollar delta yet — filed to prevent a silent regression when mount pricing is configured.
- **Proposed fix:** stop hand-listing option keys in the cart route — pass the parsed `configuration` object straight into the engine (as `calculate-order-total` already does) so cart, page, and checkout share one input contract.

### BUG-H007 — `PUT /api/cart/:id` changes quantity without re-pricing; `GET` subtotal then uses a stale `line_total` (Stage 7)  🟡
- **Fn:** `PUT /api/cart/:id` (`server.js:834-843`) sets `item.quantity = quantity` only; `GET /api/cart/:sessionId` computes `subtotal` from `item.line_total || unit_price*quantity` (`server.js:672`).
- **Severity:** **P3** · **Category:** Cart re-price / stored-total integrity.
- **Root cause:** the quantity mutation never recomputes `line_total`/`unit_price`, so the stored `line_total` keeps the original quantity's value. Because `line_total` stays truthy, the `GET` subtotal uses the stale figure rather than `unit_price*quantity`. The cart **page** masks this (it re-prices via `calculate-order-total`, `cart.html:508`), but any consumer of the stored `line_total` — the `GET /api/cart` subtotal, mini-cart/count, admin cart views — sees the pre-change total.
- **Real example:** `cart.html` quantity stepper (`setItemQuantity`, `cart.html:699-720`) → `PUT /api/cart/:id {quantity:3}`; server stores `quantity:3` but leaves `line_total` at the quantity-1 value; `GET /api/cart/:sessionId` then returns a subtotal for a 1-unit line. [NEEDS-WRITE-TEST: live `PUT` to observe the persisted row — PUT is outside the read-only allowance; confirmed by code path.]
- **Proposed fix:** on `PUT`, re-run `calculateCustomerPrice` for the item's stored config + new quantity and rewrite `unit_price`/`line_total`/`price_snapshot` (mirror the `POST /api/cart` logic), so the stored line is always self-consistent.

### BUG-H008 — Saved quote (and admin draft→order) trust client/entered totals with no engine re-price (Stage 7.2/7.3)  🟡
- **Files:** public `POST /api/quotes/save` → `savedQuotesService.saveQuote` (`services/saved-quotes-service.js:48-95`; `calculateSubtotal` just sums `item.price*qty`, `:259-265`); admin `POST /api/admin/draft-orders` (`server.js:10268-10272`, copies `req.body.subtotal/tax/total`) and `/complete` (`server.js:10361-10375`, copies `draftOrder.subtotal/tax/total` into the real order verbatim).
- **Severity:** **P3** · **Category:** Quote / draft-order price integrity.
- **Root cause:** `POST /api/quotes/save` is **public/unauthenticated** and stores `items`/`subtotal` exactly as sent — the shareable quote page then displays a price the pricing engine never validated (a caller can craft any total). The admin draft-order path likewise copies operator-entered `subtotal`/`total` straight into the created order with no re-price, and computes ledger margin from whatever `price_snapshot` the items happen to carry (`server.js:10343-10363`) — items added without a snapshot yield `manufacturerCost 0` → margin overstated. The customer-facing `convert` path is safe (it re-adds to cart, which re-prices), so the exposure is *displayed/recorded* price, not the final charged total.
- **Real example:** `savedQuotesService.saveQuote({items:[{price:1, quantity:1}], subtotal:1})` persists `subtotal:1` and serves it at `GET /api/quotes/share/:code` unchanged; no call to `extendedPricingEngine` occurs on the save path. [NEEDS-WRITE-TEST: live `POST /api/quotes/save` to capture the stored/served price — write endpoint, outside read-only allowance; confirmed by code path.]
- **Proposed fix:** re-price quote/draft line items server-side through the engine before persisting (recompute `subtotal` from engine output, ignore client totals), matching the `POST /api/cart` discipline; keep the client number only as a display hint to compare against.

### BUG-H009 — Cart is bound to a localStorage session only; no account association, no guest→login merge, no accessory-qty bound (Stage 7.4)  🟡
- **Files:** `getSessionId()` (`frontend/public/js/app.js:10-17`) — random id in `localStorage`, never linked to a customer; no cart-merge/association code exists (`grep` for `mergeCart|migrateCart|cart.*customerId` = **0 hits**). Accessory quantities are unbounded in `calculateOptionCosts` (`extended-pricing-engine.js:857-886`) while top-level blind `quantity` is clamped (`:1104-1116`).
- **Severity:** **P3** · **Category:** Cart persistence (journey 7.4 "cart preserves selections across sessions") + input bounds.
- **Root cause (two parts):** (1) the cart row is keyed purely by the browser's `localStorage` `sessionId`; logging in does not associate or merge the cart to the `customerId`, so the cart is lost across devices, browsers, or a `localStorage` clear — "preserve across sessions" holds only within one browser. (2) `smartHubQty`/`usbChargerQty` have **no upper bound**; negatives are silently dropped (guarded by `> 0`) but arbitrarily large values are accepted and priced.
- **Real example:** `{controlType:motorized, smartHubQty:99999}`, 24×36 `82032A` → accessories total **$3,289,967.10**, lineTotal **$3,290,066.70** (no cap); `smartHubQty:-5` → accessories **$0** (negative ignored). Cross-device: a guest cart under `sessionId` `sess_ab12…` on one browser is invisible after login on another (no server-side customer link).
- **Proposed fix:** on login, associate/merge the guest `session_id` cart to the authenticated customer (native Shopify handles this once migrated; interim: server-side merge on customer login). Clamp accessory quantities to a sane max (mirror `validateQuantity`).

---

## Summary
Deep configurator + cart/quote pass surfaced **9 confirmed defects**: SKU collisions across distinct builds (H001) and non-deterministic SKUs (H002); silently-accepted incompatible option combos with no server-side rule table (H003); a three-way chain-price split across configurator/cart/checkout with a revenue leak (H004); client-only required-option enforcement (H005); a latent cart↔page mount/chain parity drift (H006); quantity changes that don't re-price the stored cart line (H007); quote/draft totals trusted without an engine re-price (H008); and localStorage-only cart persistence with unbounded accessory quantities (H009).

**Counts by severity:** P0: 0 · P1: 0 · P2: 3 (H001, H003, H004) · P3: 6 (H002, H005, H006, H007, H008, H009) · P4: 0. All read-only; no fixes applied; `database.json` untouched.
