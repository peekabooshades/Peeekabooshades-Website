# Peekaboo Shades - Knowledge Summary

> **AUTO-GENERATED FROM PROJECT DOCUMENTATION**
> Last Updated: 2026-01-03
> Source Files: ARCHITECTURE.md, KNOWLEDGE_TRANSFER.md, API_DOCUMENTATION.md, AI_DEVELOPMENT_GUIDE.md, IMPLEMENTATION_SUMMARY.md, PRODUCT_PAGE_EDITOR.md, CLAUDE.md

---

## A) Business Rules (Pricing, Margins, Roles, Workflows)

### Pricing Rules

1. **PRICING ENGINE IS THE SINGLE SOURCE OF TRUTH**
   - File: `backend/services/extended-pricing-engine.js`
   - Frontend NEVER calculates prices - always calls backend API
   - All pricing flows through `POST /api/v1/pricing/calculate`

2. **Pricing Calculation Flow:**
   ```
   1. Manufacturer Cost Lookup (fabricCode + productType + dimensions)
   2. Margin Rules Application (priority-based matching)
   3. Option Costs (hardware, motorization, accessories)
   4. Shipping Calculation (zone-based, free at $499+)
   5. Tax Calculation (state-based rates)
   6. Return Complete Breakdown
   ```

3. **Margin Rules Priority (highest to lowest):**
   1. Product + Fabric specific rule
   2. Product specific rule
   3. Fabric specific rule
   4. Product type rule (roller/zebra/etc)
   5. Default rule (all products)
   6. Hardcoded 40% fallback if no rules found

4. **Default Margin Configuration:**
   | Product Type | Margin % | Min Margin |
   |--------------|----------|------------|
   | Roller | 40% | $15 |
   | Zebra | 45% | $20 |
   | Honeycomb | 50% | $25 |
   | Roman | 45% | $20 |

5. **Control System Pricing (IMPORTANT - No base prices):**
   - Manual (Bead Chain): $0
   - Bead Chain + Wand: $8 (flat fee)
   - Cordless: $0 (no base price)
   - Motorized: $0 (motor brand determines price)
   - Cordless-Motorized (2-in-1): $0 (motor brand determines price)
   - **Note:** Control system options do NOT have base prices. Motor cost is charged separately based on Motor Brand selection.

6. **Per-Square-Meter Pricing (from customer-config):**
   - Valance (fabric types): $2.20/m²
   - Bottom Rail (non-plain types): $2.20/m²
   - Plain valance/rails: $0
   - Metal Bead Chain: $2.20/m²

7. **Motor Pricing (from customer-config pricingData.ts):**
   | Brand | Price |
   |-------|-------|
   | AOK Normal (25mm) | $45 |
   | AOK Ultra Quiet (AM28mm) | $57 |
   | Dooya | $47 |
   | Matter | $85 |
   | Collise | $160 |
   | Somfy | $600 |
   | Bliss | $540 |

8. **Remote Pricing:**
   - Single Channel: $6.00
   - 6 Channel: $6.60
   - 15 Channel: $11.35

9. **Accessories:**
   - Smart Hub: $23.50
   - USB Charger: $5.00
   - Solar Panel: $20.50

10. **Roller Type:**
    - Forward Roll: $0 (free)
    - Reverse Roll: $0 (free)

11. **Shipping Rules:**
    - Free shipping threshold: $499
    - Continental US: $9.99 - $39.99 based on weight
    - Alaska/Hawaii: $19.99 - $59.99 based on weight

12. **Tax Rules:**
    - California: 7.25%
    - New York: 8%
    - Texas: 6.25%
    - Florida: 6%
    - Default: 8%

### User Roles & Permissions (RBAC)

**Role Hierarchy (by power level):**
```
SUPER_ADMIN (100) - Full system access
ADMIN (80)        - Most operations
MANAGER (60)      - Content & orders
EDITOR (40)       - Content creation only
VIEWER (20)       - Read-only access
```

