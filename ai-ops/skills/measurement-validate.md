# Skill — `measurement-validate`

**Purpose:** Validate entered width/height against fabric limits, fractions, rounding and deduction rules.

**When to use (trigger):** The customer enters or edits dimensions.

## Inputs
- Width/height (with fractions)
- Mount type
- Fabric min/max width & height

## Process
1. Parse fractional inches to decimal
2. Check against fabric min/max width and height
3. Apply rounding rule; apply/confirm deduction responsibility
4. Return valid/invalid + reason + finished size

## Outputs
- Validation result + finished dimensions

**Repeatable / idempotent:** Yes — pure validation.

## Used by agents
- Measure Agent
- Configurator Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

