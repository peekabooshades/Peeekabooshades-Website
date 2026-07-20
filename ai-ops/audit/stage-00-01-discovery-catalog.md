# Stage 0 & 1 — Discovery / SEO + Browse / Catalog (Discovery & SEO Agent + Catalog Agent) — Audit

> Section **A** of the recursive audit loop. Scope: customer-journey **Stage 0** (Discovery & Awareness) + **Stage 1** (Browse & Explore) + catalog. Surfaces: catalog/collection listing + browse + filter endpoints and pages (Roller/Zebra/Roman/Honeycomb), product-card rendering, SEO (titles, meta description, canonical, sitemap, robots, structured data), internal link integrity, image handling (format/alt/responsive). **READ-ONLY.** Reproduced with GET requests against the running app on `http://localhost:3001` (no writes, no DB edits, no restart). Native-Shopify-first fixes, recommendation only — no code applied. Skill refs: `link-audit`, `image-optimize`.

## Severity key
P0 security/data-loss · P1 checkout/pricing/order failure · P2 major workflow failure (discovery/indexation/browse) · P3 partial feature / usability · P4 cosmetic.

## Surface audited
- **Catalog API:** `GET /api/products` (`server.js:583`), `GET /api/products/:slug` (`server.js:636`), `GET /api/product-page-data` (`server.js:3920`). Returns 4 active products: `affordable-custom-roller-blinds`, `affordable-custom-zebra-shades`, `affordable-custom-roman-shades`, `affordable-custom-honeycomb-shades` — each with structured `light_control`, `recommended_rooms`, `specs`, `seo`.
- **Page routes:** `/` → `index.html` (`server.js:6113`); `/shop`, `/products`, `/category/:slug` → `shop.html` (`server.js:6118-6130`); `/product/affordable-custom-zebra-shades` & `/zebra-product` → `zebra-product.html` (`server.js:6133-6140`); generic `/product/:slug` → `product.html` (`server.js:6143`).
- **SEO surfaces:** static `frontend/public/robots.txt` + `frontend/public/sitemap.xml` (both served); dynamic `GET /sitemap.xml` (`server.js:6025`) + `GET /robots.txt` (`server.js:6084`); per-page `<title>`/meta/canonical/OG/`ld+json` in `index.html`, `shop.html`, `product.html`, `zebra-product.html`.
- **Browse/filter:** `shop.html` client-side catalog + faceted filter engine (`applyAllFilters`, `frontend/public/shop.html:2269`).
- **Static mount:** `app.use(express.static('frontend/public'))` at `server.js:433` (precedes all SEO route handlers).

## What is already correct (verified, no change)
- **All 4 products active and reachable.** `GET /api/products` returns 4 products, all `is_active:true`, `is_discontinued:false`. Clean routes resolve: `/product/affordable-custom-{roller-blinds,zebra-shades,roman-shades,honeycomb-shades}` → **200** each; aliases `/shop`, `/products` → **200**.
- **No broken internal links from the homepage.** Link-audit of all 15 unique internal `href`s in `index.html` (nav + product cards + policies + assets) → **all 200** (`/`, `/shop.html`, `/cart.html`, `/account.html`, `/contact.html`, `/faqs.html`, `/login.html`, `/signup.html`, `/page.html`, `/returns.html`, `/assets/theme/pk-home.css`, and the 4 `/product/*` detail URLs).
- **Product cards link via clean URLs.** `shop.html:1968` renders cards with `onclick=... '/product/${product.slug}'` — clean, canonical-friendly URLs, not `.html`.
- **Product imagery resolves.** All 4 product/category images return **200 image/jpeg** (`roller-/zebra-/roman-/honeycomb-shades-optimized.jpg`, 103–163 KB).
- **Alt-text coverage is complete.** `index.html` 21/21 `<img>` carry `alt`; `product.html` 113/113 `<img>` carry `alt`. Product-card template sets `alt="${product.name}"` (`shop.html:1969`).
- **`shop.html` + `zebra-product.html` carry canonical + Open Graph.** Both have `<title>`, meta description, `rel=canonical`, and `og:*` tags (though see DC-006/DC-009 for defects within them).
- **robots.txt is served and blocks sensitive zones.** Live `/robots.txt` disallows `/admin/`, `/api/`, `/dealer/`, plus `login/signup/account` pages, and references the sitemap.
- **Structured catalog data exists in the API** (the raw material a native Search & Discovery filter needs): each product exposes `light_control{lightFiltering,roomDarkening,blackout}`, `recommended_rooms[]`, `specs.material`, and a per-product `seo{title,description,keywords}` object.

