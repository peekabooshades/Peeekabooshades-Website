# Stage 14 — Final Invoice & Balance (Checkout & Payment Agent) — Audit + Fixes

> Section **G** of the recursive audit loop. Scope: customer-journey **Stage 14** — 14.1 generate final/balance invoice, 14.2 collect balance, 14.3 reconcile payment status (plus Stage 9.3 deposit/balance). Reproduced against the running app on `http://localhost:3001` with sample data in `backend/database.json` (12 real orders, 9 customer invoices, 6 ledger entries). Native-first backend fixes, no front-end redesign. Test writes are transient (server/db-loader writes) and the DB is restored byte-for-byte (pre-audit md5 `670b313eccbf676f73162bb9341525bd`, 1,321,123 bytes).

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **14.1 Invoice generation:** `invoiceService.createInvoiceFromOrder(orderId, 'customer'|'manufacturer')` (`services/invoice-service.js:193`); admin `POST /api/admin/invoices` (`server.js:9117`), `GET /api/admin/invoices/:id` (`server.js:9100`, authed), public `GET /api/invoices/:id/print` (`server.js:9252`, **no auth**). Invoice auto-created at checkout (`server.js:1103`, `:1221`).
- **14.2 Collect balance / record payment:** `invoiceService.recordPayment` (`services/invoice-service.js:647`) via admin `POST /api/admin/invoices/:id/payment` (`server.js:9183`). Stripe/PayPal/demo processors in `routes/payment-routes.js`.
- **14.3 Reconcile payment status:** invoice status transitions in `recordPayment`; order status/profit in `PUT /api/admin/orders/:id/status` (`server.js:2247`) → `recordShippedProfit` (`services/ledger-service.js:196`); order ledger `GET /api/orders/:orderId/ledger` (`server.js:1285`, **no auth**); `validateOrderReceivedTransition` (`server.js:2172`) compares invoice total vs order total (0.01 tolerance).
- **Sample data facts:** every order's `order.pricing.total`/`tax` is stored **unrounded** (fractional-cent, e.g. `294.602375` / `22.452375`); invoices inherit those values verbatim. Only 2 of 12 orders carry a `payment` object; the invoice `status` therefore defaults to `draft` for the rest. There is **no deposit/balance data model** anywhere in the code or data.

## What is already correct (verified, no change)
- Admin invoice routes (`/api/admin/invoices*`) and admin ledger routes (`/api/admin/ledger*`) are role-gated by `authMiddleware` + `ADMIN_ROLES` (Stage-D RBAC fix, not re-litigated).
- Stripe/PayPal payment intents use idempotency keys (`routes/payment-routes.js:93-129, 152-183`) — no obvious double-charge on the processor path.
- `validateOrderReceivedTransition` blocks/flags an order→`order_received` transition when no invoice exists or invoice total ≠ order total (>0.01), giving a reconciliation guard at that milestone.

## Deposit / balance invoicing — documented gap (NOT a fix; no own assumptions)
Stage 14.1/9.3 and blueprint §12.5 describe a **deposit-then-balance** flow ("deposit/balance via draft-order invoices"), but §12.5 marks **deposit % & terms as `[CONFIRM]` (owner-unconfirmed)** and the code/data contain **no deposit, balance-due, or partial-invoice model** — checkout issues a single full-amount customer invoice. Per the no-own-assumptions rule I did **not** invent a deposit split. The fixes below make the single full invoice correct, secure, reconciled, and rounded. A true balance-invoice feature is gated on owner confirmation of deposit policy (routed to PK-N-8 / Decision Register C3).

---

## CONFIRMED defects

### BUG-G001 — Public `GET /api/orders/:orderId/ledger` leaks internal manufacturer cost + margin with no auth (Stage 14.3)  🔴
- **Route:** `GET /api/orders/:orderId/ledger` (`server.js:1285`) — **no middleware**; returns `getEntriesForOrder()` raw ledger rows.
- **Severity:** **P1** · **Category:** Broken access control / internal-financials leakage (blueprint §15.1 "manufacturers never see customer financials … margin is internal"; §15.1 "zero unauthorized cross-role access").
- **Root cause:** the per-order ledger is pure internal accounting — `manufacturer_payable` / `manufacturer_paid` amounts and `metadata.manufacturerCost` / `margin` / `marginPercent`. Every sibling ledger view (`/api/admin/ledger*`) is `authMiddleware`-gated, but this per-order route was left public. No front-end consumes it (grep of `frontend/public` finds only `/api/admin/ledger`), so gating breaks nothing.
- **Real-time example (reproduced, unauthenticated):** `GET /api/orders/972321be-f8ca-4066-981f-55b829fe5aa6/ledger` → **200** `{"type":"manufacturer_paid","amount":-171.66,"description":"Manufacturer payment for order ORD-MKEUZVG5",...}` — the store's internal manufacturer cost ($171.66) is exposed to any anonymous caller.

