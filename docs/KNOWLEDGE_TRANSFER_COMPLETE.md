# Peekaboo Shades - Complete Knowledge Transfer Documentation

**Version:** 2.0.0
**Last Updated:** January 18, 2026
**Author:** Development Team

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Getting Started](#4-getting-started)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Admin Panel](#9-admin-panel)
10. [Dealer Portal](#10-dealer-portal)
11. [Manufacturer Portal](#11-manufacturer-portal)
12. [Customer-Facing Website](#12-customer-facing-website)
13. [Pricing Engine](#13-pricing-engine)
14. [Order Lifecycle](#14-order-lifecycle)
15. [Authentication & Security](#15-authentication--security)
16. [File Upload & Media](#16-file-upload--media)
17. [Configuration](#17-configuration)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Project Overview

### What is Peekaboo Shades?

Peekaboo Shades is a full-stack e-commerce platform for selling custom window blinds and shades. The platform includes:

- **Customer Website**: Browse products, configure custom blinds, add to cart, checkout
- **Member Account System**: Sign up, login, order history, saved addresses, wishlists
- **Admin Panel**: Manage products, orders, customers, content, pricing (189 pages)
- **Dealer Portal**: B2B ordering system for dealers/contractors (6 pages)
- **Manufacturer Portal**: Production management and order fulfillment (2 pages)
- **Technician Portal**: Installation scheduling and management (7 pages)

### Website Pages Summary

| Section | Pages | Description |
|---------|-------|-------------|
| **Customer-Facing** | 20 | Homepage, Shop, Product, Cart, Signup, Login, Account, FAQs, etc. |
| **Landing Pages** | 9 | SEO pages for roller, zebra, blackout, motorized shades |
| **Guides** | 5 | How to measure, comparisons, buying guides |
| **Policies** | 7 | Privacy, Terms, Returns, Shipping, Warranty |
| **Dealer Portal** | 6 | Login, Dashboard, Orders, New Order, Customers, Commissions |
| **Technician Portal** | 7 | Signup, Login, Dashboard, Appointments, Schedule, Payments, Profile |
| **Manufacturer Portal** | 2 | Login, Production Queue Dashboard |
| **Admin Panel** | 189 | Full management system |
| **TOTAL** | **245** | All HTML pages |

### Member Account System

| Page | URL | Purpose |
|------|-----|---------|
| **Sign Up** | `/signup.html` | Create customer account with email or social login |
| **Login** | `/login.html` | Customer authentication |
| **Account** | `/account.html` | Dashboard with orders, addresses, profile |
| **Forgot Password** | `/forgot-password.html` | Password reset flow |

**Sign Up Features:**
- Email registration with password strength indicator
- Social login (Google, Facebook, Apple - coming soon)
- 15% welcome discount (code: WELCOME15)
- Newsletter opt-in
- Terms & privacy agreement

**Login Features:**
- Email/password authentication
- Remember me option
- Redirect support for checkout flow
- Password visibility toggle

### Business Model

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

### Financial Flow Summary

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| **Customer Invoices** | Track revenue from orders | Auto-generated, PDF export, payment tracking |
| **Manufacturer Invoices** | Track production costs | Cost breakdown, material tracking |
| **Accounts** | Track receivables & payables | AR aging, AP scheduling, payment reconciliation |
| **Ledger** | Double-entry bookkeeping | Credits/debits, running balances, audit trail |
| **Profits** | Margin calculations | Per-order profit, product margins, dealer commissions |
| **Analytics** | Business intelligence | Revenue trends, KPIs, financial reports |

### Key Features

| Feature | Description |
|---------|-------------|
| Product Configurator | Real-time pricing as customers customize blinds |
| Multiple Product Types | Roller, Zebra, Honeycomb, Roman shades |
| Custom Dimensions | Width × Height in inches with pricing per sq ft |
| Hardware Options | Valance, bottom rail, motors, controls |
| Multi-Portal System | Admin, Dealer, Manufacturer, Technician portals |
| Order Management | Full lifecycle from order to delivery |
| Invoice Generation | Automatic PDF invoices |
| Real-time Sync | WebSocket updates across portals |

### Portal Data Models & Architecture

This section explains how each portal's data model works and links to the main system.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           PORTAL DATA MODEL ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐      │
│   │   CUSTOMERS   │     │    DEALERS    │     │  TECHNICIANS  │     │ MANUFACTURERS │      │
│   │   (Members)   │     │     (B2B)     │     │ (Installers)  │     │  (Production) │      │
│   └───────┬───────┘     └───────┬───────┘     └───────┬───────┘     └───────┬───────┘      │
│           │                     │                     │                     │               │
│           │                     │                     │                     │               │
│           ▼                     ▼                     ▼                     ▼               │
│   ┌───────────────────────────────────────────────────────────────────────────────────┐    │
│   │                              ORDERS (Central Hub)                                  │    │
│   │   - customerId (links to customer)                                                 │    │
│   │   - dealerId (links to dealer for B2B orders)                                      │    │
│   │   - technicianId (links to assigned technician via appointments)                   │    │
│   │   - manufacturerId (links to production manufacturer)                              │    │
│   └───────────────────────────────────────────────────────────────────────────────────┘    │
│           │                     │                     │                     │               │
│           ▼                     ▼                     ▼                     ▼               │
│   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐        │
│   │  INVOICES   │       │ COMMISSIONS │       │APPOINTMENTS │       │ PRODUCTION  │        │
│   │ (Customer)  │       │  (Dealer)   │       │(Technician) │       │   QUEUE     │        │
│   └─────────────┘       └─────────────┘       └─────────────┘       └─────────────┘        │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 1. Customer (Member) Data Model

**Collections:** `customers`

```javascript
{
  "id": "cust-21ea3271",           // Unique customer ID
  "email": "jane@example.com",     // Login email (unique)
  "password": "$2b$10$...",        // Hashed password (bcrypt)
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "555-987-6543",
  "type": "retail",                // retail, wholesale, trade
  "companyName": "",               // For business customers
  "addresses": [                   // Saved addresses
    {
      "type": "shipping",
      "address": "205 Blue Jasmine Trl, Georgetown, TX 78628"
    }
  ],
  "tags": ["website-signup", "vip"],
  "notes": "Signed up via website",
  "totalOrders": 5,                // Order count (auto-updated)
  "totalSpent": 1467.70,           // Lifetime value (auto-updated)
  "totalSavings": 0,               // Discounts used
  "rewardPoints": 100,             // Loyalty points
  "newsletter": true,              // Email opt-in
  "createdAt": "2026-01-17T20:43:26.903Z",
  "lastLoginAt": "2026-01-17T20:43:31.185Z",
  "lastOrderAt": "2026-01-18T02:59:46.755Z"
}
```

**Linked To:**
- `orders.customerId` → Customer's orders
- `invoices.customerId` → Customer's invoices
- `appointments.customerId` → Installation appointments

**API Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/customer/register` | Create account |
| POST | `/api/customer/login` | Authenticate |
| GET | `/api/customer/profile` | Get profile |
| PUT | `/api/customer/profile` | Update profile |
| GET | `/api/customer/orders` | Order history |
| GET | `/api/customer/addresses` | Saved addresses |

---

#### 2. Dealer Data Model

**Collections:** `dealers`, `dealerUsers`, `dealerCustomers`, `dealerOrders`

```javascript
// Dealer Company
{
  "id": "dealer-001",
  "companyName": "ABC Window Coverings",
  "contactName": "John Smith",
  "email": "contact@abcwindows.com",
  "phone": "555-123-4567",
  "address": {
    "street": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zip": "78701"
  },
  "tier": "silver",                // bronze, silver, gold
  "discountPercent": 20,           // Tier-based discount
  "commissionRate": 5,             // Commission % on sales
  "status": "active",
  "totalOrders": 45,
  "totalRevenue": 125000,
  "createdAt": "2025-01-01T00:00:00.000Z"
}

// Dealer User (Login)
{
  "id": "dealer-user-001",
  "dealerId": "dealer-001",        // Links to dealer company
  "dealerName": "ABC Window Coverings",
  "name": "John Smith",
  "email": "john@abcwindows.com",  // Login email
  "password": "$2b$10$...",        // Hashed password
  "role": "admin",                 // admin, manager, staff
  "status": "active",
  "lastLogin": "2026-01-11T19:52:15.779Z"
}
```

**Tier System:**
| Tier | Min Orders | Discount | Benefits |
|------|------------|----------|----------|
| Bronze | 0 | 15% | Base pricing |
| Silver | 11+ | 20% | Priority support |
| Gold | 51+ | 25% | Dedicated account manager |

**Linked To:**
- `dealerOrders.dealerId` → Dealer's B2B orders
- `dealerCustomers.dealerId` → Dealer's end customers
- `commissions.dealerId` → Dealer earnings

**API Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/dealer/login` | Authenticate |
| GET | `/api/dealer/stats` | Dashboard stats |
| GET | `/api/dealer/orders` | Order list |
| POST | `/api/dealer/orders` | Create B2B order |
| GET | `/api/dealer/customers` | End customers |
| GET | `/api/dealer/commissions` | Commission history |

---

#### 3. Technician Data Model

**Collections:** `technicians`, `appointments`, `installationPayments`

```javascript
// Technician
{
  "id": "tech-b21c1efb",
  "name": "Matt Johnson",
  "email": "matt@gmail.com",       // Login email
  "phone": "8169449009",
  "password": "$2b$10$...",        // Hashed password
  "specialties": [                 // Service capabilities
    "roller-blinds",
    "zebra-shades",
    "roman-shades",
    "honeycomb",
    "motorized",
    "commercial"
  ],
  "serviceAreas": ["Austin", "Round Rock", "Georgetown"],
  "status": "active",              // active, inactive, suspended
  "availability": [                // Available time slots
    {
      "date": "2026-01-20",
      "slots": ["12pm-2pm", "2pm-4pm", "4pm-6pm"]
    }
  ],
  "rating": 4.8,                   // Average customer rating
  "reviewCount": 45,
  "createdAt": "2026-01-18T01:35:05.921Z"
}

// Appointment
{
  "id": "apt-c4e5eff0",
  "appointmentType": "new-installation",  // new-installation, repair, measurement
  "orderId": "ORD-123456",                // Links to order
  "technicianId": "tech-b21c1efb",        // Assigned technician
  "customerId": "cust-ed8efb2f",          // Customer
  "customerName": "Surya",
  "customerPhone": "8169449009",
  "customerEmail": "surya@gmail.com",
  "scheduledDate": "2026-01-19",
  "scheduledTime": "8:00 AM - 10:00 AM",
  "installationAddress": {
    "address1": "205 Blue Jasmine St",
    "city": "Leander",
    "state": "TX",
    "zip": "78628"
  },
  "installationFee": 100,
  "status": "scheduled",           // scheduled, in-progress, completed, cancelled
  "notes": "Ring doorbell",
  "createdAt": "2026-01-18T03:28:28.275Z"
}
```

**Linked To:**
- `appointments.technicianId` → Technician's jobs
- `appointments.orderId` → Installation for specific order
- `appointments.customerId` → Customer being served
- `installationPayments.technicianId` → Technician earnings

**API Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/technician/register` | Create account |
| POST | `/api/technician/login` | Authenticate |
| GET | `/api/technician/stats` | Dashboard stats |
| GET | `/api/technician/appointments` | Job list |
| PUT | `/api/technician/appointments/:id` | Update job status |
| GET | `/api/technician/schedule` | Availability |
| PUT | `/api/technician/schedule` | Update availability |
| GET | `/api/technician/payments` | Earnings history |

---

#### 4. Manufacturer Data Model

**Collections:** `manufacturers`, `manufacturerUsers`, `manufacturerPrices`

```javascript
// Manufacturer Company
{
  "id": "mfr-default",
  "name": "Default Manufacturer",
  "code": "DEFAULT",
  "contactName": "Alice Wang",
  "email": "alice@manufacturer.com",
  "phone": "+86-123-456-7890",
  "address": {
    "street": "",
    "city": "Shenzhen",
    "country": "China"
  },
  "leadTimeDays": 14,              // Production time
  "shippingMethod": "ocean_freight",
  "status": "active",
  "productTypes": ["roller", "zebra", "honeycomb", "roman"],
  "paymentTerms": "net30",
  "createdAt": "2025-01-01T00:00:00.000Z"
}

// Manufacturer User (Login)
{
  "id": "mfr-user-e23820d6",
  "manufacturerId": "mfr-default",  // Links to manufacturer
  "manufacturerName": "Default Manufacturer",
  "name": "Factory Manager",
  "email": "manufacturer@peekaboo.com",
  "password": "$2b$10$...",
  "role": "manager",                // operator, manager, admin
  "status": "active",
  "lastLogin": "2026-01-18T15:53:20.050Z"
}

// Manufacturer Prices
{
  "id": "mp-001",
  "manufacturerId": "mfr-default",
  "productType": "roller",
  "fabricCode": "82032A",
  "fabricName": "Light Filtering White",
  "pricePerSqMeter": 45.00,        // Cost per sq meter
  "status": "active"
}
```

**Order Status Flow (Manufacturer Controls):**
```
order_received → manufacturing → qa → ready_to_ship → shipped
```

**Linked To:**
- `orders.manufacturerId` → Orders assigned to manufacturer
- `manufacturerPrices.manufacturerId` → Pricing data
- `invoices` (type: 'manufacturer') → Manufacturer invoices (payables)
- `orderStatusHistory` → Status change audit trail

**API Endpoints:**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/manufacturer/login` | Authenticate |
| GET | `/api/manufacturer/stats` | Dashboard stats |
| GET | `/api/manufacturer/orders` | Production queue |
| GET | `/api/manufacturer/orders/:id` | Order details |
| PUT | `/api/manufacturer/orders/:id/status` | Update status |
| PUT | `/api/manufacturer/orders/:id/tracking` | Add tracking |

---

### How Data Links Together

```
                                    ┌─────────────────┐
                                    │     ORDER       │
                                    │   (Central)     │
                                    └────────┬────────┘
                                             │
         ┌───────────────┬───────────────────┼───────────────────┬───────────────┐
         │               │                   │                   │               │
         ▼               ▼                   ▼                   ▼               ▼
┌─────────────┐  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  ┌─────────────┐
│  CUSTOMER   │  │   DEALER    │    │ TECHNICIAN  │    │MANUFACTURER │  │  INVOICES   │
│             │  │             │    │             │    │             │  │             │
│ orders[]    │  │dealerOrders │    │appointments │    │ orders[]    │  │ Customer    │
│ addresses[] │  │commissions[]│    │ payments[]  │    │ prices[]    │  │ Manufacturer│
│ invoices[]  │  │customers[]  │    │ schedule[]  │    │ tracking[]  │  │ (Receivable/│
│             │  │             │    │             │    │             │  │  Payable)   │
└─────────────┘  └─────────────┘    └─────────────┘    └─────────────┘  └─────────────┘
```

**Order Links Example:**
```javascript
{
  "id": "ORD-123456",
  "customerId": "cust-ed8efb2f",         // Links to customer
  "dealerId": null,                       // null = direct sale, set = B2B
  "manufacturerId": "mfr-default",        // Production manufacturer
  // ... order details
}

// Related appointment
{
  "orderId": "ORD-123456",
  "technicianId": "tech-b21c1efb",        // Assigned installer
  "customerId": "cust-ed8efb2f"           // Same customer
}

// Related invoices
{
  "orderId": "ORD-123456",
  "type": "customer",                     // Customer invoice (revenue)
  "customerId": "cust-ed8efb2f"
}
{
  "orderId": "ORD-123456",
  "type": "manufacturer",                 // Manufacturer invoice (cost)
  "manufacturerId": "mfr-default"
}
```

---

## 2. Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| HTML5 | Page structure | - |
| CSS3 | Styling (custom, no framework) | - |
| JavaScript | Client-side logic (vanilla JS) | ES6+ |
| Google Fonts | Typography (Montserrat) | - |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime environment | 18.x |
| Express.js | Web framework | 4.x |
| JSON File | Database storage | - |
| bcryptjs | Password hashing | 2.x |
| jsonwebtoken | JWT authentication | 9.x |
| multer | File uploads | 1.x |
| uuid | Unique ID generation | 9.x |
| ws | WebSocket support | 8.x |
| compression | Response compression | 1.x |
| cors | Cross-origin requests | 2.x |

### External Services

| Service | Purpose |
|---------|---------|
| Stripe | Payment processing (planned) |
| SendGrid | Email notifications (planned) |
| AWS S3 | Media storage (planned) |

---

## 3. Project Structure

```
peekabooshades-website/
│
├── backend/                          # Node.js Express Server
│   ├── server.js                     # Main server file (8000+ lines)
│   ├── database.json                 # JSON database
│   ├── package.json                  # Node dependencies
│   │
│   ├── config/
│   │   └── system-config.js          # System configuration
│   │
│   ├── middleware/
│   │   └── auth.js                   # Authentication middleware
│   │
│   ├── routes/
│   │   ├── crm-routes.js             # CRM API routes
│   │   └── payment-routes.js         # Payment API routes
│   │
│   ├── services/
│   │   ├── analytics-service.js      # Analytics & reporting
│   │   ├── audit-logger.js           # Audit trail logging
│   │   ├── content-manager.js        # CMS functionality
│   │   ├── database-index.js         # Database indexing
│   │   ├── database-schema.js        # Schema definitions
│   │   ├── dealer-service.js         # Dealer portal logic
│   │   ├── extended-pricing-engine.js# Advanced pricing calculations
│   │   ├── invoice-service.js        # Invoice generation
│   │   ├── ledger-service.js         # Financial ledger
│   │   ├── manufacturer-service.js   # Manufacturer portal logic
│   │   ├── media-manager.js          # File/image management
│   │   ├── order-service.js          # Order processing
│   │   ├── price-import-service.js   # Price data import
│   │   ├── pricing-engine.js         # Core pricing logic
│   │   ├── realtime-sync.js          # WebSocket sync
│   │   ├── seo-service.js            # SEO management
│   │   └── system-integrity.js       # Data integrity checks
│   │
│   └── scripts/
│       ├── seed-categories.js        # Seed category data
│       ├── smoke-test.js             # API smoke tests
│       └── qa-checklist.js           # QA validation
│
├── frontend/
│   └── public/                       # Static files served by Express
│       │
│       ├── index.html                # Homepage
│       ├── shop.html                 # Product listing
│       ├── product.html              # Product configurator
│       ├── zebra-product.html        # Zebra shades configurator
│       ├── cart.html                 # Shopping cart
│       ├── page.html                 # Dynamic CMS pages
│       ├── blog.html                 # Blog listing
│       ├── faqs.html                 # FAQ page
│       ├── contact.html              # Contact page
│       ├── samples.html              # Sample request
│       ├── trade.html                # Trade program signup
│       ├── order-lookup.html         # Order tracking
│       │
│       ├── admin/                    # Admin Panel (150+ pages)
│       │   ├── index.html            # Dashboard
│       │   ├── login.html            # Admin login
│       │   ├── orders.html           # Order management
│       │   ├── products.html         # Product management
│       │   ├── customers.html        # Customer management
│       │   ├── fabrics.html          # Fabric management
│       │   ├── invoices.html         # Invoice management
│       │   ├── production-queue.html # Production tracking
│       │   ├── js/admin.js           # Admin JavaScript
│       │   ├── css/admin.css         # Admin styles
│       │   └── ...                   # Many more admin pages
│       │
│       ├── dealer/                   # Dealer Portal
│       │   ├── index.html            # Dealer dashboard
│       │   ├── login.html            # Dealer login
│       │   ├── orders.html           # Dealer orders
│       │   ├── new-order.html        # Create order
│       │   ├── customers.html        # Dealer's customers
│       │   └── commissions.html      # Commission tracking
│       │
│       ├── manufacturer/             # Manufacturer Portal
│       │   ├── index.html            # Manufacturer dashboard
│       │   └── login.html            # Manufacturer login
│       │
│       ├── technician/               # Technician Portal
│       │   ├── index.html            # Technician dashboard
│       │   ├── login.html            # Technician login
│       │   ├── appointments.html     # Appointments
│       │   ├── schedule.html         # Schedule view
│       │   └── payments.html         # Payment tracking
│       │
│       ├── landing/                  # SEO Landing Pages
│       │   ├── roller-shades.html
│       │   ├── zebra-shades.html
│       │   ├── motorized-roller-shades.html
│       │   └── ...
│       │
│       ├── policies/                 # Legal Pages
│       │   ├── privacy-policy.html
│       │   ├── terms-of-service.html
│       │   ├── warranty.html
│       │   ├── returns.html
│       │   └── shipping.html
│       │
│       ├── css/                      # Global Stylesheets
│       │   └── styles.css
│       │
│       ├── js/                       # Global JavaScript
│       │   └── main.js
│       │
│       └── images/                   # Image Assets
│           ├── products/
│           ├── fabrics/
│           │   ├── swatches/
│           │   └── zebra/
│           └── banners/
│
├── fabric-extractor/                 # Python PDF Tool
│   ├── app.py                        # Flask application
│   ├── requirements.txt              # Python dependencies
│   └── templates/
│
├── docs/                             # Documentation
│   ├── KNOWLEDGE_TRANSFER_COMPLETE.md
│   ├── API_CONTRACTS.md
│   ├── DATA_MODEL.md
│   └── ...
│
└── scripts/                          # Utility Scripts
    └── framework/
        └── check-nonfunctional.js
```

---

## 4. Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Python 3.8+ (for fabric extractor only)

### Installation

```bash
# Clone repository
git clone https://github.com/peekabooshades/Peeekabooshades-Website.git
cd Peeekabooshades-Website

# Install backend dependencies
cd backend
npm install

# Start the server
npm start
# OR for development with auto-reload:
npm run dev
```

### Accessing the Application

| URL | Description |
|-----|-------------|
| http://localhost:3001 | Customer website homepage |
| http://localhost:3001/shop.html | Product catalog |
| http://localhost:3001/admin/ | Admin panel |
| http://localhost:3001/dealer/ | Dealer portal |
| http://localhost:3001/manufacturer/ | Manufacturer portal |
| http://localhost:3001/technician/ | Technician portal |

### Default Login Credentials

| Portal | Email | Password |
|--------|-------|----------|
| Admin | admin@peekabooshades.com | admin123 |
| Manufacturer | manufacturer@peekaboo.com | manufacturer123 |
| Dealer | dealer@example.com | dealer123 |

---

## 5. Frontend Architecture

### Page Types

#### 1. Static Pages
Simple HTML pages with embedded CSS/JS:
- `index.html` - Homepage
- `contact.html` - Contact page
- `warranty.html` - Warranty info
- `child-safety.html` - Safety information

#### 2. Dynamic Pages
Pages that load data from APIs:
- `shop.html` - Product listing (fetches from `/api/products`)
- `product.html` - Product configurator (fetches product & pricing data)
- `cart.html` - Shopping cart (uses localStorage + API)
- `page.html` - CMS pages (fetches from `/api/pages/{slug}`)

#### 3. Portal Pages
Authenticated pages with full CRUD functionality:
- `admin/*.html` - Admin panel pages
- `dealer/*.html` - Dealer portal pages
- `manufacturer/*.html` - Manufacturer portal pages

### Global JavaScript Patterns

#### API Calls
```javascript
// Standard fetch pattern used across the app
async function fetchData(endpoint) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('API Error:', error);
    showToast(error.message, 'error');
  }
}
```

#### LocalStorage Usage
```javascript
// Cart storage
localStorage.getItem('cart')           // Cart items JSON
localStorage.getItem('cartCount')      // Item count

// Admin auth
localStorage.getItem('adminToken')     // JWT token
localStorage.getItem('adminUser')      // User info JSON

// Dealer auth
localStorage.getItem('dealerToken')
localStorage.getItem('dealerUser')

// Manufacturer auth
localStorage.getItem('mfrToken')
localStorage.getItem('mfrUser')
```

### CSS Architecture

#### Color Palette
```css
:root {
  --primary-brown: #8E6545;      /* Primary brand color */
  --primary-hover: #7A5639;      /* Hover state */
  --secondary-brown: #A67C5B;    /* Secondary accent */
  --text-dark: #1f2937;          /* Primary text */
  --text-muted: #6b7280;         /* Secondary text */
  --background: #f5f7fa;         /* Page background */
  --card-bg: #ffffff;            /* Card background */
  --border: #e5e7eb;             /* Border color */
  --success: #10b981;            /* Success states */
  --warning: #f59e0b;            /* Warning states */
  --error: #dc2626;              /* Error states */
}
```

#### Admin CSS Classes
```css
/* Layout */
.admin-layout          /* Main grid container */
.admin-sidebar         /* Left sidebar */
.admin-main            /* Main content area */
.admin-header          /* Top header bar */
.admin-content         /* Page content */

/* Components */
.card                  /* Content card */
.card-header           /* Card header */
.card-body             /* Card body */
.btn                   /* Button base */
.btn-primary           /* Primary button */
.btn-secondary         /* Secondary button */
.form-group            /* Form field wrapper */
.form-input            /* Input field */
.form-select           /* Select dropdown */
.admin-table           /* Data table */
.modal-overlay         /* Modal backdrop */
.modal                 /* Modal container */
```

---

## 6. Backend Architecture

### Server Structure (server.js)

The main server file is organized into sections:

```javascript
// ============================================
// IMPORTS & CONFIGURATION
// ============================================
const express = require('express');
const cors = require('cors');
// ... other imports

// ============================================
// DATABASE FUNCTIONS
// ============================================
function loadDatabase() { ... }
function saveDatabase(db) { ... }

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const adminAuthMiddleware = (req, res, next) => { ... };
const dealerAuthMiddleware = (req, res, next) => { ... };
const manufacturerAuthMiddleware = (req, res, next) => { ... };

// ============================================
// PUBLIC API ROUTES
// ============================================
app.get('/api/products', ...);
app.get('/api/categories', ...);

// ============================================
// ADMIN API ROUTES
// ============================================
app.get('/api/admin/orders', adminAuthMiddleware, ...);
app.post('/api/admin/products', adminAuthMiddleware, ...);

// ============================================
// DEALER API ROUTES
// ============================================
app.get('/api/dealer/orders', dealerAuthMiddleware, ...);

// ============================================
// MANUFACTURER API ROUTES
// ============================================
app.get('/api/manufacturer/orders', manufacturerAuthMiddleware, ...);
```

### Services Layer

Each service handles specific business logic:

| Service | File | Purpose |
|---------|------|---------|
| Pricing Engine | `extended-pricing-engine.js` | Calculate product prices |
| Order Service | `order-service.js` | Order processing & validation |
| Invoice Service | `invoice-service.js` | Generate & manage invoices |
| Dealer Service | `dealer-service.js` | Dealer portal operations |
| Manufacturer Service | `manufacturer-service.js` | Production management |
| Content Manager | `content-manager.js` | CMS operations |
| Media Manager | `media-manager.js` | File uploads |
| Audit Logger | `audit-logger.js` | Activity logging |
| Analytics Service | `analytics-service.js` | Reports & analytics |
| Database Index | `database-index.js` | Query optimization |

### Request/Response Flow

```
Client Request
     ↓
Express Router
     ↓
Auth Middleware (if protected route)
     ↓
Route Handler
     ↓
Service Layer (business logic)
     ↓
Database (database.json)
     ↓
Response to Client
```

---

## 7. Database Schema

### Overview

The database is a single JSON file (`backend/database.json`) with the following structure:

```javascript
{
  "products": [...],
  "categories": [...],
  "fabrics": [...],
  "hardwareOptions": [...],
  "manufacturerPrices": [...],
  "orders": [...],
  "quotes": [...],
  "customers": [...],
  "invoices": [...],
  "users": [...],            // Customer accounts
  "adminUsers": [...],
  "dealerUsers": [...],
  "manufacturerUsers": [...],
  "dealers": [...],
  "manufacturers": [...],
  "pages": [...],            // CMS pages
  "posts": [...],            // Blog posts
  "faqs": [...],
  "settings": {...},
  "siteContent": {...},
  "globalSettings": {...}
}
```

### Products Schema

```javascript
{
  "id": "prod-001",
  "name": "Premium Roller Blinds",
  "slug": "premium-roller-blinds",
  "description": "High-quality roller blinds...",
  "shortDescription": "Custom roller blinds",
  "category": "roller-blinds",
  "productType": "roller",
  "basePrice": 45.00,
  "pricePerSqFt": 2.50,
  "minWidth": 12,
  "maxWidth": 96,
  "minHeight": 12,
  "maxHeight": 120,
  "images": [
    "/images/products/roller-main.jpg",
    "/images/products/roller-detail.jpg"
  ],
  "features": ["Blackout", "Light Filtering", "Motorized Option"],
  "specifications": {
    "material": "100% Polyester",
    "warranty": "5 Years"
  },
  "seoTitle": "Premium Roller Blinds | Peekaboo Shades",
  "seoDescription": "Shop custom roller blinds...",
  "status": "active",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-15T00:00:00Z"
}
```

### Fabrics Schema

```javascript
{
  "id": "fab-001",
  "code": "FAB001",
  "name": "Arctic White",
  "collection": "Classic Collection",
  "category": "Light Filtering",
  "color": "White",
  "colorFamily": "Neutrals",
  "material": "100% Polyester",
  "opacity": "light-filtering",
  "priceGroup": "A",
  "pricePerSqM": 25.00,
  "swatchImage": "/images/fabrics/swatches/fab001.jpg",
  "fullImage": "/images/fabrics/full/fab001.jpg",
  "productTypes": ["roller", "zebra"],
  "status": "active",
  "stockStatus": "in-stock"
}
```

### Orders Schema

```javascript
{
  "id": "order-uuid-123",
  "order_number": "ORD-ABC123",
  "status": "manufacturing",

  // Customer Info
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "(555) 123-4567",
  "shipping_address": "123 Main St, City, ST 12345",

  // Order Items
  "items": [
    {
      "id": "item-uuid-1",
      "product_id": "prod-001",
      "product_name": "Premium Roller Blinds",
      "product_slug": "premium-roller-blinds",
      "product_type": "roller",
      "width": 36,
      "height": 48,
      "quantity": 2,
      "unit_price": 125.00,
      "line_total": 250.00,
      "room_label": "Living Room",
      "configuration": {
        "fabricCode": "FAB001",
        "fabricName": "Arctic White",
        "controlType": "Chain",
        "controlSide": "Left",
        "mountType": "Inside Mount",
        "valance": true,
        "bottomRail": "Standard",
        "motorBrand": null
      },
      "price_breakdown": {
        "fabricCost": 45.00,
        "hardwareCost": 15.00,
        "motorCost": 0,
        "subtotal": 60.00,
        "markup": 65.00,
        "total": 125.00
      }
    }
  ],

  // Pricing
  "pricing": {
    "subtotal": 450.00,
    "tax": 36.00,
    "taxRate": 0.08,
    "shipping": 25.00,
    "discount": 0,
    "total": 511.00,
    "manufacturer_cost_total": 275.00
  },

  // Payment
  "payment": {
    "method": "credit_card",
    "status": "paid",
    "transactionId": "txn_123",
    "paid_at": "2026-01-15T10:30:00Z"
  },

  // Shipping
  "shipping": {
    "method": "standard",
    "carrier": "FedEx",
    "trackingNumber": "1234567890",
    "estimatedDelivery": "2026-01-22",
    "cost": 25.00
  },

  // Timestamps
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-16T15:00:00Z",
  "production_started_at": "2026-01-15T14:30:00Z",
  "qa_started_at": "2026-01-16T09:00:00Z",
  "ready_to_ship_at": null,
  "shipped_at": null,

  // Source
  "source": "website",  // website, dealer, admin
  "dealer_id": null,
  "notes": []
}
```

### Hardware Options Schema

```javascript
{
  "id": "hw-001",
  "name": "Standard Valance",
  "code": "VALANCE_STD",
  "type": "valance",
  "productTypes": ["roller", "zebra"],
  "pricingType": "per_unit",  // per_unit, per_sqft, per_linear_ft
  "price": 15.00,
  "manufacturerCost": 8.00,
  "description": "Standard aluminum valance",
  "status": "active"
}
```

### Manufacturer Prices Schema

```javascript
{
  "id": "mp-001",
  "fabricCode": "FAB001",
  "fabricName": "Arctic White",
  "collection": "Classic",
  "pricePerSqM": 25.00,
  "pricePerSqFt": 2.32,
  "minOrderQty": 1,
  "leadTime": 5,
  "productTypes": ["roller", "zebra"],
  "supplier": "Supplier A",
  "lastUpdated": "2026-01-01T00:00:00Z"
}
```

### Customers Schema

```javascript
{
  "id": "cust-001",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "USA"
  },
  "orderCount": 5,
  "totalSpent": 2500.00,
  "tags": ["vip", "repeat-customer"],
  "notes": "Prefers morning deliveries",
  "status": "active",
  "createdAt": "2025-06-15T00:00:00Z",
  "lastOrderAt": "2026-01-10T00:00:00Z"
}
```

### Admin Users Schema

```javascript
{
  "id": "admin-001",
  "name": "Admin User",
  "email": "admin@peekabooshades.com",
  "password": "$2a$10$...",  // bcrypt hashed
  "role": "admin",           // admin, manager, staff
  "permissions": ["all"],
  "status": "active",
  "lastLogin": "2026-01-18T10:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### Invoices Schema

```javascript
{
  "id": "inv-001",
  "invoiceNumber": "INV-2026-0001",
  "orderId": "order-uuid-123",
  "orderNumber": "ORD-ABC123",
  "type": "customer",        // customer, manufacturer, dealer
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "address": "123 Main St..."
  },
  "items": [...],
  "subtotal": 450.00,
  "tax": 36.00,
  "shipping": 25.00,
  "total": 511.00,
  "status": "paid",          // draft, sent, paid, overdue, cancelled
  "dueDate": "2026-02-15",
  "paidAt": "2026-01-15T10:30:00Z",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

---

## 8. API Reference

### Authentication APIs

#### Admin Login
```
POST /api/admin/login
Content-Type: application/json

Request:
{
  "email": "admin@peekabooshades.com",
  "password": "admin123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "admin-001",
    "name": "Admin User",
    "email": "admin@peekabooshades.com",
    "role": "admin"
  }
}
```

#### Dealer Login
```
POST /api/dealer/login
Content-Type: application/json

Request:
{
  "email": "dealer@example.com",
  "password": "dealer123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "dealer-001",
    "name": "Dealer Name",
    "companyName": "Dealer Company",
    "email": "dealer@example.com"
  }
}
```

#### Manufacturer Login
```
POST /api/manufacturer/login
Content-Type: application/json

Request:
{
  "email": "manufacturer@peekaboo.com",
  "password": "manufacturer123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "mfr-user-001",
    "manufacturerId": "mfr-001",
    "name": "Manufacturer Admin"
  }
}
```

### Public APIs (No Auth Required)

#### Get Products
```
GET /api/products
GET /api/products?category=roller-blinds
GET /api/products?status=active

Response:
{
  "success": true,
  "data": [...products],
  "total": 4
}
```

#### Get Single Product
```
GET /api/products/:slug

Response:
{
  "success": true,
  "data": {
    "id": "prod-001",
    "name": "Premium Roller Blinds",
    ...
  }
}
```

#### Get Categories
```
GET /api/categories

Response:
{
  "success": true,
  "data": [
    { "id": "cat-001", "name": "Roller Blinds", "slug": "roller-blinds" },
    { "id": "cat-002", "name": "Zebra Shades", "slug": "zebra-shades" }
  ]
}
```

#### Get Fabrics
```
GET /api/fabrics
GET /api/fabrics?productType=roller
GET /api/fabrics?collection=Classic

Response:
{
  "success": true,
  "data": [...fabrics],
  "total": 369
}
```

#### Calculate Price
```
POST /api/pricing/calculate
Content-Type: application/json

Request:
{
  "productType": "roller",
  "width": 36,
  "height": 48,
  "fabricCode": "FAB001",
  "configuration": {
    "controlType": "Chain",
    "controlSide": "Left",
    "mountType": "Inside",
    "valance": true,
    "bottomRail": "Standard",
    "motorBrand": null
  },
  "quantity": 2
}

Response:
{
  "success": true,
  "data": {
    "unitPrice": 125.00,
    "lineTotal": 250.00,
    "breakdown": {
      "fabricCost": 45.00,
      "hardwareCost": 15.00,
      "motorCost": 0,
      "valanceCost": 12.00,
      "subtotal": 72.00,
      "markup": 53.00,
      "total": 125.00
    }
  }
}
```

#### Submit Order
```
POST /api/orders
Content-Type: application/json

Request:
{
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "(555) 123-4567",
    "address": "123 Main St, City, ST 12345"
  },
  "items": [
    {
      "productId": "prod-001",
      "productName": "Premium Roller Blinds",
      "width": 36,
      "height": 48,
      "quantity": 2,
      "configuration": {...},
      "unitPrice": 125.00
    }
  ],
  "shippingMethod": "standard",
  "paymentMethod": "credit_card"
}

Response:
{
  "success": true,
  "data": {
    "orderId": "order-uuid-123",
    "orderNumber": "ORD-ABC123",
    "total": 511.00
  }
}
```

#### Get CMS Page
```
GET /api/pages/:slug

Response:
{
  "success": true,
  "data": {
    "id": "page-001",
    "title": "About Us",
    "slug": "about-us",
    "content": "<h1>About Peekaboo Shades</h1>...",
    "seoTitle": "About Us | Peekaboo Shades",
    "seoDescription": "Learn about Peekaboo Shades..."
  }
}
```

#### Get FAQs
```
GET /api/faqs
GET /api/faqs?category=ordering

Response:
{
  "success": true,
  "data": [
    {
      "id": "faq-001",
      "question": "How do I measure my windows?",
      "answer": "To measure your windows...",
      "category": "measuring"
    }
  ]
}
```

#### Site Content Bundle
```
GET /api/content/bundle

Response:
{
  "success": true,
  "data": {
    "topBar": {
      "phone": "+1 929-465-9549",
      "email": "peekabooshades.pro@gmail.com"
    },
    "homepage": {...},
    "navigation": {...},
    "footer": {...}
  }
}
```

### Admin APIs (Auth Required)

All admin APIs require header: `Authorization: Bearer {token}`

#### Orders
```
GET /api/admin/orders
GET /api/admin/orders?status=pending
GET /api/admin/orders?search=john
GET /api/admin/orders/:id
POST /api/admin/orders
PUT /api/admin/orders/:id
PUT /api/admin/orders/:id/status
DELETE /api/admin/orders/:id
```

#### Products
```
GET /api/admin/products
GET /api/admin/products/:id
POST /api/admin/products
PUT /api/admin/products/:id
DELETE /api/admin/products/:id
```

#### Customers
```
GET /api/admin/customers
GET /api/admin/customers/:id
POST /api/admin/customers
PUT /api/admin/customers/:id
DELETE /api/admin/customers/:id
```

#### Fabrics
```
GET /api/admin/fabrics
POST /api/admin/fabrics
PUT /api/admin/fabrics/:id
DELETE /api/admin/fabrics/:id
POST /api/admin/fabrics/import  (CSV import)
```

#### Hardware Options
```
GET /api/admin/hardware-options
POST /api/admin/hardware-options
PUT /api/admin/hardware-options/:id
DELETE /api/admin/hardware-options/:id
```

#### Invoices
```
GET /api/admin/invoices
GET /api/admin/invoices/:id
POST /api/admin/invoices
PUT /api/admin/invoices/:id/status
GET /api/admin/invoices/:id/pdf
```

#### CMS Pages
```
GET /api/admin/pages
GET /api/admin/pages/:id
POST /api/admin/pages
PUT /api/admin/pages/:id
DELETE /api/admin/pages/:id
```

#### Settings
```
GET /api/admin/settings
PUT /api/admin/settings
GET /api/admin/settings/:key
PUT /api/admin/settings/:key
```

#### Analytics
```
GET /api/admin/analytics/dashboard
GET /api/admin/analytics/sales?period=30d
GET /api/admin/analytics/products
GET /api/admin/analytics/customers
```

### Dealer APIs (Auth Required)

```
GET /api/dealer/orders
GET /api/dealer/orders/:id
POST /api/dealer/orders
GET /api/dealer/customers
POST /api/dealer/customers
GET /api/dealer/commissions
GET /api/dealer/profile
PUT /api/dealer/profile
```

### Manufacturer APIs (Auth Required)

```
GET /api/manufacturer/stats
GET /api/manufacturer/orders
GET /api/manufacturer/orders/:id
POST /api/manufacturer/orders/:id/status
POST /api/manufacturer/orders/:id/shipping
POST /api/manufacturer/orders/:id/tracking
```

---

## 9. Admin Panel

### Dashboard (`/admin/index.html`)

**Purpose:** Overview of business metrics and recent activity

**Components:**
- Sales stats (today, week, month)
- Order count by status
- Recent orders table
- Top products chart
- Revenue chart

**APIs Used:**
- `GET /api/admin/analytics/dashboard`
- `GET /api/admin/orders?limit=10`

### Orders Management (`/admin/orders.html`)

**Purpose:** View and manage all orders

**Features:**
- Order list with filters (status, date, search)
- Order detail view
- Status updates
- Add notes
- Generate invoices
- Print packing slips

**Order Statuses:**
| Status | Description |
|--------|-------------|
| `pending` | Order placed, awaiting payment |
| `paid` | Payment received |
| `order_received` | Ready for production |
| `manufacturing` | In production |
| `qa` | Quality assurance |
| `ready_to_ship` | Ready for shipping |
| `shipped` | Shipped to customer |
| `delivered` | Delivered |
| `cancelled` | Cancelled |
| `refunded` | Refunded |

**APIs Used:**
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PUT /api/admin/orders/:id/status`

### Products Management (`/admin/products.html`)

**Purpose:** Manage product catalog

**Features:**
- Product list with search/filter
- Add/edit products
- Upload product images
- Set pricing rules
- SEO settings

**APIs Used:**
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `POST /api/admin/media/upload`

### Fabrics Management (`/admin/fabrics.html`)

**Purpose:** Manage fabric catalog

**Features:**
- Fabric list with filters (collection, color, opacity)
- Add/edit fabrics
- Upload swatch images
- Set pricing per sq meter
- Import from CSV
- Assign to product types

**APIs Used:**
- `GET /api/admin/fabrics`
- `POST /api/admin/fabrics`
- `PUT /api/admin/fabrics/:id`
- `POST /api/admin/fabrics/import`

### Hardware Options (`/admin/hardware-options.html`)

**Purpose:** Manage hardware options (valance, bottom rail, motors)

**Features:**
- Option list by type
- Add/edit options
- Set pricing (per unit or per sq ft)
- Assign to product types

**APIs Used:**
- `GET /api/admin/hardware-options`
- `POST /api/admin/hardware-options`
- `PUT /api/admin/hardware-options/:id`

### Customers Management (`/admin/customers.html`)

**Purpose:** View and manage customer records

**Features:**
- Customer list with search
- Customer detail view
- Order history
- Add notes/tags
- Export customer data

**APIs Used:**
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id`
- `PUT /api/admin/customers/:id`

### Invoices (`/admin/invoices.html`)

**Purpose:** Manage invoices

**Features:**
- Invoice list by status
- View invoice details
- Generate PDF
- Send via email
- Mark as paid

**APIs Used:**
- `GET /api/admin/invoices`
- `GET /api/admin/invoices/:id`
- `PUT /api/admin/invoices/:id/status`
- `GET /api/admin/invoices/:id/pdf`

### Production Queue (`/admin/production-queue.html`)

**Purpose:** Track orders through production

**Features:**
- Kanban board view
- Table view
- Filter by status/product type
- Move orders between stages
- Export queue

**Statuses Tracked:**
- Order Received
- Manufacturing
- QA
- Ready to Ship
- Shipped

**APIs Used:**
- `GET /api/admin/orders?status=order_received`
- `GET /api/admin/orders?status=manufacturing`
- `GET /api/admin/orders?status=qa`
- `GET /api/admin/orders?status=ready_to_ship`
- `GET /api/admin/orders?status=shipped`
- `PUT /api/admin/orders/:id/status`

### Pages CMS (`/admin/pages.html`)

**Purpose:** Manage website content pages

**Features:**
- Page list
- WYSIWYG editor
- SEO settings
- Publish/unpublish

**APIs Used:**
- `GET /api/admin/pages`
- `POST /api/admin/pages`
- `PUT /api/admin/pages/:id`

### FAQs (`/admin/faqs.html`)

**Purpose:** Manage FAQ content

**Features:**
- FAQ list by category
- Add/edit FAQs
- Reorder FAQs
- Categories management

**APIs Used:**
- `GET /api/admin/faqs`
- `POST /api/admin/faqs`
- `PUT /api/admin/faqs/:id`

### Media Library (`/admin/media-library.html`)

**Purpose:** Manage uploaded files and images

**Features:**
- Image gallery view
- Upload files
- Delete files
- Copy URLs
- Filter by type

**APIs Used:**
- `GET /api/admin/media`
- `POST /api/admin/media/upload`
- `DELETE /api/admin/media/:id`

### Settings (`/admin/settings.html`)

**Purpose:** Configure system settings

**Settings Categories:**
- Store information (name, address, contact)
- Tax settings
- Shipping settings
- Email settings
- Payment settings

**APIs Used:**
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

### Analytics (`/admin/analytics.html`)

**Purpose:** Business reports and analytics

**Reports Available:**
- Sales by period
- Sales by product
- Sales by region
- Customer analytics
- Order fulfillment metrics

**APIs Used:**
- `GET /api/admin/analytics/dashboard`
- `GET /api/admin/analytics/sales`
- `GET /api/admin/analytics/products`
- `GET /api/admin/analytics/customers`

### Admin Navigation Structure

```
Dashboard
│
├── Orders
│   ├── All Orders
│   ├── Draft Orders
│   ├── Quotes
│   └── Production Queue
│
├── Products
│   ├── All Products
│   ├── Categories
│   ├── Fabrics
│   ├── Hardware Options
│   └── Pricing
│
├── Customers
│   ├── All Customers
│   └── Customer Groups
│
├── Content
│   ├── Pages
│   ├── Blog Posts
│   ├── FAQs
│   └── Media Library
│
├── Marketing
│   ├── Promotions
│   ├── Coupons
│   ├── Campaigns
│   └── Subscribers
│
├── Reports
│   ├── Sales
│   ├── Products
│   ├── Customers
│   └── Production
│
├── Settings
│   ├── Store Settings
│   ├── Tax Settings
│   ├── Shipping
│   ├── Payments
│   └── Users
│
└── Security
    ├── Users
    ├── Permissions
    ├── Audit Logs
    └── API Security
```

---

## 10. Dealer Portal

### Overview

The Dealer Portal is a B2B ordering system for authorized dealers, contractors, and interior designers.

**URL:** `/dealer/`
**Login:** `/dealer/login.html`

### Features

| Feature | Description |
|---------|-------------|
| Dashboard | Overview of orders, commissions, performance |
| Place Orders | Create orders for their customers |
| Order History | View past orders and status |
| Customer Management | Manage their customer list |
| Commission Tracking | View earned commissions |
| Profile Management | Update company info |

### Dealer Dashboard (`/dealer/index.html`)

**Components:**
- Order statistics (pending, shipped, total)
- Recent orders table
- Commission summary
- Quick order button

**APIs Used:**
- `GET /api/dealer/orders`
- `GET /api/dealer/commissions`

### Place Order (`/dealer/new-order.html`)

**Features:**
- Product configurator
- Customer selection/creation
- Multi-item orders
- Dealer pricing display
- Submit order

**APIs Used:**
- `GET /api/products`
- `GET /api/fabrics`
- `POST /api/pricing/calculate`
- `POST /api/dealer/orders`

### Orders (`/dealer/orders.html`)

**Features:**
- Order list with filters
- Order detail view
- Track shipments

**APIs Used:**
- `GET /api/dealer/orders`
- `GET /api/dealer/orders/:id`

### Commissions (`/dealer/commissions.html`)

**Features:**
- Commission history
- Pending commissions
- Paid commissions
- Export reports

**APIs Used:**
- `GET /api/dealer/commissions`

### Dealer Pricing

Dealers receive discounted pricing:

```javascript
// Dealer discount calculation
const dealerPrice = retailPrice * (1 - dealerDiscountPercent);
const commission = retailPrice - dealerPrice - manufacturerCost;
```

---

## 11. Manufacturer Portal

### Overview

The Manufacturer Portal is for production staff to manage order fulfillment.

**URL:** `/manufacturer/`
**Login:** `/manufacturer/login.html`

### Features

| Feature | Description |
|---------|-------------|
| Dashboard | Production statistics |
| Order Queue | Orders to be manufactured |
| Order Details | Full specifications |
| Status Updates | Move orders through stages |
| Shipping | Add tracking info |

### Production Workflow

```
Order Received → Manufacturing → QA → Ready to Ship → Shipped
```

### Status Actions

| Current Status | Available Actions |
|----------------|-------------------|
| `order_received` | Start Production |
| `manufacturing` | Move to QA |
| `qa` | Ready to Ship / Back to Manufacturing |
| `ready_to_ship` | Mark as Shipped / Back to QA |
| `shipped` | (Complete) |

### APIs Used

- `GET /api/manufacturer/stats`
- `GET /api/manufacturer/orders`
- `GET /api/manufacturer/orders/:id`
- `POST /api/manufacturer/orders/:id/status`
- `POST /api/manufacturer/orders/:id/shipping`
- `POST /api/manufacturer/orders/:id/tracking`

---

## 12. Customer-Facing Website

### Homepage (`/index.html`)

**Sections:**
- Hero banner with CTA
- Featured products
- Why choose us
- Customer reviews
- Newsletter signup
- Footer with links

**Dynamic Content:**
- Loads site content from `/api/content/bundle`
- Loads products from `/api/products?featured=true`

### Shop Page (`/shop.html`)

**Features:**
- Product grid
- Category filters
- Sort options (price, name)
- Pagination

**APIs Used:**
- `GET /api/products`
- `GET /api/categories`

### Product Configurator (`/product.html`)

**The most complex page** - allows customers to customize blinds.

**Configuration Options:**
1. **Dimensions** - Width × Height in inches
2. **Fabric** - Select from fabric swatches
3. **Control Type** - Chain, Cordless, Motorized
4. **Control Side** - Left, Right
5. **Mount Type** - Inside, Outside
6. **Valance** - Yes/No
7. **Bottom Rail** - Standard, Weighted
8. **Motor** - Brand selection (if motorized)
9. **Room Label** - Custom name
10. **Quantity** - Number of blinds

**Real-time Pricing:**
- Price updates as options change
- Shows breakdown (fabric + hardware + motor)
- Displays total with quantity

**Add to Cart:**
- Stores configuration in cart
- Updates cart count
- Shows confirmation

**APIs Used:**
- `GET /api/products/:slug`
- `GET /api/fabrics?productType=roller`
- `GET /api/hardware-options`
- `POST /api/pricing/calculate`

### Cart Page (`/cart.html`)

**Features:**
- Cart item list with configurations
- Edit item (returns to configurator)
- Remove item
- Quantity update
- Subtotal calculation
- Proceed to checkout

**Storage:**
- Cart stored in `localStorage.cart`
- JSON array of cart items

### Checkout Flow

1. **Cart Review** - Review items
2. **Customer Info** - Name, email, phone, address
3. **Shipping** - Select shipping method
4. **Payment** - Enter payment details
5. **Confirmation** - Order placed

### Member Account System

#### Sign Up Page (`/signup.html`)

**Features:**
- Social login buttons (Google, Facebook, Apple - Coming Soon)
- Email registration form
- Password strength indicator
- Terms & privacy policy agreement
- Newsletter opt-in
- 15% welcome discount promotion (code: WELCOME15)

**Form Fields:**
- First Name, Last Name
- Email Address
- Phone Number (optional)
- Password (min 8 characters)
- Confirm Password

**APIs Used:**
- `POST /api/customer/register`
- `GET /api/customer/verify`

**Post-Registration:**
- JWT token stored in localStorage
- Redirects to `/account.html`

#### Login Page (`/login.html`)

**Features:**
- Social login buttons (Google, Facebook - Coming Soon)
- Email/password login
- Remember me checkbox
- Forgot password link
- Password visibility toggle

**APIs Used:**
- `POST /api/customer/login`
- `GET /api/customer/verify`

**Post-Login:**
- JWT token stored in localStorage or sessionStorage (based on "Remember me")
- Supports redirect URL parameter (`?redirect=/checkout.html`)

#### Customer Account Page (`/account.html`)

**Features:**
- Order history
- Saved addresses
- Wishlists/Favorites
- Account settings
- Reorder from previous orders

**APIs Used:**
- `GET /api/customer/orders`
- `GET /api/customer/profile`
- `PUT /api/customer/profile`
- `GET /api/customer/addresses`

#### Forgot Password (`/forgot-password.html`)

**Features:**
- Email input for password reset
- Sends reset link via email

**APIs Used:**
- `POST /api/customer/forgot-password`
- `POST /api/customer/reset-password`

### Order Lookup (`/order-lookup.html`)

**Features:**
- Enter order number
- View order status
- Track shipment

**APIs Used:**
- `GET /api/orders/:orderNumber/status`

### FAQ Page (`/faqs.html`)

**Features:**
- FAQ categories
- Expandable answers
- Search functionality

**APIs Used:**
- `GET /api/faqs`

### Contact Page (`/contact.html`)

**Features:**
- Contact form
- Store information
- Map (optional)

**APIs Used:**
- `POST /api/contact`

### Sample Request (`/samples.html`)

**Features:**
- Select fabric samples
- Enter shipping info
- Submit request

**APIs Used:**
- `POST /api/sample-requests`

---

## 13. Pricing Engine

### Overview

The pricing engine calculates product prices based on:
- Fabric cost per square meter
- Hardware options
- Motor (if motorized)
- Markup percentage

### Pricing Formula

```javascript
// Calculate square footage
const sqFt = (width * height) / 144;
const sqM = sqFt * 0.0929;

// Fabric cost
const fabricCost = sqM * fabricPricePerSqM;

// Hardware costs
let hardwareCost = 0;
if (valance) hardwareCost += valancePrice;
if (bottomRail !== 'standard') hardwareCost += bottomRailPrice;

// Motor cost (if motorized)
let motorCost = 0;
if (motorized) {
  motorCost = motorBasePrice + (sqFt * motorPricePerSqFt);
}

// Total manufacturer cost
const manufacturerCost = fabricCost + hardwareCost + motorCost;

// Apply markup
const markup = manufacturerCost * markupPercent;
const unitPrice = manufacturerCost + markup;

// Line total
const lineTotal = unitPrice * quantity;
```

### File Location

`/backend/services/extended-pricing-engine.js`

### Key Functions

```javascript
// Calculate price for single item
calculateItemPrice(productType, width, height, fabricCode, configuration, quantity)

// Get fabric pricing
getFabricPrice(fabricCode)

// Get hardware option price
getHardwarePrice(optionCode, width, height)

// Get motor price
getMotorPrice(motorBrand, width, height)

// Calculate bulk discount (if applicable)
calculateBulkDiscount(items)
```

---

## 14. Order Lifecycle

### Complete Order Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER JOURNEY                               │
├──────────────────────────────────────────────────────────────────────┤
│  1. Browse Products    →  2. Configure    →  3. Add to Cart          │
│  4. Checkout           →  5. Payment      →  6. Confirmation         │
└──────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────┐
│                         ADMIN PROCESSING                              │
├──────────────────────────────────────────────────────────────────────┤
│  7. Order Received     →  8. Payment Verified  →  9. Invoice Created │
└──────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────┐
│                       MANUFACTURER PORTAL                             │
├──────────────────────────────────────────────────────────────────────┤
│  10. Manufacturing     →  11. Quality Check  →  12. Ready to Ship    │
└──────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────┐
│                           SHIPPING                                    │
├──────────────────────────────────────────────────────────────────────┤
│  13. Shipped           →  14. Tracking Updated  →  15. Delivered     │
└──────────────────────────────────────────────────────────────────────┘
```

### Status Transitions

| From | To | Trigger |
|------|-----|---------|
| (new) | pending | Order created |
| pending | paid | Payment received |
| paid | order_received | Admin confirms |
| order_received | manufacturing | Manufacturer starts |
| manufacturing | qa | Production complete |
| qa | ready_to_ship | QA passed |
| ready_to_ship | shipped | Tracking added |
| shipped | delivered | Customer confirms |
| (any) | cancelled | Admin/customer cancels |
| (any) | refunded | Refund processed |

### Automatic Actions

| Event | Action |
|-------|--------|
| Order created | Send confirmation email |
| Payment received | Generate invoice |
| Order shipped | Send tracking email |
| Order delivered | Request review |

---

## 15. Authentication & Security

### JWT Token Structure

```javascript
{
  "id": "user-001",
  "email": "user@example.com",
  "name": "User Name",
  "role": "admin",
  "iat": 1705555555,
  "exp": 1705641955
}
```

### Token Expiration

- Admin tokens: 24 hours
- Dealer tokens: 24 hours
- Manufacturer tokens: 24 hours

### Password Hashing

```javascript
// Using bcryptjs
const hashedPassword = bcrypt.hashSync(password, 10);
const isValid = bcrypt.compareSync(inputPassword, hashedPassword);
```

### Auth Middleware

```javascript
// Admin auth
const adminAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Security Best Practices

1. **Passwords** - Never stored in plain text
2. **Tokens** - Short expiration, refresh mechanism
3. **CORS** - Configured for allowed origins
4. **Input Validation** - All inputs sanitized
5. **SQL Injection** - N/A (JSON database)
6. **XSS** - Content escaped before display

---

## 16. File Upload & Media

### Upload Endpoint

```
POST /api/admin/media/upload
Content-Type: multipart/form-data

FormData:
- file: (binary)
- folder: "products" | "fabrics" | "banners"
```

### Supported File Types

| Type | Extensions | Max Size |
|------|------------|----------|
| Images | jpg, jpeg, png, gif, webp | 10MB |
| Documents | pdf | 10MB |

### Storage Location

```
frontend/public/images/
├── products/
├── fabrics/
│   ├── swatches/
│   └── zebra/
├── banners/
└── uploads/
```

### Media Manager Service

File: `/backend/services/media-manager.js`

```javascript
// Upload file
uploadFile(file, folder)

// Delete file
deleteFile(filePath)

// Get file list
getFiles(folder)

// Generate thumbnail
generateThumbnail(imagePath)
```

---

## 17. Configuration

### Environment Variables

Create `.env` file in `/backend/`:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_...
SENDGRID_API_KEY=SG...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
```

### System Configuration

File: `/backend/config/system-config.js`

```javascript
module.exports = {
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h'
  },
  pricing: {
    defaultMarkup: 0.65,      // 65% markup
    dealerDiscount: 0.30,     // 30% dealer discount
    taxRate: 0.08             // 8% tax
  },
  shipping: {
    freeShippingThreshold: 500,
    standardRate: 25,
    expressRate: 50
  }
};
```

### Site Settings (Database)

```javascript
// In database.json
{
  "settings": {
    "storeName": "Peekaboo Shades",
    "storeEmail": "peekabooshades.pro@gmail.com",
    "storePhone": "+1 929-465-9549",
    "storeAddress": "123 Main St, New York, NY 10001",
    "taxRate": 0.08,
    "currency": "USD",
    "timezone": "America/New_York"
  },
  "globalSettings": {
    "contactEmail": "peekabooshades.pro@gmail.com",
    "contactPhone": "+1 929-465-9549",
    "socialLinks": {
      "instagram": "https://instagram.com/peekabooshades",
      "facebook": "https://facebook.com/peekabooshades"
    }
  }
}
```

---

## 18. Troubleshooting

### Common Issues

#### Server Won't Start

```bash
# Check if port is in use
lsof -i :3001

# Kill process using port
kill -9 <PID>

# Check Node version
node --version  # Should be 18.x+

# Reinstall dependencies
rm -rf node_modules
npm install
```

#### Database Errors

```bash
# Check database file exists
ls -la backend/database.json

# Validate JSON
node -e "JSON.parse(require('fs').readFileSync('backend/database.json'))"

# Reset database (careful - loses data!)
npm run init-db
```

#### Authentication Issues

```javascript
// Check token in browser console
localStorage.getItem('adminToken')

// Clear all tokens
localStorage.clear()

// Re-login
window.location.href = '/admin/login.html'
```

#### Images Not Loading

```bash
# Check file exists
ls -la frontend/public/images/products/

# Check file permissions
chmod 644 frontend/public/images/**/*
```

#### API Returns 500 Error

```bash
# Check server logs
tail -f /tmp/server.log

# Run with debug
DEBUG=* npm start
```

### Debug Mode

Add to server.js for debugging:

```javascript
// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Log all errors
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});
```

### Health Check

```bash
# Test API is running
curl http://localhost:3001/api/health

# Test products endpoint
curl http://localhost:3001/api/products

# Test admin auth
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@peekabooshades.com","password":"admin123"}'
```

---

## Appendix A: File Quick Reference

### Most Important Files

| File | Purpose |
|------|---------|
| `backend/server.js` | Main server, all API routes |
| `backend/database.json` | All data storage |
| `backend/services/extended-pricing-engine.js` | Pricing calculations |
| `backend/services/order-service.js` | Order processing |
| `frontend/public/product.html` | Product configurator |
| `frontend/public/admin/js/admin.js` | Admin JavaScript |
| `frontend/public/admin/orders.html` | Order management |

### Configuration Files

| File | Purpose |
|------|---------|
| `backend/package.json` | Node dependencies |
| `backend/config/system-config.js` | System settings |
| `.env` | Environment variables |

### CSS Files

| File | Purpose |
|------|---------|
| `frontend/public/css/styles.css` | Global styles |
| `frontend/public/admin/css/admin.css` | Admin panel styles |

---

## Appendix B: Contact Information

**Technical Support:** peekabooshades.pro@gmail.com
**Phone:** +1 929-465-9549
**GitHub:** github.com/peekabooshades

---

*This documentation is maintained by the Peekaboo Shades Development Team. Last updated January 18, 2026.*
