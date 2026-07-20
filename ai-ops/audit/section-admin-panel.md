# Section I — Admin Panel Deep (Blueprint §10 Admin-Panel Architecture / §11 Functional Domains) — Audit

> Section **I** of the recursive audit loop (controlled-parallel mode). Scope: the admin panel functional surface — re-confirming BUG-A001/A002/A003 with fresh read-only evidence, then auditing the admin **create-order** flow and admin **order/shipment tracking** UI, and enumerating placeholder/dead admin pages. Reproduced **read-only** against the running app on `http://localhost:3001/admin/*` and by reading `backend/` + `frontend/public/admin/` source. **No writes, no restarts, no fixes.** Admin RBAC (§15.1, Stage-D BUG-D001/D002) is fixed and **not re-litigated**. Fixes below are recommendation-only, native-first, and need owner approval.

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **Nav layer:** `frontend/public/admin/js/adminNavConfig.js` (604 lines) — **31 nav items, all `status: 'active'`, 0 `disabled`** (unchanged from Pass 3).
- **Product editors:** `product-edit.html` (27 KB), `product-editor.html` (37 KB), `product-editor-v2.html` "Product Page Editor v2.0" (289 KB), `product-page-editor.html` "Product Page Editor v3.0" (382 KB), plus `product-content.html` (107 KB).
- **Create-order flow:** `admin/create-order.html` (65 KB) → `POST /api/admin/orders`. Backend order routes in `backend/server.js`.
- **Tracking UI:** `admin/tracking.html` (23 KB) → `GET /api/admin/orders`, `PUT /api/admin/orders/:id`. `PUT /api/admin/orders/:id/status` (`server.js:2251`).
- **Placeholder sweep:** all top-level `admin/*.html`; `href="#"` anchors; "coming soon" markers; zero-fetch static pages.

## What is already correct (verified, no change)
- **Admin API perimeter holds.** `GET /api/admin/*` return **401** without a valid token (re-confirmed; consistent with Pass 1/3/6). Stage-D RBAC fix stands; not re-litigated.
- **Order read + status routes exist and are sound.** `GET /api/admin/orders` (`server.js:2066`), `GET /api/admin/orders/:id` (`:2159`), and `PUT /api/admin/orders/:id/status` (`:2251`) all function and are `authMiddleware`-gated. The `/status` route **already handles fulfillment tracking correctly** (BUG-F004 fix: reads `{carrier, trackingNumber, trackingUrl, estimatedDelivery}`, writes `order.tracking`, fires shipped-notification, records profit). The tracking gap below is purely a **frontend** wiring error, not a backend gap.
- **A real draft-order backend exists** — `POST /api/admin/draft-orders` (`server.js:10252`) and `draft-orders.html` — even though create-order's "Save Draft" button says "coming soon."

---

## CONFIRMED defects

### BUG-A004 — Admin "Create Order" form submits to a non-existent endpoint → manual/phone order creation always fails  🟠
- **Route/page:** `admin/create-order.html` → `fetch('/api/admin/orders', {method:'POST'})` (`create-order.html:1191`).
- **Severity:** **P2** · **Category:** Broken workflow / dead API wiring (§10 Orders admin; §11.6 Orders).
- **Root cause:** `backend/server.js` defines **only `GET` `/api/admin/orders`** (`:2066`), plus `PUT …/:id/status`, `DELETE …/:id`. There is **no `POST /api/admin/orders`** route (`grep -c "app.post('/api/admin/orders'" server.js` → **0**). The form's `submitOrder()` posts a full order payload there; Express has no matching handler, so the response is not `{success:true}` and the flow falls to `alert('Failed to create order …')` / `alert('Error creating order …')`. The real create endpoints are `POST /api/orders` (`:953`, storefront) and `POST /api/admin/draft-orders` (`:10252`) — the admin form points at neither.
- **Real example (source-reproduced):** `create-order.html:1155-1198` builds `orderData` (customer, `items[]`, subtotal/shipping/tax/total, `status:'order_received'`) and `POST`s it to `/api/admin/orders` with a valid admin bearer token; no server route consumes it. *(Live POST not executed — read-only rule. Endpoint mismatch is definitive from source: form target vs route table.)* `[NEEDS-WRITE-TEST]` only to capture the exact HTTP status of the unmatched POST.
- **Correction to BUG-A002:** this page is **not** a "coming soon" placeholder (the earlier claim "staff cannot create a manual/phone order — page shows coming soon" is now **false**). It is a fully-built 65 KB form (customer search, product add, bulk CSV upload, discount, notes). It fails for a *different, worse* reason: it looks fully functional but is wired to a dead endpoint.
- **Secondary gaps in the same page (all P3, client-side pricing divergence — §11.3 single-source pricing):**
  - Totals are computed **client-side**, not via the server pricing engine: `tax = subtotal * 0.08` (hardcoded **8%**, vs the engine's CA **7.25%** used at checkout — Pass 5), `shipping = subtotal > 500 ? 0 : 29.99` (vs checkout's free ≥ $99). (`create-order.html:1179-1189`.)
  - `applyDiscount()` is **fake** — any code shows a hardcoded `-$25.00` and never validates against the coupon engine (`create-order.html:1138-1145`).
  - `saveDraft()` is a stub `alert('Draft order functionality - coming soon!')` (`:1211`) despite `POST /api/admin/draft-orders` existing.
