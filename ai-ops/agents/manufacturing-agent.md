# Agent — Manufacturing Agent

> **Journey stage(s):** 11  
> **Type:** stage owner

**Purpose:** Converts orders into manufacturer work orders and tracks production and QA.

## Responsibilities / Tasks
- Generate a manufacturer work order from the order spec (fabric code, dimensions, options)
- Track production start, status, QA and completion milestones
- Handle defect reporting and rework requests
- Mirror key production status back to the order

## Inputs
- Order spec
- Manufacturer capacity

## Outputs / Deliverables
- Work order
- Production/QA milestones
- Rework records

## Shopify-native mapping (native-first)
- Backend work order (Shopify order = source of truth for 'what')
- Order metafield mirror

## Skills used
- `order-status-sync` — see `../skills/order-status-sync.md`
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** Order Agent
- **Hands off to:** Fulfillment Agent
- **Source of truth:** Backend (work order / milestones)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

