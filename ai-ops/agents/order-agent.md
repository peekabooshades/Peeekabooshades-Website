# Agent — Order Agent

> **Journey stage(s):** 10  
> **Type:** stage owner

**Purpose:** Turns checkout into an order, mirrors it to the internal project record, and owns the order state machine.

## Responsibilities / Tasks
- Create the Shopify order capturing all configuration
- Process orders/create webhook (verified, idempotent) into an internal project record
- Maintain the normalized order state machine
- Prevent invalid state transitions from any portal

## Inputs
- Paid order / draft order
- Webhook events

## Outputs / Deliverables
- Order + internal project record
- Valid order state

## Shopify-native mapping (native-first)
- Shopify Order + metafields
- Verified idempotent webhooks → backend

## Skills used
- `order-status-sync` — see `../skills/order-status-sync.md`

## Handoffs
- **Receives from:** Checkout & Payment Agent
- **Hands off to:** Manufacturing Agent
- **Source of truth:** Shopify (order) + backend (project record)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

