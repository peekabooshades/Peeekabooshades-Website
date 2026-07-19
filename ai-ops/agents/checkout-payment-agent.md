# Agent — Checkout & Payment Agent

> **Journey stage(s):** 9, 14  
> **Type:** stage owner

**Purpose:** Runs checkout, payment (full / deposit / terms), coupons, and issues invoices.

## Responsibilities / Tasks
- Preserve every line-item property through checkout
- Apply shipping rates and tax
- Take full payment, deposit, or payment terms
- Apply coupon / automatic discount without double-stacking
- Issue deposit and final/balance invoices
- Reconcile payment status

## Inputs
- Cart/draft order
- Payment method
- Discount context

## Outputs / Deliverables
- Paid order
- Deposit & balance invoices
- Reconciled payment status

## Shopify-native mapping (native-first)
- Shopify Checkout & Payments
- Draft-order invoices
- Shopify Discounts / Functions

## Skills used
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** Account Agent
- **Hands off to:** Order Agent, Notification Agent
- **Source of truth:** Shopify (payments, orders)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

