# DATA MODEL - Entity Definitions
## Peekaboo Shades Database Schema

**Version:** 2.0 (Phase 0 Audit)
**Source:** `backend/database.json`
**Storage:** JSON file with in-memory cache (5-second TTL)

---

## 1. DATABASE OVERVIEW

Total tables/collections: 65

### Core Business Tables
| Table | Count | Description |
|-------|-------|-------------|
| categories | 5 | Product categories |
| products | 5 | Product definitions |
| orders | 2 | Customer orders |
| invoices | 2 | Generated invoices |
| customers | 2 | Customer records |
| quotes | 0 | Quote requests |
| cart | 0 | Active cart items |

### Pricing Tables
| Table | Count | Description |
|-------|-------|-------------|
| manufacturerPrices | 161 | Fabric pricing by code |
| zebraManufacturerPrices | 208 | Zebra-specific pricing |
| customerPriceRules | 5 | Margin rules |
| motorBrands | 4 | Motor brand definitions |

### Content Tables
| Table | Count | Description |
|-------|-------|-------------|
| pages | 3 | CMS pages |
| blogPosts | 2 | Blog content |
| faqs | 3 | FAQ entries |
| files | 3 | File metadata |

### User Tables
| Table | Count | Description |
|-------|-------|-------------|
| adminUsers | 1 | Admin accounts |
| manufacturerUsers | 1 | Manufacturer portal users |
| dealerUsers | 2 | Dealer portal users |
| users | 2 | General users |

---

## 2. CORE ENTITY SCHEMAS

### 2.1 Category
```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "description": "string"
}
```
**Primary Key:** `id`
**Used By:** Products reference via `category_id`

### 2.2 Product
```json
{
  "id": "uuid",
  "category_id": "uuid (FK → categories)",
  "category_name": "string (denormalized)",
  "category_slug": "string (denormalized)",
  "name": "string",
  "slug": "string (unique)",
  "description": "string",
  "base_price": "number",
  "sale_price": "number | null",
  "is_featured": "boolean",
  "is_active": "boolean",
  "image_url": "string",
  "gallery_images": ["string"],
  "stock_status": "in_stock | out_of_stock",
  "is_discontinued": "boolean",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```
**Primary Key:** `id`
**Unique:** `slug`

### 2.3 Order
```json
{
  "id": "uuid",
  "order_number": "string (ORD-XXXXXXXX)",
  "customer_name": "string",
  "customer_email": "string",
  "customer_phone": "string",
  "shipping_address": "string",
  "subtotal": "number",
  "tax": "number",
  "shipping": "number",
  "total": "number",
  "status": "string (see ORDER_LIFECYCLE.md)",
  "items": [OrderItem],
  "pricing": {
    "subtotal": "number",
    "tax": "number",
    "shipping": "number",
    "total": "number",
    "manufacturer_cost_total": "number",
    "margin_total": "number",
    "margin_percent": "number"
  },
  "status_history": [StatusChange],
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```
**Primary Key:** `id`
**Unique:** `order_number`

### 2.4 Order Item (embedded in Order)
```json
{
  "id": "uuid",
  "order_id": "uuid (FK → orders)",
  "session_id": "string",
  "product_id": "uuid (FK → products)",
  "product_name": "string (denormalized)",
  "quantity": "number",
  "width": "number (inches)",
  "height": "number (inches)",
  "room_label": "string",
  "configuration": "JSON string",
  "unit_price": "number (customer price)",
  "line_total": "number",
  "extended_warranty": "number (0 or 1)",
  "price_snapshot": {
    "captured_at": "ISO timestamp",
    "manufacturer_price": {
      "unit_cost": "number",
      "total_cost": "number",
      "source": "string",
      "fabric_code": "string"
    },
    "margin": {
      "type": "percentage | flat",
      "value": "number",
      "amount": "number",
      "percentage": "number"
    },
    "customer_price": {
      "unit_price": "number",
      "line_total": "number",
      "options_total": "number",
      "options_breakdown": [OptionBreakdown],
      "accessories_total": "number",
      "accessories_breakdown": [AccessoryBreakdown]
    }
  },
  "created_at": "ISO timestamp"
}
```

### 2.5 Invoice
```json
{
  "id": "uuid",
  "invoiceNumber": "string (INV-XXXXXX)",
  "orderId": "uuid (FK → orders)",
  "orderNumber": "string",
  "type": "customer | manufacturer",
  "status": "draft | pending | paid | overdue | cancelled",
  "customer": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "address": "string"
  },
  "items": [InvoiceItem],
  "subtotal": "number",
  "tax": "number",
  "taxRate": "number",
  "shipping": "number",
  "total": "number",
  "notes": "string",
  "createdAt": "ISO timestamp",
  "dueDate": "ISO timestamp",
  "paidAt": "ISO timestamp | null"
}
```
**Primary Key:** `id`

