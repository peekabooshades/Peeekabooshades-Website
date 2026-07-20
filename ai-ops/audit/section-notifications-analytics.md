# Section J — Notifications & Analytics (cross-cutting) — Audit

> Section **J** of the recursive audit loop (Enterprise Blueprint, controlled-parallel mode). Scope: the two **cross-cutting** agents — **Notification Agent** (every milestone email/SMS: order placed, paid, in-production, shipped, delivered, installed, warranty; template presence; consent gating) and **Analytics Agent** (event capture, attribution, dashboards: real vs stubbed). Reproduced **read-only** with GET against the running app on `http://localhost:3001` and by reading `backend/` + `frontend/public/` source. No POST/PUT/DELETE issued, `database.json` untouched, server not restarted. Native-Shopify-first fixes, recommendation-only, no front-end redesign.

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure · P3 partial feature / usability · P4 cosmetic.

## Surface audited

**Notification path**
- Milestone senders: `services/email-service.js` (SendGrid, templates `sendOrderConfirmation` :146, `sendShippingNotification` :188, `sendPasswordReset` :226, `sendWarrantyUpdate` :259) and `services/sms-service.js` (Twilio, templates `sendOrderConfirmation` :149, `sendShippingNotification` :157, `sendDeliveryNotification` :165, `sendAppointmentReminder` :173, `sendQuoteReady` :183). `services/notification-service.js` is Slack/webhook **admin alerts only** (not customer milestones).
- Milestone trigger points: order create `POST /api/orders` (`server.js:953`), `POST /api/checkout` (`server.js:1189`), order state machine `POST /api/orders/:orderId/transition` (`server.js:1299`) → `order-service.transitionOrderStatus` (`services/order-service.js:370`), admin status `PUT /api/admin/orders/:id/status` (`server.js:2251`), manufacturer status/tracking (`server.js:9544`, `:9561`) → `manufacturer-service.updateOrderStatus`/`addTrackingInfo` (`services/manufacturer-service.js:253,323`), installations (`server.js:14859`, `:14881`), sample request (`server.js:4185`), payment webhooks (`routes/payment-routes.js`).
- Consent: `notification-send` skill mandates "check consent/suppression"; sample flow captures `consent` (`server.js:4249`).

**Analytics path**
- Two capture endpoints/stores: `/api/analytics/event` (`server.js:7469`) + `/api/analytics/track` (`server.js:8532`) → `db.analytics`; `/api/v1/analytics/track` (`server.js:7779`) + `analyticsService.trackOrderCompletion` (`services/analytics-service.js:82`) → `db.analyticsEvents`.
- Dashboards: `analyticsService` family (`/api/admin/analytics/{widgets,funnel,revenue,realtime,sales-by-category}`) reads **`db.analyticsEvents`**; legacy family (`/api/admin/analytics/{dashboard,sales,products,fabrics,traffic,*-insights}`) reads **`db.analytics`**.
- Storefront: `frontend/public/js/app.js` `trackEvent()` (:290) posts to `/api/analytics/event`; GA4 snippet on `faqs/page/blog/contact.html`.
- **Live DB facts (read via GET/DB read):** `db.analytics` = **1107** events, `db.analyticsEvents` = **38** (checkout_completed 33, purchase 2, page_view 1, product_view 1, add_to_cart 1). `emailLogs = 0`, `smsLogs = 0`, `notificationLogs = 0` across the 12 existing orders. Email provider reports `sendgrid / configured:true`; SMS `dev_log / configured:false`.

## What is already correct (verified, no change)
- Real, well-branded transactional templates exist for order confirmation and shipping in **both** email and SMS services (correct from/subject, tracking link, no gratuitous PII beyond name/order).
- Warranty **claim** notifications are genuinely wired end-to-end: claim received → `emailService.send` (`server.js:14552`) and claim status change → `emailService.sendWarrantyUpdate` (`server.js:14664`).
- Admin-triggered batch emails call the real sender: abandoned-cart recovery (`server.js:18929`) and scheduled reports (`server.js:19176`) invoke `emailService.send`.
- Email/SMS services degrade safely to `dev_log` and log every attempt to `emailLogs`/`smsLogs`; SMS masks the from-number in status output (`sms-service.js:196`).
- Analytics **dashboard aggregations read real data** (orders + event arrays), not hardcoded stubs — `getDashboardWidgets`/`getSalesByCategory`/insights all compute from `db.orders`/`db.analytics`/`db.analyticsEvents`. (The defect is *which* store they read and *what* was captured, not fabricated numbers.)

