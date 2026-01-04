# Finance & Accounting Documentation

Complete guide for invoices, accounts, ledger, margins, and profitability tracking.

---

## Overview

The Peekaboo Shades platform includes comprehensive financial management:

- **Invoices**: Create, track, and manage customer invoices
- **Accounts/Ledger**: Double-entry accounting with journal entries
- **Margins**: Configure profit margins by product/category
- **Analytics**: Revenue, profitability, and sales analytics

---

## Admin Pages

| Page | URL | Description |
|------|-----|-------------|
| Invoices | `/admin/invoices.html` | Invoice management |
| Accounts | `/admin/accounts.html` | Ledger & journal entries |
| Analytics | `/admin/analytics.html` | Revenue & sales analytics |

---

## Invoices

### Invoice Statuses

| Status | Description |
|--------|-------------|
| `draft` | Invoice created but not sent |
| `sent` | Invoice sent to customer |
| `paid` | Payment received |
| `partial` | Partial payment received |
| `overdue` | Past due date |
| `cancelled` | Invoice cancelled |

### Invoice Data Model

```javascript
{
  "id": "inv-uuid",
  "invoiceNumber": "INV-2024-0001",
  "orderId": "order-uuid",
  "orderNumber": "ORD-ABC123",
  "customerId": "cust-uuid",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "items": [
    {
      "description": "Roller Blinds 24x36",
      "quantity": 2,
      "unitPrice": 149.99,
      "total": 299.98
    }
  ],
  "subtotal": 299.98,
  "tax": 24.00,
  "shipping": 0,
  "discount": 0,
  "total": 323.98,
  "amountPaid": 0,
  "amountDue": 323.98,
  "status": "sent",
  "dueDate": "2024-02-15",
  "notes": "Net 30",
  "createdAt": "2024-01-15T10:00:00Z",
  "sentAt": "2024-01-15T10:30:00Z",
  "paidAt": null
}
```

### Invoice API Endpoints

