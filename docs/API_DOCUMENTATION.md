# Peekaboo Shades - API Documentation

## Base URL

```
Development: http://localhost:3001
Production: https://api.peekabooshades.com (future)
```

## Authentication

### Admin Authentication

All admin endpoints require JWT authentication.

**Login:**
```http
POST /api/admin/login
Content-Type: application/json

{
  "email": "admin@peekabooshades.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin-001",
    "email": "admin@peekabooshades.com",
    "name": "Admin",
    "role": "admin"
  }
}
```

**Using Token:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Public APIs (No Auth Required)

### Products

#### List Products
```http
GET /api/v1/products
GET /api/v1/products?category=roller-shades
GET /api/v1/products?featured=true
GET /api/v1/products?search=blackout
```

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "b23180d5-7989-4f9d-bf28-9b210cb31256",
      "name": "Affordable Custom Roller Blinds & shades",
      "slug": "affordable-custom-roller-blinds",
      "description": "Roller blinds offer a clean and sleek line...",
      "base_price": 40,
      "category_slug": "roller-shades",
      "is_active": true,
      "is_featured": true
    }
  ]
}
```

#### Get Product Details
```http
GET /api/v1/products/:slug
```

**Response:**
```json
{
  "success": true,
  "product": {
    "id": "b23180d5-7989-4f9d-bf28-9b210cb31256",
    "name": "Affordable Custom Roller Blinds & shades",
    "slug": "affordable-custom-roller-blinds",
    "description": "...",
    "base_price": 40,
    "options": { ... }
  }
}
```

#### Get Product Options
```http
GET /api/v1/products/:slug/options
```

**Response:**
```json
{
  "success": true,
  "options": {
    "accordions": [
      {
        "id": "dimensions",
        "title": "Step 1: Dimensions",
        "fields": [...]
      },
      {
        "id": "shade-style",
        "title": "Step 2: Shade Style",
        "fields": [...]
      }
    ]
  }
}
```

### Pricing

#### Calculate Price
```http
POST /api/v1/pricing/calculate
Content-Type: application/json

{
  "productSlug": "affordable-custom-roller-blinds",
  "productType": "roller",
  "width": 36,
  "height": 48,
  "quantity": 2,
  "fabricCode": "82032A",
  "options": {
    "controlType": "motorized",
    "motorType": "battery",
    "standardCassette": "square-v2",
    "standardBottomBar": "type-a-waterdrop"
  },
  "shippingState": "CA",
  "includeShipping": true,
  "includeTax": true
}
```

**Response:**
```json
{
  "success": true,
  "product": {
    "id": "b23180d5-7989-4f9d-bf28-9b210cb31256",
    "name": "Affordable Custom Roller Blinds & shades",
    "slug": "affordable-custom-roller-blinds",
    "type": "roller"
  },
  "dimensions": {
    "width": 36,
    "height": 48,
    "squareInches": 1728,
    "squareFeet": 12
  },
  "quantity": 2,
  "fabricCode": "82032A",
  "pricing": {
    "manufacturerCost": {
      "unitCost": 25.00,
      "totalCost": 50.00,
      "source": "manufacturer_price",
      "manufacturerId": "mfr-001"
    },
    "margin": {
      "type": "percentage",
      "value": 40,
      "amount": 10.00,
      "percentage": 40
    },
    "options": {
      "breakdown": [
        { "type": "motorization", "name": "Motorized Control", "price": 75.00 },
        { "type": "hardware", "name": "Square V2 Cassette", "price": 15.00 }
      ],
      "total": 90.00
    },
    "unitPrice": 125.00,
    "lineTotal": 250.00,
    "shipping": {
      "method": "standard",
      "amount": 14.99,
      "description": "Continental US shipping"
    },
    "tax": {
      "rate": 0.0725,
      "amount": 19.21,
      "description": "California Sales Tax"
    },
    "grandTotal": 284.20
  },
  "profitAnalysis": {
    "grossProfit": 155.00,
    "grossMarginPercent": 62
  }
}
```

### Cart

#### Add to Cart
```http
POST /api/v1/cart/add
Content-Type: application/json

{
  "sessionId": "sess_abc123",
  "productId": "b23180d5-7989-4f9d-bf28-9b210cb31256",
  "width": 36,
  "height": 48,
  "quantity": 1,
  "roomLabel": "Master Bedroom",
  "configuration": {
    "fabricCode": "82032A",
    "controlType": "motorized"
  }
}
```

#### Get Cart
```http
GET /api/v1/cart/:sessionId
```

#### Update Cart Item
```http
PUT /api/v1/cart/:itemId
```

#### Remove from Cart
```http
DELETE /api/v1/cart/:itemId
```

### Orders

#### Create Order
```http
POST /api/v1/orders
Content-Type: application/json

