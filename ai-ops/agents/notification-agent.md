# Agent — Notification Agent

> **Journey stage(s):** cross-cutting  
> **Type:** cross-cutting

**Purpose:** Sends the right email/SMS at every milestone of the journey.

## Responsibilities / Tasks
- Send order, shipment, installation and invoice notifications
- Send sample follow-ups, review requests and reminders
- Respect consent and suppression lists
- Never send unnecessary personal data

## Inputs
- Milestone events
- Templates
- Consent status

## Outputs / Deliverables
- Delivered notifications
- Send/consent audit

## Shopify-native mapping (native-first)
- Shopify notifications & Flow
- SendGrid / Twilio via backend

## Skills used
- `notification-send` — see `../skills/notification-send.md`

## Handoffs
- **Receives from:** All stages
- **Hands off to:** All stages
- **Source of truth:** Shopify (notifications) + backend (logs)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

