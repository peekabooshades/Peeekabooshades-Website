# PEEKABOO SHADES - SITE ARCHITECTURE

## Framework Version: 1.0.0
**Generated:** 2026-01-11
**Source Documents:**
- NON_FUNCTIONAL_ELEMENTS_REPORT.docx
- PEEKABOO_SHADES_QA_DICTIONARY.docx
- Catalog PDF (成品帘总目录册-印刷版-2025.5.16)

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PEEKABOO SHADES PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  CUSTOMER   │  │   ADMIN     │  │   DEALER    │  │MANUFACTURER │        │
│  │   PORTAL    │  │   PORTAL    │  │   PORTAL    │  │   PORTAL    │        │
│  │  (11 pages) │  │ (59 pages)  │  │  (6 pages)  │  │  (2 pages)  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     EXPRESS.JS API LAYER                            │   │
│  │                      (401 endpoints)                                │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Public API  │  Admin API  │  Dealer API  │  Manufacturer API       │   │
│  │  (no auth)   │ (authMW)    │ (dealerMW)   │  (mfrMW)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SERVICES LAYER                                   │   │
│  ├─────────────┬─────────────┬─────────────┬─────────────┬────────────┤   │
│  │  Pricing    │  Invoice    │   Audit     │   Media     │  Analytics │   │
│  │  Engine     │  Service    │   Logger    │   Manager   │  Service   │   │
│  └─────────────┴─────────────┴─────────────┴─────────────┴────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DATABASE LAYER                                   │   │
│  │                  database.json (65 collections)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PORTAL INVENTORY

### 2.1 Customer Frontend (11 pages)

| Page | Path | Purpose | Status |
|------|------|---------|--------|
| Homepage | /index.html | Landing page | WORKING |
| Shop | /shop.html | Product listing | PARTIAL (filters broken) |
| Product Configurator | /product.html | Roller shades builder | WORKING |
| Zebra Configurator | /zebra-product.html | Zebra shades builder | WORKING |
| Cart | /cart.html | Shopping cart | WORKING |
| Contact | /contact.html | Contact form | WORKING |
| Shipping | /shipping.html | Policy page | WORKING |
| Returns | /returns.html | Policy page | WORKING |
| Warranty | /warranty.html | Policy page | WORKING |
| Child Safety | /child-safety.html | Info page | WORKING |
| CMS Page | /page.html | Dynamic CMS page | WORKING |

### 2.2 Admin Portal (59 pages)