---

## CONFIRMED defects

### BUG-A-DC001 — `product.html` emits a hardcoded canonical to a 404 URL, identical across Roller/Roman/Honeycomb (duplicate-content + broken canonical) (Stage 0.1) 🟠
- **File:** `frontend/public/product.html:8` — `<link rel="canonical" href="https://peekabooshades.com/products/roller-shades">`. Served for `/product/:slug` (`server.js:6143`) → **every** product except Zebra (Roller, Roman, Honeycomb) shares this one static tag. No JS overrides it (grep of `product.html` finds a single static canonical, no `document.querySelector('link[rel=canonical]')` rewrite).
- **Severity:** **P2** · **Category:** SEO / indexation (duplicate content + dangling canonical) — Discovery & SEO Agent deliverable "canonical tags … indexation health".
- **Root-cause justification:** the product template is a static shell reused for 3 distinct products; its canonical is frozen to one product and, worse, to a URL path (`/products/roller-shades`, plural `products`) that no route serves. Search engines are told (a) three different product pages are duplicates of one URL, and (b) that URL does not exist → the whole product catalog risks being dropped from the index or consolidated onto a dead target.
- **Real reproduced example:**
  - `GET /product/affordable-custom-roman-shades` → canonical `https://peekabooshades.com/products/roller-shades`
  - `GET /product/affordable-custom-honeycomb-shades` → canonical `https://peekabooshades.com/products/roller-shades` (identical)
  - `GET /products/roller-shades` (the canonical target) → **HTTP 404**.
- **PROPOSED FIX (native-first, recommendation only):** In Shopify the product template's canonical is emitted natively as `{{ canonical_url }}` per product — adopting the native product template removes this class of bug entirely. For the current Node shell as an interim: make the canonical self-referential to the actual served URL (`https://peekabooshades.com/product/{slug}`), derived from the product data already fetched for the page, instead of a hardcoded string. No front-end redesign — a single tag value.

### BUG-A-DC002 — `product.html` serves Roller Blinds `<title>` + meta description for Roman & Honeycomb pages (wrong/duplicate SERP metadata) (Stage 0.1) 🟠
- **File:** `frontend/public/product.html:6-7` — static `<title>Affordable Custom Roller Blinds & shades | …</title>` and `<meta name="description" content="Affordable Roller Blinds: The Perfect Blend of Durability and Elegance…">`. Shared by all `product.html`-served pages.
- **Severity:** **P2** · **Category:** SEO / on-page metadata (wrong + duplicate titles/descriptions).
- **Root-cause justification:** the title/description are baked into the shared shell rather than rendered from each product's own `seo{}` object (which the API already returns — e.g. Roller's `seo.title:"Custom Roller Shades | Peekaboo Shades"`). Result: the Roman and Honeycomb product pages tell crawlers they are "Affordable Custom Roller Blinds", producing duplicate titles and topically-wrong SERP snippets for 2 of 4 products.
- **Real reproduced example:** `GET /product/affordable-custom-roman-shades` → `<title>Affordable Custom Roller Blinds & shades |Blackout & Semi blackout shades…</title>` and `meta description "Affordable Roller Blinds: The Perfect Blend…"` — a Roman-shades URL fully labeled as Roller Blinds.
- **PROPOSED FIX (native-first):** Shopify product templates render `<title>{{ product.metafields… | default: product.title }}</title>` and description from the product's SEO metafields per product — native fix. Interim (current shell): populate `<title>`/description from the per-product `seo{}` object already available in `/api/products` / `/api/products/:slug`, keyed by slug. Recommendation only.

