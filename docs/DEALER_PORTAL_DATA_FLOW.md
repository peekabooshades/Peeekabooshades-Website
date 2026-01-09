# Dealer Portal - Data Flow Diagrams & Architecture

This document provides comprehensive data flow diagrams and architectural documentation for the Dealer Portal system.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Dealer Login Flow](#dealer-login-flow)
3. [Order Creation Flow](#order-creation-flow)
4. [Commission Calculation Flow](#commission-calculation-flow)
5. [Customer Tracking Flow](#customer-tracking-flow)
6. [Database Collections Relationship](#database-collections-relationship)
7. [QA Review Summary](#qa-review-summary)
8. [Verification Results](#verification-results)

---

## System Architecture Overview

```
+----------------------------------------------------------+
|                    DEALER PORTAL SYSTEM                    |
+----------------------------------------------------------+
|                                                            |
|  +------------------+     +------------------+              |
|  |   Frontend       |     |   Backend        |              |
|  |   (HTML/JS)      |<--->|   (Node.js)      |              |
|  +------------------+     +------------------+              |
|          |                        |                        |
|          v                        v                        |
|  +------------------+     +------------------+              |
|  | localStorage     |     |  database.json   |              |
|  | - dealer_token   |     |  - dealers       |              |
|  | - dealer_user    |     |  - dealerUsers   |              |
|  +------------------+     |  - orders        |              |
|                           |  - dealerCustomers|             |
|                           +------------------+              |
+----------------------------------------------------------+
```

### Frontend Pages (6 Total)

| Page | Path | Purpose |
|------|------|---------|
| Login | `/dealer/login.html` | JWT authentication |
| Dashboard | `/dealer/index.html` | Stats overview, quick actions |
| Orders | `/dealer/orders.html` | Order list, details modal |
| New Order | `/dealer/new-order.html` | Product configurator |
| Customers | `/dealer/customers.html` | Customer CRUD |
| Commissions | `/dealer/commissions.html` | Earnings tracking |

### Backend Services

| File | Purpose |
|------|---------|
| `server.js` | Main Express server, API routes |
| `services/dealer-service.js` | Dealer business logic |
| `services/pricing-engine.js` | Price calculations |

---

## Dealer Login Flow

```
+----------------------------------------------------------+
|                  DEALER LOGIN DATA FLOW                    |
+----------------------------------------------------------+

[1] USER ACTION
    +------------------+
    | Dealer enters    |
    | email & password |
    +------------------+
            |
            v
[2] FRONTEND (login.html)
    +------------------+
    | POST /api/dealer |
    |     /login       |
    | Body: {email,    |
    |   password}      |
    +------------------+
            |
            v
[3] BACKEND (server.js)
    +------------------+
    | Find user in     |
    | dealerUsers[]    |
    | by email         |
    +------------------+
            |
            v
[4] PASSWORD VALIDATION
    +------------------+
    | bcrypt.compare   |
    | (password, hash) |
    +------------------+
            |
            +---> [FAIL] Return 401 "Invalid credentials"
            |
            v [SUCCESS]
[5] TOKEN GENERATION
    +------------------+
    | jwt.sign({       |
    |   id, email,     |
    |   name, role,    |
    |   dealerId       |
    | })               |
    +------------------+
            |
            v
[6] RESPONSE TO FRONTEND
    +------------------+
    | {success: true,  |
    |  token: "jwt...",|
    |  user: {...}}    |
    +------------------+
            |
            v
[7] FRONTEND STORAGE
    +------------------+
    | localStorage.set |
    | ('dealer_token') |
    | ('dealer_user')  |
    +------------------+
            |
            v
[8] REDIRECT
    +------------------+
    | window.location  |
    | = '/dealer/'     |
    +------------------+
```

### Authentication Sequence

```
User                    Frontend                Backend                 Database
  |                        |                       |                        |
  |--Enter credentials---->|                       |                        |
  |                        |--POST /api/dealer/login-->                     |
  |                        |                       |--Query dealerUsers---->|
  |                        |                       |<--Return user record---|
  |                        |                       |                        |
  |                        |                       |--Verify bcrypt hash--->|
  |                        |                       |                        |
  |                        |                       |--Generate JWT--------->|
  |                        |<--{token, user}-------|                        |
  |                        |                       |                        |
  |                        |--Save to localStorage |                        |
  |<--Redirect to dashboard|                       |                        |
```

---

## Order Creation Flow

### Step 1: Product & Fabric Selection

```
+----------------------------------------------------------+
|            ORDER CREATION - STEP 1: SELECTION              |
+----------------------------------------------------------+

[1] PAGE LOAD (new-order.html)
    +------------------+
    | GET /api/products|
    | GET /api/fabrics |
    +------------------+
            |
            v
[2] USER SELECTS
    +------------------+
    | Product: Roller  |
    | Blinds           |
    | Fabric: WH-1001  |
    +------------------+
            |
            v
[3] FABRIC INFO DISPLAY
    +------------------+
    | Swatch preview   |
    | Name, Code       |
    | Price/m2         |
    +------------------+
```

### Step 2: Dimension & Options

```
+----------------------------------------------------------+
|           ORDER CREATION - STEP 2: CONFIGURATION           |
+----------------------------------------------------------+

[1] DIMENSION INPUT
    +------------------+
    | Width: 36 inches |
    | Height: 48 inches|
    | Quantity: 2      |
    +------------------+
            |
            v
[2] OPTIONS SELECTION
    +----------------------------------+
    | Mount: Inside/Outside            |
    | Control: Manual/Cordless/Motor   |
    | Motor Brand: AOK/Dooya/etc       |
    | Bottom Rail: Plain/Wrapped       |
    | Valance: Plain/Wrapped           |
    | Remote: Single/6ch/15ch          |
    | Accessories: Hub/USB/Solar       |
    +----------------------------------+
            |
            v
[3] REAL-TIME PRICE CALCULATION
    +----------------------------------+
    | calculatePrice() triggered on    |
    | every input change               |
    +----------------------------------+
```

### Step 3: Price Calculation

```
+----------------------------------------------------------+
|           ORDER CREATION - STEP 3: PRICE CALC              |
+----------------------------------------------------------+

[1] COLLECT INPUTS
    +------------------+
    | dimensions       |
    | fabric selection |
    | hardware options |
    +------------------+
            |
            v
[2] CALCULATE AREA
    +------------------+
    | area_m2 =        |
    | (W * H) / 1550   |
    | (inch to m2)     |
    +------------------+
            |
            v
[3] BACKEND PRICING (POST /api/dealer/calculate-price)
    +----------------------------------+
    | Input:                           |
    | - width, height                  |
    | - fabricCode                     |
    | - mount, control                 |
    | - motorBrand, remote             |
    | - accessories[]                  |
    +----------------------------------+
            |
            v
[4] PRICING ENGINE (dealer-service.js)
    +----------------------------------+
    | Base Price:      $40.00          |
    | Fabric (area):   $12.50          |
    | Motor (AOK):     $45.00          |
    | Accessories:     $28.50          |
    | Remote:          $6.00           |
    | ---------------------------------|
    | Retail Price:    $132.00         |
    | Dealer Discount: -20% (Silver)   |
    | Dealer Price:    $105.60         |
    +----------------------------------+
            |
            v
[5] DISPLAY TO USER
    +----------------------------------+
    | Unit Price: $105.60              |
    | Quantity: 2                      |
    | Total: $211.20                   |
    | Commission: $21.12               |
    +----------------------------------+
```

### Step 4: Order Submission

```
+----------------------------------------------------------+
|           ORDER CREATION - STEP 4: SUBMISSION              |
+----------------------------------------------------------+

[1] USER CLICKS "Add to Cart"
    +------------------+
    | Validate inputs  |
    | Build orderData  |
    +------------------+
            |
            v
[2] ORDER DATA STRUCTURE
    +----------------------------------+
    | {                                |
    |   customerName: "...",           |
    |   customerEmail: "...",          |
    |   customerPhone: "...",          |
    |   customerAddress: "...",        |
    |   items: [{                      |
    |     productId, productName,      |
    |     fabricCode, width, height,   |
    |     quantity, price,             |
    |     options: {                   |
    |       mount, control, motorBrand,|
    |       bottomRail, valance,       |
    |       remote, accessories[]      |
    |     },                           |
    |     pricingSnapshot: {...}       |
    |   }],                            |
    |   notes: "..."                   |
    | }                                |
    +----------------------------------+
            |
            v
[3] POST /api/dealer/orders
    +----------------------------------+
    | Headers:                         |
    | Authorization: Bearer <token>    |
    +----------------------------------+
            |
            v
[4] BACKEND PROCESSING (dealer-service.js)
    +----------------------------------+
    | 1. Validate dealer token         |
    | 2. Find/Create customer          |
    | 3. Calculate prices              |
    | 4. Apply dealer discount         |
    | 5. Create order record           |
    | 6. Update dealer stats           |
    | 7. Update customer stats         |
    | 8. Save to database.json         |
    +----------------------------------+
            |
            v
[5] RESPONSE
    +----------------------------------+
    | {                                |
    |   success: true,                 |
    |   order: {                       |
    |     id: "uuid",                  |
    |     orderNumber: "ORD-XXXXXX",   |
    |     status: "pending",           |
    |     items: [...],                |
    |     total: 211.20,               |
    |     commission: 21.12            |
    |   }                              |
    | }                                |
    +----------------------------------+
```

---

## Commission Calculation Flow

```
+----------------------------------------------------------+
|               COMMISSION CALCULATION FLOW                  |
+----------------------------------------------------------+

[1] ORDER PLACED
    +------------------+
    | Dealer places    |
    | order for        |
    | customer         |
    +------------------+
            |
            v
[2] GET DEALER TIER
    +------------------+
    | Query dealer     |
    | record           |
    | tier: "silver"   |
    +------------------+
            |
            v
[3] APPLY DISCOUNT
    +----------------------------------+
    | Bronze: 15% off retail           |
    | Silver: 20% off retail           |
    | Gold:   25% off retail           |
    +----------------------------------+
            |
            | Example: Silver tier
            v
[4] CALCULATE PRICES
    +----------------------------------+
    | Retail Price:    $132.00         |
    | Discount (20%):  -$26.40         |
    | Dealer Pays:     $105.60         |
    +----------------------------------+
            |
            v
[5] DEALER COMMISSION
    +----------------------------------+
    | Commission Rate: 10%             |
    | (from dealer.commissionRate)     |
    |                                  |
    | Customer Pays:   $132.00 (retail)|
    | Dealer Pays:     $105.60         |
    | Dealer Keeps:    $26.40 (margin) |
    | Commission:      $10.56 (10%)    |
    +----------------------------------+
            |
            v
[6] UPDATE STATS
    +----------------------------------+
    | dealer.totalOrders++             |
    | dealer.totalRevenue += total     |
    | dealer.totalCommission += comm   |
    +----------------------------------+
```

### Commission Tier Breakdown

```
+------------------------------------------------------+
|              DEALER TIER COMMISSION MODEL             |
+------------------------------------------------------+

                    RETAIL CUSTOMER
                          |
                          | Pays $132.00
                          v
+------------------------------------------------------+
|                     PEEKABOO SHADES                   |
|                                                       |
|  Receives: $132.00 from customer                     |
|  Pays: Commission to dealer                          |
|  Keeps: $132.00 - Commission                         |
+------------------------------------------------------+
                          |
                          | Commission Payment
                          v
+------------------------------------------------------+
|                        DEALER                         |
|                                                       |
|  Tier: Silver (20% discount)                         |
|  Commission Rate: 10%                                |
|  Commission: $132.00 × 10% = $13.20                  |
|                                                       |
|  Alternative: Dealer can charge customer higher      |
|  than retail and keep the difference                 |
+------------------------------------------------------+
```

---

## Customer Tracking Flow

```
+----------------------------------------------------------+
|               CUSTOMER TRACKING DATA FLOW                  |
+----------------------------------------------------------+

[1] NEW ORDER WITH CUSTOMER EMAIL
    +------------------+
    | customerEmail:   |
    | "john@email.com" |
    +------------------+
            |
            v
[2] CHECK IF CUSTOMER EXISTS
    +----------------------------------+
    | db.dealerCustomers.find(         |
    |   c => c.dealerId === dealerId   |
    |   && c.email === customerEmail   |
    | )                                |
    +----------------------------------+
            |
            +---> [EXISTS] Use existing customer ID
            |
            v [NOT EXISTS]
[3] CREATE NEW CUSTOMER
    +----------------------------------+
    | {                                |
    |   id: "dc-uuid",                 |
    |   dealerId: "...",               |
    |   name: "John Smith",            |
    |   email: "john@email.com",       |
    |   phone: "555-1234",             |
    |   address: "123 Main St",        |
    |   totalOrders: 0,                |
    |   totalSpent: 0,                 |
    |   createdAt: "ISO date"          |
    | }                                |
    +----------------------------------+
            |
            v
[4] LINK TO ORDER
    +------------------+
    | order.customerId |
    | = customer.id    |
    +------------------+
            |
            v
[5] UPDATE CUSTOMER STATS (on order completion)
    +----------------------------------+
    | customer.totalOrders++           |
    | customer.totalSpent += amount    |
    | customer.lastOrderDate = now     |
    +----------------------------------+
            |
            v
[6] DISPLAY IN DASHBOARD
    +----------------------------------+
    | Total Customers: count(distinct) |
    | Customer List: with order stats  |
    +----------------------------------+
```

---

## Database Collections Relationship

```
+----------------------------------------------------------+
|              DATABASE COLLECTIONS RELATIONSHIP             |
+----------------------------------------------------------+

+------------------+       +------------------+
|     dealers      |       |   dealerUsers    |
+------------------+       +------------------+
| id (PK)          |<----->| dealerId (FK)    |
| companyName      |       | id (PK)          |
| tier             |       | email            |
| status           |       | password (hash)  |
| commissionRate   |       | name             |
+------------------+       +------------------+
        |                          |
        |                          |
        v                          v
+------------------+       +------------------+
|     orders       |       | dealerCustomers  |
+------------------+       +------------------+
| id (PK)          |       | id (PK)          |
| dealerId (FK)    |------>| dealerId (FK)    |
| customerId (FK)  |<------| email            |
| items[]          |       | name             |
| total            |       | totalOrders      |
| commission       |       | totalSpent       |
| status           |       +------------------+
+------------------+

RELATIONSHIPS:
=============
dealers (1) -----> (N) dealerUsers     : One dealer company, many users
dealers (1) -----> (N) orders          : One dealer, many orders
dealers (1) -----> (N) dealerCustomers : One dealer, many customers
orders  (N) <----> (1) dealerCustomers : Many orders, one customer
```

---

## QA Review Summary

### Issues Found and Fixed

| Issue | Status | Resolution |
|-------|--------|------------|
| **Add to Cart not working** | FIXED | Frontend was sending flat structure instead of `items[]` array format. Fixed `addToCart()` function to build correct data structure. |
| **Save as Quote not implemented** | FIXED | Function only showed alert. Implemented full quote creation with `POST /api/quotes` endpoint. |
| **Customer count always zero** | FIXED | Customers weren't being auto-created. Added customer auto-creation logic in `createDealerOrder()` when email is provided. |
| **Customer stats not updating** | FIXED | Added `totalOrders++` and `totalSpent += amount` updates when orders are created. |

### Code Changes Made

**dealer-service.js (Lines 250-293)**
- Added customer auto-creation logic
- Check if customer exists by email for dealer
- Create new customer record if not found

**dealer-service.js (Lines 339-348)**
- Added customer stats update on order creation
- Increment `totalOrders`
- Add to `totalSpent`
- Update `lastOrderDate`

**new-order.html**
- Fixed `addToCart()` data structure
- Implemented `saveQuote()` function

**orders.html**
- Added options display in order details modal

---

## Verification Results

### Test Environment

| Item | Value |
|------|-------|
| Test Dealer | testdealer@test.com |
| Password | dealer123 |
| Tier | Silver (20% discount) |
| Commission Rate | 10% |

### Test Orders Created

| # | Product | Control | Fabric | Price | Commission |
|---|---------|---------|--------|-------|------------|
| 1 | Roller Blinds | Manual | SH-5107 | $37.12 | $3.71 |
| 2 | Roller Blinds | Manual | WH-1001 | $37.12 | $3.71 |
| 3 | Roller Blinds | Cordless | R-Linen | $37.12 | $3.71 |
| 4 | Roller Blinds | Motorized (AOK) | WH-2001 | $74.25 | $7.42 |
| 5 | Cellular Shades | Manual | BL-4001 | $364.20 | $36.42 |

### Dashboard Statistics After Testing

| Metric | Value |
|--------|-------|
| Total Orders | 5 |
| Total Revenue | $549.81 |
| Total Commission | $54.97 |
| Total Customers | 2 |

---

## API Endpoint Reference

### Dealer Authentication

```
POST /api/dealer/login
Request:  { email, password }
Response: { success, token, user }
```

### Dealer Statistics

```
GET /api/dealer/stats
Headers:  Authorization: Bearer <token>
Response: { totalOrders, totalRevenue, totalCustomers, recentOrders }
```

### Dealer Orders

```
GET  /api/dealer/orders
POST /api/dealer/orders
GET  /api/dealer/orders/:id

Order Data Structure:
{
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  customerAddress: string,
  items: [{
    productId, productName, fabricCode,
    width, height, quantity, price,
    options: { mount, control, motorBrand, ... },
    pricingSnapshot: { ... }
  }],
  notes: string
}
```

### Dealer Customers

```
GET    /api/dealer/customers
POST   /api/dealer/customers
PUT    /api/dealer/customers/:id
DELETE /api/dealer/customers/:id
```

### Price Calculation

```
POST /api/dealer/calculate-price
Request: {
  productId, fabricCode,
  width, height, quantity,
  mount, control, motorBrand,
  bottomRail, valance,
  remote, accessories[]
}
Response: {
  retailPrice, dealerPrice,
  discount, commission,
  breakdown: { ... }
}
```

---

## Architectural Recommendations

### Security Considerations

1. **Token Storage**: Currently uses localStorage. Consider httpOnly cookies for production.
2. **Password Policy**: Implement minimum password requirements.
3. **Rate Limiting**: Add rate limiting to login endpoint.
4. **Token Expiry**: Current 24h expiry is reasonable, consider refresh tokens.

### Performance Optimizations

1. **Caching**: Cache product and fabric lists (they don't change often).
2. **Pagination**: Orders list could benefit from server-side pagination.
3. **Database**: Consider migration to PostgreSQL for production scale.

### Future Enhancements

1. **Order Status Notifications**: Email/SMS when order status changes.
2. **Bulk Order Import**: CSV upload for multiple orders.
3. **Commission Payouts**: Automated commission payment tracking.
4. **Customer Portal**: Let dealer's customers track their own orders.

---

*Document generated during QA review and system analysis.*
*Last updated: January 2026*
