# Agent — Analytics Agent

> **Journey stage(s):** cross-cutting  
> **Type:** cross-cutting

**Purpose:** Captures events and attribution and powers the dashboards.

## Responsibilities / Tasks
- Capture storefront, quote, order, manufacturing and installation events
- Maintain attribution (source/campaign/partner code)
- Enforce event schema and data-quality checks
- Feed executive/sales/SEO/finance dashboards (read-only on financial records)

## Inputs
- Events from every stage
- Attribution data

## Outputs / Deliverables
- Clean analytics warehouse
- Dashboards

## Shopify-native mapping (native-first)
- GA4 / Shopify web pixels / analytics
- Backend analytics pipeline (read-only consumer)

## Skills used
- `link-audit` — see `../skills/link-audit.md`

## Handoffs
- **Receives from:** All stages
- **Hands off to:** Discovery & SEO Agent
- **Source of truth:** Analytics warehouse (never updates orders/finance)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

