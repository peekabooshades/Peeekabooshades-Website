# PeekabooShades — End-to-End Customer Journey (Online Blinds & Window-Treatment Store)

> **Scope:** How an online custom-blinds / window-treatment store works, from a stranger discovering the brand to a fully installed, warrantied, repeat customer — mapped to how each step is implemented **in Shopify** and, where Shopify can't model it, in the backend. Modeled on the standard flow used by custom-shade retailers (browse → sample → measure → configure → price → cart/quote → checkout → manufacture → ship → install → support), grounded in the PeekabooShades product lines (Roller, Zebra, Roman, Honeycomb) and ZSTARR fabric collections (e.g., 82067).
>
> **Rule:** No front-end redesign. This document maps *behavior and ownership*, not visual design.
>
> **How to read the table:** every task is owned by exactly one **Agent** (see `agents/`). Repetitive, reusable operations are factored into **Skills** (see `skills/`). "Shopify mechanism" follows the native-first order: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend.

---

## Stage 0 — Discovery & Awareness
The customer does not yet know PeekabooShades. They arrive via organic search ("motorized roller shades", "blackout blinds for bedroom"), Google Business Profile, paid ads, social, a referral link, a dealer, an interior designer, or a realtor.

| # | Task | Owner Agent | Skill(s) | Shopify / System mechanism |
|---|------|-------------|----------|-----------------------------|
| 0.1 | Rank for product + local intent keywords | Discovery & SEO Agent | `link-audit`, `image-optimize` | Theme SEO tags, `sitemap.xml`, structured data (Product/Breadcrumb), metafields |
| 0.2 | Serve AI-search / answer-engine optimized content | Discovery & SEO Agent | — | Pages, blog, FAQ metaobjects |
| 0.3 | Attribute the visitor to a source (ad/referral/dealer/designer/realtor/affiliate) | Analytics Agent | — | UTM capture, GA4, web pixel, discount/referral codes |
| 0.4 | Landing pages for campaigns and partner codes | Discovery & SEO Agent | — | Theme templates, URL params, discount codes |

## Stage 1 — Browse & Explore
The visitor lands on Home and explores by **product type** (Roller / Zebra / Roman / Honeycomb), by **room**, by **style/opacity** (light filtering, blackout, sheer), or by **motorization**.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 1.1 | Present product catalog & collections | Catalog Agent | `image-optimize` | Products, Collections, metafields |
| 1.2 | Faceted filtering (type, opacity, control, price) | Catalog Agent | — | Shopify Search & Discovery filters (metafields/tags) |
| 1.3 | Product cards & navigation (no redesign) | Catalog Agent | — | Theme sections/blocks |
| 1.4 | Product landing (Roller Shades) with description, specs | Catalog Agent | — | Product template, metafields (specs) |

## Stage 2 — Fabric Selection
The heart of a shade store. The customer picks a **fabric family**, then a **color / fabric code**, seeing opacity (**light-filtering %**, **blackout %**, **openness factor**), material, and texture.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 2.1 | Maintain fabric families, codes, colors (e.g., 82067A Beige) | Fabric Agent | `fabric-swatch-import` | Metaobjects (`zstarr_fabric`) or variants + metafields |
| 2.2 | Store swatch images + alt text on Shopify CDN | Fabric Agent | `image-optimize` | Shopify Files / theme assets |
| 2.3 | Store opacity, material, width/height limits, motor compatibility | Fabric Agent | — | Metafields on fabric metaobject/variant |
| 2.4 | Fabric availability / discontinued status | Fabric Agent | — | Metafield flag; variant availability |
| 2.5 | Swatch selector on product page switches main image (no redesign) | Fabric Agent | — | Existing theme swatch component + line-item property `Fabric Code` |

## Stage 3 — Order Free Samples
Standard in custom-shade retail: before buying, the customer orders physical fabric samples.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 3.1 | Add fabric codes to a sample request | Sample Agent | — | Sample as $0 product / Shopify Form / draft order |
| 3.2 | Capture shipping address & consent | Sample Agent | — | Shopify Form / customer account |
| 3.3 | Create sample fulfillment | Sample Agent | `notification-send` | Draft order / order, fulfillment |
| 3.4 | Follow-up: "ready to order?" nudge | Notification Agent | `notification-send` | Shopify Flow / email |

