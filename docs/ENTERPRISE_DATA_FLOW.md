# Peekaboo Shades - Enterprise Data Flow Diagram

**Last Updated:** January 2026

This document provides a complete enterprise-level data flow diagram showing how the Peekaboo Shades business operates end-to-end.

---

## Complete Enterprise Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                              PEEKABOO SHADES - ENTERPRISE DATA FLOW                                             │
│                              ══════════════════════════════════════                                             │
│                                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                         CUSTOMER CHANNELS                                                │   │
│  │                                                                                                          │   │
│  │     ┌──────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │   │
│  │     │   WEBSITE    │          │    PHONE     │          │    EMAIL     │          │   IN-STORE   │      │   │
│  │     │   VISITOR    │          │    INQUIRY   │          │    QUOTE     │          │   VISIT      │      │   │
│  │     └──────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘      │   │
│  │            │                         │                         │                         │              │   │
│  │            └─────────────────────────┴─────────────────────────┴─────────────────────────┘              │   │
│  │                                                  │                                                       │   │
│  │                                                  ▼                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                     │                                                           │
│  ┌──────────────────────────────────────────────────┴──────────────────────────────────────────────────────┐   │
│  │                                                                                                          │   │
│  │                                    TWO SALES CHANNELS                                                    │   │
│  │                                                                                                          │   │
│  │         ┌─────────────────────────────────┐              ┌─────────────────────────────────┐            │   │
│  │         │                                 │              │                                 │            │   │
│  │         │      B2C - DIRECT SALES         │              │      B2B - DEALER SALES         │            │   │
│  │         │      (Customer Portal)          │              │      (Dealer Portal)            │            │   │
│  │         │                                 │              │                                 │            │   │
│  │         │  Customer buys directly from    │              │  Dealer buys wholesale for      │            │   │
│  │         │  Peekaboo Shades website        │              │  their end customers            │            │   │
│  │         │                                 │              │                                 │            │   │
│  │         │  • Full retail price            │              │  • Tiered discounts:            │            │   │
│  │         │  • Direct relationship          │              │    - Bronze: 15% off            │            │   │
│  │         │  • Website checkout             │              │    - Silver: 20% off            │            │   │
│  │         │                                 │              │    - Gold: 25% off              │            │   │
│  │         │                                 │              │  • Earns commission (5%)        │            │   │
│  │         └───────────────┬─────────────────┘              └───────────────┬─────────────────┘            │   │
│  │                         │                                                │                              │   │
│  │                         └────────────────────────┬───────────────────────┘                              │   │
│  │                                                  │                                                       │   │
│  └──────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘   │
│                                                     │                                                           │
│                                                     ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                                                          │   │
│  │                                    ══════════════════════════                                            │   │
│  │                                         ORDER CREATED                                                    │   │
│  │                                    ══════════════════════════                                            │   │
│  │                                                                                                          │   │
│  │   orders[] = {                                                                                           │   │
│  │     id: "ORD-123456",                                                                                    │   │
│  │     order_number: "PS-180126-001",                                                                       │   │
│  │     customerId: "cust-xxx" OR dealerId: "dealer-xxx",                                                    │   │
│  │     items: [{ product, width, height, fabric, motor, options }],                                         │   │
│  │     pricing: { subtotal, tax, shipping, dealerDiscount, total, manufacturerCost },                       │   │
│  │     status: "pending",                                                                                   │   │
│  │     source: "website" | "dealer" | "phone" | "quote"                                                     │   │
│  │   }                                                                                                      │   │
│  │                                                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                     │                                                           │
│                                                     ▼                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Business Flow - Who Does What

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                    COMPLETE ORDER LIFECYCLE                                                     │
│                                    ════════════════════════                                                     │
│                                                                                                                 │
│   PHASE 1: ORDER & PAYMENT                                                                                      │
│   ════════════════════════                                                                                      │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                                                          │  │
│   │   CUSTOMER / DEALER                              ADMIN PANEL                                             │  │
│   │   ══════════════════                             ═══════════                                             │  │
│   │                                                                                                          │  │
│   │   ┌──────────────────┐                          ┌──────────────────┐                                    │  │
│   │   │  1. BROWSE &     │                          │  4. REVIEW       │                                    │  │
│   │   │     CONFIGURE    │                          │     ORDER        │                                    │  │
│   │   │                  │                          │                  │                                    │  │
│   │   │  • Select product│                          │  • Check details │                                    │  │
│   │   │  • Choose fabric │                          │  • Verify specs  │                                    │  │
│   │   │  • Enter sizes   │                          │  • Confirm price │                                    │  │
│   │   │  • Add motor     │                          │                  │                                    │  │
│   │   │  • Select options│                          │  Status: pending │                                    │  │
│   │   └────────┬─────────┘                          └────────┬─────────┘                                    │  │
│   │            │                                             │                                               │  │
│   │            ▼                                             ▼                                               │  │
│   │   ┌──────────────────┐                          ┌──────────────────┐                                    │  │
│   │   │  2. ADD TO CART  │                          │  5. PROCESS      │                                    │  │
│   │   │     & CHECKOUT   │                          │     PAYMENT      │                                    │  │
│   │   │                  │                          │                  │                                    │  │
│   │   │  • Review cart   │                          │  • Mark as paid  │                                    │  │
│   │   │  • Enter address │                          │  • Record payment│                                    │  │
│   │   │  • Apply coupon  │                          │  • Update invoice│                                    │  │
│   │   │  • Pay online    │                          │                  │                                    │  │
│   │   └────────┬─────────┘                          │  Status: paid    │                                    │  │
│   │            │                                    └────────┬─────────┘                                    │  │
│   │            ▼                                             │                                               │  │
│   │   ┌──────────────────┐                                   │                                               │  │
│   │   │  3. RECEIVE      │                                   │                                               │  │
│   │   │     CONFIRMATION │                                   │                                               │  │
│   │   │                  │◀──────────────────────────────────┘                                               │  │
│   │   │  • Order email   │                                                                                   │  │
│   │   │  • Invoice PDF   │                                                                                   │  │
│   │   │  • Order number  │                                                                                   │  │
│   │   └──────────────────┘                                                                                   │  │
│   │                                                                                                          │  │
│   │   CREATES:                                                                                               │  │
│   │   • orders[] record (status: paid)                                                                       │  │
│   │   • invoices[] record (type: "customer", status: "paid") ◀── RECEIVABLE (Money IN)                      │  │
│   │   • customers[] updated (totalOrders++, totalSpent += total)                                             │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                     │                                                           │
│                                                     ▼                                                           │
│   PHASE 2: PRODUCTION                                                                                           │
│   ═══════════════════                                                                                           │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                                                          │  │
│   │   ADMIN PANEL                                    MANUFACTURER PORTAL                                     │  │
│   │   ═══════════                                    ══════════════════                                      │  │
│   │                                                                                                          │  │
│   │   ┌──────────────────┐                          ┌──────────────────┐                                    │  │
│   │   │  6. SEND TO      │                          │  8. RECEIVE      │                                    │  │
│   │   │     PRODUCTION   │─────────────────────────▶│     ORDER        │                                    │  │
│   │   │                  │                          │                  │                                    │  │
│   │   │  • Select mfr    │                          │  • View specs    │                                    │  │
│   │   │  • Generate PO   │                          │  • Check fabric  │                                    │  │
│   │   │  • Send specs    │                          │  • Note dimensions│                                   │  │
│   │   │                  │                          │                  │                                    │  │
│   │   │  Status:         │                          │  Status:         │                                    │  │
│   │   │  order_received  │                          │  order_received  │                                    │  │
│   │   └────────┬─────────┘                          └────────┬─────────┘                                    │  │
│   │            │                                             │                                               │  │
│   │            │                                             ▼                                               │  │
│   │            │                                    ┌──────────────────┐                                    │  │
│   │            │                                    │  9. MANUFACTURE  │                                    │  │
│   │            │                                    │                  │                                    │  │
│   │            │                                    │  • Cut fabric    │                                    │  │
│   │            │                                    │  • Assemble blind│                                    │  │
│   │            │                                    │  • Add hardware  │                                    │  │
│   │            │                                    │  • Install motor │                                    │  │
│   │            │                                    │                  │                                    │  │
│   │            │                                    │  Status:         │                                    │  │
│   │   ┌────────┴─────────┐                          │  manufacturing   │                                    │  │
│   │   │  7. TRACK        │                          └────────┬─────────┘                                    │  │
│   │   │     PROGRESS     │                                   │                                               │  │
│   │   │                  │◀──────────────────────────────────┤                                               │  │
│   │   │  • View status   │                                   ▼                                               │  │
│   │   │  • Check queue   │                          ┌──────────────────┐                                    │  │
│   │   │  • Monitor dates │                          │  10. QUALITY     │                                    │  │
│   │   │                  │                          │      ASSURANCE   │                                    │  │
│   │   └──────────────────┘                          │                  │                                    │  │
│   │                                                 │  • Inspect build │                                    │  │
│   │                                                 │  • Test motor    │                                    │  │
│   │                                                 │  • Check fabric  │                                    │  │
│   │                                                 │                  │                                    │  │
│   │                                                 │  Status: qa      │                                    │  │
│   │                                                 └────────┬─────────┘                                    │  │
│   │                                                          │                                               │  │
│   │                                                          ▼                                               │  │
│   │                                                 ┌──────────────────┐                                    │  │
│   │                                                 │  11. PACK &      │                                    │  │
│   │                                                 │      SHIP        │                                    │  │
│   │                                                 │                  │                                    │  │
│   │                                                 │  • Package goods │                                    │  │
│   │                                                 │  • Create label  │                                    │  │
│   │                                                 │  • Add tracking  │                                    │  │
│   │                                                 │  • Ship via UPS  │                                    │  │
│   │                                                 │                  │                                    │  │
│   │                                                 │  Status: shipped │                                    │  │
│   │                                                 └──────────────────┘                                    │  │
│   │                                                                                                          │  │
│   │   CREATES:                                                                                               │  │
│   │   • invoices[] record (type: "manufacturer", status: "pending") ◀── PAYABLE (Money OUT)                 │  │
│   │   • orderStatusHistory[] records for each status change                                                  │  │
│   │   • shipping tracking info added to order                                                                │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                     │                                                           │
│                                                     ▼                                                           │
│   PHASE 3: DELIVERY & INSTALLATION                                                                              │
│   ════════════════════════════════                                                                              │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                                                          │  │
│   │   CUSTOMER                                       TECHNICIAN PORTAL                                       │  │
│   │   ════════                                       ═════════════════                                       │  │
│   │                                                                                                          │  │
│   │   ┌──────────────────┐                          ┌──────────────────┐                                    │  │
│   │   │  12. RECEIVE     │                          │  14. VIEW        │                                    │  │
│   │   │      DELIVERY    │                          │      APPOINTMENT │                                    │  │
│   │   │                  │                          │                  │                                    │  │
│   │   │  • Get tracking  │                          │  • See schedule  │                                    │  │
│   │   │  • Track shipment│                          │  • View address  │                                    │  │
│   │   │  • Receive goods │                          │  • Check specs   │                                    │  │
│   │   │                  │                          │  • Plan install  │                                    │  │
│   │   └────────┬─────────┘                          └────────┬─────────┘                                    │  │
│   │            │                                             │                                               │  │
│   │            ▼                                             │                                               │  │
│   │   ┌──────────────────┐                                   │                                               │  │
│   │   │  13. SCHEDULE    │                                   │                                               │  │
│   │   │      INSTALLATION│───────────────────────────────────┘                                               │  │
│   │   │                  │                                                                                   │  │
│   │   │  • Pick date     │                                                                                   │  │
│   │   │  • Choose time   │                          ┌──────────────────┐                                    │  │
│   │   │  • Confirm addr  │                          │  15. INSTALL     │                                    │  │
│   │   │                  │                          │      BLINDS      │                                    │  │
│   │   └──────────────────┘                          │                  │                                    │  │
│   │                                                 │  • Arrive onsite │                                    │  │
│   │                                                 │  • Mount brackets│                                    │  │
│   │                                                 │  • Hang blinds   │                                    │  │
│   │                                                 │  • Test operation│                                    │  │
│   │                                                 │  • Program remote│                                    │  │
│   │                                                 │                  │                                    │  │
│   │   ┌──────────────────┐                          │  Status:         │                                    │  │
│   │   │  16. CONFIRM     │                          │  completed       │                                    │  │
│   │   │      COMPLETION  │◀─────────────────────────┴──────────────────┘                                    │  │
│   │   │                  │                                                                                   │  │
│   │   │  • Sign off      │                                                                                   │  │
│   │   │  • Rate service  │                                                                                   │  │
│   │   │  • Leave review  │                                                                                   │  │
│   │   └──────────────────┘                                                                                   │  │
│   │                                                                                                          │  │
│   │   CREATES:                                                                                               │  │
│   │   • appointments[] record (status: completed)                                                            │  │
│   │   • installationPayments[] record (technician earnings)                                                  │  │
│   │   • orders[] status updated to "delivered" or "closed"                                                   │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Role Responsibilities Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                    WHO DOES WHAT - RESPONSIBILITY MATRIX                                        │
│                                    ═════════════════════════════════════                                        │
│                                                                                                                 │
│   ┌─────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐    │
│   │     ROLE        │                              RESPONSIBILITIES                                        │    │
│   ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    │
│   │                 │                                                                                      │    │
│   │   CUSTOMER      │  • Browse products on website                                                        │    │
│   │   (Member)      │  • Configure blinds (size, fabric, options)                                          │    │
│   │                 │  • Create account / Login                                                            │    │
│   │                 │  • Place orders & make payments                                                      │    │
│   │                 │  • Request quotes                                                                    │    │
│   │                 │  • Track order status                                                                │    │
│   │                 │  • Schedule installation appointments                                                │    │
│   │                 │  • View order history                                                                │    │
│   │                 │  • Leave reviews                                                                     │    │
│   │                 │                                                                                      │    │
│   │   Portal:       │  /signup.html, /login.html, /account.html                                            │    │
│   │   Token:        │  customer_token (JWT)                                                                │    │
│   │                 │                                                                                      │    │
│   ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    │
│   │                 │                                                                                      │    │
│   │   DEALER        │  • Sell Peekaboo products to their customers                                         │    │
│   │   (B2B Partner) │  • Get wholesale pricing (15-25% discount based on tier)                             │    │
│   │                 │  • Place bulk/wholesale orders                                                       │    │
│   │                 │  • Manage their end customers                                                        │    │
│   │                 │  • Track their orders                                                                │    │
│   │                 │  • View commission earnings                                                          │    │
│   │                 │  • Access dealer-specific pricing                                                    │    │
│   │                 │                                                                                      │    │
│   │   Portal:       │  /dealer/login.html, /dealer/index.html, /dealer/orders.html                         │    │
│   │   Token:        │  dealer_token (JWT)                                                                  │    │
│   │   Tiers:        │  Bronze (15%), Silver (20%), Gold (25%)                                              │    │
│   │                 │                                                                                      │    │
│   ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    │
│   │                 │                                                                                      │    │
│   │   ADMIN         │  • Manage all orders (view, edit, update status)                                     │    │
│   │   (Staff)       │  • Process payments & refunds                                                        │    │
│   │                 │  • Send orders to manufacturer                                                       │    │
│   │                 │  • Manage products, fabrics, pricing                                                 │    │
│   │                 │  • Manage customers & dealers                                                        │    │
│   │                 │  • Run marketing campaigns                                                           │    │
│   │                 │  • View analytics & reports                                                          │    │
│   │                 │  • Manage technicians & appointments                                                 │    │
│   │                 │  • Handle invoices & accounting                                                      │    │
│   │                 │  • Configure system settings                                                         │    │
│   │                 │  • Manage website content                                                            │    │
│   │                 │                                                                                      │    │
│   │   Portal:       │  /admin/ (189+ pages)                                                                │    │
│   │   Token:        │  admin_token (JWT)                                                                   │    │
│   │                 │                                                                                      │    │
│   ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    │
│   │                 │                                                                                      │    │
│   │   MANUFACTURER  │  • Receive production orders from admin                                              │    │
│   │   (Factory)     │  • View order specifications & requirements                                          │    │
│   │                 │  • Update production status (manufacturing → QA → ready)                             │    │
│   │                 │  • Perform quality assurance                                                         │    │
│   │                 │  • Pack and ship products                                                            │    │
│   │                 │  • Add tracking information                                                          │    │
│   │                 │  • Manage their fabric inventory                                                     │    │
│   │                 │  • Set their pricing (cost per sq meter)                                             │    │
│   │                 │                                                                                      │    │
│   │   Portal:       │  /manufacturer/login.html, /manufacturer/index.html                                  │    │
│   │   Token:        │  mfr_token (JWT)                                                                     │    │
│   │   Lead Time:    │  14 days typical                                                                     │    │
│   │                 │                                                                                      │    │
│   ├─────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤    │
│   │                 │                                                                                      │    │
│   │   TECHNICIAN    │  • View assigned installation appointments                                           │    │
│   │   (Installer)   │  • Check customer details & location                                                 │    │
│   │                 │  • Travel to installation site                                                       │    │
│   │                 │  • Install blinds professionally                                                     │    │
│   │                 │  • Test motorized systems                                                            │    │
│   │                 │  • Mark appointment complete                                                         │    │
│   │                 │  • Manage their availability                                                         │    │
│   │                 │  • Track their earnings                                                              │    │
│   │                 │                                                                                      │    │
│   │   Portal:       │  /technician/login.html, /technician/index.html, /technician/appointments.html       │    │
│   │   Token:        │  technician_token (JWT)                                                              │    │
│   │   Payment:      │  Per installation (e.g., 75% of installation fee)                                    │    │
│   │                 │                                                                                      │    │
│   └─────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Financial Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                    MONEY FLOW - HOW PEEKABOO MAKES PROFIT                                       │
│                                    ═════════════════════════════════════                                        │
│                                                                                                                 │
│                                                                                                                 │
│      CUSTOMER PAYS                           PEEKABOO SHADES                        PEEKABOO PAYS               │
│      ═════════════                           ═══════════════                        ═════════════               │
│                                                                                                                 │
│   ┌────────────────┐                    ┌────────────────────────┐                ┌────────────────┐            │
│   │                │                    │                        │                │                │            │
│   │   $500.00      │                    │    REVENUE RECEIVED    │                │   $300.00      │            │
│   │   Order Total  │ ──────────────────▶│                        │───────────────▶│   Mfr Cost     │            │
│   │                │                    │    Customer Invoice    │                │                │            │
│   │   (includes    │                    │    type: "customer"    │                │   Manufacturer │            │
│   │   product +    │                    │    status: "paid"      │                │   Invoice      │            │
│   │   tax +        │                    │                        │                │   type: "mfr"  │            │
│   │   shipping)    │                    │                        │                │   status:      │            │
│   │                │                    │                        │                │   "pending"    │            │
│   └────────────────┘                    │                        │                └────────────────┘            │
│                                         │                        │                                              │
│                                         │  ┌──────────────────┐  │                ┌────────────────┐            │
│                                         │  │                  │  │                │                │            │
│                                         │  │  GROSS PROFIT    │  │                │   $75.00       │            │
│                                         │  │                  │  │───────────────▶│   Technician   │            │
│                                         │  │  $500 - $300     │  │                │   Payment      │            │
│                                         │  │  - $75 - $25     │  │                │                │            │
│                                         │  │  ═══════════     │  │                │   (75% of      │            │
│                                         │  │  = $100 NET      │  │                │   $100 install │            │
│                                         │  │                  │  │                │   fee)         │            │
│                                         │  │  (20% margin)    │  │                │                │            │
│                                         │  │                  │  │                └────────────────┘            │
│                                         │  └──────────────────┘  │                                              │
│                                         │                        │                ┌────────────────┐            │
│                                         │                        │                │                │            │
│                                         │                        │───────────────▶│   $25.00       │            │
│                                         │                        │                │   Dealer       │            │
│                                         │                        │                │   Commission   │            │
│                                         │                        │                │   (if B2B)     │            │
│                                         │                        │                │                │            │
│                                         │                        │                │   (5% of       │            │
│                                         │                        │                │   order)       │            │
│                                         └────────────────────────┘                └────────────────┘            │
│                                                                                                                 │
│                                                                                                                 │
│   INVOICE TYPES:                                                                                                │
│   ══════════════                                                                                                │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────┐    ┌─────────────────────────────────────────────┐           │
│   │                                             │    │                                             │           │
│   │   CUSTOMER INVOICE (RECEIVABLE)             │    │   MANUFACTURER INVOICE (PAYABLE)            │           │
│   │   ═════════════════════════════             │    │   ═══════════════════════════════           │           │
│   │                                             │    │                                             │           │
│   │   • Money OWED TO Peekaboo                  │    │   • Money Peekaboo OWES                     │           │
│   │   • Created when order placed               │    │   • Created when sent to production        │           │
│   │   • Status: pending → paid                  │    │   • Status: pending → paid                 │           │
│   │   • Tracked in Accounts Receivable          │    │   • Tracked in Accounts Payable            │           │
│   │                                             │    │   • Payment terms: NET 30                  │           │
│   │   invoices[] {                              │    │                                             │           │
│   │     type: "customer",                       │    │   invoices[] {                              │           │
│   │     customerId: "cust-xxx",                 │    │     type: "manufacturer",                   │           │
│   │     total: 500.00                           │    │     manufacturerId: "mfr-xxx",              │           │
│   │   }                                         │    │     total: 300.00                           │           │
│   │                                             │    │   }                                         │           │
│   └─────────────────────────────────────────────┘    └─────────────────────────────────────────────┘           │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                    DATABASE COLLECTIONS & RELATIONSHIPS                                         │
│                                    ════════════════════════════════════                                         │
│                                                                                                                 │
│                                              ┌─────────────┐                                                    │
│                                              │   ORDERS    │                                                    │
│                                              │  orders[]   │                                                    │
│                                              │             │                                                    │
│                                              │  THE CENTRAL│                                                    │
│                                              │  HUB - ALL  │                                                    │
│                                              │  ENTITIES   │                                                    │
│                                              │  CONNECT    │                                                    │
│                                              │  HERE       │                                                    │
│                                              └──────┬──────┘                                                    │
│                                                     │                                                           │
│         ┌───────────────────┬───────────────────────┼───────────────────────┬───────────────────┐              │
│         │                   │                       │                       │                   │              │
│         ▼                   ▼                       ▼                       ▼                   ▼              │
│   ┌───────────┐       ┌───────────┐           ┌───────────┐           ┌───────────┐       ┌───────────┐        │
│   │ CUSTOMERS │       │  DEALERS  │           │  INVOICES │           │MANUFACTUR-│       │TECHNICIANS│        │
│   │           │       │           │           │           │           │   ERS     │       │           │        │
│   │customers[]│       │ dealers[] │           │invoices[] │           │manufactur-│       │technicians│        │
│   │           │       │dealerUsers│           │           │           │ers[]      │       │[]         │        │
│   │           │       │[]         │           │ 2 types:  │           │manufactur-│       │           │        │
│   │ • id      │       │           │           │ • customer│           │erUsers[]  │       │ • id      │        │
│   │ • email   │       │ • id      │           │ • manufac-│           │manufactur-│       │ • name    │        │
│   │ • name    │       │ • company │           │   turer   │           │erPrices[] │       │ • special-│        │
│   │ • address │       │ • tier    │           │           │           │           │       │   ties    │        │
│   │ • orders  │       │ • discount│           │           │           │ • id      │       │ • areas   │        │
│   │ • spent   │       │ • commis- │           │           │           │ • name    │       │ • avail-  │        │
│   │           │       │   sion    │           │           │           │ • lead    │       │   ability │        │
│   └─────┬─────┘       └─────┬─────┘           └─────┬─────┘           │   time    │       └─────┬─────┘        │
│         │                   │                       │                 └─────┬─────┘             │              │
│         │                   │                       │                       │                   │              │
│         │                   ▼                       │                       │                   ▼              │
│         │             ┌───────────┐                 │                       │             ┌───────────┐        │
│         │             │DEALER     │                 │                       │             │APPOINTMENT│        │
│         │             │ORDERS     │                 │                       │             │S          │        │
│         │             │           │                 │                       │             │           │        │
│         │             │dealerOrder│                 │                       │             │appoint-   │        │
│         │             │s[]        │                 │                       │             │ments[]    │        │
│         │             │           │                 │                       │             │           │        │
│         │             │ B2B orders│                 │                       │             │ • orderId │        │
│         │             │ with end  │                 │                       │             │ • techId  │        │
│         │             │ customer  │                 │                       │             │ • date    │        │
│         │             │ info      │                 │                       │             │ • status  │        │
│         │             └─────┬─────┘                 │                       │             └─────┬─────┘        │
│         │                   │                       │                       │                   │              │
│         │                   ▼                       │                       │                   ▼              │
│         │             ┌───────────┐                 │                       │             ┌───────────┐        │
│         │             │COMMISSIONS│                 │                       │             │INSTALL    │        │
│         │             │           │                 │                       │             │PAYMENTS   │        │
│         │             │commissions│                 │                       │             │           │        │
│         │             │[]         │                 │                       │             │installat- │        │
│         │             │           │                 │                       │             │ionPayments│        │
│         │             │ Dealer    │                 │                       │             │[]         │        │
│         │             │ earnings  │                 │                       │             │           │        │
│         │             │ per order │                 │                       │             │ Technician│        │
│         │             └───────────┘                 │                       │             │ earnings  │        │
│         │                                           │                       │             └───────────┘        │
│         │                                           │                       │                                  │
│         └───────────────────────────────────────────┴───────────────────────┘                                  │
│                                                                                                                 │
│                                                                                                                 │
│   SUPPORTING COLLECTIONS:                                                                                       │
│   ═══════════════════════                                                                                       │
│                                                                                                                 │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐      │
│   │ PRODUCTS  │  │  FABRICS  │  │ CATEGORIES│  │  QUOTES   │  │PROMOTIONS │  │SUBSCRIBERS│  │  CONTENT  │      │
│   │           │  │           │  │           │  │           │  │           │  │           │  │           │      │
│   │products[] │  │ fabrics[] │  │categories │  │ quotes[]  │  │promotions │  │subscribers│  │ pages[]   │      │
│   │           │  │           │  │[]         │  │           │  │[]         │  │[]         │  │ faqs[]    │      │
│   │           │  │           │  │           │  │           │  │           │  │           │  │ media[]   │      │
│   └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘      │
│                                                                                                                 │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐                                    │
│   │  HARDWARE │  │  MOTORS   │  │ACCESSORIES│  │  SETTINGS │  │   USERS   │                                    │
│   │           │  │           │  │           │  │           │  │  (Admin)  │                                    │
│   │hardware   │  │ motors[]  │  │accessories│  │ settings  │  │           │                                    │
│   │Options[]  │  │           │  │[]         │  │{}         │  │ users[]   │                                    │
│   │           │  │           │  │           │  │           │  │           │                                    │
│   └───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘                                    │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Order Status Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                    ORDER STATUS PROGRESSION                                                     │
│                                    ════════════════════════                                                     │
│                                                                                                                 │
│                                                                                                                 │
│   CUSTOMER/DEALER PHASE              ADMIN PHASE                    MANUFACTURER PHASE                          │
│   ═════════════════════              ═══════════                    ══════════════════                          │
│                                                                                                                 │
│   ┌─────────┐                                                                                                   │
│   │ pending │  Order placed, awaiting payment                                                                   │
│   └────┬────┘                                                                                                   │
│        │                                                                                                        │
│        ▼                                                                                                        │
│   ┌─────────┐                                                                                                   │
│   │  paid   │  Payment received & confirmed                                                                     │
│   └────┬────┘                                                                                                   │
│        │                                                                                                        │
│        │                        ┌──────────────┐                                                                │
│        └───────────────────────▶│order_received│  Sent to manufacturer                                          │
│                                 └──────┬───────┘                                                                │
│                                        │                                                                        │
│                                        │                    ┌─────────────┐                                     │
│                                        └───────────────────▶│manufacturing│  In production                      │
│                                                             └──────┬──────┘                                     │
│                                                                    │                                            │
│                                                                    ▼                                            │
│                                                             ┌─────────────┐                                     │
│                                                             │     qa      │  Quality check                      │
│                                                             └──────┬──────┘                                     │
│                                                                    │                                            │
│                                                                    ▼                                            │
│                                                             ┌─────────────┐                                     │
│                                                             │ready_to_ship│  Packed & labeled                   │
│                                                             └──────┬──────┘                                     │
│                                                                    │                                            │
│                                                                    ▼                                            │
│                                                             ┌─────────────┐                                     │
│                                                             │   shipped   │  In transit                         │
│                                                             └──────┬──────┘                                     │
│                                                                    │                                            │
│   DELIVERY/INSTALL PHASE                                           │                                            │
│   ══════════════════════                                           │                                            │
│                                                                    ▼                                            │
│                                                             ┌─────────────┐                                     │
│                                                             │  delivered  │  Customer received                  │
│                                                             └──────┬──────┘                                     │
│                                                                    │                                            │
│                                                                    ▼                                            │
│                                                             ┌─────────────┐                                     │
│                                                             │  installed  │  Technician completed               │
│                                                             └──────┬──────┘                                     │
│                                                                    │                                            │
│                                                                    ▼                                            │
│                                                             ┌─────────────┐                                     │
│                                                             │   closed    │  Order complete                     │
│                                                             └─────────────┘                                     │
│                                                                                                                 │
│                                                                                                                 │
│   EXCEPTION STATUSES:                                                                                           │
│   ═══════════════════                                                                                           │
│                                                                                                                 │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐                                                   │
│   │ cancelled │  │ refunded  │  │  on_hold  │  │  returned │                                                   │
│   │           │  │           │  │           │  │           │                                                   │
│   │ Customer  │  │ Money     │  │ Awaiting  │  │ Product   │                                                   │
│   │ cancelled │  │ returned  │  │ info or   │  │ sent back │                                                   │
│   │ order     │  │ to cust   │  │ decision  │  │           │                                                   │
│   └───────────┘  └───────────┘  └───────────┘  └───────────┘                                                   │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                    TECHNOLOGY ARCHITECTURE                                                      │
│                                    ═══════════════════════                                                      │
│                                                                                                                 │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                          FRONTEND                                                        │  │
│   │                                                                                                          │  │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │  │
│   │   │   HTML5     │    │    CSS3     │    │ JavaScript  │    │   Fetch     │    │LocalStorage │           │  │
│   │   │   Pages     │    │   Styles    │    │  (Vanilla)  │    │    API      │    │   (Cart)    │           │  │
│   │   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘           │  │
│   │                                                                                                          │  │
│   │   245 HTML Pages: Customer (20) + Dealer (6) + Technician (7) + Manufacturer (2) + Admin (189+)         │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                     │                                                           │
│                                                     │ HTTP/REST API                                             │
│                                                     ▼                                                           │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                          BACKEND                                                         │  │
│   │                                                                                                          │  │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │  │
│   │   │   Node.js   │    │   Express   │    │    JWT      │    │   bcrypt    │    │   Multer    │           │  │
│   │   │   Runtime   │    │   Server    │    │    Auth     │    │  Passwords  │    │   Uploads   │           │  │
│   │   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘           │  │
│   │                                                                                                          │  │
│   │   server.js (238KB) - 579+ API endpoints                                                                 │  │
│   │   Middleware: auth.js, rbac.js, validation                                                               │  │
│   │   Services: pricing-engine.js, order-service.js, audit-logger.js                                         │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                     │                                                           │
│                                                     │ Read/Write                                                │
│                                                     ▼                                                           │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                          DATABASE                                                        │  │
│   │                                                                                                          │  │
│   │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │  │
│   │   │                                                                                                  │   │  │
│   │   │                              database.json (JSON File Database)                                  │   │  │
│   │   │                                                                                                  │   │  │
│   │   │   30+ Collections: orders, customers, dealers, manufacturers, technicians, invoices,            │   │  │
│   │   │   products, fabrics, categories, quotes, promotions, subscribers, appointments, etc.            │   │  │
│   │   │                                                                                                  │   │  │
│   │   └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                     EXTERNAL INTEGRATIONS                                                │  │
│   │                                                                                                          │  │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │  │
│   │   │  Facebook   │    │   Google    │    │   Email     │    │   Payment   │    │   Shipping  │           │  │
│   │   │  Catalog    │    │  Shopping   │    │   Service   │    │   Gateway   │    │   (UPS)     │           │  │
│   │   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘           │  │
│   │                                                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Component | Count | Purpose |
|-----------|-------|---------|
| **Portals** | 5 | Customer, Dealer, Manufacturer, Technician, Admin |
| **HTML Pages** | 245 | All user interfaces |
| **API Endpoints** | 579+ | Backend services |
| **Database Collections** | 30+ | Data storage |
| **User Roles** | 5 | Customer, Dealer, Admin, Manufacturer, Technician |
| **Invoice Types** | 2 | Customer (Receivable), Manufacturer (Payable) |
| **Order Statuses** | 12+ | Full lifecycle tracking |
| **Dealer Tiers** | 3 | Bronze (15%), Silver (20%), Gold (25%) |

**Business Model:** B2C + B2B e-commerce for custom window blinds with integrated manufacturing, installation, and financial management.

---

*Document created: January 2026*
*Peekaboo Shades Enterprise System*