- **Proposed fix (native-first, recommendation-only):** repoint `submitOrder()` to the existing `POST /api/admin/draft-orders` (native draft-order path) or add a purpose-built `POST /api/admin/orders` that runs the payload through `extendedPricingEngine` server-side (never trust client subtotal/tax); wire `saveDraft()` to the same draft endpoint; make `applyDiscount()` call the coupon engine. Do not build a parallel pricing path in the browser.

### BUG-A005 — Admin "Tracking Updates" UI: both write actions target a non-existent route (wrong URL + wrong field names) → tracking never saves  🟠
- **Route/page:** `admin/tracking.html` → `fetch('/api/admin/orders/${id}', {method:'PUT'})` in `addTracking()` (`tracking.html:307`) and `updateShipmentStatus()` (`:346`).
- **Severity:** **P2** · **Category:** Broken workflow / dead API wiring (§10 Orders admin; §11.6 fulfillment / §11.7).
- **Root cause (two mismatches):** (1) **Wrong URL** — the only order-mutation route is `PUT /api/admin/orders/:id/**status**` (`server.js:2251`); there is **no bare `PUT /api/admin/orders/:id`** (`grep "app.put(.*/api/admin/orders" server.js` → single result, the `/status` one). Both frontend calls omit `/status` → 404 → `alert('Failed to save tracking …')` / `alert('Failed to update status')`. (2) Even the **field names are wrong**: the page sends `{tracking_number, shipping_carrier, status}` (snake_case) but the `/status` route reads `{carrier, trackingNumber, …}` (camelCase, `carrier` not `shipping_carrier`) — so tracking would not persist even at the correct URL.
- **Real example (source-reproduced):** `tracking.html:305-314` — `PUT /api/admin/orders/<id>` body `{tracking_number, shipping_carrier:carrier, status:'shipped'}`; no route matches the URL, and the field names don't match `server.js:2322` (`const { carrier, trackingNumber, trackingUrl, estimatedDelivery } = req.body`). Result: admin can enter a carrier + tracking number, click save, and nothing is stored. `notifyCustomer()` is a stub `alert('Customer notification feature - coming soon!')` (`:366`).
- **Proposed fix (native-first, recommendation-only):** change both fetches to `PUT /api/admin/orders/${id}/status` and rename the body keys to `{status, carrier, trackingNumber}` to match the existing (already-correct, BUG-F004) route. Backend needs no change. Wire `notifyCustomer()` to the shipped-notification path the `/status` route already triggers.

### BUG-A001 (re-confirmed + extended) — Duplicate product editors: now TWO overlapping duplicate families  🟡
- **Files:** product-data editors — `product-edit.html` (27 KB, `<title>Product</title>`) and `product-editor.html` (37 KB, `<title>Product Editor</title>`); product-page editors — `product-editor-v2.html` (289 KB, `<title>Product Page Editor v2.0</title>`) and `product-page-editor.html` (382 KB, `<title>Product Page Editor v3.0</title>`).
- **Severity:** **P3** · **Category:** Architecture / maintainability (§ "one source of truth per domain").
- **Root cause:** the same two tasks each have competing implementations, reachable from different entry points, so product logic must be changed in multiple places or it drifts:
  - The **main product list** `products.html` (and `catalog/index.html`) links to **`product-editor.html`** (37 KB) — *not* the far richer v2/v3 page-editors. `product-edit.html` (the 27 KB stub) is linked from `product-launch.html`.
  - **`product-editor-v2.html` ("v2.0", 289 KB)** is still present and linked from `reports/low-performers.html`, while **`product-page-editor.html` ("v3.0", 382 KB)** supersedes it and is linked from `image-manager.html`/`product-content.html`. Two versioned rebuilds of the same page-editor coexist and are both reachable.
