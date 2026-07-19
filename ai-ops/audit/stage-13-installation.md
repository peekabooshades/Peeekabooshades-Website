# Stage 13 — Installation (Installation + Notification) — Audit + Fixes

> Section **F** of the recursive audit loop. Scope: customer-journey **Stage 13** — 13.1 assign installer to job, 13.2 schedule appointment, 13.3 before/after photos + completion checklist + signature, 13.4 mark installation complete → customer acceptance. The installer role in code is **technician** (`technicianAuthMiddleware`, `/api/technician/*`, role `technician`). Reproduced against the running app on `http://localhost:3001` with sample data in `backend/database.json` (1 seeded technician, 2 appointments, 12 orders, 13 customers). Native-first backend fixes, no front-end redesign. Test records created during the audit are transient and the DB is restored byte-for-byte (pre-audit md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes).

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **13.1 Assign installer:** admin `POST /api/admin/appointments` (`server.js:17811`) — creates an appointment with `technicianId`, links the order (`order.appointmentId`, `order.installationScheduled=true`). Public `POST /api/appointments/book` (`server.js:18423`) auto-assigns the first available active technician.
- **13.2 Schedule appointment:** same two routes set `scheduledDate`/`scheduledTime`. Admin `GET /api/admin/technicians/available` (`server.js:18372`) and public `GET /api/technicians/available` (`server.js:18399`) surface availability.
- **13.3/13.4 Completion:** technician `PUT /api/technician/appointments/:id/status` (`server.js:18175`) records completion; `POST /api/technician/record-payment` (`server.js:18243`); `GET /api/technician/appointments` (`server.js:18138`) + `GET /api/technician/dashboard` (`server.js:18101`). Public `GET /api/appointments/:id/status` (`server.js:18508`).
- **Auth:** `technicianAuthMiddleware` (`server.js:17622`) — JWT, role `technician`, 7-day expiry.

