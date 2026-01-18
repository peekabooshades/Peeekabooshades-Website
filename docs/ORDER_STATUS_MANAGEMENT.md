# Order Status Management

> Admin Panel: `/admin/order-status.html`
> Location: Orders → Order Status Management

## Overview

The Order Status Management page allows administrators to configure and visualize the order workflow. It displays all order statuses, their counts (calculated from real orders), and the transitions between them.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PAGE LOAD                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Fetch orders from /api/admin/orders                         │
│  2. Fetch config from /api/admin/system-config                  │
│  3. Use custom statuses from config OR default statuses         │
│  4. Calculate counts per status from real order data            │
│  5. Render UI with statuses, workflow diagram, and transitions  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Default Order Statuses

These statuses are defined in `backend/services/order-service.js`:

| Status ID | Display Name | Color | Type | Triggers |
|-----------|--------------|-------|------|----------|
| `order_placed` | Order Placed | Yellow (#F59E0B) | pending | Email Customer |
| `order_received` | Order Received | Blue (#3B82F6) | processing | Email Customer, Email Admin |
| `manufacturing` | Manufacturing | Purple (#8B5CF6) | processing | - |
| `qa` | Quality Check | Pink (#EC4899) | processing | - |
| `shipped` | Shipped | Green (#10B981) | processing | Email Customer, SMS Customer |
| `delivered` | Delivered | Green (#10B981) | completed | Email Customer |
| `cancelled` | Cancelled | Red (#EF4444) | cancelled | Email Customer, Email Admin |
| `refunded` | Refunded | Red (#EF4444) | cancelled | Email Customer, Email Admin |

---

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Order Status Management                              [+ Add Status] │
├───────────────────────┬──────────────────────────────────────────────┤
│                       │                                              │
│  ORDER STATUSES       │  ORDER WORKFLOW                              │
│  (Sidebar)            │  (Visual Diagram)                            │
│                       │                                              │
│  ┌─────────────────┐  │  ┌─────────┐   ┌─────────┐   ┌─────────┐    │
│  │ 🟡 Order Placed │  │  │ Order   │ → │ Order   │ → │ Manu-   │    │
│  │            (0)  │  │  │ Placed  │   │ Received│   │ facture │    │
│  ├─────────────────┤  │  └─────────┘   └─────────┘   └─────────┘    │
│  │ 🔵 Order Recv'd │  │                                    ↓         │
│  │            (1)  │  │  ┌─────────┐   ┌─────────┐   ┌─────────┐    │
│  ├─────────────────┤  │  │Delivered│ ← │ Shipped │ ← │   QA    │    │
│  │ 🟣 Manufacturing│  │  └─────────┘   └─────────┘   └─────────┘    │
│  │            (0)  │  │                                              │
│  ├─────────────────┤  │──────────────────────────────────────────────│
│  │ 🟢 Shipped      │  │  STATUS TRANSITIONS                          │
│  │            (2)  │  │                                              │
│  ├─────────────────┤  │  Order Placed → Order Received               │
│  │ 🟢 Delivered    │  │    📧 Email Customer  📧 Email Admin         │
│  │            (0)  │  │                                              │
│  ├─────────────────┤  │  Order Received → Manufacturing              │
│  │ 🔴 Cancelled    │  │    (no triggers)                             │
│  │            (0)  │  │                                              │
│  └─────────────────┘  │  Shipped → Delivered                         │
│                       │    📧 Email Customer                         │
│  [+ Add Status]       │                                              │
│                       │                                              │
└───────────────────────┴──────────────────────────────────────────────┘
```

---

## Features

### 1. View Statuses
- Lists all order statuses with color-coded badges
- Shows real-time order count per status (from actual orders in database)
- Drag-and-drop to reorder (visual only)

### 2. Add Status
Click **"+ Add Status"** to create a new custom status:
- **Name**: Display name (e.g., "Awaiting Parts")
- **Color**: Choose from 8 predefined colors
- **Type**: pending, processing, completed, or cancelled
- **Triggers**: Select notification actions
- **Description**: Optional notes for staff

### 3. Edit Status
Click the ✏️ button on any status to modify its properties.

### 4. Delete Status
Click the 🗑️ button to remove a status from the workflow.

### 5. Workflow Diagram
Visual representation of order progression (excludes cancelled statuses).

### 6. Transitions
Shows what notifications fire when orders move between statuses.

---

## Status Types

| Type | Purpose | Behavior |
|------|---------|----------|
| `pending` | Waiting for action | Shows as warning/yellow |
| `processing` | Work in progress | Shows as info/blue or purple |
| `completed` | Successfully finished | Shows as success/green |
| `cancelled` | Order terminated | Shows as error/red |

---

## Trigger Options

| Trigger | Description |
|---------|-------------|
| `email_customer` | Send email notification to customer |
| `email_admin` | Send email notification to admin |
| `sms_customer` | Send SMS to customer's phone |
| `webhook` | Trigger external webhook URL |

---

## API Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Load orders (for counts) | GET | `/api/admin/orders` |
| Load system config | GET | `/api/admin/system-config` |
| Save custom statuses | PUT | `/api/admin/system-config/order-statuses` |

---

## How Counts Are Calculated

```javascript
// Real-time calculation from actual orders
statuses = statuses.map(status => ({
  ...status,
  count: orders.filter(o => o.status === status.id).length
}));
```

**Example with 3 orders:**
- `order_received`: 1 (ORD-MKA9J78E)
- `shipped`: 2 (ORD-MKEUZVG5, ORD-MKA1VL9O)
- All others: 0

---

## Valid State Transitions

Defined in `backend/services/order-service.js`:

```javascript
const VALID_TRANSITIONS = {
  'draft':            ['cart', 'cancelled'],
  'cart':             ['order_placed', 'cancelled'],
  'order_placed':     ['order_received', 'cancelled'],
  'order_received':   ['manufacturing', 'refund_requested'],
  'manufacturing':    ['qa', 'issue_reported'],
  'qa':               ['shipped', 'manufacturing', 'issue_reported'],
  'shipped':          ['delivered', 'issue_reported'],
  'delivered':        ['issue_reported', 'refund_requested'],
  'issue_reported':   ['refund_requested', 'manufacturing', 'cancelled'],
  'refund_requested': ['refunded', 'cancelled'],
  'refunded':         [],  // Terminal state
  'cancelled':        []   // Terminal state
};
```

---

## File Locations

| File | Purpose |
|------|---------|
| `frontend/public/admin/order-status.html` | UI page |
| `backend/services/order-service.js` | ORDER_STATES & VALID_TRANSITIONS |
| `backend/config/system-config.js` | Default configuration |
| `backend/database.json` | Stores custom orderStatuses in systemConfig |

---

## Usage Example

### Scenario: Add "Awaiting Parts" Status

1. Navigate to `/admin/order-status.html`
2. Click **"+ Add Status"**
3. Fill in:
   - Name: `Awaiting Parts`
   - Color: Purple
   - Type: `processing`
   - Triggers: Email Admin
   - Description: "Order waiting for materials from supplier"
4. Click **"Save Status"**
5. The new status appears in the sidebar and workflow diagram

---

## Related Pages

| Page | URL | Purpose |
|------|-----|---------|
| All Orders | `/admin/orders.html` | View and manage orders |
| Create Order | `/admin/create-order.html` | Create new order |
| Tracking | `/admin/tracking.html` | Shipment tracking |
| Production Queue | `/admin/production-queue.html` | Manufacturing queue |
