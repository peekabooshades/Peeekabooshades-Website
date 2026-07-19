# Skill — `notification-send`

**Purpose:** Send a templated email/SMS for a journey milestone, respecting consent.

**When to use (trigger):** A milestone event fires (order, shipment, install, invoice, follow-up).

## Inputs
- Recipient + consent status
- Template ID + data
- Channel (email/SMS)

## Process
1. Check consent/suppression; select template
2. Render with milestone data (no unnecessary PII)
3. Send via Shopify notification/Flow or SendGrid/Twilio
4. Log delivery + consent for audit; retry on transient failure

## Outputs
- Delivered message + audit log

**Repeatable / idempotent:** Yes — idempotent per (event, recipient, template).

## Used by agents
- Notification Agent
- Sample Agent
- Order/Manufacturing/Fulfillment/Installation/Support Agents

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

