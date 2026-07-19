# Agent — Sample Agent

> **Journey stage(s):** 3  
> **Type:** stage owner

**Purpose:** Handles free physical fabric-sample requests before purchase.

## Responsibilities / Tasks
- Let the customer add fabric codes to a sample request
- Capture shipping address & marketing consent
- Create the sample fulfillment
- Trigger a follow-up nudge after samples arrive

## Inputs
- Selected fabric codes
- Shipping address

## Outputs / Deliverables
- Sample order/fulfillment
- Sample-to-order follow-up

## Shopify-native mapping (native-first)
- Sample as $0 product / Shopify Form / draft order
- Fulfillment
- Flow follow-up

## Skills used
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** Fabric Agent
- **Hands off to:** Fulfillment Agent, Notification Agent
- **Source of truth:** Shopify (order)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

