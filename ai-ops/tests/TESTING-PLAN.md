# PeekabooShades — Testing Plan (unit / functional / integration / security / regression)

> Established 2026-07-19 as part of the recursive audit+fix loop (Enterprise Blueprint). Owner mandate: unit + functional + all other testing, **for every agent**, deep-dive, **no own assumptions**, everything documented.

## Current state (verified, no assumptions)
- **0 automated tests.** No test framework in `backend/package.json` (no jest/mocha/vitest/supertest); `find` → 0 `*.test.js`/`*.spec.js`; no `test/`/`__tests__/` dir; no runner config. Only an unrelated `smoke-test` npm script exists.
- This total absence of a test suite is itself logged as a ticket (**TEST-GAP-000**, P2 — process/quality: no regression safety net for a live commerce platform).

## Tooling (zero-install, no new deps in the client repo)
- **Runner:** Node's built-in test runner — `node --test ai-ops/tests/**/*.test.js` (Node 18+, this env is Node v26). No jest/mocha install; `node:test` + `node:assert/strict`.
- **HTTP functional:** built-in `fetch` against the app.
- **Rationale:** the app runs on Node (`node server.js`); the built-in runner adds no dependency to the client's `package.json` and needs no package manager.

## Test types (each agent gets the applicable ones)
1. **Unit** — pure modules/functions in isolation: `pricing-engine`, `extended-pricing-engine`, tax/shipping/discount calc, `sku-generate`, measurement validators, order state-machine validators, `invoice-service` math, MOQ/rounding.
2. **Functional (API)** — real HTTP request → response assertions against documented contract per endpoint (happy path).
3. **Integration (cross-agent handoff)** — configure→cart→quote→checkout→order→manufacturing→fulfillment→invoice data continuity (does data survive each handoff without loss/mutation).
4. **Negative / boundary** — invalid/missing/tampered inputs, empty cart, zero/negative/huge dimensions, invalid coupon, illegal state transition.
5. **Security** — auth required where documented; no cross-role/IDOR access; no internal-financials (manufacturerCost/margin/P&L) or PII in customer/public responses.
6. **Idempotency / concurrency** — double-submit order/payment, lost-update on the JSON store.
7. **Regression** — one test per confirmed bug ticket: encodes the documented requirement; **fails against current code (demonstrating the bug)** → **passes after the fix**. This is how each fix is verified in its ticket.

## No-own-assumption rule (testing)
- Every assertion cites its source of truth: the agent md deliverable, the Enterprise Blueprint § clause, `customer-journey.md`, or the documented API contract. Test comments carry the citation.
- Where expected behavior is **not specified** anywhere, the test does **not** invent a value — it is marked `t.todo()` / documented as an **owner-decision gap**, not asserted.
- Reproduction tests assert the **observed** current behavior (captured verbatim from a live run) as the baseline, then the post-fix test asserts the required behavior.

## DB-safety protocol for write-path functional tests
- Write-path tests (place order, run payment, submit warranty/sample, admin mutations) require the FIX phase window when no parallel audit agents are running (single `node server.js` on :3001; concurrent restarts collide).
- Protocol per write-test batch: record `md5 database.json` baseline → `cp database.json database.json.testbak` → run tests → restore `database.json` from backup → re-verify md5 matches baseline. No test data persists.

## Per-agent coverage matrix (17 agents)
| Agent (stage) | Unit | Functional | Integration | Negative | Security | Regression |
|---|---|---|---|---|---|---|
| Discovery/SEO (0) | – | ✓ (sitemap/robots/canonical) | – | ✓ | ✓ (robots blocks) | per A-bugs |
| Catalog (1) | – | ✓ (list/detail/filter) | – | ✓ (filter facets) | – | per A-bugs |
| Fabric (2) | ✓ (code/price coverage) | ✓ | ✓ (fabric→price) | ✓ | – | per L-bugs |
| Sample (3) | – | ✓ | – | ✓ (limits) | ✓ | per B-bugs |
| Measure (4) | ✓ (validators) | ✓ | – | ✓ (bounds) | – | per C-bugs |
| Configurator (5) | ✓ (sku/options) | ✓ | ✓ (config→cart) | ✓ (incompatible combos) | – | per O-bugs |
| Pricing (6,14) | ✓ (engine/tax/MOQ/margin) | ✓ (calc endpoints agree) | ✓ (price parity) | ✓ (0/neg/huge dims) | ✓ (no mfrCost leak) | per P-bugs |
| Cart/Quote (7) | – | ✓ | ✓ (cart↔quote) | ✓ | ✓ (server re-price) | per O-bugs |
| Account (8) | – | ✓ | – | ✓ (enum) | ✓ (IDOR) | per D-bugs |
| Checkout/Payment (9) | ✓ (total calc) | ✓ | ✓ (checkout→order→invoice) | ✓ (tamper/empty) | ✓ (fake-paid) | per Q-bugs |
| Order (10) | ✓ (state machine) | ✓ | ✓ (order↔project) | ✓ (illegal transition) | ✓ | per M-bugs |
| Manufacturing (11) | – | ✓ | ✓ (order→work-order) | ✓ | ✓ (mfr sees no financials) | per N-bugs |
| Fulfillment (12) | – | ✓ | ✓ | ✓ | ✓ (IDOR) | per E-bugs |
| Installation (13) | – | ✓ | ✓ | ✓ | ✓ (session revoke) | per F-bugs |
| Support/Warranty (15) | – | ✓ | ✓ (reorder) | ✓ | ✓ (public router leak) | per H-bugs |
| Notification (x) | ✓ (template select) | ✓ | ✓ (milestone→send) | ✓ (consent) | – | per J-bugs |
| Analytics (x) | ✓ (funnel math) | ✓ | ✓ (event→dashboard) | ✓ | – | per J-bugs |

## Sequencing
1. **Now:** 6 deep read-only audit agents (L,M,N,O,P,Q) still running — they define the bug list. (Q done.)
2. **Consolidate:** build `ai-ops/audit/TICKETS.md` — one ticket per confirmed bug (both rounds), section-prefixed IDs.
3. **Harness + tests:** create `ai-ops/tests/` suites by domain; unit tests first (no server/DB collision), then functional/write tests under the DB-safety protocol.
4. **Serialized fix phase:** per ticket — write failing regression test → apply native-first fix → test passes → clean restart + live re-verify → update ticket (Issue/Root-cause/Repro/Resolution/Code-changes/Test/Status=Verified).

## Output artifacts
- `ai-ops/tests/*.test.js` — the suites.
- `ai-ops/tests/RESULTS.md` — full run output (pass/fail per test, with the documented expectation + observed value for every assertion).
- `ai-ops/audit/TICKETS.md` — one ticket per bug, each linked to its regression test.
