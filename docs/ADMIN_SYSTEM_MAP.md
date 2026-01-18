# ADMIN SYSTEM MAP - Sidebar Navigation Audit
## Peekaboo Shades Admin Panel

**Version:** 2.0 (Phase 0 Audit)
**Total Admin Pages:** 38
**Source:** `frontend/public/admin/index.html` sidebar navigation

---

## 1. NAVIGATION STRUCTURE

### Section: (No Label - Top)
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Dashboard | `/admin/index.html` | `GET /api/admin/dashboard` | WORKING |

### Section: Sales
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Orders | `/admin/orders.html` | `GET /api/admin/orders` | WORKING |
| Quotes | `/admin/quotes.html` | `GET /api/admin/quotes` | WORKING |
| Invoices | `/admin/invoices.html` | `GET /api/admin/invoices` | WORKING |

### Section: Finance
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Accounts & Profit | `/admin/accounts.html` | `GET /api/admin/ledger` | WORKING |
| Manufacturer Portal | `/manufacturer/` (external) | Manufacturer API | WORKING |
| Dealer Portal | `/dealer/` (external) | Dealer API | WORKING |

### Section: Catalog
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Products | `/admin/products.html` | `GET /api/admin/products` | WORKING |
| Launch Product | `/admin/product-launch.html` | N/A (wizard) | WORKING |
| Categories | `/admin/categories.html` | `GET /api/admin/categories` | WORKING |
| Fabrics | `/admin/fabrics.html` | `GET /api/admin/fabrics` | WORKING |
| Zebra Pricing | `/admin/zebra-pricing.html` | `GET /api/admin/manufacturer-prices` | WORKING |
| Zebra Page Editor | `/admin/zebra-page-editor.html` | `GET /api/admin/product-page-content/zebra` | WORKING |
| Hardware Options | `/admin/hardware-options.html` | `GET /api/admin/hardware/:category` | WORKING |
| Accessories | `/admin/accessories.html` | `GET /api/admin/accessories` | WORKING |
| Customer Pricing | `/admin/product-pricing.html` | `GET /api/admin/margins` | WORKING |

### Section: Customers
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| All Customers | `/admin/customers.html` | `GET /api/admin/customers` | WORKING |

### Section: Content
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Product Content | `/admin/product-content.html` | `GET /api/admin/product-catalog` | WORKING |
| Page Editor | `/admin/product-page-editor.html` | `GET /api/admin/product-page-elements` | WORKING |
| Pages | `/admin/pages.html` | `GET /api/admin/pages` | WORKING |
| Blog Posts | `/admin/blog/posts.html` | `GET /api/admin/blog-posts` | NEEDS REVIEW |
| Media Library | `/admin/media-library.html` | `GET /api/admin/media` | WORKING |
| FAQs | `/admin/faqs.html` | `GET /api/admin/faqs` | WORKING |

### Section: Appearance
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Theme & Colors | `/admin/theme-settings.html` | `GET /api/admin/theme` | WORKING |
| Image Manager | `/admin/image-manager.html` | `GET /api/admin/images` | WORKING |

### Section: Analytics
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| Reports | `/admin/analytics.html` | `GET /api/admin/analytics/dashboard` | WORKING |

### Section: Settings
| Sidebar Item | Page | Backend Endpoint | Status |
|--------------|------|------------------|--------|
| System Config | `/admin/system-config.html` | `GET /api/admin/system-config` | WORKING |
| Settings | `/admin/settings.html` | `GET /api/admin/settings` | WORKING |
| Security | `/admin/security/` | `GET /api/admin/security/*` | WORKING |

---

## 2. PAGES NOT IN SIDEBAR

These pages exist but are NOT linked from the sidebar navigation:

