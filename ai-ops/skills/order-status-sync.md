# Skill — `order-status-sync`

**Purpose:** Propagate order / production / installation status across Shopify and the internal systems consistently.

**When to use (trigger):** An order, production or installation status changes.

## Inputs
- Source status event
- Order/project ID
- Allowed state transitions

## Process
1. Verify webhook signature; enforce idempotency (dedupe by event ID)
2. Validate the transition against the state machine (reject invalid)
3. Update the authoritative store; mirror read-only status to consumers
4. Emit notification + audit record

## Outputs
- Consistent status across systems
- Audit record

**Repeatable / idempotent:** Yes — idempotent by event ID.

## Used by agents
- Order Agent
- Manufacturing Agent
- Fulfillment Agent
- Installation Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

