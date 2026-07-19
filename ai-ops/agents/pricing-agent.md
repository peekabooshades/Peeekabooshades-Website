# Agent — Pricing Agent

> **Journey stage(s):** 6, 14  
> **Type:** stage owner

**Purpose:** Produces a deterministic, versioned, auditable price and keeps it identical everywhere it is shown.

## Responsibilities / Tasks
- Compute billable area (apply minimum billable area)
- Apply base rate, fabric $/m² and margin
- Add motor/remote/hub/solar/valance/bottom-rail/accessory surcharges, gated by control type
- Add shipping/installation/high-ceiling/quantity
- Apply dealer tier / customer catalog / coupon / tax
- Persist inputs, applied rules, pricing version and timestamp (never store only the total)
- Guarantee price parity across product page, cart, checkout, order, invoice, dealer portal

## Inputs
- Configuration + dimensions
- Pricing version table
- Discounts/coupons/tax context

## Outputs / Deliverables
- Itemized price + breakdown
- Stored, reproducible pricing record

## Shopify-native mapping (native-first)
- Server-authoritative calc / Shopify Functions
- Pricing version table
- Shopify discounts / B2B catalog

## Skills used
- `price-calculate` — see `../skills/price-calculate.md`

## Handoffs
- **Receives from:** Configurator Agent
- **Hands off to:** Cart & Quote Agent, Checkout & Payment Agent
- **Source of truth:** Backend pricing version + Order snapshot

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

