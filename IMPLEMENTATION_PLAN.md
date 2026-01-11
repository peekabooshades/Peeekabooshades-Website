# Peekaboo Shades - Zebra Integration & SEO Implementation Plan

## Executive Summary

This plan ensures **Zebra Shades** has complete feature parity with **Roller Shades** across the entire platform, plus implements comprehensive SEO for both product lines targeting Texas customers.

---

## Current Architecture Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Product Types | ✅ Supported | roller, zebra, honeycomb, roman |
| Pricing Engine | ✅ Zebra Ready | Min area: 1.5 sqm for zebra |
| Manufacturer Prices | ✅ Has 67 zebra fabrics | All with images |
| Orders | ⚠️ Partial | productType derived from category |
| Invoices | ⚠️ Partial | Needs zebra-specific config display |
| Quotes | ⚠️ Partial | Same as orders |
| Analytics | ⚠️ Partial | Category-based, needs product type grouping |
| Reports | ❌ Missing | No product type breakdown |
| Admin Dashboard | ⚠️ Partial | Zebra pricing page exists, needs more |
| SEO | ❌ Minimal | No sitemap, schema, meta descriptions |
| Texas Local Pages | ❌ Missing | Not implemented |
| Guides | ❌ Missing | Not implemented |

---

## Pricing Architecture (Complete Flow)

### Minimum Area Pricing Rule

**IMPORTANT**: Zebra shades have a **1.5 sqm minimum** (vs 1.2 sqm for roller)

```javascript
// Current implementation in extended-pricing-engine.js (Line 320-328)
const MIN_AREA = {
  roller: 1.2,    // 1.2 m² minimum for roller blinds
  zebra: 1.5,     // 1.5 m² minimum for zebra blinds ← Already configured!
  honeycomb: 1.2,
  roman: 1.5
};

const minArea = MIN_AREA[productType] || 1.2;
areaSqMeters = Math.max(areaSqMeters, minArea);  // Apply minimum

// Price calculation
const baseCost = areaSqMeters * pricePerSqMeter;
```

