# API CONTRACTS - Endpoint Reference
## Peekaboo Shades REST API

**Version:** 2.0 (Phase 0 Audit)
**Base URL:** `http://localhost:3001`
**Total Endpoints:** ~390

---

## 1. AUTHENTICATION

All admin endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

### 1.1 Admin Login
```
POST /api/admin/login
Content-Type: application/json

Request:
{
  "email": "string",
  "password": "string"
}

Response (200):
{
  "success": true,
  "token": "jwt-token",
  "admin": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "admin | manager | staff"
  }
}

Response (401):
{
  "success": false,
  "error": "Invalid email or password"
}
```

### 1.2 Verify Token
```
GET /api/admin/verify
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "admin": { ... }
}
```

### 1.3 Manufacturer Login
```
POST /api/manufacturer/login
```

### 1.4 Dealer Login
```
POST /api/dealer/login
```

---

## 2. PUBLIC API (No Auth)

### 2.1 Categories
```
GET /api/categories

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Roller Shades",
      "slug": "roller-shades",
      "description": "..."
    }
  ]
}
```

### 2.2 Products
```
GET /api/products
Query Params:
  ?category=roller-shades
  ?featured=true
  ?search=keyword
  ?sort=price_asc|price_desc|name
  ?limit=10
  ?offset=0

Response:
{
  "success": true,
  "data": [...],
  "total": 100
}
```

### 2.3 Single Product
```
GET /api/products/:slug

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "...",
    "slug": "...",
    ...
  }
}
```

### 2.4 FAQs
```
GET /api/faqs

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "question": "...",
      "answer": "..."
    }
  ]
}
```

### 2.5 Room Labels
```
GET /api/room-labels

Response:
{
  "success": true,
  "data": ["Master Bedroom", "Living Room", ...]
}
```

---

## 3. CART API (Session-based)

### 3.1 Get Cart
```
GET /api/cart/:sessionId

Response:
{
  "success": true,
  "data": [CartItem],
  "subtotal": 250.00,
  "itemCount": 2
}
```

### 3.2 Add to Cart
```
POST /api/cart
Content-Type: application/json

Request:
{
  "sessionId": "string",
  "productId": "uuid",
  "quantity": 1,
  "width": 48,
  "height": 72,
  "roomLabel": "Master Bedroom",
  "configuration": {
    "fabricCode": "82032A",
    "controlType": "motorized",
    "motorBrand": "aok",
    ...
  }
}

Response:
{
  "success": true,
  "cartItemId": "uuid",
  "pricing": {
    "unitPrice": 189.91,
    "lineTotal": 189.91,
    "optionsTotal": 140.06
  },
  "priceSnapshot": { ... }
}
```
**Note:** Price is ALWAYS calculated server-side. Client-provided price is ignored.

### 3.3 Update Cart Item
```
PUT /api/cart/:id
{
  "quantity": 2
}
```

### 3.4 Remove from Cart
```
DELETE /api/cart/:id
```

### 3.5 Clear Cart
```
DELETE /api/cart/clear/:sessionId
```

---

## 4. PRICING API

### 4.1 Calculate Price (V1 - Preferred)
```
POST /api/v1/pricing/calculate
Content-Type: application/json

Request:
{
  "productSlug": "affordable-custom-roller-blinds",
  "productType": "roller",
  "width": 48,
  "height": 72,
  "quantity": 1,
  "fabricCode": "82032A",
  "options": {
    "controlType": "motorized",
    "motorBrand": "aok",
    "remoteType": "6-channel",
    ...
  }
}

Response:
{
  "success": true,
  "dimensions": { "width": 48, "height": 72 },
  "quantity": 1,
  "fabricCode": "82032A",
  "pricing": {
    "manufacturerCost": {
      "unitCost": 35.61,
      "totalCost": 35.61,
      "source": "manufacturer_price"
    },
    "margin": {
      "type": "percentage",
      "value": 40,
      "amount": 14.24,
      "percentage": 40
    },
    "unitPrice": 189.91,
    "lineTotal": 189.91,
    "options": {
      "total": 140.06,
      "breakdown": [...]
    },
    "accessories": {
      "total": 0,
      "breakdown": []
    }
  }
}
```

### 4.2 Calculate Order Total
```
POST /api/calculate-order-total
{
  "items": [...],
  "shippingAddress": "...",
  "promoCode": "SAVE10"
}

Response:
{
  "success": true,
  "lineItems": [...],
  "summary": {
    "subtotal": 500.00,
    "discount": { "code": "SAVE10", "amount": 50.00 },
    "tax": { "rate": 0.0725, "amount": 32.63 },
    "shipping": { "method": "standard", "amount": 9.99 },
    "grandTotal": 492.62
  }
}
```

---

## 5. ORDER API

### 5.1 Create Order (Legacy)
```
POST /api/orders
{
  "sessionId": "...",
  "customerName": "...",
  "customerEmail": "...",
  ...
}
```

### 5.2 Checkout (Preferred)
```
POST /api/checkout
{
  "sessionId": "string",
  "customer": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "address": "string"
  },
  "payment": {
    "method": "fake"
  }
}

Response:
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "orderNumber": "ORD-XXXXXXXX",
      "status": "order_received",
      "total": 500.00
    },
    "payment": { "status": "completed" },
    "ledgerEntriesCreated": 3,
    "invoice": {
      "id": "uuid",
      "invoiceNumber": "INV-XXXXXX"
    }
  }
}
```