| Page | Purpose | Status |
|------|---------|--------|
| `/admin/login.html` | Admin login | WORKING |
| `/admin/api-tester.html` | Debug/test API calls | WORKING |
| `/admin/customer.html` | Single customer view | WORKING (linked from customers.html) |
| `/admin/draft-orders.html` | Draft orders list | NOT LINKED |
| `/admin/abandoned-checkouts.html` | Abandoned cart recovery | NOT LINKED |
| `/admin/page-builder.html` | Visual page builder | NOT LINKED |
| `/admin/print-invoice.html` | Invoice print view | WORKING (linked from invoices.html) |
| `/admin/product-catalog.html` | Product catalog settings | WORKING (linked from product-content) |
| `/admin/product-edit.html` | Product editor | WORKING (linked from products.html) |
| `/admin/product-editor-v2.html` | New product editor | PARTIALLY WORKING |
| `/admin/section-builder.html` | Section builder | NOT LINKED |
| `/admin/visual-builder.html` | Visual page builder | NOT LINKED |
| `/admin/zebra-hardware.html` | Zebra hardware options | WORKING (linked from zebra-page-editor) |

---

## 3. STATUS DEFINITIONS

| Status | Meaning |
|--------|---------|
| WORKING | Page loads, data displays, CRUD operations function |
| NEEDS REVIEW | Page exists but needs verification |
| NOT LINKED | Page exists but not accessible from sidebar |
| PARTIALLY WORKING | Some features work, others may have issues |
| BROKEN | Page errors on load or critical functionality missing |

---

## 4. EXTERNAL PORTALS

| Portal | URL | Auth |
|--------|-----|------|
| Manufacturer Portal | `/manufacturer/` | Separate JWT auth |
| Dealer Portal | `/dealer/` | Separate JWT auth |
| Storefront | `/` (home) | No auth required |

---

## 5. SECURITY SUBPAGES

The Security section has its own subsection at `/admin/security/`:

| Page | Purpose | Backend |
|------|---------|---------|
| overview.html | Security dashboard | `GET /api/admin/security/overview` |
| users.html | User management | `GET /api/admin/security/users` |
| firewall.html | IP blocking | `GET /api/admin/security/firewall` |
| sessions.html | Active sessions | `GET /api/admin/security/sessions` |
| audit-logs.html | Audit trail | `GET /api/admin/security/audit-logs` |
| api-keys.html | API key management | `GET /api/admin/security/api-keys` |
| permissions.html | RBAC permissions | `GET /api/admin/security/permissions` |

---

## 6. PAGE COUNT SUMMARY

| Category | Count |
|----------|-------|
| Pages in Sidebar | 24 |
| Pages NOT in Sidebar | 14 |
| External Portals | 2 |
| **Total Admin Pages** | **38** |

---

## 7. RECOMMENDATIONS

### 7.1 Pages to Add to Sidebar
- `/admin/draft-orders.html` → Add under Sales section
- `/admin/abandoned-checkouts.html` → Add under Sales section

### 7.2 Pages to Consider Removing/Merging
- `/admin/product-editor-v2.html` → Merge with product-edit.html if duplicate
- `/admin/visual-builder.html` → Evaluate if used
- `/admin/section-builder.html` → Evaluate if used
- `/admin/page-builder.html` → Evaluate if used

### 7.3 Missing Blog Navigation
- Blog posts link goes to `/admin/blog/posts.html` which may need `/admin/blog/` directory creation

---

## 8. SIDEBAR HTML STRUCTURE

```html
<nav class="sidebar-nav">
  <!-- Top (Dashboard) -->
  <div class="nav-section">
    <a href="/admin/" class="nav-item">Dashboard</a>
  </div>

  <!-- Sales -->
  <div class="nav-section">
    <div class="nav-section-title">Sales</div>
    <a href="/admin/orders.html">Orders</a>
    <a href="/admin/quotes.html">Quotes</a>
    <a href="/admin/invoices.html">Invoices</a>
  </div>

  <!-- Finance -->
  <div class="nav-section">
    <div class="nav-section-title">Finance</div>
    <a href="/admin/accounts.html">Accounts & Profit</a>
    <a href="/manufacturer/" target="_blank">Manufacturer Portal</a>
    <a href="/dealer/" target="_blank">Dealer Portal</a>
  </div>

  <!-- Catalog (10 items) -->
  <!-- Customers -->
  <!-- Content (6 items) -->
  <!-- Appearance (2 items) -->
  <!-- Analytics -->
  <!-- Settings (3 items) -->
</nav>
```