---

## CONFIRMED defects

### BUG-J001 — Order-placed / order-confirmation milestone sends NO email or SMS (Stage 9.5 / 10.1)  🟠
- **Trigger points:** `POST /api/orders` (`server.js:953-1121`) and `POST /api/checkout` (`server.js:1189-1269`) create the order + auto-invoice but never call any notifier. `grep` shows `emailService.sendOrderConfirmation` / `smsService.sendOrderConfirmation` are **defined but called from 0 sites**.
- **Severity:** **P2** · **Category:** Missing milestone notification (customer never confirmed).
- **Root cause:** the confirmation templates were built (`email-service.js:146`, `sms-service.js:149`) but never wired to the order-creation handlers; checkout tracks analytics (`analyticsService.trackOrderCompletion`, `server.js:1216`) yet skips notification. The customer-journey Stage 9.5 ("Order confirmation → `notification-send`") is unimplemented.
- **Real example (reproduced):** DB holds **12 orders / 9 invoices** but `emailLogs = 0` and `smsLogs = 0` — i.e. not a single order-confirmation has ever been produced. A new checkout returns `success:true` with no notification record created.

### BUG-J002 — Shipped-milestone notification is written as a `status:"queued"` record but never dispatched — dead-letter queue with no consumer (Stage 12.2)  🟠
- **Trigger points:** admin `PUT /api/admin/orders/:id/status` on `shipped` (`server.js:2339-2354`) and manufacturer `addTrackingInfo` (`services/manufacturer-service.js:369-382`) both `db.emailLogs.push({type:'shipment_notification', status:'queued', ...})`.
- **Severity:** **P2** · **Category:** Placeholder sender / notification never delivered.
- **Root cause:** the code comment states *"No SMTP is wired locally, so it is queued, not sent"* — but the email provider is in fact configured (`GET /api/admin/email/status` → `provider:"sendgrid", configured:true`). The shipped path enqueues an audit row and calls neither `emailService.sendShippingNotification` nor `smsService.sendShippingNotification`, and **no process anywhere drains `emailLogs` where `status==='queued'`** (`grep` for a queue processor / cron / `setInterval` over `emailLogs` finds none). The queued record is a permanent dead letter.
- **Real example (reproduced):** `sendShippingNotification` (email + SMS) has 0 call sites; `emailLogs = 0` in the live DB, so even the queued rows have never been produced by real traffic, and there is no drainer to send them if they were.

### BUG-J003 — Analytics is split across two disjoint stores; the modern funnel/widgets dashboards read the near-empty one, producing absurd conversion numbers (cross-cutting: dashboards)  🟠
- **Code:** storefront posts browsing events to `/api/analytics/event` → `db.analytics` (`server.js:7469-7492`); the funnel/widgets dashboards read `db.analyticsEvents` (`services/analytics-service.js:104,150,295`), which is fed only by `/api/v1/analytics/track` (not called by the storefront) and server-side `trackOrderCompletion`.
- **Severity:** **P2** · **Category:** Dashboard correctness / data-quality (two systems for one source of truth).
- **Root cause:** two parallel analytics subsystems were built and never reconciled. Real storefront traffic accumulates in `db.analytics` (1107 events) while the newer `analyticsService` dashboards read `db.analyticsEvents` (38 events, almost all server-side checkout events). The funnel therefore divides ~all-checkouts by ~1 pageview.
- **Real example (reproduced, admin token):** `GET /api/admin/analytics/funnel` → `pageViews:1, checkoutStarted:0, checkoutCompleted:33, overallConversionRate:"3300.00", conversionRate:0`. Simultaneously `GET /api/admin/analytics/traffic` (reads `db.analytics`) → `direct:1104, google:1, facebook:1, organic:1`. Two dashboards, two universes, one impossible 3300% conversion rate.

