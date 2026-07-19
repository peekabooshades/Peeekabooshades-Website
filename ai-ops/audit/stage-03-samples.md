# Stage 3 — Order Free Samples (Sample Agent) — Audit + Fixes

> Section **B** of the recursive audit loop. Scope: customer-journey **Stage 3** tasks 3.1–3.4 (add fabric codes → capture shipping address & consent → create sample fulfillment → follow-up nudge). Reproduced against the running app on `http://localhost:3001` with sample data in `backend/database.json`. Native-first, no front-end redesign. Test records created during the audit were deleted afterward (DB restored byte-for-byte to its prior state, 1,321,123 bytes).

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- Public: `GET /api/fabrics` (290 fabrics: roller + zebra), `POST /api/sample-requests` (`server.js:4069`), frontend `frontend/public/samples.html`.
- Admin: `GET/PUT /api/admin/sample-inventory*` (`server.js:4110+`), `GET/PUT /api/admin/sample-requests*` (`server.js:4262+`).
- No Shopify sample product / draft order exists locally, so the journey doc's fallback owner (backend repo) owns Stage 3 here. Samples are **$0** — no pricing path, so **no pricing gaps** to log.

---

## CONFIRMED defects

### BUG-S001 — Sample request accepts unknown / junk / duplicate fabric codes (Stage 3.1)  🟠
- **Route:** `POST /api/sample-requests` (`server.js:4069`)
- **Severity:** **P2** · **Category:** Data integrity / input validation
- **Justification (root cause):** the handler stored `samples` verbatim (`samples,`) with only a length check. It never validated codes against the fabric catalog and never de-duplicated, so an operator picks/ships nonexistent swatches and a stored XSS string sits in admin data.
- **Real-time example (reproduced):** `POST … {"samples":["FAKE999","<script>alert(1)</script>","82032A","82032A"]}` → **200 `success:true`**, record stored the fake code, the `<script>` string, and the duplicate `82032A` unchanged.

### BUG-S002 — No shipping-consent captured (Stage 3.2)  🟠
- **Route:** `POST /api/sample-requests` + `samples.html` form
- **Severity:** **P2** · **Category:** Spec gap / compliance
- **Justification:** Stage 3.2 explicitly requires "capture shipping address **& consent**", and the `notification-send` skill sends the 3.4 nudge "respecting consent." The stored record had **no consent field** and the form had **no consent control** — so a lawful basis for the follow-up nudge can never be recorded.
- **Real-time example (reproduced):** after a submit, the stored record's `('consent' in r)` → **false**; the form (`samples.html`) had only name/email/phone/address inputs.

### BUG-S003 — No sample fulfillment / inventory never reserved (Stage 3.3)  🟠
- **Route:** `POST /api/sample-requests` vs `GET /api/admin/sample-inventory`
- **Severity:** **P2** · **Category:** Incomplete workflow / oversell risk
- **Justification:** the admin inventory model exposes a `reserved` field, but submitting a request never created a fulfillment and never touched `sampleInventory`. Requests could exceed physical stock with no signal; the "create sample fulfillment" task was effectively unimplemented.
- **Real-time example (reproduced):** inventory for `82032A` = `reserved:0`; after `POST` requesting `82032A`, admin inventory still showed `reserved:0`. No fulfillment object on the request.

### BUG-S004 — Confirmation email promised but never recorded/sent; no follow-up nudge (Stage 3.3/3.4)  🟡
- **Route:** `POST /api/sample-requests`; `samples.html` toast; `db.emailLogs`
- **Severity:** **P3** · **Category:** Missing notification / broken promise
- **Justification:** the UI shows "Sample request submitted! **Check your email for confirmation.**" but no notification was logged/sent (`emailLogs` stayed at 0) and there was no Stage 3.4 "ready to order?" nudge scheduled anywhere. The `notification-send` skill's audit-log step (§"Log delivery + consent for audit") was absent.
- **Real-time example (reproduced):** after a successful submit, `db.emailLogs.length` = **0**; no `followUp*` field on the request.

