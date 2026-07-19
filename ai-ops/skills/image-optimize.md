# Skill — `image-optimize`

**Purpose:** Process and upload images (correct format, resize, responsive, alt text) to the Shopify CDN.

**When to use (trigger):** Any image is added or replaced (fabric, product, content).

## Inputs
- Source image(s)
- Target usage (swatch/gallery/hero)
- Alt-text context

## Process
1. Detect true format; fix mislabeled extensions
2. Convert to WebP/AVIF where appropriate; generate responsive sizes
3. Lazy-load below-the-fold; never lazy-load the first product image
4. Upload to Shopify Files/CDN; never expose local paths
5. Attach descriptive alt text

## Outputs
- Optimized responsive assets on CDN + alt text

**Repeatable / idempotent:** Yes — repeatable per image.

## Used by agents
- Catalog Agent
- Fabric Agent
- Discovery & SEO Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