### BUG-J004 — No marketing/campaign attribution is captured; UTM & referrer are dropped on the storefront event path (Stage 0.3)  🟠
- **Code:** `frontend/public/js/app.js:290-318` `trackEvent` posts `{type,sessionId,productId,productName,fabricCode,value,quantity,page,metadata}` — **no `utm_*`, no `referrer`, no partner code**. The receiving `/api/analytics/event` (`server.js:7469`) destructures only `{type,sessionId,productId,value,source,page}` — so even if UTM were sent it would be discarded. The one endpoint that *does* parse UTM (`/api/analytics/track`, `server.js:8543-8546`) is **not called by the storefront**.
- **Severity:** **P2** · **Category:** Attribution not captured (blueprint Stage 0.3 "attribute the visitor to a source: ad/referral/dealer/designer/realtor/affiliate").
- **Root cause:** the storefront was wired to the coarse `/event` endpoint that has no attribution schema; the attribution-capable `/track` endpoint is orphaned. The Analytics Agent's mandate ("maintain attribution: source/campaign/partner code") has no capture surface.
- **Real example (reproduced, DB read):** all **1107** `db.analytics` rows carry keys `[createdAt,id,page,productId,sessionId,source,type,value]` only — `utm_campaign`/`utm_source`/`referrer` present in **0** of 1107. Channel is at best a bare `source` string; campaign/partner attribution is unrecoverable.

### BUG-J005 — "Paid" milestone (payment success) triggers no customer notification (Stage 9.3 / 10)  🟡
- **Trigger points:** Stripe/PayPal webhooks (`routes/payment-routes.js`) and `simulateFakePayment` (fake-payment checkout, `server.js:1207`). `grep` of `routes/payment-routes.js` for `emailService|smsService|sendOrderConfirmation` → **NONE**; payment-success handlers only `notificationService.sendSlack` admin alerts (dispute path, `payment-routes.js:643`).
- **Severity:** **P3** · **Category:** Missing milestone notification.
- **Root cause:** payment confirmation was treated as an internal/admin event (Slack) with no customer-facing receipt; the "payment received" state is not bound to any customer notifier.
- **Real example (reproduced):** payment webhook processing writes order financial fields and logs a webhook event, but produces no `emailLogs`/`smsLogs` row — consistent with the live `emailLogs = 0`.

### BUG-J006 — In-production / manufacturing / QA milestones send no notification (Stage 11.2)  🟡
- **Trigger points:** `POST /api/manufacturer/orders/:orderId/status` (`server.js:9544`) → `manufacturer-service.updateOrderStatus` (`services/manufacturer-service.js:253`); admin status transitions to `manufacturing`/`in_manufacturing`/`qa`/`in_testing` (`server.js:2251`). No notifier import exists in `manufacturer-service.js` (`grep` confirms no `emailService`/`smsService`).
- **Severity:** **P3** · **Category:** Missing milestone notification.
- **Root cause:** production/QA status changes update order state + status history only; the customer-journey Stage 11.2 ("production status + QA milestones → `notification-send`") is not implemented.
- **Real example (reproduced):** only the `shipped` transition writes any notification artifact (the queued row of BUG-J002); `manufacturing`, `qa`, `order_received`, `delivered` write **nothing** to `emailLogs` (verified: transition code at `server.js:2306-2354` gates every notification artifact behind `status === 'shipped'`).

### BUG-J007 — Delivered milestone sends no notification; delivery SMS template is orphaned (Stage 12 / 15.1)  🟡
- **Trigger points:** admin status → `delivered` (`server.js:2251`) and `POST /api/admin/orders/auto-delivery` (`server.js:2412`) → `order-service.autoDeliveryUpdate`. `smsService.sendDeliveryNotification` (`sms-service.js:165`) has **0 call sites**.
- **Severity:** **P3** · **Category:** Missing milestone notification / dead template.
- **Root cause:** the delivered state is a pure status write; the built delivery template was never wired. Post-purchase flow (warranty registration prompt, review request) therefore never begins.
- **Real example (reproduced):** the auto-delivery endpoint flips status in bulk with no notification artifact produced; `sendDeliveryNotification` unreferenced anywhere in `server.js`/`services`.