### Pricing Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────┐    ┌─────────────────────┐                  │
│  │ product-pricing.html│    │ zebra-pricing.html  │                  │
│  │ (Full featured)     │    │ (Fabric only)       │                  │
│  │ - Fabrics           │    │ - Fabric prices     │                  │
│  │ - Motors            │    │ - Margins           │                  │
│  │ - Hardware          │    │ ❌ No motors        │                  │
│  │ - Accessories       │    │ ❌ No hardware      │                  │
│  │ - SQM Calculator    │    │ ❌ No accessories   │                  │
│  └─────────┬───────────┘    └─────────┬───────────┘                  │
│            │                          │                               │
│            ▼                          ▼                               │
│  ┌─────────────────────────────────────────────────┐                 │
│  │           API: /api/admin/manufacturer-prices   │                 │
│  │           API: /api/admin/zebra/pricing         │                 │
│  └─────────────────────┬───────────────────────────┘                 │
│                        │                                              │
└────────────────────────┼──────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATABASE (database.json)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  manufacturerPrices: [                                               │
│    {                                                                  │
│      fabricCode: "83003A",                                           │
│      fabricName: "Zebra Semi-Blackout 83003A",                       │
│      productType: "zebra",         ← Product type filter             │
│      pricePerSqMeter: 45,          ← Manufacturer cost               │
│      pricePerSqMeterCordless: 55,  ← Cordless cost                   │
│      manualMargin: 40,             ← Margin for manual               │
│      cordlessMargin: 40,           ← Margin for cordless             │
│      minAreaSqMeter: 1.5,          ← Minimum area                    │
│      image: "/images/fabrics/zebra/83003A.png",                      │
│      hasImage: true,                                                  │
│      status: "active"                                                 │
│    },                                                                 │
│    ... 66 more zebra fabrics ...                                     │
│    ... roller fabrics ...                                            │
│  ]                                                                    │
│                                                                       │
│  zebraFabrics: [...]        ← Duplicate for zebra-specific APIs      │
│  zebraManufacturerPrices: [...]                                      │
│                                                                       │
└─────────────────────────┬───────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PRICING ENGINE                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  POST /api/v1/pricing/calculate                                      │
│  └─► extendedPricingEngine.calculateCustomerPrice({                  │
│        productType: "zebra",                                         │
│        fabricCode: "83003A",                                         │
│        width: 48,  // inches                                         │
│        height: 60, // inches                                         │
│        options: { controlType: "cordless", motorBrand: ... }         │
│      })                                                               │
│                                                                       │
│  Calculation Steps (extended-pricing-engine.js):                     │
│  1. Convert inches to meters: 48" x 60" = 1.22m x 1.52m = 1.85 m²   │
│  2. Check minimum area: 1.85 > 1.5 ✓ (no adjustment needed)         │
│  3. Get fabric price: $45/m² (from manufacturerPrices)               │
│  4. Calculate base: 1.85 × $45 = $83.25                              │
│  5. Add cordless premium: +$10/m² × 1.85 = $18.50                    │
│  6. Apply margin: $101.75 × 1.40 = $142.45                           │
│  7. Add motor (if motorized): +$45 × 1.40 = $63                      │
│  8. Add hardware/accessories                                          │
│  9. Return final price                                                │
│                                                                       │
│  Small Window Example (below minimum):                               │
│  - 24" x 24" = 0.61m × 0.61m = 0.37 m²                               │
│  - Min area for zebra: 1.5 m²                                        │
│  - Charge for: 1.5 m² (not 0.37 m²)                                  │
│  - Base cost: 1.5 × $45 = $67.50                                     │
│                                                                       │
└─────────────────────────┬───────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND PRODUCT PAGES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  zebra-product.html                                                  │
│  └─► Loads fabrics from /api/fabrics/zebra                          │
│  └─► Loads options from /api/products/:slug/options                  │
│  └─► Calculates price via /api/v1/pricing/calculate                  │
│  └─► Shows:                                                           │
│      - 67 fabric swatches with images                                │
│      - Dimension inputs (width/height)                               │
│      - Control type (Manual, Cordless, Motorized)                    │
│      - Motor brand options                                           │
│      - Real-time price updates                                       │
│                                                                       │
│  product.html (Roller)                                               │
│  └─► Same flow but productType = "roller"                            │
│  └─► Min area = 1.2 m² instead of 1.5 m²                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Admin Pricing Pages

| Page | URL | Features | Status |
|------|-----|----------|--------|
| **Product Pricing** | `/admin/product-pricing.html` | Full featured: Fabrics, Motors, Hardware, Accessories, SQM Calculator | ✅ Works for ALL product types including zebra |
| **Zebra Pricing** | `/admin/zebra-pricing.html` | Fabric prices + margins only | ⚠️ Limited - missing motor/hardware sections |

**RECOMMENDATION**: Use `product-pricing.html` for zebra - it auto-detects zebra products and loads zebra fabrics from `manufacturerPrices` where `productType = 'zebra'`.

### Price Components

| Component | Pricing Type | Zebra Support | Source |
|-----------|-------------|---------------|--------|
| **Fabric Base** | Per m² | ✅ Yes | manufacturerPrices.pricePerSqMeter |
| **Cordless Premium** | Per m² | ✅ Yes | manufacturerPrices.pricePerSqMeterCordless |
| **Motorized** | Flat | ✅ Yes | Motor brands (AOK: $45, Dooya: $47) |
| **Remote** | Flat | ✅ Yes | Remote types (1ch: $4.40, 6ch: $6.60) |
| **Valance/Cassette** | Per m² | ✅ Yes | Hardware options ($2.20/m²) |
| **Bottom Rail** | Per m² | ✅ Yes | Hardware options ($2.20/m²) |
| **Solar Panel** | Flat | ✅ Yes | $15 flat |
| **Smart Hub** | Flat | ✅ Yes | $23.50 flat |
| **USB Charger** | Flat | ✅ Yes | $5 flat |

