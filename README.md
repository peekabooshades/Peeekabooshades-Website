# Peekaboo Shades - E-commerce Platform

A comprehensive e-commerce platform for custom window blinds and shades, featuring customer-facing shopping, dealer portal, manufacturer portal, and admin dashboard.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Features](#features)
- [Portals](#portals)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Pricing System](#pricing-system)

---

## Overview

Peekaboo Shades is a full-featured e-commerce platform for custom window treatments. It supports:

- **Customers**: Browse products, configure blinds, place orders
- **Dealers**: B2B portal with wholesale pricing and commission tracking
- **Manufacturers**: Order fulfillment and production management
- **Admins**: Complete platform management

### Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: JSON file-based (database.json)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Authentication**: JWT tokens
- **Real-time**: WebSocket support

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone git@github.com:peekabooshades/Peeekabooshades-Website.git
cd peekabooshades-new

# Install dependencies
cd backend
npm install

# Start the server
npm start
```

### Access URLs

| Portal | URL | Credentials |
|--------|-----|-------------|
| **Store** | http://localhost:3001 | - |
| **Admin** | http://localhost:3001/admin | admin@peekabooshades.com / admin123 |
| **Dealer** | http://localhost:3001/dealer | john@abcwindows.com / dealer123 |
| **Manufacturer** | http://localhost:3001/manufacturer | factory@zstarr.com / mfr123 |

---

## Project Structure

```
peekabooshades-new/
├── backend/
│   ├── server.js              # Main Express server (all API routes)
│   ├── database.json          # JSON database
│   ├── package.json           # Dependencies
│   ├── config/                # Configuration files
│   ├── middleware/            # Auth, RBAC middleware
│   ├── services/              # Business logic
│   │   ├── pricing-engine.js          # Core pricing calculations
│   │   ├── extended-pricing-engine.js # Advanced pricing
│   │   ├── dealer-service.js          # Dealer operations
│   │   └── audit-logger.js            # Audit logging
│   └── scripts/               # Utility scripts
│
├── frontend/
│   └── public/
│       ├── index.html         # Homepage
│       ├── shop.html          # Product listing
│       ├── product.html       # Product configurator
│       ├── cart.html          # Shopping cart
│       ├── admin/             # Admin portal (35+ pages)
│       ├── dealer/            # Dealer portal
│       │   ├── login.html
│       │   ├── index.html     # Dashboard
│       │   ├── orders.html
│       │   ├── new-order.html # Product configurator
│       │   ├── customers.html
│       │   └── commissions.html
│       └── manufacturer/      # Manufacturer portal
│           ├── login.html
│           └── index.html
│
└── docs/                      # Additional documentation
```

---

## Features

### Customer Features
- Product browsing with filters
- Real-time product configurator
- Custom dimensions (inches/cm/mm)
- Fabric selection with zoom preview
- Hardware options configuration
- Shopping cart with save/load
- Quote requests
- Order tracking

### Dealer Features
- Wholesale pricing (15-25% off retail)
- Tiered discounts (Bronze/Silver/Gold)
- Customer management
- Bulk ordering
- Commission tracking
- Order history
- Price list download

### Manufacturer Features
- Order queue management
- Production status updates
- Shipping/tracking entry
- Quality control workflow
- Performance analytics

### Admin Features
- Product management
- Fabric management
- Hardware options configuration
- Order management
- Customer CRM
- Dealer management
- Margin/pricing rules
- Analytics dashboard
- Content management
- System settings

---

## Portals

### Dealer Portal

**URL**: `/dealer/`

**Pages**:
| Page | Path | Description |
|------|------|-------------|
| Login | `/dealer/login.html` | JWT authentication |
| Dashboard | `/dealer/index.html` | Stats, quick actions, recent orders |
| Orders | `/dealer/orders.html` | Order list with filters |
| New Order | `/dealer/new-order.html` | Full product configurator |
| Customers | `/dealer/customers.html` | Customer CRUD |
| Commissions | `/dealer/commissions.html` | Earnings tracking |

**Pricing Tiers**:
| Tier | Monthly Orders | Discount |
|------|----------------|----------|
| Bronze | 0-10 | 15% off |
| Silver | 11-50 | 20% off |
| Gold | 50+ | 25% off |

### Manufacturer Portal

**URL**: `/manufacturer/`

**Features**:
- Order queue with status filters
- Production workflow (Received → Manufacturing → QA → Shipped)
- Batch status updates
- Tracking number entry
- Performance metrics

### Admin Portal

**URL**: `/admin/`

**Key Pages**:
- Dashboard with analytics
- Products, Fabrics, Hardware management
- Orders, Quotes, Invoices
- Customers, Dealers
- Margin rules configuration
- Content management
- System settings

---

## API Documentation

### Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

### Public Endpoints

```
GET  /api/products                    # List products
GET  /api/products/:slug              # Product details
GET  /api/products/:slug/options      # Product configurator options
GET  /api/fabrics                     # List fabrics
GET  /api/fabrics?category=blackout   # Filter by category
POST /api/checkout                    # Place order
POST /api/quotes                      # Request quote
```

### Dealer Endpoints

```
POST /api/dealer/login                # Authenticate
GET  /api/dealer/stats                # Dashboard statistics
GET  /api/dealer/orders               # List orders
GET  /api/dealer/orders/:id           # Order details
POST /api/dealer/orders               # Create order
GET  /api/dealer/customers            # List customers
POST /api/dealer/customers            # Add customer
PUT  /api/dealer/customers/:id        # Update customer
DELETE /api/dealer/customers/:id      # Delete customer
GET  /api/dealer/commissions          # Commission history
GET  /api/dealer/pricing              # Dealer price list
```

### Manufacturer Endpoints

```
POST /api/manufacturer/login          # Authenticate
GET  /api/manufacturer/stats          # Dashboard stats
GET  /api/manufacturer/orders         # Order queue
GET  /api/manufacturer/orders/:id     # Order details
POST /api/manufacturer/orders/:id/status   # Update status
POST /api/manufacturer/orders/:id/tracking # Add tracking
```

### Admin Endpoints

```
POST /api/admin/login                 # Authenticate
GET  /api/admin/dashboard             # Analytics
GET  /api/admin/products              # Manage products
GET  /api/admin/orders                # All orders
GET  /api/admin/customers             # All customers
GET  /api/admin/dealers               # Dealer management
GET  /api/admin/margins               # Margin rules
PUT  /api/admin/margins               # Update margins
GET  /api/admin/invoices              # Invoice management
```

---

## Database Schema

### Collections in database.json

```javascript
{
  "products": [...],           // Product catalog
  "fabrics": [...],            // Fabric swatches
  "hardwareOptions": [...],    // Hardware configurations
  "orders": [...],             // All orders
  "quotes": [...],             // Quote requests
  "customers": [...],          // Customer records
  "users": [...],              // Admin users
  
  // Dealer Portal
  "dealers": [...],            // Dealer companies
  "dealerUsers": [...],        // Dealer login accounts
  "dealerCustomers": [...],    // Dealer's end customers
  
  // Manufacturer Portal
  "manufacturerUsers": [...],  // Factory login accounts
  
  // Pricing
  "manufacturerPrices": [...], // Base costs
  "marginRules": [...],        // Markup rules
  "customerPriceRules": [...], // Custom pricing
  
  // Content
  "pages": [...],              // CMS pages
  "faqs": [...],               // FAQ content
  "settings": {...}            // System settings
}
```

### Key Data Models

**Product**:
```javascript
{
  "id": "uuid",
  "name": "Affordable Custom Roller Blinds",
  "slug": "affordable-custom-roller-blinds",
  "basePrice": 40,
  "category": "roller-blinds",
  "images": ["url1", "url2"],
  "features": ["Energy Efficient", "Custom Sizes"],
  "isActive": true
}
```

**Dealer**:
```javascript
{
  "id": "dealer-001",
  "companyName": "ABC Window Coverings",
  "contactName": "John Smith",
  "email": "info@abcwindows.com",
  "tier": "silver",
  "status": "active",
  "commissionRate": 0.10
}
```

**Order**:
```javascript
{
  "id": "uuid",
  "orderNumber": "ORD-XXXXXX",
  "status": "pending|processing|manufacturing|shipped|delivered",
  "items": [...],
  "customer": {...},
  "dealerId": "dealer-001",  // If dealer order
  "total": 299.99,
  "createdAt": "ISO date"
}
```

---

## Pricing System

### Price Calculation Formula

```
Total = (Base + Fabric + Hardware + Accessories) × Quantity × (1 - Discount)
```

### Component Pricing

#### Base & Fabric
| Component | Pricing |
|-----------|---------|
| Base Price | Fixed per product ($40-100) |
| Fabric | Per square meter ($8-15/m²) |

#### Control System
| Option | Price |
|--------|-------|
| Manual (Bead Chain) | $0 (included) |
| Bead Chain + Wand | $8 |
| Cordless | $0 (included) |
| Motorized | $0 (motor brand determines price) |
| Cordless-Motorized (2-in-1) | $0 (motor brand determines price) |

> **Note:** Control system options have NO base prices. Motor cost is charged separately based on Motor Brand selection.

#### Motor Brands
| Brand | Price |
|-------|-------|
| AOK Normal (25mm) | $45 |
| AOK Ultra Quiet (AM28mm) | $57 |
| Dooya | $47 |
| Matter | $85 |
| Collise | $160 |
| Somfy | $600 |
| Bliss | $540 |

#### Hardware Options
| Option | Pricing |
|--------|---------|
| Valance (Plain) | $0 (free) |
| Valance (Fabric Wrapped) | $2.20/m² |
| Bottom Rail (Plain) | $0 (free) |
| Bottom Rail (Fabric Wrapped) | $2.20/m² |
| Metal Bead Chain | $2.20/m² |
| Reverse Roll | $0 (free) |
| Forward Roll | $0 (free) |

#### Remotes
| Type | Price |
|------|-------|
| Single Channel | $6.00 |
| 6 Channel | $6.60 |
| 15 Channel | $11.35 |

#### Accessories
| Accessory | Price |
|-----------|-------|
| Smart Hub | $23.50 |
| USB Charger | $5.00 |
| Solar Panel | $20.50 |

#### Shipping
| Zone | Price |
|------|-------|
| Free Shipping Threshold | $499+ |
| Continental US | $9.99 - $39.99 (by weight) |
| Alaska/Hawaii | $19.99 - $59.99 (by weight) |

#### Tax Rates (by State)
| State | Rate |
|-------|------|
| California | 7.25% |
| New York | 8.00% |
| Texas | 6.25% |
| Florida | 6.00% |
| Default | 8.00% |

### Dealer Discounts

Dealers receive automatic discounts based on their tier:
- **Bronze**: 15% off retail
- **Silver**: 20% off retail  
- **Gold**: 25% off retail

### Margin Rules

Admins can configure margin rules by:
- Product category
- Customer type
- Order volume
- Specific products

---

## Development

### Running in Development Mode

```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Environment Variables

Create `.env` file in backend/:
```
PORT=3001
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### Adding New Features

1. **API Endpoint**: Add route in `server.js`
2. **Database**: Update `database.json` schema
3. **Frontend**: Create HTML page in appropriate portal folder
4. **Authentication**: Use appropriate middleware (adminAuth, dealerAuth, mfrAuth)

---

## Support

For issues and feature requests, please open an issue on GitHub.

---

## License

Proprietary - Peekaboo Shades © 2024