### BUG-S005 — Frontend fakes success on submit failure, hiding the error (Stage 3.1)  🟡
- **File:** `frontend/public/samples.html` submit `catch` (was: `// Even if API fails, show success (for demo)`)
- **Severity:** **P3** · **Category:** Silent failure / UX correctness
- **Justification:** on a network/parse failure the catch showed a **success** toast, cleared the cart, and reset the form — telling the customer their samples are on the way when nothing was submitted, with their selection wiped.
- **Real-time example:** with the API unreachable, submitting shows "Sample request submitted! We'll be in touch soon." and clears the basket, though no request reached the server.

### Also fixed as part of BUG-S002 hardening
- **Email format not validated:** `POST … {"email":"not-an-email", …}` was accepted (200) — an undeliverable contact for the confirmation/nudge. Now rejected.

---

## FIXED (verified)

All Stage-3 fixes are backend-first in `backend/server.js` (`POST /api/sample-requests`) plus two minimal, additive frontend changes (a single consent checkbox and an honest error path) — no redesign; branding/layout/spacing untouched.

**Backend (`server.js` `POST /api/sample-requests`):**
- Validate + normalize + de-dupe `samples`; reject any code not in the roller (`productContent.fabrics`) or zebra (`zebraFabrics`) catalog — **BUG-S001**.
- Validate email format — reject undeliverable contacts.
- Accept & store `consent` (marketing consent, default `false`) — **BUG-S002**.
- Create `fulfillment[]` and reserve one swatch per code in `sampleInventory` (`reserved += 1`, guarded by available = stock − reserved; else `backordered`) — **BUG-S003**.
- Queue a `sample_request_confirmation` entry in `emailLogs` and schedule a `followUpDue` (~14 days) with `followUpSent:false` — **BUG-S004**.

**Frontend (`samples.html`):** added one optional consent checkbox; send `consent`; the failure `catch` now shows an error and preserves the customer's selections — **BUG-S002 / BUG-S005**.

### Verification (single clean server on :3001, exactly 1 listener, HTTP 200)

```
V1 unknown code:   POST samples:["FAKE999","82032A"]           → 400 {"error":"Unknown fabric code(s): FAKE999"}
V2 bad email:      POST email:"not-an-email"                    → 400 {"error":"Invalid email address"}
V3 XSS code:       POST samples:["<script>alert(1)</script>"]   → 400 {"error":"Unknown fabric code(s): <script>…"}
V4 valid+consent:  POST samples:["82032A","82032A","82032B"] consent:true
                   → 200; samples de-duped to ["82032A","82032B"];
                     consent:true; fulfillment:[{82032A,fab-1000,reserved},{82032B,fab-1001,reserved}];
                     followUpDue set; followUpSent:false
V5 side effects:   emailLogs → 1 queued sample_request_confirmation (consent:true);
                     sampleInventory fab-1000 reserved 0 → 1
Admin:             GET /api/admin/sample-requests → record present with consent+fulfillment;
                     GET /api/admin/sample-inventory → 82032A reserved:1 available:49
```

All prior reproductions (S001–S005 + email) now behave correctly. Test records deleted; `database.json` restored to the pre-audit backup (byte-identical, 1,321,123 bytes). Server left running (1 listener, 200).

## Pricing gaps
None — free samples are $0; no pricing engine is invoked in Stage 3.

## Notes / left pending (needs owner approval — out of scope for a safe fix)
- **Actual email delivery:** no SMTP/SendGrid provider is wired locally, so the confirmation is logged as `status:"queued"` in `emailLogs` (honest audit trail), not sent. Wiring a real provider + a scheduler that sends the `followUpDue` nudge (respecting `consent`) is a follow-up.
- **Inventory release:** reservations are created on request but not released on cancel/reject. A future admin status transition (`rejected`/`cancelled`) should decrement `reserved`.