### Margin Application

```javascript
// Margin priority (extended-pricing-engine.js lines 470-502)
1. Per-fabric margin (admin override for specific fabric)
2. Product + Fabric specific rule
3. Product specific rule
4. Product type specific rule (e.g., all zebra = 40%)
5. Default rule (40%)

// Customer price formula
customerPrice = manufacturerCost × (1 + marginPercent / 100)

// Example: $45 mfr cost with 40% margin
customerPrice = $45 × 1.40 = $63
```

### Pricing → Orders → Invoices Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. PRODUCT PAGE (zebra-product.html)                                │
│     └─► Customer selects: Fabric 83003A, 48"x60", Cordless          │
│     └─► Real-time price via /api/v1/pricing/calculate               │
│     └─► Price breakdown shown: Base $XX + Cordless $XX = $XXX       │
│                                                                       │
│  2. ADD TO CART                                                       │
│     └─► Cart item stored with:                                       │
│         - productSlug: "affordable-custom-zebra-shades"             │
│         - fabricCode: "83003A"                                       │
│         - dimensions: { width: 48, height: 60 }                      │
│         - options: { controlType: "cordless" }                       │
│         - priceSnapshot: { ... frozen prices ... }                   │
│                                                                       │
│  3. CHECKOUT → ORDER CREATED                                         │
│     └─► order.items[] contains zebra products                        │
│     └─► order.items[].product_type = "zebra"                        │
│     └─► order.items[].configuration = { fabricCode, dims, options } │
│     └─► order.items[].price_snapshot = { mfrCost, margin, final }   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN ORDER PROCESSING                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  4. ORDERS PAGE (/admin/orders.html)                                 │
│     └─► Lists all orders (roller + zebra mixed)                     │
│     └─► Filter by product type (TODO: Add zebra filter)             │
│     └─► Shows order items with configuration                         │
│                                                                       │
│  5. INVOICE GENERATION (invoice-service.js)                          │
│                                                                       │
│     Customer Invoice:                                                 │
│     ┌─────────────────────────────────────────┐                      │
│     │ Invoice #INV-2026-001                   │                      │
│     │ Customer: John Doe                       │                      │
│     │─────────────────────────────────────────│                      │
│     │ Item: Zebra Shades 83003A               │                      │
│     │ Size: 48" x 60"                         │                      │
│     │ Control: Cordless                        │                      │
│     │ Price: $142.45                           │                      │
│     │─────────────────────────────────────────│                      │
│     │ Total: $142.45                           │                      │
│     └─────────────────────────────────────────┘                      │
│                                                                       │
│     Manufacturer Invoice:                                             │
│     ┌─────────────────────────────────────────┐                      │
│     │ MFR Invoice #MFR-2026-001               │                      │
│     │─────────────────────────────────────────│                      │
│     │ Fabric: 83003A (Zebra Semi-Blackout)    │                      │
│     │ Size: 48" x 60" = 1.85 m²               │                      │
│     │ Control: Cordless                        │                      │
│     │ Mfr Cost: $55/m² × 1.85 = $101.75       │                      │
│     │─────────────────────────────────────────│                      │
│     │ Total Mfr Cost: $101.75                  │                      │
│     │ Your Margin: $40.70 (40%)               │                      │
│     └─────────────────────────────────────────┘                      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REPORTS & ANALYTICS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  6. ANALYTICS (/admin/analytics.html)                                │
│     └─► Revenue by product type                                      │
│     └─► Zebra vs Roller comparison                                   │
│     └─► Top selling zebra fabrics                                    │
│     └─► Margin analysis by product type                              │
│                                                                       │
│  7. REPORTS (TODO: /admin/reports.html)                              │
│     └─► Sales report filtered by product type                        │
│     └─► Profit margins by zebra/roller                               │
│     └─► Fabric performance comparison                                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Files Involved in Pricing Flow