**Permission Groups:**
- `products.*` - Product CRUD + publish
- `orders.*` - Order view/update/cancel/refund
- `customers.*` - Customer management
- `content.*` - CMS functionality
- `pricing.*` - Pricing rules (ADMIN only)
- `settings.*` - System settings (ADMIN only)
- `users.*` - User management (ADMIN only)
- `security.*` - Security module (ADMIN/SUPER_ADMIN)

### Order Status Workflow

**Valid Transitions:**
```
pending → payment_received → sent_to_manufacturer → in_manufacturing
                                                          ↓
closed ← delivered ← in_shipping ← in_testing ←─────────┘
   ↓
refunded / disputed / cancelled
```

**Status Definitions:**
- `pending` - Order Placed
- `payment_received` - Payment Received
- `sent_to_manufacturer` - Sent to Manufacturer
- `in_manufacturing` - In Manufacturing
- `in_testing` - In Testing
- `in_shipping` - In Shipping
- `delivered` - Delivered
- `closed` - Closed
- `refunded` - Refunded
- `disputed` - Disputed
- `cancelled` - Cancelled

---

## B) Functional Flows (Customer, Admin, Dealer, Manufacturer)

### Customer Flow

```
1. Browse Products (shop.html)
           ↓
2. View Product Detail (product.html)
   - Select fabric/shade style
   - Enter dimensions
   - Choose hardware options
           ↓
3. See Real-Time Price (backend calculates)
           ↓
4. Add to Cart (cart.html)
           ↓
5. Checkout → Create Order
           ↓
6. Track Order (with tracking token)
           ↓
7. Receive Delivery
```

### Admin Flow

```
1. Login (/admin/login.html)
   - JWT token issued (24-hour expiry)
           ↓
2. Dashboard (/admin/index.html)
   - View stats: orders, revenue, products
           ↓
3. Manage Products & Pricing
   - Products, Fabrics, Hardware Options
   - Import manufacturer prices (CSV/PDF)
   - Configure margin rules
           ↓
4. Process Orders
   - View/update order status
   - Create shipments
   - Generate invoices
           ↓
5. Finance & Analytics
   - P&L summary
   - Tax reports
   - Conversion funnels
```

### Manufacturer Portal Flow

```
1. Receive Order (sent_to_manufacturer status)
           ↓
2. Start Production (in_manufacturing status)
           ↓
3. Quality Testing (in_testing status)
           ↓
4. Ship & Add Tracking (in_shipping status)
           ↓
5. Mark Delivered
```

### Price Import Flow

```
1. Prepare CSV file (use template from API)
           ↓
2. Upload via Admin → Manufacturer Prices
           ↓
3. Backend parses and validates
           ↓
4. Records created in manufacturerPrices collection
           ↓
5. Prices immediately available for calculations
```

### Dealer Portal Flow

**URL:** `/dealer/`
**Test Credentials:** `john@abcwindows.com` / `dealer123`

```
1. Login → Dashboard (stats, quick actions)
           ↓
2. New Order → Full product configurator
   - Select product
   - Enter customer details
   - Configure dimensions & options
   - Apply dealer discount automatically
           ↓
3. Manage Customers (CRUD operations)
           ↓
4. Track Commissions
   - Lifetime earnings
   - Monthly earnings
   - Tier progress
```

**Dealer Pricing Tiers:**
| Tier | Monthly Orders | Discount |
|------|----------------|----------|
| Bronze | 0-10 | 15% off |
| Silver | 11-50 | 20% off |
| Gold | 50+ | 25% off |

### Invoice & Ledger Flow

```
1. Order Completed
           ↓
2. Auto-generate Invoice (or manual)
   - Draft → Sent → Paid/Overdue
           ↓
3. Record Payment
   - Full or partial
   - Link to invoice
           ↓
4. Ledger Entry Created
   - Double-entry bookkeeping
   - Debit/Credit balanced
           ↓
5. Finance Summary Updated
   - P&L, Tax, Revenue
```

**Invoice Statuses:** draft, sent, paid, partial, overdue, cancelled

---