### 5.3 Get Order
```
GET /api/orders/:orderNumber
```

### 5.4 Get Order History
```
GET /api/orders/:orderId/history
```

### 5.5 Transition Order Status (Admin)
```
POST /api/orders/:orderId/transition
Authorization: Bearer <token>
{
  "newStatus": "manufacturing",
  "reason": "Sent to production"
}
```

---

## 6. ADMIN API

### 6.1 Dashboard
```
GET /api/admin/dashboard
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "stats": {
      "totalOrders": 50,
      "pendingOrders": 5,
      "totalRevenue": 25000.00,
      "totalProducts": 10
    },
    "recentOrders": [...],
    "recentQuotes": [...]
  }
}
```

### 6.2 Products CRUD
```
GET    /api/admin/products
GET    /api/admin/products/:id
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
PUT    /api/admin/products/:id/toggle
PUT    /api/admin/products/:id/featured
```

### 6.3 Orders Management
```
GET    /api/admin/orders
       ?page=1&limit=25
       ?status=pending
       ?search=ORD-123
       
GET    /api/admin/orders/:id
PUT    /api/admin/orders/:id/status
DELETE /api/admin/orders/:id
GET    /api/admin/orders/shipped-pending
POST   /api/admin/orders/auto-delivery
```

### 6.4 Invoices
```
GET    /api/admin/invoices
       ?page=1&limit=25
GET    /api/admin/invoices/summary
GET    /api/admin/invoices/:id
POST   /api/admin/invoices
PUT    /api/admin/invoices/:id
POST   /api/admin/invoices/:id/payment
POST   /api/admin/invoices/:id/send
POST   /api/admin/invoices/generate-missing
```

### 6.5 Customers
```
GET    /api/admin/customers
GET    /api/admin/customers/:id
POST   /api/admin/customers
PUT    /api/admin/customers/:id
DELETE /api/admin/customers/:id
POST   /api/admin/customers/:id/notes
```

### 6.6 Fabrics & Pricing
```
GET    /api/admin/fabrics
POST   /api/admin/fabrics
PUT    /api/admin/fabrics/:id
DELETE /api/admin/fabrics/:id
PUT    /api/admin/fabrics/reorder

GET    /api/admin/manufacturer-prices
GET    /api/admin/manufacturer-prices/:fabricCode
PUT    /api/admin/manufacturer-prices/:fabricCode
POST   /api/admin/manufacturer-prices
POST   /api/admin/manufacturer-prices/bulk-update
```

### 6.7 Hardware & Accessories
```
GET    /api/admin/hardware/:category
POST   /api/admin/hardware/:category
PUT    /api/admin/hardware/:category/:id
DELETE /api/admin/hardware/:category/:id

GET    /api/admin/accessories
POST   /api/admin/accessories
PUT    /api/admin/accessories/:id
DELETE /api/admin/accessories/:id
```

### 6.8 Ledger & Reports
```
GET    /api/admin/ledger
       ?page=1&limit=50
GET    /api/admin/ledger/summary
POST   /api/admin/ledger/backfill
GET    /api/admin/reports/profit
       ?startDate=2026-01-01&endDate=2026-01-31
```

### 6.9 Analytics
```
GET    /api/admin/analytics/dashboard
GET    /api/admin/analytics/sales
GET    /api/admin/analytics/products
GET    /api/admin/analytics/fabrics
GET    /api/admin/analytics/traffic
GET    /api/admin/analytics/customer-insights
GET    /api/admin/analytics/finance-insights
```

---

## 7. MANUFACTURER PORTAL API

```
POST   /api/manufacturer/login
GET    /api/manufacturer/stats
GET    /api/manufacturer/orders
GET    /api/manufacturer/orders/:orderId
POST   /api/manufacturer/orders/:orderId/status
POST   /api/manufacturer/orders/:orderId/tracking
POST   /api/manufacturer/orders/:orderId/shipping
```

---

## 8. DEALER PORTAL API

```
POST   /api/dealer/login
GET    /api/dealer/stats
GET    /api/dealer/orders
GET    /api/dealer/orders/:orderId
POST   /api/dealer/orders
POST   /api/dealer/orders/:orderId/status
GET    /api/dealer/customers
POST   /api/dealer/customers
PUT    /api/dealer/customers/:customerId
DELETE /api/dealer/customers/:customerId
GET    /api/dealer/commissions
GET    /api/dealer/pricing
```

---

## 9. CONTENT API

### 9.1 Pages
```
GET    /api/pages/:slug
GET    /api/admin/pages
POST   /api/admin/pages
PUT    /api/admin/pages/:id
DELETE /api/admin/pages/:id
```

### 9.2 Site Content
```
GET    /api/site-content
GET    /api/site-content/theme
PUT    /api/admin/site-content/theme
PUT    /api/admin/site-content/navigation/main-menu
PUT    /api/admin/site-content/navigation/footer
```

### 9.3 Media
```
GET    /api/admin/media
POST   /api/admin/media/upload
PUT    /api/admin/media/:assetId
DELETE /api/admin/media/:assetId
```

---

## 10. RESPONSE FORMATS

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message description"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 25,
  "totalPages": 4
}
```

---

## 11. HTTP STATUS CODES

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (e.g., price validation failed) |
| 500 | Internal Server Error |