### BUG-J008 — Installation scheduled / completed milestones send no notification (Stage 13.2 / 13.4)  🟡
- **Trigger points:** `POST /api/admin/installations` (`server.js:14859`) and `PUT /api/admin/installations/:id` (`server.js:14881`) — plain DB writes, no notifier. `smsService.sendAppointmentReminder` (`sms-service.js:173`) has **0 call sites**.
- **Severity:** **P3** · **Category:** Missing milestone notification / dead template.
- **Root cause:** installation records are created/updated without any customer-facing schedule confirmation or completion notice; Stage 13.2/13.4 ("schedule appointment → notify", "mark complete → notify") unimplemented.
- **Real example (reproduced):** creating/updating an installation returns `{success:true, installation}` with no email/SMS artifact; the appointment-reminder template is unreachable.

### BUG-J009 — Sample follow-up nudge, review request, and warranty-registration notifications are queued/scheduled but never sent (Stage 3.4 / 15.1 / 15.2)  🟡
- **Trigger points:** sample request writes `type:'sample_request_confirmation', status:'queued'` and schedules a `followUpDue` nudge with `followUpSent:false` (`server.js:4239-4269`); no code path ever flips `followUpSent` or dispatches the confirmation (`grep followUpSent` → single write site, no reader). No review-request or warranty-registration sender exists.
- **Severity:** **P3** · **Category:** Placeholder / not connected (dead queue + unscheduled marketing).
- **Root cause:** same dead-letter pattern as BUG-J002 — records are enqueued but nothing consumes them, and there is no scheduler to fire the 14-day "ready to order?" nudge (Stage 3.4) or the post-delivery review request (Stage 15.2).
- **Real example (reproduced):** `sampleRequests = 0` and `emailLogs = 0` in the live DB; even after a sample request the confirmation would remain `status:'queued'` forever (no drainer, verified by absence of any queue processor).

### BUG-J010 — Send path performs no consent / suppression check (compliance)  🟡
- **Code:** `emailService.send` (`email-service.js:52-112`) and `smsService.send` (`sms-service.js:52-100`) dispatch unconditionally — no consent lookup, no suppression/unsubscribe list. The sample flow records `consent` (`server.js:4249`) but nothing reads it before sending.
- **Severity:** **P3** · **Category:** Consent gating missing (`notification-send` skill step 1: "Check consent/suppression; select template").
- **Root cause:** consent is captured in one place and never enforced; there is no suppression list model anywhere (`grep` for `suppress|unsubscrib|optOut` finds only the sample `consent` field). Transactional mail is defensible without opt-in, but the marketing sends (Stage 3.4 nudge, Stage 15.2 review request) would fire regardless of consent once wired.
- **Real example (reproduced):** `grep -i "consent|suppress|unsubscrib|opt.?out"` across `email-service.js`/`sms-service.js`/`notification-service.js` → **0 matches**; the only `consent` reference in the codebase is the sample-request write.

### BUG-J011 — GA4 is an unconfigured placeholder and is absent from the conversion pages (Stage 0.3 / attribution)  🟡
- **Code:** `frontend/public/{faqs,page,blog,contact}.html` embed `gtag/js?id=G-XXXXXXXXXX` and `gtag('config','G-XXXXXXXXXX')` — a literal placeholder measurement ID. `index.html`, `product.html`, `cart.html` contain **0** gtag references; `checkout.html`/`order-confirmation.html` do not exist as those filenames.
- **Severity:** **P3** · **Category:** Analytics not collecting / attribution gap.
- **Root cause:** GA4 was stubbed on informational pages with a placeholder ID and never installed on Home, Product, Cart or checkout — so even after a real ID is set, GA4 cannot observe the browse→cart→purchase funnel or attribute purchases.
- **Real example (reproduced):** `grep -c "gtag(" index.html product.html cart.html` → `0/0/0`; the only GA-bearing pages are non-conversion (faqs/blog/contact/page), all pointing at `G-XXXXXXXXXX`.

