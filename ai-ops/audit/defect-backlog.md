# Program A — Defect Backlog (Audit Pass 1)

> Recursive audit of the local GitHub app (`http://localhost:3001`) + Shopify baseline. **Read-only. No changes made.** Every item follows: reproduce → justify → real-time example. Fixes happen only after owner approval.
>
> **Discipline note:** two items were initially suspected and then **ruled out by reproduction** (see "Verified — NOT defects"). This is the loop working correctly — nothing is called a bug without evidence.

## Severity key
P0 security/payment/data-loss/outage · P1 checkout/pricing/order/invoice failure · P2 major portal/workflow failure · P3 partial feature / usability · P4 cosmetic.

---

## CONFIRMED defects

### BUG-A001 — Triple duplicate product editors
- **Page/route:** `/admin/product-edit.html` (27 KB), `/admin/product-editor.html` (37 KB), `/admin/product-editor-v2.html` (289 KB)
- **Severity:** P3 (architecture / maintainability) · **Category:** Architecture defect
- **Justification:** Three parallel editors for the *same* task violates the doc's "do not maintain two competing systems for the same source of truth." Changes to product logic must be made 3× or they drift; admins can reach the wrong/older one.
- **Real-time example:** open all three — `product-editor-v2.html` (289 KB) is a full rebuild while `product-edit.html` (27 KB) is a stub. An admin who lands on the stub edits a product with far fewer fields than v2 exposes → inconsistent product data.
- **Earliest failed phase:** Design/architecture. **Native fix:** N/A (repo). **Proposed fix (needs approval):** pick v2 as canonical, redirect the other two, delete after verification.

### BUG-A002 — "Coming soon" placeholder admin pages
- **Pages:** `/admin/create-order`, `/admin/tracking`, `/admin/product-tags`, `/admin/product-content`, `/admin/reports/products`
- **Severity:** P2–P3 (incomplete workflow) · **Category:** Placeholder / not connected
- **Justification:** The doc's status rule: "Do not assume a page works because its route exists." These routes return 200 but render "coming soon" — the feature is unavailable.
- **Real-time example:** Admin → **Create Order** loads `/admin/create-order.html` which shows "coming soon" — a staff member **cannot create a manual/phone order in the admin**, a core operations gap.
- **Native fix:** `create-order` and `tracking` are natively covered by Shopify Admin (draft orders, order tracking) — prefer redirecting admins to Shopify rather than building custom. **Needs approval.**

### BUG-A003 — Dead navigation links (`href="#"`)
- **Pages:** 30 admin pages contain `href="#"` anchors
- **Severity:** P3 (usability / navigation) · **Category:** Frontend defect
- **Justification:** `href="#"` scrolls to top / does nothing — dead-end navigation, and hurts perceived reliability of the admin.
- **Real-time example:** on pages using these anchors, clicking a nav/action item does nothing (page jumps to top). Needs per-page confirmation of intent (some may be JS-handled).
- **Fix:** audit each, wire to real route or convert to `<button>`. **Needs approval per page.**

---

## FLAGGED — requires verification (not yet a confirmed bug)

### VER-A001 — Pricing slug fragility
- **Route:** `POST /api/v1/pricing/calculate`
- **Observation:** backend finds the product via `db.products.find(p => p.slug === productSlug)`; the frontend derives `productSlug = window.location.pathname.split('/').pop()`.
- **Why flagged (not confirmed):** works when the URL's last segment exactly equals the DB slug (verified the frontend *does* send `productSlug`). **But** a trailing slash, query string, or a URL segment that doesn't match the stored slug → `404 "Product not found"` and a silent price failure.
- **Real-time example to reproduce:** load a product whose URL tail ≠ DB slug (or add `?x=1`) → `.pop()` yields the wrong value → pricing returns "Product not found." **Action:** reproduce on each live product URL before classifying.

---

## VERIFIED — NOT defects (false positives ruled out)
- **"API 404s" (`/api/customers`, `/api/orders`, `/api/quotes`, …):** those exact paths don't exist by design. Real endpoints are `/api/admin/orders`, `/api/admin/customers` (correctly **401** auth-gated), `/api/orders/lookup`, `/api/v1/pricing/calculate`. **Good security posture — not a bug.**
- **Pricing API "Product not found":** reproduced only because *my* test omitted `productSlug`; the product page sends it. **Works as designed.**

