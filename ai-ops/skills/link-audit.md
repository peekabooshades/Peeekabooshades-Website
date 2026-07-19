# Skill — `link-audit`

**Purpose:** Crawl every internal link and test it, reporting broken/misrouted links.

**When to use (trigger):** Before release, after content changes, or on a schedule.

## Inputs
- Set of pages/sections to crawl
- Live base URL

## Process
1. Extract all internal hrefs from theme/pages
2. Test each against the live site (follow redirects)
3. Classify each as ok / redirect / broken (with status)
4. Map broken legacy paths (.html, /product/...) to real Shopify pages/policies/products
5. Report; propose fixes for approval (no change without approval)

## Outputs
- Broken-link report + proposed mapping

**Repeatable / idempotent:** Yes — repeatable audit.

## Used by agents
- Discovery & SEO Agent
- Support & Warranty Agent
- Analytics Agent

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

