# Peekaboo Shades - API Reference

Complete API documentation for all endpoints.

---

## Base URL

```
http://localhost:3001/api
```

## Authentication

Protected endpoints require JWT token:
```
Authorization: Bearer <token>
```

---

## Public APIs

### Products

#### List Products
```http
GET /api/products
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| search | string | Search by name |
| limit | number | Results per page (default: 20) |
| page | number | Page number |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Affordable Custom Roller Blinds",
      "slug": "affordable-custom-roller-blinds",
      "basePrice": 40,
      "images": ["/images/product1.jpg"],
      "category": "roller-blinds"
    }
  ],
  "total": 10,
  "page": 1
}
```

#### Get Product Details
```http
GET /api/products/:slug
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Affordable Custom Roller Blinds",
    "slug": "affordable-custom-roller-blinds",
    "description": "...",
    "basePrice": 40,
    "images": [...],
    "features": ["Energy Efficient", "Custom Sizes"],
    "category": "roller-blinds"
  }
}
```

#### Get Product Options (Configurator)
```http
GET /api/products/:slug/options
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fabrics": [...],
    "hardware": {
      "mountType": [...],
      "controlType": [...],
      "valanceType": [...],
      "bottomRail": [...],
      "rollerType": [...]
    },
    "accessories": [...]
  }
}
```

---

### Fabrics

#### List Fabrics
```http
GET /api/fabrics
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | blackout, light-filtering, semi-blackout |
| search | string | Search by code |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "82032A",
      "name": "Blackout White",
      "category": "blackout",
      "pricePerSqM": 8.50,
      "image": "/images/fabrics/82032A.jpg",
      "inStock": true
    }
  ]
}
```

---

### Orders (Public)

#### Place Order (Checkout)
```http
POST /api/checkout
```

**Request Body:**
```json
{
  "items": [
    {
      "productId": "uuid",
      "width": 24,
      "height": 36,
      "fabric": "82032A",
      "options": {
        "mountType": "inside",
        "controlType": "cordless",
        "valanceType": "none",
        "bottomRail": "standard"
      },
      "quantity": 1
    }
  ],
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "address": {
      "street": "123 Main St",
      "city": "Los Angeles",
      "state": "CA",
      "zip": "90001"
    }
  },
  "payment": {
    "method": "card",
    "token": "stripe_token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "ORD-ABC123",
    "total": 299.99,
    "status": "pending"
  }
}
```

#### Request Quote
```http
POST /api/quotes
```

**Request Body:**
```json
{
  "items": [...],
  "customer": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234"
  },
  "notes": "Need quote for 5 windows"
}
```

---

### Pricing

#### Calculate Price
```http
POST /api/v1/pricing/calculate
```

**Request Body:**
```json
{
  "productId": "uuid",
  "width": 24,
  "height": 36,
  "unit": "in",
  "fabric": "82032A",
  "options": {
    "controlType": "motorized",
    "motorBrand": "aok",
    "valanceType": "fabric",
    "bottomRail": "standard"
  },
  "accessories": ["smart-hub"],
  "quantity": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "breakdown": {
      "base": 40,
      "fabric": 15.50,
      "hardware": 57.20,
      "accessories": 23.50,
      "subtotal": 136.20
    },
    "quantity": 2,
    "total": 272.40
  }
}
```

---

## Dealer APIs

### Authentication

#### Dealer Login
```http
POST /api/dealer/login
```

**Request Body:**
```json
{
  "email": "john@abcwindows.com",
  "password": "dealer123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "dealer-user-001",
    "dealerId": "dealer-001",
    "name": "John Smith",
    "email": "john@abcwindows.com",
    "tier": "silver"
  }
}
```

---

### Dashboard

#### Get Dealer Stats
```http
GET /api/dealer/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "pendingOrders": 5,
    "completedOrders": 140,
    "monthlyOrders": 25,
    "monthlyRevenue": 12500,
    "monthlyCommission": 1250,
    "totalRevenue": 45000,
    "totalCommission": 4500,
    "customerCount": 35,
    "tier": "silver",
    "discountPercent": 20
  }
}
```

---

### Orders

