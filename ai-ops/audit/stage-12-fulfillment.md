# Stage 12 — Shipping & Tracking (Fulfillment + Notification + Support) — Audit + Fixes

> Section **E** of the recursive audit loop. Scope: customer-journey **Stage 12** — 12.1 create fulfillment + tracking number (admin/manufacturer side), 12.2 shipment notifications, 12.3 order tracking page / `GET /api/orders/lookup`. Reproduced against the running app on `http://localhost:3001` with sample data in `backend/database.json` (12 real orders). Native-first backend fixes, no front-end redesign. Test records created during the audit are removed and the DB restored byte-for-byte (pre-audit md5 recorded below).

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **12.1 Fulfillment + tracking:**
  - Admin: `PUT /api/admin/orders/:id/status` (`server.js:2181`) — flips order to `shipped`; **stores no carrier/tracking**.
  - Manufacturer: `POST /api/manufacturer/orders/:orderId/tracking` (`server.js:9392`) → `manufacturerService.addTrackingInfo` (`services/manufacturer-service.js:323`) — writes `order.shipping.{carrier,trackingNumber,trackingUrl,estimatedDelivery}`.
  - Admin shipping service: `POST /api/admin/shipping/shipments` (`server.js:15938`) + `POST /api/admin/tracking` (`server.js:15305`) — store rows in a **separate** `db.shipments` collection.
- **12.3 Customer tracking:** public `GET /api/orders/lookup?orderNumber=&email=` (`server.js:875`) reads `order.tracking`; also `GET /api/orders/:orderNumber` (`server.js:1107`), public, and `order-lookup.html`.
- **12.2 Notification:** `emailService.sendShippingNotification(order, shipment)` exists (`services/email-service.js:188`, logs to `db.emailLogs` via `logEmail`) but is **never called**. `db.emailLogs` = 0.
- **Sample data:** 12 orders; 6 already at `status:"shipped"`; **none** carry any tracking field (`order.tracking`, `order.shipping.trackingNumber` all empty). `order.shipping` is a **number** (shipping cost, `0`) on every order, not an object.

## What is already correct (verified, no change)
- `GET /api/orders/lookup` requires BOTH `orderNumber` AND a case-insensitive `email` match, and returns a **reduced** projection (no payment data). Same 404 on any mismatch (no distinct not-found vs wrong-email message) — no enumeration on this path.
- Admin/manufacturer tracking routes are correctly role-gated (`authMiddleware` / `manufacturerAuthMiddleware`) — verified in the Stage-D RBAC pass; not re-litigated here.

---

## CONFIRMED defects

### BUG-F001 — Public `GET /api/orders/:orderNumber` exposes any order's full PII + internal cost data with no auth and no email (order enumeration / IDOR) (Stage 12.3)  🔴
- **Route:** `GET /api/orders/:orderNumber` (`server.js:1107`) — no middleware; returns `data: order` (the entire stored order object).
- **Severity:** **P1** · **Category:** Broken access control / IDOR / PII exposure (blueprint §15.1 "zero unauthorized cross-role/cross-customer access")
- **Justification (root cause):** the careful public path `/api/orders/lookup` requires order number **and** a matching email and returns a *reduced* projection. This sibling route requires only the order number, no email, no auth, and returns the **full** order — customer name/email/phone/shipping address, plus internal `manufacturer_cost_total`, per-line `manufacturer_price`, margins and assignment data. Order numbers are `'ORD-' + Date.now().toString(36).toUpperCase()` (`server.js:946`) — time-sequential and enumerable, so an attacker can walk the ID space and harvest every customer's PII and the store's cost/margin structure. No front-end uses this route (only `order-lookup.html` → `/api/orders/lookup`), so gating it breaks no flow.
- **Real-time example (reproduced, unauthenticated):**
  - `GET /api/orders/ORD-MKEUZVG5` (no token, no email) → **200**, leaked `customer_email:"surya@gmail.com"`, `customer_phone:"8169449009"`, `shipping_address:"205 Blue Jasmine Trl, Georgetown, TX 78628, US"`, `pricing.manufacturer_cost_total:171.66`, `margin_total:100.49`.
  - Same order via `GET /api/orders/lookup?orderNumber=ORD-MKEUZVG5` (no email) → **400** "Order number and email are required"; with a wrong email → **404**. The `/lookup` path is safe; the `:orderNumber` path bypasses it entirely.

