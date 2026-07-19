# Agent — Configurator Agent

> **Journey stage(s):** 5  
> **Type:** stage owner

**Purpose:** Renders and governs all product options and produces the SKU for the configuration.

## Responsibilities / Tasks
- Render options in the existing UI (mount, control, motor, side, remote, hub, solar, cassette/valance, bottom rail, roll direction, accessories, quantity)
- Enforce option dependencies and incompatibilities
- Apply display conditions (e.g., motor options only when motorized)
- Generate the variant SKU from the full configuration

## Inputs
- Fabric selection
- Dimensions
- Option catalog + rules

## Outputs / Deliverables
- Valid configuration object
- Generated SKU
- Line-item properties

## Shopify-native mapping (native-first)
- Theme section + line-item properties
- Config rules (JSON/metafields)

## Skills used
- `sku-generate` — see `../skills/sku-generate.md`
- `price-calculate` — see `../skills/price-calculate.md`

## Handoffs
- **Receives from:** Measure Agent
- **Hands off to:** Pricing Agent, Cart & Quote Agent
- **Source of truth:** Shopify (line-item properties)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

