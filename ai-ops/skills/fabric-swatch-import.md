# Skill — `fabric-swatch-import`

**Purpose:** Import fabric swatches (code, color, opacity, image) from a folder/spreadsheet into the fabric catalog, with SEO filenames and alt text.

**When to use (trigger):** A new or updated fabric collection is received.

## Inputs
- Source folder / CSV / JSON of swatches
- Fabric code + color mapping

## Process
1. Recursively scan the source; group files by exact fabric code (case-insensitive)
2. Resolve color name via mapping file → spreadsheet → existing data → filename (never invent)
3. Detect true image format (fix mislabeled .webp/.jpg); optimize; upload to Shopify CDN
4. Write fabric metaobject/variant with code, color, opacity, material, limits
5. Generate alt text: 'PeekabooShades <code> <color> <opacity> roller shade'
6. Report unmapped/unclear items

## Outputs
- Uploaded swatch assets
- Fabric records
- Unmapped-items report

**Repeatable / idempotent:** Yes — deterministic, idempotent per fabric code.

## Used by agents
- Fabric Agent
- Catalog Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

