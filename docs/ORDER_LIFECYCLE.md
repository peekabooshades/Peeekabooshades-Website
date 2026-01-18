# ORDER LIFECYCLE - State Machine Documentation
## Peekaboo Shades Order Management

**Version:** 2.0 (Phase 0 Audit)
**Source:** `backend/services/order-service.js`, `backend/services/manufacturer-service.js`

---

## 1. ORDER STATES

### 1.1 All Valid States

| State | Description | Owner | Action Required |
|-------|-------------|-------|-----------------|
| `draft` | Item being configured | Customer | Complete configuration |
| `cart` | In shopping cart | Customer | Proceed to checkout |
| `order_placed` | Checkout completed | System | Await payment confirmation |
| `order_received` | Payment confirmed | Admin | Send to manufacturing |
| `manufacturing` | In production | Manufacturer | Complete production |
| `qa` | Quality check | Manufacturer | Pass or fail QA |
| `shipped` | In transit | Manufacturer | Track delivery |
| `delivered` | Customer received | System | Order complete |
| `issue_reported` | Problem reported | Customer/Admin | Resolve issue |
| `refund_requested` | Refund requested | Customer | Process refund |
| `refunded` | Refund completed | Admin | Terminal state |
| `cancelled` | Order cancelled | Admin/Customer | Terminal state |

### 1.2 Terminal States (No further transitions)
- `refunded`
- `cancelled`

---

## 2. STATE TRANSITION RULES

### 2.1 Full Transition Matrix

```
FROM STATE          → ALLOWED NEXT STATES
─────────────────────────────────────────────────────
draft               → cart, cancelled
cart                → order_placed, cancelled
order_placed        → order_received, cancelled
order_received      → manufacturing, refund_requested
manufacturing       → qa, issue_reported
qa                  → shipped, manufacturing, issue_reported
shipped             → delivered, issue_reported
delivered           → issue_reported, refund_requested
issue_reported      → refund_requested, manufacturing, cancelled
refund_requested    → refunded, cancelled
refunded            → (none - terminal)
cancelled           → (none - terminal)
```

### 2.2 Code Implementation

```javascript
// Source: backend/services/order-service.js:30-43

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
  'refunded': [],
  'cancelled': []
};
```

---

## 3. MANUFACTURER TRANSITIONS

Manufacturers have a LIMITED subset of transitions they can perform.

### 3.1 Manufacturer-Allowed Transitions

```javascript
// Source: backend/services/manufacturer-service.js:23-28

const MFR_VALID_TRANSITIONS = {
  'order_received': ['manufacturing'],   // Start production
  'manufacturing': ['qa'],                // Send to QA
  'qa': ['shipped', 'manufacturing'],     // Ship or rework
  'shipped': []                           // Cannot change after ship
};
```

### 3.2 Manufacturer Actions by State

| Current State | Manufacturer Can... | Admin Must... |
|---------------|--------------------|--------------|
| `order_received` | Start manufacturing | Nothing |
| `manufacturing` | Move to QA | Nothing |
| `qa` | Ship OR send back to manufacturing | Nothing |
| `shipped` | Add tracking, update shipping cost | Nothing |
| `delivered` | Nothing | Auto-updated by system |

---

## 4. VISUAL FLOW DIAGRAM

```
                              CUSTOMER FLOW
┌─────────┐    ┌─────────┐    ┌─────────────┐
│  draft  │───▶│  cart   │───▶│order_placed │
└─────────┘    └─────────┘    └──────┬──────┘
     │              │                │
     └──────────────┴───────┐        │
                            ▼        ▼
                      ┌──────────────────┐
                      │    cancelled     │
                      └──────────────────┘


                         OPERATIONS FLOW
                      ┌─────────────────┐
                      │ order_received  │ ◀─── Payment Confirmed
                      └────────┬────────┘
                               │
                     ┌─────────┴──────────┐
                     ▼                    ▼
             ┌──────────────┐    ┌────────────────┐
             │manufacturing │    │refund_requested│
             └───────┬──────┘    └────────┬───────┘
                     │                    │
                     ▼                    ▼
             ┌──────────────┐    ┌────────────────┐
             │      qa      │    │    refunded    │
             └───────┬──────┘    └────────────────┘
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
   ┌──────────┐  ┌──────────┐  ┌───────────────┐
   │ shipped  │  │(rework)  │  │issue_reported │
   └────┬─────┘  └──────────┘  └───────────────┘
        │
        ▼
   ┌──────────┐
   │delivered │
   └──────────┘


                         EXCEPTION FLOW
              ┌───────────────────────────────┐
              │       issue_reported          │
              └───────────────┬───────────────┘
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
           ┌──────────┐ ┌──────────┐ ┌───────────┐
           │refund_req│ │(rework)  │ │ cancelled │
           └──────────┘ └──────────┘ └───────────┘
```

