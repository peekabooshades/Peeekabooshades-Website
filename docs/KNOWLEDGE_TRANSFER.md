# Peekaboo Shades - Knowledge Transfer Document

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Key Components](#key-components)
4. [File-by-File Reference](#file-by-file-reference)
5. [Business Logic](#business-logic)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [Extending the System](#extending-the-system)

---

## Executive Summary

Peekaboo Shades is a custom window blinds e-commerce platform built with:
- **Frontend:** Static HTML/CSS/JavaScript
- **Backend:** Node.js + Express.js
- **Database:** JSON file-based storage
- **Authentication:** JWT tokens with RBAC

**Key URLs:**
- Customer Site: `http://localhost:3001/`
- Product Page: `http://localhost:3001/product/affordable-custom-roller-blinds`
- Admin Dashboard: `http://localhost:3001/admin/`
- Admin Login: `http://localhost:3001/admin/login.html`

**Default Admin Credentials:**
- Email: `admin@peekabooshades.com`
- Password: `admin123`

---

## System Overview

### Core Principle: Admin Controls Everything

The system is designed so that **ALL business-critical data** (prices, margins, products, fabrics) is managed through the Admin Dashboard. The frontend only displays what the backend provides.

### Pricing Flow (Most Critical)

```
Customer selects options
        ↓
Frontend calls POST /api/v1/pricing/calculate
        ↓
Backend ExtendedPricingEngine:
  1. Looks up manufacturer cost (from manufacturerPrices table)
  2. Applies margin rules (from customerPriceRules table)
  3. Adds option costs (hardware, motorization, accessories)
  4. Calculates shipping & tax estimates
        ↓
Returns complete price breakdown to frontend
        ↓
Frontend displays price (NEVER calculates)
```

---

## Key Components

### 1. Backend Server (`backend/server.js`)

This is a large file (~7500 lines) containing:
- Express app setup
- All API route handlers
- Database read/write functions
- Middleware integration

**Key sections:**
- Lines 1-100: Imports and configuration
- Lines 100-500: Database initialization
- Lines 500-2000: Product/Category APIs
- Lines 2000-4000: Order/Quote APIs
- Lines 4000-5500: Content/Theme APIs
- Lines 5500-7000: Admin APIs
- Lines 7000+: System config APIs

### 2. Pricing Engine (`backend/services/extended-pricing-engine.js`)

**Purpose:** Single source of truth for all pricing calculations

**Key Methods:**
```javascript
calculateCustomerPrice(params)  // Main pricing method
getManufacturerCost(params)     // Look up cost from imports
applyMarginRules(params)        // Apply margin configuration
calculateOptionCosts(options)   // Hardware/motor/accessory costs
calculateShipping(...)          // Shipping estimates
calculateTax(...)               // Tax calculations
```

**Usage:**
```javascript
const { extendedPricingEngine } = require('./services/extended-pricing-engine');

const result = extendedPricingEngine.calculateCustomerPrice({
  productSlug: 'affordable-custom-roller-blinds',
  productType: 'roller',
  width: 36,
  height: 48,
  quantity: 2,
  fabricCode: '82032A',
  options: {
    controlType: 'motorized',
    motorType: 'battery',
    standardCassette: 'square-v2'
  },
  shippingState: 'CA',
  includeShipping: true,
  includeTax: true
});
```

### 3. Price Import Service (`backend/services/price-import-service.js`)

**Purpose:** Import manufacturer prices from PDF/CSV files

**Key Methods:**
```javascript
scanDirectory(dirPath)              // Find price files
importFromPDF(filePath, options)    // Parse PDF (basic)
importFromCSV(filePath, options)    // Parse CSV (recommended)
generateCSVTemplate(productType)    // Create template
getImportHistory(options)           // View import logs
compareImports(import1, import2)    // Diff two imports
```

### 4. Database Schema (`backend/services/database-schema.js`)

**Purpose:** Define and extend database structure

**Collections added:**
- `manufacturers` - Manufacturer profiles
- `manufacturerPrices` - Imported price records
- `customerPriceRules` - Margin configuration
- `orderStatusHistory` - Order audit trail
- `shipments` - Shipping records
- `trackingEvents` - Carrier tracking updates
- `invoices` - Invoice records
- `payments` - Payment records
- `refunds` - Refund records
- `expenses` - Post-order costs
- `taxRecords` - Tax collection data
- `analyticsEvents` - Anonymized analytics
- `priceImportLogs` - Import history
- `emailLogs` - Email records

### 5. System Configuration (`backend/config/system-config.js`)

**Purpose:** Centralized configuration management

**Configuration areas:**
```javascript
systemConfig.getPricing()      // Dimension multipliers, warranty
systemConfig.getTax()          // Tax rates by state
systemConfig.getShipping()     // Zones, carriers, thresholds
systemConfig.getBusinessRules() // Min/max orders, lead times
systemConfig.getProductRules() // Dimension limits
```

---

## File-by-File Reference

### Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `server.js` | ~7500 | Main Express server with all routes |
| `middleware/auth.js` | ~80 | JWT authentication |
| `middleware/rbac.js` | ~320 | Role-based access control |
| `middleware/validation.js` | ~350 | Input validation |
| `services/extended-pricing-engine.js` | ~500 | Pricing calculations |
| `services/price-import-service.js` | ~600 | PDF/CSV import |
| `services/database-schema.js` | ~450 | Schema definitions |
| `services/pricing-engine.js` | ~560 | Base pricing (original) |
| `services/audit-logger.js` | ~200 | Audit trail logging |
| `services/media-manager.js` | ~300 | Asset management |
| `config/system-config.js` | ~265 | Configuration |
| `database.json` | ~300KB | JSON database |

### Frontend Admin Pages

| File | Purpose |
|------|---------|
| `admin/index.html` | Dashboard home with stats |
| `admin/orders.html` | Order management |
| `admin/products.html` | Product catalog management |
| `admin/fabrics.html` | Fabric management |
| `admin/hardware-options.html` | Hardware configuration |
| `admin/system-config.html` | System settings |
| `admin/product-page-editor.html` | Visual page builder |
| `admin/security/users.html` | User management |
| `admin/security/audit-logs.html` | Audit log viewer |
| `admin/marketing/promotions.html` | Promotion management |

### Frontend Customer Pages

| File | Purpose |
|------|---------|
| `index.html` | Homepage |
| `product.html` | Product detail page |
| `shop.html` | Product catalog |
| `cart.html` | Shopping cart |

---

## Business Logic

### 1. Pricing Logic

**Manufacturer Cost Lookup:**
```
1. Search manufacturerPrices by:
   - productType (roller, zebra, honeycomb, roman)
   - fabricCode (e.g., 82032A)
   - status = 'active'

2. If price matrix exists, find matching range:
   - widthRange: [min, max]
   - heightRange: [min, max]
   - price: unit cost

3. If no matrix, use basePrice or pricePerSqFt

4. Fallback: dimension-based calculation
   - Base: $15 for 864 sq inches (24x36)
   - Scale by actual square inches
```

**Margin Rules:**
```
Priority order (highest to lowest):
1. Product + Fabric specific rule
2. Product specific rule
3. Fabric specific rule
4. Product type rule (roller/zebra/etc)
5. Default rule (all products)
6. Hardcoded 40% if no rules found

Margin types:
- percentage: cost * (margin/100)
- fixed: cost + fixedAmount
- tiered: different % based on cost ranges
```

### 2. Order Status Workflow

```javascript
const validTransitions = {
  'pending': ['payment_received', 'cancelled'],
  'payment_received': ['sent_to_manufacturer', 'refunded', 'cancelled'],
  'sent_to_manufacturer': ['in_manufacturing', 'refunded'],
  'in_manufacturing': ['in_testing', 'disputed'],
  'in_testing': ['in_shipping', 'in_manufacturing', 'disputed'],
  'in_shipping': ['delivered', 'disputed'],
  'delivered': ['closed', 'refunded', 'disputed'],
  'closed': ['refunded'],
  'refunded': [],
  'disputed': ['refunded', 'closed'],
  'cancelled': []
};
```

### 3. Tax Calculation

```javascript
const taxRules = [
  { region: 'CA', rate: 0.0725, name: 'California Sales Tax' },
  { region: 'NY', rate: 0.08, name: 'New York Sales Tax' },
  { region: 'TX', rate: 0.0625, name: 'Texas Sales Tax' },
  { region: 'FL', rate: 0.06, name: 'Florida Sales Tax' },
  { region: 'default', rate: 0.08, name: 'Default Tax' }
];
```

### 4. Shipping Calculation

```javascript
// Free shipping threshold: $499
// Zone-based pricing:
const zones = {
  domestic: {  // Continental US
    rates: [
      { maxWeight: 5, price: 9.99 },
      { maxWeight: 20, price: 14.99 },
      { maxWeight: 50, price: 24.99 },
      { maxWeight: Infinity, price: 39.99 }
    ]
  },
  alaskaHawaii: {
    rates: [
      { maxWeight: 5, price: 19.99 },
      { maxWeight: 20, price: 34.99 },
      { maxWeight: Infinity, price: 59.99 }
    ]
  }
};
```

---

## Common Tasks

### Adding a New Product Type

1. Add category in database:
```javascript
// In database.json -> categories
{
  "id": "uuid",
  "name": "Vertical Blinds",
  "slug": "vertical-blinds",
  "description": "Custom vertical blinds"
}
```

2. Add product:
```javascript
// In database.json -> products
{
  "id": "uuid",
  "category_id": "category-uuid",
  "name": "Custom Vertical Blinds",
  "slug": "custom-vertical-blinds",
  "base_price": 55,
  "is_active": true
}
```

3. Add margin rule:
```javascript
// In database.json -> customerPriceRules
{
  "id": "uuid",
  "name": "Vertical Blinds Margin",
  "productType": "vertical",
  "marginType": "percentage",
  "marginValue": 45,
  "status": "active"
}
```

### Importing Manufacturer Prices

**Via CSV (Recommended):**

1. Create CSV file:
```csv
fabric_code,fabric_name,category,base_price
VB001,White Vertical,light_filtering,28.00
VB002,Gray Vertical,blackout,35.00
```

2. Call import API:
```bash
curl -X POST http://localhost:3001/api/admin/manufacturer-prices/import \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@prices.csv" \
  -F "manufacturerId=mfr-001" \
  -F "productType=vertical"
```

### Changing Margin Rules

```bash
# Create new margin rule
curl -X POST http://localhost:3001/api/admin/price-rules \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Holiday Promo - Lower Margins",
    "productType": "all",
    "marginType": "percentage",
    "marginValue": 30,
    "priority": 10,
    "effectiveDate": "2025-12-01",
    "expirationDate": "2025-12-31"
  }'
```

### Updating Order Status

```bash
curl -X PUT http://localhost:3001/api/admin/orders/ORD-123/status \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_manufacturing",
    "notes": "Started production"
  }'
```

---

## Troubleshooting

### Price Not Updating on Frontend

1. Check browser cache - hard refresh (Cmd+Shift+R)
2. Verify manufacturer price exists:
```javascript
// In database.json -> manufacturerPrices
// Look for matching fabricCode and productType
```
3. Check margin rules are active:
```javascript
// In database.json -> customerPriceRules
// Ensure status: "active" and valid dates
```
4. Verify system config cache:
```javascript
// Call systemConfig.invalidateCache() or restart server
```

### Order Status Won't Change

1. Check valid transitions (see workflow above)
2. Verify user has permission: `orders.update`
3. Check audit logs for errors

### PDF Import Fails

1. Use CSV fallback instead (more reliable)
2. Check PDF has text-based tables (not scanned images)
3. Install pdf-parse: `npm install pdf-parse`

### Authentication Issues

1. Token expired (24-hour expiry) - re-login
2. Check Authorization header format: `Bearer <token>`
3. Verify user exists in `adminUsers` collection

---

## Extending the System

### Adding New Admin Page

1. Create HTML file in `frontend/public/admin/`
2. Include standard layout:
```html
<!DOCTYPE html>
<html>
<head>
  <title>New Page - Admin</title>
  <link rel="stylesheet" href="css/admin.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
  <!-- Include sidebar -->
  <!-- Your content -->

  <script src="js/admin.js"></script>
  <script>
    Auth.requireAuth(); // Protect page
    // Your JavaScript
  </script>
</body>
</html>
```

### Adding New API Endpoint

1. Add route in `server.js`:
```javascript
app.get('/api/admin/new-endpoint', authMiddleware, requirePermission('resource.view'), async (req, res) => {
  try {
    const db = loadDatabase();
    // Your logic
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Adding New Service

1. Create file in `backend/services/`
2. Export singleton:
```javascript
class NewService {
  // Methods
}
const newService = new NewService();
module.exports = { newService, NewService };
```
3. Import in `server.js`:
```javascript
const { newService } = require('./services/new-service');
```

---

## Contact & Support

For issues or questions:
1. Check this documentation first
2. Review audit logs for error details
3. Check browser console for frontend errors
4. Check server console for backend errors

**Key Files to Check When Debugging:**
- `backend/server.js` - API routes
- `backend/database.json` - Data state
- Browser DevTools → Network tab - API calls
- Browser DevTools → Console - JS errors
