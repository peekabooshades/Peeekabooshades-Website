# Production Queue & Manufacturer Portal System Documentation

**Last Updated:** January 18, 2026
**Version:** 2.0.0

This document provides comprehensive documentation for the Production Queue (Admin) and Manufacturer Portal systems, including all UI elements, their functions, and the backend APIs that power them.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Order Status Workflow](#order-status-workflow)
3. [Production Queue (Admin)](#production-queue-admin)
   - [UI Components](#production-queue-ui-components)
   - [JavaScript Functions](#production-queue-javascript-functions)
4. [Manufacturer Portal](#manufacturer-portal)
   - [UI Components](#manufacturer-portal-ui-components)
   - [JavaScript Functions](#manufacturer-portal-javascript-functions)
5. [Backend APIs](#backend-apis)
6. [Database Schema](#database-schema)
7. [File References](#file-references)

---

## System Overview

The Production Queue and Manufacturer Portal are two interconnected systems that manage order fulfillment:

| System | URL | Purpose | Users |
|--------|-----|---------|-------|
| Production Queue | `/admin/production-queue.html` | Admin view of all orders in production pipeline | Admin staff |
| Manufacturer Portal | `/manufacturer/index.html` | Manufacturer view to manage production & shipping | Manufacturer staff |

Both systems share the same order status workflow and data, ensuring consistency across the platform.

---

## Order Status Workflow

Orders flow through 5 production statuses:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Order Received │ -> │  Manufacturing  │ -> │       QA        │ -> │  Ready to Ship  │ -> │     Shipped     │
│  (order_received)│    │ (manufacturing) │    │      (qa)       │    │(ready_to_ship)  │    │    (shipped)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Status Definitions

| Status | Key | Description | Color Code |
|--------|-----|-------------|------------|
| Order Received | `order_received` | Order is received and ready for manufacturing | Blue `#3b82f6` |
| Manufacturing | `manufacturing` | Order is being manufactured | Amber `#f59e0b` |
| Quality Assurance | `qa` | Order is undergoing quality checks | Purple `#8b5cf6` |
| Ready to Ship | `ready_to_ship` | Order passed QA and is ready for shipping | Cyan `#06b6d4` |
| Shipped | `shipped` | Order has been shipped to customer | Green `#10b981` |

### Valid Status Transitions

```javascript
const MFR_VALID_TRANSITIONS = {
  'order_received': ['manufacturing'],           // Can only move to manufacturing
  'manufacturing': ['qa'],                       // Can only move to QA
  'qa': ['ready_to_ship', 'manufacturing'],      // Can move to ready or back to manufacturing
  'ready_to_ship': ['shipped', 'qa'],            // Can ship or send back to QA
  'shipped': []                                  // Terminal state - no further transitions
};
```

---

## Production Queue (Admin)

**File:** `/frontend/public/admin/production-queue.html`
**URL:** `http://localhost:3001/admin/production-queue.html`

### Production Queue UI Components

#### 1. Header Section
```
┌──────────────────────────────────────────────────────────────────────┐
│ Dashboard / Production Queue                    [Export Queue] [Logout] │
└──────────────────────────────────────────────────────────────────────┘
```

| Element | Function |
|---------|----------|
| Breadcrumb | Navigation path showing current location |
| Export Queue Button | Downloads production queue as CSV file |
| Logout Button | Logs out admin user |

#### 2. Statistics Cards
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   Order     │Manufacturing│     QA      │  Ready to   │   Shipped   │
│  Received   │             │             │    Ship     │             │
│     3       │      2      │      1      │      0      │      3      │
│  5 items    │  4 items    │  2 items    │  0 items    │  6 items    │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

| Stat Card | ID | CSS Class | Description |
|-----------|----|-----------| ------------|
| Order Received | `stat-received` | `.stat-card.received` | Count of orders waiting to start |
| Manufacturing | `stat-manufacturing` | `.stat-card.manufacturing` | Count of orders in production |
| Quality Assurance | `stat-qa` | `.stat-card.qa` | Count of orders in QA |
| Ready to Ship | `stat-ready` | `.stat-card.ready` | Count of orders ready for shipping |
| Shipped | `stat-shipped` | `.stat-card.shipped` | Count of shipped orders |

#### 3. View Toggle & Filters
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Kanban] [Table]     🔍 Search orders...  [All Products ▼] [Refresh] │
└──────────────────────────────────────────────────────────────────────┘
```

| Element | ID/Class | Function |
|---------|----------|----------|
| Kanban Button | `.view-btn[data-view="kanban"]` | Switch to Kanban board view |
| Table Button | `.view-btn[data-view="table"]` | Switch to table list view |
| Search Input | `#search-input` | Filter orders by order number or customer name |
| Product Filter | `#product-type-filter` | Filter by product type (Roller, Zebra, Honeycomb, Roman) |
| Refresh Button | N/A | Reload production queue data |

#### 4. Kanban View
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│Order Received│Manufacturing│     QA      │Ready to Ship│   Shipped   │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │ #ORD123 │ │ │ #ORD456 │ │ │ #ORD789 │ │ │         │ │ │ #ORD111 │ │
│ │ John D. │ │ │ Jane S. │ │ │ Bob M.  │ │ │  Empty  │ │ │ Alice W.│ │
│ │ 36"x48" │ │ │ 24"x36" │ │ │ 48"x72" │ │ │         │ │ │ ✓ Done  │ │
│ │ $245.00 │ │ │ $189.00 │ │ │ $425.00 │ │ │         │ │ │ $312.00 │ │
│ │[View][→]│ │ │[View][→]│ │ │[View][→]│ │ │         │ │ │ [View]  │ │
│ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

| Column | ID | CSS Class | Purpose |
|--------|----|-----------| --------|
| Order Received | `column-received` | `.kanban-header.received` | Orders waiting to start |
| Manufacturing | `column-manufacturing` | `.kanban-header.manufacturing` | Orders in production |
| QA | `column-qa` | `.kanban-header.qa` | Orders being quality checked |
| Ready to Ship | `column-ready` | `.kanban-header.ready` | Orders ready for shipping |
| Shipped | `column-shipped` | `.kanban-header.shipped` | Completed shipped orders |

##### Kanban Card Elements
```
┌─────────────────────────────┐
│ #ORD-ABC123        2d ago   │  <- Order number & days in queue
│ John Doe                    │  <- Customer name
│ [36"x48"] [24"x36"]        │  <- Item size badges
├─────────────────────────────┤
│ $425.00      [View] [Next→] │  <- Total & action buttons
└─────────────────────────────┘
```

| Element | CSS Class | Function |
|---------|-----------|----------|
| Order Number | `.kanban-order-number` | Links to order details |
| Date Badge | `.kanban-date` | Shows days since order placed |
| Customer Name | `.kanban-customer` | Customer who placed order |
| Item Badges | `.kanban-item-badge` | Size dimensions of each item |
| Total | `.kanban-total` | Order total price |
| View Button | `.kanban-action-btn.view` | Opens order detail modal |
| Next Button | `.kanban-action-btn.next` | Moves order to next status |

##### Item Badge Colors by Product Type
| Product Type | CSS Class | Background | Text Color |
|--------------|-----------|------------|------------|
| Roller | `.kanban-item-badge.roller` | `#dbeafe` | `#1e40af` |
| Zebra | `.kanban-item-badge.zebra` | `#fef3c7` | `#92400e` |
| Honeycomb | `.kanban-item-badge.honeycomb` | `#d1fae5` | `#065f46` |
| Roman | `.kanban-item-badge.roman` | `#fce7f3` | `#9d174d` |

#### 5. Table View
```
┌────────┬────────────┬──────────┬─────────────┬───────┬────────────────┬──────────┬─────────┐
│Order # │ Date       │ Customer │ Product Type│ Items │ Status         │ Days     │ Actions │
├────────┼────────────┼──────────┼─────────────┼───────┼────────────────┼──────────┼─────────┤
│#ORD123 │ Jan 15     │ John D.  │ [Roller]    │ 2     │ [Manufacturing]│ 3 days   │ [👁][→] │
│#ORD456 │ Jan 14     │ Jane S.  │ [Zebra]     │ 1     │ [QA]           │ 4 days   │ [👁][→] │
│#ORD789 │ Jan 10     │ Bob M.   │ [Honeycomb] │ 3     │ [Shipped]      │ 8 days   │ [👁] ✓  │
└────────┴────────────┴──────────┴─────────────┴───────┴────────────────┴──────────┴─────────┘
```

| Column | Function |
|--------|----------|
| Order # | Order number with link to details |
| Date | Order creation date |
| Customer | Customer name |
| Product Type | Badge showing product type (Roller, Zebra, etc.) |
| Items | Number of line items in order |
| Status | Current production status badge |
| Days | Days in production queue (color coded: green <3, yellow 3-5, red >5) |
| Actions | View details button, Move to next status button |

#### 6. Order Detail Modal
```
┌──────────────────────────────────────────────────────────────────────┐
│                    Production Details                           [X]  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Order #ORD-ABC123                              [3 days in queue] │ │
│ │ John Doe • Jan 15, 2026 10:30 AM                                 │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ Production Items                                                     │
│ ┌────┬────────┬───────────┬────────┬─────┬─────────────────────────┐│
│ │ #  │ Room   │ Size      │ Fabric │ Qty │ Options                 ││
│ ├────┼────────┼───────────┼────────┼─────┼─────────────────────────┤│
│ │ 1  │ Living │ 36" × 48" │ FAB001 │ 2   │ Chain Left Inside Mount ││
│ │ 2  │ Bedroom│ 24" × 36" │ FAB002 │ 1   │ Motorized Outside Mount ││
│ └────┴────────┴───────────┴────────┴─────┴─────────────────────────┘│
│                                                                      │
│                    [Move to Manufacturing →] [View Full Order]       │
└──────────────────────────────────────────────────────────────────────┘
```

| Element | ID | Function |
|---------|----| ---------|
| Modal Container | `#order-modal` | Modal overlay container |
| Content Area | `#order-detail-content` | Dynamic content area |
| Close Button | Modal header X | Closes modal |
| Move Button | Dynamic | Moves order to next status |
| View Full Order | Link | Opens full order in orders page |

### Production Queue JavaScript Functions

| Function | Purpose | API Called |
|----------|---------|------------|
| `loadProductionQueue()` | Fetches all orders for 5 statuses | `GET /api/admin/orders?status={status}` |
| `updateStats()` | Updates stat cards with counts | N/A (uses cached data) |
| `switchView(view)` | Toggles between kanban and table views | N/A |
| `renderKanbanView()` | Renders orders in kanban columns | N/A |
| `renderTableView()` | Renders orders in table format | N/A |
| `getProductType(order)` | Detects product type from order items | N/A |
| `getDaysInQueue(order)` | Calculates days since order placed | N/A |
| `filterOrders()` | Filters orders by search/product type | N/A |
| `moveToNextStage(orderId, nextStatus)` | Updates order status | `PUT /api/admin/orders/{id}/status` |
| `viewOrderDetails(orderId)` | Opens order detail modal | `GET /api/admin/orders/{id}` |
| `exportProductionList()` | Exports queue as CSV | N/A (client-side) |

### Product Type Detection Logic

```javascript
function getProductType(order) {
  // Priority order for detection:
  // 1. item.product_type (direct field)
  // 2. item.product_slug (contains product name)
  // 3. item.product_name (product name field)
  // 4. item.configuration (JSON config with product info)

  // Searches for keywords: zebra, honeycomb, roman, roller, blind
  // Returns: 'roller', 'zebra', 'honeycomb', 'roman', 'mixed', or default 'roller'
}
```

---

## Manufacturer Portal

**File:** `/frontend/public/manufacturer/index.html`
**URL:** `http://localhost:3001/manufacturer/index.html`
**Login:** `http://localhost:3001/manufacturer/login.html`

### Authentication

| Field | Value |
|-------|-------|
| Email | `manufacturer@peekaboo.com` |
| Password | `manufacturer123` |
| Token Storage | `localStorage.mfrToken` |
| User Storage | `localStorage.mfrUser` |

### Manufacturer Portal UI Components

#### 1. Header
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Logo] Manufacturer Portal              [M] Manufacturer   [Logout]  │
└──────────────────────────────────────────────────────────────────────┘
```

| Element | CSS Class | Function |
|---------|-----------|----------|
| Logo | `.mfr-header img` | Peekaboo Shades logo |
| Title | `.mfr-header h1` | "Manufacturer Portal" |
| User Info | `.mfr-user` | Shows logged in user |
| Logout Button | `.btn-logout` | Logs out and redirects to login |

#### 2. Statistics Grid
```
┌──────────┬───────────┬──────────┬───────────┬──────────┬─────────────┐
│ Pending  │ In Prod.  │  In QA   │Ready Ship │ Shipped  │Active Orders│
│    3     │     2     │    1     │     0     │    3     │      6      │
└──────────┴───────────┴──────────┴───────────┴──────────┴─────────────┘
```

| Stat Card | ID | CSS Class | API Field |
|-----------|----|-----------| ----------|
| Pending | `stat-pending` | `.stat-card.pending` | `data.pending` |
| In Production | `stat-production` | `.stat-card.production` | `data.inProduction` |
| In QA | `stat-qa` | `.stat-card.qa` | `data.inQA` |
| Ready to Ship | `stat-ready` | `.stat-card.ready` | `data.readyToShip` |
| Shipped | `stat-shipped` | `.stat-card.shipped` | `data.shipped` |
| Active Orders | `stat-total` | `.stat-card.total` | `data.totalActive` |

#### 3. Tab Navigation
```
┌─────────────────────────────────────────────────────────────────────┐
│ [All Orders] [Pending] [In Production] [Quality Check] [Ready to Ship] [Shipped] │
└─────────────────────────────────────────────────────────────────────┘
```

| Tab | `data-tab` | Filters Orders By |
|-----|------------|-------------------|
| All Orders | `all` | No filter - shows all |
| Pending | `order_received` | Status = order_received |
| In Production | `manufacturing` | Status = manufacturing |
| Quality Check | `qa` | Status = qa |
| Ready to Ship | `ready_to_ship` | Status = ready_to_ship |
| Shipped | `shipped` | Status = shipped |

#### 4. Orders Table
```
┌─────────┬──────────┬─────────┬───────┬────────────────┬──────────┬─────────┐
│ Order # │ Customer │ Product │ Items │ Status         │ Date     │ Actions │
├─────────┼──────────┼─────────┼───────┼────────────────┼──────────┼─────────┤
│ ORD-123 │ John Doe │ Roller  │ 2     │ [In Production]│ Jan 15   │ [View]  │
│ ORD-456 │ Jane S.  │ Zebra   │ 1     │ [Ready to Ship]│ Jan 14   │ [View]  │
└─────────┴──────────┴─────────┴───────┴────────────────┴──────────┴─────────┘
```

| Column | Data Source | Function |
|--------|-------------|----------|
| Order # | `order.orderNumber` | Order identifier |
| Customer | `order.customer` | Customer name |
| Product | Detected from items | Product type |
| Items | `order.itemCount` | Number of line items |
| Status | `order.status` | Status badge with color |
| Date | `order.createdAt` | Order creation date |
| Actions | N/A | View button to open details |

##### Status Badge Colors
| Status | CSS Class | Background | Text Color |
|--------|-----------|------------|------------|
| Pending | `.status-badge.order_received` | `#fef3c7` | `#92400e` |
| In Production | `.status-badge.manufacturing` | `#dbeafe` | `#1e40af` |
| Quality Check | `.status-badge.qa` | `#ede9fe` | `#5b21b6` |
| Ready to Ship | `.status-badge.ready_to_ship` | `#cffafe` | `#0e7490` |
| Shipped | `.status-badge.shipped` | `#d1fae5` | `#065f46` |

#### 5. Order Detail Sidebar
When clicking "View" on an order, a detailed sidebar opens:

```
┌──────────────────────────────────────────────────────────────┐
│ Order ORD-ABC123                                        [X]  │
├──────────────────────────────────────────────────────────────┤
│ Status: [In Production]                                      │
│                                                              │
│ Customer Information                                         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Name:  John Doe                                          ││
│ │ Email: john@example.com                                  ││
│ │ Phone: (555) 123-4567                                    ││
│ │ Address: 123 Main St, City, ST 12345                     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Order Items                                                  │
│ ┌────┬────────┬───────────┬────────┬─────┬────────────────┐ │
│ │ #  │ Room   │ Size      │ Fabric │ Qty │ Options        │ │
│ ├────┼────────┼───────────┼────────┼─────┼────────────────┤ │
│ │ 1  │ Living │ 36" × 48" │ FAB001 │ 2   │ Chain, Inside  │ │
│ │ 2  │ Bedroom│ 24" × 36" │ FAB002 │ 1   │ Motor, Outside │ │
│ └────┴────────┴───────────┴────────┴─────┴────────────────┘ │
│                                                              │
│ Shipping Information                                         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Shipping Cost: $________                                 ││
│ │ Carrier:       [FedEx ▼]                                 ││
│ │ Tracking #:    ________________                          ││
│ │ Est. Delivery: [Date Picker]                             ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Status Actions                                               │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ [Back to QA]              [Mark as Shipped]              ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Status History                                               │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Jan 15 10:00 - Order Received                            ││
│ │ Jan 15 14:30 - Started Manufacturing                     ││
│ │ Jan 16 09:00 - Moved to QA                               ││
│ │ Jan 16 15:00 - Ready to Ship                             ││
│ └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

##### Status Action Buttons by Current Status

| Current Status | Available Actions | Button Styles |
|----------------|-------------------|---------------|
| `order_received` | Start Production | Green primary button |
| `manufacturing` | Move to QA | Purple button |
| `qa` | Back to Production, Ready to Ship | Secondary, Cyan button |
| `ready_to_ship` | Back to QA, Mark as Shipped | Secondary, Green button |
| `shipped` | None (shows "Order has been shipped") | Green text |

### Manufacturer Portal JavaScript Functions

| Function | Purpose | API Called |
|----------|---------|------------|
| `api(endpoint, options)` | Wrapper for authenticated API calls | Various |
| `loadStats()` | Loads dashboard statistics | `GET /api/manufacturer/stats` |
| `loadOrders()` | Fetches orders list | `GET /api/manufacturer/orders` |
| `openOrderDetail(orderId)` | Opens order detail sidebar | `GET /api/manufacturer/orders/{id}` |
| `updateStatus(newStatus, notes)` | Updates order status | `POST /api/manufacturer/orders/{id}/status` |
| `shipOrder()` | Marks order as shipped with tracking | `POST /api/manufacturer/orders/{id}/shipping`, `POST /api/manufacturer/orders/{id}/tracking`, then status update |
| `getStatusLabel(status)` | Returns human-readable status label | N/A |
| `getStatusActions(status)` | Returns action buttons HTML | N/A |
| `showToast(message, type)` | Shows notification toast | N/A |

### Authentication Flow

```javascript
// On page load:
1. Check localStorage for mfrToken and mfrUser
2. If missing, redirect to /manufacturer/login.html
3. If present, load stats and orders

// On 401 response:
1. Clear localStorage (mfrToken, mfrUser)
2. Redirect to login page
3. Show "Session expired" message

// On logout:
1. Clear localStorage
2. Redirect to login page
```

---

## Backend APIs

### Manufacturer Authentication APIs

#### POST `/api/manufacturer/login`
Authenticates manufacturer user.

**Request:**
```json
{
  "email": "manufacturer@peekaboo.com",
  "password": "manufacturer123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "mfr-user-abc123",
    "manufacturerId": "mfr-001",
    "manufacturerName": "Default Manufacturer",
    "name": "Manufacturer Admin",
    "email": "manufacturer@peekaboo.com",
    "role": "admin"
  }
}
```

### Manufacturer Dashboard APIs

#### GET `/api/manufacturer/stats`
Returns dashboard statistics.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": 3,
    "inProduction": 2,
    "inQA": 1,
    "readyToShip": 0,
    "shipped": 3,
    "totalActive": 6
  }
}
```

#### GET `/api/manufacturer/orders`
Returns list of orders for manufacturer.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `orderNumber` | string | Search by order number |
| `startDate` | date | Filter orders after date |
| `endDate` | date | Filter orders before date |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-123",
      "orderNumber": "ORD-ABC123",
      "status": "manufacturing",
      "customer": "John Doe",
      "itemCount": 2,
      "items": [...],
      "createdAt": "2026-01-15T10:30:00Z",
      "shippingAddress": {...}
    }
  ],
  "total": 6
}
```

#### GET `/api/manufacturer/orders/:id`
Returns detailed order information.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "orderNumber": "ORD-ABC123",
    "status": "manufacturing",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "(555) 123-4567",
      "address": "123 Main St, City, ST 12345"
    },
    "items": [
      {
        "id": "item-1",
        "productName": "Roller Blinds",
        "fabricCode": "FAB001",
        "width": 36,
        "height": 48,
        "quantity": 2,
        "configuration": {...},
        "roomLabel": "Living Room"
      }
    ],
    "pricing": {
      "subtotal": 425.00,
      "tax": 34.00,
      "total": 459.00,
      "manufacturerCost": 275.00
    },
    "statusHistory": [...],
    "trackingInfo": {...}
  }
}
```

#### POST `/api/manufacturer/orders/:id/status`
Updates order status.

**Headers:** `Authorization: Bearer {token}`

**Request:**
```json
{
  "status": "qa",
  "notes": "Moved to quality assurance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Status updated successfully"
}
```

#### POST `/api/manufacturer/orders/:id/shipping`
Updates shipping cost.

**Headers:** `Authorization: Bearer {token}`

**Request:**
```json
{
  "shippingCost": 25.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipping cost updated"
}
```

#### POST `/api/manufacturer/orders/:id/tracking`
Adds tracking information.

**Headers:** `Authorization: Bearer {token}`

**Request:**
```json
{
  "carrier": "FedEx",
  "trackingNumber": "1234567890",
  "estimatedDelivery": "2026-01-20"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tracking info added"
}
```

### Admin Order APIs (Used by Production Queue)

#### GET `/api/admin/orders`
Returns orders with optional status filter.

**Headers:** `Authorization: Bearer {adminToken}`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Max results (default 100) |

**Response:**
```json
{
  "success": true,
  "orders": [...],
  "total": 10
}
```

#### GET `/api/admin/orders/:id`
Returns single order details.

**Headers:** `Authorization: Bearer {adminToken}`

**Response:**
```json
{
  "success": true,
  "order": {...}
}
```

#### PUT `/api/admin/orders/:id/status`
Updates order status (via Admin.OrdersAPI.updateStatus).

**Headers:** `Authorization: Bearer {adminToken}`

**Request:**
```json
{
  "status": "manufacturing"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order status updated"
}
```

---

## Database Schema

### Orders Collection
```javascript
{
  "id": "order-uuid",
  "order_number": "ORD-ABC123",
  "status": "manufacturing",  // order_received, manufacturing, qa, ready_to_ship, shipped
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "(555) 123-4567",
  "shipping_address": "123 Main St, City, ST 12345",
  "items": [
    {
      "id": "item-uuid",
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
        "controlType": "Chain",
        "controlSide": "Left",
        "mountType": "Inside Mount",
        "motorBrand": null
      },
      "price_breakdown": {...}
    }
  ],
  "pricing": {
    "subtotal": 425.00,
    "tax": 34.00,
    "shipping": 25.00,
    "total": 484.00,
    "manufacturer_cost_total": 275.00
  },
  "shipping": {
    "carrier": "FedEx",
    "trackingNumber": "1234567890",
    "estimatedDelivery": "2026-01-20",
    "cost": 25.00
  },
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-16T15:00:00Z",
  "production_started_at": "2026-01-15T14:30:00Z",
  "qa_started_at": "2026-01-16T09:00:00Z",
  "ready_to_ship_at": "2026-01-16T15:00:00Z",
  "shipped_at": null
}
```

### Order Status History Collection
```javascript
{
  "id": "history-uuid",
  "orderId": "order-uuid",
  "orderNumber": "ORD-ABC123",
  "fromStatus": "manufacturing",
  "toStatus": "qa",
  "changedBy": "mfr-user-001",
  "changedByType": "manufacturer",
  "changedAt": "2026-01-16T09:00:00Z",
  "reason": "Moved to quality assurance",
  "manufacturerId": "mfr-001"
}
```

### Manufacturer Users Collection
```javascript
{
  "id": "mfr-user-001",
  "manufacturerId": "mfr-001",
  "manufacturerName": "Default Manufacturer",
  "name": "Manufacturer Admin",
  "email": "manufacturer@peekaboo.com",
  "password": "$2a$10$...",  // bcrypt hashed
  "role": "admin",
  "status": "active",
  "lastLogin": "2026-01-18T10:00:00Z",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

---

## File References

### Frontend Files

| File | Purpose |
|------|---------|
| `/frontend/public/admin/production-queue.html` | Admin Production Queue page |
| `/frontend/public/admin/js/admin.js` | Admin JavaScript utilities |
| `/frontend/public/admin/css/admin.css` | Admin stylesheet |
| `/frontend/public/manufacturer/index.html` | Manufacturer Portal main page |
| `/frontend/public/manufacturer/login.html` | Manufacturer login page |

### Backend Files

| File | Purpose |
|------|---------|
| `/backend/server.js` | Main Express server with API routes |
| `/backend/services/manufacturer-service.js` | Manufacturer business logic |
| `/backend/services/order-service.js` | Order management service |
| `/backend/middleware/auth.js` | Authentication middleware |
| `/backend/database.json` | JSON database file |

### Key Constants

**File:** `/backend/services/manufacturer-service.js`

```javascript
const MFR_ORDER_STATUSES = {
  PENDING: 'order_received',
  IN_PRODUCTION: 'manufacturing',
  QA: 'qa',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped'
};

const MFR_VALID_TRANSITIONS = {
  'order_received': ['manufacturing'],
  'manufacturing': ['qa'],
  'qa': ['ready_to_ship', 'manufacturing'],
  'ready_to_ship': ['shipped', 'qa'],
  'shipped': []
};
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired or invalid | Re-login to get new token |
| Orders not loading | Server not running | Start server with `npm start` |
| Status not updating | Invalid transition | Check valid transitions table |
| Product type "unknown" | Missing product data | Ensure items have product_type or product_slug |

### Debug Logging

Enable console logging to debug issues:

```javascript
// In manufacturer portal
console.log('Token:', localStorage.getItem('mfrToken'));
console.log('User:', localStorage.getItem('mfrUser'));

// In production queue
console.log('Orders loaded:', allProductionOrders.length);
console.log('Filtered orders:', filteredOrders.length);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial implementation with 4 statuses |
| 2.0.0 | Jan 18, 2026 | Added ready_to_ship status, synced Production Queue with Manufacturer Portal |

---

*Documentation maintained by Peekaboo Shades Development Team*
