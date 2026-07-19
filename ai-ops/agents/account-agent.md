# Agent — Account Agent

> **Journey stage(s):** 8  
> **Type:** stage owner

**Purpose:** Manages customer and partner authentication, saved configurations, wishlist and history.

## Responsibilities / Tasks
- Create account / login (classic or new passwordless customer accounts)
- Save configurations and wishlist to the account
- Maintain addresses and order history
- Provision partner accounts (dealer/designer/realtor/affiliate)

## Inputs
- Customer credentials/session
- Saved configurations

## Outputs / Deliverables
- Authenticated customer
- Saved configs & wishlist
- Partner account

## Shopify-native mapping (native-first)
- Shopify customer accounts
- Customer metafields
- Shopify Companies / B2B / backend portal

## Skills used
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** Cart & Quote Agent
- **Hands off to:** Checkout & Payment Agent
- **Source of truth:** Shopify (customers)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