## C) UI Principles (Admin-First, Schema-Driven, Dynamic PDP)

### Core UI Principle: Admin Controls Everything

> **"The system is designed so that ALL business-critical data (prices, margins, products, fabrics) is managed through the Admin Dashboard. The frontend only displays what the backend provides."**

### Product Detail Page (PDP) Architecture

1. **Dynamic Configuration:**
   - All options fetched from backend API
   - Prices calculated server-side, never client-side
   - Layout customizable via Product Page Editor

2. **Product Page Editor** (`/admin/product-page-editor.html`):
   - Visual drag-and-drop builder
   - Typography controls (font, size, weight, color)
   - Element visibility toggles
   - Layout stored in `productPageLayouts` collection

3. **Apply Layout Flow:**
   ```
   1. Product page loads
   2. Fetches layout from /api/product-page-sections/:slug
   3. Calls applyLayout() function
   4. applyElementStyles() applies typography to DOM
   ```

### Page Elements (Configurable)

| Element ID | Description |
|------------|-------------|
| `gallery` | Product image gallery |
| `selectShades` | Shade configuration dropdown |
| `productTitle` | Product name and description |
| `price` | Price display with discount |
| `features` | Feature badges |
| `trustBadges` | Shipping, warranty, returns |
| `addToCart` | Add to cart button |
| `requestQuote` | Request quote button |
| `quantity` | Quantity selector |
| `deliveryInfo` | Delivery information |
| `productDetails` | Product details section |
| `faqSection` | FAQ accordion |
| `exploreTrends` | Related products |

### Admin Panel Structure

```
/admin/
├── index.html          # Dashboard
├── orders.html         # Order management
├── products.html       # Product catalog
├── fabrics.html        # Fabric management
├── hardware-options.html # Hardware config
├── system-config.html  # System settings
├── product-page-editor.html # Visual builder
├── security/           # User management, audit logs
└── marketing/          # Promotions
```

---

## D) Technical Constraints (What Must NOT Be Broken)

### Non-Negotiable Constraints

1. **DO NOT redesign customer-facing pages** - UI is stable
2. **Admin MUST control all data and configuration**
3. **Every entity MUST have strong IDs and audit history**
4. **Production-style architecture required**

### Pricing Engine Rules

1. **NEVER calculate prices on frontend**
2. **ALWAYS use ExtendedPricingEngine for pricing**
3. **Margin rules MUST be applied from customerPriceRules**
4. **Manufacturer costs come from manufacturerPrices collection**

### API Response Format

```javascript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Error message", details: [...] }

// List
{ success: true, data: [...], pagination: {...} }
```

### Authentication

- JWT tokens in `Authorization: Bearer <token>` header
- 24-hour token expiry
- Token contains: `{ id, email, name, role }`

### Database

- JSON file-based storage (`database.json`)
- Cache TTL: 5 seconds for reads
- All writes synchronous (file-based)

### Key Collections

```
products, categories, fabrics
manufacturers, manufacturerPrices, customerPriceRules
orders, orderStatusHistory, quotes
shipments, trackingEvents, invoices
payments, refunds, expenses
taxRecords, analyticsEvents, priceImportLogs
adminUsers, hardwareOptions, productPageLayouts
```

### File Naming Conventions

- **Services:** `lowercase-hyphenated-service.js`
- **Middleware:** `lowercase.js`
- **Config:** `lowercase-config.js`
- **Documentation:** `UPPERCASE_UNDERSCORED.md`
- **Admin Pages:** `lowercase-hyphenated.html`

---

## E) Open Questions / Conflicts

### Identified Issues

1. **Price Source Discrepancy:**
   - Previous session updated prices from customer-config pricingData.ts
   - Documentation mentions PDF/CSV import as primary method
   - Need to clarify: Which is the authoritative price source?

2. **Pending Implementation:**
   - Email notifications (templates and sending)
   - Payment integration (Stripe/PayPal mentioned as future)
   - Rate limiting (not implemented)
   - Webhooks (documented as future)

