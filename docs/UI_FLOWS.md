# UI FLOWS - User Journey Documentation
## Peekaboo Shades E-Commerce Platform

**Version:** 2.0 (Phase 0 Audit)
**Source:** Frontend HTML pages, Backend API endpoints

---

## 1. CUSTOMER STOREFRONT FLOWS

### 1.1 Product Discovery → Purchase Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER JOURNEY                                 │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌─────────────┐
  │  index   │────▶│   shop   │────▶│   product    │────▶│    cart     │
  │  .html   │     │  .html   │     │    .html     │     │   .html     │
  └──────────┘     └──────────┘     └──────────────┘     └──────┬──────┘
       │                │                  │                     │
       │                │                  │                     ▼
       │                │                  │              ┌─────────────┐
       │                │                  │              │  checkout   │
       │                │                  │              │   .html     │
       │                │                  │              └──────┬──────┘
       │                │                  │                     │
       │                │                  │                     ▼
       │                │                  │              ┌─────────────┐
       │                │                  │              │confirmation │
       │                │                  │              │   .html     │
       │                │                  │              └─────────────┘
       │                │                  │
       └────────────────┴──────────────────┴────▶ [Save as Quote option]
```

### 1.2 Page Responsibilities

| Page | Purpose | Key Actions |
|------|---------|-------------|
| `index.html` | Landing page | Browse categories, featured products |
| `shop.html` | Category browse | Filter by product type, view thumbnails |
| `product.html` | Configure product | Select fabric, dimensions, hardware, motors |
| `cart.html` | Review order | Edit quantities, remove items, apply coupons |
| `checkout.html` | Payment | Enter billing/shipping, payment processing |
| `confirmation.html` | Order complete | Display order number, summary |

### 1.3 Product Configuration Flow (product.html)

```
PRODUCT CONFIGURATOR STEPS
==========================

Step 1: PRODUCT TYPE
├── Roller Blinds
├── Zebra Blinds
├── Vertical Blinds
└── Curtain Tracks

Step 2: FABRIC SELECTION
├── Browse fabric grid
├── Filter by: Color, Opacity, Material
├── View swatch details
└── Select fabric

Step 3: DIMENSIONS
├── Width (mm)
├── Height (mm)
├── Inside/Outside mount
└── Quantity

Step 4: HARDWARE OPTIONS
├── Valance (Closed/Open)
├── Bottom Rail type
├── Side channels
└── Mount brackets

Step 5: MOTOR/CONTROL
├── Manual (chain/cord)
├── AOK Motor (various sizes)
├── Dooya Motor
└── Remote type (single/multi)

Step 6: ACCESSORIES
├── Smart Hub (optional)
├── USB Charger (optional)
└── Extra remotes

Step 7: REVIEW & ADD
├── View calculated price
├── Add to Cart
└── OR Save as Quote
```

### 1.4 API Calls per Step

| Step | API Endpoint | Method |
|------|--------------|--------|
| Load product | `/api/products/:id` | GET |
| Load fabrics | `/api/fabrics?category=:id` | GET |
| Calculate price | `/api/pricing/calculate` | POST |
| Add to cart | `/api/cart` | POST |
| Save quote | `/api/quotes` | POST |

---

## 2. DEALER PORTAL FLOWS

### 2.1 Dealer Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  dealer/     │────▶│   Validate   │────▶│   dealer/    │
│  login.html  │     │   JWT Token  │     │  index.html  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    ├──▶ My Customers
       │                    ▼                    ├──▶ My Orders
       │              ┌──────────┐               ├──▶ My Quotes
       │              │ Redirect │               └──▶ My Invoices
       │              │ to login │
       │              └──────────┘
```

### 2.2 Dealer Order Creation Flow

```
DEALER ORDERING FOR CUSTOMER
============================

1. Select/Create Customer
   └── /api/dealer/customers

2. Configure Product (same as storefront)
   └── Uses product.html with dealer context

3. Apply Dealer Pricing
   └── /api/dealer/pricing/calculate
   └── Uses customer's price level

4. Add to Customer's Cart
   └── /api/dealer/customers/:id/cart

5. Complete Order or Save Quote
   └── /api/dealer/orders OR /api/dealer/quotes
```

### 2.3 Dealer Portal Pages

| Page | Status | Function |
|------|--------|----------|
| `dealer/login.html` | Working | Dealer authentication |
| `dealer/index.html` | Working | Dashboard overview |
| `dealer/customers.html` | Working | Manage customers |
| `dealer/orders.html` | Working | View dealer orders |
| `dealer/quotes.html` | Working | Manage quotes |
| `dealer/invoices.html` | Working | View invoices |