### BUG-G002 — Public `GET /api/invoices/:id/print` leaks manufacturer cost + margin into the customer-facing invoice, plus full PII, with no auth (IDOR) (Stage 14.1)  🔴
- **Route:** `GET /api/invoices/:id/print` (`server.js:9252`) — **no middleware**; `getInvoice()` matches by `id` **or** `invoiceNumber` and returns the entire invoice object.
- **Severity:** **P1** · **Category:** Manufacturer-cost/margin leak into customer invoice + IDOR/PII exposure (task focus; blueprint §15.1).
- **Root cause:** the customer invoice built by `createInvoiceFromOrder` embeds internal economics on every line item — `pricing.manufacturerCost`, `pricing.marginPercent`, `pricing.marginAmount`, and `optionsPricing.*.manufacturerCost` / `accessoriesPricing.*.manufacturerCost` / `optionsBreakdown[].manufacturerCost`. The admin print page (`admin/print-invoice.html`) deliberately renders "CUSTOMER PRICES ONLY", but the **API returns the raw object**, so anyone who fetches the endpoint gets margin + cost. The route is public and accepts the semi-enumerable `invoiceNumber` (`INV-<base36 Date.now()><rand>`), so it is also an IDOR over customer PII (name/email/phone/address).
- **Real-time example (reproduced, unauthenticated):** `GET /api/invoices/INV-MKEUZVGUNO0L/print` → **200**; leaked `customer.email:"surya@gmail.com"`, `customer.phone:"8169449009"`, `customer.address:"205 Blue Jasmine Trl, Georgetown, TX 78628, US"`, and line-item `pricing:{"marginPercent":40,"marginAmount":9.56,...}`. (Invoices whose items carry a manufacturer snapshot additionally leak `manufacturerCost`.)

### BUG-G003 — Invoices present unrounded fractional-cent money (rounding drift) (Stage 14.1)  🟠
- **Fn:** `createInvoiceFromOrder` (`services/invoice-service.js:369-426`) copies `order.pricing.subtotal/tax/shipping/total` verbatim and derives `amountPaid`/`amountDue` from them with **no currency rounding**.
- **Severity:** **P2** · **Category:** Invoicing correctness / pricing parity (blueprint §15 L2-pricing step 9 "round(currency)"; §4 "price identical across … order, invoice").
- **Root cause:** checkout stores unrounded pricing (`tax = subtotal * rate` un-rounded), and the invoice generator forwards it unchanged. Result: customer invoices with sub-cent totals. This is a Stage-14 surface defect regardless of the upstream cause — a customer-facing invoice must be in whole cents.
- **Real-time example (reproduced):** `INV-MKEUZVGUNO0L` → `total: 294.602375`, `amountDue: 294.602375`, `tax: 22.452375`. All 9 customer invoices exhibit fractional-cent values (e.g. `INV-MKJ50MDYIOBA total 91.44812499999999`).

### BUG-G004 — `recordPayment` accepts overpayment → negative balance, and never reconciles the order's payment status (Stage 14.2 / 14.3)  🟠
<!-- fixes applied + verified below; see "FIXES APPLIED" section -->

- **Fn:** `invoiceService.recordPayment` (`services/invoice-service.js:647-690`) via `POST /api/admin/invoices/:id/payment` (`server.js:9183`).
- **Severity:** **P2** · **Category:** Financial data integrity (negative/overstated balance) + missing reconciliation.
- **Root cause (two defects):** (1) `amountDue = invoice.total - invoice.amountPaid` with **no clamp or overpayment guard** — recording more than the balance drives `amountDue` negative while status flips to `paid` (money-in exceeds money-owed, unreconcilable). (2) Recording a payment updates only the invoice; the **order's `payment` / `financial_status` is never touched**, so "reconcile payment status" (14.3) does not happen — a fully-paid invoice leaves its order with no payment record.
- **Real-time example (reproduced, admin token):** `POST /api/admin/invoices/INV-MKA9J78SFIXB/payment {amount:200}` on a `94.8147` invoice → **200** `status:"paid", amountPaid:200, amountDue:-105.1853`. Then `GET /api/admin/orders/<orderId>` → `order.payment: undefined`, `financial_status: undefined` (order never reconciled). DB restored to baseline md5 afterward.

---

## FIXES APPLIED + VERIFIED (2026-07-19, native-first, no front-end redesign)

All four confirmed defects fixed in the working tree (`backend/server.js`, `backend/services/invoice-service.js`) and verified live against a clean `node server.js` restart on `:3001`.

| Bug | Fix (code) | Live verification |
|-----|-----------|-------------------|
| **G001** | `GET /api/orders/:orderId/ledger` now `authMiddleware`-gated (`server.js:1289`). No front-end consumes it, so gating breaks nothing. | no-auth → **HTTP 401**; admin token → **HTTP 200** ✅ |
| **G002** | `GET /api/invoices/:id/print` (`server.js:9256`) hardened: looks up by opaque UUID `id` only (kills invoiceNumber IDOR), serves **customer** invoices only (404 on manufacturer payables), and returns a customer-safe projection that strips `manufacturerCost`/`margin*`/`internalNotes` from invoice + every line item / option / accessory. | print returns `type:customer`; response scanned → **no `manufacturerCost`/`marginPercent`/`marginAmount`/`internalNotes`** ✅ |
| **G003** | Currency-round (`round2`) applied to all invoice monetary fields in `createInvoiceFromOrder` and the print projection. | invoice `total 732.53`, `tax 52.02`, `amountDue 682.53` — **no fractional-cent fields** ✅ |
| **G004** | `recordPayment` (`invoice-service.js`) rejects overpayment (`amount > outstanding + 0.01` → throws before any write), clamps `amountDue ≥ 0`, and mirrors payment state onto the order (`financial_status`, `order.payment`) so 14.3 reconciliation happens. | `POST …/payment {amount:999999}` on a `732.53` invoice → **HTTP 400** "Payment ($999999.00) exceeds balance due ($732.53)"; invoice unchanged afterward (`amountPaid:0`, `payments:0`) — **no DB mutation** ✅ |

**Deposit/balance flow (14.1/9.3):** unchanged and documented as owner-gated — code has no deposit/partial-invoice model and blueprint §12.5 marks deposit % as `[CONFIRM]`. No own assumption made.

**Not committed:** working tree also has unrelated changes (`frontend/public/product.html` theme port, `database.json` drift) that must NOT be bundled into a Stage-14 commit — scope any commit to `server.js` + `invoice-service.js` + these ai-ops docs.