{
  "sessionId": "sess_abc123",
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-123-4567"
  },
  "shippingAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "US"
  },
  "billingAddress": { ... },
  "paymentMethod": "credit_card",
  "promoCode": "SAVE10"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "ORD-1767291883382",
    "orderNumber": "PS-150421",
    "status": "pending",
    "total": 284.20,
    "trackingToken": "tk_abc123def456"
  }
}
```

#### Track Order (Public)
```http
GET /api/v1/orders/:orderNumber/track?token=tk_abc123def456
```

**Response:**
```json
{
  "success": true,
  "order": {
    "orderNumber": "PS-150421",
    "status": "in_shipping",
    "statusHistory": [
      { "status": "pending", "timestamp": "2025-01-01T10:00:00Z" },
      { "status": "payment_received", "timestamp": "2025-01-01T10:05:00Z" },
      { "status": "sent_to_manufacturer", "timestamp": "2025-01-02T09:00:00Z" },
      { "status": "in_manufacturing", "timestamp": "2025-01-03T08:00:00Z" },
      { "status": "in_testing", "timestamp": "2025-01-10T14:00:00Z" },
      { "status": "in_shipping", "timestamp": "2025-01-12T10:00:00Z" }
    ],
    "shipment": {
      "carrier": "ups",
      "trackingNumber": "1Z999AA10123456784",
      "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      "estimatedDelivery": "2025-01-15"
    }
  }
}
```

---

## Admin APIs (Auth Required)

### Dashboard

#### Get Dashboard Stats
```http
GET /api/admin/dashboard
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "orders": {
      "total": 150,
      "pending": 12,
      "inProgress": 25,
      "completed": 113
    },
    "revenue": {
      "today": 1250.00,
      "week": 8500.00,
      "month": 35000.00
    },
    "products": {
      "total": 8,
      "active": 7
    }
  }
}
```

### Product Management

#### List Products (Admin)
```http
GET /api/admin/products
GET /api/admin/products?status=active
GET /api/admin/products?category=roller-shades
```

#### Create Product
```http
POST /api/admin/products
Content-Type: application/json

{
  "name": "New Product",
  "slug": "new-product",
  "description": "Product description",
  "category_id": "category-uuid",
  "base_price": 45.00,
  "is_active": true,
  "is_featured": false
}
```

#### Update Product
```http
PUT /api/admin/products/:id
Content-Type: application/json

{
  "base_price": 50.00,
  "is_featured": true
}
```

#### Delete Product
```http
DELETE /api/admin/products/:id
```

### Manufacturer Prices

#### List Manufacturer Prices
```http
GET /api/admin/manufacturer-prices
GET /api/admin/manufacturer-prices?productType=roller
GET /api/admin/manufacturer-prices?manufacturerId=mfr-001
```

**Response:**
```json
{
  "success": true,
  "prices": [
    {
      "id": "mp-001",
      "manufacturerId": "mfr-001",
      "productType": "roller",
      "fabricCode": "82032A",
      "fabricName": "Light Filtering White",
      "basePrice": 25.00,
      "priceMatrix": [...],
      "status": "active",
      "importFile": "2025 Roller blind wholesale quotation.pdf"
    }
  ]
}
```

#### Import Prices from CSV
```http
POST /api/admin/manufacturer-prices/import
Content-Type: multipart/form-data

file: [CSV file]
manufacturerId: mfr-001
productType: roller
```

**Response:**
```json
{
  "success": true,
  "importLog": {
    "id": "pil-001",
    "status": "completed",
    "recordsFound": 50,
    "recordsImported": 48,
    "recordsSkipped": 2,
    "errors": [],
    "warnings": ["Row 25: Updated existing price for 82045A"]
  }
}
```

#### Get Import History
```http
GET /api/admin/manufacturer-prices/import-history
```

#### Download CSV Template
```http
GET /api/admin/manufacturer-prices/template?productType=roller
```

### Price Rules (Margins)

#### List Price Rules
```http
GET /api/admin/price-rules
```

**Response:**
```json
{
  "success": true,
  "rules": [
    {
      "id": "cpr-001",
      "name": "Default Roller Margin",
      "productType": "roller",
      "marginType": "percentage",
      "marginValue": 40,
      "priority": 1,
      "status": "active"
    }
  ]
}
```

#### Create Price Rule
```http
POST /api/admin/price-rules
Content-Type: application/json

