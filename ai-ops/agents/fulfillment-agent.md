# Agent — Fulfillment Agent

> **Journey stage(s):** 12  
> **Type:** stage owner

**Purpose:** Ships finished product and gives the customer tracking.

## Responsibilities / Tasks
- Create fulfillment and attach tracking number
- Trigger shipment notifications
- Feed the order-tracking page

## Inputs
- Completed work order
- Carrier/tracking

## Outputs / Deliverables
- Fulfillment + tracking
- Shipment notifications

## Shopify-native mapping (native-first)
- Shopify fulfillment + tracking
- Order status page

## Skills used
- `order-status-sync` — see `../skills/order-status-sync.md`
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** Manufacturing Agent
- **Hands off to:** Installation Agent, Support & Warranty Agent
- **Source of truth:** Shopify (fulfillment)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

