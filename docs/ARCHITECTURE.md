# Peekaboo Shades - System Architecture

## Overview

Peekaboo Shades is an end-to-end e-commerce platform for custom window blinds with integrated CRM, OMS (Order Management System), Finance, and Analytics capabilities.

## System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER JOURNEY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐│
│  │   Product    │───▶│   Options    │───▶│   Add to     │───▶│  Checkout  ││
│  │   Detail     │    │   Selection  │    │   Cart       │    │  & Payment ││
│  │   Page       │    │              │    │              │    │            ││
│  └──────────────┘    └──────────────┘    └──────────────┘    └────────────┘│
│         │                    │                                      │       │
│         ▼                    ▼                                      ▼       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    BACKEND PRICING ENGINE                             │  │
│  │  • Manufacturer Cost Lookup                                           │  │
│  │  • Margin Rules Application                                           │  │
│  │  • Option Price Calculations                                          │  │
│  │  • Tax & Shipping Estimates                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORDER WORKFLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐         │
│  │  Order     │──▶│  Payment   │──▶│  Sent to   │──▶│    In      │         │
│  │  Placed    │   │  Received  │   │  Mfr       │   │  Mfg       │         │
│  └────────────┘   └────────────┘   └────────────┘   └────────────┘         │
│                                                            │                 │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐         │                 │
│  │  Closed/   │◀──│ Delivered  │◀──│    In      │◀────────┘                 │
│  │  Complete  │   │            │   │  Shipping  │                           │
│  └────────────┘   └────────────┘   └────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Vanilla HTML/CSS/JS | Customer-facing pages, Admin dashboard |
| Backend | Node.js + Express.js | REST API, Business logic |
| Database | JSON File | Persistent storage (can migrate to PostgreSQL) |
| Authentication | JWT | Admin authentication |
| Authorization | RBAC | Role-based access control |

## Directory Structure

```
peekabooshades-new/
├── backend/
│   ├── server.js              # Main Express server (7500+ lines)
│   ├── database.json          # JSON database file
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── rbac.js            # Role-based access control
│   │   └── validation.js      # Input validation & sanitization
│   ├── services/
│   │   ├── pricing-engine.js          # Base pricing calculations
│   │   ├── extended-pricing-engine.js # Manufacturer costs + margins
│   │   ├── price-import-service.js    # PDF/CSV price imports
│   │   ├── database-schema.js         # Schema extensions
│   │   ├── audit-logger.js            # Audit trail logging
│   │   ├── media-manager.js           # Asset management
│   │   ├── content-manager.js         # CMS functionality
│   │   └── realtime-sync.js           # WebSocket updates
│   └── config/
│       └── system-config.js   # Centralized configuration
│
├── frontend/
│   └── public/
│       ├── admin/             # Admin dashboard pages (37 pages)
│       │   ├── index.html     # Dashboard home
│       │   ├── orders.html    # Order management
│       │   ├── products.html  # Product management
│       │   ├── fabrics.html   # Fabric management
│       │   ├── security/      # Security module (9 pages)
│       │   ├── marketing/     # Marketing module (6 pages)
│       │   └── ...
│       ├── product.html       # Product detail page
│       ├── cart.html          # Shopping cart
│       ├── shop.html          # Product catalog
│       └── index.html         # Homepage
│
└── docs/                      # Documentation
    ├── ARCHITECTURE.md        # This file
    ├── KNOWLEDGE_TRANSFER.md  # KT document
    ├── API_DOCUMENTATION.md   # API reference
    └── AI_DEVELOPMENT_GUIDE.md # AI development notes
```

## Core Services

### 1. Pricing Engine (Single Source of Truth)

**File:** `backend/services/extended-pricing-engine.js`

The pricing engine is the ONLY place where prices are calculated. The frontend NEVER calculates prices.

**Pricing Flow:**
```
1. Get Manufacturer Cost
   └── Look up by fabricCode + productType + dimensions
   └── Apply price matrix if available
   └── Fallback to dimension-based calculation

2. Apply Margin Rules
   └── Find matching rule (product > fabric > type > default)
   └── Calculate margin (%, fixed, or tiered)
   └── Apply min/max constraints

3. Add Option Costs
   └── Hardware (valance, bottom rail, roller type)
   └── Motorization (control type, motor type, remote)
   └── Accessories (smart hub, USB charger)

4. Calculate Shipping
   └── Check free shipping threshold
   └── Apply zone-based rates

5. Calculate Tax
   └── Look up state tax rate
   └── Apply to taxable amount

6. Return Complete Breakdown
```

### 2. Price Import Service

**File:** `backend/services/price-import-service.js`

Imports manufacturer prices from:
- **PDF files:** Extracts price tables using text pattern matching
- **CSV files:** Primary recommended method for accuracy

**CSV Template:**
```csv
fabric_code,fabric_name,category,base_price,width_min,width_max,height_min,height_max
82032A,Light Filtering White,light_filtering,25.00,12,144,12,120
82033B,Blackout Gray,blackout,35.00,12,144,12,120
```