{
  "name": "Holiday Promo",
  "productType": "all",
  "marginType": "percentage",
  "marginValue": 30,
  "priority": 10,
  "effectiveDate": "2025-12-01",
  "expirationDate": "2025-12-31"
}
```

#### Update Price Rule
```http
PUT /api/admin/price-rules/:id
Content-Type: application/json

{
  "marginValue": 35,
  "status": "inactive"
}
```

#### Simulate Pricing
```http
POST /api/admin/price-rules/simulate
Content-Type: application/json

{
  "productType": "roller",
  "marginAdjustment": -5
}
```

**Response:**
```json
{
  "success": true,
  "simulation": {
    "productType": "roller",
    "marginAdjustment": -5,
    "simulations": [
      {
        "fabricCode": "82032A",
        "manufacturerCost": 25.00,
        "currentCustomerPrice": 35.00,
        "simulatedCustomerPrice": 33.75,
        "priceChange": -1.25
      }
    ],
    "summary": {
      "avgPriceChange": -1.50,
      "totalSimulated": 50
    }
  }
}
```

### Order Management

#### List Orders
```http
GET /api/admin/orders
GET /api/admin/orders?status=pending
GET /api/admin/orders?dateFrom=2025-01-01&dateTo=2025-01-31
GET /api/admin/orders?search=john@example.com
```

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "ORD-1767291883382",
      "orderNumber": "PS-150421",
      "customer": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "items": [...],
      "subtotal": 250.00,
      "shipping": 14.99,
      "tax": 19.21,
      "total": 284.20,
      "status": "in_manufacturing",
      "createdAt": "2025-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

#### Get Order Details
```http
GET /api/admin/orders/:id
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "ORD-1767291883382",
    "orderNumber": "PS-150421",
    "customer": { ... },
    "items": [
      {
        "productId": "...",
        "productName": "Affordable Custom Roller Blinds",
        "width": 36,
        "height": 48,
        "quantity": 2,
        "configuration": { ... },
        "unitPrice": 125.00,
        "lineTotal": 250.00,
        "manufacturerCost": 50.00,
        "margin": 155.00
      }
    ],
    "shippingAddress": { ... },
    "billingAddress": { ... },
    "pricing": {
      "subtotal": 250.00,
      "discount": 0,
      "shipping": 14.99,
      "tax": 19.21,
      "total": 284.20
    },
    "manufacturerCosts": 50.00,
    "grossProfit": 155.00,
    "status": "in_manufacturing",
    "statusHistory": [...],
    "shipments": [...],
    "createdAt": "2025-01-01T10:00:00Z"
  }
}
```

#### Update Order Status
```http
PUT /api/admin/orders/:id/status
Content-Type: application/json

{
  "status": "in_shipping",
  "notes": "Shipped via UPS"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "ORD-1767291883382",
    "status": "in_shipping",
    "statusHistory": [...]
  }
}
```

#### Add Shipment
```http
POST /api/admin/orders/:id/shipment
Content-Type: application/json

{
  "carrier": "ups",
  "trackingNumber": "1Z999AA10123456784",
  "estimatedDelivery": "2025-01-15"
}
```

### Manufacturer Portal

#### List Manufacturer Orders
```http
GET /api/admin/manufacturer/:manufacturerId/orders
GET /api/admin/manufacturer/:manufacturerId/orders?status=in_manufacturing
```

#### Update Manufacturing Status
```http
PUT /api/admin/manufacturer/orders/:orderId/status
Content-Type: application/json

{
  "status": "in_testing",
  "notes": "Quality testing in progress"
}
```

#### Add Tracking
```http
POST /api/admin/manufacturer/orders/:orderId/tracking
Content-Type: application/json

{
  "carrier": "ups",
  "trackingNumber": "1Z999AA10123456784"
}
```

### Invoices

#### List Invoices
```http
GET /api/admin/invoices
GET /api/admin/invoices?status=paid
GET /api/admin/invoices?orderId=ORD-123
```

#### Generate Invoice
```http
POST /api/admin/invoices
Content-Type: application/json