### BUG-A-DC003 — Stage 1.2 faceted filters (Room / Color / Light Control / Material) are simulated substring matches over name/description and ignore the real product attributes → wrong/empty results (Stage 1.2) 🟠
- **File:** `frontend/public/shop.html:2287-2361` (`applyAllFilters`). The code comment states verbatim: *"Room, Color, Light Control, and Material filters would need product data to include these attributes // For now, we'll simulate filtering by product name/description matching (as a demonstration)."* Filters test `p.name`/`p.description` for the filter string, not the structured fields.
- **Severity:** **P2** · **Category:** Browse/catalog — major workflow failure (faceted filtering returns wrong sets). Catalog Agent deliverable "Working filters … Faceted filtering by type/opacity/control/price".
- **Root-cause justification:** `loadProducts` (`shop.html:1907`) loads the full API objects — which **do** carry `light_control{}`, `recommended_rooms[]`, `specs.material` — into `allProducts`, but `applyAllFilters` discards those fields and matches the filter label as a substring of name/description. Since product names/descriptions never contain words like "blackout" or "living room", the filters exclude products that genuinely have the attribute. The price filter (`shop.html:2278`) and category tabs work correctly; the attribute facets do not.
- **Real reproduced example (against live `/api/products` data):**
  - **Light Control = "Blackout":** 3 of 4 products have `light_control.blackout:true` (Roller, Roman, Honeycomb), but 0 of 4 contain "blackout" in name+description → applying the Blackout facet yields **0 products** despite 3 being blackout-capable.
  - **Room = "Living Room":** Roller's `recommended_rooms` = `["living-room","bedroom","office"]`, but "living room" is absent from its name/description and there is no living-room special-case (`shop.html:2298-2300`) → Roller is **excluded** from the Living Room filter it should match.
- **PROPOSED FIX (native-first):** In Shopify this is owned by **Search & Discovery filters** driven by product metafields/tags (opacity/room/material as metafields) — the native mechanism the journey doc specifies for 1.2. Interim (current shell, no redesign): change `applyAllFilters` to test the structured fields already present on each product (`p.light_control.blackout`, `p.recommended_rooms.includes(room)`, `p.specs.material`) instead of name substrings. UI/markup unchanged. Recommendation only.

### BUG-A-DC004 — Served `sitemap.xml` omits every real product-detail URL; lists the generic configurator instead (Stage 0.1) 🟠
- **File:** `frontend/public/sitemap.xml` (16 `<loc>` entries, served because static middleware precedes the dynamic handler — see DC005).
- **Severity:** **P3** · **Category:** SEO / crawl-discovery (indexation health).
- **Root-cause justification:** the static sitemap was authored by hand against page filenames, so it lists `product.html` (the generic configurator with no product context) and `zebra-product.html`, but **none** of the 4 canonical product URLs customers and internal links actually use (`/product/affordable-custom-*`). The pages that should rank (the real product detail pages) are absent from the sitemap, while a contextless template URL is advertised.
- **Real reproduced example:** `GET /sitemap.xml` `<loc>` list contains `/`, `/shop.html`, `/product.html`, `/zebra-product.html`, `/samples.html`, … but **grep for `/product/` → 0 matches**. The 4 real product URLs are not present.
- **PROPOSED FIX (native-first):** Shopify auto-generates `/sitemap.xml` (+ `sitemap_products_1.xml`) from live products/collections — adopting the native sitemap makes this self-maintaining and correct. Interim: the dynamic handler at `server.js:6025` already enumerates `products.filter(active).map(p => '/product/'+p.slug)` correctly — route it ahead of static (see DC005) or regenerate the static file from it. Recommendation only.

### BUG-A-DC005 — Dynamic `/sitemap.xml` and `/robots.txt` handlers are dead code (shadowed by static middleware) (Stage 0.1) 🟠
- **File:** `server.js:6025` (`GET /sitemap.xml`) and `server.js:6084` (`GET /robots.txt`), both registered **after** `express.static('frontend/public')` at `server.js:433`. Express matches the static file first, so the handlers never run.
- **Severity:** **P3** · **Category:** Dead code / SEO correctness (the correct behavior exists but is unreachable).
- **Root-cause justification:** middleware order determines precedence — because `sitemap.xml`/`robots.txt` exist as physical files under `frontend/public`, the static handler responds and the route handlers are never reached. The dynamic sitemap is the *good* one (it enumerates product + `/shop?category=` pages from the DB); the static one that actually serves is the incomplete one (DC004). So the more-correct generator is masked by the less-correct file.
- **Real reproduced example:** live `GET /robots.txt` returns the **static** body (contains the `# https://peekabooshades.com/robots.txt` comment and `Crawl-delay: 1`, both unique to the static file and absent from the `server.js:6084` template). Live `GET /sitemap.xml` returns the 16-URL static file (with XML comments like `<!-- Homepage -->`), not the DB-driven handler output.
- **PROPOSED FIX (native-first):** On Shopify, robots/sitemap are platform-owned — the custom handlers become obsolete. For the current app: either delete the static `sitemap.xml`/`robots.txt` files so the dynamic handlers take effect, or delete the dead handlers and regenerate the static files — do not keep two competing sources. Recommendation only (no code applied).