### 2.6 Customer
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "orderCount": "number",
  "totalSpent": "number",
  "notes": ["NoteEntry"],
  "createdAt": "ISO timestamp",
  "lastOrderAt": "ISO timestamp"
}
```
**Primary Key:** `id`

---

## 3. PRICING ENTITY SCHEMAS

### 3.1 Manufacturer Price
```json
{
  "id": "uuid",
  "fabricCode": "string (e.g., 82032A)",
  "fabricName": "string",
  "collectionName": "string",
  "productType": "roller | zebra | honeycomb | roman",
  "pricePerSqMeter": "number (USD)",
  "minWidth": "number (inches)",
  "maxWidth": "number (inches)",
  "minHeight": "number (inches)",
  "maxHeight": "number (inches)",
  "isActive": "boolean",
  "updatedAt": "ISO timestamp"
}
```
**Primary Key:** `id`
**Lookup Key:** `fabricCode`

### 3.2 Motor Brand
```json
{
  "id": "uuid",
  "name": "string",
  "code": "string (e.g., aok, dooya)",
  "price": "number (customer price)",
  "manufacturerCost": "number",
  "isActive": "boolean"
}
```

### 3.3 Zebra Fabric
```json
{
  "id": "uuid",
  "code": "string (fabric code)",
  "name": "string",
  "collection": "string",
  "type": "light-filtering | blackout",
  "color": "string",
  "imageUrl": "string",
  "swatchUrl": "string",
  "isActive": "boolean",
  "order": "number"
}
```

---

## 4. USER ENTITY SCHEMAS

### 4.1 Admin User
```json
{
  "id": "string",
  "email": "string",
  "password": "string (bcrypt hash)",
  "name": "string",
  "role": "admin | manager | staff",
  "createdAt": "ISO timestamp",
  "lastLogin": "ISO timestamp"
}
```
**Primary Key:** `id`
**Unique:** `email`

### 4.2 Manufacturer User
```json
{
  "id": "string",
  "manufacturerId": "uuid (FK → manufacturers)",
  "email": "string",
  "password": "string (bcrypt hash)",
  "name": "string",
  "role": "manufacturer",
  "permissions": ["string"],
  "isActive": "boolean",
  "createdAt": "ISO timestamp"
}
```

### 4.3 Dealer User
```json
{
  "id": "string",
  "dealerId": "uuid (FK → dealers)",
  "email": "string",
  "password": "string (bcrypt hash)",
  "name": "string",
  "role": "dealer",
  "isActive": "boolean",
  "createdAt": "ISO timestamp"
}
```

---

## 5. CONTENT ENTITY SCHEMAS

### 5.1 Page (CMS)
```json
{
  "id": "uuid",
  "title": "string",
  "slug": "string",
  "content": "string (HTML)",
  "metaTitle": "string",
  "metaDescription": "string",
  "isPublished": "boolean",
  "isVisible": "boolean",
  "template": "string",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

### 5.2 Blog Post
```json
{
  "id": "uuid",
  "title": "string",
  "slug": "string",
  "excerpt": "string",
  "content": "string (HTML)",
  "author": "string",
  "featuredImage": "string (URL)",
  "tags": ["string"],
  "isPublished": "boolean",
  "publishedAt": "ISO timestamp",
  "createdAt": "ISO timestamp"
}
```

### 5.3 FAQ
```json
{
  "id": "uuid",
  "question": "string",
  "answer": "string",
  "order": "number",
  "isActive": "boolean"
}
```

---

## 6. FINANCE ENTITY SCHEMAS

### 6.1 Ledger Entry
```json
{
  "id": "uuid",
  "orderId": "uuid (FK → orders)",
  "orderNumber": "string",
  "type": "revenue | cogs | profit",
  "amount": "number",
  "description": "string",
  "createdAt": "ISO timestamp"
}
```

---

## 7. CONFIGURATION OBJECTS

### 7.1 Settings
```json
{
  "storeName": "string",
  "storeEmail": "string",
  "storePhone": "string",
  "logoUrl": "string",
  "taxRate": "number (decimal, e.g., 0.08)",
  "shippingRate": "number",
  "freeShippingThreshold": "number",
  "currency": "string (USD)"
}
```

### 7.2 Site Content
```json
{
  "theme": { "primaryColor", "secondaryColor", ... },
  "topBar": { "enabled", "backgroundColor", "links": [...] },
  "header": { "logoText", "showSearch", ... },
  "navigation": { "mainMenu": [...], "footerColumns": [...] },
  "heroSlides": [...],
  "homepage": { "sections": [...] }
}
```

---

## 8. ENTITY RELATIONSHIPS

```
categories ──────┐
                 │ 1:N
                 ▼
            products
                 │
                 │ N:M (via order items)
                 ▼
            orders ───────────────────┐
                 │                    │
                 │ 1:N                │ 1:N
                 ▼                    ▼
            invoices            ledgerEntries
                 │
                 │
customers ───────┘ (linked by email)

manufacturerPrices ────┐
                       │ Referenced by fabric code
zebraManufacturerPrices┘ in pricing engine

adminUsers ─────────┐
manufacturerUsers ──┤ Separate auth domains
dealerUsers ────────┘
```

---

## 9. DENORMALIZATION NOTES

The following fields are denormalized for performance:

| Table | Denormalized Fields | Source |
|-------|---------------------|--------|
| products | category_name, category_slug | categories |
| order.items | product_name | products |
| invoices | orderNumber, customer.* | orders |

**Rationale:** JSON file storage has no JOINs; denormalization avoids expensive lookups.

---

## 10. DATA VALIDATION RULES

| Field | Validation |
|-------|------------|
| Email | RFC 5322 format |
| Phone | 10+ digits |
| UUID | v4 format |
| Price | Non-negative number |
| Slug | Lowercase, hyphens only |
| Width/Height | 12-144 inches |
| Tax Rate | 0.0 - 0.25 |
