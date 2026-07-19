# Agent — Installation Agent

> **Journey stage(s):** 13  
> **Type:** stage owner

**Purpose:** Assigns installers, schedules jobs, and records installation completion.

## Responsibilities / Tasks
- Assign an installer to the job
- Schedule the installation appointment
- Capture before/after photos, completion checklist and customer signature
- Mark installation complete and request customer acceptance

## Inputs
- Delivered order
- Installer availability
- Service address

## Outputs / Deliverables
- Installer assignment
- Appointment
- Completion record

## Shopify-native mapping (native-first)
- Backend installer assignment & record
- Order metafield status

## Skills used
- `order-status-sync` — see `../skills/order-status-sync.md`
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** Fulfillment Agent
- **Hands off to:** Checkout & Payment Agent (balance), Support & Warranty Agent
- **Source of truth:** Backend (installation record)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