#### List Dealer Orders
```http
GET /api/dealer/orders
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | pending, processing, shipped, delivered |
| days | number | Filter by last N days |
| search | string | Search order # or customer |
| limit | number | Results per page |
| page | number | Page number |

#### Get Order Details
```http
GET /api/dealer/orders/:orderId
Authorization: Bearer <token>
```

#### Create Order
```http
POST /api/dealer/orders
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "productId": "uuid",
  "productName": "Roller Blinds",
  "width": 24,
  "height": 36,
  "fabric": "82032A",
  "options": {...},
  "accessories": ["smart-hub"],
  "quantity": 1,
  "customer": {
    "name": "End Customer",
    "email": "customer@email.com",
    "phone": "555-5678",
    "address": "456 Oak Ave"
  },
  "notes": "Rush order"
}
```

---

### Customers

#### List Dealer Customers
```http
GET /api/dealer/customers
Authorization: Bearer <token>
```

#### Add Customer
```http
POST /api/dealer/customers
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "555-9999",
  "address": "789 Pine St",
  "city": "San Diego",
  "notes": "Prefers morning delivery"
}
```

#### Update Customer
```http
PUT /api/dealer/customers/:customerId
Authorization: Bearer <token>
```

#### Delete Customer
```http
DELETE /api/dealer/customers/:customerId
Authorization: Bearer <token>
```

---

### Commissions

#### Get Commission Summary
```http
GET /api/dealer/commissions
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| days | number | Filter by last N days |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEarned": 4500,
    "monthlyEarned": 1250,
    "monthlyOrders": 25,
    "pendingPayout": 500,
    "history": [
      {
        "date": "2024-01-15",
        "orderId": "uuid",
        "orderNumber": "ORD-123",
        "customerName": "Jane Smith",
        "orderTotal": 299.99,
        "commission": 29.99,
        "paid": true
      }
    ]
  }
}
```

---

## Manufacturer APIs

### Authentication

#### Manufacturer Login
```http
POST /api/manufacturer/login
```

**Request Body:**
```json
{
  "email": "factory@zstarr.com",
  "password": "mfr123"
}
```

---

### Orders

#### Get Order Queue
```http
GET /api/manufacturer/orders
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | order_received, manufacturing, qa, shipped |
| priority | string | normal, rush |

#### Update Order Status
```http
POST /api/manufacturer/orders/:orderId/status
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "manufacturing",
  "notes": "Started production"
}
```

#### Add Tracking
```http
POST /api/manufacturer/orders/:orderId/tracking
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "carrier": "UPS",
  "trackingNumber": "1Z999AA10123456784",
  "estimatedDelivery": "2024-01-20"
}
```

---

## Admin APIs

### Authentication

#### Admin Login
```http
POST /api/admin/login
```

### Dashboard

#### Get Analytics
```http
GET /api/admin/dashboard
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 500,
    "totalRevenue": 150000,
    "ordersToday": 15,
    "revenueToday": 4500,
    "topProducts": [...],
    "recentOrders": [...],
    "ordersByStatus": {...}
  }
}
```

---

### Products Management

#### List Products (Admin)
```http
GET /api/admin/products
Authorization: Bearer <token>
```

#### Create Product
```http
POST /api/admin/products
Authorization: Bearer <token>
```

#### Update Product
```http
PUT /api/admin/products/:id
Authorization: Bearer <token>
```

#### Delete Product
```http
DELETE /api/admin/products/:id
Authorization: Bearer <token>
```

---

### Margin Rules

#### Get Margin Rules
```http
GET /api/admin/margins
Authorization: Bearer <token>
```

#### Update Margin Rules
```http
PUT /api/admin/margins
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "defaultMargin": 0.35,
  "categoryMargins": {
    "roller-blinds": 0.30,
    "zebra-blinds": 0.35
  },
  "dealerMargins": {
    "bronze": 0.15,
    "silver": 0.20,
    "gold": 0.25
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## Rate Limiting

- Public endpoints: 100 requests/minute
- Authenticated endpoints: 300 requests/minute

## WebSocket

Real-time updates available at:
```
ws://localhost:3001/ws
```

Events:
- `order:created` - New order placed
- `order:updated` - Order status changed
- `inventory:updated` - Stock level changed
