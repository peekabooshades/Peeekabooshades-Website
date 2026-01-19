# Portal Data Models - Complete Documentation

**Last Updated:** January 2026

This document provides detailed data model diagrams for all 4 portals showing exactly how each works and connects to the main system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Customer (Member) Portal](#1-customer-member-portal)
3. [Dealer Portal](#2-dealer-portal)
4. [Manufacturer Portal](#3-manufacturer-portal)
5. [Technician Portal](#4-technician-portal)
6. [Complete System Integration](#5-complete-system-integration)

> **Note:** The order follows the business flow: Customer → Dealer (B2B) → Manufacturer (Production) → Technician (Installation after delivery)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PEEKABOO SHADES SYSTEM                                        │
│                                                                                                  │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│    │  CUSTOMER   │    │   DEALER    │    │ TECHNICIAN  │    │MANUFACTURER │    │    ADMIN    │ │
│    │   PORTAL    │    │   PORTAL    │    │   PORTAL    │    │   PORTAL    │    │   PANEL     │ │
│    │ /signup.html│    │/dealer/     │    │/technician/ │    │/manufacturer│    │  /admin/    │ │
│    │ /login.html │    │             │    │             │    │             │    │             │ │
│    │/account.html│    │             │    │             │    │             │    │             │ │
│    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│           │                  │                  │                  │                  │        │
│           │                  │                  │                  │                  │        │
│           ▼                  ▼                  ▼                  ▼                  ▼        │
│    ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│    │                                   BACKEND API                                            │ │
│    │                              (Node.js/Express server.js)                                 │ │
│    │                                                                                          │ │
│    │   /api/customer/*    /api/dealer/*    /api/technician/*   /api/manufacturer/*   /api/admin/*│
│    └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                  │
│                                              ▼                                                  │
│    ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│    │                                   DATABASE.JSON                                          │ │
│    │                                                                                          │ │
│    │   customers[]  dealers[]  technicians[]  manufacturers[]  orders[]  invoices[]          │ │
│    │   dealerUsers[]  manufacturerUsers[]  appointments[]  commissions[]  payments[]         │ │
│    └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Customer (Member) Portal

### 1.1 Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CUSTOMER (MEMBER) PORTAL                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   FRONTEND PAGES                           BACKEND                         DATABASE              │
│   ══════════════                           ═══════                         ════════              │
│                                                                                                  │
│   ┌─────────────┐                    ┌─────────────────┐              ┌─────────────────┐       │
│   │ signup.html │───────────────────▶│ POST /api/      │─────────────▶│   customers[]   │       │
│   │             │  {firstName,       │ customer/       │  Creates     │                 │       │
│   │ • Name      │   lastName,        │ register        │  new record  │ {               │       │
│   │ • Email     │   email,           │                 │              │   id,           │       │
│   │ • Phone     │   password,        └─────────────────┘              │   email,        │       │
│   │ • Password  │   phone,                                            │   password,     │       │
│   │ • Newsletter│   newsletter}                                       │   firstName,    │       │
│   └─────────────┘                                                     │   lastName,     │       │
│         │                                                             │   phone,        │       │
│         │ Success                                                     │   addresses[],  │       │
│         ▼                                                             │   totalOrders,  │       │
│   ┌─────────────┐                    ┌─────────────────┐              │   totalSpent,   │       │
│   │ login.html  │───────────────────▶│ POST /api/      │──────────────│   rewardPoints, │       │
│   │             │  {email,           │ customer/login  │  Validates   │   newsletter,   │       │
│   │ • Email     │   password,        │                 │  password    │   createdAt,    │       │
│   │ • Password  │   remember}        │                 │  Returns JWT │   lastLoginAt   │       │
│   │ • Remember  │                    └────────┬────────┘              │ }               │       │
│   └─────────────┘                             │                       └─────────────────┘       │
│         │                                     │                                                  │
│         │ JWT Token                           │ Returns                                          │
│         ▼                                     ▼                                                  │
│   ┌─────────────┐                    ┌─────────────────┐                                        │
│   │account.html │◀───────────────────│ {               │                                        │
│   │             │                    │   success: true,│                                        │
│   │ DASHBOARD   │                    │   token: "jwt..",│                                       │
│   │ ┌─────────┐ │                    │   customer: {   │                                        │
│   │ │ Orders  │ │                    │     id, name,   │                                        │
│   │ │ History │ │                    │     email       │                                        │
│   │ └─────────┘ │                    │   }             │                                        │
│   │ ┌─────────┐ │                    │ }               │                                        │
│   │ │Addresses│ │                    └─────────────────┘                                        │
│   │ └─────────┘ │                                                                               │
│   │ ┌─────────┐ │                                                                               │
│   │ │ Profile │ │                                                                               │
│   │ └─────────┘ │                                                                               │
│   └─────────────┘                                                                               │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Customer Order Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CUSTOMER ORDER FLOW                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   CUSTOMER ACTIONS                                                          DATABASE UPDATES     │
│   ════════════════                                                          ════════════════     │
│                                                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                                     │
│   │  Browse     │─────▶│ Configure   │─────▶│  Add to     │                                     │
│   │  shop.html  │      │product.html │      │   Cart      │                                     │
│   └─────────────┘      └─────────────┘      └──────┬──────┘                                     │
│                                                    │                                             │
│                                                    ▼                                             │
│                                             ┌─────────────┐                                     │
│                                             │  cart.html  │                                     │
│                                             │  Checkout   │                                     │
│                                             └──────┬──────┘                                     │
│                                                    │                                             │
│                                                    │ POST /api/orders                           │
│                                                    ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                                    ORDER CREATED                                         │  │
│   │                                                                                          │  │
│   │   orders[] ◀────────────────────────────────────────────────────────────────────────────│  │
│   │   {                                                                                      │  │
│   │     id: "ORD-123456",                                                                    │  │
│   │     order_number: "PS-150425",                                                           │  │
│   │     customerId: "cust-ed8efb2f",  ◀──── Links to customer                               │  │
│   │     customer_name: "Surya",                                                              │  │
│   │     customer_email: "surya@gmail.com",                                                   │  │
│   │     status: "pending",                                                                   │  │
│   │     items: [...],                                                                        │  │
│   │     pricing: {                                                                           │  │
│   │       subtotal: 250.00,                                                                  │  │
│   │       tax: 20.00,                                                                        │  │
│   │       shipping: 15.00,                                                                   │  │
│   │       total: 285.00                                                                      │  │
│   │     }                                                                                    │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                                        │
│                        │ Auto-updates                                                           │
│                        ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │   customers[] UPDATED                                                                    │  │
│   │   {                                                                                      │  │
│   │     id: "cust-ed8efb2f",                                                                 │  │
│   │     totalOrders: 5 → 6,         ◀──── Incremented                                       │  │
│   │     totalSpent: 1467.70 → 1752.70,  ◀──── Added order total                            │  │
│   │     lastOrderAt: "2026-01-18..."  ◀──── Updated                                         │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                                        │
│                        │ Auto-creates                                                           │
│                        ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │   invoices[] (type: "customer")                                                          │  │
│   │   {                                                                                      │  │
│   │     id: "inv-001",                                                                       │  │
│   │     invoiceNumber: "INV-2026-0001",                                                      │  │
│   │     orderId: "ORD-123456",  ◀──── Links to order                                        │  │
│   │     customerId: "cust-ed8efb2f",  ◀──── Links to customer                               │  │
│   │     type: "customer",  ◀──── RECEIVABLE (money coming IN)                               │  │
│   │     total: 285.00,                                                                       │  │
│   │     status: "pending"                                                                    │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Customer Data Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER DATA RELATIONSHIPS                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                              ┌─────────────────────────┐                                        │
│                              │       CUSTOMER          │                                        │
│                              │   customers[]           │                                        │
│                              │                         │                                        │
│                              │   id: "cust-ed8efb2f"   │                                        │
│                              │   email: "surya@..."    │                                        │
│                              │   password: "$2b$..."   │                                        │
│                              │   firstName: "Surya"    │                                        │
│                              │   addresses: [...]      │                                        │
│                              │   totalOrders: 5        │                                        │
│                              │   totalSpent: 1467.70   │                                        │
│                              └───────────┬─────────────┘                                        │
│                                          │                                                      │
│                    ┌─────────────────────┼─────────────────────┐                               │
│                    │                     │                     │                               │
│                    ▼                     ▼                     ▼                               │
│         ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐                       │
│         │     ORDERS      │   │    INVOICES     │   │  APPOINTMENTS   │                       │
│         │   orders[]      │   │   invoices[]    │   │ appointments[]  │                       │
│         │                 │   │                 │   │                 │                       │
│         │ customerId:     │   │ customerId:     │   │ customerId:     │                       │
│         │ "cust-ed8efb2f" │   │ "cust-ed8efb2f" │   │ "cust-ed8efb2f" │                       │
│         │                 │   │ type: "customer"│   │                 │                       │
│         │ 5 orders        │   │ 5 invoices      │   │ 2 appointments  │                       │
│         └─────────────────┘   └─────────────────┘   └─────────────────┘                       │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dealer Portal

### 2.1 Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      DEALER PORTAL                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   TWO-LEVEL STRUCTURE:                                                                          │
│   ═══════════════════                                                                           │
│                                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ LEVEL 1: DEALER COMPANY                                                                  │  │
│   │                                                                                          │  │
│   │   dealers[]                                                                              │  │
│   │   {                                                                                      │  │
│   │     id: "dealer-001",                                                                    │  │
│   │     companyName: "ABC Window Coverings",                                                 │  │
│   │     contactName: "John Smith",                                                           │  │
│   │     email: "contact@abcwindows.com",                                                     │  │
│   │     phone: "555-123-4567",                                                               │  │
│   │     address: { street, city, state, zip },                                               │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │                    TIER SYSTEM                                   │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   tier: "silver"                                                 │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   ┌──────────┬─────────────┬──────────────┬─────────────────┐   │                 │  │
│   │     │   │   TIER   │  MIN ORDERS │   DISCOUNT   │     BENEFITS    │   │                 │  │
│   │     │   ├──────────┼─────────────┼──────────────┼─────────────────┤   │                 │  │
│   │     │   │  Bronze  │      0      │     15%      │  Base pricing   │   │                 │  │
│   │     │   │  Silver  │     11+     │     20%      │  Priority support│  │                 │  │
│   │     │   │   Gold   │     51+     │     25%      │  Dedicated mgr  │   │                 │  │
│   │     │   └──────────┴─────────────┴──────────────┴─────────────────┘   │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     discountPercent: 20,     ◀──── Applied to all orders                                │  │
│   │     commissionRate: 5,       ◀──── Earns 5% on each sale                                │  │
│   │     totalOrders: 45,                                                                     │  │
│   │     totalRevenue: 125000,                                                                │  │
│   │     status: "active"                                                                     │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                                        │
│                        │ Has many                                                               │
│                        ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ LEVEL 2: DEALER USERS (Login Accounts)                                                   │  │
│   │                                                                                          │  │
│   │   dealerUsers[]                                                                          │  │
│   │   {                                                                                      │  │
│   │     id: "dealer-user-001",                                                               │  │
│   │     dealerId: "dealer-001",   ◀──── Links to dealer company                             │  │
│   │     dealerName: "ABC Window Coverings",                                                  │  │
│   │     name: "John Smith",                                                                  │  │
│   │     email: "john@abcwindows.com",   ◀──── Login email                                   │  │
│   │     password: "$2b$10$...",   ◀──── Hashed password                                     │  │
│   │     role: "admin",   ◀──── admin, manager, staff                                        │  │
│   │     status: "active",                                                                    │  │
│   │     lastLogin: "2026-01-11T19:52:15.779Z"                                                │  │
│   │   }                                                                                      │  │
│   │                                                                                          │  │
│   │   One dealer company can have MULTIPLE users:                                            │  │
│   │   • Admin - full access                                                                  │  │
│   │   • Manager - can manage orders                                                          │  │
│   │   • Staff - view only                                                                    │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Dealer Order Flow (B2B)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DEALER ORDER FLOW (B2B)                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   DEALER PORTAL                                                                                  │
│   ═════════════                                                                                  │
│                                                                                                  │
│   ┌─────────────────┐                                                                           │
│   │  dealer/        │                                                                           │
│   │  login.html     │                                                                           │
│   │                 │───▶ POST /api/dealer/login                                                │
│   │  Email: john@.. │     {email, password}                                                     │
│   │  Password: ***  │                                                                           │
│   └────────┬────────┘                                                                           │
│            │                                                                                     │
│            │ JWT Token (includes dealerId, tier, discount)                                      │
│            ▼                                                                                     │
│   ┌─────────────────┐                                                                           │
│   │  dealer/        │                                                                           │
│   │  index.html     │───▶ GET /api/dealer/stats                                                 │
│   │  (Dashboard)    │                                                                           │
│   │                 │     Returns:                                                              │
│   │  ┌───────────┐  │     • ordersThisMonth: 12                                                 │
│   │  │ Stats     │  │     • revenueThisMonth: $15,000                                           │
│   │  │ • Orders  │  │     • pendingOrders: 3                                                    │
│   │  │ • Revenue │  │     • commissionsEarned: $750                                             │
│   │  │ • Pending │  │                                                                           │
│   │  └───────────┘  │                                                                           │
│   └────────┬────────┘                                                                           │
│            │                                                                                     │
│            ▼                                                                                     │
│   ┌─────────────────┐                                                                           │
│   │  dealer/        │                                                                           │
│   │  new-order.html │───▶ POST /api/dealer/orders                                               │
│   │                 │                                                                           │
│   │  Configure      │     Request:                                                              │
│   │  product for    │     {                                                                     │
│   │  end customer   │       endCustomer: {name, email, phone, address},                         │
│   │                 │       items: [{product, width, height, fabric, options}],                 │
│   │                 │       notes: "..."                                                        │
│   │                 │     }                                                                     │
│   └────────┬────────┘                                                                           │
│            │                                                                                     │
│            │                                                                                     │
│            ▼                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              ORDER CREATED WITH DISCOUNT                                 │  │
│   │                                                                                          │  │
│   │   dealerOrders[]                                                                         │  │
│   │   {                                                                                      │  │
│   │     id: "DORD-001",                                                                      │  │
│   │     dealerId: "dealer-001",   ◀──── Links to dealer                                     │  │
│   │     endCustomer: {                                                                       │  │
│   │       name: "Customer Name",                                                             │  │
│   │       email: "customer@email.com",                                                       │  │
│   │       address: "..."                                                                     │  │
│   │     },                                                                                   │  │
│   │     items: [...],                                                                        │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │              PRICING WITH DEALER DISCOUNT                        │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   Original Price:        $500.00                                 │                 │  │
│   │     │   Dealer Discount (20%): -$100.00                                │                 │  │
│   │     │   ─────────────────────────────────                              │                 │  │
│   │     │   Dealer Pays:           $400.00   ◀──── Dealer's cost           │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   Dealer can charge end customer any amount (markup)             │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     status: "pending"                                                                    │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                                        │
│                        │ Also creates                                                           │
│                        ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │   commissions[]                                                                          │  │
│   │   {                                                                                      │  │
│   │     id: "comm-001",                                                                      │  │
│   │     dealerId: "dealer-001",                                                              │  │
│   │     orderId: "DORD-001",                                                                 │  │
│   │     orderTotal: 400.00,                                                                  │  │
│   │     commissionRate: 5,                                                                   │  │
│   │     commissionAmount: 20.00,   ◀──── 5% of $400                                         │  │
│   │     status: "pending",   ◀──── pending → approved → paid                                │  │
│   │     paidAt: null                                                                         │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Dealer Data Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               DEALER DATA RELATIONSHIPS                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                              ┌─────────────────────────┐                                        │
│                              │    DEALER COMPANY       │                                        │
│                              │      dealers[]          │                                        │
│                              │                         │                                        │
│                              │   id: "dealer-001"      │                                        │
│                              │   companyName: "ABC..." │                                        │
│                              │   tier: "silver"        │                                        │
│                              │   discountPercent: 20   │                                        │
│                              │   commissionRate: 5     │                                        │
│                              └───────────┬─────────────┘                                        │
│                                          │                                                      │
│            ┌─────────────────────────────┼─────────────────────────────┐                       │
│            │                             │                             │                       │
│            ▼                             ▼                             ▼                       │
│  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐                │
│  │  DEALER USERS   │          │  DEALER ORDERS  │          │  COMMISSIONS    │                │
│  │  dealerUsers[]  │          │  dealerOrders[] │          │  commissions[]  │                │
│  │                 │          │                 │          │                 │                │
│  │ dealerId:       │          │ dealerId:       │          │ dealerId:       │                │
│  │ "dealer-001"    │          │ "dealer-001"    │          │ "dealer-001"    │                │
│  │                 │          │                 │          │                 │                │
│  │ • John (admin)  │          │ 45 orders       │          │ $2,250 earned   │                │
│  │ • Sarah (staff) │          │ $100,000 volume │          │ $1,800 paid     │                │
│  └─────────────────┘          └────────┬────────┘          └─────────────────┘                │
│                                        │                                                       │
│                                        │ Each order has                                        │
│                                        ▼                                                       │
│                               ┌─────────────────┐                                              │
│                               │ DEALER CUSTOMER │                                              │
│                               │dealerCustomers[]│                                              │
│                               │                 │                                              │
│                               │ dealerId:       │                                              │
│                               │ "dealer-001"    │                                              │
│                               │                 │                                              │
│                               │ End customers   │                                              │
│                               │ served by dealer│                                              │
│                               └─────────────────┘                                              │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Manufacturer Portal

### 3.1 Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MANUFACTURER PORTAL                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   TWO-LEVEL STRUCTURE:                                                                          │
│   ═══════════════════                                                                           │
│                                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ LEVEL 1: MANUFACTURER COMPANY                                                            │  │
│   │                                                                                          │  │
│   │   manufacturers[]                                                                        │  │
│   │   {                                                                                      │  │
│   │     id: "mfr-default",                                                                   │  │
│   │     name: "Default Manufacturer",                                                        │  │
│   │     code: "DEFAULT",                                                                     │  │
│   │     contactName: "Alice Wang",                                                           │  │
│   │     email: "alice@manufacturer.com",                                                     │  │
│   │     phone: "+86-123-456-7890",                                                           │  │
│   │     address: { city: "Shenzhen", country: "China" },                                     │  │
│   │                                                                                          │  │
│   │     leadTimeDays: 14,   ◀──── Days to manufacture                                       │  │
│   │     shippingMethod: "ocean_freight",                                                     │  │
│   │                                                                                          │  │
│   │     productTypes: ["roller", "zebra", "honeycomb", "roman"],   ◀──── What they make     │  │
│   │                                                                                          │  │
│   │     paymentTerms: "net30",   ◀──── Payment due in 30 days                               │  │
│   │     status: "active"                                                                     │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                                        │
│                        │ Has many                                                               │
│                        ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ LEVEL 2: MANUFACTURER USERS (Login Accounts)                                             │  │
│   │                                                                                          │  │
│   │   manufacturerUsers[]                                                                    │  │
│   │   {                                                                                      │  │
│   │     id: "mfr-user-e23820d6",                                                             │  │
│   │     manufacturerId: "mfr-default",   ◀──── Links to manufacturer                        │  │
│   │     manufacturerName: "Default Manufacturer",                                            │  │
│   │     name: "Factory Manager",                                                             │  │
│   │     email: "manufacturer@peekaboo.com",   ◀──── Login email                             │  │
│   │     password: "$2b$10$...",                                                              │  │
│   │     role: "manager",   ◀──── operator, manager, admin                                   │  │
│   │     status: "active",                                                                    │  │
│   │     lastLogin: "2026-01-18T15:53:20.050Z"                                                │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                        │                                                                        │
│                        │ Has pricing data                                                       │
│                        ▼                                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ MANUFACTURER PRICES (Cost Data)                                                          │  │
│   │                                                                                          │  │
│   │   manufacturerPrices[]                                                                   │  │
│   │   {                                                                                      │  │
│   │     id: "mp-001",                                                                        │  │
│   │     manufacturerId: "mfr-default",                                                       │  │
│   │     productType: "roller",                                                               │  │
│   │     fabricCode: "82032A",   ◀──── Specific fabric code                                  │  │
│   │     fabricName: "Light Filtering White",                                                 │  │
│   │     pricePerSqMeter: 45.00,   ◀──── Cost per square meter                               │  │
│   │     status: "active"                                                                     │  │
│   │   }                                                                                      │  │
│   │                                                                                          │  │
│   │   This is used to calculate:                                                             │  │
│   │   • Manufacturer cost (what we pay them)                                                 │  │
│   │   • Customer price (cost + margin)                                                       │  │
│   │   • Profit per order                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Manufacturer Order Flow (Production)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              MANUFACTURER ORDER FLOW (PRODUCTION)                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   ORDER STATUS WORKFLOW (Manufacturer Controls):                                                 │
│   ═════════════════════════════════════════════                                                  │
│                                                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│   │order_received│───▶│manufacturing │───▶│      qa      │───▶│ready_to_ship │───▶│  shipped │ │
│   │              │    │              │    │              │    │              │    │          │ │
│   │  Received    │    │ In Production│    │   Quality    │    │   Ready to   │    │ Shipped  │ │
│   │  from admin  │    │              │    │   Assurance  │    │   Ship       │    │          │ │
│   └──────────────┘    └──────────────┘    └──────┬───────┘    └──────────────┘    └──────────┘ │
│                                                  │                                              │
│                                                  │ If fails QA                                  │
│                                                  ▼                                              │
│                                           Back to manufacturing                                 │
│                                                                                                  │
│                                                                                                  │
│   MANUFACTURER PORTAL PAGES:                                                                    │
│   ══════════════════════════                                                                    │
│                                                                                                  │
│   ┌─────────────────┐                                                                           │
│   │  manufacturer/  │                                                                           │
│   │  login.html     │───▶ POST /api/manufacturer/login                                          │
│   │                 │                                                                           │
│   │  Email: mfr@... │                                                                           │
│   │  Password: ***  │                                                                           │
│   └────────┬────────┘                                                                           │
│            │                                                                                     │
│            │ JWT Token                                                                          │
│            ▼                                                                                     │
│   ┌─────────────────┐                                                                           │
│   │  manufacturer/  │                                                                           │
│   │  index.html     │───▶ GET /api/manufacturer/orders                                          │
│   │  (Dashboard)    │                                                                           │
│   │                 │     Returns orders in manufacturer statuses:                              │
│   │  ┌───────────┐  │     • order_received: 5                                                   │
│   │  │Production │  │     • manufacturing: 3                                                    │
│   │  │Queue      │  │     • qa: 2                                                               │
│   │  │           │  │     • ready_to_ship: 4                                                    │
│   │  │ [Orders]  │  │     • shipped: 120                                                        │
│   │  └───────────┘  │                                                                           │
│   └────────┬────────┘                                                                           │
│            │                                                                                     │
│            │ Click order                                                                        │
│            ▼                                                                                     │
│   ┌─────────────────┐                                                                           │
│   │  Order Detail   │───▶ GET /api/manufacturer/orders/:id                                      │
│   │                 │                                                                           │
│   │  PS-150425      │     Returns full order details:                                           │
│   │  ┌───────────┐  │     • Customer info (name, address)                                       │
│   │  │ Item 1    │  │     • Items (product, dimensions, fabric, options)                        │
│   │  │ 36" x 48" │  │     • Manufacturing specs                                                 │
│   │  │ Fabric:82A│  │                                                                           │
│   │  └───────────┘  │                                                                           │
│   │                 │                                                                           │
│   │  [Update Status]│───▶ PUT /api/manufacturer/orders/:id/status                               │
│   │                 │     {newStatus: "manufacturing"}                                          │
│   │  [Add Tracking] │───▶ PUT /api/manufacturer/orders/:id/tracking                             │
│   │                 │     {carrier: "ups", trackingNumber: "1Z..."}                             │
│   └─────────────────┘                                                                           │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Manufacturer Invoice Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               MANUFACTURER INVOICE FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   TWO TYPES OF INVOICES PER ORDER:                                                              │
│   ════════════════════════════════                                                              │
│                                                                                                  │
│                                     ┌─────────────────┐                                         │
│                                     │      ORDER      │                                         │
│                                     │   PS-150425     │                                         │
│                                     │                 │                                         │
│                                     │ Total: $500     │                                         │
│                                     │ MfrCost: $300   │                                         │
│                                     └────────┬────────┘                                         │
│                                              │                                                  │
│                    ┌─────────────────────────┴─────────────────────────┐                       │
│                    │                                                   │                       │
│                    ▼                                                   ▼                       │
│   ┌──────────────────────────────┐               ┌──────────────────────────────┐             │
│   │     CUSTOMER INVOICE         │               │   MANUFACTURER INVOICE        │             │
│   │     (RECEIVABLE - Money IN)  │               │   (PAYABLE - Money OUT)       │             │
│   │                              │               │                               │             │
│   │   invoices[]                 │               │   invoices[]                  │             │
│   │   {                          │               │   {                           │             │
│   │     type: "customer",        │               │     type: "manufacturer",     │             │
│   │     orderId: "ORD-123",      │               │     orderId: "ORD-123",       │             │
│   │     customerId: "cust-...",  │               │     manufacturerId: "mfr-...",│             │
│   │                              │               │                               │             │
│   │     subtotal: 450.00,        │               │     subtotal: 300.00,         │             │
│   │     tax: 36.00,              │               │     tax: 0,                   │             │
│   │     shipping: 14.00,         │               │     shipping: 0,              │             │
│   │     total: 500.00,           │               │     total: 300.00,            │             │
│   │                              │               │                               │             │
│   │     status: "paid"           │               │     status: "pending"         │             │
│   │   }                          │               │   }                           │             │
│   │                              │               │                               │             │
│   │   Customer pays us $500      │               │   We owe manufacturer $300    │             │
│   └──────────────────────────────┘               └──────────────────────────────┘             │
│                    │                                                   │                       │
│                    └─────────────────────────┬─────────────────────────┘                       │
│                                              │                                                  │
│                                              ▼                                                  │
│                              ┌──────────────────────────────┐                                  │
│                              │          PROFIT              │                                  │
│                              │                              │                                  │
│                              │   Revenue:      $500         │                                  │
│                              │   - Mfr Cost:   $300         │                                  │
│                              │   ─────────────────────      │                                  │
│                              │   Gross Profit: $200         │                                  │
│                              │   Margin:       40%          │                                  │
│                              └──────────────────────────────┘                                  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Manufacturer Data Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            MANUFACTURER DATA RELATIONSHIPS                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                              ┌─────────────────────────┐                                        │
│                              │     MANUFACTURER        │                                        │
│                              │    manufacturers[]      │                                        │
│                              │                         │                                        │
│                              │   id: "mfr-default"     │                                        │
│                              │   name: "Default Mfr"   │                                        │
│                              │   leadTimeDays: 14      │                                        │
│                              │   productTypes: [...]   │                                        │
│                              └───────────┬─────────────┘                                        │
│                                          │                                                      │
│         ┌────────────────────────────────┼────────────────────────────────┐                    │
│         │                                │                                │                    │
│         ▼                                ▼                                ▼                    │
│ ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐               │
│ │ MFR USERS       │           │ MFR PRICES      │           │    ORDERS       │               │
│ │manufacturerUsers│           │manufacturerPrices│          │   orders[]      │               │
│ │                 │           │                 │           │                 │               │
│ │ manufacturerId: │           │ manufacturerId: │           │ manufacturerId: │               │
│ │ "mfr-default"   │           │ "mfr-default"   │           │ "mfr-default"   │               │
│ │                 │           │                 │           │                 │               │
│ │ Login accounts  │           │ Cost per fabric │           │ Production      │               │
│ │ for factory     │           │ per sq meter    │           │ orders          │               │
│ └─────────────────┘           └─────────────────┘           └────────┬────────┘               │
│                                                                      │                        │
│                                                                      │                        │
│                                                                      ▼                        │
│                                                          ┌─────────────────┐                  │
│                                                          │    INVOICES     │                  │
│                                                          │   invoices[]    │                  │
│                                                          │                 │                  │
│                                                          │ manufacturerId: │                  │
│                                                          │ "mfr-default"   │                  │
│                                                          │ type: "mfr"     │                  │
│                                                          │                 │                  │
│                                                          │ What we owe     │                  │
│                                                          │ manufacturer    │                  │
│                                                          └─────────────────┘                  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technician Portal

### 4.1 Technician Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TECHNICIAN PORTAL                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │ TECHNICIAN PROFILE                                                                       │  │
│   │                                                                                          │  │
│   │   technicians[]                                                                          │  │
│   │   {                                                                                      │  │
│   │     id: "tech-b21c1efb",                                                                 │  │
│   │     name: "Matt Johnson",                                                                │  │
│   │     email: "matt@gmail.com",   ◀──── Login email                                        │  │
│   │     phone: "8169449009",                                                                 │  │
│   │     password: "$2b$10$...",   ◀──── Hashed password                                     │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │                    SPECIALTIES                                   │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   specialties: [                                                 │                 │  │
│   │     │     "roller-blinds",      ◀──── Can install roller blinds        │                 │  │
│   │     │     "zebra-shades",       ◀──── Can install zebra shades         │                 │  │
│   │     │     "roman-shades",       ◀──── Can install roman shades         │                 │  │
│   │     │     "honeycomb",          ◀──── Can install honeycomb            │                 │  │
│   │     │     "motorized",          ◀──── Certified for motorized          │                 │  │
│   │     │     "commercial"          ◀──── Commercial installations         │                 │  │
│   │     │   ]                                                              │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │                    SERVICE AREAS                                 │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   serviceAreas: [                                                │                 │  │
│   │     │     "Austin",             ◀──── Serves Austin area               │                 │  │
│   │     │     "Round Rock",         ◀──── Serves Round Rock                │                 │  │
│   │     │     "Georgetown"          ◀──── Serves Georgetown                │                 │  │
│   │     │   ]                                                              │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │                    AVAILABILITY                                  │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   availability: [                                                │                 │  │
│   │     │     {                                                            │                 │  │
│   │     │       date: "2026-01-20",                                        │                 │  │
│   │     │       slots: ["12pm-2pm", "2pm-4pm", "4pm-6pm"]                   │                 │  │
│   │     │     },                                                           │                 │  │
│   │     │     {                                                            │                 │  │
│   │     │       date: "2026-01-19",                                        │                 │  │
│   │     │       slots: ["8am-10am", "10am-12pm", "12pm-2pm", "2pm-4pm"]     │                 │  │
│   │     │     }                                                            │                 │  │
│   │     │   ]                                                              │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     status: "active",   ◀──── active, inactive, suspended                               │  │
│   │     rating: 4.8,        ◀──── Customer ratings (1-5)                                    │  │
│   │     reviewCount: 45                                                                      │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Technician Appointment Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                TECHNICIAN APPOINTMENT FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   HOW APPOINTMENTS ARE CREATED:                                                                  │
│   ═════════════════════════════                                                                  │
│                                                                                                  │
│   ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐              │
│   │   CUSTOMER      │           │     ADMIN       │           │   TECHNICIAN    │              │
│   │   schedules     │           │   assigns job   │           │   self-assigns  │              │
│   │   appointment   │           │   to technician │           │   from queue    │              │
│   └────────┬────────┘           └────────┬────────┘           └────────┬────────┘              │
│            │                             │                             │                        │
│            └─────────────────────────────┼─────────────────────────────┘                        │
│                                          │                                                      │
│                                          ▼                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              APPOINTMENT CREATED                                         │  │
│   │                                                                                          │  │
│   │   appointments[]                                                                         │  │
│   │   {                                                                                      │  │
│   │     id: "apt-c4e5eff0",                                                                  │  │
│   │                                                                                          │  │
│   │     appointmentType: "new-installation",   ◀──── new-installation, repair, measurement   │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │                    LINKS TO OTHER ENTITIES                       │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   orderId: "ORD-123456",       ◀──── Links to order (optional)   │                 │  │
│   │     │   technicianId: "tech-b21c1efb", ◀──── Assigned technician       │                 │  │
│   │     │   customerId: "cust-ed8efb2f",   ◀──── Links to customer         │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     customerName: "Surya",                                                               │  │
│   │     customerPhone: "8169449009",                                                         │  │
│   │     customerEmail: "surya@gmail.com",                                                    │  │
│   │                                                                                          │  │
│   │     scheduledDate: "2026-01-19",                                                         │  │
│   │     scheduledTime: "8:00 AM - 10:00 AM",                                                 │  │
│   │                                                                                          │  │
│   │     installationAddress: {                                                               │  │
│   │       address1: "205 Blue Jasmine St",                                                   │  │
│   │       city: "Leander",                                                                   │  │
│   │       state: "TX",                                                                       │  │
│   │       zip: "78628"                                                                       │  │
│   │     },                                                                                   │  │
│   │                                                                                          │  │
│   │     installationFee: 100,   ◀──── Fee charged for installation                          │  │
│   │                                                                                          │  │
│   │     ┌─────────────────────────────────────────────────────────────────┐                 │  │
│   │     │                    STATUS WORKFLOW                               │                 │  │
│   │     │                                                                  │                 │  │
│   │     │   scheduled ──▶ in-progress ──▶ completed                        │                 │  │
│   │     │       │                             │                            │                 │  │
│   │     │       └──────▶ cancelled            └──▶ needs-followup          │                 │  │
│   │     └─────────────────────────────────────────────────────────────────┘                 │  │
│   │                                                                                          │  │
│   │     status: "scheduled",                                                                 │  │
│   │     notes: "Ring doorbell"                                                               │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
│                                                                                                  │
│   WHEN COMPLETED:                                                                               │
│   ═══════════════                                                                               │
│                                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              PAYMENT RECORD CREATED                                      │  │
│   │                                                                                          │  │
│   │   installationPayments[]                                                                 │  │
│   │   {                                                                                      │  │
│   │     id: "ipay-001",                                                                      │  │
│   │     appointmentId: "apt-c4e5eff0",   ◀──── Links to appointment                         │  │
│   │     technicianId: "tech-b21c1efb",   ◀──── Links to technician                          │  │
│   │     amount: 75.00,   ◀──── Technician's cut (e.g., 75% of $100 fee)                     │  │
│   │     status: "pending",   ◀──── pending → approved → paid                                │  │
│   │     paidAt: null                                                                         │  │
│   │   }                                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Technician Data Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             TECHNICIAN DATA RELATIONSHIPS                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                              ┌─────────────────────────┐                                        │
│                              │      TECHNICIAN         │                                        │
│                              │     technicians[]       │                                        │
│                              │                         │                                        │
│                              │   id: "tech-b21c1efb"   │                                        │
│                              │   name: "Matt"          │                                        │
│                              │   specialties: [...]    │                                        │
│                              │   serviceAreas: [...]   │                                        │
│                              │   availability: [...]   │                                        │
│                              └───────────┬─────────────┘                                        │
│                                          │                                                      │
│                    ┌─────────────────────┼─────────────────────┐                               │
│                    │                     │                     │                               │
│                    ▼                     ▼                     ▼                               │
│         ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐                       │
│         │  APPOINTMENTS   │   │    PAYMENTS     │   │     ORDERS      │                       │
│         │ appointments[]  │   │installationPay- │   │    orders[]     │                       │
│         │                 │   │ments[]          │   │                 │                       │
│         │ technicianId:   │   │                 │   │ (via            │                       │
│         │ "tech-b21c1efb" │   │ technicianId:   │   │  appointment)   │                       │
│         │                 │   │ "tech-b21c1efb" │   │                 │                       │
│         │ 12 appointments │   │ $1,500 earned   │   │ Related orders  │                       │
│         └────────┬────────┘   └─────────────────┘   └─────────────────┘                       │
│                  │                                                                             │
│                  │ Each appointment has                                                        │
│                  ▼                                                                             │
│         ┌─────────────────┐                                                                   │
│         │    CUSTOMER     │                                                                   │
│         │   customers[]   │                                                                   │
│         │                 │                                                                   │
│         │ Customer being  │                                                                   │
│         │ served          │                                                                   │
│         └─────────────────┘                                                                   │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete System Integration

### 5.1 How All Portals Connect

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE SYSTEM INTEGRATION                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│                                                                                                  │
│     ┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐       │
│     │  CUSTOMER   │                    │   DEALER    │                    │    ADMIN    │       │
│     │   PORTAL    │                    │   PORTAL    │                    │    PANEL    │       │
│     │             │                    │             │                    │             │       │
│     │ • Signup    │                    │ • B2B Orders│                    │ • Manage    │       │
│     │ • Login     │                    │ • Customers │                    │   Everything│       │
│     │ • Orders    │                    │ • Commissions│                   │             │       │
│     └──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘       │
│            │                                  │                                  │              │
│            │ Creates                          │ Creates                          │ Manages      │
│            ▼                                  ▼                                  ▼              │
│     ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│     │                                                                                      │    │
│     │                                    ORDERS                                            │    │
│     │                                  orders[]                                            │    │
│     │                                                                                      │    │
│     │   ┌─────────────────────────────────────────────────────────────────────────────┐   │    │
│     │   │                                                                             │   │    │
│     │   │   id: "ORD-123456"                                                          │   │    │
│     │   │                                                                             │   │    │
│     │   │   customerId: "cust-ed8efb2f"  ────────────────────▶  CUSTOMER              │   │    │
│     │   │   dealerId: "dealer-001"  ─────────────────────────▶  DEALER (if B2B)       │   │    │
│     │   │   manufacturerId: "mfr-default"  ──────────────────▶  MANUFACTURER          │   │    │
│     │   │                                                                             │   │    │
│     │   │   status: "manufacturing"  ────────────────────────▶  Current stage         │   │    │
│     │   │                                                                             │   │    │
│     │   │   items: [...]  ───────────────────────────────────▶  Product details       │   │    │
│     │   │   pricing: {...}  ─────────────────────────────────▶  Costs & prices        │   │    │
│     │   │                                                                             │   │    │
│     │   └─────────────────────────────────────────────────────────────────────────────┘   │    │
│     │                                                                                      │    │
│     └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                   │                           │                           │                     │
│                   │                           │                           │                     │
│     ┌─────────────┼───────────────────────────┼───────────────────────────┼─────────────┐      │
│     │             │                           │                           │             │      │
│     │             ▼                           ▼                           ▼             │      │
│     │   ┌─────────────┐             ┌─────────────┐             ┌─────────────┐        │      │
│     │   │  INVOICES   │             │APPOINTMENTS │             │  SHIPMENTS  │        │      │
│     │   │             │             │             │             │             │        │      │
│     │   │ • Customer  │             │ Installation│             │ Tracking    │        │      │
│     │   │   (revenue) │             │ scheduled   │             │ info        │        │      │
│     │   │ • Manufact- │             │             │             │             │        │      │
│     │   │   urer (cost)│            │             │             │             │        │      │
│     │   └──────┬──────┘             └──────┬──────┘             └─────────────┘        │      │
│     │          │                           │                                           │      │
│     │          │                           │                                           │      │
│     │          ▼                           ▼                                           │      │
│     │   ┌─────────────┐             ┌─────────────┐                                    │      │
│     │   │  ACCOUNTS   │             │ TECHNICIAN  │                                    │      │
│     │   │             │             │             │                                    │      │
│     │   │ • AR (owed  │             │ Assigned to │                                    │      │
│     │   │   to us)    │             │ installation│                                    │      │
│     │   │ • AP (we    │             │             │                                    │      │
│     │   │   owe)      │             │             │                                    │      │
│     │   └─────────────┘             └─────────────┘                                    │      │
│     │                                                                                   │      │
│     │                          MANUFACTURER PORTAL                                      │      │
│     │                                                                                   │      │
│     │    ┌─────────────────────────────────────────────────────────────────────┐       │      │
│     │    │                                                                     │       │      │
│     │    │   PRODUCTION QUEUE                                                  │       │      │
│     │    │                                                                     │       │      │
│     │    │   order_received ──▶ manufacturing ──▶ qa ──▶ ready_to_ship ──▶ shipped │   │      │
│     │    │                                                                     │       │      │
│     │    │   Updates order status, adds tracking                               │       │      │
│     │    │                                                                     │       │      │
│     │    └─────────────────────────────────────────────────────────────────────┘       │      │
│     │                                                                                   │      │
│     └───────────────────────────────────────────────────────────────────────────────────┘      │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Complete Data Flow Example

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            COMPLETE ORDER LIFECYCLE EXAMPLE                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   STEP 1: CUSTOMER PLACES ORDER                                                                 │
│   ═════════════════════════════                                                                  │
│                                                                                                  │
│   Customer → signup.html → login.html → product.html → cart.html                                │
│                                                                                                  │
│   Creates:                                                                                       │
│   • customers[] record (if new)                                                                  │
│   • orders[] record (status: "pending")                                                          │
│   • invoices[] record (type: "customer", status: "pending")                                      │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 2: ADMIN PROCESSES PAYMENT                                                               │
│   ═══════════════════════════════                                                               │
│                                                                                                  │
│   Admin Panel → orders.html → Mark as Paid                                                      │
│                                                                                                  │
│   Updates:                                                                                       │
│   • orders[].status → "payment_received"                                                         │
│   • invoices[].status → "paid"                                                                   │
│   • customers[].totalOrders++                                                                    │
│   • customers[].totalSpent += order.total                                                        │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 3: ADMIN SENDS TO MANUFACTURER                                                           │
│   ══════════════════════════════════                                                            │
│                                                                                                  │
│   Admin Panel → orders.html → Send to Production                                                │
│                                                                                                  │
│   Updates:                                                                                       │
│   • orders[].status → "order_received"                                                           │
│   • orders[].manufacturerId → "mfr-default"                                                      │
│                                                                                                  │
│   Creates:                                                                                       │
│   • invoices[] (type: "manufacturer", status: "pending")                                         │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 4: MANUFACTURER PRODUCES                                                                 │
│   ═════════════════════════════                                                                  │
│                                                                                                  │
│   Manufacturer Portal → index.html → View Order → Update Status                                 │
│                                                                                                  │
│   Updates:                                                                                       │
│   • orders[].status → "manufacturing" → "qa" → "ready_to_ship"                                  │
│   • orderStatusHistory[] ← logs each change                                                      │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 5: MANUFACTURER SHIPS                                                                    │
│   ══════════════════════════                                                                    │
│                                                                                                  │
│   Manufacturer Portal → Add Tracking → Mark Shipped                                             │
│                                                                                                  │
│   Updates:                                                                                       │
│   • orders[].status → "shipped"                                                                  │
│   • orders[].shipping → {carrier: "UPS", trackingNumber: "1Z..."}                               │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 6: CUSTOMER SCHEDULES INSTALLATION                                                       │
│   ══════════════════════════════════════                                                        │
│                                                                                                  │
│   Customer → schedule-appointment.html                                                          │
│                                                                                                  │
│   Creates:                                                                                       │
│   • appointments[] (technicianId: assigned, orderId: linked)                                     │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 7: TECHNICIAN INSTALLS                                                                   │
│   ═══════════════════════════                                                                   │
│                                                                                                  │
│   Technician Portal → appointments.html → Complete Job                                          │
│                                                                                                  │
│   Updates:                                                                                       │
│   • appointments[].status → "completed"                                                          │
│                                                                                                  │
│   Creates:                                                                                       │
│   • installationPayments[] (technician earnings)                                                 │
│                                                                                                  │
│   ─────────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                  │
│   STEP 8: ORDER CLOSED                                                                          │
│   ════════════════════                                                                          │
│                                                                                                  │
│   Admin Panel → orders.html → Close Order                                                       │
│                                                                                                  │
│   Updates:                                                                                       │
│   • orders[].status → "closed"                                                                   │
│                                                                                                  │
│   Final State:                                                                                   │
│   • Customer invoice: PAID                                                                       │
│   • Manufacturer invoice: PENDING (pay within net30)                                             │
│   • Technician payment: PENDING (pay at end of week)                                             │
│   • Profit recorded in analytics                                                                 │
│                                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Portal | Collections | Key Links |
|--------|-------------|-----------|
| **Customer** | `customers` | → orders, invoices, appointments |
| **Dealer** | `dealers`, `dealerUsers`, `dealerOrders`, `dealerCustomers` | → orders (via dealerOrders), commissions |
| **Manufacturer** | `manufacturers`, `manufacturerUsers`, `manufacturerPrices` | → orders, invoices (type: manufacturer) |
| **Technician** | `technicians`, `appointments`, `installationPayments` | → orders (via appointments), customers |

All portals connect through the **ORDERS** table as the central hub.