{
  "orderId": "ORD-1767291883382"
}
```

#### Get Invoice PDF
```http
GET /api/admin/invoices/:id/pdf
```

### Finance

#### Get P&L Summary
```http
GET /api/admin/finance/summary
GET /api/admin/finance/summary?period=month
GET /api/admin/finance/summary?from=2025-01-01&to=2025-01-31
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "period": "2025-01",
    "revenue": {
      "gross": 35000.00,
      "net": 32500.00
    },
    "costs": {
      "manufacturerCosts": 15000.00,
      "shippingCosts": 1500.00,
      "expenses": 500.00
    },
    "profit": {
      "gross": 20000.00,
      "net": 15500.00,
      "marginPercent": 47.7
    },
    "taxes": {
      "collected": 2800.00,
      "due": 2800.00
    },
    "refunds": {
      "count": 3,
      "amount": 450.00
    }
  }
}
```

#### Get Tax Report
```http
GET /api/admin/finance/tax-report
GET /api/admin/finance/tax-report?period=Q1-2025
```

**Response:**
```json
{
  "success": true,
  "taxReport": {
    "period": "Q1-2025",
    "byState": [
      { "state": "CA", "taxableAmount": 15000.00, "taxCollected": 1087.50 },
      { "state": "NY", "taxableAmount": 8000.00, "taxCollected": 640.00 },
      { "state": "TX", "taxableAmount": 5000.00, "taxCollected": 312.50 }
    ],
    "total": {
      "taxableAmount": 28000.00,
      "taxCollected": 2040.00
    }
  }
}
```

#### Add Expense
```http
POST /api/admin/finance/expenses
Content-Type: application/json

{
  "orderId": "ORD-123",
  "category": "repair",
  "description": "Replacement blind for damaged item",
  "amount": 45.00,
  "vendor": "ZSTARR"
}
```

#### Export Finance Data
```http
GET /api/admin/finance/export?format=csv&period=2025-01
```

### Analytics

#### Get Funnel Metrics
```http
GET /api/admin/analytics/funnel
GET /api/admin/analytics/funnel?period=week
```

**Response:**
```json
{
  "success": true,
  "funnel": {
    "period": "2025-W01",
    "stages": [
      { "stage": "product_view", "count": 5000, "dropoffPercent": 0 },
      { "stage": "option_select", "count": 2500, "dropoffPercent": 50 },
      { "stage": "add_to_cart", "count": 800, "dropoffPercent": 68 },
      { "stage": "checkout_start", "count": 400, "dropoffPercent": 50 },
      { "stage": "payment_complete", "count": 150, "dropoffPercent": 62.5 }
    ],
    "conversionRate": 3.0
  }
}
```

#### Get Segmentation Data
```http
GET /api/admin/analytics/segments
GET /api/admin/analytics/segments?type=product
GET /api/admin/analytics/segments?type=device
GET /api/admin/analytics/segments?type=geo
```

**Response:**
```json
{
  "success": true,
  "segments": {
    "type": "product",
    "data": [
      { "segment": "roller", "orders": 80, "revenue": 12000.00, "percent": 53 },
      { "segment": "zebra", "orders": 40, "revenue": 8000.00, "percent": 27 },
      { "segment": "honeycomb", "orders": 30, "revenue": 6000.00, "percent": 20 }
    ]
  }
}
```

#### Track Analytics Event
```http
POST /api/v1/analytics/event
Content-Type: application/json

{
  "eventType": "product_view",
  "sessionId": "sess_abc123",
  "productSlug": "affordable-custom-roller-blinds",
  "eventData": {
    "referrer": "google.com"
  }
}
```

### System Configuration

#### Get System Config
```http
GET /api/admin/system-config
```

#### Update Pricing Config
```http
PUT /api/admin/system-config/pricing
Content-Type: application/json

{
  "dimensionMultiplier": {
    "baseSquareInches": 864,
    "minimumMultiplier": 1.0,
    "maximumMultiplier": 10.0
  },
  "warranty": {
    "extended": { "price": 20.00, "duration": "5 years" }
  }
}
```

#### Update Tax Config
```http
PUT /api/admin/system-config/tax
Content-Type: application/json

{
  "enabled": true,
  "defaultRate": 0.08,
  "rules": [
    { "region": "CA", "rate": 0.0725, "name": "California Sales Tax" }
  ]
}
```

#### Update Shipping Config
```http
PUT /api/admin/system-config/shipping
Content-Type: application/json

{
  "freeShippingThreshold": 499.00,
  "defaultRate": 9.99
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here",
  "details": ["Additional detail 1", "Additional detail 2"]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

### Common Errors

**Authentication:**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**Permission:**
```json
{
  "success": false,
  "error": "Permission denied: orders.update required"
}
```

**Validation:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "width must be between 12 and 144 inches",
    "fabricCode is required"
  ]
}
```

**Not Found:**
```json
{
  "success": false,
  "error": "Product not found"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. Future implementation will include:

| Endpoint Type | Limit |
|---------------|-------|
| Public | 100 requests/minute |
| Admin | 1000 requests/minute |
| Price Calculate | 50 requests/minute |

---

## Webhooks (Future)

Webhook events will be available for:
- `order.created`
- `order.status_changed`
- `shipment.created`
- `shipment.delivered`
- `payment.received`
- `refund.processed`