| File | Role | Zebra Support |
|------|------|---------------|
| `extended-pricing-engine.js` | Core pricing calculation | ✅ Full (1.5 sqm min) |
| `server.js` (line 1020-1049) | `/api/v1/pricing/calculate` | ✅ Full |
| `invoice-service.js` | Invoice generation | ✅ Full |
| `order-service.js` | Order creation/validation | ✅ Full |
| `analytics-service.js` | Reports & metrics | ⚠️ Needs product type grouping |
| `zebra-product.html` | Frontend product page | ✅ Full |
| `product-pricing.html` | Admin pricing management | ✅ Full |

---

## Milestone Breakdown

### M1: Foundation & Admin Dashboard Zebra Parity (Days 1-2)
**Goal**: Ensure zebra shades appears correctly across all admin dashboard pages

#### Tasks:
1. **Admin Analytics Enhancement**
   - Add product type breakdown to dashboard widgets
   - Add zebra vs roller comparison metrics
   - Update sales reports to show by product type

2. **Orders Page Enhancement**
   - Ensure zebra orders display correctly
   - Add product type badge/filter
   - Show zebra-specific configuration (chain type, motor brand)

3. **Invoices Enhancement**
   - Add zebra configuration to invoice items
   - Show chain type, motor brand in manufacturer invoice
   - Support zebra pricing in invoice calculations

4. **Quotes Enhancement**
   - Display zebra fabric codes and images
   - Show correct pricing with 1.5 sqm minimum

5. **Reports Page**
   - Add product type filter
   - Add zebra vs roller revenue comparison
   - Profit margin breakdown by product type

#### Deliverables:
- Updated admin dashboard with zebra metrics
- Orders, invoices, quotes showing zebra correctly
- Reports with product type breakdown

---

### M2: SEO Infrastructure & Technical Foundation (Days 3-4)
**Goal**: Create SEO utilities and technical infrastructure

#### Tasks:
1. **SEO Utility Module** (`/backend/services/seo-service.js`)
   - Meta tag generator (title, description, canonical)
   - Open Graph tag generator
   - Twitter Card tag generator
   - JSON-LD schema generators (Organization, Product, FAQ, Breadcrumb, LocalBusiness)

2. **Sitemap Generator**
   - `/sitemap.xml` endpoint
   - Include all static pages
   - Include all product pages
   - Include category pages
   - Include local Texas pages
   - Include guides

3. **Robots.txt**
   - `/robots.txt` endpoint
   - Allow all important pages
   - Disallow admin, api, cart with query params
   - Reference sitemap

4. **Canonical & NoIndex Logic**
   - Canonical tags on all pages
   - NoIndex for filtered/query parameter URLs
   - Base canonical URL strategy

5. **Performance Utilities**
   - Image WebP conversion helper
   - Lazy loading attributes
   - Responsive image srcset generator

#### Deliverables:
- `/api/seo/sitemap.xml`
- `/robots.txt`
- SEO service with all generators
- Performance helper utilities

---

### M3: Money Pages - Category & Landing Pages (Days 5-7)
**Goal**: Create SEO-optimized category landing pages

#### New Pages:
| URL | Target Keyword | H1 |
|-----|---------------|-----|
| `/roller-shades/` | roller shades | Custom Roller Shades for Texas Homes |
| `/blackout-roller-shades/` | blackout roller shades | Blackout Roller Shades - Complete Light Control |
| `/light-filtering-roller-shades/` | light filtering roller shades | Light Filtering Roller Shades |
| `/motorized-roller-shades/` | motorized roller shades | Motorized Roller Shades - Smart Home Ready |
| `/zebra-shades/` | zebra shades | Custom Zebra Shades - Dual Layer Blinds |
| `/blackout-zebra-shades/` | blackout zebra shades | Blackout Zebra Shades |
| `/cordless-shades/` | cordless shades | Cordless Window Shades - Child Safe |
| `/window-shades-for-bedroom/` | window shades for bedroom | Bedroom Window Shades |
| `/window-shades-for-living-room/` | window shades for living room | Living Room Window Shades |