---

## 5. API ENDPOINTS FOR STATUS CHANGES

### 5.1 Admin Status Update

```
PUT /api/admin/orders/:id/status
Authorization: Bearer <admin_jwt>
Body: { "status": "manufacturing" }

Response:
{
  "success": true,
  "data": {
    "id": "...",
    "status": "manufacturing",
    "statusHistory": [
      { "from": "order_received", "to": "manufacturing", "at": "...", "by": "admin@..." }
    ]
  }
}
```

### 5.2 Manufacturer Status Update

```
POST /api/manufacturer/orders/:orderId/status
Authorization: Bearer <manufacturer_jwt>
Body: { "status": "qa" }

Response:
{
  "success": true,
  "data": { "orderId": "...", "status": "qa" }
}
```

### 5.3 Manufacturer Shipping Update

```
POST /api/manufacturer/orders/:orderId/shipping
Authorization: Bearer <manufacturer_jwt>
Body: { "shippingCost": 25.00 }

POST /api/manufacturer/orders/:orderId/tracking
Authorization: Bearer <manufacturer_jwt>
Body: { "carrier": "FedEx", "trackingNumber": "1234567890" }
```

---

## 6. STATUS CHANGE AUDITING

All status changes are logged to `orderStatusHistory` collection:

```javascript
{
  "id": "uuid",
  "orderId": "order-uuid",
  "fromStatus": "manufacturing",
  "toStatus": "qa",
  "changedBy": "manufacturer@example.com",
  "changedByType": "manufacturer",  // or "admin", "system"
  "reason": "Optional reason text",
  "timestamp": "2026-01-11T18:00:00.000Z"
}
```

---

## 7. LEDGER ENTRIES BY STATUS

| Status Transition | Ledger Entry Created |
|-------------------|---------------------|
| `order_placed` → `order_received` | `customer_payment_received` |
| `order_received` → `manufacturing` | `manufacturer_payable` |
| `shipped` → `delivered` | None (update only) |
| `*` → `refunded` | `refund_paid` |
| `*` → `cancelled` | Possible reversal entries |

---

## 8. INVOICE GENERATION

Invoices are auto-generated when order is placed:

```javascript
// Source: backend/services/invoice-service.js

// On order creation:
// 1. Invoice number generated: INV-[timestamp][random]
// 2. Type set to 'customer'
// 3. Status based on payment:
//    - payment.status === 'completed' → 'paid'
//    - else → 'draft'
// 4. Tax preserved from checkout calculation
```

---

## 9. FUTURE: AUTO DELIVERY UPDATE

**Current State:** Not implemented

**Proposed Implementation:**
1. Polling job runs every 4 hours
2. For orders with `status: 'shipped'` and tracking number
3. Check if > 7 days since ship date
4. Auto-transition to `delivered` if no tracking API available
5. OR integrate with carrier API for real tracking

---

## 10. VALIDATION RULES

### 10.1 Before Status Change

1. Check current status is valid
2. Check target status is allowed transition
3. Check user has permission (admin vs manufacturer)
4. Log the transition attempt

### 10.2 After Status Change

1. Update `order.status`
2. Add entry to `orderStatusHistory`
3. Create ledger entries if applicable
4. Send WebSocket notification
5. Update related records (invoice status, etc.)

---

## APPENDIX: Status Color Coding

| Status | Color | Badge Class |
|--------|-------|-------------|
| `draft` | Gray | `badge-secondary` |
| `cart` | Gray | `badge-secondary` |
| `order_placed` | Blue | `badge-info` |
| `order_received` | Blue | `badge-primary` |
| `manufacturing` | Yellow | `badge-warning` |
| `qa` | Yellow | `badge-warning` |
| `shipped` | Purple | `badge-info` |
| `delivered` | Green | `badge-success` |
| `issue_reported` | Red | `badge-danger` |
| `refund_requested` | Orange | `badge-warning` |
| `refunded` | Gray | `badge-secondary` |
| `cancelled` | Gray | `badge-secondary` |