## Stage 4 — Measure
The customer measures their window. Inside vs outside mount, width & height, fractions, deduction rules, obstructions.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 4.1 | How-to-measure guidance (inside/outside mount) | Measure Agent | — | Page: `how-to-take-measurements-for-blinds` |
| 4.2 | Capture width & height (with fractions) | Measure Agent | `measurement-validate` | Line-item properties |
| 4.3 | Validate against fabric min/max + rounding + deduction rule | Measure Agent | `measurement-validate` | Client validation + server re-check |
| 4.4 | State who owns the deduction (customer enters finished size) | Measure Agent | — | Documented rule; stored with order |

## Stage 5 — Configure the Product
The full configurator: mount type, control type, motor family/side, remote, hub, solar, roll direction, cassette/valance, bottom rail, accessories, quantity.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 5.1 | Render options in the existing UI (no redesign) | Configurator Agent | — | Theme section + line-item properties |
| 5.2 | Enforce option dependencies & incompatibilities | Configurator Agent | — | Config rules (JSON/metafields) |
| 5.3 | Display conditions (e.g., motor options only if motorized) | Configurator Agent | — | Client logic gated by control type |
| 5.4 | Generate the variant SKU from the configuration | Configurator Agent | `sku-generate` | SKU convention (e.g., `RS-LF-82067-<CODE>-<CONTROL>`) |

## Stage 6 — Live Pricing
Every change recalculates a **deterministic, versioned, auditable** price. Store inputs, not just the total.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 6.1 | Compute billable area (min billable area applied) | Pricing Agent | `price-calculate` | Server-authoritative calc |
| 6.2 | Apply base rate, fabric $/m², margin | Pricing Agent | `price-calculate` | Pricing version table |
| 6.3 | Add motor / remote / hub / solar / valance / bottom-rail / accessory surcharges | Pricing Agent | `price-calculate` | Option `data-price`, gated by control type |
| 6.4 | Add shipping / installation / high-ceiling / quantity | Pricing Agent | `price-calculate` | Pricing version |
| 6.5 | Apply dealer tier / customer catalog / coupon / tax | Pricing Agent | `price-calculate` | Shopify discounts / B2B catalog / Functions |
| 6.6 | Persist input values + applied rules + pricing version + timestamp | Pricing Agent | — | Order metafields / backend pricing record |

## Stage 7 — Cart / Quote / Draft Order
Preserve **every** selection with zero data loss into cart, or into a quote/draft order for high-touch buyers.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 7.1 | Add to cart with all selections as line-item properties | Cart & Quote Agent | `sku-generate` | Cart line-item properties |
| 7.2 | Request a Quote (partner / large project) | Cart & Quote Agent | `notification-send` | Draft order / Shopify Form |
| 7.3 | Save configuration to account for later | Account Agent | — | Customer metafields |
| 7.4 | Cart preserves selections across sessions | Cart & Quote Agent | — | Cart attributes |

## Stage 8 — Account & Authentication
Create/login to an account; save configs, wishlist, addresses, order history.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 8.1 | Create account / login | Account Agent | `notification-send` | Shopify customer accounts (classic or new/passwordless) |
| 8.2 | Save configurations & wishlist | Account Agent | — | Customer metafields |
| 8.3 | Partner accounts (dealer/designer/realtor/affiliate) | Account Agent | — | Shopify Companies / B2B / backend portal |

## Stage 9 — Checkout & Payment
Shipping, taxes, payment (full, **deposit**, or **payment terms**), coupons.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 9.1 | Checkout preserves every line-item property | Checkout & Payment Agent | — | Shopify Checkout |
| 9.2 | Shipping rates & tax | Checkout & Payment Agent | — | Shopify shipping/tax |
| 9.3 | Full payment / deposit / balance | Checkout & Payment Agent | — | Shopify Payments; draft-order invoices for deposits |
| 9.4 | Apply coupon / automatic discount (no double-stacking) | Checkout & Payment Agent | — | Shopify Discounts / Functions |
| 9.5 | Order confirmation | Notification Agent | `notification-send` | Shopify order-confirmation notification |

