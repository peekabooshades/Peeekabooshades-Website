# Agent — Measure Agent

> **Journey stage(s):** 4  
> **Type:** stage owner

**Purpose:** Guides the customer to measure correctly and validates the entered dimensions.

## Responsibilities / Tasks
- Serve inside/outside-mount how-to-measure guidance
- Capture width & height including fractions
- Validate against fabric min/max, rounding and deduction rules
- State unambiguously who owns the deduction (customer enters finished size)

## Inputs
- Fabric size limits
- Mount type
- Entered dimensions

## Outputs / Deliverables
- Validated finished dimensions
- Deduction-responsibility record

## Shopify-native mapping (native-first)
- Page: how-to-take-measurements-for-blinds
- Line-item properties
- Server re-validation

## Skills used
- `measurement-validate` — see `../skills/measurement-validate.md`

## Handoffs
- **Receives from:** Fabric Agent
- **Hands off to:** Configurator Agent
- **Source of truth:** Order (measurement record)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

