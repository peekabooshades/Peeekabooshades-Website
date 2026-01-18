# PHASE 0 - SYSTEM AUDIT & REORGANIZATION PLAN
## Peekaboo Shades Production Readiness

**Audit Date:** January 11, 2026
**Purpose:** Complete codebase analysis for professional reorganization

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Inventory Summary](#2-inventory-summary)
3. [Data Model](#3-data-model)
4. [API Contracts](#4-api-contracts)
5. [Admin System Map](#5-admin-system-map)
6. [Order Lifecycle](#6-order-lifecycle)
7. [Pages to Remove/Consolidate](#7-pages-to-removeconsolidate)
8. [Broken Elements List](#8-broken-elements-list)
9. [Recommendations](#9-recommendations)

---

# 1. EXECUTIVE SUMMARY

## What Exists
- **394 API endpoints** in server.js
- **64 database collections** in database.json
- **58 admin pages** (many duplicates/stubs)
- **6 dealer portal pages** (functional)
- **2 manufacturer portal pages** (functional)
- **11 customer pages** (mostly functional)

## What Is Broken
- **12 admin pages** are UI stubs with no backend
- **47 navigation links** point to href="#"
- **28 buttons** have no action handlers
- **Shop filters** do not work (placeholder toasts)

## What Is Duplicated
- **5 page builder/editor tools** (Page Builder, Visual Builder, Section Builder, etc.)
- **3 product editors** (product-edit, product-editor-v2, product-page-editor)
- **Multiple content managers** (product-content, product-catalog, online-store)

---

# 2. INVENTORY SUMMARY

## 2.1 Frontend Files

| Category | Count | Location |
|----------|-------|----------|
| Customer Pages | 11 | `/frontend/public/` |
| Admin Pages | 58 | `/frontend/public/admin/` |
| Dealer Pages | 6 | `/frontend/public/dealer/` |
| Manufacturer Pages | 2 | `/frontend/public/manufacturer/` |
| Landing Pages | 9 | `/frontend/public/landing/` |
| Guide Pages | 5 | `/frontend/public/guides/` |
| **TOTAL** | **91** | - |

## 2.2 Backend Files

| Category | Count | Location |
|----------|-------|----------|
| Main Server | 1 | `server.js` (349KB, ~10K lines) |
| Services | 17 | `/backend/services/` |
| Middleware | 3 | `/backend/middleware/` |
| Routes | 1 | `/backend/routes/` |
| Config | 1 | `/backend/config/` |
| Scripts | 27 | `/backend/scripts/` |

## 2.3 API Endpoints by Category

| Category | Count | Auth Required |
|----------|-------|---------------|
| Public Store | 35 | None |
| Admin | 305 | `authMiddleware` |
| Dealer | 15 | `dealerAuthMiddleware` |
| Manufacturer | 8 | `manufacturerAuthMiddleware` |
| Public API v1 | 10 | `apiKeyAuth` |
| WebSocket | 1 | None |
| **TOTAL** | **394** | - |

---

# 3. DATA MODEL

## 3.1 Database Collections (64 total)

### Core Business Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `products` | 5 | Product catalog |
| `categories` | 5 | Product categories |
| `orders` | 1 | Customer orders |
| `invoices` | 1 | Generated invoices |
| `quotes` | 0 | Saved quotes |
| `customers` | 2 | Customer records |
| `draftOrders` | 3 | Draft orders |
| `abandonedCheckouts` | 1 | Abandoned carts |

### Pricing Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `manufacturerPrices` | 161 | Roller fabric MFR costs |
| `zebraManufacturerPrices` | 208 | Zebra fabric MFR costs |
| `zebraFabrics` | 208 | Zebra fabric definitions |
| `customerPriceRules` | 5 | Margin rules |
| `motorBrands` | 4 | Motor pricing |

### User Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `adminUsers` | 1 | Admin accounts |
| `dealerUsers` | 2 | Dealer accounts |
| `manufacturerUsers` | 1 | Manufacturer accounts |
| `users` | 2 | Generic users |
| `dealers` | 0 | Dealer companies |
| `manufacturers` | 1 | Manufacturer companies |

### Content Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `pages` | 3 | CMS pages |
| `blogPosts` | 2 | Blog posts |
| `faqs` | 3 | FAQ entries |
| `siteContent` | object | Site-wide content |
| `productContent` | object | Product page content |
| `pageTemplates` | 6 | Page templates |
| `pageComponents` | 3 | Reusable components |

### Operations Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `orderStatusHistory` | 4 | Status change log |
| `shipments` | 0 | Shipment records |
| `trackingEvents` | 0 | Tracking updates |
| `carriers` | object | Carrier config |

### Finance Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `payments` | 0 | Payment records |
| `refunds` | 0 | Refund records |
| `expenses` | 0 | External expenses |
| `taxRecords` | 0 | Tax records |
| `ledgerEntries` | 2 | Accounting ledger |
| `ledger` | 8 | Legacy ledger |

### System Collections
| Collection | Records | Purpose |
|------------|---------|---------|
| `settings` | object | System settings |
| `security` | object | Security config |
| `analytics` | 447 | Page view analytics |
| `analyticsEvents` | 38 | Custom events |
| `audit_logs` | 141 | Audit trail |
| `notifications` | 2 | Admin notifications |

---

# 4. API CONTRACTS

## 4.1 Public Store Endpoints

### Products
```
GET  /api/categories              → { success, data: Category[] }
GET  /api/products                → { success, data: Product[] }
GET  /api/products/:slug          → { success, data: Product }
```

### Cart
```
GET  /api/cart/:sessionId         → { success, data: CartItem[] }
POST /api/cart                    → { success, data: CartItem }
PUT  /api/cart/:id                → { success, data: CartItem }
DELETE /api/cart/:id              → { success }
```

### Orders
```
POST /api/orders                  → { success, data: Order }
GET  /api/orders/:orderNumber     → { success, data: Order }
```

### Pricing
```
POST /api/calculate-price         → { success, data: PriceBreakdown }
POST /api/v1/pricing/calculate    → { success, data: PriceBreakdown }
POST /api/calculate-order-total   → { success, data: OrderTotal }
```

## 4.2 Admin Endpoints (Key Examples)

### Orders
```
GET  /api/admin/orders            → { success, data: Order[], total, page }
GET  /api/admin/orders/:id        → { success, data: Order }
PUT  /api/admin/orders/:id/status → { success, data: Order }
```

### Invoices
```
GET  /api/admin/invoices          → { success, data: Invoice[], total }
POST /api/admin/invoices/:id/payment → { success }
POST /api/admin/invoices/generate-missing → { success, generated: number }
```

### Products
```
GET  /api/admin/products          → { success, data: Product[] }
POST /api/admin/products          → { success, data: Product }
PUT  /api/admin/products/:id      → { success, data: Product }
DELETE /api/admin/products/:id    → { success }
```

## 4.3 Dealer Endpoints
```
POST /api/dealer/login            → { success, token, dealer }
GET  /api/dealer/stats            → { success, data: Stats }
GET  /api/dealer/orders           → { success, data: Order[] }
POST /api/dealer/orders           → { success, data: Order }
GET  /api/dealer/customers        → { success, data: Customer[] }
GET  /api/dealer/commissions      → { success, data: Commission[] }
```

## 4.4 Manufacturer Endpoints
```
POST /api/manufacturer/login      → { success, token, user }
GET  /api/manufacturer/stats      → { success, data: Stats }
GET  /api/manufacturer/orders     → { success, data: Order[] }
POST /api/manufacturer/orders/:id/status → { success }
POST /api/manufacturer/orders/:id/tracking → { success }
POST /api/manufacturer/orders/:id/shipping → { success }
```

---

# 5. ADMIN SYSTEM MAP

## 5.1 Sidebar Navigation Items

| # | Label | Route | Status | Reason |
|---|-------|-------|--------|--------|
| 1 | Dashboard | `/admin/` | ✅ WORKING | |
| 2 | Orders | `/admin/orders.html` | ✅ WORKING | Slow loading |
| 3 | Quotes | `/admin/quotes.html` | ✅ WORKING | |
| 4 | Invoices | `/admin/invoices.html` | ✅ WORKING | Slow loading |
| 5 | Accounts | `/admin/accounts.html` | ⚠️ PARTIAL | Limited reports |
| 6 | Manufacturer Portal | `/manufacturer/` | ✅ WORKING | External |
| 7 | Dealer Portal | `/dealer/` | ✅ WORKING | External |
| 8 | Products | `/admin/products.html` | ✅ WORKING | |
| 9 | Categories | `/admin/categories.html` | ✅ WORKING | |
| 10 | Fabrics | `/admin/fabrics.html` | ✅ WORKING | |
| 11 | Zebra Pricing | `/admin/zebra-pricing.html` | ✅ WORKING | |
| 12 | Zebra Page Editor | `/admin/zebra-page-editor.html` | ⚠️ PARTIAL | Limited |
| 13 | Hardware Options | `/admin/hardware-options.html` | ✅ WORKING | |
| 14 | Accessories | `/admin/accessories.html` | ✅ WORKING | |
| 15 | Customers | `/admin/customers.html` | ✅ WORKING | |
| 16 | Product Content | `/admin/product-content.html` | ⚠️ DUPLICATE | |
| 17 | Product Page Editor | `/admin/product-page-editor.html` | ⚠️ DUPLICATE | |
| 18 | Page Builder | `/admin/page-builder.html` | ⚠️ DUPLICATE | |
| 19 | Pages | `/admin/pages.html` | ✅ WORKING | |
| 20 | Blog Posts | `/admin/blog/posts.html` | ⚠️ NO PUBLIC | No /blog page |
| 21 | Media Library | `/admin/media-library.html` | ✅ WORKING | |
| 22 | Files | `/admin/files.html` | ❌ MISSING | 404 |
| 23 | FAQs | `/admin/faqs.html` | ✅ WORKING | |
| 24 | Visual Builder | `/admin/visual-builder.html` | ⚠️ DUPLICATE | |
| 25 | Theme Settings | `/admin/theme-settings.html` | ⚠️ PARTIAL | |
| 26 | Image Manager | `/admin/image-manager.html` | ⚠️ DUPLICATE | |
| 27 | Section Builder | `/admin/section-builder.html` | ⚠️ DUPLICATE | |
| 28 | Analytics | `/admin/analytics.html` | ⚠️ PARTIAL | Mock data |
| 29 | System Config | `/admin/system-config.html` | ✅ WORKING | |
| 30 | Settings | `/admin/settings.html` | ✅ WORKING | |
| 31 | Security | `/admin/security/` | ⚠️ MIXED | See below |

## 5.2 Security Section Status

| Page | Status | Backend |
|------|--------|---------|
| Security Overview | ✅ WORKING | Has API |
| Users | ✅ WORKING | Has API |
| Permissions | ⚠️ PARTIAL | Has API |
| Sessions | ❌ STUB | No revoke |
| Audit Logs | ✅ WORKING | Has API |
| Two-Factor | ❌ STUB | No backend |
| SSO | ❌ STUB | No backend |
| Firewall | ❌ STUB | No enforcement |
| API Security | ⚠️ PARTIAL | Partial API |

## 5.3 Marketing Section Status

| Page | Status | Backend |
|------|--------|---------|
| Campaigns | ❌ STUB | No email service |
| Social | ❌ STUB | No OAuth |
| Automations | ❌ STUB | No triggers |
| Subscribers | ⚠️ PARTIAL | Can store only |
| Promotions | ✅ WORKING | Has API |

## 5.4 Online Store Section Status

| Page | Status | Backend |
|------|--------|---------|
| Homepage | ✅ WORKING | Has API |
| Banners | ✅ WORKING | Has API |
| Navigation | ✅ WORKING | Has API |
| Shop Settings | ✅ WORKING | Has API |
| Themes | ⚠️ PARTIAL | No upload |

---

# 6. ORDER LIFECYCLE

## 6.1 Order Status State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER STATUS FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────┐      ┌───────┐      ┌─────────────┐                  │
│  │ draft │ ──▶  │ cart  │ ──▶  │order_placed │                  │
│  └───────┘      └───────┘      └──────┬──────┘                  │
│                                       │                          │
│                                       ▼                          │
│                            ┌─────────────────┐                   │
│                            │ order_received  │ (Payment OK)      │
│                            └────────┬────────┘                   │
│                                     │                            │
│                                     ▼                            │
│                            ┌─────────────────┐                   │
│                            │ manufacturing   │ (In Production)   │
│                            └────────┬────────┘                   │
│                                     │                            │
│                                     ▼                            │
│                            ┌─────────────────┐                   │
│                            │       qa        │ (Quality Check)   │
│                            └────────┬────────┘                   │
│                                     │                            │
│                                     ▼                            │
│                            ┌─────────────────┐                   │
│                            │    shipped      │ (+Tracking)       │
│                            └────────┬────────┘                   │
│                                     │                            │
│                                     ▼                            │
│                            ┌─────────────────┐                   │
│                            │   delivered     │                   │
│                            └─────────────────┘                   │
│                                                                  │
│  Exception States:                                               │
│  • cancelled - From any state                                    │
│  • issue_reported - From manufacturing, qa, shipped, delivered   │
│  • refund_requested - From order_received, delivered             │
│  • refunded - Terminal state                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Valid Transitions (Code Source)

```javascript
// From: backend/services/order-service.js

const VALID_TRANSITIONS = {
  'draft': ['cart', 'cancelled'],
  'cart': ['order_placed', 'cancelled'],
  'order_placed': ['order_received', 'cancelled'],
  'order_received': ['manufacturing', 'refund_requested'],
  'manufacturing': ['qa', 'issue_reported'],
  'qa': ['shipped', 'manufacturing', 'issue_reported'],
  'shipped': ['delivered', 'issue_reported'],
  'delivered': ['issue_reported', 'refund_requested'],
  'issue_reported': ['refund_requested', 'manufacturing', 'cancelled'],
  'refund_requested': ['refunded', 'cancelled'],
  'refunded': [],  // Terminal
  'cancelled': []  // Terminal
};
```

## 6.3 Manufacturer Transitions (Subset)

```javascript
// From: backend/services/manufacturer-service.js

const MFR_VALID_TRANSITIONS = {
  'order_received': ['manufacturing'],
  'manufacturing': ['qa'],
  'qa': ['shipped', 'manufacturing'],
  'shipped': []  // Manufacturer can't change after ship
};
```

---

# 7. PAGES TO REMOVE/CONSOLIDATE

## 7.1 Recommended Removals (12 pages)

### Security Stubs (4 pages)
| Page | Reason |
|------|--------|
| `/admin/security/two-factor.html` | No backend, misleading |
| `/admin/security/sso.html` | No OAuth integration |
| `/admin/security/firewall.html` | No enforcement middleware |
| `/admin/security/sessions.html` | Revoke doesn't work |

### Marketing Stubs (4 pages)
| Page | Reason |
|------|--------|
| `/admin/marketing/campaigns.html` | No email service |
| `/admin/marketing/social.html` | No OAuth integration |
| `/admin/marketing/automations.html` | No trigger system |
| `/admin/marketing/index.html` | Just links to stubs |

### Missing/Broken (2 pages)
| Page | Reason |
|------|--------|
| `/admin/files.html` | 404 - doesn't exist |
| `/admin/blog/posts.html` | No public blog page |

### Unused (2 pages)
| Page | Reason |
|------|--------|
| `/admin/draft-orders.html` | Rarely used workflow |
| `/admin/abandoned-checkouts.html` | No recovery flow |

## 7.2 Recommended Consolidations (Duplicates)

### Content Editors → Keep ONE
| Current | Keep | Remove |
|---------|------|--------|
| page-builder.html | ✅ | - |
| visual-builder.html | - | ❌ |
| section-builder.html | - | ❌ |

### Product Editors → Keep ONE
| Current | Keep | Remove |
|---------|------|--------|
| products.html | ✅ | - |
| product-edit.html | ✅ (modal) | - |
| product-editor-v2.html | - | ❌ |
| product-page-editor.html | - | ❌ |

### Image/Media → Keep ONE
| Current | Keep | Remove |
|---------|------|--------|
| media-library.html | ✅ | - |
| image-manager.html | - | ❌ |

### Content Management → Keep ONE
| Current | Keep | Remove |
|---------|------|--------|
| pages.html | ✅ | - |
| product-content.html | - | ❌ |
| product-catalog.html | - | ❌ |

## 7.3 Summary

| Action | Count |
|--------|-------|
| Pages to disable/remove | 12 |
| Pages to consolidate | 8 |
| **Total pages after cleanup** | **~38** |

---

# 8. BROKEN ELEMENTS LIST

## 8.1 Customer Frontend

### shop.html
| Element | Type | Issue |
|---------|------|-------|
| Filter Button | Button | Shows "coming soon" toast |
| Room Filter | Dropdown | No filter function |
| Color Filter | Dropdown | No filter function |
| Price Slider | Range | No filter function |
| Free Samples | Link | href="#" |
| Trade Program | Link | href="#" |
| Social Icons | Links | href="#" |
| Wishlist Icon | Button | No wishlist system |
| User Account | Button | No account system |

### index.html
| Element | Type | Issue |
|---------|------|-------|
| Newsletter Form | Form | Alert only, no backend |
| Footer Links | Links | Multiple href="#" |
| Social Icons | Links | href="#" |

## 8.2 Dealer Portal

### commissions.html
| Element | Type | Issue |
|---------|------|-------|
| Export CSV | Button | Shows "coming soon" alert |

### index.html
| Element | Type | Issue |
|---------|------|-------|
| Download Price List | Button | Shows "coming soon" alert |

## 8.3 Admin Portal

### Security Section
| Page | Element | Issue |
|------|---------|-------|
| two-factor.html | Enable 2FA | No backend endpoint |
| sessions.html | Revoke Session | Doesn't invalidate JWT |
| firewall.html | All controls | No middleware enforcement |
| sso.html | Connect buttons | No OAuth integration |

### Marketing Section
| Page | Element | Issue |
|------|---------|-------|
| campaigns.html | Send Campaign | No email service |
| social.html | Connect buttons | No OAuth integration |
| automations.html | Create Automation | No trigger system |

---

# 9. RECOMMENDATIONS

## 9.1 Phase 1 - Admin Nav Cleanup

1. Create `/frontend/public/admin/js/adminNavConfig.js`:
```javascript
const ADMIN_NAV = {
  commerce: [
    { label: 'Dashboard', route: '/', enabled: true },
    { label: 'Orders', route: '/orders.html', enabled: true },
    { label: 'Quotes', route: '/quotes.html', enabled: true },
    { label: 'Invoices', route: '/invoices.html', enabled: true },
    { label: 'Customers', route: '/customers.html', enabled: true },
    { label: 'Accounts', route: '/accounts.html', enabled: true }
  ],
  catalog: [
    { label: 'Products', route: '/products.html', enabled: true },
    { label: 'Categories', route: '/categories.html', enabled: true },
    { label: 'Fabrics', route: '/fabrics.html', enabled: true },
    { label: 'Hardware', route: '/hardware-options.html', enabled: true },
    { label: 'Accessories', route: '/accessories.html', enabled: true },
    { label: 'Pricing', route: '/product-pricing.html', enabled: true }
  ],
  content: [
    { label: 'Pages', route: '/pages.html', enabled: true },
    { label: 'Media', route: '/media-library.html', enabled: true },
    { label: 'FAQs', route: '/faqs.html', enabled: true }
  ],
  settings: [
    { label: 'General', route: '/settings.html', enabled: true },
    { label: 'System', route: '/system-config.html', enabled: true },
    { label: 'Theme', route: '/theme-settings.html', enabled: true },
    { label: 'Security', route: '/security/', enabled: true }
  ],
  analytics: [
    { label: 'Reports', route: '/analytics.html', enabled: true }
  ]
};
```

2. Disable non-functional items with tooltip "Not implemented"
3. Remove duplicates from navigation

## 9.2 Phase 2 - Performance Fix

1. Add server-side pagination to `/api/admin/orders`:
```javascript
// Request: GET /api/admin/orders?page=1&limit=25&status=pending
// Response: { success: true, data: [...], total: 150, page: 1, pages: 6 }
```

2. Add database indexes in `/backend/services/database-index.js`
3. Implement request timing logging

## 9.3 Phase 3 - Order Workflow

1. Enforce strict status transitions in backend
2. Add manufacturer shipping cost + tracking at QA→Shipped
3. Create auto-delivery polling job (no external integrations)

## 9.4 Phase 4 - Finance

1. Implement external expense entry in Accounts page
2. Add profit calculation: Revenue - Tax - MfrCost - Expenses
3. Create basic reports dashboard

## 9.5 Phase 5 - New Product Template

Create `/docs/NEW_PRODUCT_TEMPLATE.md` with:
- Product slug/category mapping
- Config schema (options, validations)
- Fabric mapping requirements
- Pricing rules template
- QA checklist

## 9.6 Phase 6 - Smoke Tests

Create `/backend/scripts/smoke-test.js`:
- Verify all enabled admin routes load
- Verify all enabled buttons call real endpoints
- Verify Orders/Invoices endpoints return correct shape
- Verify status transitions work

---

# END OF PHASE 0 AUDIT

**Next Steps:**
1. Review this document
2. Approve page removals
3. Proceed to Phase 1 implementation