### BUG-A-DC006 — Open Graph `og:image` URLs return 404 (broken social-share previews) (Stage 0.2) 🟡
- **Files:** `shop.html:19` → `og:image = /images/og-image.jpg`; `zebra-product.html:19` → `og:image = /images/zebra-shades-og.jpg`. Same missing `og-image.jpg` referenced by `blog.html` and `samples.html`.
- **Severity:** **P3** · **Category:** SEO / social distribution (answer-engine & referral surface, Stage 0.2).
- **Root-cause justification:** the OG image assets were never added to `frontend/public/images/`, so any share of these pages (Facebook/LinkedIn/iMessage/Slack unfurl) renders with a broken or blank preview image, weakening the referral/awareness channel the Discovery agent owns.
- **Real reproduced example:** `GET /images/og-image.jpg` → **HTTP 404** (158 B HTML error body); `GET /images/zebra-shades-og.jpg` → **HTTP 404**. Both are referenced as `og:image` on live pages.
- **PROPOSED FIX (native-first):** host the OG images on Shopify Files/CDN and reference the CDN URL (per `image-optimize` "never expose local paths"), or add the missing assets under `frontend/public/images/` and verify they 200. Recommendation only.

### BUG-A-DC007 — No structured data (Product/Breadcrumb/FAQ) on any primary storefront page (Stage 0.1) 🟡
- **Files:** `index.html`, `shop.html`, `product.html`, `zebra-product.html` — each has **0** `application/ld+json` blocks. (Note: `landing/*.html` pages *do* carry structured data, so the omission on the money pages is inconsistent, not intentional.)
- **Severity:** **P3** · **Category:** SEO / rich-results eligibility. Discovery & SEO Agent explicit deliverable: "Structured data (Product/Breadcrumb/FAQ)".
- **Root-cause justification:** the product/home/shop templates never emit Product or BreadcrumbList JSON-LD, so the store is ineligible for product rich results (price/rating/availability), breadcrumb SERP display, and merchant/answer-engine ingestion — the core Stage 0.1/0.2 asset.
- **Real reproduced example:** `grep -c application/ld` → `index.html:0`, `shop.html:0`, `product.html:0`, `zebra-product.html:0`. All four primary pages lack any structured data, despite the API exposing everything a `Product` schema needs (name, description, image, price, brand).
- **PROPOSED FIX (native-first):** Shopify themes ship Product + Breadcrumb JSON-LD natively (Dawn's `structured-data` / `json-ld` snippets) rendered per product — adopting the native product/collection templates delivers this. Interim: emit a `Product` JSON-LD block on the product template and `BreadcrumbList` on category/product, sourced from the existing product data. Recommendation only.

### BUG-A-DC008 — Homepage (`index.html`) has no canonical, no Open Graph, no Twitter card (Stage 0.1) 🟡
- **File:** `frontend/public/index.html` — `rel=canonical`: 0, `og:*`: 0, `twitter:*`: 0, `ld+json`: 0 (only `<title>` + meta description present).
- **Severity:** **P3** · **Category:** SEO / canonicalization + social.
- **Root-cause justification:** the site's highest-authority page lacks a self-canonical (so param/duplicate variants like `/?utm=` can fragment ranking signals) and has no OG/Twitter metadata (so brand shares of the homepage unfurl with no title/image/description). Every other main template has at least partial OG; the homepage has none.
- **Real reproduced example:** `grep -cE 'canonical|og:|twitter:' index.html` → all **0**; the homepage `<head>` contains only `<title>` and one `<meta name="description">`.
- **PROPOSED FIX (native-first):** Shopify themes emit homepage canonical + OG/Twitter via the theme `<head>` meta snippet automatically. Interim: add a self-referential canonical (`https://peekabooshades.com/`) and OG/Twitter tags (title, description, image, url) to `index.html`. Recommendation only.

### BUG-A-DC009 — Canonical / URL-form inconsistency: pages canonicalize to `.html` while routes + internal links use clean URLs (Stage 0.1) 🔵
- **Files:** `shop.html:12` canonical `…/shop.html` (served at clean `/shop`, `/products`, `/category/:slug`); `zebra-product.html:12` canonical `…/zebra-product.html` (served at clean `/product/affordable-custom-zebra-shades`); `sitemap.xml` lists `.html` throughout; internal links + product cards use clean URLs.
- **Severity:** **P4** · **Category:** SEO / URL hygiene (mild signal dilution).
- **Root-cause justification:** the same content is reachable at both a clean URL and a `.html` URL, and the canonical/sitemap point at the `.html` variant while navigation points at the clean variant — a self-inflicted split of a consistent canonical form. Not broken (canonical still consolidates), but the store advertises two URL shapes for one page.
- **Real reproduced example:** `/shop` (200, linked in nav) declares canonical `https://peekabooshades.com/shop.html`; `/product/affordable-custom-zebra-shades` (200, linked from cards) declares canonical `https://peekabooshades.com/zebra-product.html`. Nav uses one form, canonical uses another.
- **PROPOSED FIX (native-first):** Shopify uses one canonical URL shape (`/products/{handle}`, `/collections/{handle}`) everywhere — native adoption resolves this. Interim: pick the clean URL as canonical on every page and in the sitemap. Recommendation only.

### BUG-A-DC010 — Product/hero imagery served as JPEG (100–163 KB), not WebP/AVIF, and without responsive `srcset` (Stage 1.1) 🔵
- **Files:** `/images/{roller,zebra,roman,honeycomb}-shades-optimized.jpg` (103–163 KB `image/jpeg`); product cards render a single `<img src>` with no `srcset`/`sizes` (`shop.html:1969`).
- **Severity:** **P4** · **Category:** Image handling / performance (`image-optimize`: "Convert to WebP/AVIF where appropriate; generate responsive sizes").
- **Root-cause justification:** despite the `-optimized` filename, images are baseline JPEG with no next-gen format and no responsive variants, so mobile clients download desktop-weight images — slower LCP, which is itself a ranking + conversion factor for the Discovery/Catalog surface.
- **Real reproduced example:** `GET /images/zebra-shades-optimized.jpg` → **200, 163 KB, content-type image/jpeg**; no `.webp`/`.avif` sibling is referenced; card markup has no `srcset`.
- **PROPOSED FIX (native-first):** Shopify CDN serves WebP/AVIF with on-the-fly resizing and the theme's `image_tag`/`image_url` filters generate `srcset` automatically — native adoption covers format + responsive sizing. Interim: upload WebP/AVIF variants and add `srcset`. Recommendation only, no redesign.

### BUG-A-DC011 — First (above-the-fold) product-card image is `loading="lazy"` (LCP penalty) (Stage 1.1) 🔵
- **File:** `frontend/public/shop.html:1969` — the card template applies `loading="lazy"` to every card image, including the first/above-the-fold card.
- **Severity:** **P4** · **Category:** Image handling / performance (`image-optimize`: "never lazy-load the first product image").
- **Root-cause justification:** lazy-loading the LCP image delays its fetch until layout, hurting Largest Contentful Paint on the shop landing view — a measurable Core Web Vitals regression for the primary browse page.
- **Real reproduced example:** every rendered card, including the first, carries `<img src="${product.image_url}" alt="${product.name}" loading="lazy">` — no eager-load exception for the first card.
- **PROPOSED FIX (native-first):** Shopify themes mark the first collection-grid image `loading="eager"` / `fetchpriority="high"`. Interim: set the first card's image to eager, lazy for the rest. Recommendation only.

---

**Summary:** 11 confirmed Stage 0/1 discovery-catalog defects — 3×P2 (broken/duplicate product canonical to a 404, wrong Roller titles on Roman/Honeycomb pages, faceted filters that ignore real attributes and return empty/wrong sets), 5×P3 (sitemap missing all real product URLs, dead-code sitemap/robots handlers, 404 OG images, no Product/Breadcrumb structured data anywhere, homepage missing canonical/OG), 3×P4 (URL-form inconsistency, non-WebP non-responsive images, lazy-loaded LCP image); all reproduced read-only, all fixes native-Shopify-first and recommendation-only.