#### List Invoices
```http
GET /api/admin/invoices
Authorization: Bearer <token>
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status |
| startDate | date | From date |
| endDate | date | To date |
| search | string | Search invoice # or customer |

#### Get Invoice Summary
```http
GET /api/admin/invoices/summary
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "totalInvoices": 150,
    "totalAmount": 45000,
    "paidAmount": 38000,
    "pendingAmount": 7000,
    "overdueAmount": 2000,
    "byStatus": {
      "draft": 5,
      "sent": 20,
      "paid": 120,
      "overdue": 5
    }
  }
}
```

#### Create Invoice
```http
POST /api/admin/invoices
Authorization: Bearer <token>
```

Request Body:
```json
{
  "orderId": "order-uuid",
  "dueDate": "2024-02-15",
  "notes": "Net 30 payment terms"
}
```

#### Record Payment
```http
POST /api/admin/invoices/:id/payment
Authorization: Bearer <token>
```

Request Body:
```json
{
  "amount": 323.98,
  "method": "card",
  "reference": "ch_xxx",
  "notes": "Paid via Stripe"
}
```

#### Send Invoice
```http
POST /api/admin/invoices/:id/send
Authorization: Bearer <token>
```

#### Generate Missing Invoices
```http
POST /api/admin/invoices/generate-missing
Authorization: Bearer <token>
```

Creates invoices for all orders that don't have one.

---

## Accounts & Ledger

### Double-Entry Accounting

The system uses double-entry bookkeeping. Each transaction creates balanced journal entries.

### Account Types

| Type | Normal Balance | Examples |
|------|----------------|----------|
| Asset | Debit | Cash, Accounts Receivable, Inventory |
| Liability | Credit | Accounts Payable, Unearned Revenue |
| Equity | Credit | Owner's Equity, Retained Earnings |
| Revenue | Credit | Sales Revenue, Service Income |
| Expense | Debit | COGS, Shipping, Taxes |

### Ledger Entry Model

```javascript
{
  "id": "entry-uuid",
  "date": "2024-01-15",
  "description": "Order ORD-ABC123 - Sale",
  "orderId": "order-uuid",
  "entries": [
    {
      "account": "accounts_receivable",
      "accountName": "Accounts Receivable",
      "debit": 323.98,
      "credit": 0
    },
    {
      "account": "sales_revenue",
      "accountName": "Sales Revenue",
      "debit": 0,
      "credit": 299.98
    },
    {
      "account": "tax_payable",
      "accountName": "Sales Tax Payable",
      "debit": 0,
      "credit": 24.00
    }
  ],
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### Ledger API Endpoints

#### Get All Ledger Entries
```http
GET /api/admin/ledger
Authorization: Bearer <token>
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | date | From date |
| endDate | date | To date |
| account | string | Filter by account |
| orderId | string | Filter by order |

#### Get Ledger Summary
```http
GET /api/admin/ledger/summary
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "accounts": {
      "cash": { "balance": 38000, "type": "asset" },
      "accounts_receivable": { "balance": 7000, "type": "asset" },
      "sales_revenue": { "balance": 45000, "type": "revenue" },
      "cogs": { "balance": 18000, "type": "expense" },
      "tax_payable": { "balance": 3600, "type": "liability" }
    },
    "totals": {
      "assets": 45000,
      "liabilities": 3600,
      "equity": 0,
      "revenue": 45000,
      "expenses": 18000
    },
    "netIncome": 27000
  }
}
```

#### Get Order Ledger Entries
```http
GET /api/orders/:orderId/ledger
Authorization: Bearer <token>
```

### Chart of Accounts

| Account Code | Account Name | Type |
|--------------|--------------|------|
| 1000 | Cash | Asset |
| 1100 | Accounts Receivable | Asset |
| 1200 | Inventory | Asset |
| 2000 | Accounts Payable | Liability |
| 2100 | Sales Tax Payable | Liability |
| 2200 | Unearned Revenue | Liability |
| 3000 | Owner's Equity | Equity |
| 3100 | Retained Earnings | Equity |
| 4000 | Sales Revenue | Revenue |
| 4100 | Shipping Revenue | Revenue |
| 5000 | Cost of Goods Sold | Expense |
| 5100 | Shipping Expense | Expense |
| 5200 | Processing Fees | Expense |

---

## Margin Management

### Margin Types

| Type | Description |
|------|-------------|
| `percentage` | Markup as percentage of cost (e.g., 40%) |
| `fixed` | Fixed dollar amount markup |
| `minimum` | Minimum margin amount |

### Margin Rule Priority

1. Product + Fabric specific rule
2. Product specific rule
3. Fabric specific rule
4. Product type rule (roller, zebra, etc.)
5. Default rule
6. Fallback: 40%

### Default Margins by Product Type

| Product Type | Margin % | Min Margin |
|--------------|----------|------------|
| Roller | 40% | $15 |
| Zebra | 45% | $20 |
| Honeycomb | 50% | $25 |
| Roman | 45% | $20 |

### Margin API Endpoints

#### Get All Margin Rules
```http
GET /api/admin/margins
Authorization: Bearer <token>
```

#### Get Margin Summary
```http
GET /api/admin/margins/summary
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "roller": { "marginValue": 40, "marginType": "percentage" },
    "zebra": { "marginValue": 45, "marginType": "percentage" },
    "honeycomb": { "marginValue": 50, "marginType": "percentage" }
  }
}
```

#### Get Product Margin
```http
GET /api/admin/margins/product/:productId
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "productName": "Roller Blinds",
    "productType": "roller",
    "hasProductMargin": true,
    "productMargin": { "marginValue": 42, "marginType": "percentage" },
    "typeMargin": { "marginValue": 40, "marginType": "percentage" },
    "effectiveMargin": 42,
    "marginType": "percentage"
  }
}
```

#### Update Product Margin
```http
PUT /api/admin/margins/product/:productId
Authorization: Bearer <token>
```

Request Body:
```json
{
  "marginValue": 45,
  "marginType": "percentage",
  "minMarginAmount": 20
}
```

#### Update Product Type Margin
```http
PUT /api/admin/margins/type/:productType
Authorization: Bearer <token>
```

---

## Analytics & Profitability

### Analytics Dashboard
```http
GET /api/admin/analytics/dashboard
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRevenue": 150000,
      "totalOrders": 500,
      "averageOrderValue": 300,
      "conversionRate": 3.5
    },
    "revenueByPeriod": {
      "today": 4500,
      "thisWeek": 25000,
      "thisMonth": 45000,
      "thisYear": 150000
    },
    "topProducts": [...],
    "recentOrders": [...]
  }
}
```

### Sales Analytics
```http
GET /api/admin/analytics/sales
Authorization: Bearer <token>
```

Query Parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| period | string | day, week, month, year |
| startDate | date | From date |
| endDate | date | To date |

Response:
```json
{
  "success": true,
  "data": {
    "totalSales": 45000,
    "totalOrders": 150,
    "averageOrderValue": 300,
    "salesByDay": [
      { "date": "2024-01-01", "sales": 1500, "orders": 5 },
      { "date": "2024-01-02", "sales": 2200, "orders": 7 }
    ],
    "topSellingProducts": [...],
    "salesByCategory": {...}
  }
}
```

### Product Analytics
```http
GET /api/admin/analytics/products
Authorization: Bearer <token>
```

### Revenue Analytics
```http
GET /api/admin/analytics/revenue
Authorization: Bearer <token>
```

### Sales by Category
```http
GET /api/admin/analytics/sales-by-category
Authorization: Bearer <token>
```

---

## Profitability Calculation

### Profit Formula

```
Gross Profit = Sales Revenue - Cost of Goods Sold
Net Profit = Gross Profit - Operating Expenses