## Stage 10 — Order Created & Internal Project Record
Shopify order becomes the source of truth for the transaction; a backend **project record** tracks operational milestones Shopify doesn't model.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 10.1 | Create order + capture all config into order | Order Agent | — | Shopify Order + metafields |
| 10.2 | `orders/create` webhook → internal project record | Order Agent | `order-status-sync` | Webhook (verified, idempotent) → backend |
| 10.3 | Normalized order state machine (see order-state doc) | Order Agent | `order-status-sync` | Order metafields / backend status |

## Stage 11 — Manufacturing
Order goes to the manufacturer as a **work order** with the exact spec (fabric code, dimensions, options).

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 11.1 | Generate manufacturer work order from order | Manufacturing Agent | `order-status-sync` | Backend work order (Shopify order = source of truth for what) |
| 11.2 | Production status + QA milestones | Manufacturing Agent | `order-status-sync`, `notification-send` | Backend milestones → order metafield mirror |
| 11.3 | Defect / rework handling | Manufacturing Agent | — | Backend rework state → order note |

## Stage 12 — Shipping & Tracking
Finished shades ship; customer tracks.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 12.1 | Create fulfillment + tracking number | Fulfillment Agent | `order-status-sync` | Shopify fulfillment + tracking |
| 12.2 | Shipment notifications | Notification Agent | `notification-send` | Shopify shipping notification |
| 12.3 | Order tracking page | Support & Warranty Agent | — | Order status page |

## Stage 13 — Installation (optional service)
If the customer bought installation, an **installer** is assigned and schedules the job.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 13.1 | Assign installer to job | Installation Agent | `order-status-sync` | Backend installer assignment |
| 13.2 | Schedule appointment | Installation Agent | `notification-send` | Backend + customer notification |
| 13.3 | Before/after photos, completion checklist, signature | Installation Agent | — | Backend installation record |
| 13.4 | Mark installation complete → customer acceptance | Installation Agent | `order-status-sync`, `notification-send` | Backend status → order metafield |

## Stage 14 — Final Invoice & Balance
Deposit was collected earlier; the **balance invoice** is issued and paid.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 14.1 | Generate final/balance invoice | Checkout & Payment Agent | `notification-send` | Shopify draft-order invoice / order |
| 14.2 | Collect balance | Checkout & Payment Agent | — | Shopify Payments |
| 14.3 | Reconcile payment status | Checkout & Payment Agent | — | Order financial status |

## Stage 15 — Post-Purchase, Warranty & Repeat
Delivery confirmed → warranty registration → review request → reorder/upsell → support.

| # | Task | Owner Agent | Skill(s) | Shopify mechanism |
|---|------|-------------|----------|-------------------|
| 15.1 | Warranty registration | Support & Warranty Agent | — | Customer/order metafields |
| 15.2 | Review request | Notification Agent | `notification-send` | Flow / email |
| 15.3 | Order lookup / status / tracking | Support & Warranty Agent | — | Order status page / account |
| 15.4 | Returns & warranty claims | Support & Warranty Agent | `notification-send` | Refund policy page + backend claim |
| 15.5 | Reorder / cross-sell (more windows, motorization) | Discovery & SEO Agent | — | Product recommendations, email |

## Cross-Cutting (run across every stage)
| Concern | Owner Agent | Skill(s) |
|---|---|---|
| Emails / SMS at every milestone | Notification Agent | `notification-send` |
| Event capture, attribution, dashboards | Analytics Agent | — |
| Broken-link & health checks | Discovery & SEO Agent | `link-audit` |
| Image processing everywhere | Catalog / Fabric Agents | `image-optimize` |
| Deterministic pricing everywhere it's shown | Pricing Agent | `price-calculate` |

---

## Source-of-Truth Summary
- **Shopify:** products, variants, collections, customers, cart, checkout, orders, payments, discounts, fulfillment.
- **Backend (repo):** installer assignments, manufacturer work orders, production/installation milestones, detailed measurement records, custom commissions, internal audit, quote/lead operational data.
- **GitHub:** source of truth for code — never for business transaction data.

## Agent & Skill Index
- Agents: see `ai-ops/agents/` — one `.md` per agent (17 agents).
- Skills (repetitive, reusable operations): see `ai-ops/skills/` — one `.md` per skill (8 skills).
- Master index: `ai-ops/README.md`.
