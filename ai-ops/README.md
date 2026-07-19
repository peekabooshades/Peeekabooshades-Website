# PeekabooShades — AI Ops: Agents, Skills & Customer Journey

This folder documents **how the PeekabooShades online store runs as a system**: the full customer journey, the **named agent** that owns each task, and the **skills** (reusable, repetitive operations) they call. Documentation only — see the change-control rule below.

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.


## Contents
- [`customer-journey.md`](customer-journey.md) — the complete customer journey, every stage & task mapped to its agent + skill + Shopify mechanism.
- [`agents/`](agents/) — one `.md` per agent (what it does, tasks, inputs/outputs, Shopify mapping, handoffs).
- [`skills/`](skills/) — one `.md` per reusable skill (repetitive operations).

## Agents (task owners)
| Agent | Journey stage | What it does |
|---|---|---|
| [Discovery & SEO Agent](agents/discovery-seo-agent.md) | 0, 1, 15 | Brings strangers to the store (search/ads/referral/partners) and brings buyers back. |
| [Catalog Agent](agents/catalog-agent.md) | 1 | Presents the product catalog (Roller/Zebra/Roman/Honeycomb) and lets customers browse and filter. |
| [Fabric Agent](agents/fabric-agent.md) | 2 | Owns the fabric catalog: families, codes, colors, opacity, material, swatch images and compatibility. |
| [Sample Agent](agents/sample-agent.md) | 3 | Handles free physical fabric-sample requests before purchase. |
| [Measure Agent](agents/measure-agent.md) | 4 | Guides the customer to measure correctly and validates the entered dimensions. |
| [Configurator Agent](agents/configurator-agent.md) | 5 | Renders and governs all product options and produces the SKU for the configuration. |
| [Pricing Agent](agents/pricing-agent.md) | 6, 14 | Produces a deterministic, versioned, auditable price and keeps it identical everywhere it is shown. |
| [Cart & Quote Agent](agents/cart-quote-agent.md) | 7 | Preserves every selection into the cart, or converts it into a quote / draft order — with zero data loss. |
| [Account Agent](agents/account-agent.md) | 8 | Manages customer and partner authentication, saved configurations, wishlist and history. |
| [Checkout & Payment Agent](agents/checkout-payment-agent.md) | 9, 14 | Runs checkout, payment (full / deposit / terms), coupons, and issues invoices. |
| [Order Agent](agents/order-agent.md) | 10 | Turns checkout into an order, mirrors it to the internal project record, and owns the order state machine. |
| [Manufacturing Agent](agents/manufacturing-agent.md) | 11 | Converts orders into manufacturer work orders and tracks production and QA. |
| [Fulfillment Agent](agents/fulfillment-agent.md) | 12 | Ships finished product and gives the customer tracking. |
| [Installation Agent](agents/installation-agent.md) | 13 | Assigns installers, schedules jobs, and records installation completion. |
| [Support & Warranty Agent](agents/support-warranty-agent.md) | 12, 15 | Handles order lookup, tracking, returns, warranty registration and claims, and reorders. |
| [Notification Agent](agents/notification-agent.md) | cross-cutting | Sends the right email/SMS at every milestone of the journey. |
| [Analytics Agent](agents/analytics-agent.md) | cross-cutting | Captures events and attribution and powers the dashboards. |

## Skills (repetitive, reusable operations)
| Skill | What it does | Used by |
|---|---|---|
| [`fabric-swatch-import`](skills/fabric-swatch-import.md) | Import fabric swatches (code, color, opacity, image) from a folder/spreadsheet into the fabric catalog, with SEO filenames and alt text. | Fabric Agent, Catalog Agent |
| [`price-calculate`](skills/price-calculate.md) | Compute a deterministic, versioned, auditable price from a product configuration. | Pricing Agent, Configurator Agent, Cart & Quote Agent |
| [`measurement-validate`](skills/measurement-validate.md) | Validate entered width/height against fabric limits, fractions, rounding and deduction rules. | Measure Agent, Configurator Agent |
| [`sku-generate`](skills/sku-generate.md) | Generate a stable, unique SKU from the product + fabric + control + options. | Configurator Agent, Cart & Quote Agent |
| [`order-status-sync`](skills/order-status-sync.md) | Propagate order / production / installation status across Shopify and the internal systems consistently. | Order Agent, Manufacturing Agent, Fulfillment Agent |
| [`link-audit`](skills/link-audit.md) | Crawl every internal link and test it, reporting broken/misrouted links. | Discovery & SEO Agent, Support & Warranty Agent, Analytics Agent |
| [`image-optimize`](skills/image-optimize.md) | Process and upload images (correct format, resize, responsive, alt text) to the Shopify CDN. | Catalog Agent, Fabric Agent, Discovery & SEO Agent |
| [`notification-send`](skills/notification-send.md) | Send a templated email/SMS for a journey milestone, respecting consent. | Notification Agent, Sample Agent, Order/Manufacturing/Fulfillment/Installation/Support Agents |

## How this maps to Shopify
Native-first: **Shopify** owns products, variants, collections, customers, cart, checkout, orders, payments, discounts, fulfillment. The **backend repo** owns operational data Shopify doesn't model (installer assignments, manufacturer work orders, production/installation milestones, detailed measurements, commissions, audit). **GitHub** owns code, never business transaction data.
