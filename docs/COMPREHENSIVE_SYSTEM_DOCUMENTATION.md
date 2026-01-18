# Peekaboo Shades - Comprehensive System Documentation

**Version:** 1.0
**Last Updated:** January 2026
**Total API Endpoints:** 579+
**Admin Pages:** 100+

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Business Model & Financial Flow](#business-model--financial-flow)
4. [Admin Panel - Catalog Section](#admin-panel---catalog-section)
5. [Admin Panel - Orders Section](#admin-panel---orders-section)
6. [Admin Panel - Customers Section](#admin-panel---customers-section)
7. [Admin Panel - Marketing Section](#admin-panel---marketing-section)
8. [Admin Panel - Analytics Section](#admin-panel---analytics-section)
9. [Admin Panel - Content Section](#admin-panel---content-section)
10. [Admin Panel - Settings Section](#admin-panel---settings-section)
11. [Admin Panel - Security Section](#admin-panel---security-section)
12. [Portals (Dealer, Technician, Manufacturer)](#portals)
13. [Customer-Facing Pages](#customer-facing-pages)
14. [Pricing Engine](#pricing-engine)
15. [Data Model](#data-model)
16. [API Reference](#api-reference)

---

## System Overview

Peekaboo Shades is a comprehensive custom blinds e-commerce platform with:

- **Frontend**: HTML/CSS/JavaScript (vanilla) with responsive design
- **Backend**: Node.js/Express with JSON file-based database
- **Authentication**: JWT-based with role-based access control
- **Pricing Engine**: Multi-layered pricing with manufacturer costs, margins, and real-time calculations

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Backend | Node.js, Express.js |
| Database | JSON file-based (database.json) |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcryptjs |
| File Storage | Local filesystem |
| Real-time | WebSocket (ws) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PEEKABOO SHADES SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     CUSTOMER-FACING FRONTEND                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │Homepage │ │ Shop    │ │Product  │ │ Cart    │ │Account  │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐ │
│  │                     ADMIN PANEL (35+ pages)                        │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │ │
│  │  │Catalog  │ │Orders   │ │Marketing│ │Analytics│ │Settings │     │ │
│  │  │8 pages  │ │8 pages  │ │7 pages  │ │4+ pages │ │9 pages  │     │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                              │ │
│  │  │Customers│ │Content  │ │Security │                              │ │
│  │  │8 pages  │ │8 pages  │ │8 pages  │                              │ │
│  │  └─────────┘ └─────────┘ └─────────┘                              │ │
│  └─────────────────────────────────┼─────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐ │
│  │                     PORTALS (Role-Based)                           │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐              │ │
│  │  │Dealer Portal│ │ Technician  │ │ Manufacturer    │              │ │
│  │  │  6 pages    │ │ Portal 7pg  │ │ Portal 2 pages  │              │ │
│  │  │ Green Theme │ │ Brown Theme │ │ Dark Theme      │              │ │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘              │ │
│  └─────────────────────────────────┼─────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────▼─────────────────────────────────┐ │
│  │                     BACKEND (Express.js)                           │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐         │ │
│  │  │Auth       │ │Pricing    │ │Order      │ │Audit      │         │ │
│  │  │Middleware │ │Engine     │ │Service    │ │Logger     │         │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘         │ │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐         │ │
│  │  │Manufacturer│ │Invoice   │ │CRM Routes │ │Content    │         │ │
│  │  │Service     │ │Service   │ │           │ │Manager    │         │ │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘         │ │
│  └─────────────────────────────────┼─────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────▼─────────────────────────────────┐ │
│  │                     DATABASE (JSON File)                           │ │
│  │  75+ Collections: orders, products, fabrics, customers,            │ │
│  │  invoices, manufacturers, hardwareOptions, ledger, etc.           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Business Model & Financial Flow

The Peekaboo Shades platform implements a comprehensive business model that tracks orders from placement through fulfillment, with full financial tracking including invoices, accounts, profits, and analytics.

### Complete Business Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              PEEKABOO SHADES BUSINESS FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              ORDER FLOW                                           │  │
│   │                                                                                   │  │
│   │   Customer ──→ Website ──→ Order ──→ Admin Review ──→ Manufacturer ──→ Production│  │
│   │       │                      │              │                │                    │  │
│   │       │                      ↓              ↓                ↓                    │  │
│   │       │              ┌──────────────────────────────────────────────────┐        │  │
│   │       │              │           INVOICE GENERATION                      │        │  │
│   │       │              │  ┌─────────────────┐  ┌─────────────────┐        │        │  │
│   │       │              │  │Customer Invoice │  │Manufacturer     │        │        │  │
│   │       │              │  │(Receivables)    │  │Invoice (Payables)│       │        │  │
│   │       │              │  │ - Order Total   │  │ - Production Cost│       │        │  │
│   │       │              │  │ - Tax           │  │ - Materials      │       │        │  │
│   │       │              │  │ - Shipping      │  │ - Labor          │       │        │  │
│   │       │              │  └─────────────────┘  └─────────────────┘        │        │  │
│   │       │              └──────────────────────────────────────────────────┘        │  │
│   │       │                            │                    │                         │  │
│   │       │                            ↓                    ↓                         │  │
│   │       │              ┌──────────────────────────────────────────────────┐        │  │
│   │       │              │           ACCOUNTS & LEDGER                       │        │  │
│   │       │              │  ┌─────────────────┐  ┌─────────────────┐        │        │  │
│   │       │              │  │Accounts         │  │Ledger Entries   │        │        │  │
│   │       │              │  │Receivable (AR)  │  │ - Credits       │        │        │  │
│   │       │              │  │Accounts         │  │ - Debits        │        │        │  │
│   │       │              │  │Payable (AP)     │  │ - Running Balance│       │        │  │
│   │       │              │  └─────────────────┘  └─────────────────┘        │        │  │
│   │       │              └──────────────────────────────────────────────────┘        │  │
│   │       │                            │                                              │  │
│   │       │                            ↓                                              │  │
│   │       │              ┌──────────────────────────────────────────────────┐        │  │
│   │       │              │           PROFITS & MARGINS                       │        │  │
│   │       │              │  ┌─────────────────────────────────────────┐     │        │  │
│   │       │              │  │ Revenue (Customer Invoice Total)         │     │        │  │
│   │       │              │  │ - Costs (Manufacturer Invoice Total)     │     │        │  │
│   │       │              │  │ = Gross Profit                           │     │        │  │
│   │       │              │  │                                          │     │        │  │
│   │       │              │  │ Margin % = (Profit / Revenue) × 100      │     │        │  │
│   │       │              │  │ Default: 40% | Product-specific override │     │        │  │
│   │       │              │  └─────────────────────────────────────────┘     │        │  │
│   │       │              └──────────────────────────────────────────────────┘        │  │
│   │       │                            │                                              │  │
│   │       ↓                            ↓                                              │  │
│   │  Dealer Portal      ┌──────────────────────────────────────────────────┐        │  │
│   │  (B2B Orders)       │           ANALYTICS & REPORTING                   │        │  │
│   │  ┌────────────┐     │  ┌─────────────────┐  ┌─────────────────┐        │        │  │
│   │  │Tier-based  │     │  │Sales Analytics  │  │Financial Reports│        │        │  │
│   │  │Discounts:  │     │  │ - Revenue trends│  │ - P&L statements│        │        │  │
│   │  │Bronze: 15% │     │  │ - Order counts  │  │ - Cash flow     │        │        │  │
│   │  │Silver: 20% │     │  │ - Popular items │  │ - Outstanding AR│        │        │  │
│   │  │Gold:   25% │     │  │ - Customer LTV  │  │ - Overdue AP    │        │        │  │
│   │  └────────────┘     │  └─────────────────┘  └─────────────────┘        │        │  │
│   │  ┌────────────┐     │  ┌─────────────────┐  ┌─────────────────┐        │        │  │
│   │  │Commission  │     │  │Product Analytics│  │Operations KPIs  │        │        │  │
│   │  │Tracking    │     │  │ - Best sellers  │  │ - Avg order time│        │        │  │
│   │  │& Payouts   │     │  │ - Fabric usage  │  │ - Fulfillment % │        │        │  │
│   │  └────────────┘     │  │ - Option trends │  │ - Return rates  │        │        │  │
│   │                     │  └─────────────────┘  └─────────────────┘        │        │  │
│   │                     └──────────────────────────────────────────────────┘        │  │
│   │                                                                                   │  │
│   │   Production ──→ QA ──→ Ready to Ship ──→ Shipped ──→ Delivered ──→ Customer    │  │
│   │                                                                                   │  │
│   └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Financial Components

| Component | Admin Page | Backend Service | Database Collection |
|-----------|------------|-----------------|---------------------|
| **Customer Invoices** | `invoices.html` | `invoice-service.js` | `invoices` (type: 'customer') |
| **Manufacturer Invoices** | `invoices.html` | `invoice-service.js` | `invoices` (type: 'manufacturer') |
| **Accounts** | `accounts.html` | `ledger-service.js` | `accounts`, `ledger` |
| **Profits/Margins** | `products.html`, `analytics.html` | `extended-pricing-engine.js` | `products.margins`, `orders.pricing` |
| **Analytics** | `analytics.html` | `analytics-service.js` | Multiple aggregations |

### Invoice Types

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INVOICE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   CUSTOMER INVOICE (Receivable)      MANUFACTURER INVOICE (Payable) │
│   ┌─────────────────────────┐        ┌─────────────────────────┐    │
│   │ Invoice #: INV-2024-001 │        │ Invoice #: MFR-2024-001 │    │
│   │ Customer: John Doe      │        │ Manufacturer: Blinds Co │    │
│   │                         │        │                         │    │
│   │ Line Items:             │        │ Line Items:             │    │
│   │  - Product Price        │        │  - Fabric Cost          │    │
│   │  - Hardware Options     │        │  - Labor Cost           │    │
│   │  - Motor Upgrade        │        │  - Hardware Cost        │    │
│   │                         │        │                         │    │
│   │ Subtotal:    $500.00    │        │ Subtotal:    $300.00    │    │
│   │ Tax (8%):     $40.00    │        │ Tax:           $0.00    │    │
│   │ Shipping:     $15.00    │        │ Shipping:      $0.00    │    │
│   │ ─────────────────────── │        │ ─────────────────────── │    │
│   │ TOTAL:       $555.00    │        │ TOTAL:       $300.00    │    │
│   │                         │        │                         │    │
│   │ Status: Paid ✓          │        │ Status: Pending         │    │
│   └─────────────────────────┘        └─────────────────────────┘    │
│                                                                      │
│   PROFIT = $555.00 - $300.00 = $255.00 (46% margin)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Accounts Structure

```javascript
// Account Types in the system
{
  "accounts": [
    { "id": "acc-1", "type": "receivable", "name": "Accounts Receivable", "balance": 15000 },
    { "id": "acc-2", "type": "payable", "name": "Accounts Payable", "balance": 8500 },
    { "id": "acc-3", "type": "revenue", "name": "Sales Revenue", "balance": 45000 },
    { "id": "acc-4", "type": "expense", "name": "Cost of Goods Sold", "balance": 27000 }
  ],
  "ledger": [
    { "date": "2024-01-15", "type": "credit", "account": "acc-1", "amount": 555, "orderId": "ORD-001" },
    { "date": "2024-01-15", "type": "debit", "account": "acc-2", "amount": 300, "orderId": "ORD-001" }
  ]
}
```

### Profit Calculation Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    PROFIT CALCULATION                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. PRODUCT PRICING                                            │
│      Manufacturer Cost (per sq meter)     $45.00                │
│      × Area (2m × 1.5m = 3 sq m)          × 3                   │
│      = Base Cost                          $135.00               │
│                                                                 │
│   2. MARGIN APPLICATION                                         │
│      Base Cost                            $135.00               │
│      × (1 + Margin/100)                   × 1.40 (40%)          │
│      = Customer Price                     $189.00               │
│                                                                 │
│   3. HARDWARE & OPTIONS                                         │
│      Motor (AOK AM25)                     + $85.00              │
│      Remote (16 Channel)                  + $35.00              │
│      Valance                              + $25.00              │
│      = Options Total                      $145.00               │
│      × (1 + Margin/100)                   × 1.40                │
│      = Customer Options Price             $203.00               │
│                                                                 │
│   4. ORDER TOTALS                                               │
│      Customer Price                       $392.00               │
│      Tax (8%)                             + $31.36              │
│      Shipping                             + $15.00              │
│      = CUSTOMER TOTAL                     $438.36               │
│                                                                 │
│   5. PROFIT                                                     │
│      Customer Subtotal                    $392.00               │
│      - Manufacturer Cost                  - $280.00             │
│      = GROSS PROFIT                       $112.00               │
│      Margin %                             28.6%                 │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Analytics Dashboard Metrics

| Metric Category | Metrics Tracked | API Endpoint |
|-----------------|-----------------|--------------|
| **Revenue** | Daily/Weekly/Monthly revenue, YoY growth | `/api/admin/analytics/revenue` |
| **Orders** | Order count, average order value, conversion rate | `/api/admin/analytics/orders` |
| **Products** | Best sellers, fabric popularity, option trends | `/api/admin/analytics/products` |
| **Customers** | New vs returning, LTV, geographic distribution | `/api/admin/analytics/customers` |
| **Financials** | AR aging, AP schedule, cash flow, profit margins | `/api/admin/analytics/financial` |
| **Operations** | Fulfillment time, return rate, production queue | `/api/admin/analytics/operations` |

---

## Admin Panel - Catalog Section

**Location:** `/frontend/public/admin/` (8 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Catalog Hub | `catalog/index.html` | Central navigation for all catalog modules |
| Products | `products.html` | Product listing with pricing and margins |
| Product Editor | `product-editor-v2.html` | Visual page builder for product pages |
| Fabrics | `fabrics.html` | Roller and Zebra fabric management |
| Categories | `categories.html` | Product category taxonomy |
| Hardware Options | `hardware-options.html` | Motors, remotes, valances, rails |
| Fabric Collections | `fabric-collections.html` | Themed fabric groupings |
| Fabric Attributes | `fabric-attributes.html` | Opacity, materials, colors, features |

### Key Features

**Products Page:**
- Real-time pricing calculations (24x36 default config)
- Margin hierarchy: Product-specific > Type-based > Default 40%
- Inline margin editing with auto-save
- Stock status management (In Stock/Out of Stock)
- Featured and Active toggle switches

**Fabrics Page:**
- Dual-tab interface (Roller/Zebra)
- Filter types: Blackout, Semi-Blackout, Transparent, Super-Blackout
- Three-tab modal: Basic Info, Details & Pricing, SEO
- Bulk upload support (CSV/JSON)
- Image upload with preview

**Hardware Options:**
- Two-level tab system (Shade Type > Category)
- Pricing types: Flat or Per-square-meter
- Price calculation: `customerPrice = manufacturerCost * (1 + margin/100)`
- 12+ categories per shade type

### API Endpoints

```
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
GET    /api/admin/fabrics
POST   /api/admin/fabrics
PUT    /api/admin/fabrics/:id
GET    /api/admin/hardware/:shadeType/:category
POST   /api/admin/hardware/:shadeType/:category
PUT    /api/admin/hardware/:shadeType/:category/:id
```

---

## Admin Panel - Orders Section

**Location:** `/frontend/public/admin/` (8 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Orders Hub | `orders-hub/index.html` | Navigation to all order operations |
| All Orders | `orders.html` | Order management with status updates |
| Create Order | `create-order.html` | Manual order creation |
| Quotes | `quotes.html` | Pre-sales quote management |
| Invoices | `invoices.html` | Invoice generation and tracking |
| Refunds | `refunds.html` | Refund processing |
| Draft Orders | `draft-orders.html` | Incomplete order pipeline |
| Abandoned Checkouts | `abandoned-checkouts.html` | Cart recovery |

### Order Status Workflow

```
order_placed → order_received → manufacturing → qa → ready_to_ship → shipped → delivered
                    ↓
            issue_reported → refund_requested → refunded

Alternative: cancelled (from any state)
```

### Key Features

**Orders Page:**
- Server-side pagination (25/50/100 per page)
- Filters: Status, Product Type, Date Range
- Auto-delivery feature (mark shipped as delivered after X days)
- Order detail modal with complete breakdown

**Invoices Page:**
- Two invoice types: Customer (receivables), Manufacturer (payables)
- Stats: Total Amount, Paid, Due
- Payment recording with multiple methods
- Batch invoice generation

**Pricing in Orders:**
- Price snapshots captured at order time
- Manufacturer cost tracking
- Margin analysis: `(customer_price - mfr_cost) / mfr_cost * 100`

### API Endpoints

```
GET    /api/admin/orders
PUT    /api/admin/orders/:id/status
GET    /api/admin/invoices
POST   /api/admin/invoices/:id/payment
GET    /api/admin/refunds
POST   /api/admin/refunds/:id/complete
```

---

## Admin Panel - Customers Section

**Location:** `/frontend/public/admin/` (8 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Customers | `customers.html` | Customer list with filtering |
| Customer Detail | `customer.html` | Individual customer profile |
| Accounts | `accounts.html` | Profit tracking and ledger |
| Technicians | `technicians.html` | Installation technician management |
| Trade Applications | `trade/applications.html` | Partner application review |
| Contractors | `trade/contractors.html` | Contractor management |
| Designers | `trade/designers.html` | Designer management |
| Trade Technicians | `trade/technicians.html` | Advanced technician mgmt |

### Tier System

**Designers:**
- Standard: 15% discount
- Preferred: 20% discount
- Elite: 25% discount

**Contractors:**
- Standard: 10% discount
- Preferred: 15% discount
- Premium: 20% discount

### Key Features

**Customers Page:**
- Bulk operations (tag, type change, delete)
- CSV export
- Pagination (20 per page)
- Type filtering (Retail, Designer, Contractor)

**Accounts Page:**
- Ledger entries tracking
- Margin rules management
- Order profitability analysis
- Backfill functionality for missing entries

### API Endpoints

```
GET    /api/admin/customers
POST   /api/admin/customers
PUT    /api/admin/customers/:id
DELETE /api/admin/customers/:id
GET    /api/admin/ledger
GET    /api/admin/dealers
POST   /api/admin/technicians
```

---

## Admin Panel - Marketing Section

**Location:** `/frontend/public/admin/marketing/` (7 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Campaigns | `campaigns.html` | Email campaign management |
| Promotions | `promotions.html` | Discount codes and offers |
| Subscribers | `subscribers.html` | Email list management |
| Automations | `automations.html` | Triggered email sequences |
| Social Media | `social.html` | Multi-platform posting |
| Coupons | `coupons.html` | Coupon code management |
| Pricing Rules | `pricing-promotions.html` | Automatic promotion rules |

### Key Features

**Email Campaigns:**
- 8 product-based templates (Roller, Zebra, Honeycomb, etc.)
- Draft/Scheduled/Sent status tracking
- Open rate and click rate analytics

**Promotions:**
- 4 discount types: Percentage, Fixed, Free Shipping, BOGO
- Usage limits and minimum purchase requirements
- First order only option
- Stackable discount rules

**Automations:**
- Visual workflow builder
- 7 trigger types:
  - When someone subscribes
  - When someone makes a purchase
  - When someone abandons cart
  - On customer's birthday
  - When tag is added
  - On specific date
  - When customer becomes inactive

### API Endpoints

```
GET    /api/admin/marketing/campaigns
POST   /api/admin/marketing/campaigns
GET    /api/admin/marketing/promotions
POST   /api/admin/marketing/automations
GET    /api/admin/marketing/subscribers
```

---

## Admin Panel - Analytics Section

**Location:** `/frontend/public/admin/` (4+ main endpoints)

### Dashboard Tabs

| Tab | Metrics | Charts |
|-----|---------|--------|
| Overview | Revenue, Profit, Customers, AOV | Revenue Trend, Orders by Product |
| Products | Product Type Stats, Distribution | Revenue by Type, Size Distribution |
| Customers | Total, New, Returning, Loyal | Customer Types, Orders by State |
| Finance | Revenue, Costs, Margins | Revenue & Profit Trend |
| Traffic | Page Views, Sessions, Duration | Traffic Sources, Geographic |

### Key Insights Endpoints

**`/api/admin/analytics/product-insights`**
- Product type distribution
- Control system breakdown
- Motor brand popularity
- Size ranges and popular dimensions

**`/api/admin/analytics/customer-insights`**
- Customer segmentation (New/Returning/Loyal)
- Geographic distribution
- Acquisition trends
- Lifetime value analysis

**`/api/admin/analytics/finance-insights`**
- Revenue and gross profit
- Manufacturer cost totals
- Ledger summary
- Invoice statistics

**`/api/admin/analytics/traffic-insights`**
- Page views and sessions
- Traffic sources
- Device types
- Top pages

### Tax Reports

- State-by-state breakdown
- Quarterly summaries
- Effective rate calculation
- CSV export for filing

---

## Admin Panel - Content Section

**Location:** `/frontend/public/admin/` (8 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Content Hub | `content-hub/index.html` | Navigation for content modules |
| Pages | `pages.html` | Static page management |
| Page Builder | `page-builder.html` | Visual drag-and-drop editor |
| FAQs | `faqs.html` | FAQ management (43 pre-written) |
| Blog Posts | `blog/posts.html` | Blog content management |
| Blog Categories | `blog/categories.html` | Blog taxonomy |
| Media Library | `media-library.html` | File/image management |
| Landing Pages | `landing-pages.html` | Campaign page creation |

### Key Features

**Page Builder:**
- Visual drag-and-drop interface
- Responsive preview (Desktop/Tablet/Mobile)
- Section library with pre-built components
- Draft/Publish workflow

**FAQs:**
- 43 pre-written product FAQs
- Categories: Roller, Zebra, Honeycomb, Outdoor, Installation, etc.
- One-click adding of suggested FAQs

**Media Library:**
- Multi-file upload
- Search and filtering
- Storage usage tracking
- Unused asset detection

---

## Admin Panel - Settings Section

**Location:** `/frontend/public/admin/settings/` (9 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Settings Hub | `settings-hub/index.html` | Navigation hub |
| General | `settings.html` | Store info and pricing |
| Shipping Zones | `shipping-zones.html` | Regional shipping rates |
| Payments | `payments.html` | Payment provider config |
| Tax Rates | `tax-rates.html` | State/county tax setup |
| Checkout | `checkout.html` | Checkout flow options |
| Email Notifications | `email-notifications.html` | Transactional emails |
| Lead Times | `lead-times.html` | Production/shipping times |
| Deposits | `deposits.html` | Deposit payment settings |

### Configuration Options

**Shipping Zones:**
- 50 US states + DC coverage
- Standard and Express rates
- Per-zone free shipping thresholds

**Tax Rates:**
- State and county level granularity
- ZIP code targeting
- Trade/reseller exemptions

**Deposit Settings:**
- Tiered deposits by order value:
  - $200-$500: 50%
  - $500-$1000: 40%
  - $1000+: 30%
- B2B different rules option

---

## Admin Panel - Security Section

**Location:** `/frontend/public/admin/security/` (8 pages)

### Pages Overview

| Page | File | Purpose |
|------|------|---------|
| Overview | `index.html` | Security dashboard |
| Audit Logs | `audit-logs.html` | System event logging |
| Permissions | `permissions.html` | RBAC management |
| Sessions | `sessions.html` | Active session monitoring |
| SSO | `sso.html` | Single sign-on configuration |
| Firewall | `firewall.html` | IP blocking and rate limiting |
| Users | `users.html` | Admin user management |
| Two-Factor | `two-factor.html` | 2FA configuration |

### RBAC System

**Roles:**
- **Administrator**: Full system access
- **Manager**: Orders, Products, Customers, Marketing, Content, Reports
- **Editor**: Content/Pages editing, limited page access
- **Viewer**: Read-only access to reports

### Security Features

**Firewall:**
- IP blocking (single, CIDR ranges)
- Geographic blocking by country
- Rate limiting (login attempts, API requests)

**2FA Options:**
- Authenticator App
- SMS Code
- Email Code
- Hardware Security Keys

---

## Portals

### Dealer Portal

**Location:** `/frontend/public/dealer/` (6 pages)
**Theme:** Green (#2d5a27)

| Page | Purpose |
|------|---------|
| Dashboard | Stats overview and quick actions |
| Orders | View and manage dealer orders |
| Customers | Customer management |
| Commissions | Commission tracking |
| New Order | Create orders for customers |
| Login | Authentication |

**Features:**
- Tier-based pricing (Bronze/Silver/Gold)
- Commission tracking
- Price list CSV export

### Technician Portal

**Location:** `/frontend/public/technician/` (7 pages)
**Theme:** Brown (#8E6545)

| Page | Purpose |
|------|---------|
| Dashboard | Job overview and earnings |
| Appointments | Installation scheduling |
| Schedule | Personal availability calendar |
| Payments | Payment tracking |
| Profile | Account settings |
| Login | Authentication |
| Signup | Self-registration |

**Features:**
- Specialty tracking
- Service area management
- Payment recording

### Manufacturer Portal

**Location:** `/frontend/public/manufacturer/` (2 pages)
**Theme:** Dark (#1a1a2e)

| Page | Purpose |
|------|---------|
| Dashboard | Order queue and production status |
| Login | Authentication |

**Order Status Transitions:**
```
order_received → manufacturing → qa → ready_to_ship → shipped
```

---

## Customer-Facing Pages

**Location:** `/frontend/public/` (12+ pages)

| Page | File | Purpose |
|------|------|---------|
| Homepage | `index.html` | Marketing landing with hero slider |
| Shop | `shop.html` | Product listing with filters |
| Product | `product.html` | Product configurator with real-time pricing |
| Zebra Product | `zebra-product.html` | Zebra-specific configurator |
| Cart | `cart.html` | Shopping cart and checkout |
| Samples | `samples.html` | Free sample ordering (max 10) |
| **Sign Up** | `signup.html` | Member registration |
| **Login** | `login.html` | Member authentication |
| **Account** | `account.html` | Customer dashboard |
| Forgot Password | `forgot-password.html` | Password reset |
| Order Lookup | `order-lookup.html` | Order status tracking |
| Page (Dynamic) | `page.html` | CMS-driven content pages |

### Member Account System

#### Sign Up Page (`/signup.html`)

**Features:**
- Social login buttons (Google, Facebook, Apple - Coming Soon)
- Email registration with password strength indicator
- Terms & privacy policy agreement
- Newsletter opt-in
- 15% welcome discount promotion (code: WELCOME15)

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| First Name | text | Yes |
| Last Name | text | Yes |
| Email | email | Yes |
| Phone | tel | No |
| Password | password | Yes (min 8 chars) |
| Confirm Password | password | Yes |
| Newsletter | checkbox | No (default: checked) |
| Terms | checkbox | Yes |

**API Endpoint:** `POST /api/customer/register`

```javascript
// Request
{
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "(555) 123-4567",
  password: "securePassword123",
  newsletter: true,
  source: "website"
}

// Response
{
  success: true,
  token: "jwt_token_here",
  customer: { id, name, email }
}
```

#### Login Page (`/login.html`)

**Features:**
- Social login (Google, Facebook - Coming Soon)
- Email/password authentication
- Remember me option
- Forgot password link
- Password visibility toggle
- Redirect support (`?redirect=/checkout.html`)

**API Endpoint:** `POST /api/customer/login`

```javascript
// Request
{ email: "john@example.com", password: "password", remember: true }

// Response
{ success: true, token: "jwt_token", customer: {...} }
```

#### Account Page (`/account.html`)

**Features:**
- Order history with status
- Saved addresses
- Wishlists/Favorites
- Profile settings
- Reorder functionality

**API Endpoints:**
- `GET /api/customer/orders` - Order history
- `GET /api/customer/profile` - Profile data
- `PUT /api/customer/profile` - Update profile
- `GET /api/customer/addresses` - Saved addresses

### Product Configurator Features

- Dimension inputs (inches/cm/mm conversion)
- Fabric selection with visual swatches
- Control type options (Manual/Cordless/Motorized)
- Hardware options (Valance, Bottom Rail, Roller Type)
- Real-time price calculation
- Configuration JSON capture

---

## Pricing Engine

**Location:** `/backend/services/extended-pricing-engine.js`

### Calculation Flow

```
1. Convert dimensions to square meters
   Area m² = (width_inches × 0.0254) × (height_inches × 0.0254)

2. Apply minimum area rule
   Applied Area = max(calculated, minimum_by_product_type)

3. Look up manufacturer price
   Mfr Cost = Area × pricePerSqMeter

4. Apply margin rules (priority order)
   - Per-fabric margin
   - Product + fabric rule
   - Product type rule
   - Default rule (40%)

5. Calculate options
   - Flat pricing (motor, remote)
   - Per-sqm pricing (valance, bottom rail)

6. Calculate accessories (not multiplied by quantity)
   - Smart Hub: $32.90
   - USB Charger: $7.00

7. Final calculation
   Unit Price = Fabric Base + Margin + Options
   Line Total = (Unit Price × Qty) + Accessories
   Tax = Subtotal × State Rate
   Shipping = Weight-based tier pricing
```

### Price Snapshot

Captured at order time and immutable:
```javascript
{
  captured_at: ISO DateTime,
  manufacturer_price: {
    unit_cost: Decimal,
    total_cost: Decimal,
    source: "manufacturer_price" | "fallback",
    fabric_code: String
  },
  margin: {
    type: String,
    value: Decimal,
    amount: Decimal,
    percentage: Decimal
  },
  customer_price: {
    unit_price: Decimal,
    line_total: Decimal,
    options_total: Decimal,
    options_breakdown: Array,
    accessories_total: Decimal
  }
}
```

---

## Data Model

**Total Collections:** 75+

### Core Entities

**Products:**
```javascript
{
  id, name, slug, description,
  category_slug, base_price,
  is_active, is_featured,
  image_url, features, specs
}
```

**Orders:**
```javascript
{
  id, order_number,
  customer_name, customer_email,
  shipping_address,
  items: [{
    product_id, quantity,
    width, height,
    configuration,
    unit_price, line_total,
    price_snapshot
  }],
  pricing: {
    subtotal, tax, shipping, total,
    manufacturer_cost_total,
    margin_total, margin_percent
  },
  status, status_history,
  created_at, updated_at
}
```

**Invoices:**
```javascript
{
  id, invoiceNumber,
  type: "customer" | "manufacturer",
  status: "draft" | "sent" | "paid" | "overdue",
  orderId, customer,
  items, subtotal, tax, total,
  amountPaid, amountDue,
  paymentMethod, paidDate
}
```

**Ledger Entries:**
```javascript
{
  type: "customer_payment_received" | "manufacturer_payable" |
        "margin_earned" | "refund" | "adjustment",
  orderId, orderNumber,
  debit, credit, balance,
  createdAt
}
```

---

## API Reference

### Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

**Paginated:**
```json
{
  "success": true,
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 25,
  "pages": 6
}
```

### Endpoint Categories

| Category | Count | Base Path |
|----------|-------|-----------|
| Products | 50+ | `/api/admin/products` |
| Orders | 40+ | `/api/admin/orders` |
| Invoices | 20+ | `/api/admin/invoices` |
| Customers | 30+ | `/api/admin/customers` |
| Marketing | 35+ | `/api/admin/marketing` |
| Analytics | 15+ | `/api/admin/analytics` |
| Settings | 25+ | `/api/admin/settings` |
| Security | 20+ | `/api/admin/security` |
| Fabrics | 30+ | `/api/admin/fabrics` |
| Hardware | 25+ | `/api/admin/hardware` |
| Manufacturer | 15+ | `/api/manufacturer` |
| Dealer | 20+ | `/api/dealer` |
| Technician | 15+ | `/api/technician` |
| Public | 30+ | `/api/` |

### Key Endpoints Summary

```
# Products
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id

# Orders
GET    /api/admin/orders
PUT    /api/admin/orders/:id/status
POST   /api/admin/orders/auto-delivery

# Pricing
POST   /api/v1/pricing/calculate
POST   /api/store/price-quote

# Invoices
GET    /api/admin/invoices
POST   /api/admin/invoices/:id/payment
POST   /api/admin/invoices/generate-missing

# Manufacturer Portal
POST   /api/manufacturer/login
GET    /api/manufacturer/orders
PUT    /api/manufacturer/orders/:id/status
POST   /api/manufacturer/orders/:id/tracking

# Dealer Portal
POST   /api/dealer/login
GET    /api/dealer/orders
GET    /api/dealer/commissions

# Public Cart
GET    /api/cart/:sessionId
POST   /api/cart/:sessionId/items
PUT    /api/cart/:itemId
DELETE /api/cart/:itemId
```

---

## File Structure Reference

```
/backend/
├── server.js                    # Main Express server (238KB)
├── database.json                # JSON database
├── middleware/
│   └── auth.js                  # JWT authentication
├── services/
│   ├── extended-pricing-engine.js   # Pricing calculations
│   ├── pricing-engine.js            # Core pricing logic
│   ├── manufacturer-service.js      # Manufacturer portal
│   ├── order-service.js             # Order management
│   ├── audit-logger.js              # Audit logging
│   ├── content-manager.js           # CMS functionality
│   └── database-schema.js           # Schema definitions

/frontend/public/
├── index.html                   # Homepage
├── shop.html                    # Product listing
├── product.html                 # Product configurator
├── cart.html                    # Shopping cart
├── admin/                       # Admin panel (35+ pages)
│   ├── index.html               # Dashboard
│   ├── products.html
│   ├── orders.html
│   ├── customers.html
│   ├── marketing/               # Marketing section
│   ├── security/                # Security section
│   └── settings/                # Settings section
├── dealer/                      # Dealer portal (6 pages)
├── technician/                  # Technician portal (7 pages)
└── manufacturer/                # Manufacturer portal (2 pages)
```

---

## Color Themes

| Component | Primary Color | Usage |
|-----------|---------------|-------|
| Admin Panel | `#8E6545` (Brown) | Headers, buttons, accents |
| Dealer Portal | `#2d5a27` (Green) | Theme color |
| Technician Portal | `#8E6545` (Brown) | Theme color |
| Manufacturer Portal | `#1a1a2e` (Dark) | Theme color |
| Customer Site | `#8E6545` (Brown) | Brand color |

---

## Security Considerations

1. **JWT Authentication**: All admin/portal endpoints require valid tokens
2. **Password Hashing**: bcryptjs with salt rounds
3. **RBAC**: Role-based permissions (Admin, Manager, Editor, Viewer)
4. **Input Validation**: Server-side validation on all endpoints
5. **XSS Prevention**: `escapeHtml()` utility on user input display
6. **Audit Logging**: All significant actions logged with timestamp and user

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial comprehensive documentation |

---

*This documentation was generated from detailed analysis of the complete Peekaboo Shades codebase.*