---

## 3. ADMIN PORTAL FLOWS

### 3.1 Admin Authentication

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  admin/      │────▶│   Validate   │────▶│   admin/     │
│  login.html  │     │  Admin JWT   │     │  index.html  │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     Check role: 'admin'
                     Check permissions array
```

### 3.2 Order Management Flow

```
ORDER PROCESSING WORKFLOW
=========================

┌─────────────────┐
│ orders.html     │ ◀─── View all orders, filter by status
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ order-details   │ ◀─── View single order, line items
│ .html           │
└────────┬────────┘
         │
         ├──▶ Update Status (dropdown)
         │    POST /api/admin/orders/:id/status
         │
         ├──▶ Assign Manufacturer
         │    POST /api/admin/orders/:id/assign
         │
         ├──▶ Generate Invoice
         │    POST /api/admin/invoices/generate
         │
         └──▶ View Status History
              GET /api/admin/orders/:id/history
```

### 3.3 Product Management Flow

```
PRODUCT CATALOG MANAGEMENT
==========================

┌─────────────────┐     ┌─────────────────┐
│  products.html  │────▶│ product-editor  │
│  (List view)    │     │ .html           │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Basic Info      │     │ Fabrics         │     │ Hardware        │
│ - Name          │     │ - Assign fabric │     │ - Valance opts  │
│ - Description   │     │ - Set pricing   │     │ - Rail types    │
│ - Images        │     │                 │     │ - Motors        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 3.4 Pricing Configuration Flow

```
PRICING SETUP HIERARCHY
=======================

1. MANUFACTURER COSTS (Cost basis)
   └── manufacturer-pricing.html
       - Per fabric: $/sqm
       - Per hardware option: $ flat or $/sqm
       - Per motor: $ flat

2. CUSTOMER PRICE RULES (Margin rules)
   └── product-pricing.html
       - Price levels: A, B, C, D
       - Margin percentages
       - Rounding rules

3. ACCESSORIES PRICING
   └── hardware-options.html
       - Smart Hub: $ flat
       - USB Charger: $ flat
       - Remotes: $ each

4. CALCULATED PRICE
   └── ExtendedPricingEngine
       Price = (MFR_Cost × (1 + Margin)) + Accessories + Shipping
```

---

## 4. MANUFACTURER PORTAL FLOWS

### 4.1 Manufacturer Authentication

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  manufacturer/   │────▶│   Validate   │────▶│  manufacturer/   │
│  login.html      │     │  MFR JWT     │     │  index.html      │
└──────────────────┘     └──────────────┘     └──────────────────┘
                                │
                                ▼
                         Check role: 'manufacturer'
                         Filter orders by mfr_id
```

### 4.2 Production Workflow

```
MANUFACTURER ORDER PROCESSING
=============================

┌─────────────────────────────────────────────────────────────────────┐
│                     manufacturer/orders.html                         │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ order_received  │     │  manufacturing  │     │       qa        │
│                 │     │                 │     │                 │
│ [Start Mfg] ───▶│     │ [Send to QA]───▶│     │ [Ship] OR       │
│                 │     │                 │     │ [Rework]        │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │     shipped     │
                                                │                 │
                                                │ Add tracking #  │
                                                │ Add ship cost   │
                                                └─────────────────┘
```

### 4.3 Manufacturer API Endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| View orders | `/api/manufacturer/orders` | GET |
| Update status | `/api/manufacturer/orders/:id/status` | POST |
| Add tracking | `/api/manufacturer/orders/:id/tracking` | POST |
| Update shipping cost | `/api/manufacturer/orders/:id/shipping` | POST |
| View analytics | `/api/manufacturer/analytics` | GET |

---

## 5. CHECKOUT & PAYMENT FLOW

### 5.1 Checkout Steps

```
CHECKOUT PROCESS
================

Step 1: CART REVIEW
├── cart.html
├── Validate items still available
├── Calculate totals
└── [Proceed to Checkout]

Step 2: CUSTOMER INFO
├── checkout.html
├── Email, Phone
├── Billing Address
└── Shipping Address (if different)

Step 3: SHIPPING METHOD
├── Standard shipping
├── Express shipping
└── Calculate shipping cost

Step 4: PAYMENT
├── Card details (Stripe)
├── Apply coupon code
└── Review final total

Step 5: CONFIRMATION
├── Create order record
├── Generate invoice
├── Send confirmation email
└── Display confirmation.html
```

### 5.2 Payment Integration

```
PAYMENT PROCESSING
==================

Frontend (checkout.html)
        │
        ▼