### BUG-F002 — Tracking added in the manufacturer portal never reaches the customer tracking page: read/write field mismatch + no admin write path (Stage 12.1 ↔ 12.3)  🟠
- **Routes:** writer `POST /api/manufacturer/orders/:orderId/tracking` (`server.js:9392`) → `addTrackingInfo` writes `order.shipping.trackingNumber` (`manufacturer-service.js:337`); reader `GET /api/orders/lookup` returns `order.tracking` (`server.js:923`). Admin `PUT /api/admin/orders/:id/status` (`server.js:2181`) sets `status:"shipped"` but writes **no** tracking at all.
- **Severity:** **P2** · **Category:** Broken workflow / data-model mismatch (12.1 create tracking must be visible on 12.3 tracking page)
- **Justification (root cause):** three disconnected stores exist — `order.tracking` (what the customer reads, never written), `order.shipping.*` (what the manufacturer route writes), and a separate `db.shipments` collection (admin `POST /api/admin/shipping/shipments` / `POST /api/admin/tracking`). The customer lookup only reads `order.tracking`, which no code path populates, so the tracking number is invisible to the customer regardless of how it was entered. There is also no admin route that writes a tracking number the customer page can read.
- **Real-time example (reproduced):** manufacturer `POST …/ORD-MKA9J78E/tracking {carrier:"UPS", trackingNumber:"1Z999AA10123456784"}` → **200 success:true**; customer `GET /api/orders/lookup?orderNumber=ORD-MKA9J78E&email=teja@gmail.com` → **`tracking:null`**. All 6 sample orders already at `status:"shipped"` show `tracking:null` on the customer path.

### BUG-F003 — `addTrackingInfo` silently drops tracking (or clobbers the shipping cost) because `order.shipping` is a number, not an object (Stage 12.1)  🟠
- **Route/fn:** `manufacturerService.addTrackingInfo` (`manufacturer-service.js:335`) — `if (!order.shipping) order.shipping = {}` then `order.shipping.carrier = …`.
- **Severity:** **P2** · **Category:** Silent failure / data integrity
- **Justification (root cause):** on every real order the top-level `order.shipping` field holds the numeric **shipping cost** (e.g. `9.99`, or `0`). The function treats it as an object. When the cost is non-zero, `!order.shipping` is false so `.carrier`/`.trackingNumber` are assigned to a **number primitive** — a silent no-op in non-strict mode — so the tracking is **lost entirely** while the API still returns `success:true` (false success). When the cost is `0`, `!0` is true so `order.shipping` is **replaced by the tracking object**, clobbering the numeric shipping-cost field.
- **Real-time example (reproduced):**
  - Non-zero cost: `ORD-MKA9J78E` `shipping:9.99` → after `POST …/tracking`, `order.shipping` **still `9.99`**, no tracking fields written (silently dropped), response `success:true`.
  - Zero cost: `ORD-MKEUZVG5` `shipping:0` → after `POST …/tracking`, persisted `order.shipping` = `{"carrier":"FEDEX","trackingNumber":"770000000000",…}` — the numeric cost field was overwritten by an object.

### BUG-F004 — No shipment notification is emitted on fulfillment; `sendShippingNotification` is dead code (Stage 12.2)  🟡
- **Routes/fn:** `emailService.sendShippingNotification(order, shipment)` (`email-service.js:188`, logs to `db.emailLogs` via `logEmail`) is defined but **never called**; neither the manufacturer tracking route, `addTrackingInfo`, nor the admin status→shipped path logs/sends anything.
- **Severity:** **P3** · **Category:** Missing notification (mirrors Stage-3 BUG-S004; blueprint §12.2 + `notification-send` audit-log step)
- **Justification (root cause):** Stage 12.2 requires a shipment notification when the order ships. The email template and logger exist, but no fulfillment path invokes them, so no email is sent and no audit record is written. `db.emailLogs` stays at **0** after shipping — there is no lawful audit trail of a shipment notice.
- **Real-time example (reproduced):** after manufacturer adds tracking and after `status:"shipped"`, `db.emailLogs.length` = **0**; no `shipment_notification` entry anywhere.