### 3. Database Schema

**File:** `backend/services/database-schema.js`

Extended collections:
- `manufacturers` - Manufacturer profiles
- `manufacturerPrices` - Price records from imports
- `customerPriceRules` - Margin configuration
- `orderStatusHistory` - Order audit trail
- `shipments` - Fulfillment tracking
- `trackingEvents` - Carrier updates
- `invoices` - Invoice records
- `payments` - Payment records
- `refunds` - Refund records
- `expenses` - Post-order costs
- `taxRecords` - Tax collection records
- `analyticsEvents` - Anonymized analytics
- `emailLogs` - Email notification logs

### 4. Order Status Workflow

Valid order statuses:
```
pending → payment_received → sent_to_manufacturer → in_manufacturing
                                                          ↓
closed ← delivered ← in_shipping ← in_testing ←─────────┘
   ↓
refunded / disputed
```

## Authentication & Authorization

### JWT Authentication
- Token stored in `Authorization: Bearer <token>` header
- 24-hour expiry
- Contains: `{ id, email, name, role }`

### RBAC Roles (Hierarchy)
```
SUPER_ADMIN (100) - Full system access
ADMIN (80)        - Most operations
MANAGER (60)      - Content & orders
EDITOR (40)       - Content creation only
VIEWER (20)       - Read-only access
```

### Permissions
```javascript
products.view/create/update/delete/publish
orders.view/update/cancel/refund
customers.view/update/delete
content.view/create/update/delete/publish
theme.view/update
media.view/upload/delete
pricing.view/update (ADMIN only)
analytics.view/export
settings.view/update (ADMIN only)
users.view/create/update/delete/roles (ADMIN only)
security.* (ADMIN/SUPER_ADMIN)
```

## API Endpoints

### Public APIs
```
GET  /api/v1/products                    # Product catalog
GET  /api/v1/products/:slug              # Product details
GET  /api/v1/products/:slug/options      # Product options
POST /api/v1/pricing/calculate           # Calculate price
POST /api/v1/cart/add                    # Add to cart
POST /api/v1/orders                      # Create order
GET  /api/v1/orders/:id/track            # Track order (with token)
```

### Admin APIs
```
# Products & Pricing
GET    /api/admin/products
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
GET    /api/admin/manufacturer-prices
POST   /api/admin/manufacturer-prices/import
GET    /api/admin/price-rules
POST   /api/admin/price-rules

# Orders
GET    /api/admin/orders
GET    /api/admin/orders/:id
PUT    /api/admin/orders/:id/status
POST   /api/admin/orders/:id/shipment

# Finance
GET    /api/admin/finance/summary
GET    /api/admin/finance/pnl
GET    /api/admin/finance/tax-report
POST   /api/admin/finance/expenses

# Analytics
GET    /api/admin/analytics/funnel
GET    /api/admin/analytics/segments
POST   /api/admin/analytics/events
```

## Configuration Management

**File:** `backend/config/system-config.js`

All configuration is:
1. Loaded from `database.json` → `systemConfig` key
2. Merged with defaults
3. Cached for 30 seconds
4. Managed via Admin dashboard

**Configurable Areas:**
- Pricing (dimension multipliers, warranty)
- Tax (rates by state, enabled/disabled)
- Shipping (zones, carriers, free threshold)
- Business rules (min/max order values)
- Product dimensions (width/height limits)

## Real-time Updates

**File:** `backend/services/realtime-sync.js`

WebSocket support for:
- Order status changes
- Inventory updates
- Price changes
- Dashboard statistics

## Audit Logging

**File:** `backend/services/audit-logger.js`

All admin actions are logged with:
- Action type (60+ defined actions)
- User ID, email, role
- Resource type and ID
- Before/after state
- IP address, user agent
- Timestamp
- Severity level

## Data Flow Diagram

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Customer    │     │    Admin      │     │  Manufacturer │
│   Browser     │     │   Dashboard   │     │    Portal     │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Express.js API                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │  Auth   │  │  RBAC   │  │Validate │  │  Route Handlers │ │
│  │Middleware│  │Middleware│  │Middleware│  │                 │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                        Services                              │
│  ┌───────────┐  ┌────────────┐  ┌─────────────────────────┐ │
│  │  Pricing  │  │   Order    │  │   Invoice/Finance/      │ │
│  │  Engine   │  │  Workflow  │  │   Analytics Services    │ │
│  └───────────┘  └────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     database.json                            │
│  products | orders | manufacturers | invoices | analytics    │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### Local Development
```bash
cd backend
npm install
node server.js
# Server runs on http://localhost:3001
```

### Environment Variables
```
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
```

## Future Considerations

1. **Database Migration:** JSON → PostgreSQL/MongoDB
2. **Payment Integration:** Stripe/PayPal
3. **Email Provider:** SendGrid/Mailgun
4. **Carrier APIs:** UPS/FedEx/USPS live tracking
5. **Caching:** Redis for session/config caching
6. **Search:** Elasticsearch for product/order search
