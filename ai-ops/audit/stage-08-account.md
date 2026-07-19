# Stage 8 — Account & Authentication (Account Agent) — Audit + Fixes

> Section **D** of the recursive audit loop. Scope: customer-journey **Stage 8** — 8.1 create account / login, 8.2 save configurations & wishlist, 8.3 partner accounts (dealer/designer/realtor/affiliate). Reproduced against the running app on `http://localhost:3001` with sample data in `backend/database.json`. Native-first backend fixes, no front-end redesign. Test records created during the audit were removed and the DB restored byte-for-byte (pre-audit md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes).

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **8.1 Auth:** `POST /api/customer/register` (`server.js:17010`), `POST /api/customer/login` (`server.js:17122`), `customerAuthMiddleware` (`server.js:17197`). Sample customers in `db.customers` (13; e.g. `jane.doe@example.com` with a bcrypt hash; several checkout-created with `password:null`).
- **8.2 Saved data:** saved-quotes ("save configuration to account") — `POST /api/quotes/save`, `GET /api/quotes/my-quotes`, `GET /api/quotes/share/:shareCode`, `PUT /api/quotes/:id`, `POST /api/quotes/:id/{extend,convert}`, `DELETE /api/quotes/:id` (`server.js:16141-16297`), backed by `services/saved-quotes-service.js`. Customer account read paths `GET /api/customer/{account,orders,addresses}` + `POST /api/customer/addresses`. **Wishlist:** UI only ("Wishlist coming soon" toast on `product.html`; static empty section on `account.html`) — no backend.
- **8.3 Partner accounts:** `POST /api/dealer/login` (`server.js:9518`) + `dealerAuthMiddleware` (`server.js:9547`) + `services/dealer-service.js`; `manufacturerAuthMiddleware` (`9317`), `technicianAuthMiddleware` (`17464`). Sample `db.dealerUsers` (2: `john@abcwindows.com`, `sarah@premiumblinds.com`; password `dealer123`).
- **Designer / realtor / affiliate** partner roles named in the spec do **not** exist as accounts/portals in the running app (only dealer + manufacturer + technician). Logged as a spec gap below.

## What is already correct (verified, no change)
- **Password hashing:** customers `bcrypt.hash(...,10)` on register/change-password and `bcrypt.compare` on login; dealer users `bcrypt.compareSync`. No plaintext passwords stored or returned (login/register strip `password` before responding — verified `passwordLeaked:false`).
- **Cross-role isolation (the admin-RBAC fix holds for portals):** a customer token (`type:customer`, no `role`) is rejected by admin (`403`), dealer (`401`), manufacturer (`401`) and technician (`403`) middlewares; a dealer token (`role:dealer`) is rejected by `customerAuthMiddleware` (`403 Invalid token type`) and admin (`403`). Reproduced live.
- **Customer own-data scoping:** `GET /api/customer/{account,orders,addresses}` derive identity from `req.customer.id` (token), never a client-supplied id. Customer B cannot see Customer A's address (verified: B sees 0, A sees 1).
- **Dealer-to-dealer isolation:** every `dealer-service` lookup filters by `dealerId` from the token. Live: dealer *sarah* cannot list/update/delete dealer *john*'s customer by id (`400 Customer not found`); john's record stayed intact.
- **No privilege escalation via registration:** `type` is hard-coded `retail` and the JWT `type` is hard-coded `customer`; role/type are never taken from the request body.

---

## CONFIRMED defects

### BUG-AC001 — Saved configurations ("save to account") have NO authorization: any user can read, overwrite, or delete any customer's saved quote (Stage 8.2)  🔴
- **Routes:** `GET /api/quotes/my-quotes` (`server.js:16205`), `PUT /api/quotes/:id` (`16226`), `POST /api/quotes/:id/extend` (`16243`), `POST /api/quotes/:id/convert` (`16261`), `DELETE /api/quotes/:id` (`16285`) — all mounted with **no auth middleware and no ownership check**. Service: `saved-quotes-service.js` `getQuotesByEmail` / `updateQuote` / `deleteQuote`.
- **Severity:** **P1** · **Category:** Broken access control / IDOR (blueprint §15.1 "zero unauthorized cross-role/cross-customer access")
- **Justification (root cause):** Stage 8.2 = "save configurations to the customer account", which must be owner-scoped. These endpoints trust a client-supplied `?email=` (list) or `:id` (mutations) with no authentication. `getQuotesByEmail(email)` returns every active quote for that email; `updateQuote(id, req.body)` shallow-merges the **entire request body** into the stored quote, so an attacker can also rewrite `customerEmail`/`items`/`subtotal`/`status`/`shareCode` — hijacking or corrupting another customer's saved configuration. `deleteQuote(id)` soft-deletes any quote by id. (The `share/:shareCode` path is acceptable by design: `shareCode` is a 12-hex-char `crypto.randomBytes` capability token for deliberate sharing.)
- **Real-time example (reproduced, all unauthenticated):**
  - Victim saves a config: `POST /api/quotes/save {customerEmail:"victim.alice@test.com", customerName:"Alice Victim", customerPhone:"555-0001", subtotal:1234.56, ...}` → `sq-3fc50b94-…`.
  - `GET /api/quotes/my-quotes?email=victim.alice@test.com` (no token) → **200**, leaked `customerName:"Alice Victim"`, `customerPhone:"555-0001"`, `subtotal:1234.56`, shipping address.
  - `PUT /api/quotes/sq-3fc50b94-… {name:"HIJACKED", customerEmail:"attacker@evil.com", subtotal:0.01}` (no token) → **200**, quote's `customerEmail` now `attacker@evil.com`.
  - `DELETE /api/quotes/sq-3fc50b94-…` (no token) → **200 `{"success":true,"message":"Quote deleted"}`**.
  - Frontend only ever calls `POST /api/quotes/save` (product pages) and `GET /api/quotes/share/:shareCode` (`quote.html`); `my-quotes` and the `:id` mutations are unused by the UI, so gating them breaks no flow.