#### Each Page Includes:
- Unique H1 + on-page copy (500-800 words)
- FAQ section (5-8 questions) with schema
- Product grid (filtered by category)
- Internal links to related guides
- Breadcrumb schema
- Meta title/description
- Canonical tag
- Open Graph tags

#### Template Structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- SEO Meta Tags (dynamic) -->
  <!-- JSON-LD Schema (Organization, Breadcrumb, FAQ) -->
</head>
<body>
  <header><!-- Existing header --></header>

  <main>
    <section class="hero">
      <h1>{Target H1}</h1>
      <p class="subtitle">{Value proposition}</p>
    </section>

    <section class="intro-content">
      {Unique 500-800 word content}
    </section>

    <section class="product-grid">
      {Dynamic product listing}
    </section>

    <section class="features">
      {Key features with icons}
    </section>

    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      {5-8 FAQs with schema}
    </section>

    <section class="related-guides">
      {Links to relevant guides}
    </section>

    <section class="cta">
      {Order samples / Get quote}
    </section>
  </main>

  <footer><!-- Existing footer --></footer>
</body>
</html>
```

#### Deliverables:
- 9 new landing pages
- Unique content per page
- FAQ sections with schema
- Internal linking structure

---

### M4: Texas Local Pages (Days 8-9)
**Goal**: Create local SEO pages for Texas cities

#### New Pages:
| URL | Target | H1 |
|-----|--------|-----|
| `/texas/` | Hub page | Custom Window Blinds & Shades in Texas |
| `/dallas-custom-blinds/` | Dallas | Custom Blinds & Shades in Dallas, TX |
| `/austin-window-shades/` | Austin | Window Shades in Austin, TX |
| `/houston-custom-shades/` | Houston | Custom Shades in Houston, TX |
| `/san-antonio-window-blinds/` | San Antonio | Window Blinds in San Antonio, TX |
| `/fort-worth-custom-blinds/` | Fort Worth | Custom Blinds in Fort Worth, TX |

#### Each Local Page Includes:
- City-specific H1 and content
- Service area description
- Local testimonials placeholder
- FAQ about delivery/installation in that city
- LocalBusiness schema (service area, no fake address)
- Links to product categories
- Contact CTA

#### Deliverables:
- 6 Texas local pages
- LocalBusiness schema
- Service area schema

---

### M5: Guides Hub & Content Pages (Days 10-12)
**Goal**: Create educational content hub

#### New Pages:
| URL | Topic |
|-----|-------|
| `/guides/` | Guides hub page |
| `/guides/zebra-vs-roller-shades/` | Comparison guide |
| `/guides/how-to-measure-for-blinds/` | Measurement guide |
| `/guides/blackout-shades-what-to-know/` | Blackout guide |
| `/guides/cordless-vs-motorized/` | Control type guide |

#### Guide Template Includes:
- Long-form content (1500-2500 words)
- Comparison tables
- Pros/cons sections
- "Who it's for" sections
- Step-by-step instructions (where applicable)
- Related product links
- FAQ schema
- Table of contents
- Reading time estimate

#### Deliverables:
- Guides hub with card layout
- 4 comprehensive guides
- Internal linking to products

---

### M6: Policy & Trust Pages (Days 13-14)
**Goal**: Create trust-building policy pages

#### New Pages:
| URL | Content |
|-----|---------|
| `/shipping/` | Shipping information |
| `/returns/` | Return policy |
| `/warranty/` | Warranty information |
| `/child-safety/` | Child safety commitment |
| `/contact/` | Contact form/info |

#### Each Page Includes:
- Clear, scannable content
- FAQ section
- Related links
- Contact information

#### Deliverables:
- 5 policy pages
- Contact form (if backend supports)

---

### M7: PDP SEO Enhancement (Days 15-16)
**Goal**: Enhance product detail pages without redesign

#### Tasks:
1. **Dynamic Meta Tags**
   - Title: "{Product Name} | Custom {Type} Shades | Peekaboo"
   - Description: Dynamic based on product

2. **JSON-LD Product Schema**
   - Name, description, image
   - Price (starting price)
   - SKU (fabric code)
   - Brand: Peekaboo Shades
   - Availability

3. **Breadcrumb Schema**
   - Home > Category > Product

4. **Selected Configuration Summary**
   - Text block showing selected options
   - Visible to search engines

5. **Related Guides Block**
   - Add to PDP below fold
   - Links to relevant guides

#### Deliverables:
- Product schema on all PDPs
- Dynamic meta tags
- Related guides section

---

### M8: Final Integration & QA (Days 17-18)
**Goal**: Complete integration and quality assurance

#### Tasks:
1. **Internal Linking Audit**
   - Ensure all pages cross-link appropriately
   - Category pages link to guides
   - Guides link to products
   - Local pages link to categories

2. **Schema Validation**
   - Test all pages with Google Rich Results Test
   - Fix any schema errors

3. **Performance Audit**
   - Lighthouse scores
   - Image optimization verification
   - Lazy loading confirmation

4. **Indexability Check**
   - Verify robots.txt
   - Verify sitemap includes all pages
   - Check canonical tags
   - Verify filtered URLs are noindex

5. **Documentation**
   - SEO QA checklist
   - Maintenance guide
   - URL reference document

#### Deliverables:
- QA checklist completed
- All schemas validated
- Documentation complete

---

## File Structure (New Files)

```
backend/
├── services/
│   └── seo-service.js          # SEO utilities (NEW)
│
frontend/public/
├── landing/                     # Category landing pages (NEW)
│   ├── roller-shades.html
│   ├── blackout-roller-shades.html
│   ├── light-filtering-roller-shades.html
│   ├── motorized-roller-shades.html
│   ├── zebra-shades.html
│   ├── blackout-zebra-shades.html
│   ├── cordless-shades.html
│   ├── window-shades-bedroom.html
│   └── window-shades-living-room.html
│
├── local/                       # Texas local pages (NEW)
│   ├── texas.html
│   ├── dallas.html
│   ├── austin.html
│   ├── houston.html
│   ├── san-antonio.html
│   └── fort-worth.html
│
├── guides/                      # Educational guides (NEW)
│   ├── index.html               # Hub page
│   ├── zebra-vs-roller.html
│   ├── how-to-measure.html
│   ├── blackout-guide.html
│   └── cordless-vs-motorized.html
│
├── policies/                    # Trust pages (NEW)
│   ├── shipping.html
│   ├── returns.html
│   ├── warranty.html
│   └── child-safety.html
│
├── contact.html                 # Contact page (NEW)
└── robots.txt                   # Robots file (NEW)
```

---

## Routes to Add (server.js)

```javascript
// Category Landing Pages
app.get('/roller-shades', serveFile('landing/roller-shades.html'));
app.get('/blackout-roller-shades', serveFile('landing/blackout-roller-shades.html'));
app.get('/light-filtering-roller-shades', serveFile('landing/light-filtering-roller-shades.html'));
app.get('/motorized-roller-shades', serveFile('landing/motorized-roller-shades.html'));
app.get('/zebra-shades', serveFile('landing/zebra-shades.html'));
app.get('/blackout-zebra-shades', serveFile('landing/blackout-zebra-shades.html'));
app.get('/cordless-shades', serveFile('landing/cordless-shades.html'));
app.get('/window-shades-for-bedroom', serveFile('landing/window-shades-bedroom.html'));
app.get('/window-shades-for-living-room', serveFile('landing/window-shades-living-room.html'));