---

## Next audit passes (still read-only)
1. **Authenticated admin-API pass** (generate a local dev JWT with the dev `JWT_SECRET`) to test admin CRUD, pricing parity, order state transitions, and RBAC (verify manufacturers can't see customer financials, installers see only assigned jobs).
2. **Pricing parity** across product page → admin → invoice for identical configs. — *started in Pass 2 (BUG-B001)*
3. **Product-config data-loss** test (does every selection survive cart → order → work order?).
4. **Portal RBAC** (dealer/manufacturer/technician cross-access).
5. **Live storefront** already audited separately: 25 broken links fixed; option-price total bug fixed.

---

# Program A — Defect Backlog (Audit Pass 2)

> **Iteration 1 of the recursive journey loop — Roller Shades product page.** Scope: customer-journey Stages 2 (Fabric), 5 (Configure), 6 (Live Pricing) as they manifest on `/product/affordable-custom-roller-blinds`. Read-only; reproduced against the running app on `http://localhost:3001`. Fixes need owner approval.

## CONFIRMED defects

### BUG-B001 — Pricing parity: product-page "estimate" diverges from the authoritative pricing engine (Stage 6)
- **Page/route:** `/product/affordable-custom-roller-blinds`; frontend `assets/theme/pk-product.js`; backend `POST /api/v1/pricing/calculate`
- **Severity:** **P1** (pricing failure) · **Category:** Pricing correctness / determinism
- **Justification:** Stage 6 mandates a *single* deterministic, versioned, auditable price shown everywhere. The page instead computes its own **estimate** when a fabric isn't in the price list — `$14/m²` fabric + **100% margin** — and there is a second hardcoded `pricePerSqMeter = 20` in `pk-product.js` (line ~2442). These do **not** match the server pricing engine, which uses manufacturer cost + **40% margin**. Customers can be quoted a price the business's own pricing engine disagrees with.
- **Real-time example:** page loads showing **Base Price $33.60** with breakdown "Fabric 1.2 m² × \$14/m² = \$16.80, Margin (100%) = \$16.80, Unit \$33.60" and "* Estimated — this fabric code is not yet in the price list." The authoritative API for the same product/size returns **\$33.45** (fabric `82032A`) and **\$26.48** (fabric `82067A`), both at 40% margin. Three different numbers for one 24×36 roller shade.
- **Earliest failed phase:** Design (two pricing paths). **Native/safe fix (needs approval):** make the page render *only* the server `calculate` result; delete the frontend estimate + hardcoded `$14`/`$20` per-m² fallbacks; if a fabric has no price, show "price on request," not an invented number.

### BUG-B002 — Default fabric (`82143A`) is not in the price list → first price shown is always an estimate (Stage 2→6)
- **Page/route:** `/product/affordable-custom-roller-blinds`; `pk-product.js` default `fabricCode ... || '82143A'`
- **Severity:** **P2** · **Category:** Data completeness / pricing
- **Justification:** The default-selected fabric has no authoritative price, so the customer's **very first** price is the non-authoritative estimate from BUG-B001 — the worst first impression for pricing trust.
- **Real-time example:** load the page with no interaction → "Estimated — this fabric code is not yet in the price list" is shown immediately. Selecting a priced code (e.g. `82032A`) switches to a real price.
- **Safe fix (needs approval):** either default to a fabric that has a price, or import prices for the `82143*` codes (`fabric-swatch-import` / price list).

### BUG-B003 — Pricing slug fragility confirmed (was VER-A001)
- **Route:** `POST /api/v1/pricing/calculate`; frontend `productSlug = pathname.split('/').pop()`
- **Severity:** **P2** · **Category:** Robustness / silent failure
- **Justification:** VER-A001 is now **reproduced**. Any URL whose last path segment ≠ stored slug (query string, trailing slash) yields `{"success":false,"error":"Product not found"}` and a silent price failure.
- **Real-time example:** `POST /api/v1/pricing/calculate {"productSlug":"affordable-custom-roller-blinds?x=1", ...}` → **"Product not found."** A shared/campaign URL with a `?utm=` tail would break pricing.
- **Safe fix (needs approval):** derive slug from a server-rendered data attribute (not the URL tail), and strip query/hash before matching.

## VERIFIED — working as specified (Pass 2)
- **Stage 5 Configurator:** `GET /api/products/{slug}/options` returns structured sections (dimensions, room, shade style, mount/control/solar, hardware, accessories) — matches the page accordions.
- **Stage 2 Fabric:** `/api/product-page-data` returns the fabric catalog (codes, images, filterType, isActive) — swatches render.
- **Stage 6 (happy path):** authoritative pricing engine returns manufacturer cost + margin + line total for priced fabrics.

---

# Program A — Defect Backlog (Audit Pass 3)

> **Iteration 2 of the recursive journey loop — Backend Admin Panel.** Read-only; reproduced against `http://localhost:3001/admin/*`. Extends BUG-A001/A002/A003 with fresh evidence. Fixes need owner approval.
>
> **Surface:** 79 admin `.html` pages; nav config (`admin/js/adminNavConfig.js`, 604 lines) exposes **31 nav items, all `status: 'active'`, 0 `disabled`.**

## CONFIRMED defects (re-reproduced)

### BUG-A002 (updated) — Admin advertises placeholder pages as active features
- **Pages (200 + "coming soon"):** `create-order.html`, `tracking.html`, `product-tags.html`, `product-content.html`
- **Severity:** **P2** · **Category:** Placeholder / not connected
- **Justification (sharpened):** the nav config has **zero `status:'disabled'` items**, so every feature — including these 4 stubs — renders as a normal, clickable, "active" nav entry with no "Coming Soon" affordance. The doc's rule "do not assume a page works because its route exists" is violated at the navigation layer, not just the page.
- **Real-time example:** click **Create Order** in the admin sidebar (presented as active) → `/admin/create-order.html` returns **HTTP 200** with a **"coming soon"** body → staff cannot create a manual/phone order. Same for Tracking, Product Tags, Product Content.
- **Native fix (needs approval):** `create-order` + `tracking` are natively covered by Shopify Admin (draft orders / order tracking) — redirect rather than build; for the rest, either build or mark `status:'disabled'` so the nav shows "Coming Soon."

### BUG-A001 (confirmed) — Triple duplicate product editors
- `product-edit.html` (27 KB) · `product-editor.html` (37 KB) · `product-editor-v2.html` (289 KB) all present. Evidence unchanged from Pass 1; still 3 editors for one task.

### BUG-A003 (confirmed) — Dead navigation links
- **Reproduced:** **30 admin pages** contain **65 `href="#"`** anchors. Per-page intent confirmation still required (some may be JS-handled).

## VERIFIED — NOT defects (Pass 3)
- **`products.html` is NOT a placeholder** — ruled out. A Pass-3 broad `grep -ril "coming soon"` matched it, but the rendered page has **0** "coming soon" occurrences (HTTP 200, real content). False positive, logged per loop discipline.
- **Admin APIs correctly auth-gated:** `/api/admin/{orders,customers,products,manufacturers}` all return **401** without a token. Good security posture (consistent with Pass 1).

## FLAGGED — requires verification (Pass 3)
### VER-A002 — No clean-URL routing for admin pages
- **Observation:** `/admin/products`, `/admin/create-order`, `/admin/product-editor-v2` (no `.html`) return **404**; only the `.html` form is served (static middleware). The storefront has clean routes (`/product/:slug`) but the admin does not.
- **Why flagged:** low impact if all admin links include `.html`, but any hand-typed or externally-linked clean admin URL 404s. **Action:** confirm every admin nav href includes `.html` before classifying.

---

# Program A — Defect Backlog (Audit Pass 4)

> **Iteration 3 of the recursive journey loop — Stage 7 Cart / data preservation** (roller shades). Read-only; reproduced against `http://localhost:3001`. Fixes need owner approval.

## CORRECTED — BUG-C001 ruled out as a false positive (deep-dive, Iteration 3b)

> ⚠️ **Retraction (loop discipline).** BUG-C001 was initially filed P1 ("cart ≠ page, two engines"). A deep-dive **disproves it.** Recording the correction transparently rather than deleting it.

### ~~BUG-C001~~ — NOT a defect: page and cart use the SAME engine and agree
- **Root cause of the false alarm:** there is only **one** engine — `extendedPricingEngine.calculateCustomerPrice`. Both `POST /api/v1/pricing/calculate` (`server.js:1442`) and `POST /api/cart` (`server.js:731`) call it. The page handler reads control/motor/hardware **only from the nested `options` object** and ignores top-level `controlType`. My original test sent `controlType` **top-level** to the page API (silently dropped → $33.45) but **inside `configuration`** to the cart (applied → $99.60). Different inputs, not different engines.
- **Fair re-test (identical nested input):** `fabricCode=82032A, options:{controlType:motorized}, 24×36` → page API **$99.60** and cart **$99.60**. The $66.15 delta is the motorized-motor surcharge, applied identically. **Page == Cart.**
- **Frontend confirms:** `pk-product.js` builds `options` with control/motor/hardware nested and posts `{...,options}` — correct shape. Page display uses the same engine result.

## VERIFIED — working as specified (Pass 4)
- **Stage 6 pricing is single-engine & consistent:** page display, page API, and cart all resolve through `extendedPricingEngine` and agree for identical configs.
- **Stage 7 data preservation:** every selection survives add-to-cart — `POST /api/cart` persists `configuration` (fabricCode, controlType, mount), `width`, `height`, `roomLabel`; `GET /api/cart/:sessionId` returns them intact. **No data loss into cart.**
- **Stage 6.6 auditability (cart):** cart stores a `price_snapshot` with `captured_at` timestamp + `manufacturer_price` source — matches the doc's "persist inputs + applied rules + timestamp."
- **Cart price is server-authoritative:** `POST /api/cart` recalculates price server-side and ignores any client-supplied price (good — prevents price tampering).

## Revised standing of BUG-B001 (from Pass 2)
- **Downgrade P1 → P3.** There are **not** two competing priced engines. The "$33.60 estimate" on load is the engine's **estimate mode for unpriced fabrics** (the default fabric `82143A` has no price — see BUG-B002), shown with an explicit "Estimated — not yet in the price list" label. That is transparent, not a hidden mismatch.
- **Residual real issue (P3):** a separate **client-side** `fallbackPriceCalculation` (`pk-product.js:~2442`, hardcoded `pricePerSqMeter = 20`) runs only if the pricing API **errors**; its number would not match the server engine. Low likelihood (API-failure only), but it invents a price. **Safe fix (needs approval):** on API failure show "price unavailable / retry," don't render a hardcoded estimate.
- **Still valid & unchanged:** **BUG-B002** (default fabric unpriced → estimate on load) and **BUG-B003** (slug fragility on `?query`/trailing slash).

---

# Program A — Defect Backlog (Audit Pass 5)

> **Iteration 4 of the recursive journey loop — Checkout / Order / Manufacturing (Stages 9–11)**, roller shades. Read-only; reproduced against `http://localhost:3001`. Test cart sessions created during the audit were deleted afterward.

## VERIFIED — working as specified (Pass 5)
- **Stage 6/9 pricing is consistent end-to-end.** Canonical config (roller, 24×36, fabric `82032A`, motorized) priced through **three** independent endpoints, identical input:
  - `POST /api/v1/pricing/calculate` (page) → lineTotal **$99.60**
  - `POST /api/cart` (cart) → line_total **$99.60**
  - `POST /api/calculate-order-total` (checkout) → lineTotal **$99.60**, subtotal 99.60, tax **$7.22** (CA 7.25%), shipping **$0** (free ≥ $99), grandTotal **$106.82**
  - All resolve through the single `extendedPricingEngine`. **No parity gap; tax + shipping applied correctly.**
- **Stage 10 order surface present:** `POST /api/orders` (create), `GET /api/orders/:orderNumber`, `/history`, `/ledger`, and an auth-gated **state-machine** `POST /api/orders/:orderId/transition` — matches Stage 10's "normalized order state machine."

## FLAGGED — requires verification (Pass 5)
### VER-B001 — Stage 11 manufacturer work-order generation not evidenced as an API
- **Observation:** manufacturer **assignment** endpoints exist (`/api/admin/orders/:id/assign-manufacturer`, `auto-assign-all`), but no endpoint that **generates a work order carrying the full spec** (fabric code, dimensions, options) to the manufacturer was found by grep.
- **Why flagged (not a bug):** assignment may be the intended mechanism, with the spec read from the order. **Action:** with a dev JWT, assign a manufacturer to a test order and confirm the manufacturer view exposes the exact fabric code + dimensions + options (Stage 11.1) before classifying. Deferred to the authenticated admin pass.

## Loop note
- **Test-artifact discipline:** two Pass-5 comparisons initially looked like parity bugs ($106.15, then a $6.55 gap) — both were **my** input-shape errors (omitted `fabricCode`/wrong nesting), ruled out by re-running with identical inputs. No defect. Recorded so the pattern (endpoints read `fabricCode`/control from different request shapes) is itself noted as an API-ergonomics smell worth a future consistency pass.

---

# Program A — Defect Backlog (Audit Pass 6)

> **Iteration 5 of the recursive journey loop — Authenticated Admin CRUD + Portal RBAC** (doc "Next audit pass #1" and #4). Dev JWTs minted locally with the dev `JWT_SECRET` (as the doc authorized). Read-only queries. Dev tokens deleted after the run.

## CONFIRMED defects

### BUG-D001 — Broken access control: RBAC is defined but NEVER enforced (any role reads all customer + order data)  🔴
- **Routes:** all `/api/admin/*` (e.g. `GET /api/admin/orders` `server.js:1985`, `GET /api/admin/customers` `server.js:9785`), guarded only by `authMiddleware`.
- **Severity:** **P1** (data confidentiality / broken access control — OWASP A01) · **Category:** Security / RBAC
- **Justification (root cause):** `authMiddleware` (`middleware/auth.js:35-37`) does **only** `jwt.verify(token, JWT_SECRET); req.admin = decoded; next()` — it never checks role. The RBAC module (`middleware/rbac.js`: `ROLES`, `ROLE_HIERARCHY`, `PERMISSIONS`, `requirePermission`, `requireRole`) is **imported but applied to 0 routes** (`grep` of `server.js`: `requirePermission`/`requireRole` each appear exactly once = the import). Every portal (`/api/admin/login`, `/api/manufacturer/login`, `/api/dealer/login`, `/api/technician/login`, `/api/customer/login`) signs its token with the **same shared `JWT_SECRET`** via `generateToken`. Net effect: any token that any portal issues is accepted on every admin endpoint. This is the exact failure the blueprint's RBAC pass was meant to catch ("manufacturers can't see customer financials; installers see only assigned jobs").
- **Real-time example (reproduced):**
  - Real issuance path: `/api/manufacturer/login` → `generateToken({role:'manufacturer', manufacturerId,...})` (`server.js:9232`), signed with `JWT_SECRET`.
  - `GET /api/admin/customers` with a `role:'manufacturer'` token → **HTTP 200** (full customer list: names, contact, order financials). Same for `role:'installer'`/`'technician'` and `role:'viewer'`. Unauthenticated → 401 (so the perimeter holds; the failure is *authorization*, not authentication).
  - A `role:'viewer'` token also reaches admin endpoints with no write restriction — no least-privilege even among admin roles.
- **Scope caveat (fair):** exploitation requires a *validly-signed* token, i.e. a legitimate portal login (or the secret). It is **not** an anonymous internet leak. It **is** a privilege-escalation / least-privilege failure across every authenticated role — a manufacturer or installer with normal portal credentials can read all customer PII + financials.
- **Safe fix (needs approval):** (1) apply `requireRole`/`requirePermission` to every `/api/admin/*` route; (2) make `authMiddleware` reject non-admin roles (or give portal tokens a separate audience/secret) so manufacturer/technician/dealer tokens can't pass admin auth; (3) add regression tests asserting manufacturer/technician/viewer tokens → **403** on admin data.

## VERIFIED (Pass 6)
- **Authentication perimeter is sound:** all `/api/admin/*` require a valid signed token (401 without) — consistent with Pass 1/3.
- **Admin CRUD reads function** for a valid token (orders/customers/products return 200 with data).

## Resolves
- **VER-B001 (Stage 11)** partially: the manufacturer-access question is answered — the problem is the **opposite** of the doc's worry. Manufacturers don't see *too little*; via BUG-D001 they can see *everything*. Proper Stage-11 scoping depends on fixing BUG-D001 first.

### BUG-D002 — `/api` response cache serves authenticated data to ANY caller (auth bypass)  🔴🔴
- **Route/code:** `apiCacheMiddleware` (`server.js:308`), mounted `app.use('/api', apiCacheMiddleware)` (`server.js:344`) — runs **before** `authMiddleware`.
- **Severity:** **P1** (worse than D001 — needs **no token at all**) · **Category:** Security / broken access control + sensitive-data cache (CWE-524).
- **Justification (root cause):** the cache key is `req.originalUrl` **only** (no auth/user). On a cache hit it does `res.send(cached.body)` and returns **without calling `next()`**, so `authMiddleware` never runs. It caches every 2xx `/api/*` GET, including `/api/admin/*`.
- **Real-time example (reproduced, ordering-dependent):** cold cache → `manufacturer` GET `/api/admin/customers` = **403** (correct). Then an `admin` GET warms the cache (200). Then the **same URL** with a **manufacturer token → 200**, and **with no token at all → 200**, returning the full customer list incl. bcrypt `password` hashes. Anonymous PII exposure.
- **Why it mattered doubly:** it also *masked* the BUG-D001 fix — admin-first request order made every later role appear to pass.

## FIXED (owner-authorized: "Fix BUG-D001 now"; D002 fixed as the necessary completion of the same admin-access-control objective)
- **BUG-D001 fix** — `middleware/auth.js`: added `ADMIN_ROLES` allowlist; `authMiddleware` now returns **403** unless `decoded.role ∈ {super_admin, admin, manager, editor, viewer}`. Portal tokens (manufacturer/dealer/technician/customer) rejected. Scope-safe: only `/api/admin/*` + `/api/orders/:id/transition` use `authMiddleware`; portals have their own middlewares (untouched).
- **BUG-D002 fix** — `server.js` `apiCacheMiddleware`: skip cache entirely when `req.headers.authorization` is present **or** path starts with `/api/admin`. Authenticated/admin responses are never cached or replayed; anonymous public GETs (catalog/fabric) still cache.
- **Verification (single clean server, deterministic across runs, incl. cache-warmed order):**
  - `/api/admin/customers`: admin/manager/viewer → **200**; manufacturer/technician/dealer/customer → **403**; no-token → **401**.
  - Cache-warm order (admin 200 → manufacturer → no-token): **403 / 401** (previously 200/200).
  - Public GETs still 200 and still cache (`X-Cache: MISS`→`HIT`).
- **Not yet done (needs approval):** least-privilege *within* admin roles (viewer can still hit write endpoints — no `requirePermission` on routes). Separate follow-up.

---

# Program A — Fix Pass (2026-07-20, owner-authorized: "start working on it and push every commit")

> Recursive Working Model applied per defect: reproduce → justify → real-time example → smallest safe change → test → retest downstream → commit + push. Branch `frontend-align-livetheme` (never main).

## FIXED

### BUG-B003 — Pricing slug fragility  ✅ `61497e2`
- **Root cause:** frontend derives `productSlug` from the URL tail (`pathname.split('/').pop()`), so a query string / hash / trailing slash reached `extendedPricingEngine.calculateCustomerPrice()` verbatim → `db.products.find(p => p.slug === productSlug)` missed → `Product not found` (silent price failure on any campaign/shared URL).
- **Real-time example (reproduced on running app):** `POST /api/v1/pricing/calculate {productSlug:'affordable-custom-roller-blinds?utm=x', 82032A, 24×36}` → **before** `{success:false,error:'Product not found'}` · **after** `{success:true, lineTotal:33.45}`.
- **Fix:** normalize slug (strip `?query`/`#hash`/trailing `/`) at the true root-cause site (`services/extended-pricing-engine.js`) + defensive `normalizeSlug()` on `/api/store/price-quote` (`server.js`). *Note: the `app.post('/api/v1/pricing/calculate')` handler in server.js is shadowed by the `/api/v1` CRM router mount — the router → pricing engine is the live path; that is where the fix landed.*
- **Downstream retest:** nonexistent slug still 404s (no false match); motorized parity still `$99.60`.

### BUG-B001-residual — Client-side invented price on API failure  ✅ `08b308e`
- **Root cause:** on pricing-API error/network failure, `pk-product.js` called `fallbackPriceCalculation()` using a hardcoded `pricePerSqMeter = $20/m²` that diverges from the authoritative server engine (mfr cost + 40% margin). Customer could see and add-to-cart a price the business's own engine disagrees with.
- **Fix:** both error + catch paths now call new `displayPriceUnavailable()` ("Price unavailable — please retry" + add-to-cart disabled) instead of inventing a number. Old function marked DEPRECATED, 0 callers, hardcoded `$20/m²` now unreachable.
- **Downstream retest:** happy path unchanged (`$33.45` / motorized `$99.60` still render); JS syntax OK.

## RESOLVED BY DATA — no code change (loop discipline: reproduce before fixing)

### BUG-B002 — Default fabric `82143A` unpriced → estimate on load  ✅ resolved
- **Re-reproduced 2026-07-20:** `82143A` now returns `lineTotal:33.45` (a real price), no estimate flag. `PK_ROLLER_PRICING` (pk-product.js) now contains `"82143A":[19.91,23.15,40,40]`. The Pass-2 condition (default fabric had no price) no longer holds — the price list added during the roller-shades port fixed it. **Not a live defect; no change made.**

## FIXED — architect-decided pass (owner delegated: "think like a professional architect and take decision")

### BUG-A001 — Triple duplicate product editors  ✅ `89aee25`
- **Decision (evidence, not filesize):** `product-editor.html` is canonical — it has a complete `saveProduct()` data model and is what `products.html` edit links already use. `product-edit.html` (legacy 27KB/12-field stub) → query-preserving redirect to canonical; `product-launch.html` repointed. `product-editor-v2.html` ("Product Page Editor v2.0", 325 fields) is a *distinct advanced tool*, not a stub — left intact and out of the default edit path (a redirect would destroy capability). editor↔v2 data-model reconciliation flagged as a separate build task.
- **Verified:** stub redirects (preserves `?id=`); canonical + v2 still 200; 0 live pages link the dead stub.

### BUG-A002 — Placeholder stub advertised as a feature  ✅ `b4a7a83`
- **Decision (no blind sweep):** removed only the one confirmed nav-linked stub — `Create Order` in the command palette (`create-order.html` is a "coming soon" body). Native-first: manual orders are covered by Shopify draft orders; re-add when a real page/redirect exists. Orphaned non-nav stubs left for a per-page build decision.
- **Verified:** palette 69→68 entries; 0 live `create-order` links.

### BUG-A003 — Dead `href="#"` links  ✅ `4860f2b`
- **Analysis:** of 64 anchors across 29 files, **42 are JS-handled (functional, untouched)**. Truly-dead ones clustered in shared partials `theme/header.html` + `navigation/footer.html`. Wired 14 links to routes **verified live** (`/shop`,`/samples`,`/help`,`/product/{roller,zebra,motorized,roman}-shades`,`/guides`,`/faqs`,`/contact`,`/about`,`/trade`,`/reviews`,`/privacy-policy`). Left Shipping/Return/Terms non-wired — `/shipping-policy`,`/return-policy`,`/terms` are 404; not linking to broken routes until those pages exist.

### Admin least-privilege — viewer could write  ✅ `9708816`
- **Decision (single choke point, not 305 routes):** extended `authMiddleware` (runs on every protected `/api/admin` route) to deny mutating methods (POST/PUT/PATCH/DELETE) to the `viewer` role; editor+ retain write. One guard can't be forgotten on a new route; granular per-resource rules (rbac.js) can layer later.
- **Verified with minted dev tokens:** GET → viewer/editor/admin 200, manufacturer 403, none 401; POST/PUT → viewer **403**, editor/admin reach handler (400/404), manufacturer 403. D001 regression intact.

## Remaining follow-ups (need content/product intent, not code)
- Build (or Shopify-redirect) the orphaned admin stub pages: `create-order`, `tracking`, `product-tags`, `product-content`.
- Create the missing policy pages: Shipping Policy, Return Policy, Terms of Service (routes 404).
- Reconcile `product-editor.html` (34 fields) ↔ `product-editor-v2.html` (325 fields) into one editor with progressive disclosure.
- Layer granular rbac.js `PERMISSIONS` per route (e.g. editor can't delete) on top of the coarse viewer-read-only guard.