### BUG-J012 — `checkout_started` funnel stage is never emitted → checkout/conversion rates permanently 0 (dashboard correctness)  🟡
- **Code:** the funnel counts `EVENT_TYPES.CHECKOUT_STARTED` (`analytics-service.js:120`) and derives `checkoutRate`/`conversionRate` from it, but **no code anywhere emits a `checkout_started` / `checkout_start` event** (`grep` across `backend` + `frontend/public/js` finds only the enum definition and a comment). The storefront fires only `page_view` and `add_to_cart` (`app.js:322,326`).
- **Severity:** **P3** · **Category:** Data-quality / dashboard correctness.
- **Root cause:** the checkout-start instrumentation was specified in the schema but never wired on the client, so the funnel's middle stage is structurally empty and the derived rates are meaningless.
- **Real example (reproduced):** `GET /api/admin/analytics/funnel` → `checkoutStarted:0, checkoutRate:"0.00", conversionRate:0` while `checkoutCompleted:33` — mathematically impossible (33 completions from 0 starts), a direct consequence of the missing event.

---

## PROPOSED FIXES (native-first, recommendation-only — require owner approval)

- **J001 / J005 (order + paid confirmation):** call the existing `emailService.sendOrderConfirmation(order)` and, when a phone + consent are present, `smsService.sendOrderConfirmation(order, phone)` from the single order-creation choke point (`order-service.createOrderFromCart` / after `POST /api/orders` + `/api/checkout`), and from the payment-success path. **Native-first:** in a real Shopify deployment the order-confirmation + payment receipt are Shopify's built-in Order Confirmation notification (theme → Settings → Notifications / Flow) — prefer that over custom SendGrid. Keep the backend sender only for operational data Shopify doesn't model. Wrap in try/catch so a send failure never fails checkout (mirrors the warranty-email pattern).
- **J002 (shipped dead queue):** either (a) call `emailService.sendShippingNotification` + `smsService.sendShippingNotification` inline where the `queued` row is written (correcting the stale "no SMTP" comment), or (b) add one queue-drainer that dispatches `emailLogs`/`smsLogs` rows with `status:'queued'` and flips them to `sent`/`failed`. **Native-first:** Shopify's Shipping Confirmation notification fires automatically on fulfillment-with-tracking — the manufacturer/admin tracking write should create the Shopify fulfillment (native) rather than hand-roll the email.
- **J006 / J007 / J008 (production/QA/delivered/installation):** drive these off the normalized order-state machine — on each milestone transition, look up a template by state and send via `notification-send`. **Native-first:** map order-lifecycle states to Shopify Flow triggers where they exist (fulfillment, delivered); installation scheduling/completion is backend-only (Shopify doesn't model it) so those two legitimately use the backend sender.
- **J003 / J004 / J012 (analytics stores + attribution + funnel):** consolidate to **one** store and one capture endpoint. Point `frontend/public/js/app.js` at the attribution-capable endpoint (or extend `/api/analytics/event` to persist `utm_source/medium/campaign` + `referrer`), have every dashboard read the same array, and emit a `checkout_started` event when checkout begins. **Native-first:** attribution + funnels are exactly what **Shopify web pixels + GA4** provide natively — prefer wiring the storefront to Shopify's analytics/web-pixel + a correctly-configured GA4 property, and keep the backend event store only as an operational supplement, not a parallel analytics warehouse.
- **J011 (GA4):** replace `G-XXXXXXXXXX` with the real measurement ID and load the tag (theme `theme.liquid` `<head>`, native) on **all** pages including Home/Product/Cart/checkout, or install the GA4 channel via Shopify's native GA integration so purchase events carry attribution.
- **J010 (consent):** add a consent/suppression check as the first step of `emailService.send`/`smsService.send` (per the `notification-send` skill), reading the captured `consent` flag and a suppression list; exempt transactional classes (order/shipping/payment receipts) and gate marketing classes (nudge/review). **Native-first:** Shopify customer email/SMS marketing consent + notification categories model this natively.

---

**One-line summary:** Section J found 12 confirmed cross-cutting defects — 4 P2 (order-confirmation milestone unwired; shipped notification is a dead `queued` record with no consumer; analytics split across two disjoint stores so the funnel reports a live 3300% conversion; zero campaign/UTM/referrer attribution captured across 1107 events) and 8 P3 (paid/production/QA/delivered/installation milestones unwired, orphaned SMS templates, dead sample/review/registration queue, no consent/suppression gating, placeholder GA4 absent from conversion pages, and a `checkout_started` funnel stage that is never emitted) — all reproduced read-only; native-Shopify-first fixes recommended, none applied.
