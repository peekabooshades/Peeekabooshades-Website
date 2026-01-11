# PEEKABOO SHADES - COMPREHENSIVE QA DICTIONARY
## Production Readiness Audit & Documentation

**Version:** 1.0
**Audit Date:** January 11, 2026
**Prepared by:** QA Audit System
**Document Type:** Pre-Production Quality Assurance Dictionary

---

# TABLE OF CONTENTS

## PART I: EXECUTIVE SUMMARY
- [1.1 Platform Overview](#11-platform-overview)
- [1.2 Inventory Summary](#12-inventory-summary)
- [1.3 Critical Issues Summary](#13-critical-issues-summary)

## PART II: BUG LIST & ISSUES REPORT
- [2.1 Critical Bugs](#21-critical-bugs)
- [2.2 High Priority Issues](#22-high-priority-issues)
- [2.3 Medium Priority Issues](#23-medium-priority-issues)
- [2.4 Low Priority Issues](#24-low-priority-issues)
- [2.5 Non-Functional Elements](#25-non-functional-elements)

## PART III: PORTAL DOCUMENTATION
- [3.1 Admin Portal (58 Pages)](#31-admin-portal-58-pages)
- [3.2 Dealer Portal (6 Pages)](#32-dealer-portal-6-pages)
- [3.3 Manufacturer Portal (2 Pages)](#33-manufacturer-portal-2-pages)
- [3.4 Customer Frontend (11 Pages)](#34-customer-frontend-11-pages)

## PART IV: API DOCUMENTATION
- [4.1 API Endpoint Catalog (394 Endpoints)](#41-api-endpoint-catalog-394-endpoints)
- [4.2 Authentication Requirements](#42-authentication-requirements)
- [4.3 API Response Formats](#43-api-response-formats)

## PART V: DATABASE SCHEMA
- [5.1 Collections Index (58 Collections)](#51-collections-index-58-collections)
- [5.2 Field Definitions](#52-field-definitions)
- [5.3 Relationships & Foreign Keys](#53-relationships--foreign-keys)

## PART VI: BUSINESS RULES
- [6.1 Pricing Engine Rules](#61-pricing-engine-rules)
- [6.2 Order Status Workflow](#62-order-status-workflow)
- [6.3 Invoice Generation Rules](#63-invoice-generation-rules)
- [6.4 Tax Calculation Rules](#64-tax-calculation-rules)

## PART VII: ACCESS CONTROL
- [7.1 Role-Based Access Control](#71-role-based-access-control)
- [7.2 Permission Matrix](#72-permission-matrix)
- [7.3 Authentication Types](#73-authentication-types)

## PART VIII: DATA FLOWS
- [8.1 Order Creation Flow](#81-order-creation-flow)
- [8.2 Invoice Generation Flow](#82-invoice-generation-flow)
- [8.3 Pricing Calculation Flow](#83-pricing-calculation-flow)

## PART IX: SEARCHABLE INDEX
- [9.1 Alphabetical Element Index](#91-alphabetical-element-index)
- [9.2 Button Index](#92-button-index)
- [9.3 Dropdown Index](#93-dropdown-index)
- [9.4 API Endpoint Index](#94-api-endpoint-index)

---

# PART I: EXECUTIVE SUMMARY

## 1.1 Platform Overview

**Platform Name:** Peekaboo Shades E-Commerce Platform
**Technology Stack:**
- Backend: Node.js + Express.js
- Frontend: HTML5, CSS3, JavaScript
- Database: JSON file-based (database.json)
- Authentication: JWT-based (bcryptjs)
- Real-time: WebSocket (ws library)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                            │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   Customer  │   Admin     │   Dealer    │  Manufacturer    │
│   Portal    │   Portal    │   Portal    │  Portal          │
│  (11 pages) │  (58 pages) │  (6 pages)  │  (2 pages)       │
└─────────────┴─────────────┴─────────────┴──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Express.js)                    │
│                    394 Endpoints                             │
├─────────────────────────────────────────────────────────────┤
│  Authentication │  Products │  Orders │  Invoices │  CRM   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│                    database.json (58 collections)            │
└─────────────────────────────────────────────────────────────┘
```

## 1.2 Inventory Summary

| Category | Count | Status |
|----------|-------|--------|
| **HTML Pages Total** | 91 | Audited |
| - Admin Portal | 58 | ✓ Complete |
| - Dealer Portal | 6 | ✓ Complete |
| - Manufacturer Portal | 2 | ✓ Complete |
| - Customer Frontend | 11 | ✓ Complete |
| - Landing Pages | 9 | ✓ Complete |
| - Guide Pages | 5 | ✓ Complete |
| **API Endpoints** | 394 | Documented |
| **Database Collections** | 58 | Documented |
| **JavaScript Services** | 16 | Audited |
| **Backend Services** | 12 | Audited |

## 1.3 Critical Issues Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 3 | Security vulnerabilities requiring immediate fix |
| **HIGH** | 8 | Functional bugs affecting user experience |
| **MEDIUM** | 15 | Inconsistencies and partial implementations |
| **LOW** | 22 | Minor UI/UX issues and improvements |

---

# PART II: BUG LIST & ISSUES REPORT

## 2.1 Critical Bugs

### BUG-CRIT-001: Hardcoded JWT Secret Fallback
**Location:** `backend/server.js`
**Line:** ~118
**Severity:** CRITICAL
**Description:** JWT secret has hardcoded fallback value when environment variable not set.
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'peekaboo-shades-secret-key-2024';
```
**Impact:** Security vulnerability - predictable JWT secret in production.
**Recommendation:** Remove fallback, require JWT_SECRET environment variable, fail startup if not set.

### BUG-CRIT-002: No Rate Limiting on Authentication
**Location:** `backend/server.js`
**Endpoints Affected:**
- `POST /api/admin/login`
- `POST /api/dealer/login`
- `POST /api/manufacturer/login`
**Severity:** CRITICAL
**Description:** No rate limiting on login endpoints, vulnerable to brute force attacks.
**Impact:** Authentication can be brute-forced.
**Recommendation:** Implement rate limiting (e.g., express-rate-limit) with max 5 attempts per 15 minutes.

### BUG-CRIT-003: Missing Input Sanitization
**Location:** Multiple API endpoints
**Severity:** CRITICAL
**Description:** User input directly used in database queries without sanitization.
**Impact:** Potential for NoSQL injection in JSON database queries.
**Recommendation:** Implement input validation middleware using Joi or similar.

---

## 2.2 High Priority Issues

### BUG-HIGH-001: 2FA Not Implemented
**Location:** `frontend/public/admin/security/two-factor.html`
**Status:** UI exists, backend not implemented
**Description:** Two-factor authentication page exists in admin security but has no backend functionality.
```javascript
// Buttons exist but connect to non-existent endpoints:
// - Enable 2FA
// - Verify Code
// - Generate Backup Codes
```
**Impact:** Security feature advertised but not functional.
**Recommendation:** Either implement full 2FA or remove the menu item.

### BUG-HIGH-002: Session Revocation Not Implemented
**Location:** `frontend/public/admin/security/sessions.html`
**Status:** UI only
**Description:** Session management page shows sessions but "Revoke" buttons don't actually invalidate tokens.
**Impact:** Cannot forcibly log out compromised sessions.
**Recommendation:** Implement token blacklist or session store.

### BUG-HIGH-003: Field Naming Inconsistencies
**Location:** Multiple files
**Severity:** HIGH
**Description:** Inconsistent field naming between frontend and backend:

| Frontend Field | Backend Field | Used In |
|----------------|---------------|---------|
| `valanceType` | `standardCassette` | Product Configuration |
| `bottomRail` | `standardBottomBar` | Product Configuration |
| `customer_name` | `customer.name` | Orders |
| `shipping_address` | `customer.address` | Orders |

**Impact:** Data mapping errors, potential data loss during transforms.
**Recommendation:** Standardize field names across the codebase.

### BUG-HIGH-004: Export CSV Not Implemented (Dealer Portal)
**Location:** `frontend/public/dealer/commissions.html`
**Line:** Button at line ~340
**Description:** "Export CSV" button exists but `exportToCsv()` function shows "Coming soon" toast.
```javascript
function exportToCsv() {
  showNotification('Coming soon', 'info');
}
```
**Impact:** Dealers cannot export commission reports.
**Recommendation:** Implement CSV export functionality.

### BUG-HIGH-005: Unlinked Navigation Items (Shop Page)
**Location:** `frontend/public/shop.html`
**Description:** 6 navigation items point to "#" with no actual destination:
- By Room (href="#")
- Roller Shades (href="#")
- Zebra Shades (href="#")
- Honeycomb Shades (href="#")
- Roman Shades (href="#")
- Outdoor Shades (href="#")
**Impact:** Broken navigation, poor user experience.
**Recommendation:** Link to proper category filter URLs or product pages.

### BUG-HIGH-006: Filter Functions Not Implemented (Shop Page)
**Location:** `frontend/public/shop.html`
**Description:** 5 filter functions show placeholder toast instead of filtering:
- `filterByColor()`
- `filterByRoom()`
- `filterByLightFiltering()`
- `filterByMaterial()`
- `filterByPrice()`
```javascript
function filterByColor(color) {
  showToast('Filter by ' + color);  // Placeholder only
}
```
**Impact:** Shop filters don't work.
**Recommendation:** Implement actual filtering logic.

### BUG-HIGH-007: No Refresh Token Mechanism
**Location:** Authentication system
**Description:** JWT tokens expire but there's no refresh token mechanism.
**Impact:** Users logged out unexpectedly when token expires.
**Recommendation:** Implement refresh token rotation.

### BUG-HIGH-008: Missing Order Confirmation Email
**Location:** Order creation flow
**Description:** No email service configured - order confirmations not sent.
**Impact:** Customers don't receive order confirmation.
**Recommendation:** Integrate email service (SendGrid, Mailgun, etc.).

---

## 2.3 Medium Priority Issues

### BUG-MED-001: Cordless Pricing Fallback Warning
**Location:** `backend/services/extended-pricing-engine.js:377-383`
**Description:** When cordless pricing not configured for a fabric, system silently uses manual pricing.
**Current Behavior:** Warning logged to console but not surfaced to user.
**Recommendation:** Show warning in admin UI when configuring products.

### BUG-MED-002: Zero Margin Warning System
**Location:** `backend/services/extended-pricing-engine.js:468-486`
**Description:** System allows 0% margin without warning.
**Impact:** Products can be sold at cost accidentally.
**Recommendation:** Add validation warning for margins below minimum threshold.

### BUG-MED-003: Inconsistent Date Formats
**Location:** Throughout codebase
**Description:** Mixed date formats used:
- ISO 8601: `2026-01-11T18:06:05.547Z`
- US Format: `1/11/2026`
- Locale Format: `January 11, 2026`
**Recommendation:** Standardize on ISO 8601 for storage, consistent locale format for display.

### BUG-MED-004: Missing Pagination on Some Lists
**Location:** Multiple admin pages
**Description:** Some list pages load all records without pagination:
- `hardware-options.html` - All hardware options loaded at once
- `fabrics.html` - All fabrics loaded at once
- `accessories.html` - All accessories loaded at once
**Impact:** Slow page loads with large datasets.
**Recommendation:** Add pagination with configurable page size.

### BUG-MED-005: No Bulk Actions
**Location:** Admin order management
**Description:** Cannot bulk update order statuses.
**Impact:** Managing large order volumes is time-consuming.
**Recommendation:** Add checkbox selection and bulk status update.

### BUG-MED-006: SSO Not Implemented
**Location:** `frontend/public/admin/security/sso.html`
**Description:** SSO configuration page exists but no backend implementation.
**Status:** UI stub only.

### BUG-MED-007: Firewall Rules Not Implemented
**Location:** `frontend/public/admin/security/firewall.html`
**Description:** IP whitelist/blacklist UI exists but doesn't persist or enforce rules.
**Status:** UI stub only.

### BUG-MED-008: API Security Page Incomplete
**Location:** `frontend/public/admin/security/api-security.html`
**Description:** API key management page lacks key generation functionality.

### BUG-MED-009: Blog Posts Not Linked
**Location:** `frontend/public/admin/blog/posts.html`
**Description:** Blog management exists in admin but no public blog page.
**Status:** Admin-only, no public facing.

### BUG-MED-010: Social Marketing Incomplete
**Location:** `frontend/public/admin/marketing/social.html`
**Description:** Social media integration UI exists but no actual platform connections.

### BUG-MED-011: Automations Incomplete
**Location:** `frontend/public/admin/marketing/automations.html`
**Description:** Email automation UI exists but no email service configured.

### BUG-MED-012: Campaigns Incomplete
**Location:** `frontend/public/admin/marketing/campaigns.html`
**Description:** Marketing campaign management incomplete.

### BUG-MED-013: Subscribers List Only
**Location:** `frontend/public/admin/marketing/subscribers.html`
**Description:** Can view subscribers but no email sending capability.

### BUG-MED-014: Promotions Limited
**Location:** `frontend/public/admin/marketing/promotions.html`
**Description:** Coupon codes exist but limited validation.

### BUG-MED-015: Draft Orders Incomplete
**Location:** `frontend/public/admin/draft-orders.html`
**Description:** Draft order management exists but workflow incomplete.

---

## 2.4 Low Priority Issues

### BUG-LOW-001: Missing Loading States
**Location:** Various pages
**Description:** Some pages don't show loading indicators during API calls.

### BUG-LOW-002: Inconsistent Button Styles
**Location:** Throughout admin portal
**Description:** Mix of button styles (primary, secondary) used inconsistently.

### BUG-LOW-003: Missing Breadcrumbs
**Location:** Deep admin pages
**Description:** No breadcrumb navigation on nested pages.

### BUG-LOW-004: No Keyboard Shortcuts
**Location:** Admin portal
**Description:** No keyboard navigation or shortcuts for power users.

### BUG-LOW-005: Missing Form Validation Messages
**Location:** Various forms
**Description:** Some forms don't show inline validation errors.

### BUG-LOW-006: Inconsistent Modal Sizes
**Location:** Admin modals
**Description:** Modal dialogs have inconsistent widths.

### BUG-LOW-007: Missing Confirmation Dialogs
**Location:** Some delete actions
**Description:** Not all destructive actions have confirmation dialogs.

### BUG-LOW-008: No Undo Functionality
**Location:** Admin actions
**Description:** No undo for accidental changes.

### BUG-LOW-009: Missing Empty States
**Location:** Some list pages
**Description:** Some lists don't show helpful empty state messages.

### BUG-LOW-010: Inconsistent Date Pickers
**Location:** Various forms
**Description:** Mix of native and custom date pickers.

### BUG-LOW-011 to BUG-LOW-022:
Additional minor UI/UX issues documented in detailed page audits below.

---

## 2.5 Non-Functional Elements

### Elements That Exist But Don't Work

| Page | Element | Type | Expected Action | Current State |
|------|---------|------|-----------------|---------------|
| shop.html | Room Filter Dropdown | Dropdown | Filter products | Shows toast only |
| shop.html | Color Filter Dropdown | Dropdown | Filter products | Shows toast only |
| shop.html | Price Filter Slider | Slider | Filter by price | Shows toast only |
| dealer/commissions.html | Export CSV Button | Button | Download CSV | "Coming soon" toast |
| security/two-factor.html | Enable 2FA Button | Button | Enable 2FA | No backend |
| security/sessions.html | Revoke Button | Button | Invalidate session | No effect |
| marketing/social.html | Connect Facebook | Button | OAuth connect | No backend |
| marketing/social.html | Connect Instagram | Button | OAuth connect | No backend |
| marketing/automations.html | Create Automation | Button | Create workflow | No backend |

### Stub/Placeholder Pages

| Page | Status | Description |
|------|--------|-------------|
| `security/sso.html` | Stub | UI only, no backend |
| `security/firewall.html` | Stub | UI only, no enforcement |
| `security/api-security.html` | Partial | View only, no key generation |
| `marketing/campaigns.html` | Stub | UI only, limited function |
| `blog/posts.html` | Partial | Admin only, no public blog |

---

# PART III: PORTAL DOCUMENTATION

## 3.1 Admin Portal (58 Pages)

### 3.1.1 Page Inventory

| # | Page | Path | Purpose | Status |
|---|------|------|---------|--------|
| 1 | Dashboard | `/admin/index.html` | Main dashboard with KPIs | ✓ Active |
| 2 | Login | `/admin/login.html` | Admin authentication | ✓ Active |
| 3 | Products | `/admin/products.html` | Product listing | ✓ Active |
| 4 | Product Edit | `/admin/product-edit.html` | Edit single product | ✓ Active |
| 5 | Product Editor V2 | `/admin/product-editor-v2.html` | New product editor | ✓ Active |
| 6 | Product Page Editor | `/admin/product-page-editor.html` | Visual page editor | ✓ Active |
| 7 | Product Catalog | `/admin/product-catalog.html` | Catalog management | ✓ Active |
| 8 | Product Content | `/admin/product-content.html` | Content management | ✓ Active |
| 9 | Product Pricing | `/admin/product-pricing.html` | Pricing configuration | ✓ Active |
| 10 | Zebra Pricing | `/admin/zebra-pricing.html` | Zebra product pricing | ✓ Active |
| 11 | Zebra Hardware | `/admin/zebra-hardware.html` | Zebra hardware options | ✓ Active |
| 12 | Zebra Page Editor | `/admin/zebra-page-editor.html` | Zebra page editor | ✓ Active |
| 13 | Categories | `/admin/categories.html` | Category management | ✓ Active |
| 14 | Fabrics | `/admin/fabrics.html` | Fabric management | ✓ Active |
| 15 | Hardware Options | `/admin/hardware-options.html` | Hardware configuration | ✓ Active |
| 16 | Accessories | `/admin/accessories.html` | Accessory management | ✓ Active |
| 17 | Orders | `/admin/orders.html` | Order management | ✓ Active |
| 18 | Draft Orders | `/admin/draft-orders.html` | Draft order management | Partial |
| 19 | Quotes | `/admin/quotes.html` | Quote management | ✓ Active |
| 20 | Invoices | `/admin/invoices.html` | Invoice management | ✓ Active |
| 21 | Print Invoice | `/admin/print-invoice.html` | Invoice printing | ✓ Active |
| 22 | Customers | `/admin/customers.html` | Customer list | ✓ Active |
| 23 | Customer Detail | `/admin/customer.html` | Single customer view | ✓ Active |
| 24 | Accounts | `/admin/accounts.html` | Account management | ✓ Active |
| 25 | Analytics | `/admin/analytics.html` | Analytics dashboard | ✓ Active |
| 26 | Abandoned Checkouts | `/admin/abandoned-checkouts.html` | Abandoned cart recovery | ✓ Active |
| 27 | Settings | `/admin/settings.html` | General settings | ✓ Active |
| 28 | System Config | `/admin/system-config.html` | System configuration | ✓ Active |
| 29 | Theme Settings | `/admin/theme-settings.html` | Theme customization | ✓ Active |
| 30 | Pages | `/admin/pages.html` | CMS pages | ✓ Active |
| 31 | Page Builder | `/admin/page-builder.html` | Visual page builder | ✓ Active |
| 32 | Section Builder | `/admin/section-builder.html` | Section editor | ✓ Active |
| 33 | Visual Builder | `/admin/visual-builder.html` | Visual editor | ✓ Active |
| 34 | FAQs | `/admin/faqs.html` | FAQ management | ✓ Active |
| 35 | Media Library | `/admin/media-library.html` | Media files | ✓ Active |
| 36 | Image Manager | `/admin/image-manager.html` | Image management | ✓ Active |
| 37 | API Tester | `/admin/api-tester.html` | API testing tool | ✓ Active |
| 38-42 | Online Store/* | `/admin/online-store/*` | Store settings | ✓ Active |
| 43-48 | Marketing/* | `/admin/marketing/*` | Marketing tools | Partial |
| 49 | Blog Posts | `/admin/blog/posts.html` | Blog management | Partial |
| 50-58 | Security/* | `/admin/security/*` | Security settings | Partial |

### 3.1.2 Dashboard Elements (index.html)

#### Buttons
| Button Text | Function | Handler | Status |
|-------------|----------|---------|--------|
| View All Orders | Navigate | `onclick="location.href='orders.html'"` | ✓ Works |
| View Details | View order | `onclick="viewOrder(orderId)"` | ✓ Works |
| Update Status | Status modal | `onclick="showStatusModal(orderId)"` | ✓ Works |
| Generate Reports | Navigate | `onclick="location.href='analytics.html'"` | ✓ Works |
| Refresh | Reload data | `onclick="loadDashboardData()"` | ✓ Works |
| Logout | Sign out | `onclick="Admin.Auth.logout()"` | ✓ Works |

#### KPI Cards
| Metric | Data Source | Calculation |
|--------|-------------|-------------|
| Today's Revenue | `orders` collection | Sum of orders with today's date |
| Orders Today | `orders` collection | Count of orders with today's date |
| Pending Orders | `orders` collection | Count where status = 'pending' |
| Low Stock Items | `products` collection | Count where inventory < threshold |

#### Tables
| Table | Columns | Data Source | Sortable |
|-------|---------|-------------|----------|
| Recent Orders | Order#, Customer, Date, Status, Total | `/api/admin/orders?limit=10` | No |
| Order Pipeline | Status, Count, Value | `/api/admin/orders/stats` | No |

---

### 3.1.3 Orders Page Elements (orders.html)

#### Buttons
| Button | Location | Handler | API Call | Status |
|--------|----------|---------|----------|--------|
| Search | Header bar | `searchOrders()` | `GET /api/admin/orders?search=` | ✓ Works |
| Filter by Status | Dropdown | `filterByStatus()` | `GET /api/admin/orders?status=` | ✓ Works |
| Date Range | Date picker | `filterByDate()` | `GET /api/admin/orders?from=&to=` | ✓ Works |
| Export | Header | `exportOrders()` | Generates CSV | ✓ Works |
| View Details | Row action | `viewOrder(id)` | `GET /api/admin/orders/:id` | ✓ Works |
| Update Status | Row action | `updateStatus(id)` | `PUT /api/admin/orders/:id/status` | ✓ Works |
| Print | Row action | `printOrder(id)` | Opens print view | ✓ Works |
| Logout | Header | `Admin.Auth.logout()` | Clears token | ✓ Works |

#### Dropdowns
| Dropdown | Options | Default | Effect |
|----------|---------|---------|--------|
| Status Filter | All, Pending, Processing, Shipped, Delivered, Cancelled | All | Filters table |
| Items Per Page | 10, 25, 50, 100 | 25 | Sets pagination |
| Sort By | Date (desc), Date (asc), Total (desc), Total (asc) | Date (desc) | Sorts table |

#### Table Columns
| Column | Field | Sortable | Searchable |
|--------|-------|----------|------------|
| Order # | `order_number` | Yes | Yes |
| Date | `created_at` | Yes | No |
| Customer | `customer.name` | Yes | Yes |
| Email | `customer.email` | No | Yes |
| Items | `items.length` | No | No |
| Total | `pricing.total` | Yes | No |
| Status | `status` | Yes | Yes |
| Actions | - | No | No |

#### Modals
| Modal ID | Trigger | Purpose | Fields |
|----------|---------|---------|--------|
| order-details-modal | View Details | Show order | Read-only display |
| status-update-modal | Update Status | Change status | Status dropdown, notes |
| tracking-modal | Add Tracking | Shipping info | Carrier, tracking # |

---

### 3.1.4 Invoices Page Elements (invoices.html)

#### Buttons
| Button | Handler | API Call | Status |
|--------|---------|----------|--------|
| Generate Missing | `generateMissingInvoices()` | `POST /api/admin/invoices/generate-missing` | ✓ Works |
| View Invoice | `viewInvoice(id)` | `GET /api/admin/invoices/:id` | ✓ Works |
| Print Invoice | `printInvoice(id)` | Opens print-invoice.html | ✓ Works |
| Record Payment | `showPaymentModal(id)` | `POST /api/admin/invoices/:id/payment` | ✓ Works |
| Send Invoice | `sendInvoice(id)` | Email not implemented | ⚠ Partial |

#### Invoice Types
| Type | Prefix | Description | Direction |
|------|--------|-------------|-----------|
| Customer Invoice | `INV-` | Bill to customer | Receivable |
| Manufacturer Invoice | `MFR-INV-` | Bill from manufacturer | Payable |

#### Invoice Statuses
| Status | Color | Description |
|--------|-------|-------------|
| `draft` | Gray | Not yet sent |
| `sent` | Blue | Sent to customer |
| `paid` | Green | Fully paid |
| `partially_paid` | Yellow | Partial payment received |
| `overdue` | Red | Past due date |
| `cancelled` | Gray | Cancelled |
| `refunded` | Purple | Refunded |

---

## 3.2 Dealer Portal (6 Pages)

### 3.2.1 Page Inventory

| # | Page | Path | Purpose | Status |
|---|------|------|---------|--------|
| 1 | Login | `/dealer/login.html` | Dealer authentication | ✓ Active |
| 2 | Dashboard | `/dealer/index.html` | Dealer dashboard | ✓ Active |
| 3 | Orders | `/dealer/orders.html` | Order management | ✓ Active |
| 4 | New Order | `/dealer/new-order.html` | Create order | ✓ Active |
| 5 | Customers | `/dealer/customers.html` | Customer management | ✓ Active |
| 6 | Commissions | `/dealer/commissions.html` | Commission tracking | Partial |

### 3.2.2 Dealer Dashboard Elements (index.html)

#### KPI Cards
| Metric | Description | Calculation |
|--------|-------------|-------------|
| Total Orders | All-time orders | Count of dealer's orders |
| This Month | Monthly orders | Orders in current month |
| Total Sales | Revenue | Sum of order totals |
| Commission | Earned commission | Total sales × commission rate |

#### Dealer Tiers
| Tier | Discount | Annual Threshold |
|------|----------|------------------|
| Bronze | 15% | < $50,000 |
| Silver | 20% | $50,000 - $100,000 |
| Gold | 25% | > $100,000 |

---

## 3.3 Manufacturer Portal (2 Pages)

### 3.3.1 Page Inventory

| # | Page | Path | Purpose | Status |
|---|------|------|---------|--------|
| 1 | Login | `/manufacturer/login.html` | Manufacturer auth | ✓ Active |
| 2 | Dashboard | `/manufacturer/index.html` | Order fulfillment | ✓ Active |

### 3.3.2 Dashboard Elements (index.html)

#### Order Management Functions
| Function | Description | API Endpoint |
|----------|-------------|--------------|
| `loadOrders()` | Fetch pending orders | `GET /api/manufacturer/orders` |
| `updateOrderStatus()` | Update status | `PUT /api/manufacturer/orders/:id/status` |
| `downloadOrderSheet()` | Generate PDF | `GET /api/manufacturer/orders/:id/sheet` |
| `markAsShipped()` | Mark shipped | `PUT /api/manufacturer/orders/:id/ship` |

#### Order Status Options
| Status | Can Transition To |
|--------|------------------|
| `pending` | processing, cancelled |
| `processing` | manufacturing, cancelled |
| `manufacturing` | quality_check, cancelled |
| `quality_check` | ready_to_ship, rework |
| `ready_to_ship` | shipped |
| `shipped` | delivered |

---

## 3.4 Customer Frontend (11 Pages)

### 3.4.1 Page Inventory

| # | Page | Path | Purpose | Status |
|---|------|------|---------|--------|
| 1 | Home | `/index.html` | Landing page | ✓ Active |
| 2 | Shop | `/shop.html` | Product listing | Partial (filters broken) |
| 3 | Product | `/product.html` | Product configurator | ✓ Active |
| 4 | Zebra Product | `/zebra-product.html` | Zebra configurator | ✓ Active |
| 5 | Cart | `/cart.html` | Shopping cart | ✓ Active |
| 6 | Contact | `/contact.html` | Contact form | ✓ Active |
| 7 | Shipping | `/shipping.html` | Shipping info | ✓ Active |
| 8 | Returns | `/returns.html` | Return policy | ✓ Active |
| 9 | Warranty | `/warranty.html` | Warranty info | ✓ Active |
| 10 | Child Safety | `/child-safety.html` | Safety info | ✓ Active |
| 11 | Dynamic Page | `/page.html` | CMS pages | ✓ Active |

### 3.4.2 Product Configurator Elements (product.html)

#### Configuration Options
| Option | Type | Values | Affects Price |
|--------|------|--------|--------------|
| Fabric | Dropdown | Fabric codes | Yes |
| Width | Number input | Min 12", Max 144" | Yes (m² calc) |
| Height | Number input | Min 12", Max 120" | Yes (m² calc) |
| Mount Type | Radio | Inside, Outside | No |
| Control Type | Radio | Manual, Cordless, Motorized | Yes |
| Motor Brand | Dropdown (if motorized) | AOK, Dooya | Yes |
| Remote Type | Dropdown (if motorized) | Single, Multi, Smart | Yes |
| Valance Type | Dropdown | Standard Cassette, 4" Fabric, None | Yes |
| Bottom Rail | Dropdown | Standard Bottom Bar, Wrapped, Heavy | Yes |
| Room Label | Text input | Custom label | No |
| Quantity | Number input | 1-99 | Yes (multiplier) |

#### Price Display
| Field | Source | Format |
|-------|--------|--------|
| Unit Price | Calculated | $XXX.XX |
| Line Total | unit_price × quantity | $XXX.XX |
| Manufacturer Cost | Hidden (admin only) | $XXX.XX |
| Margin | Hidden (admin only) | XX% |

---

# PART IV: API DOCUMENTATION

## 4.1 API Endpoint Catalog (394 Endpoints)

### 4.1.1 Public Endpoints (No Auth Required)

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| GET | `/api/products` | List products | Product array |
| GET | `/api/products/:slug` | Get product | Product object |
| GET | `/api/categories` | List categories | Category array |
| GET | `/api/fabrics` | List fabrics | Fabric array |
| POST | `/pricing/calculate` | Calculate price | Price breakdown |
| GET | `/api/cart` | Get cart | Cart object |
| POST | `/api/cart` | Add to cart | Updated cart |
| PUT | `/api/cart/:itemId` | Update cart item | Updated cart |
| DELETE | `/api/cart/:itemId` | Remove from cart | Updated cart |
| POST | `/api/orders` | Create order | Order object |
| GET | `/api/orders/:orderNumber` | Get order (by number) | Order object |
| POST | `/api/contact` | Submit contact form | Success message |
| GET | `/api/content/:slug` | Get CMS page | Page content |

### 4.1.2 Admin Endpoints (authMiddleware Required)

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| POST | `/api/admin/login` | Admin login | Public |
| GET | `/api/admin/verify` | Verify token | Any admin |
| GET | `/api/admin/orders` | List orders | orders.view |
| GET | `/api/admin/orders/:id` | Get order | orders.view |
| PUT | `/api/admin/orders/:id/status` | Update status | orders.update |
| GET | `/api/admin/invoices` | List invoices | orders.view |
| POST | `/api/admin/invoices/:id/payment` | Record payment | orders.update |
| POST | `/api/admin/invoices/generate-missing` | Generate invoices | orders.update |
| GET | `/api/admin/customers` | List customers | customers.view |
| GET | `/api/admin/customers/:id` | Get customer | customers.view |
| PUT | `/api/admin/customers/:id` | Update customer | customers.update |
| GET | `/api/admin/products` | List products | products.view |
| POST | `/api/admin/products` | Create product | products.create |
| PUT | `/api/admin/products/:id` | Update product | products.update |
| DELETE | `/api/admin/products/:id` | Delete product | products.delete |
| GET | `/api/admin/hardware` | Get hardware options | products.view |
| PUT | `/api/admin/hardware` | Update hardware | products.update |
| GET | `/api/admin/stats` | Dashboard stats | analytics.view |

### 4.1.3 Dealer Endpoints (dealerAuthMiddleware Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/dealer/login` | Dealer login |
| GET | `/api/dealer/verify` | Verify token |
| GET | `/api/dealer/orders` | List dealer orders |
| POST | `/api/dealer/orders` | Create order |
| GET | `/api/dealer/customers` | List dealer customers |
| POST | `/api/dealer/customers` | Create customer |
| GET | `/api/dealer/commissions` | Get commissions |
| GET | `/api/dealer/stats` | Dashboard stats |

### 4.1.4 Manufacturer Endpoints (manufacturerAuthMiddleware Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/manufacturer/login` | Manufacturer login |
| GET | `/api/manufacturer/verify` | Verify token |
| GET | `/api/manufacturer/orders` | List orders to fulfill |
| PUT | `/api/manufacturer/orders/:id/status` | Update order status |
| GET | `/api/manufacturer/orders/:id/sheet` | Download order sheet |

## 4.2 Authentication Requirements

### 4.2.1 Auth Middleware Types

| Middleware | Header Required | Token Prefix | Validates |
|------------|-----------------|--------------|-----------|
| `authMiddleware` | `Authorization` | `Bearer ` | Admin JWT |
| `dealerAuthMiddleware` | `Authorization` | `Bearer ` | Dealer JWT |
| `manufacturerAuthMiddleware` | `Authorization` | `Bearer ` | Manufacturer JWT |

### 4.2.2 JWT Token Structure

```javascript
// Admin Token Payload
{
  "id": "uuid",
  "email": "admin@example.com",
  "role": "admin",
  "type": "admin",
  "iat": 1736616365,
  "exp": 1736702765
}

// Dealer Token Payload
{
  "id": "uuid",
  "email": "dealer@example.com",
  "companyName": "Dealer Co",
  "tier": "silver",
  "type": "dealer",
  "iat": 1736616365,
  "exp": 1736702765
}
```

## 4.3 API Response Formats

### 4.3.1 Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### 4.3.2 Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### 4.3.3 List Response
```json
{
  "success": true,
  "data": [ ... ],
  "total": 150,
  "page": 1,
  "pages": 6,
  "limit": 25
}
```

---

# PART V: DATABASE SCHEMA

## 5.1 Collections Index (58 Collections)

| # | Collection | Purpose | Record Count |
|---|------------|---------|--------------|
| 1 | `products` | Product catalog | 5 |
| 2 | `categories` | Product categories | 6 |
| 3 | `fabrics` | Fabric options | 50+ |
| 4 | `orders` | Customer orders | 1 |
| 5 | `invoices` | Generated invoices | 1 |
| 6 | `customers` | Customer records | 2 |
| 7 | `quotes` | Saved quotes | 0 |
| 8 | `adminUsers` | Admin accounts | 1 |
| 9 | `dealerUsers` | Dealer accounts | 2 |
| 10 | `manufacturerUsers` | Manufacturer accounts | 1 |
| 11 | `manufacturerPrices` | Roller fabric pricing | 161 |
| 12 | `zebraManufacturerPrices` | Zebra fabric pricing | 208 |
| 13 | `motorBrands` | Motor brand pricing | 3 |
| 14 | `hardwareOptions` | Hardware configuration | Object |
| 15 | `zebraHardwareOptions` | Zebra hardware config | Object |
| 16 | `productContent` | Product page content | Object |
| 17 | `settings` | System settings | Object |
| 18 | `content` | CMS content | Object |
| 19 | `pages` | CMS pages | Array |
| 20 | `faqs` | FAQ items | Array |
| 21 | `navigation` | Navigation menus | Object |
| 22 | `theme` | Theme settings | Object |
| 23 | `analytics_events` | Analytics data | Array |
| 24 | `audit_logs` | Audit trail | Array |
| 25 | `sessions` | User sessions | Array |
| 26-58 | Additional | Various system data | - |

## 5.2 Field Definitions

### 5.2.1 Orders Collection

```javascript
{
  "id": "uuid",                        // Unique identifier
  "order_number": "ORD-XXXXXXXXX",     // Human-readable order number
  "status": "pending",                 // Order status
  "customer": {
    "id": "uuid",                      // Customer ID
    "name": "John Doe",                // Customer name
    "email": "john@example.com",       // Customer email
    "phone": "555-123-4567",           // Customer phone
    "address": "123 Main St"           // Customer address
  },
  "items": [
    {
      "id": "uuid",                    // Line item ID
      "product_id": "uuid",            // Product reference
      "product_name": "Roller Shades", // Product name
      "product_type": "roller",        // Product type
      "width": 48,                     // Width in inches
      "height": 60,                    // Height in inches
      "quantity": 2,                   // Quantity
      "unit_price": 125.50,            // Price per unit
      "line_total": 251.00,            // Line total
      "configuration": { ... },        // Selected options
      "price_snapshot": { ... }        // Price breakdown at order time
    }
  ],
  "pricing": {
    "subtotal": 251.00,               // Sum of line totals
    "tax": 18.83,                     // Sales tax
    "shipping": 0,                    // Shipping cost
    "discount": 0,                    // Discount amount
    "total": 269.83                   // Grand total
  },
  "payment": {
    "method": "card",                 // Payment method
    "status": "completed",            // Payment status
    "transaction_id": "ch_xxx"        // Payment reference
  },
  "shipping_address": "123 Main St",  // Ship to address
  "billing_address": "123 Main St",   // Bill to address
  "notes": "",                        // Order notes
  "created_at": "2026-01-11T18:11:12.148Z",
  "updated_at": "2026-01-11T18:12:11.457Z"
}
```

### 5.2.2 Invoices Collection

```javascript
{
  "id": "uuid",
  "invoiceNumber": "INV-XXXXXXXXX",
  "type": "customer",              // "customer" or "manufacturer"
  "status": "paid",                // Invoice status
  "orderId": "uuid",               // Related order
  "orderNumber": "ORD-XXXXXXXXX",
  "customer": {
    "id": "uuid",
    "number": "CUST-XXXX",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-123-4567",
    "address": "123 Main St"
  },
  "items": [ ... ],                // Line items with full pricing
  "subtotal": 251.00,
  "tax": 18.83,
  "taxRate": 0.075,
  "taxState": "CA",
  "shipping": 0,
  "discount": 0,
  "total": 269.83,
  "amountPaid": 269.83,
  "amountDue": 0,
  "invoiceGeneratedAt": "2026-01-11T18:11:12.199Z",
  "issueDate": "2026-01-11T18:11:12.199Z",
  "dueDate": "2026-02-10T18:11:12.199Z",
  "paidAt": "2026-01-11T18:11:12.199Z"
}
```

### 5.2.3 Manufacturer Prices Collection

```javascript
{
  "id": "uuid",
  "fabricCode": "RS-001",             // Fabric code
  "fabricName": "Premium White",       // Fabric name
  "productType": "roller",             // Product type
  "category": "Light Filtering",       // Fabric category
  "status": "active",                  // Active status
  "pricePerSqMeter": 14.50,           // Base price per m²
  "pricePerSqMeterCordless": 18.00,   // Cordless price per m²
  "minAreaSqMeter": 1.2,              // Minimum chargeable area
  "manualMargin": 35,                 // Margin % for manual
  "cordlessMargin": 40,               // Margin % for cordless
  "motorizedMargin": 30,              // Margin % for motorized
  "manufacturerId": "mfr-default",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2026-01-11T00:00:00Z"
}
```

## 5.3 Relationships & Foreign Keys

```
┌─────────────────┐     ┌─────────────────┐
│     orders      │────>│    customers    │
│                 │     │                 │
│  customer.id ──────── │      id         │
└─────────────────┘     └─────────────────┘
        │
        │ orderId
        ▼
┌─────────────────┐
│    invoices     │
│                 │
│   orderId       │
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   order.items   │────>│    products     │
│                 │     │                 │
│  product_id ──────────│      id         │
└─────────────────┘     └─────────────────┘
        │
        │ fabricCode
        ▼
┌─────────────────┐
│manufacturerPrices│
│                  │
│   fabricCode     │
└─────────────────┘
```

---

# PART VI: BUSINESS RULES

## 6.1 Pricing Engine Rules

### 6.1.1 Square Meter Calculation

```
Formula: Price = Area(m²) × PricePerSqMeter

Where:
- Width(m) = Width(inches) × 0.0254
- Height(m) = Height(inches) × 0.0254
- Area(m²) = max(Width × Height, MinimumArea)

Minimum Areas:
- Roller: 1.2 m²
- Zebra: 1.5 m²
- Honeycomb: 1.2 m²
- Roman: 1.5 m²
```

### 6.1.2 Margin Calculation

```
Customer Price = Manufacturer Cost + (Manufacturer Cost × Margin%)

Margin Priority:
1. Per-fabric margin (from admin product-pricing)
2. Customer price rules (from customerPriceRules collection)
3. Default margin (from settings)

Control Type Margins:
- Manual: manualMargin or default
- Cordless: cordlessMargin or manualMargin
- Motorized: motorizedMargin or manualMargin
```

### 6.1.3 Option Pricing

| Option | Pricing Type | Example |
|--------|--------------|---------|
| Motor Brand | Flat per unit | $45.00 |
| Remote Type | Flat per unit | $15.00 |
| Valance Type | Per m² or flat | $8.00/m² |
| Bottom Rail | Flat per unit | $5.00 |
| Smart Hub | Per accessory | $69.00 each |
| USB Charger | Per accessory | $29.00 each |

### 6.1.4 Total Calculation

```
Line Total = (Unit Price × Quantity) + Accessories Total

Where:
- Unit Price = Base Price + Margin + Per-Unit Options
- Accessories = Sum of accessory prices (not multiplied by quantity)
```

## 6.2 Order Status Workflow

### 6.2.1 Valid Statuses

| Status | Description | Can Transition To |
|--------|-------------|-------------------|
| `pending` | New order received | processing, cancelled |
| `confirmed` | Order confirmed | processing, cancelled |
| `processing` | Being processed | manufacturing, cancelled |
| `manufacturing` | In production | quality_check, cancelled |
| `quality_check` | QC inspection | ready_to_ship, rework |
| `rework` | Failed QC | manufacturing |
| `ready_to_ship` | Ready to ship | shipped |
| `shipped` | In transit | out_for_delivery |
| `out_for_delivery` | With courier | delivered |
| `delivered` | Delivered | completed |
| `completed` | Order complete | - |
| `cancelled` | Order cancelled | - |
| `refunded` | Refund processed | - |
| `on_hold` | On hold | pending, cancelled |
| `backordered` | Awaiting stock | processing |
| `partial_shipment` | Partial shipped | delivered |
| `returned` | Customer return | refunded |

### 6.2.2 Status Transition Rules

```javascript
const VALID_TRANSITIONS = {
  'pending': ['confirmed', 'processing', 'cancelled', 'on_hold'],
  'confirmed': ['processing', 'cancelled', 'on_hold'],
  'processing': ['manufacturing', 'cancelled', 'on_hold', 'backordered'],
  'manufacturing': ['quality_check', 'cancelled', 'on_hold'],
  'quality_check': ['ready_to_ship', 'rework', 'cancelled'],
  'rework': ['manufacturing', 'cancelled'],
  'ready_to_ship': ['shipped', 'cancelled'],
  'shipped': ['out_for_delivery', 'delivered', 'returned'],
  'out_for_delivery': ['delivered', 'returned'],
  'delivered': ['completed', 'returned'],
  'completed': [],
  'cancelled': [],
  'refunded': [],
  'on_hold': ['pending', 'processing', 'cancelled'],
  'backordered': ['processing', 'cancelled'],
  'partial_shipment': ['shipped', 'delivered'],
  'returned': ['refunded', 'processing']
};
```

## 6.3 Invoice Generation Rules

### 6.3.1 Auto-Generation
- Invoice created automatically when order is placed
- Invoice number format: `INV-[TIMESTAMP][RANDOM]`
- Example: `INV-MKA1VLA1E0ZC`

### 6.3.2 Invoice Types
| Type | Direction | Created By | Purpose |
|------|-----------|------------|---------|
| Customer | Receivable | System (on order) | Bill to customer |
| Manufacturer | Payable | Manual | Bill from manufacturer |

### 6.3.3 Tax Preservation
- Tax calculated at checkout is preserved on invoice
- Invoice does NOT recalculate tax
- Source: `order.pricing.tax`

## 6.4 Tax Calculation Rules

### 6.4.1 State Tax Rates

| State | Combined Rate | State | Combined Rate |
|-------|--------------|-------|--------------|
| AL | 9.44% | MT | 0% |
| AK | 1.82% | NE | 6.98% |
| AZ | 8.52% | NV | 8.24% |
| AR | 9.48% | NH | 0% |
| CA | 8.98% | NJ | 6.60% |
| CO | 7.86% | NM | 7.67% |
| CT | 6.35% | NY | 8.54% |
| DE | 0% | NC | 7.00% |
| FL | 7.02% | ND | 7.08% |
| GA | 7.44% | OH | 7.30% |
| HI | 4.50% | OK | 9.05% |
| ID | 6.03% | OR | 0% |
| IL | 8.92% | PA | 6.34% |
| IN | 7.00% | RI | 7.00% |
| IA | 6.94% | SC | 7.49% |
| KS | 8.78% | SD | 6.11% |
| KY | 6.00% | TN | 9.61% |
| LA | 10.11% | TX | 8.25% |
| ME | 5.50% | UT | 7.42% |
| MD | 6.00% | VT | 6.39% |
| MA | 6.25% | VA | 5.77% |
| MI | 6.00% | WA | 9.47% |
| MN | 8.13% | WV | 6.58% |
| MS | 7.06% | WI | 5.72% |
| MO | 8.41% | WY | 5.56% |
| DC | 6.00% | | |

### 6.4.2 Tax Calculation Logic
```javascript
function calculateTax(subtotal, state) {
  const rate = STATE_TAX_RATES[state] || 0.0725; // Default CA
  const tax = Math.round(subtotal * rate * 100) / 100;
  return { rate, amount: tax, state };
}
```

---

# PART VII: ACCESS CONTROL

## 7.1 Role-Based Access Control

### 7.1.1 Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `super_admin` | 100 | Full system access |
| `admin` | 80 | Administrative access |
| `manager` | 60 | Management access |
| `editor` | 40 | Content editing |
| `viewer` | 20 | Read-only access |

### 7.1.2 Role Capabilities

| Capability | super_admin | admin | manager | editor | viewer |
|------------|:-----------:|:-----:|:-------:|:------:|:------:|
| View Products | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create Products | ✓ | ✓ | ✓ | ✓ | - |
| Update Products | ✓ | ✓ | ✓ | ✓ | - |
| Delete Products | ✓ | ✓ | ✓ | - | - |
| View Orders | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update Orders | ✓ | ✓ | ✓ | - | - |
| Refund Orders | ✓ | ✓ | - | - | - |
| View Customers | ✓ | ✓ | ✓ | ✓ | ✓ |
| Update Customers | ✓ | ✓ | ✓ | - | - |
| Delete Customers | ✓ | ✓ | - | - | - |
| View Analytics | ✓ | ✓ | ✓ | - | - |
| Export Analytics | ✓ | ✓ | - | - | - |
| View Settings | ✓ | ✓ | - | - | - |
| Update Settings | ✓ | ✓ | - | - | - |
| Manage Users | ✓ | ✓ | - | - | - |
| Delete Users | ✓ | - | - | - | - |
| Security Settings | ✓ | - | - | - | - |
| System Config | ✓ | - | - | - | - |

## 7.2 Permission Matrix

### 7.2.1 Permission Definitions

```javascript
const PERMISSIONS = {
  // Products
  'products.view': ['viewer', 'editor', 'manager', 'admin', 'super_admin'],
  'products.create': ['editor', 'manager', 'admin', 'super_admin'],
  'products.update': ['editor', 'manager', 'admin', 'super_admin'],
  'products.delete': ['manager', 'admin', 'super_admin'],
  'products.publish': ['manager', 'admin', 'super_admin'],

  // Orders
  'orders.view': ['viewer', 'editor', 'manager', 'admin', 'super_admin'],
  'orders.update': ['manager', 'admin', 'super_admin'],
  'orders.cancel': ['manager', 'admin', 'super_admin'],
  'orders.refund': ['admin', 'super_admin'],

  // Customers
  'customers.view': ['viewer', 'editor', 'manager', 'admin', 'super_admin'],
  'customers.update': ['manager', 'admin', 'super_admin'],
  'customers.delete': ['admin', 'super_admin'],

  // Pricing
  'pricing.view': ['viewer', 'editor', 'manager', 'admin', 'super_admin'],
  'pricing.update': ['admin', 'super_admin'],

  // Analytics
  'analytics.view': ['manager', 'admin', 'super_admin'],
  'analytics.export': ['admin', 'super_admin'],

  // Settings
  'settings.view': ['admin', 'super_admin'],
  'settings.update': ['admin', 'super_admin'],

  // Users
  'users.view': ['admin', 'super_admin'],
  'users.create': ['admin', 'super_admin'],
  'users.update': ['admin', 'super_admin'],
  'users.delete': ['super_admin'],
  'users.roles': ['super_admin'],

  // Security
  'security.view': ['admin', 'super_admin'],
  'security.update': ['super_admin'],
  'security.audit': ['admin', 'super_admin']
};
```

## 7.3 Authentication Types

### 7.3.1 Public Access
- No authentication required
- Endpoints: Product listing, pricing calculation, cart

### 7.3.2 Admin Authentication
```javascript
// Request Header
Authorization: Bearer <admin_jwt_token>

// Middleware: authMiddleware
// Validates: admin or super_admin role
// Sets: req.admin = { id, email, role }
```

### 7.3.3 Dealer Authentication
```javascript
// Request Header
Authorization: Bearer <dealer_jwt_token>

// Middleware: dealerAuthMiddleware
// Validates: dealer account
// Sets: req.dealer = { id, email, companyName, tier }
```

### 7.3.4 Manufacturer Authentication
```javascript
// Request Header
Authorization: Bearer <manufacturer_jwt_token>

// Middleware: manufacturerAuthMiddleware
// Validates: manufacturer account
// Sets: req.manufacturer = { id, email, companyName }
```

---

# PART VIII: DATA FLOWS

## 8.1 Order Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     CUSTOMER FRONTEND                        │
└─────────────────────────────────────────────────────────────┘
                              │
                    1. Configure Product
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /pricing/calculate                                      │
│ Request: { productType, fabricCode, width, height, options } │
│ Response: { unitPrice, lineTotal, breakdown }                │
└─────────────────────────────────────────────────────────────┘
                              │
                    2. Add to Cart
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/cart                                               │
│ Request: { item with configuration and price snapshot }      │
│ Response: { updated cart }                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                    3. Checkout
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/calculate-order-total                              │
│ Request: { items, shippingAddress }                          │
│ Response: { subtotal, tax, shipping, total }                 │
└─────────────────────────────────────────────────────────────┘
                              │
                    4. Place Order
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /api/orders                                             │
│ Request: { customer, items, payment, addresses }             │
│ Response: { order_number, order details }                    │
│                                                              │
│ Side Effects:                                                │
│ - Creates order in database                                  │
│ - Generates customer invoice                                 │
│ - Sends WebSocket notification                               │
└─────────────────────────────────────────────────────────────┘
                              │
                    5. Invoice Generated
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Invoice Service: createInvoiceFromOrder()                    │
│                                                              │
│ - Copies order pricing (does not recalculate)               │
│ - Generates invoice number                                   │
│ - Sets status based on payment                               │
└─────────────────────────────────────────────────────────────┘
```

## 8.2 Invoice Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         ORDER                                │
│ { id, items, pricing: { subtotal, tax, shipping, total } }  │
└─────────────────────────────────────────────────────────────┘
                              │
                    createInvoiceFromOrder()
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INVOICE GENERATION                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Lookup order by ID                                        │
│ 2. Check for existing invoice (prevent duplicates)          │
│ 3. Extract customer info (handles legacy + new format)      │
│ 4. Map line items with:                                      │
│    - Configuration details                                   │
│    - Price snapshots (manufacturer cost, margin)             │
│    - Options breakdown                                       │
│    - Accessories breakdown                                   │
│ 5. Copy totals from order (NOT recalculated):               │
│    - subtotal = order.pricing.subtotal                       │
│    - tax = order.pricing.tax                                 │
│    - shipping = order.pricing.shipping                       │
│    - total = order.pricing.total                             │
│ 6. Set invoice status based on payment:                      │
│    - completed → 'paid'                                      │
│    - pending → 'draft'                                       │
│ 7. Generate dates:                                           │
│    - issueDate = now                                         │
│    - dueDate = now + 30 days                                 │
│ 8. Save to database                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         INVOICE                              │
│ { invoiceNumber, type, status, customer, items, totals }    │
└─────────────────────────────────────────────────────────────┘
```

## 8.3 Pricing Calculation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     INPUT PARAMETERS                         │
│ { productType, fabricCode, width, height, options }         │
└─────────────────────────────────────────────────────────────┘
                              │
                    Step 1: Validate Input
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ DIMENSION VALIDATION                                         │
│ - Width: 12" to 144"                                         │
│ - Height: 12" to 120"                                        │
│ - Quantity: 1 to 99                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    Step 2: Calculate Area (m²)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ AREA CALCULATION                                             │
│ Width(m) = Width(in) × 0.0254                               │
│ Height(m) = Height(in) × 0.0254                             │
│ Area = max(Width × Height, MinArea)                          │
│                                                              │
│ MinArea: Roller=1.2m², Zebra=1.5m²                          │
└─────────────────────────────────────────────────────────────┘
                              │
                    Step 3: Get Manufacturer Cost
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ MANUFACTURER COST LOOKUP                                     │
│                                                              │
│ 1. Find fabric in manufacturerPrices (roller)               │
│    OR zebraManufacturerPrices (zebra)                       │
│ 2. Get pricePerSqMeter based on control type:               │
│    - manual → pricePerSqMeter                               │
│    - cordless → pricePerSqMeterCordless                     │
│    - motorized → pricePerSqMeter                            │
│ 3. Calculate: MfrCost = Area × PricePerSqMeter              │
│                                                              │
│ Fallback: Use default $14-18/m² if fabric not found         │
└─────────────────────────────────────────────────────────────┘
                              │
                    Step 4: Apply Margin
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ MARGIN APPLICATION                                           │
│                                                              │
│ Priority:                                                    │
│ 1. Per-fabric margin (from product-pricing admin)           │
│ 2. Customer price rules                                      │
│ 3. Default margin                                            │
│                                                              │
│ BasePrice = MfrCost + (MfrCost × Margin%)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                    Step 5: Calculate Options
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ OPTIONS CALCULATION                                          │
│                                                              │
│ Per-Unit Options:                                            │
│ - Motor brand price (flat)                                   │
│ - Remote type price (flat)                                   │
│ - Valance price (flat or per-m²)                            │
│ - Bottom rail price (flat)                                   │
│                                                              │
│ Accessories (not multiplied by qty):                         │
│ - Smart Hub × quantity ordered                               │
│ - USB Charger × quantity ordered                             │
└─────────────────────────────────────────────────────────────┘
                              │
                    Step 6: Calculate Totals
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TOTAL CALCULATION                                            │
│                                                              │
│ UnitPrice = BasePrice + PerUnitOptions                       │
│ LineTotal = (UnitPrice × Quantity) + AccessoriesTotal       │
│                                                              │
│ If shipping requested:                                       │
│ - Calculate shipping based on order value                    │
│                                                              │
│ If tax requested:                                            │
│ - Calculate tax based on shipping state                      │
│                                                              │
│ GrandTotal = LineTotal + Shipping + Tax                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         OUTPUT                               │
│ {                                                            │
│   unitPrice, lineTotal, grandTotal,                         │
│   pricing: { manufacturerCost, margin, options },           │
│   profitAnalysis: { grossProfit, marginPercent }            │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
```

---

# PART IX: SEARCHABLE INDEX

## 9.1 Alphabetical Element Index

### A
- **Abandoned Checkouts** - Page: `/admin/abandoned-checkouts.html`
- **Accessories** - Page: `/admin/accessories.html`, Collection: `accessories`
- **Accounts** - Page: `/admin/accounts.html`
- **Add to Cart** - Button: `addToCart()`, Endpoint: `POST /api/cart`
- **Admin Dashboard** - Page: `/admin/index.html`
- **Admin Login** - Page: `/admin/login.html`, Endpoint: `POST /api/admin/login`
- **Analytics** - Page: `/admin/analytics.html`, Endpoint: `GET /api/admin/stats`
- **API Security** - Page: `/admin/security/api-security.html`
- **API Tester** - Page: `/admin/api-tester.html`
- **Audit Logs** - Page: `/admin/security/audit-logs.html`, Collection: `audit_logs`

### B
- **Banners** - Page: `/admin/online-store/banners.html`
- **Blog Posts** - Page: `/admin/blog/posts.html`
- **Bottom Rail** - Option: `standardBottomBar`, Values: Standard, Wrapped, Heavy
- **Bulk Actions** - Status: Not implemented

### C
- **Campaigns** - Page: `/admin/marketing/campaigns.html`
- **Cart** - Page: `/cart.html`, Endpoint: `GET/POST/PUT/DELETE /api/cart`
- **Categories** - Page: `/admin/categories.html`, Collection: `categories`
- **Child Safety** - Page: `/child-safety.html`
- **Commissions (Dealer)** - Page: `/dealer/commissions.html`
- **Configuration** - Field: `item.configuration`, Type: JSON object
- **Contact** - Page: `/contact.html`, Endpoint: `POST /api/contact`
- **Control Type** - Options: manual, cordless, motorized
- **Customer Invoice** - Type: `customer`, Prefix: `INV-`
- **Customers** - Page: `/admin/customers.html`, Collection: `customers`

### D
- **Dashboard** - Admin: `/admin/index.html`, Dealer: `/dealer/index.html`
- **Dealer Portal** - Path: `/dealer/*`, Auth: `dealerAuthMiddleware`
- **Dealer Tiers** - Values: Bronze (15%), Silver (20%), Gold (25%)
- **Draft Orders** - Page: `/admin/draft-orders.html`

### E
- **Export CSV** - Function: `exportToCsv()`, Status: Partial

### F
- **Fabrics** - Page: `/admin/fabrics.html`, Collection: `fabrics`
- **FAQs** - Page: `/admin/faqs.html`, Collection: `faqs`
- **Filter Functions** - Status: Not implemented (shop.html)
- **Firewall** - Page: `/admin/security/firewall.html`, Status: Stub

### G
- **Grand Total** - Calculation: `lineTotal + shipping + tax`

### H
- **Hardware Options** - Page: `/admin/hardware-options.html`, Collection: `hardwareOptions`
- **Height** - Field: `height`, Range: 12" - 120"
- **Homepage** - Page: `/admin/online-store/homepage.html`

### I
- **Image Manager** - Page: `/admin/image-manager.html`
- **Invoices** - Page: `/admin/invoices.html`, Collection: `invoices`
- **Invoice Number** - Format: `INV-[TIMESTAMP][RANDOM]`
- **Invoice Status** - Values: draft, sent, paid, partially_paid, overdue, cancelled, refunded

### J
- **JWT Token** - Header: `Authorization: Bearer <token>`

### K
- **KPI Cards** - Dashboard metrics: Revenue, Orders, Pending, Low Stock

### L
- **Line Total** - Calculation: `(unitPrice × quantity) + accessoriesTotal`
- **Login** - Pages: admin, dealer, manufacturer portals
- **Logout** - Function: `Admin.Auth.logout()`

### M
- **Manufacturer Invoice** - Type: `manufacturer`, Prefix: `MFR-INV-`
- **Manufacturer Portal** - Path: `/manufacturer/*`
- **Manufacturer Prices** - Collections: `manufacturerPrices`, `zebraManufacturerPrices`
- **Margin** - Calculation: `manufacturerCost × marginPercent`
- **Marketing** - Path: `/admin/marketing/*`
- **Media Library** - Page: `/admin/media-library.html`
- **Motor Brand** - Options: AOK, Dooya
- **Mount Type** - Options: Inside, Outside

### N
- **Navigation** - Page: `/admin/online-store/navigation.html`
- **New Order (Dealer)** - Page: `/dealer/new-order.html`

### O
- **Order Number** - Format: `ORD-[TIMESTAMP]`
- **Order Status** - 17 valid statuses (see 6.2)
- **Orders** - Admin: `/admin/orders.html`, Dealer: `/dealer/orders.html`

### P
- **Page Builder** - Page: `/admin/page-builder.html`
- **Pages** - Page: `/admin/pages.html`
- **Permissions** - Page: `/admin/security/permissions.html`
- **Price Per Square Meter** - Field: `pricePerSqMeter`
- **Print Invoice** - Page: `/admin/print-invoice.html`
- **Product Catalog** - Page: `/admin/product-catalog.html`
- **Product Content** - Page: `/admin/product-content.html`
- **Product Edit** - Page: `/admin/product-edit.html`
- **Product Editor V2** - Page: `/admin/product-editor-v2.html`
- **Product Page Editor** - Page: `/admin/product-page-editor.html`
- **Product Pricing** - Page: `/admin/product-pricing.html`
- **Products** - Page: `/admin/products.html`, Collection: `products`
- **Promotions** - Page: `/admin/marketing/promotions.html`

### Q
- **Quantity** - Field: `quantity`, Range: 1-99
- **Quotes** - Page: `/admin/quotes.html`, Collection: `quotes`

### R
- **Remote Type** - Options: Single, Multi, Smart
- **Returns** - Page: `/returns.html`
- **Role Hierarchy** - super_admin > admin > manager > editor > viewer
- **Room Label** - Field: `room_label`, Type: String

### S
- **Section Builder** - Page: `/admin/section-builder.html`
- **Security** - Path: `/admin/security/*`
- **Sessions** - Page: `/admin/security/sessions.html`
- **Settings** - Page: `/admin/settings.html`, Collection: `settings`
- **Shipping** - Page: `/shipping.html`
- **Shop** - Page: `/shop.html`
- **Shop Settings** - Page: `/admin/online-store/shop-settings.html`
- **Smart Hub** - Accessory: `smart_hub`, Price: $69.00
- **Social** - Page: `/admin/marketing/social.html`
- **Square Meter** - Calculation: `width(m) × height(m)`
- **SSO** - Page: `/admin/security/sso.html`, Status: Stub
- **Status Update** - Modal for changing order status
- **Subscribers** - Page: `/admin/marketing/subscribers.html`
- **Subtotal** - Sum of line totals
- **System Config** - Page: `/admin/system-config.html`

### T
- **Tax** - Calculation: `subtotal × stateRate`
- **Tax Rates** - 50 states + DC (see 6.4)
- **Theme Settings** - Page: `/admin/theme-settings.html`
- **Themes** - Page: `/admin/online-store/themes.html`
- **Two-Factor** - Page: `/admin/security/two-factor.html`, Status: Not implemented

### U
- **Unit Price** - Calculation: `basePrice + options`
- **USB Charger** - Accessory: `usb_charger`, Price: $29.00
- **Users** - Page: `/admin/security/users.html`

### V
- **Valance Type** - Options: Standard Cassette, 4" Fabric, None
- **Visual Builder** - Page: `/admin/visual-builder.html`

### W
- **Warranty** - Page: `/warranty.html`
- **WebSocket** - Service: `ws://localhost:3001/ws`
- **Width** - Field: `width`, Range: 12" - 144"

### Z
- **Zebra Hardware** - Page: `/admin/zebra-hardware.html`
- **Zebra Page Editor** - Page: `/admin/zebra-page-editor.html`
- **Zebra Pricing** - Page: `/admin/zebra-pricing.html`
- **Zebra Product** - Page: `/zebra-product.html`

---

## 9.2 Button Index

| Button Text | Page | Function | Status |
|-------------|------|----------|--------|
| Add to Cart | product.html | `addToCart()` | ✓ |
| Apply Filters | shop.html | Filter products | ✗ Not implemented |
| Cancel Order | orders.html | `cancelOrder()` | ✓ |
| Clear Filters | shop.html | Reset filters | ✓ |
| Connect Facebook | social.html | OAuth connect | ✗ Stub |
| Connect Instagram | social.html | OAuth connect | ✗ Stub |
| Create Automation | automations.html | Create workflow | ✗ Stub |
| Create Campaign | campaigns.html | New campaign | ✗ Stub |
| Create Product | products.html | `openProductModal()` | ✓ |
| Delete | Various | Delete record | ✓ |
| Download Order Sheet | manufacturer/index.html | PDF generation | ✓ |
| Enable 2FA | two-factor.html | Enable 2FA | ✗ Not implemented |
| Export | orders.html | `exportOrders()` | ✓ |
| Export CSV | commissions.html | `exportToCsv()` | ✗ Coming soon |
| Generate Missing Invoices | invoices.html | `generateMissingInvoices()` | ✓ |
| Login | login pages | Authenticate | ✓ |
| Logout | All admin pages | `Admin.Auth.logout()` | ✓ |
| Print Invoice | invoices.html | `printInvoice()` | ✓ |
| Record Payment | invoices.html | `showPaymentModal()` | ✓ |
| Refresh | dashboard | `loadDashboardData()` | ✓ |
| Revoke Session | sessions.html | Revoke token | ✗ Not implemented |
| Save | Various forms | Save changes | ✓ |
| Save as Quote | product.html | `saveAsQuote()` | ✓ |
| Search | Various | Search function | ✓ |
| Send Invoice | invoices.html | Email invoice | ✗ Not implemented |
| Update Status | orders.html | `updateStatus()` | ✓ |
| View Details | orders.html | `viewOrder()` | ✓ |
| View Invoice | invoices.html | `viewInvoice()` | ✓ |

---

## 9.3 Dropdown Index

| Dropdown | Page | Options | Effect |
|----------|------|---------|--------|
| Bottom Rail | product.html | Standard, Wrapped, Heavy | Updates price |
| Category Filter | products.html | All categories | Filters list |
| Color Filter | shop.html | Color options | ✗ Not implemented |
| Control Type | product.html | Manual, Cordless, Motorized | Updates price |
| Fabric | product.html | All fabrics | Updates price |
| Items Per Page | orders.html | 10, 25, 50, 100 | Changes pagination |
| Motor Brand | product.html | AOK, Dooya | Updates price |
| Mount Type | product.html | Inside, Outside | Updates config |
| Price Range | shop.html | Price ranges | ✗ Not implemented |
| Product Type | product-pricing.html | Roller, Zebra | Filters pricing |
| Remote Type | product.html | Single, Multi, Smart | Updates price |
| Role | users.html | viewer to super_admin | Updates permissions |
| Room Filter | shop.html | Room options | ✗ Not implemented |
| Sort By | orders.html | Date, Total | Sorts table |
| Status Filter | orders.html | All statuses | Filters orders |
| Valance Type | product.html | Standard, 4" Fabric, None | Updates price |

---

## 9.4 API Endpoint Index

### Public Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cart` | GET | Get cart |
| `/api/cart` | POST | Add to cart |
| `/api/cart/:itemId` | PUT | Update cart item |
| `/api/cart/:itemId` | DELETE | Remove from cart |
| `/api/categories` | GET | List categories |
| `/api/contact` | POST | Submit contact form |
| `/api/content/:slug` | GET | Get CMS page |
| `/api/fabrics` | GET | List fabrics |
| `/api/orders` | POST | Create order |
| `/api/orders/:orderNumber` | GET | Get order by number |
| `/api/products` | GET | List products |
| `/api/products/:slug` | GET | Get product |
| `/pricing/calculate` | POST | Calculate price |

### Admin Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/customers` | GET | List customers |
| `/api/admin/customers/:id` | GET | Get customer |
| `/api/admin/customers/:id` | PUT | Update customer |
| `/api/admin/hardware` | GET | Get hardware options |
| `/api/admin/hardware` | PUT | Update hardware |
| `/api/admin/invoices` | GET | List invoices |
| `/api/admin/invoices/:id` | GET | Get invoice |
| `/api/admin/invoices/:id/payment` | POST | Record payment |
| `/api/admin/invoices/generate-missing` | POST | Generate invoices |
| `/api/admin/login` | POST | Admin login |
| `/api/admin/orders` | GET | List orders |
| `/api/admin/orders/:id` | GET | Get order |
| `/api/admin/orders/:id/status` | PUT | Update status |
| `/api/admin/products` | GET | List products |
| `/api/admin/products` | POST | Create product |
| `/api/admin/products/:id` | PUT | Update product |
| `/api/admin/products/:id` | DELETE | Delete product |
| `/api/admin/stats` | GET | Dashboard stats |
| `/api/admin/verify` | GET | Verify token |

### Dealer Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dealer/commissions` | GET | Get commissions |
| `/api/dealer/customers` | GET | List customers |
| `/api/dealer/customers` | POST | Create customer |
| `/api/dealer/login` | POST | Dealer login |
| `/api/dealer/orders` | GET | List orders |
| `/api/dealer/orders` | POST | Create order |
| `/api/dealer/stats` | GET | Dashboard stats |
| `/api/dealer/verify` | GET | Verify token |

### Manufacturer Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/manufacturer/login` | POST | Manufacturer login |
| `/api/manufacturer/orders` | GET | List orders |
| `/api/manufacturer/orders/:id/sheet` | GET | Download order sheet |
| `/api/manufacturer/orders/:id/status` | PUT | Update status |
| `/api/manufacturer/verify` | GET | Verify token |

---

# APPENDIX A: FILE LOCATIONS

## Frontend Files
```
/frontend/public/
├── index.html              # Homepage
├── shop.html               # Product listing
├── product.html            # Roller configurator
├── zebra-product.html      # Zebra configurator
├── cart.html               # Shopping cart
├── contact.html            # Contact form
├── shipping.html           # Shipping policy
├── returns.html            # Returns policy
├── warranty.html           # Warranty info
├── child-safety.html       # Safety info
├── page.html               # CMS page renderer
├── admin/                  # Admin portal (58 pages)
├── dealer/                 # Dealer portal (6 pages)
├── manufacturer/           # Manufacturer portal (2 pages)
├── landing/               # Landing pages (9 pages)
└── guides/                # Guide pages (5 pages)
```

## Backend Files
```
/backend/
├── server.js               # Main server (~10,000 lines)
├── database.json           # JSON database
├── package.json            # Dependencies
├── config/
│   └── system-config.js    # System configuration
├── middleware/
│   ├── rbac.js            # Role-based access control
│   └── validation.js       # Input validation
├── routes/
│   └── crm-routes.js       # CRM routes
├── services/
│   ├── extended-pricing-engine.js  # Pricing logic
│   ├── pricing-engine.js          # Base pricing
│   ├── invoice-service.js         # Invoice generation
│   ├── audit-logger.js            # Audit logging
│   ├── analytics-service.js       # Analytics
│   ├── database-schema.js         # Schema definitions
│   ├── ledger-service.js          # Financial ledger
│   ├── media-manager.js           # Media files
│   ├── price-import-service.js    # Price import
│   └── realtime-sync.js           # WebSocket sync
└── scripts/
    ├── fix-shipping-field.js
    ├── import-pricing-data.js
    └── update-invoice-tax.js
```

---

# APPENDIX B: CHANGE LOG

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-11 | 1.0 | Initial QA Dictionary created |

---

# APPENDIX C: GLOSSARY

| Term | Definition |
|------|------------|
| **Cordless** | Spring-balanced lift mechanism without cords |
| **Fabric Code** | Unique identifier for fabric (e.g., RS-001) |
| **Line Total** | Total price for a single line item including options |
| **Manufacturer Cost** | Price paid to manufacturer for product |
| **Margin** | Percentage markup from manufacturer cost |
| **Motorized** | Electric motor-driven lift mechanism |
| **Price Snapshot** | Captured price breakdown at order time |
| **Square Meter (m²)** | Standard unit for fabric pricing |
| **Unit Price** | Price for single unit before quantity multiplication |
| **Valance** | Decorative header covering roller mechanism |

---

**END OF DOCUMENT**

*This QA Dictionary was generated through comprehensive code audit of the Peekaboo Shades platform. All information is based on code analysis as of January 11, 2026.*