// Texas Local Pages
app.get('/texas', serveFile('local/texas.html'));
app.get('/dallas-custom-blinds', serveFile('local/dallas.html'));
app.get('/austin-window-shades', serveFile('local/austin.html'));
app.get('/houston-custom-shades', serveFile('local/houston.html'));
app.get('/san-antonio-window-blinds', serveFile('local/san-antonio.html'));
app.get('/fort-worth-custom-blinds', serveFile('local/fort-worth.html'));

// Guides
app.get('/guides', serveFile('guides/index.html'));
app.get('/guides/zebra-vs-roller-shades', serveFile('guides/zebra-vs-roller.html'));
app.get('/guides/how-to-measure-for-blinds', serveFile('guides/how-to-measure.html'));
app.get('/guides/blackout-shades-what-to-know', serveFile('guides/blackout-guide.html'));
app.get('/guides/cordless-vs-motorized', serveFile('guides/cordless-vs-motorized.html'));

// Policies
app.get('/shipping', serveFile('policies/shipping.html'));
app.get('/returns', serveFile('policies/returns.html'));
app.get('/warranty', serveFile('policies/warranty.html'));
app.get('/child-safety', serveFile('policies/child-safety.html'));
app.get('/contact', serveFile('contact.html'));

// SEO
app.get('/sitemap.xml', generateSitemap);
app.get('/robots.txt', serveRobotsTxt);
```

---

## Database Schema Additions

**NO database schema changes required.** All new functionality uses:
- Existing `manufacturerPrices` for products
- Existing `products` for product data
- Existing `categories` for filtering
- New static HTML pages (no database)

---

## API Endpoints (New)

```javascript
// SEO APIs
GET /sitemap.xml                    // Auto-generated sitemap
GET /robots.txt                     // Robots file