### BUG-F005 — Cross-module DB cache incoherence: shipping a fulfillment (status/tracking/notification) is silently lost or served stale (Stage 12.1 ↔ 12.3)  🟠
- **Files:** `server.js` inline cache (`dbCache`, `CACHE_TTL=30000`, `server.js:127-294`) vs `services/db-loader.js` (`cache`, `CACHE_TTL=30000`) used by `manufacturer-service` and `ledger-service`.
- **Severity:** **P2** · **Category:** Data integrity / lost write + read staleness (blueprint §10 "no data loss", §15.2 reliability)
- **Justification (root cause):** the app runs **two independent 30-second read caches over the same `database.json`** — one inside `server.js` and one in `services/db-loader.js`. Writes through one do not invalidate the other, so updates cross-writes get lost or read back stale:
  - **Lost write (admin ship):** `PUT /api/admin/orders/:id/status` saves the shipped status + tracking + notification via server's cache, then `recordShippedProfit()` reads the **stale db-loader cache** (pre-save) and its own `saveDatabase` **overwrites the file**, reverting the status change, the tracking, and the emailLog — while the API response (served from the still-mutated server cache) falsely shows success.
  - **Stale read (manufacturer ship):** `addTrackingInfo` writes via db-loader, but `GET /api/orders/lookup` reads server's inline cache, so the customer sees **no tracking for up to 30 s** after it was added.
- **Real-time example (reproduced):**
  - Admin `PUT …/status {status:"shipped",carrier,trackingNumber}` → **200 success:true**, but the on-disk order stayed `status:"manufacturing"`, `tracking:undefined`, `emailLogs` unchanged (the whole shipment write was clobbered by the profit path).
  - Manufacturer `POST …/tracking` then immediate `GET /api/orders/lookup` (server cache primed) → customer `tracking:undefined` despite the tracking being present on disk.

---

## FIXED (verified)

