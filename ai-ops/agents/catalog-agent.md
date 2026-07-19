# Agent — Catalog Agent

> **Journey stage(s):** 1  
> **Type:** stage owner

**Purpose:** Presents the product catalog (Roller/Zebra/Roman/Honeycomb) and lets customers browse and filter.

## Responsibilities / Tasks
- Manage products, collections and categories
- Maintain product cards & navigation (no redesign)
- Faceted filtering by type/opacity/control/price
- Maintain product landing pages, descriptions and spec content

## Inputs
- Product/collection definitions
- Fabric availability
- Spec content

## Outputs / Deliverables
- Browsable catalog
- Working filters
- Product landing pages

## Shopify-native mapping (native-first)
- Products, Collections
- Metafields (specs)
- Search & Discovery filters

## Skills used
- `image-optimize` — see `../skills/image-optimize.md`
- `fabric-swatch-import` — see `../skills/fabric-swatch-import.md`

## Handoffs
- **Receives from:** Discovery & SEO Agent
- **Hands off to:** Fabric Agent, Configurator Agent
- **Source of truth:** Shopify

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

