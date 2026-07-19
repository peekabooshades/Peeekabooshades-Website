# Agent — Cart & Quote Agent

> **Journey stage(s):** 7  
> **Type:** stage owner

**Purpose:** Preserves every selection into the cart, or converts it into a quote / draft order — with zero data loss.

## Responsibilities / Tasks
- Add to cart with all selections as line-item properties
- Create a Quote / draft order for partner or large projects
- Preserve the configuration across sessions
- Hand a saved configuration to the Account Agent

## Inputs
- Configuration + price
- Customer/partner identity

## Outputs / Deliverables
- Cart with full line-item properties
- Quote / draft order

## Shopify-native mapping (native-first)
- Cart line-item properties & attributes
- Draft orders
- Shopify Form

## Skills used
- `sku-generate` — see `../skills/sku-generate.md`

## Handoffs
- **Receives from:** Pricing Agent
- **Hands off to:** Account Agent, Checkout & Payment Agent
- **Source of truth:** Shopify (cart/draft order)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