Gross Margin % = (Gross Profit / Revenue) × 100
Net Margin % = (Net Profit / Revenue) × 100
```

### Cost Components

| Component | Description |
|-----------|-------------|
| Manufacturer Cost | Base cost from manufacturer |
| Fabric Cost | Per sq meter fabric cost |
| Hardware Cost | Motor, valance, rail costs |
| Shipping Cost | Inbound shipping from manufacturer |

### Revenue Components

| Component | Description |
|-----------|-------------|
| Product Sale | Customer sale price |
| Shipping Revenue | Shipping charged to customer |
| Installation | Installation services (if any) |

### Profitability Report Example

```json
{
  "period": "January 2024",
  "revenue": {
    "productSales": 45000,
    "shipping": 500,
    "total": 45500
  },
  "costs": {
    "cogs": 18000,
    "shipping": 200,
    "processing": 1365,
    "total": 19565
  },
  "profit": {
    "gross": 27000,
    "net": 25935,
    "grossMargin": 59.3,
    "netMargin": 57.0
  }
}
```

---

## Database Collections

### invoices
Stores all invoice records.

### ledgerEntries
Journal entries for double-entry accounting.

### customerPriceRules
Margin rules for pricing.

### payments
Payment records linked to invoices.

### refunds
Refund records.

---

## Best Practices

### Invoice Management
1. Generate invoices automatically on order completion
2. Set appropriate due dates (Net 15/30/60)
3. Send reminders for overdue invoices
4. Record all payments promptly

### Margin Configuration
1. Set product-type defaults first
2. Override only for specific products
3. Use minimum margins to protect profitability
4. Review margins quarterly

### Ledger Maintenance
1. Reconcile accounts monthly
2. Review unbalanced entries
3. Generate P&L reports regularly
4. Archive old entries annually

---

## Troubleshooting

### Invoice not generating
- Check if order has valid customer data
- Verify order status is appropriate
- Use "Generate Missing" to batch create

### Ledger imbalance
- Check for orphaned entries
- Verify all transactions have paired entries
- Review recent manual adjustments

### Margin not applying
- Check rule priority order
- Verify product type is correct
- Clear pricing cache if needed