### BUG-AC002 — Customer login/register leak account existence (user enumeration) (Stage 8.1)  🟡
- **Routes:** `POST /api/customer/login` (`server.js:17122`), `POST /api/customer/register` (`17010`)
- **Severity:** **P3** · **Category:** Auth hardening / information disclosure
- **Justification:** login returns distinct messages — `"No account found with this email address"` (unknown email) vs `"Invalid password. Please try again."` (known email, wrong password) — letting an attacker enumerate which emails have accounts. It also skips `bcrypt.compare` entirely when the email is unknown, creating a timing side-channel to the same end. Register confirms existence with `"An account with this email already exists."`
- **Real-time example (reproduced):** `POST /api/customer/login {email:"alice.stage08@test.com", password:"wrongpass"}` → `"Invalid password. Please try again."`; `POST … {email:"nobody@test.com", …}` → `"No account found with this email address"`. The two responses distinguish a valid account from an invalid one.

---

## Spec gaps (documented, not auto-built — feature absent, needs owner approval)
- **8.2 Wishlist not implemented:** `product.html` shows a `Wishlist coming soon!` toast (no add action); `account.html` renders a static empty "My Wishlist" section (`statWishlist` hard-coded `0`); no `wishlist` field on customers and no backend endpoint anywhere. Save-to-account is only partially met by saved-quotes.
- **8.3 Missing partner roles:** the spec lists dealer / **designer** / **realtor** / **affiliate**. Only **dealer** exists (plus manufacturer + technician portals). Designer, realtor and affiliate accounts/portals are absent (consistent with the blueprint note that B2B Companies is Shopify-Plus-only and these are backend-owned — but they have not been built).

---

## FIXED (verified)

All fixes are backend-first in `backend/server.js`; no front-end change (the vulnerable quote endpoints were unused by the UI). Verified on a single clean server on `:3001` (1 listener, HTTP 200), then `database.json` restored byte-identical (md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes).

**BUG-AC001 — saved-quote authorization/IDOR:** added hoisted helpers `requireCustomerAuth` (verifies a `type:customer` JWT) and `customerOwnsQuote` (matches by `customerId` or case-insensitive `customerEmail`) just above the saved-quotes routes.
- `GET /api/quotes/my-quotes` now requires a customer token and lists by `req.customer.email` — the client-supplied `?email=` is ignored, closing the read-anyone IDOR.
- `PUT /api/quotes/:id`, `POST /:id/extend`, `POST /:id/convert`, `DELETE /:id` now require a customer token and a `customerOwnsQuote` check → `403` on non-owner, `404` on missing.
- `PUT` additionally strips `id/customerId/customerEmail/shareCode/status/createdAt` from the body so an owner's update can't reassign ownership, forge the share capability, or flip status.
- `POST /api/quotes/save` and `GET /api/quotes/share/:shareCode` intentionally left public (anonymous save; deliberate capability-token sharing).

```
V1 my-quotes NO auth                                   → 401  (was 200 + full PII leak)
V2 attacker(bob) my-quotes ?email=alice                → 200 count:0, no Alice leak (token email used)
V3 owner(alice) my-quotes ?email=whatever              → 200 returns her own "Alice Config"
V4 PUT /:id NO auth                                     → 401  (was 200 overwrite)
V5 attacker(bob) PUT alice's quote                      → 403 "Forbidden: not your quote"
V6 attacker(bob) DELETE alice's quote                  → 403 "Forbidden: not your quote"
V7 owner(alice) PUT own quote {customerEmail,status}    → 200; customerEmail & status UNCHANGED (stripped)
```

**BUG-AC002 — login user enumeration:** unknown-email and wrong-password now return the identical `"Invalid email or password"`; a dummy `bcrypt.compare` runs on the unknown-email path to remove the timing oracle.

```
unknown email        → 401 "Invalid email or password"
known email/wrong pw → 401 "Invalid email or password"   (indistinguishable)
valid login          → 200 success:true                  (no regression)
```

**Regression checks (post-fix, single clean server):** public `POST /api/quotes/save` → 200 with shareCode; public `GET /api/quotes/share/:code` → 200; dealer login `john@abcwindows.com` → 200. All green.

## Pricing gaps
None — Stage 8 is account/auth; no pricing engine is invoked. (Saved quotes store a `subtotal` computed upstream in Stage 6/7; not recomputed here.)

## Notes / left pending (needs owner approval — out of scope for a safe backend fix)
- **BUG-AC002 residual:** the checkout-created-account branch ("created through checkout… Forgot Password") still distinguishes that account class; register still returns "account already exists". Both are minor enumeration vectors kept for UX. A full fix (generic responses + async verification email) is a follow-up.
- **8.2 Wishlist:** unimplemented end-to-end (UI says "coming soon"). Building it (customer-metafield-style `wishlist` on the customer record + owner-scoped endpoints, mirroring the addresses pattern) is a feature, not a bug fix — deferred.
- **8.3 Designer / realtor / affiliate portals:** not built. Adding these partner account types + isolation is a feature track, deferred.
- **Anonymous saved quotes:** quotes saved with no `customerEmail`/`customerId` are now only reachable via their `shareCode` (by design); a logged-in customer cannot claim/mutate them by id. Associating a guest quote to an account on login is a possible enhancement.