3. **Database Migration:**
   - Currently JSON file-based
   - PostgreSQL/MongoDB mentioned as future consideration
   - No migration path documented

4. **Testing:**
   - Playwright tests mentioned but not implemented
   - No automated test suite currently

### Configuration Sync Required

**Latest Update (2026-01-03) - Synced with customer-config pricingData.ts:**

| Change | Before | After |
|--------|--------|-------|
| Control System (Cordless) | $25 | $0 |
| Control System (Motorized) | from $45 | $0 (motor brand separate) |
| Control System (2-in-1) | from $70 | $0 (motor brand separate) |
| Dooya Motor (all types) | $47-57 | $47 |
| Reverse Roll | $5 | $0 (free) |
| Cordless-Motorized extra fee | $25 | $0 |

**Key principle established:**
- Control System options have NO base prices
- Motor cost is charged separately based on Motor Brand selection (sub-option)
- Motor Brand sub-options: AOK ($45/$57), Dooya ($47), Matter ($85), Collise ($160), Somfy ($600), Bliss ($540)

**Files updated:**
- `backend/services/extended-pricing-engine.js` - Motor pricing logic, removed cordless fees
- `frontend/public/product.html` - Removed prices from control system options

**Previous Update (2026-01-02):**
- Remote: $6, $6.60, $11.35
- Valance/Bottom Rail: $2.20/m² for non-plain types
- Smart Hub: $23.50, USB Charger: $5.00

---

## Quick Reference

### Server URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3001 |
| Customer Site | http://localhost:3001/ |
| Admin Dashboard | http://localhost:3001/admin/ |
| Dealer Portal | http://localhost:3001/dealer/ |
| Manufacturer Portal | http://localhost:3001/manufacturer/ |
| Fabric Extractor | http://localhost:5050 |

### Portal Credentials

| Portal | URL | Email | Password |
|--------|-----|-------|----------|
| **Admin** | /admin | admin@peekabooshades.com | admin123 |
| **Dealer** | /dealer | john@abcwindows.com | dealer123 |
| **Manufacturer** | /manufacturer | factory@zstarr.com | factory123 |

### Key API Endpoints

```
POST /api/v1/pricing/calculate     # Calculate price
POST /api/v1/cart/add              # Add to cart
POST /api/v1/orders                # Create order
GET  /api/v1/orders/:id/track      # Track order
GET  /api/admin/products           # List products (admin)
POST /api/admin/manufacturer-prices/import  # Import prices
GET  /api/admin/finance/summary    # P&L summary
```

### Start Commands

```bash
# Backend
cd backend && npm install && npm start

# Fabric Extractor
cd fabric-extractor && pip3 install -r requirements.txt && python3 app.py
```

---

## Source Files Analyzed

1. `/docs/ARCHITECTURE.md` - System architecture, data flows
2. `/docs/KNOWLEDGE_TRANSFER.md` - Developer onboarding
3. `/docs/API_DOCUMENTATION.md` - Complete API reference
4. `/docs/API_REFERENCE.md` - Detailed API endpoint reference
5. `/docs/AI_DEVELOPMENT_GUIDE.md` - AI development patterns
6. `/docs/IMPLEMENTATION_SUMMARY.md` - What was built
7. `/docs/PRODUCT_PAGE_EDITOR.md` - Visual builder docs
8. `/docs/DEALER_PORTAL.md` - Dealer portal documentation
9. `/docs/FINANCE_ACCOUNTING.md` - Finance & accounting docs
10. `/docs/admin_guide.md` - Admin user guide
11. `/CLAUDE.md` - Development instructions
12. `/README.md` - Project overview & credentials

---

## QA Session Log (2026-01-03)

### Knowledge Bootstrap Complete
- All 12 markdown files read and analyzed
- Knowledge summary updated with Dealer Portal and Invoice/Ledger flows
- Portal credentials documented

### Business Logic Freeze Acknowledged
- Pricing formulas: LOCKED
- Database schemas: LOCKED
- API contracts: LOCKED
- Status workflows: LOCKED