- **Real example:** an admin editing a product from the products list lands on `product-editor.html` (37 KB, fewer fields); an admin arriving via a low-performers report lands on `product-editor-v2.html` (289 KB) — a superseded build. Same product, different editors, different field sets → inconsistent product data. (Extends Pass 1's "triple duplicate": there are now **4** editor files across two task families, with a v2/v3 version fork added since Pass 1.)
- **Proposed fix (recommendation-only, repo not Shopify):** pick one canonical editor per task (product-data vs product-page), redirect the rest, retire the superseded `v2.0`/stub after verification. Native-first note: product *data* editing is natively Shopify Admin's job (metafields/metaobjects) — prefer consolidating toward that rather than maintaining custom editors.

### BUG-A006 — Static "mockup" admin pages: full UI + hardcoded fake data + stub `alert()` handlers, advertised as active features  🟠
- **Pages (0 backend fetch calls each):** `landing-pages.html`, `room-visualizer.html`, `installer-payments.html`, `delivery-scheduling.html`.
- **Severity:** **P2** (`installer-payments` — financial op) → **P3** (others) · **Category:** Placeholder / not connected (§ "do not assume a page works because its route exists").
- **Root cause:** these pages render complete UI chrome but make **zero** `fetch()` calls; their data is **hardcoded** and their action buttons are stubs that only `alert()`. Because the nav config has **0 `disabled`** items (all 31 `status:'active'`), they present as normal working features with no "coming soon" affordance — worse than an honest placeholder because nothing discloses they're inert.
- **Real examples (reproduced from source):**
  - `landing-pages.html` shows hardcoded cards ("Spring … 1,245 visits • 3.2% conversion", "consultation … 892 visits • 8.5%") — invented analytics, no API (`landing-pages.html:35-55`). Advertised as **active** in the sidebar (`adminNavConfig.js:73`).
  - `installer-payments.html` — a **Process Payments** button whose handler is `function processPayments(){ alert('Processing all pending payments...'); }` (`:85`): a financial-operations control that does nothing.
  - `room-visualizer.html` — `uploadRoom()` / `openEditor()` both just `alert('Opening …')` (`:99-100`).
  - `delivery-scheduling.html` — `scheduleDelivery()` just `alert('Opening delivery scheduler...')` (`:103`).
- **Proposed fix (recommendation-only):** either wire each to its real backend, or set `status:'disabled'` in `adminNavConfig.js` (and remove/guard the non-nav links) so they honestly read "Coming Soon" instead of faking data. Native-first: delivery/tracking are covered by Shopify Admin — prefer redirect over custom build where applicable.

---

## CORRECTIONS (loop discipline — prior claims revised on fresh evidence)

### BUG-A002 — partially RETRACTED: the four named pages are NOT whole-page "coming soon" placeholders
- **Prior claim (Pass 1/3):** `create-order.html`, `tracking.html`, `product-tags.html`, `product-content.html` "return 200 but render a 'coming soon' body — the feature is unavailable."
- **Fresh evidence:** each file contains **exactly one** "coming soon" string, and it is inside a **single sub-feature button handler**, not a page body. The pages themselves are substantial and functional: `create-order.html` 65 KB full order form; `tracking.html` 23 KB shipment list w/ real GET; `product-content.html` 107 KB w/ 3 real fetches; `product-tags.html` 20 KB w/ 7 real fetches. The stubbed sub-features are: create-order `saveDraft()`, tracking `notifyCustomer()`, product-tags "media tag removal", product-content "sample ordering."
- **Net:** BUG-A002 as originally scoped is a **false positive on the page level**. The genuine create-order/tracking failures are the *endpoint-mismatch* defects **BUG-A004 / BUG-A005** above (a distinct, more serious root cause). BUG-A002's still-valid residual is the **nav-layer point**: all 31 nav items are `status:'active'` with no "Coming Soon" affordance, which is what lets the BUG-A006 mockups and these stub sub-features masquerade as complete. Kept only in that narrowed form.

### BUG-A003 — DOWNGRADE P3 → P4 (cosmetic): the "65 dead links / 30 pages" figure massively overstates severity
- **Prior claim:** "30 admin pages contain 65 `href="#"` anchors … clicking a nav/action item does nothing (page jumps to top)."
- **Fresh classification (top-level `admin/*.html`, 42 anchors):** **36** are `onclick=…; return false;` (fully functional, no jump); **3** are `onclick` **without** `return false` (`bulk-import.html:69-71` template-download links — they run the handler, then harmlessly jump to top); **3** are bare `href="#"` **but get their real href assigned in JS at load** (`product-content.html` `viewLiveBtn`/`editPricingBtn`/`previewLink`, set at `:1993-1995`). Net: **~0 truly dead links** at top level; the raw 65-count conflates functional JS-triggered anchors with dead ends.
- **Net:** real residual is **cosmetic only** — the 3 no-`return-false` template links cause a scroll-to-top after firing. Recommend P4; optional fix: add `return false;` / convert to `<button>`. The "dead-end navigation / hurts reliability" framing is **retracted**.

---

**Summary:** Admin panel deep audit found **4 confirmed defects** — 3× P2 (BUG-A004 create-order posts to a non-existent `POST /api/admin/orders`; BUG-A005 tracking UI PUTs to a non-existent bare route with wrong field names; BUG-A006 static mockup pages incl. an inert "Process Payments" control) and 1× P3 (BUG-A001 now 4 duplicate editors across two task families) — plus two loop corrections: BUG-A002 partially retracted (pages are full, not "coming soon" placeholders; genuine failures are the endpoint mismatches) and BUG-A003 downgraded P3→P4 (≈0 truly-dead links; count overstated). All recommendation-only, native-first, pending owner approval.
