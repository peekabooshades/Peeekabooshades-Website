# Skill — `sku-generate`

**Purpose:** Generate a stable, unique SKU from the product + fabric + control + options.

**When to use (trigger):** A configuration is finalized (add to cart / quote / order).

## Inputs
- Product type
- Fabric code
- Control code
- Key options

## Process
1. Assemble deterministic SKU (e.g., RS-LF-82067-<CODE>-<CONTROL>)
2. Ensure no spaces; stable format; correct fabric code
3. Guarantee uniqueness per valid variant

## Outputs
- Unique SKU string

**Repeatable / idempotent:** Yes — deterministic.

## Used by agents
- Configurator Agent
- Cart & Quote Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