POST /api/checkout
        │
        ├──▶ Validate cart items
        ├──▶ Calculate final prices
        ├──▶ Create Stripe PaymentIntent
        │    └── Amount, Currency, Customer
        │
        ▼
Stripe.confirmPayment()
        │
        ├──▶ Success: POST /api/checkout/confirm
        │    └── Create order
        │    └── Generate invoice
        │    └── Clear cart
        │    └── Send email
        │
        └──▶ Failure: Display error
             └── Allow retry
```

---

## 6. INVOICE & FINANCE FLOWS

### 6.1 Invoice Generation

```
INVOICE LIFECYCLE
=================

Order Created
      │
      ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  AUTO-GEN     │────▶│    draft      │────▶│     sent      │
│  Invoice      │     │   Invoice     │     │   Invoice     │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                    │
                            ┌───────────────────────┼───────────┐
                            ▼                       ▼           ▼
                     ┌───────────┐          ┌───────────┐ ┌──────────┐
                     │   paid    │          │  partial  │ │ overdue  │
                     └───────────┘          └───────────┘ └──────────┘
```

### 6.2 Admin Invoice Management

| Page | Function |
|------|----------|
| `invoices.html` | List all invoices, filter by status |
| `invoice-view.html` | View single invoice, print/download |
| `invoice-create.html` | Manual invoice creation |

---

## 7. REPORT GENERATION FLOWS

### 7.1 Available Reports

```
REPORTING HIERARCHY
===================

┌─────────────────────────────────────────┐
│           reports/index.html            │
└────────────────────┬────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
┌────────┐     ┌────────┐      ┌────────┐
│ Sales  │     │ Orders │      │Finance │
│ Report │     │ Report │      │ Report │
└────────┘     └────────┘      └────────┘
    │                │               │
    └────────────────┴───────────────┘
                     │
                     ▼
           Date range selector
           Export: PDF / CSV / Excel
```

### 7.2 Report API Endpoints

| Report | Endpoint | Parameters |
|--------|----------|------------|
| Sales Summary | `/api/reports/sales` | startDate, endDate |
| Orders by Status | `/api/reports/orders` | status, dateRange |
| Revenue by Product | `/api/reports/revenue` | category, period |
| Customer Analytics | `/api/reports/customers` | segment, dateRange |

---

## 8. DATA SYNCHRONIZATION

### 8.1 Real-time Updates (WebSocket)

```
WEBSOCKET EVENTS
================

Server → Client:
├── order_status_changed
├── new_order_received
├── inventory_updated
├── price_updated
└── system_notification

Client → Server:
├── subscribe_orders
├── subscribe_inventory
└── ping/heartbeat
```

### 8.2 Sync Points

| Event | Triggers Update To |
|-------|-------------------|
| Order placed | Admin dashboard, Inventory, Analytics |
| Status change | Order list, Customer notification |
| Price update | Product pages, Cart calculations |
| Invoice paid | Ledger, Reports, Order status |

---

## 9. ERROR HANDLING FLOWS

### 9.1 Common Error Scenarios

```
ERROR RECOVERY PATTERNS
=======================

API Error (4xx/5xx)
├── Display user-friendly message
├── Log to console for debugging
├── Offer retry option
└── Fallback to cached data if available

Authentication Error (401)
├── Clear stored token
├── Redirect to login
└── Preserve return URL

Validation Error (400)
├── Highlight invalid fields
├── Show specific error messages
└── Preserve user input

Network Error
├── Show offline indicator
├── Queue actions for retry
└── Auto-retry when online
```

---

## 10. MOBILE RESPONSIVENESS

### 10.1 Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 576px | Mobile | Single column, stacked |
| 576-768px | Tablet Portrait | 2 columns |
| 768-992px | Tablet Landscape | Sidebar collapsed |
| 992-1200px | Desktop | Full sidebar |
| > 1200px | Large Desktop | Full layout |

### 10.2 Mobile-Specific Flows

- Bottom navigation on mobile
- Swipe gestures for product gallery
- Simplified checkout (single page)
- Touch-friendly fabric selection

---

## APPENDIX: Page Inventory by Portal

### Customer Storefront
- index.html, shop.html, product.html, cart.html, checkout.html, confirmation.html
- about.html, contact.html, faq.html

### Dealer Portal (6 pages)
- login.html, index.html, customers.html, orders.html, quotes.html, invoices.html

### Manufacturer Portal (4 pages)
- login.html, index.html, orders.html, analytics.html

### Admin Portal (58 pages - needs cleanup)
- See ADMIN_SYSTEM_MAP in PHASE0_SYSTEM_AUDIT.md for full inventory