| Section | Count | Path | Status |
|---------|-------|------|--------|
| Dashboard | 1 | /admin/index.html | WORKING |
| Sales (Orders, Quotes, Invoices) | 5 | /admin/orders.html, etc. | WORKING |
| Catalog (Products, Fabrics, Hardware) | 12 | /admin/products.html, etc. | WORKING |
| Customers | 2 | /admin/customers.html | WORKING |
| Content (Pages, FAQs, Media) | 6 | /admin/pages.html, etc. | WORKING |
| Marketing | 6 | /admin/marketing/*.html | STUB (no email service) |
| Security | 9 | /admin/security/*.html | PARTIAL (stubs exist) |
| Online Store | 5 | /admin/online-store/*.html | WORKING |
| Settings | 3 | /admin/settings.html, etc. | WORKING |
| Tools | 5 | /admin/api-tester.html, etc. | WORKING |
| Builder Tools | 5 | /admin/page-builder.html, etc. | WORKING |

### 2.3 Dealer Portal (6 pages)

| Page | Path | Purpose | Status |
|------|------|---------|--------|
| Login | /dealer/login.html | Authentication | WORKING |
| Dashboard | /dealer/index.html | Stats overview | WORKING |
| Orders | /dealer/orders.html | Order management | WORKING |
| New Order | /dealer/new-order.html | Create order | WORKING |
| Customers | /dealer/customers.html | Customer CRUD | WORKING |
| Commissions | /dealer/commissions.html | Commission tracking | PARTIAL (no CSV export) |

### 2.4 Manufacturer Portal (2 pages)

| Page | Path | Purpose | Status |
|------|------|---------|--------|
| Login | /manufacturer/login.html | Authentication | WORKING |
| Dashboard | /manufacturer/index.html | Order fulfillment | WORKING |

### 2.5 Landing Pages (9 pages)

Located in `/landing/` - all WORKING:
- roller-shades.html, zebra-shades.html
- blackout-roller-shades.html, blackout-zebra-shades.html
- motorized-roller-shades.html, cordless-shades.html
- light-filtering-roller-shades.html
- window-shades-bedroom.html, window-shades-living-room.html

### 2.6 Guide Pages (5 pages)

Located in `/guides/` - all WORKING:
- index.html
- how-to-measure-for-blinds.html
- zebra-vs-roller-shades.html
- blackout-shades-what-to-know.html
- cordless-vs-motorized.html

---

## 3. API LAYER ARCHITECTURE

### 3.1 Authentication Middleware

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Request with Authorization: Bearer <token>                     │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SELECT MIDDLEWARE BY PATH                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│    ┌────┴────┬────────────┬────────────────┐                   │
│    ▼         ▼            ▼                ▼                   │
│ /api/admin/* /api/dealer/* /api/manufacturer/* /api/public     │
│    │         │            │                │                   │
│    ▼         ▼            ▼                ▼                   │
│ authMiddleware  dealerAuthMW  manufacturerAuthMW  (no auth)    │
│    │         │            │                                     │
│    └────┬────┴────────────┘                                     │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              VERIFY JWT TOKEN                            │   │
│  │         - Check signature with JWT_SECRET                │   │
│  │         - Check expiration                               │   │
│  │         - Set req.admin/req.dealer/req.manufacturer      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Endpoint Categories

| Category | Count | Auth | Example |
|----------|-------|------|---------|
| Public API | ~30 | None | GET /api/products |
| Admin API | ~250 | authMiddleware | GET /api/admin/orders |
| Dealer API | ~20 | dealerAuthMiddleware | GET /api/dealer/orders |
| Manufacturer API | ~10 | manufacturerAuthMiddleware | GET /api/manufacturer/orders |
| Site Content | ~40 | Mixed | GET /api/site-content |
| Analytics | ~20 | authMiddleware | GET /api/admin/analytics/* |
| Upload/Media | ~15 | authMiddleware | POST /api/admin/upload |
| Other | ~16 | Varies | Various utility endpoints |

---

## 4. DATA LAYER ARCHITECTURE

### 4.1 Database Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     database.json                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CATALOG DATA                    TRANSACTIONAL DATA             │
│  ├── products (5)                ├── orders (15)                │
│  ├── categories (6)              ├── quotes (0)                 │
│  ├── fabrics (~50)               ├── invoices (16)              │
│  ├── zebraFabrics                ├── draftOrders                │
│  ├── manufacturerPrices (161)    ├── abandonedCheckouts         │
│  ├── zebraManufacturerPrices     ├── cart                       │
│  ├── motorBrands (3)             └── cartItems                  │
│  └── fabricCategories                                           │
│                                                                 │
│  USER DATA                       FINANCIAL DATA                 │
│  ├── customers (2)               ├── ledger                     │
│  ├── adminUsers (1)              ├── ledgerEntries              │
│  ├── dealerUsers (2)             ├── payments                   │
│  ├── manufacturerUsers (1)       ├── refunds                    │
│  ├── dealers                     ├── expenses                   │
│  ├── dealerCustomers             └── taxRecords                 │
│  ├── dealerOrders                                               │
│  └── users                       CONTENT DATA                   │
│                                  ├── siteContent                │
│  SYSTEM DATA                     ├── productContent             │
│  ├── settings                    ├── pages                      │
│  ├── security                    ├── blogPosts                  │
│  ├── audit_logs                  ├── faqs                       │
│  ├── analyticsEvents             ├── themeSettings              │
│  ├── priceImportLogs             ├── mediaLibrary               │
│  └── emailLogs                   └── cmsContent                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Data Relationships

```
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│  customers  │◄───────│   orders    │───────►│  invoices   │
│             │        │             │        │             │
│  id ────────┼────────┤ customer.id │        │ orderId     │
└─────────────┘        │             │        └─────────────┘
                       │ items[]     │
                       │   ├─ productId ───────► products
                       │   └─ fabricCode ──────► manufacturerPrices
                       └─────────────┘
```

---

## 5. BUSINESS FLOW DIAGRAMS

### 5.1 Customer Purchase Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER PURCHASE FLOW                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐       │
│  │  SHOP  │───►│PRODUCT │───►│  CART  │───►│CHECKOUT│───►│ ORDER  │       │
│  │ browse │    │configure│   │ review │    │ submit │    │complete│       │
│  └────────┘    └────────┘    └────────┘    └────────┘    └────────┘       │
│       │             │             │             │             │            │
│       ▼             ▼             ▼             ▼             ▼            │
│  GET /api/    POST /api/v1/  GET /api/    POST /api/    Invoice auto-     │
│  products     pricing/calc   cart/:id     orders        generated         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Order Fulfillment Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      ORDER FULFILLMENT FLOW                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ADMIN PORTAL                    MANUFACTURER PORTAL                       │
│  ┌──────────────────────────┐   ┌──────────────────────────┐              │
│  │                          │   │                          │              │
│  │  pending ───► confirmed  │   │  manufacturing ──────────┤              │
│  │     │            │       │   │       │                  │              │
│  │     └────► processing ───┼───┼──►    ▼                  │              │
│  │                          │   │  quality_check ──────────┤              │
│  │                          │   │       │                  │              │
│  │                          │   │       ▼                  │              │
│  │                          │   │  ready_to_ship ──────────┤              │
│  │                          │   │       │                  │              │
│  │  ┌───────────────────────┼───┼───────┘                  │              │
│  │  │                       │   │                          │              │
│  │  ▼                       │   │       ▼                  │              │
│  │  shipped ─► delivered ───┼───┼──► completed             │              │
│  │                          │   │                          │              │
│  └──────────────────────────┘   └──────────────────────────┘              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Pricing Calculation Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       PRICING CALCULATION FLOW                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  INPUT                                                                     │
│  ├── productType (roller/zebra)                                            │
│  ├── fabricCode (e.g., RS-001)                                             │
│  ├── width (inches)                                                        │
│  ├── height (inches)                                                       │
│  ├── quantity                                                              │
│  └── options (controlType, motor, valance, bottomRail, accessories)        │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 1: Calculate Area (m²)                                        │  │
│  │  area = max(width(m) × height(m), minArea)                          │  │
│  │  minArea: roller=1.2m², zebra=1.5m²                                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 2: Get Manufacturer Cost                                      │  │
│  │  cost = area × pricePerSqMeter                                      │  │
│  │  (lookup from manufacturerPrices by fabricCode)                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 3: Apply Margin                                               │  │
│  │  basePrice = cost + (cost × marginPercent)                          │  │
│  │  Margin sources: per-fabric → customerPriceRules → default          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 4: Add Options                                                │  │
│  │  + motor brand price (flat)                                         │  │
│  │  + remote type price (flat)                                         │  │
│  │  + valance price (flat or per-m²)                                   │  │
│  │  + bottom rail price (flat)                                         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 5: Calculate Totals                                           │  │
│  │  unitPrice = basePrice + perUnitOptions                             │  │
│  │  lineTotal = (unitPrice × quantity) + accessories                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│         │                                                                  │
│         ▼                                                                  │
│  OUTPUT                                                                    │
│  ├── unitPrice                                                             │
│  ├── lineTotal                                                             │
│  ├── manufacturerCost                                                      │
│  ├── margin                                                                │
│  ├── optionsBreakdown                                                      │
│  └── profitAnalysis                                                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. FILE STRUCTURE

```
peekabooshades-new/
├── backend/
│   ├── server.js                    # Main Express server (401 endpoints)
│   ├── database.json                # JSON database (65 collections)
│   ├── package.json                 # Node.js dependencies
│   ├── config/
│   │   └── system-config.js         # System configuration
│   ├── middleware/
│   │   ├── rbac.js                  # Role-based access control
│   │   └── validation.js            # Input validation
│   ├── routes/
│   │   └── crm-routes.js            # CRM routes
│   ├── services/
│   │   ├── extended-pricing-engine.js  # Main pricing logic
│   │   ├── pricing-engine.js           # Base pricing
│   │   ├── invoice-service.js          # Invoice generation
│   │   ├── audit-logger.js             # Audit trail
│   │   ├── analytics-service.js        # Analytics
│   │   ├── database-schema.js          # Schema definitions
│   │   ├── ledger-service.js           # Financial ledger
│   │   ├── media-manager.js            # Media files
│   │   └── realtime-sync.js            # WebSocket sync
│   └── scripts/
│       └── smoke-test.js            # Smoke test runner
│
├── frontend/
│   └── public/
│       ├── index.html               # Homepage
│       ├── shop.html                # Product listing
│       ├── product.html             # Roller configurator
│       ├── zebra-product.html       # Zebra configurator
│       ├── cart.html                # Shopping cart
│       ├── contact.html, shipping.html, returns.html, warranty.html, child-safety.html
│       ├── page.html                # CMS dynamic page
│       │
│       ├── admin/                   # Admin portal (59 pages)
│       │   ├── index.html           # Dashboard
│       │   ├── orders.html, quotes.html, invoices.html
│       │   ├── products.html, fabrics.html, hardware-options.html
│       │   ├── customers.html, analytics.html, settings.html
│       │   ├── security/            # Security section (9 pages)
│       │   ├── marketing/           # Marketing section (6 pages)
│       │   ├── online-store/        # Store settings (5 pages)
│       │   ├── blog/                # Blog management
│       │   ├── css/admin.css        # Admin styles
│       │   └── js/                  # Admin scripts
│       │
│       ├── dealer/                  # Dealer portal (6 pages)
│       │   ├── login.html, index.html
│       │   ├── orders.html, new-order.html
│       │   ├── customers.html, commissions.html
│       │   └── js/, css/
│       │
│       ├── manufacturer/            # Manufacturer portal (2 pages)
│       │   ├── login.html, index.html
│       │   └── js/, css/
│       │
│       ├── landing/                 # Landing pages (9 pages)
│       ├── guides/                  # Guide pages (5 pages)
│       │
│       ├── css/                     # Global styles
│       ├── js/                      # Global scripts
│       └── images/                  # Images and assets
│
├── docs/                            # Documentation
│   ├── SITE_ARCHITECTURE.md         # This file
│   ├── SITE_SYSTEM_MAP.json         # Machine-readable system map
│   ├── ELEMENT_REGISTRY.json        # Interactive elements registry
│   ├── API_CONTRACTS.md             # API documentation
│   ├── DATA_MODEL.md                # Database schema
│   └── ADMIN_SYSTEM_MAP.md          # Admin navigation audit
│
└── fabric-extractor/                # Python PDF extraction tool
    ├── app.py
    └── requirements.txt
```

---

## 7. NON-FUNCTIONAL ELEMENTS SUMMARY

### 7.1 Statistics

| Category | Count |
|----------|-------|
| **Total Non-Functional Elements** | **127** |
| Broken Links (href="#") | 47 |
| Stub Pages (UI Only) | 12 |
| Buttons with No Action | 28 |
| Admin Features Not Connected | 18 |
| Backend APIs with No UI | 8 |
| Placeholder Functions | 14 |

### 7.2 Critical Issues (Must Fix Before Production)

1. **Security Stub Pages** - 2FA, SSO, Firewall pages exist with UI but no backend
2. **Broken Navigation Links** - 47 links with href="#" across site
3. **Shop Page Filters** - 5 filter functions show placeholder toasts

### 7.3 Stub Pages Summary

| Page | Location | Status |
|------|----------|--------|
| two-factor.html | /admin/security/ | UI only - no backend |
| sso.html | /admin/security/ | UI only - no OAuth |
| firewall.html | /admin/security/ | UI only - no enforcement |
| sessions.html | /admin/security/ | View only - no revocation |
| social.html | /admin/marketing/ | UI only - no integrations |
| campaigns.html | /admin/marketing/ | UI only - no email service |
| automations.html | /admin/marketing/ | UI only - no triggers |
| subscribers.html | /admin/marketing/ | Partial - can't send |

---

## 8. FRAMEWORK RULES

### Rule 1: Element Behavior
Every clickable element MUST be one of:
- **NAVIGATE**: Goes to a real page (no "#")
- **ACTION**: Calls a real endpoint and handles success/error
- **DISABLED**: Visibly disabled with reason (no dead clicks)

### Rule 2: Evidence-Based Content
Every technical/spec claim MUST have a source:
- Priority 1: PDF catalog page reference
- Priority 2: Web source (blinds.com, selectblinds.com, etc.)
- Store in SOURCES_LIBRARY.json

### Rule 3: No Public Interface Changes
- Endpoint paths remain unchanged
- JSON keys remain unchanged
- Payload shapes remain unchanged
- Business logic outputs (pricing, invoice) remain unchanged

---

## 9. QUICK REFERENCE

### Start Servers
```bash
# Backend (Express)
cd backend && npm start      # Port 3001

# Frontend served by Express at http://localhost:3001
```

### Run Smoke Tests
```bash
cd backend && npm run smoke-test
```

### Key Files
| Purpose | File |
|---------|------|
| Main API Server | backend/server.js |
| Database | backend/database.json |
| Pricing Logic | backend/services/extended-pricing-engine.js |
| Invoice Service | backend/services/invoice-service.js |
| Admin Dashboard | frontend/public/admin/index.html |
| Product Configurator | frontend/public/product.html |

### Key Endpoints
| Purpose | Endpoint |
|---------|----------|
| Calculate Price | POST /api/v1/pricing/calculate |
| Create Order | POST /api/orders |
| Get Admin Orders | GET /api/admin/orders |
| Update Order Status | PUT /api/admin/orders/:id/status |
| Generate Invoices | POST /api/admin/invoices/generate-missing |

---

*This architecture document is the source of truth for the PeekabooShades Site Framework.*