All fixes are backend-first (no front-end change; the vulnerable `:orderNumber` route and the customer lookup are the only public touchpoints and their shapes are unchanged from the UI's perspective). Verified on a single clean server on `:3001` (1 listener, HTTP 200), then `database.json` restored byte-identical (md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes).

**BUG-F001 — public order IDOR/enumeration** (`server.js` `GET /api/orders/:orderNumber`): now requires an `email` query param matching the order's `customer_email` (same credential pair as `/api/orders/lookup`) and returns the same **reduced projection** (order number, status, items summary, pricing totals, shipping address, tracking) — no `customer_email`/`customer_phone`, no internal `manufacturer_cost_total`/margins. No front-end used this route.

**BUG-F002 / BUG-F003 — tracking now reaches the customer; shipping cost preserved** (`services/manufacturer-service.js` `addTrackingInfo`): tracking is written to the canonical `order.tracking` object (the field `/api/orders/lookup` reads), the numeric `order.shipping` **cost is left untouched**, order status is synced to `shipped` with a `status_history` entry (order-status-sync), and a `shipment_notification` is queued in `db.emailLogs`. The two admin/order-service readers (`getShippedOrdersPendingDelivery`) now prefer `order.tracking` with a legacy `order.shipping` fallback. `/api/orders/lookup` and the gated `:orderNumber` route defensively read `order.tracking` first, falling back to any legacy tracking object on `order.shipping`, and always report `pricing.shipping` as a number.

**BUG-F004 — shipment notification + admin fulfillment write path** (`server.js` `PUT /api/admin/orders/:id/status`): the admin can now attach `carrier`/`trackingNumber` (+ optional `trackingUrl`/`estimatedDelivery`) when marking an order shipped; it is stored on `order.tracking` (cost field untouched), and a `shipment_notification` audit entry is queued in `db.emailLogs` on the first transition to `shipped`. Mirrors the Stage-3 emailLogs pattern (queued, not sent — no SMTP wired locally).

**BUG-F005 — cross-module cache coherence at the ship path**: the admin ship route now calls `require('./services/db-loader').invalidateCache()` before `recordShippedProfit()` so the profit/ledger path re-reads the freshly-saved order instead of clobbering it; a new `invalidateServerDbCache()` helper is called after `addTrackingInfo` in the manufacturer tracking route so the customer lookup reads the fresh tracking immediately. (Broader unification of the two 30 s caches is a systemic data-layer change left for owner review — see notes.)

### Verification (single clean server on :3001, exactly 1 listener, HTTP 200)

```
F001  GET /api/orders/:orderNumber
      no email            → 400 "Order number and email are required"   (was 200 + full PII + mfr cost)
      wrong email         → 404
      correct email       → 200 reduced projection; leaks phone/email/mfr-cost = FALSE
F002/F003  manufacturer POST …/ORD-MKA9J78E/tracking {UPS,1Z999AA10123456784}
      customer /lookup    → tracking#=1Z999AA10123456784, carrier=UPS, status=shipped
      order.shipping (cost) preserved = 9.99 (number, not clobbered); disk order.tracking set
F004  admin PUT …/status {shipped, FedEx, 612345678901}
      customer /lookup    → tracking#=612345678901, carrier=FedEx
      db.emailLogs        → shipment_notification queued (to=customer_email, track# present)
F005  admin ship (disk after profit path): status=shipped, tracking#=612345678901 RETAINED,
      shipment_notification=1 AND ledger manufacturer_paid=1 (no lost write)
      manufacturer ship + immediate lookup with primed server cache → fresh tracking (no 30s staleness)
Regression:
      untracked order /lookup → 200, tracking:null
      manufacturer POST …/shipping {12.5} → success:true (cost route intact)
      manufacturer POST …/tracking without carrier → 400 "Carrier and tracking number required"
```

All prior reproductions (F001–F005) now behave correctly. Test records were transient (server writes); `database.json` restored to the pre-audit backup (byte-identical, md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes). Server left running (1 listener, 200).

## Pricing gaps
None — Stage 12 is fulfillment/tracking/notification; no pricing engine is invoked. Order pricing totals are read-only here (the manufacturer shipping-cost route recomputes `total = subtotal + tax + shippingCost`, which is pre-existing and unchanged). No fabric-code price lookups occur, so nothing to add to `pricing-gaps.md`.

## Notes / left pending (needs owner approval — out of scope for a safe backend fix)
- **Actual email delivery (12.2):** no SMTP/SendGrid provider is wired locally, so shipment notifications are logged as `status:"queued"` in `db.emailLogs` (honest audit trail), not sent. `emailService.sendShippingNotification()` (a full HTML template) exists but expects camelCase order fields (`customerEmail`/`orderNumber`) while orders are snake_case (`customer_email`/`order_number`); wiring it (with a field adapter) + a real provider is a follow-up.
- **Systemic cache unification (F005):** the fix invalidates caches at the two Stage-12 write paths. The root cause — `server.js` maintaining its own 30 s `dbCache` separate from `services/db-loader.js` — can cause lost/stale writes on **any** flow that mixes a server-level save with a service-level save in one request. Unifying them (server delegating to `db-loader`) is the correct architectural fix but touches every server route; routed to PK-K-4/PK-Y-5 for owner review.
- **Separate `db.shipments` + `services/shipping-service.js`:** the admin `POST /api/admin/shipping/shipments` / `POST /api/admin/tracking` stack stores richer shipment/event objects in a `db.shipments` collection that is **not** linked to `order.tracking` and not surfaced on the customer lookup. Consolidating that stack onto `order.tracking` (or linking by `orderId`) is a larger refactor deferred for owner review; the Stage-12 customer-visible path now works via `order.tracking`.
- **Status state machine:** `addTrackingInfo` now sets `status:"shipped"` on tracking add (guarded against terminal states). If the owner wants tracking-without-ship (e.g. label created but not handed off), a separate `fulfillmentStatus` should be introduced.