// Analytics Enhancement
GET /api/admin/analytics/by-product-type    // Revenue/orders by type
GET /api/admin/reports/product-comparison   // Zebra vs Roller comparison
```

---

## Testing Checklist Per Milestone

### M1 Testing:
- [ ] Admin dashboard shows zebra metrics
- [ ] Orders page displays zebra orders correctly
- [ ] Invoices generate for zebra orders
- [ ] Quotes show zebra pricing
- [ ] Reports filter by product type

### M2 Testing:
- [ ] `/sitemap.xml` returns valid XML
- [ ] `/robots.txt` accessible
- [ ] SEO service generates valid schema
- [ ] Canonical tags render correctly

### M3-M6 Testing:
- [ ] All new pages load
- [ ] Meta tags present
- [ ] JSON-LD validates
- [ ] Internal links work
- [ ] Mobile responsive

### M7 Testing:
- [ ] PDP has product schema
- [ ] Breadcrumbs render
- [ ] Related guides display

### M8 Testing:
- [ ] All pages in sitemap
- [ ] No broken internal links
- [ ] Lighthouse score > 80
- [ ] Schema validates in Google tool

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | All changes are additive; no modification to existing business logic |
| SEO pages not indexed | Submit sitemap to Google Search Console |
| Performance degradation | Lazy loading, WebP images, minimal JS |
| Content duplication | Unique copy per page, canonical tags |

---

## Success Metrics

1. **Technical**
   - All pages return 200 status
   - Sitemap includes all URLs
   - Schema validates without errors
   - Lighthouse performance > 80

2. **SEO (3-6 months)**
   - Pages indexed by Google
   - Rankings for target keywords
   - Organic traffic growth

3. **Business**
   - Zebra orders tracked correctly
   - Accurate reporting by product type
   - Complete invoicing

---

## Next Steps

**Ready to begin M1: Foundation & Admin Dashboard Zebra Parity**

Awaiting your approval to proceed.
