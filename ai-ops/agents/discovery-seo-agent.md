# Agent — Discovery & SEO Agent

> **Journey stage(s):** 0, 1, 15  
> **Type:** stage owner

**Purpose:** Brings strangers to the store (search/ads/referral/partners) and brings buyers back.

## Responsibilities / Tasks
- Optimize on-page SEO (titles, meta, headings, structured data) for product + local intent
- Maintain sitemap, canonical tags, robots and indexation health
- AI-search / answer-engine optimization (FAQ, comparison content)
- Campaign & partner landing pages (dealer/designer/realtor/affiliate codes)
- Product recommendations, reorder & cross-sell prompts
- Run periodic broken-link and crawl-health checks

## Inputs
- Target keywords
- Campaign/partner attribution codes
- Product & collection data

## Outputs / Deliverables
- Indexed, crawlable pages
- Structured data (Product/Breadcrumb/FAQ)
- Qualified traffic
- Broken-link report

## Shopify-native mapping (native-first)
- Theme SEO tags & templates
- Product/Collection metafields
- Shopify sitemap
- GA4 / Search Console / Business Profile

## Skills used
- `link-audit` — see `../skills/link-audit.md`
- `image-optimize` — see `../skills/image-optimize.md`

## Handoffs
- **Receives from:** — (entry point)
- **Hands off to:** Catalog Agent, Analytics Agent
- **Source of truth:** Shopify (content) / GitHub (code)

## Change Control (MANDATORY)
- **No code or design changes are made without the owner's review and approval.**
- Any bug or issue this agent/skill raises **must include**: (1) a written **justification** (root cause + why it matters), and (2) a **real-time example** (concrete inputs → observed wrong output/behavior).
- **No front-end redesign.** Preserve branding, logo, typography, colors, product-card look, layout, navigation, spacing, responsive behavior.
- Native-Shopify-first: theme → metafields → metaobjects → products/variants → customer accounts → draft orders → Functions → backend. Custom code only when no safe native option exists **and the owner approves**.

