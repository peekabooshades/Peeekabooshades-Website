# Skill — `price-calculate`

**Purpose:** Compute a deterministic, versioned, auditable price from a product configuration.

**When to use (trigger):** Any time a price must be shown or stored (configurator change, cart, checkout, invoice, portal).

## Inputs
- Fabric code
- Width/height + unit
- Control type + options
- Quantity
- Pricing version
- Dealer/coupon/tax context

## Process
1. Compute area; apply minimum billable area
2. Look up fabric $/m² for the active pricing version; apply margin
3. Sum every selected priced option, gated by control type
4. Add shipping/installation/high-ceiling/quantity
5. Apply dealer tier/coupon/tax; prevent duplicate-discount stacking
6. Round to currency precision; return itemized breakdown + inputs + version

## Outputs
- Final price + itemized breakdown
- Stored calculation inputs + pricing version

**Repeatable / idempotent:** Yes — pure function; same inputs → same output.

## Used by agents
- Pricing Agent
- Configurator Agent
- Cart & Quote Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