## What is already correct (verified, no change)
- **Authorization isolation holds — no IDOR (the highest-value check).** With two live test technicians (Alice, Bob), each assigned one appointment:
  - `GET /api/technician/appointments` (Alice) → returns **only** Alice's appointment (`count=1`); the list is filtered by `a.technicianId === req.technician.id`, not by a client-supplied id.
  - `PUT /api/technician/appointments/{Bob's id}/status` (Alice's token) → **403 "Not authorized"** (ownership guard at `server.js:18184`).
  - `POST /api/technician/record-payment {appointmentId: Bob's id}` (Alice's token) → **403 "Not authorized"** (ownership guard at `server.js:18253`).
  - There is no `GET /api/technician/appointments/:id` single-record route, so no read-IDOR by id substitution. Installers see only assigned jobs, per blueprint §744.
- Admin technician/appointment routes are `authMiddleware`-gated (RBAC pass, not re-litigated).

---

## CONFIRMED defects

### BUG-I001 — Marking an installation `completed` never reaches the order: no status sync, no customer acceptance, no notification (Stage 13.4)  🟠
- **Route:** `PUT /api/technician/appointments/:id/status` (`server.js:18175`).
- **Severity:** **P2** · **Category:** Broken workflow / missing order-status-sync (blueprint §12.7 "…signature → acceptance → balance invoice"; skill `order-status-sync` step 3–4 "update authoritative store; emit notification + audit record").
- **Justification (root cause):** the route mutates only the `appointment` record. When `status:"completed"`, nothing propagates to the linked `order`: no order status field, no `customerAcceptance`, no `status_history` entry, and no `emailLogs` audit/notification. Stage 14 (balance invoice) and the customer-acceptance step have **no signal** the job is done — the order still looks un-installed. Mirrors the Stage-12 BUG-F004 gap (dead notification path) but at the installation-completion milestone.
- **Real-time example (reproduced):** admin creates appt `apt-63d48438` for order `972321be…` (`ORD-MKEUZVG5`); technician `PUT …/apt-63d48438/status {status:"completed", ...}` → **200**. Post-call on disk: `order.status` **still `shipped`**, `order.installationComplete=undefined`, `order.customerAcceptance=undefined`, `db.emailLogs.length=0`.

### BUG-I002 — Completion record silently drops the signature, before-photos, and checklist (Stage 13.3)  🟠
- **Route:** `PUT /api/technician/appointments/:id/status` (`server.js:18188`).
- **Severity:** **P2** · **Category:** Data loss / false success (blueprint §12.7 requires "photos, checklist, signature"; §565 "installer …photos/checklist/signature").
- **Justification (root cause):** the handler destructures only `{ status, completionNotes, photos }` and persists `completionPhotos` from `photos`. The `signature`, `beforePhotos`, and `checklist` fields — three of the four deliverables the spec names for 13.3 — are **discarded**, while the API returns `success:true` (false success). The installation record is therefore never captured; only a single flat `completionPhotos` array survives, with no before/after distinction.
- **Real-time example (reproduced):** technician `PUT …/apt-63d48438/status {status:"completed", photos:["after1.jpg"], beforePhotos:["before1.jpg"], signature:"data:image/png;base64,SIG", checklist:[{item:"mounted",done:true}]}` → **200**. Persisted appointment: `signature=undefined`, `beforePhotos=undefined`, `checklist=undefined` (only `completionPhotos:["after1.jpg"]` kept).

### BUG-I003 — Installer assignment / scheduling emits no customer notification (Stage 13.1 / 13.2)  🟡
- **Routes:** admin `POST /api/admin/appointments` (`server.js:17811`); public `POST /api/appointments/book` (`server.js:18423`).
- **Severity:** **P3** · **Category:** Missing notification (skill `notification-send`; journey 13.2 "Backend + customer notification"). Mirrors Stage-12 BUG-F004 / Stage-3 BUG-S004.
- **Justification (root cause):** assignment links the order (`installationScheduled=true`, `appointmentId`) but no `emailLogs` record is queued, so the customer is never told an installer/date was assigned and there is no audit trail of a scheduling notice. `db.emailLogs` stays at 0.
- **Real-time example (reproduced):** admin `POST /api/admin/appointments {orderId, technicianId, scheduledDate:"2026-08-01", ...}` → **200**, `order.installationScheduled=true`, `order.appointmentId=apt-63d48438`, but `db.emailLogs.length=0` (no `appointment_scheduled_notification`).

### BUG-I004 — Deactivated or deleted technician keeps full portal access for up to 7 days (Stage 13, access control)  🟠
- **Route/fn:** `technicianAuthMiddleware` (`server.js:17622`).
- **Severity:** **P2** · **Category:** Broken access control (blueprint §15.1 least-privilege; "installers see only assigned jobs" implies only *active* installers).
- **Justification (root cause):** the middleware verifies only the JWT signature and `decoded.role === 'technician'`; it never reloads the technician record. A technician the admin **deactivates** (`status:"inactive"`) or **deletes** still holds a valid 7-day JWT and retains full portal access — dashboard, assigned appointments (including customer name/email/phone), availability, and payment recording — until the token naturally expires. Login enforces `status` checks, but nothing revokes an already-issued session.
- **Real-time example (reproduced):** admin `PUT /api/admin/technicians/{Alice} {status:"inactive"}` → Alice's existing token → `GET /api/technician/dashboard` **200**. Admin `DELETE /api/admin/technicians/{Alice}` → same token → `GET /api/technician/dashboard` **200** and `GET /api/technician/appointments` **200** (still returns the assigned appointment with customer PII).

### BUG-I005 — Technician can set an appointment to any arbitrary status; no state-machine validation (Stage 13.4)  🟡
- **Route:** `PUT /api/technician/appointments/:id/status` (`server.js:18188`).
- **Severity:** **P3** · **Category:** Missing validation (skill `order-status-sync` step 2 "validate the transition against the state machine — reject invalid").
- **Justification (root cause):** the handler assigns `status` directly from the body with no allow-list. Any string is accepted and persisted, corrupting the appointment state (dashboards bucket by `scheduled`/`confirmed`/`completed`, so a bogus value silently disappears from every count).
- **Real-time example (reproduced):** technician `PUT …/apt-63d48438/status {status:"banana"}` → **200**, appointment persisted with `status:"banana"`.

## Notes (low severity, not fixed)
- **Public `GET /api/appointments/:id/status`** returns limited fields (status, date, time, type, `technicianName`) for any appointment id with no auth. IDs are `apt-` + 8 hex chars of a uuid (~4.3B space, not enumerable) and no financial/address PII is exposed, so this is **P4**; left as-is (parallels the customer order-status page pattern). Noted for owner awareness only.

---

## FIXED (verified)

All fixes are backend-first (no front-end change; request/response shapes are unchanged from the portal's perspective — the fixes only add fields and enforce checks). Verified on a single clean server on `:3001` (1 listener, HTTP 200), then `database.json` restored byte-identical (md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes).

**BUG-I001 — completion now syncs the order + records acceptance + queues notification** (`server.js` `PUT /api/technician/appointments/:id/status`): on the first transition to `completed` for an appointment with a linked order, the order now gets `installationStatus:"completed"`, `installationComplete:true`, `installationCompletedAt`, a `customerAcceptance` object (`accepted`/`signature`/`acceptedAt`/`appointmentId`/`technicianId`), and an `installation_completed` `status_history` entry (order-status-sync). An `installation_complete_notification` is queued in `db.emailLogs` (notification-send). The main `order.status` fulfillment string is intentionally left untouched — the order enum (`server.js:2259`) has no "installed" state, so a dedicated installation status field is used (spec 13.4 "Backend status → order **metafield**"); promoting `order.status` to `closed`/`delivered` on acceptance is left for owner review to avoid disturbing profit/ledger/dashboard paths.

**BUG-I002 — full installation record now persisted** (same route): `beforePhotos`, after-photos (`afterPhotos` or legacy `photos` → `completionPhotos`), `signature`, and `checklist` are all stored on the appointment instead of being dropped.

**BUG-I003 — scheduling notification** (`server.js` `POST /api/admin/appointments` and public `POST /api/appointments/book`): both paths now queue an `appointment_scheduled_notification` in `db.emailLogs` (to the customer email, with the scheduled date/time in the subject). Mirrors the Stage-12 emailLogs pattern (queued, not sent — no SMTP wired locally).

**BUG-I004 — technician session revocation** (`server.js` `technicianAuthMiddleware`): after JWT verification the middleware now reloads the technician by id and returns **401** if the account no longer exists, **403** if its status is not `active`. Deactivating or deleting a technician now revokes access immediately instead of after the 7-day token expiry.

**BUG-I005 — appointment state-machine validation** (same status route): the technician status update now rejects any value outside `['scheduled','confirmed','in-progress','completed','cancelled','no-show']` with **400**.

### Verification (single clean server on :3001, exactly 1 listener, HTTP 200)

```
I003  admin POST /api/admin/appointments {order, tech, 2026-08-01 10:00}
      db.emailLogs appointment_scheduled_notification = 1 (to=surya@gmail.com, subject has date/time)
I005  technician PUT …/status {status:"banana"}  → 400 "Invalid status" + allowedStatuses
I002  technician PUT …/status {completed, photos, beforePhotos, signature, checklist}
      appt persisted: signature=[present], beforePhotos=["before1.jpg"],
      completionPhotos=["after1.jpg"], checklist=[{item:"mounted",done:true}]
I001  same call → order.installationStatus=completed, installationComplete=true,
      customerAcceptance.accepted=true, status_history last=installation_completed,
      db.emailLogs installation_complete_notification = 1
AUTHZ Alice token → PUT Bob's appt status → 403 (isolation still holds)
I004  admin deactivate Alice → Alice token dashboard → 403
      admin delete Alice    → Alice token dashboard → 401, appointments → 401
```

All prior reproductions (I001–I005) now behave correctly and the authorization-isolation guarantee is unchanged. Test technicians/appointments were transient server writes; `database.json` restored to the pre-audit backup (byte-identical, md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes). Server left running (1 listener, 200).

## Pricing gaps
None — Stage 13 is installer assignment / scheduling / completion. No pricing engine is invoked. `installationFee` and `record-payment` amounts are operator-supplied inputs (not derived from a fabric-code price table), so nothing is added to `pricing-gaps.md`.

## Notes / left pending (needs owner approval — out of scope for a safe backend fix)
- **Actual email delivery (13.2 / 13.4):** no SMTP/SendGrid provider is wired locally, so scheduling and completion notifications are queued as `status:"queued"` in `db.emailLogs` (honest audit trail), not sent. Wiring a provider + a snake_case↔camelCase order-field adapter is a follow-up (same posture as Stage-12 BUG-F004).
- **Promoting `order.status` on acceptance:** installation completion is recorded on a dedicated `order.installationStatus`/`customerAcceptance` field rather than mutating the fulfillment `order.status` (no "installed" value exists in the order enum). If the owner wants Stage 14 (balance invoice) to key off the main order status, add an explicit `installed`/`closed` transition to the order state machine and wire it here.
- **Public `GET /api/appointments/:id/status`** (P4, unchanged): limited non-financial fields on hard-to-enumerate uuid ids; left as-is for owner awareness.
