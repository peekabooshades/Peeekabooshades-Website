# Agent — Fabric Agent

> **Journey stage(s):** 2  
> **Type:** stage owner

**Purpose:** Owns the fabric catalog: families, codes, colors, opacity, material, swatch images and compatibility.

## Responsibilities / Tasks
- Maintain fabric families, fabric codes and color names (e.g., 82067A Beige)
- Store swatch images with descriptive alt text on Shopify CDN
- Record opacity (light-filtering %, blackout %, openness factor), material, supplier
- Record width/height limits and motor compatibility per fabric
- Manage availability / discontinued status
- Wire swatch selection to the existing product-page component (no redesign)

## Inputs
- ZSTARR/supplier fabric data
- Swatch images
- Openness/opacity specs

## Outputs / Deliverables
- Fabric metaobjects/variants
- CDN swatch assets + alt text
- Fabric compatibility rules

## Shopify-native mapping (native-first)
- Metaobjects (zstarr_fabric) or variants + metafields
- Shopify Files / theme assets
- Line-item property: Fabric Code

## Skills used
- `fabric-swatch-import` — see `../skills/fabric-swatch-import.md`
- `image-optimize` — see `../skills/image-optimize.md`

## Handoffs
- **Receives from:** Catalog Agent
- **Hands off to:** Configurator Agent, Pricing Agent
- **Source of truth:** Shopify (fabric metaobjects)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

