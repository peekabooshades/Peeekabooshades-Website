# Peekaboo Shades - Pricing Source-to-Target Mapping Documentation

## Document Overview

This document provides a comprehensive mapping of how pricing data flows through the Peekaboo Shades e-commerce system from source (database) to target (Product UI, Orders, Invoice, Manufacturer Portal).

**Last Updated:** 2026-01-04
**Version:** 1.0

---

## Table of Contents

1. [Pricing Architecture Overview](#1-pricing-architecture-overview)
2. [Source Data Locations](#2-source-data-locations)
3. [Dimension-Based Pricing (Fabric)](#3-dimension-based-pricing-fabric)
4. [Motor Brand Pricing](#4-motor-brand-pricing)
5. [Remote Type Pricing](#5-remote-type-pricing)
6. [Solar Panel Pricing](#6-solar-panel-pricing)
7. [Valance/Cassette Pricing (Per-SQM)](#7-valancecassette-pricing-per-sqm)
8. [Bottom Rail Pricing (Per-SQM)](#8-bottom-rail-pricing-per-sqm)
9. [Accessories Pricing](#9-accessories-pricing)
10. [Margin Calculation](#10-margin-calculation)
11. [Price Snapshot Structure](#11-price-snapshot-structure)
12. [Portal Display Mapping](#12-portal-display-mapping)
13. [Example Calculation Walkthrough](#13-example-calculation-walkthrough)

---

## 1. Pricing Architecture Overview

### Single Source of Truth
All pricing calculations happen server-side in the **Extended Pricing Engine** (`backend/services/extended-pricing-engine.js`). The frontend NEVER calculates prices - it only displays what the server provides.

### Pricing Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRICING DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCE (database.json)                                                      │
│  ├── manufacturerPrices[]      → Fabric price per m²                         │
│  ├── motorBrands[]             → Motor brand prices                          │
│  ├── productContent.hardwareOptions                                          │
│  │   ├── valanceType[]         → Cassette/valance prices                     │
│  │   ├── bottomRail[]          → Bottom rail prices                          │
│  │   ├── remoteType[]          → Remote control prices                       │
│  │   └── solarPanel[]          → Solar panel prices                          │
│  ├── productContent.accessories[]  → Smart Hub, USB Charger                  │
│  └── customerPriceRules[]      → Margin rules                                │
│                                                                              │
│            ↓ (ExtendedPricingEngine.calculateCustomerPrice)                  │
│                                                                              │
│  TRANSFORMATION                                                               │
│  ├── Convert inches to meters (× 0.0254)                                     │
│  ├── Calculate area in m² (width × height)                                   │
│  ├── Apply minimum area (1.2 m² for roller)                                  │
│  ├── Fabric cost = area × pricePerSqMeter                                    │
│  ├── Apply margin (50% for Affordable Roller Blinds)                         │
│  ├── Add options costs (motor, remote, solar, valance, rail, accessories)    │
│  └── Generate price_snapshot with full breakdown                             │
│                                                                              │
│            ↓ (Stored in cart → order)                                        │
│                                                                              │
│  TARGET (Displayed in Portals)                                               │
│  ├── Product UI         → unit_price, options breakdown                      │
│  ├── Orders Portal      → line_total, price_snapshot                         │
│  ├── Invoice Portal     → unitPrice, lineTotal, configuration columns        │
│  └── Manufacturer Portal → manufacturerCost from price_snapshot              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Source Data Locations

### Database Collections

| Collection | Location | Purpose |
|------------|----------|---------|
| `manufacturerPrices` | `database.json` | Fabric prices per m² |
| `motorBrands` | `database.json` | Motor brand pricing |
| `productContent.hardwareOptions` | `database.json` | Hardware option pricing |
| `productContent.accessories` | `database.json` | Accessory pricing |
| `customerPriceRules` | `database.json` | Margin rules |

### Admin UI for Pricing Management

| Admin Page | URL | Controls |
|------------|-----|----------|
| Product Pricing | `/admin/product-pricing.html` | Fabric margins, motor brands, hardware options |
| Margins | `/admin/margins.html` | Customer price rules |
| Products | `/admin/products.html` | Product-specific pricing |

---

## 3. Dimension-Based Pricing (Fabric)

### Source
**Collection:** `manufacturerPrices[]`

```json
{
  "id": "mp-e8dc5f8b",
  "fabricCode": "82086B",
  "productType": "roller",
  "pricePerSqMeter": 12.99,
  "pricePerSqMeterCordless": 18.99,
  "minAreaSqMeter": 1.2,
  "manualMargin": 40
}
```

### Transformation Logic

```
Step 1: Convert Dimensions (inches → meters)
─────────────────────────────────────────────
  widthMeters = width(inches) × 0.0254
  heightMeters = height(inches) × 0.0254

  Example: 40" × 50"
  widthMeters = 40 × 0.0254 = 1.016 m
  heightMeters = 50 × 0.0254 = 1.27 m

Step 2: Calculate Area (m²)
─────────────────────────────────────────────
  rawArea = widthMeters × heightMeters

  Example: 1.016 × 1.27 = 1.29 m²

Step 3: Apply Minimum Area
─────────────────────────────────────────────
  Product Type    Minimum Area
  ───────────────────────────
  roller          1.2 m²
  zebra           1.5 m²
  honeycomb       1.2 m²
  roman           1.5 m²

  appliedArea = MAX(rawArea, minArea)

  Example: MAX(1.29, 1.2) = 1.29 m² (no minimum applied)

Step 4: Calculate Manufacturer Cost
─────────────────────────────────────────────
  manufacturerCost = appliedArea × pricePerSqMeter

  Example: 1.29 × 12.99 = $16.76
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:299-402`
Function: `getManufacturerCost()`

---

## 4. Motor Brand Pricing

### Source
**Collection:** `motorBrands[]`

| ID | Brand | Manufacturer Cost | Margin | Customer Price |
|----|-------|------------------|--------|----------------|
| motor-aok | AOK Motor (App Control) | $45.00 | 40% | $63.00 |
| motor-dooya | Dooya Motor (Remote) | $47.00 | 40% | $65.80 |
| motor-plugin | Plugin Wire Motor | $55.00 | 40% | $77.00 |

### Transformation Logic

```
Step 1: Lookup Motor Brand
─────────────────────────────────────────────
  IF controlType === 'motorized' THEN
    brandId = configuration.motorBrand

    Look up in motorBrands[] by:
    - id === brandId
    - value === brandId
    - code === brandId
    - name.includes(brandId)

Step 2: Calculate Price
─────────────────────────────────────────────
  Formula: price = manufacturerCost × (1 + margin/100)

  Example (Dooya):
    manufacturerCost = $47.00
    margin = 40%
    price = $47.00 × 1.40 = $65.80
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:601-649`
Function: `calculateOptionCosts()` - motorization section

---

## 5. Remote Type Pricing

### Source
**Collection:** `productContent.hardwareOptions.remoteType[]`

| ID | Label | Manufacturer Cost | Margin | Customer Price |
|----|-------|------------------|--------|----------------|
| remote-001 | Single Channel | $6.00 | 40% | $8.40 |
| remote-002 | 6 Channel | $6.60 | 40% | $9.24 |
| remote-003 | 15 Channel | $11.35 | 40% | $15.89 |

### Transformation Logic

```
Step 1: Lookup Remote Type (ONLY when motorized)
─────────────────────────────────────────────
  IF controlType === 'motorized' AND remoteType is set THEN
    Look up in hardwareOptions.remoteType[] by value

Step 2: Apply Price
─────────────────────────────────────────────
  IF priceType === 'flat' THEN
    price = option.price (pre-calculated with margin)

  Example (6-Channel):
    manufacturerCost = $6.60
    price = $9.24 (includes 40% margin)
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:651-664`
Function: `calculateOptionCosts()` - remote section

---

## 6. Solar Panel Pricing

### Source
**Collection:** `productContent.hardwareOptions.solarPanel[]`

| ID | Label | Manufacturer Cost | Margin | Customer Price | Price Type |
|----|-------|------------------|--------|----------------|------------|
| solar-001 | Yes | $20.50 | 40% | $28.70 | flat |
| solar-002 | No | $0.00 | - | $0.00 | flat |

### Transformation Logic

```
Step 1: Check Solar Selection
─────────────────────────────────────────────
  IF controlType === 'motorized' AND solarType === 'yes' THEN
    Add solar panel cost

Step 2: Apply Price
─────────────────────────────────────────────
  price = $28.70 (flat)
  manufacturerCost = $20.50
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:666-681`
Function: `calculateOptionCosts()` - solar section

---

## 7. Valance/Cassette Pricing (Per-SQM)

### Source
**Collection:** `productContent.hardwareOptions.valanceType[]`

| ID | Label | Mfr Cost/m² | Margin | Price/m² | Price Type |
|----|-------|-------------|--------|----------|------------|
| val-001 | Square V2 | $0.00 | - | $0.00 | flat |
| val-002 | Fabric Wrapped V3 | $2.20/m² | 40% | $3.08/m² | sqm |
| val-003 | Fabric Inserted S1 | $2.20/m² | 40% | $3.08/m² | sqm |
| val-004 | Curve White S2 | $2.20/m² | 40% | $3.08/m² | sqm |
| val-005 | Fabric Wrapped S3 | $2.20/m² | 40% | $3.08/m² | sqm |
| val-006 | Simple Rolling | $0.00 | - | $0.00 | flat |

### Transformation Logic

```
Step 1: Calculate Area (m²) - Same as Fabric
─────────────────────────────────────────────
  areaSqMeters = MAX(width × 0.0254 × height × 0.0254, 1.2)

  Example: 40" × 50" = 1.29 m²

Step 2: Lookup Valance Type
─────────────────────────────────────────────
  valanceValue = configuration.standardCassette
  Look up in hardwareOptions.valanceType[] by value

Step 3: Calculate Price
─────────────────────────────────────────────
  IF priceType === 'sqm' THEN
    price = areaSqMeters × pricePerSqm
    mfrCost = areaSqMeters × mfrCostPerSqm
  ELSE (flat)
    price = option.price

  Example (Fabric Wrapped V3, 1.29 m²):
    mfrCost = 1.29 × $2.20 = $2.84
    price = 1.29 × $3.08 = $3.97
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:703-720`
Function: `calculateOptionCosts()` - valance section

---

## 8. Bottom Rail Pricing (Per-SQM)

### Source
**Collection:** `productContent.hardwareOptions.bottomRail[]`

| ID | Label | Mfr Cost/m² | Margin | Price/m² | Price Type |
|----|-------|-------------|--------|----------|------------|
| rail-001 | Type A Waterdrop | $0.00 | - | $0.00 | flat |
| rail-002 | Simple Rolling | $2.20/m² | 40% | $3.08/m² | sqm |
| rail-003 | Type B | $2.20/m² | 40% | $3.08/m² | sqm |
| rail-004 | Type C Fabric Wrapped | $2.20/m² | 40% | $3.08/m² | sqm |
| rail-005 | Type D | $2.20/m² | 40% | $3.08/m² | sqm |

### Transformation Logic

```
Step 1: Calculate Area (m²) - Same as Fabric
─────────────────────────────────────────────
  areaSqMeters = MAX(width × 0.0254 × height × 0.0254, 1.2)

Step 2: Lookup Bottom Rail
─────────────────────────────────────────────
  bottomBarValue = configuration.standardBottomBar
  Look up in hardwareOptions.bottomRail[] by value

Step 3: Calculate Price
─────────────────────────────────────────────
  IF priceType === 'sqm' THEN
    price = areaSqMeters × pricePerSqm
    mfrCost = areaSqMeters × mfrCostPerSqm

  Example (Type B, 1.29 m²):
    mfrCost = 1.29 × $2.20 = $2.84
    price = 1.29 × $3.08 = $3.97
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:722-739`
Function: `calculateOptionCosts()` - bottom rail section

---

## 9. Accessories Pricing

### Source
**Collection:** `productContent.accessories[]`

| ID | Name | Manufacturer Cost | Margin | Customer Price |
|----|------|------------------|--------|----------------|
| acc-001 | Smart Hub | $23.50 | 40% | $32.90 |
| acc-002 | USB Charger | $5.00 | 40% | $7.00 |

### Transformation Logic

```
Step 1: Check Accessory Quantities
─────────────────────────────────────────────
  smartHubQty = configuration.smartHubQty || 0
  usbChargerQty = configuration.usbChargerQty || 0

Step 2: Calculate Total Price
─────────────────────────────────────────────
  IF smartHubQty > 0 THEN
    smartHubTotal = smartHubQty × $32.90
    smartHubMfrTotal = smartHubQty × $23.50

  IF usbChargerQty > 0 THEN
    usbChargerTotal = usbChargerQty × $7.00
    usbChargerMfrTotal = usbChargerQty × $5.00

  Example (1 Smart Hub + 1 USB Charger):
    total = $32.90 + $7.00 = $39.90
    mfrTotal = $23.50 + $5.00 = $28.50
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:769-798`
Function: `calculateOptionCosts()` - accessories section

---

## 10. Margin Calculation

### Source
**Collection:** `customerPriceRules[]`

### Priority Order

1. **Per-Fabric Margin** (from manufacturerPrices.manualMargin)
2. **Product + Fabric Specific** (customerPriceRules with productId + fabricCode)
3. **Product Specific** (customerPriceRules with productId only)
4. **Fabric Specific** (customerPriceRules with fabricCode only)
5. **Product Type** (customerPriceRules with productType)
6. **Default** (40%)

### Current Active Rules

| Rule | Product | Margin | Priority |
|------|---------|--------|----------|
| Affordable Roller Blinds | b23180d5-7989-4f9d-bf28-9b210cb31256 | 50% | 10 |
| Default Roller | (all roller) | 0% | 1 |
| Default Zebra | (all zebra) | 45% | 1 |

### Transformation Logic

```
Step 1: Find Applicable Rule
─────────────────────────────────────────────
  Check per-fabric margin first (manualMargin on manufacturerPrices)
  Then check customerPriceRules by priority
  Fall back to default 40%

Step 2: Calculate Customer Price
─────────────────────────────────────────────
  marginType    Formula
  ─────────────────────────────────────────
  percentage    customerPrice = mfrCost × (1 + margin/100)
  fixed         customerPrice = mfrCost + marginAmount
  tiered        customerPrice = mfrCost × (1 + tierMargin/100)

  Example (Roller, 50% margin):
    mfrCost = $16.76
    marginAmount = $16.76 × 0.50 = $8.38
    customerPrice = $16.76 + $8.38 = $25.14

    (Note: Rounded to $31.76 due to minimum margin of $15)
```

### Code Reference
File: `backend/services/extended-pricing-engine.js:408-535`
Function: `applyMarginRules()`

---

## 11. Price Snapshot Structure

When an item is added to cart, a complete price snapshot is captured:

```json
{
  "price_snapshot": {
    "captured_at": "2026-01-04T22:40:12.203Z",
    "manufacturer_price": {
      "unit_cost": 16.76,
      "total_cost": 16.76,
      "source": "manufacturer_price",
      "fabric_code": "82086B"
    },
    "margin": {
      "type": "percentage",
      "value": 50,
      "amount": 15,
      "percentage": 89.49
    },
    "customer_price": {
      "unit_price": 140.64,
      "line_total": 140.64,
      "options_total": 108.88,
      "options_breakdown": [
        {
          "type": "motorization",
          "code": "motorized",
          "name": "AOK Motor (App Control)",
          "brand": "aok",
          "price": 63,
          "manufacturerCost": 45
        },
        {
          "type": "remote",
          "code": "6-channel",
          "name": "6 Channel",
          "price": 9.24,
          "manufacturerCost": 6.6
        },
        {
          "type": "solar",
          "code": "solar-panel",
          "name": "Yes",
          "price": 28.7,
          "manufacturerCost": 20.5
        },
        {
          "type": "valance_type",
          "code": "fabric-wrapped-v3",
          "name": "Fabric Wrapped V3",
          "price": 3.97,
          "priceType": "sqm",
          "areaSqMeters": 1.29,
          "manufacturerCost": 2.84
        },
        {
          "type": "bottom_rail",
          "code": "type-b",
          "name": "Type B",
          "price": 3.97,
          "priceType": "sqm",
          "areaSqMeters": 1.29,
          "manufacturerCost": 2.84
        }
      ]
    }
  }
}
```

---

## 12. Portal Display Mapping

### Product UI Page
**URL:** `/product/affordable-custom-roller-blinds`

| Display Field | Source | Notes |
|--------------|--------|-------|
| Base Price | `pricing.unitPrice - pricing.options.total` | Fabric + margin |
| Option Prices | `pricing.options.breakdown[].price` | Each option shown separately |
| Total Price | `pricing.unitPrice` | Sum of base + options |

### Admin Orders Portal
**URL:** `/admin/orders.html`

| Display Field | Source | Notes |
|--------------|--------|-------|
| Order Total | `order.pricing.total` | Includes tax |
| Item Price | `item.unit_price` | From price snapshot |
| Line Total | `item.line_total` | unit_price × quantity |
| Subtotal | `order.pricing.subtotal` | Sum of line totals |
| Tax | `order.pricing.tax` | Subtotal × tax_rate |

### Invoice Portal
**URL:** `/admin/invoices.html`

| Column | Source | Notes |
|--------|--------|-------|
| Invoice # | `invoice.invoiceNumber` | Auto-generated |
| Room | `item.roomLabel` | From cart |
| Dimensions | `item.width × item.height` | In inches |
| Unit Price | `item.unitPrice` | From price snapshot |
| Line Total | `item.lineTotal` | unit_price × quantity |
| Fabric Code | `configuration.fabricCode` | Parsed from JSON |
| Control Type | `configuration.controlType` | manual/motorized/cordless |
| Motor Type | `configuration.motorBrand` | AOK/Dooya/Plugin |
| Remote Type | `configuration.remoteType` | Channel count |
| Valance | `configuration.standardCassette` | Cassette type |
| Bottom Rail | `configuration.standardBottomBar` | Rail type |

### Manufacturer Portal
**URL:** `/manufacturer/`

| Display Field | Source | Notes |
|--------------|--------|-------|
| Fabric Cost | `price_snapshot.manufacturer_price.unit_cost` | Per m² calculation |
| Motor Cost | `options_breakdown[type=motorization].manufacturerCost` | From motor brands |
| Remote Cost | `options_breakdown[type=remote].manufacturerCost` | From hardware options |
| Solar Cost | `options_breakdown[type=solar].manufacturerCost` | From hardware options |
| Valance Cost | `options_breakdown[type=valance_type].manufacturerCost` | Per-sqm if applicable |
| Rail Cost | `options_breakdown[type=bottom_rail].manufacturerCost` | Per-sqm if applicable |
| Total Mfr Cost | Sum of all manufacturerCost fields | Used for payables |

---

## 13. Example Calculation Walkthrough

### Scenario: 40" × 50" Roller Blind, Motorized with AOK + Accessories

**Input Configuration:**
```json
{
  "width": 40,
  "height": 50,
  "fabricCode": "82086B",
  "controlType": "motorized",
  "motorBrand": "aok",
  "motorType": "battery",
  "remoteType": "6-channel",
  "solarType": "yes",
  "standardCassette": "fabric-wrapped-v3",
  "standardBottomBar": "type-b"
}
```

### Step-by-Step Calculation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: DIMENSION CONVERSION                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Width:  40" × 0.0254 = 1.016 m                                               │
│ Height: 50" × 0.0254 = 1.270 m                                               │
│ Area:   1.016 × 1.270 = 1.290 m² (> 1.2 m² minimum, no adjustment)          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: FABRIC/BASE PRICE                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source: manufacturerPrices[fabricCode=82086B]                                │
│ Price per m²: $12.99                                                         │
│                                                                              │
│ Manufacturer Cost = 1.29 m² × $12.99/m² = $16.76                            │
│                                                                              │
│ Margin Rule: Affordable Roller Blinds = 50%                                  │
│ Minimum Margin: $15.00                                                       │
│                                                                              │
│ Calculated Margin = $16.76 × 0.50 = $8.38                                   │
│ Applied Margin = MAX($8.38, $15.00) = $15.00                                │
│                                                                              │
│ Base Customer Price = $16.76 + $15.00 = $31.76                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: MOTOR PRICE                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source: motorBrands[value=aok]                                               │
│                                                                              │
│ Manufacturer Cost: $45.00                                                    │
│ Customer Price:    $63.00                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: REMOTE PRICE                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source: hardwareOptions.remoteType[value=6-channel]                          │
│                                                                              │
│ Manufacturer Cost: $6.60                                                     │
│ Customer Price:    $9.24                                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: SOLAR PANEL PRICE                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source: hardwareOptions.solarPanel[value=yes]                                │
│                                                                              │
│ Manufacturer Cost: $20.50                                                    │
│ Customer Price:    $28.70                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: VALANCE/CASSETTE PRICE (Per-SQM)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source: hardwareOptions.valanceType[value=fabric-wrapped-v3]                 │
│ Price Type: sqm                                                              │
│                                                                              │
│ Manufacturer Cost = 1.29 m² × $2.20/m² = $2.84                              │
│ Customer Price    = 1.29 m² × $3.08/m² = $3.97                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: BOTTOM RAIL PRICE (Per-SQM)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Source: hardwareOptions.bottomRail[value=type-b]                             │
│ Price Type: sqm                                                              │
│                                                                              │
│ Manufacturer Cost = 1.29 m² × $2.20/m² = $2.84                              │
│ Customer Price    = 1.29 m² × $3.08/m² = $3.97                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 8: TOTALS                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Component              Mfr Cost    Customer Price                            │
│ ─────────────────────────────────────────────────                            │
│ Fabric (base)          $16.76      $31.76                                    │
│ AOK Motor              $45.00      $63.00                                    │
│ 6-Channel Remote       $6.60       $9.24                                     │
│ Solar Panel            $20.50      $28.70                                    │
│ Fabric Wrapped V3      $2.84       $3.97                                     │
│ Type B Bottom Rail     $2.84       $3.97                                     │
│ ─────────────────────────────────────────────────                            │
│ TOTAL                  $94.54      $140.64                                   │
│                                                                              │
│ Gross Profit: $140.64 - $94.54 = $46.10                                     │
│ Gross Margin: 32.8%                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verification

| Portal | Field | Value | Status |
|--------|-------|-------|--------|
| Product UI | Unit Price | $140.64 | ✓ |
| Orders Portal | Line Total | $140.64 | ✓ |
| Invoice Portal | Unit Price | $140.64 | ✓ |
| Manufacturer Portal | Mfr Cost | $94.54 | ✓ |

---

## Appendix A: API Endpoints

### Price Quote Endpoint
```
POST /api/products/:slug/quote
Body: { width, height, quantity, options }
Returns: Complete pricing breakdown
```

### Add to Cart Endpoint
```
POST /api/cart
Body: { productId, width, height, configuration }
Returns: Cart item with price_snapshot
```

### Checkout Endpoint
```
POST /api/checkout
Body: { sessionId, customer, payment }
Returns: Order with pricing and invoice
```

---

## Appendix B: Code File References

| File | Purpose |
|------|---------|
| `backend/services/extended-pricing-engine.js` | Main pricing calculations |
| `backend/services/pricing-engine.js` | Legacy pricing (deprecated) |
| `backend/services/invoice-service.js` | Invoice generation |
| `backend/services/order-service.js` | Order creation |
| `backend/server.js` | API endpoints, cart handling |
| `frontend/public/product.html` | Product UI display |
| `frontend/public/admin/orders.html` | Admin orders display |
| `frontend/public/admin/invoices.html` | Admin invoice display |
| `frontend/public/manufacturer/index.html` | Manufacturer portal |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-04 | Claude | Initial documentation |
