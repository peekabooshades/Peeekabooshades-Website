# Peekaboo Shades - Complete Pricing Source-to-Target Mapping

## Document Overview

Complete pricing documentation showing ALL options and sub-options with:
- Source location in database
- Manufacturer Cost
- Customer Price
- Margin %
- Transformation formula
- Display in each portal

**Last Updated:** 2026-01-04
**Version:** 2.0

---

## Table of Contents

1. [Pricing Flow Architecture](#1-pricing-flow-architecture)
2. [Dimension Calculation](#2-dimension-calculation)
3. [Fabric Base Pricing](#3-fabric-base-pricing)
4. [Control Type Options](#4-control-type-options)
5. [Motor Brand Options](#5-motor-brand-options)
6. [Remote Type Options](#6-remote-type-options)
7. [Solar Panel Options](#7-solar-panel-options)
8. [Valance/Cassette Options](#8-valancecassette-options)
9. [Bottom Rail Options](#9-bottom-rail-options)
10. [Roller Type Options](#10-roller-type-options)
11. [Mount Type Options](#11-mount-type-options)
12. [Accessories](#12-accessories)
13. [Margin Rules](#13-margin-rules)
14. [Portal Display Mapping](#14-portal-display-mapping)
15. [Complete Calculation Example](#15-complete-calculation-example)

---

## 1. Pricing Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRICING DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  DATABASE (database.json)                                                        │
│  ├── manufacturerPrices[]           → Fabric $/m² (manual & cordless)           │
│  ├── motorBrands[]                  → Motor brand pricing                        │
│  └── productContent.hardwareOptions                                              │
│      ├── controlType[]              → Manual/Cordless/Motorized                  │
│      ├── valanceType[]              → Cassette options (flat & per-sqm)          │
│      ├── bottomRail[]               → Bottom rail options (flat & per-sqm)       │
│      ├── remoteType[]               → Remote control options                     │
│      ├── solarPanel[]               → Solar panel options                        │
│      ├── rollerType[]               → Forward/Reverse roll                       │
│      ├── mountType[]                → Inside/Outside mount                       │
│      └── accessories[]              → Smart Hub, USB Charger                     │
│                                                                                  │
│                    ↓ ExtendedPricingEngine.calculateCustomerPrice()              │
│                                                                                  │
│  TRANSFORMATION                                                                  │
│  ├── Convert inches → meters (× 0.0254)                                         │
│  ├── Calculate area m² = width_m × height_m                                     │
│  ├── Apply minimum area (1.2 m² for roller)                                     │
│  ├── Fabric mfr cost = area × pricePerSqMeter                                   │
│  ├── Apply margin rule → customer base price                                    │
│  ├── Add each option cost (mfr + margin = customer)                             │
│  └── Generate price_snapshot with full breakdown                                 │
│                                                                                  │
│                    ↓ Stored in cart_items → orders                               │
│                                                                                  │
│  TARGET PORTALS                                                                  │
│  ├── Product UI (/product/...)      → Shows customer prices per option          │
│  ├── Admin Orders (/admin/orders)   → Shows order totals & line items           │
│  ├── Admin Invoice (/admin/invoices)→ Shows invoice with config columns         │
│  └── Manufacturer (/manufacturer/)  → Shows manufacturer costs only             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dimension Calculation

### Formula: Inches to Square Meters

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DIMENSION CONVERSION (Example: 40" × 50")                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Step 1: Convert to Meters                                                        │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Width:  40 inches × 0.0254 = 1.016 meters                                     │
│   Height: 50 inches × 0.0254 = 1.270 meters                                     │
│                                                                                  │
│ Step 2: Calculate Raw Area                                                       │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Raw Area = 1.016 m × 1.270 m = 1.290 m²                                       │
│                                                                                  │
│ Step 3: Apply Minimum Area                                                       │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Product Type     Minimum Area                                                  │
│   ─────────────────────────────                                                  │
│   Roller           1.2 m²                                                        │
│   Zebra            1.5 m²                                                        │
│   Honeycomb        1.2 m²                                                        │
│   Roman            1.5 m²                                                        │
│                                                                                  │
│   Applied Area = MAX(1.290, 1.2) = 1.290 m² (no minimum applied)                │
│                                                                                  │
│   If dimensions were 30" × 30":                                                  │
│   Raw = 0.762 × 0.762 = 0.581 m²                                                │
│   Applied = MAX(0.581, 1.2) = 1.2 m² (minimum applied)                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Source
- **File:** `backend/services/extended-pricing-engine.js`
- **Function:** `getManufacturerCost()` lines 299-402
- **Constants:** `INCHES_TO_METERS = 0.0254`, `MIN_AREA.roller = 1.2`

---

## 3. Fabric Base Pricing

### Source
- **Database:** `manufacturerPrices[]`
- **Admin UI:** `/admin/product-pricing.html`

### Pricing Table (Per Square Meter - Manufacturer Cost)

| Fabric Code | Category | Manual Mfr $/m² | Cordless Mfr $/m² |
|-------------|----------|-----------------|-------------------|
| 82086K | semi-blackout | $12.99 | $18.99 |
| 82086W | semi-blackout | $12.99 | $16.24 |
| 82086B | semi-blackout | $12.99 | $16.24 |
| 82086C | semi-blackout | $12.99 | $16.24 |
| 82086E | semi-blackout | $12.99 | $16.24 |

### Margin Rules (Affordable Roller Blinds)
- **Margin %:** 50%
- **NO Minimum Margin** - margin is purely percentage based

### Business Logic Formula
```
Customer Price = Mfr Cost + (Mfr Cost × Margin%)
               = Mfr Cost × (1 + Margin%)
```

### Calculated Prices for 40" × 50" (1.29 m²)

| Control Type | Mfr Cost (area × $/m²) | Margin % | Margin Amount | Customer Price |
|--------------|------------------------|----------|---------------|----------------|
| **Manual** | 1.29 × $12.99 = **$16.76** | 50% | $16.76 × 50% = **$8.38** | $16.76 + $8.38 = **$25.14** |
| **Cordless** | 1.29 × $16.24 = **$20.95** | 50% | $20.95 × 50% = **$10.48** | $20.95 + $10.48 = **$31.43** |

### Warning System
If margin is NOT defined for a fabric in Admin > Product Pricing, the backend will:
1. Log a warning: `⚠️ WARNING: No margin defined for fabric {code}`
2. Return the product at manufacturer cost (no profit)
3. Include a `warning` field in the API response

### Transformation Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FABRIC PRICE CALCULATION (Example: 82086B, 40" × 50", Manual Control)           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Step 1: Get Price Per m² from Database                                          │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Source: manufacturerPrices[fabricCode=82086B]                                 │
│   pricePerSqMeter (manual) = $12.99                                             │
│   pricePerSqMeterCordless = $16.24                                              │
│                                                                                  │
│ Step 2: Calculate Manufacturer Cost                                              │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Area = 1.29 m²                                                                 │
│   Mfr Cost = 1.29 × $12.99 = $16.76                                             │
│                                                                                  │
│ Step 3: Apply Margin (Affordable Roller = 50%)                                   │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Margin Amount = $16.76 × 50% = $8.38                                          │
│   (NO minimum margin - pure percentage)                                          │
│                                                                                  │
│ Step 4: Customer Base Price                                                      │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Customer Price = $16.76 + $8.38 = $25.14                                      │
│                                                                                  │
│ FOR CORDLESS CONTROL:                                                            │
│   Mfr Cost = 1.29 × $16.24 = $20.95                                             │
│   Margin = $20.95 × 50% = $10.48                                                │
│   Customer Price = $20.95 + $10.48 = $31.43                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping

| Portal | Field | Value (Manual) | Value (Cordless) |
|--------|-------|----------------|------------------|
| Product UI | Base Price | $25.14 | $31.43 |
| Orders Portal | unit_price (base) | $25.14 | $31.43 |
| Invoice Portal | unitPrice (base) | $25.14 | $31.43 |
| Manufacturer Portal | manufacturer_price.unit_cost | $16.76 | $20.95 |

---

## 4. Control Type Options

### Source
- **Database:** `productContent.hardwareOptions.controlType[]`
- **Admin UI:** `/admin/hardware-options.html`

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type | Notes |
|----|-------|-------|----------|----------|------------|------------|-------|
| ctrl-001 | manual | Manual | $0.00 | - | $0.00 | flat | Default, uses manual fabric price |
| ctrl-002 | cordless | Cordless | $0.00 | - | $0.00 | flat | Uses cordless fabric price (higher $/m²) |
| ctrl-003 | motorized | Motorized | $0.00 | - | $0.00 | flat | Motor cost charged via Motor Brand |

### Transformation Logic

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CONTROL TYPE LOGIC                                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ IF controlType === 'manual':                                                     │
│   → Use pricePerSqMeter for fabric                                              │
│   → No additional control cost                                                   │
│                                                                                  │
│ IF controlType === 'cordless':                                                   │
│   → Use pricePerSqMeterCordless for fabric (higher price includes spring)       │
│   → No additional control cost (spring mechanism in fabric price)               │
│                                                                                  │
│ IF controlType === 'motorized':                                                  │
│   → Use pricePerSqMeter for fabric                                              │
│   → Add Motor Brand cost (see Section 5)                                        │
│   → Add Remote Type cost (see Section 6)                                        │
│   → Optionally add Solar Panel (see Section 7)                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Motor Brand Options

### Source
- **Database:** `motorBrands[]`
- **Admin UI:** `/admin/product-pricing.html` → Motor Brands tab

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|----------|----------|------------|------------|
| motor-aok | aok | AOK Motor (App Control) | **$45.00** | **40%** | **$63.00** | flat |
| motor-dooya | dooya | Dooya Motor (Remote) | **$47.00** | **40%** | **$65.80** | flat |
| motor-plugin | plugin-wire | Plugin Wire Motor | **$55.00** | **40%** | **$77.00** | flat |
| motor-aok-remote | aok-(remote-control) | AOK (Remote Control) | **$45.00** | **40%** | **$63.00** | flat |

### Transformation Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ MOTOR BRAND CALCULATION                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Formula: Customer Price = Mfr Cost × (1 + Margin%)                              │
│                                                                                  │
│ AOK Motor:                                                                       │
│   Mfr Cost = $45.00                                                             │
│   Margin = 40%                                                                   │
│   Cust Price = $45.00 × 1.40 = $63.00                                           │
│                                                                                  │
│ Dooya Motor:                                                                     │
│   Mfr Cost = $47.00                                                             │
│   Margin = 40%                                                                   │
│   Cust Price = $47.00 × 1.40 = $65.80                                           │
│                                                                                  │
│ Plugin Wire Motor:                                                               │
│   Mfr Cost = $55.00                                                             │
│   Margin = 40%                                                                   │
│   Cust Price = $55.00 × 1.40 = $77.00                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping

| Portal | AOK | Dooya | Plugin Wire |
|--------|-----|-------|-------------|
| Product UI | $63.00 | $65.80 | $77.00 |
| Orders Portal | $63.00 | $65.80 | $77.00 |
| Invoice Portal | $63.00 | $65.80 | $77.00 |
| Manufacturer Portal | $45.00 | $47.00 | $55.00 |

---

## 6. Remote Type Options

### Source
- **Database:** `productContent.hardwareOptions.remoteType[]`
- **Admin UI:** `/admin/product-pricing.html` → Hardware Options

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|----------|----------|------------|------------|
| remote-001 | single-channel | Single Channel | **$6.00** | **40%** | **$8.40** | flat |
| remote-002 | 6-channel | 6 Channel | **$6.60** | **40%** | **$9.24** | flat |
| remote-003 | 15-channel | 15 Channel | **$11.35** | **40%** | **$15.89** | flat |

### Transformation Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ REMOTE TYPE CALCULATION                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Condition: ONLY applies when controlType === 'motorized'                        │
│                                                                                  │
│ Formula: Customer Price = Mfr Cost × (1 + Margin%)                              │
│                                                                                  │
│ Single Channel:                                                                  │
│   Mfr Cost = $6.00                                                              │
│   Cust Price = $6.00 × 1.40 = $8.40                                             │
│                                                                                  │
│ 6 Channel:                                                                       │
│   Mfr Cost = $6.60                                                              │
│   Cust Price = $6.60 × 1.40 = $9.24                                             │
│                                                                                  │
│ 15 Channel:                                                                      │
│   Mfr Cost = $11.35                                                             │
│   Cust Price = $11.35 × 1.40 = $15.89                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping

| Portal | Single | 6-Channel | 15-Channel |
|--------|--------|-----------|------------|
| Product UI | $8.40 | $9.24 | $15.89 |
| Orders Portal | $8.40 | $9.24 | $15.89 |
| Invoice Portal | $8.40 | $9.24 | $15.89 |
| Manufacturer Portal | $6.00 | $6.60 | $11.35 |

---

## 7. Solar Panel Options

### Source
- **Database:** `productContent.hardwareOptions.solarPanel[]`
- **Admin UI:** `/admin/product-pricing.html` → Hardware Options

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|----------|----------|------------|------------|
| solar-001 | yes | Yes | **$20.50** | **40%** | **$28.70** | flat |
| solar-002 | no | No | **$0.00** | - | **$0.00** | flat |

### Transformation Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SOLAR PANEL CALCULATION                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Condition: ONLY applies when controlType === 'motorized' AND solarType === 'yes'│
│                                                                                  │
│ Formula: Customer Price = Mfr Cost × (1 + Margin%)                              │
│                                                                                  │
│ Solar Panel (Yes):                                                               │
│   Mfr Cost = $20.50                                                             │
│   Margin = 40%                                                                   │
│   Cust Price = $20.50 × 1.40 = $28.70                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping

| Portal | Solar Yes | Solar No |
|--------|-----------|----------|
| Product UI | $28.70 | $0.00 |
| Orders Portal | $28.70 | $0.00 |
| Invoice Portal | $28.70 | $0.00 |
| Manufacturer Portal | $20.50 | $0.00 |

---

## 8. Valance/Cassette Options

### Source
- **Database:** `productContent.hardwareOptions.valanceType[]`
- **Admin UI:** `/admin/hardware-options.html`

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|----------|----------|------------|------------|
| val-001 | square-v2 | Square V2 | **$0.00** | - | **$0.00** | flat |
| val-002 | fabric-wrapped-v3 | Fabric Wrapped V3 | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| val-003 | fabric-inserted-s1 | Fabric Inserted S1 | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| val-004 | curve-white-s2 | Curve White S2 | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| val-005 | fabric-wrapped-s3 | Fabric Wrapped S3 | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| val-006 | simple-rolling | Simple Rolling | **$0.00** | - | **$0.00** | flat |

### Transformation Formula (Per-SQM)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ VALANCE/CASSETTE CALCULATION (Example: Fabric Wrapped V3, 40" × 50")            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Step 1: Calculate Area (same as fabric)                                         │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   Area = MAX(1.016 × 1.270, 1.2) = 1.29 m²                                      │
│                                                                                  │
│ Step 2: Calculate Per-SQM Price                                                  │
│ ─────────────────────────────────────────────────────────────────────────────── │
│   IF priceType === 'sqm':                                                        │
│     Mfr Cost = Area × mfrCostPerSqm                                             │
│     Cust Price = Area × custPricePerSqm                                         │
│   ELSE (flat):                                                                   │
│     Mfr Cost = option.manufacturerCost                                          │
│     Cust Price = option.price                                                   │
│                                                                                  │
│ Fabric Wrapped V3 (sqm pricing):                                                 │
│   Mfr Cost = 1.29 m² × $2.20/m² = $2.84                                         │
│   Cust Price = 1.29 m² × $3.08/m² = $3.97                                       │
│   Margin = ($3.97 - $2.84) / $2.84 × 100 = 39.8% ≈ 40%                          │
│                                                                                  │
│ Square V2 (flat pricing):                                                        │
│   Mfr Cost = $0.00                                                              │
│   Cust Price = $0.00                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping (40" × 50" = 1.29 m²)

| Portal | Square V2 | Fabric Wrapped V3 | Fabric Inserted S1 | Curve White S2 | Fabric Wrapped S3 | Simple Rolling |
|--------|-----------|-------------------|--------------------| ---------------|-------------------|----------------|
| Product UI | $0.00 | $3.97 | $3.97 | $3.97 | $3.97 | $0.00 |
| Orders Portal | $0.00 | $3.97 | $3.97 | $3.97 | $3.97 | $0.00 |
| Invoice Portal | $0.00 | $3.97 | $3.97 | $3.97 | $3.97 | $0.00 |
| Manufacturer Portal | $0.00 | $2.84 | $2.84 | $2.84 | $2.84 | $0.00 |

---

## 9. Bottom Rail Options

### Source
- **Database:** `productContent.hardwareOptions.bottomRail[]`
- **Admin UI:** `/admin/hardware-options.html`

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|----------|----------|------------|------------|
| rail-001 | type-a-waterdrop | Type A Streamlined Water-drop | **$0.00** | - | **$0.00** | flat |
| rail-002 | simple-rolling | Simple Rolling | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| rail-003 | type-b | Type B | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| rail-004 | type-c-fabric-wrapped | Type C Fabric Wrapped | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |
| rail-005 | type-d | Type D | **$2.20/m²** | **40%** | **$3.08/m²** | **sqm** |

### Transformation Formula (Per-SQM)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ BOTTOM RAIL CALCULATION (Example: Type B, 40" × 50")                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Same logic as Valance (see Section 8)                                           │
│                                                                                  │
│ Type A Waterdrop (flat, free):                                                   │
│   Mfr Cost = $0.00                                                              │
│   Cust Price = $0.00                                                            │
│                                                                                  │
│ Type B (sqm pricing):                                                            │
│   Area = 1.29 m²                                                                 │
│   Mfr Cost = 1.29 × $2.20 = $2.84                                               │
│   Cust Price = 1.29 × $3.08 = $3.97                                             │
│   Margin = 40%                                                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping (40" × 50" = 1.29 m²)

| Portal | Type A Waterdrop | Simple Rolling | Type B | Type C Fabric | Type D |
|--------|------------------|----------------|--------|---------------|--------|
| Product UI | $0.00 | $3.97 | $3.97 | $3.97 | $3.97 |
| Orders Portal | $0.00 | $3.97 | $3.97 | $3.97 | $3.97 |
| Invoice Portal | $0.00 | $3.97 | $3.97 | $3.97 | $3.97 |
| Manufacturer Portal | $0.00 | $2.84 | $2.84 | $2.84 | $2.84 |

---

## 10. Roller Type Options

### Source
- **Database:** `productContent.hardwareOptions.rollerType[]`
- **Admin UI:** `/admin/hardware-options.html`

### Complete Pricing Table

| ID | Value | Label | Description | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|-------------|----------|----------|------------|------------|
| roll-001 | forward-roll | Forward Roll | Close to window | **$0.00** | - | **$0.00** | flat |
| roll-002 | reverse-roll | Reverse Roll | Extra clearance | **$0.00** | - | **$0.00** | flat |

### Display Mapping

| Portal | Forward Roll | Reverse Roll |
|--------|--------------|--------------|
| Product UI | $0.00 | $0.00 |
| Orders Portal | $0.00 | $0.00 |
| Invoice Portal | $0.00 | $0.00 |
| Manufacturer Portal | $0.00 | $0.00 |

---

## 11. Mount Type Options

### Source
- **Database:** `productContent.hardwareOptions.mountType[]`
- **Admin UI:** `/admin/hardware-options.html`

### Complete Pricing Table

| ID | Value | Label | Mfr Cost | Margin % | Cust Price | Price Type |
|----|-------|-------|----------|----------|------------|------------|
| mount-001 | inside | Inside Mount | **$0.00** | - | **$0.00** | flat |
| mount-002 | outside | Outside Mount | **$0.00** | 0% | **$0.00** | flat |

### Display Mapping

| Portal | Inside Mount | Outside Mount |
|--------|--------------|---------------|
| Product UI | $0.00 | $0.00 |
| Orders Portal | $0.00 | $0.00 |
| Invoice Portal | $0.00 | $0.00 |
| Manufacturer Portal | $0.00 | $0.00 |

---

## 12. Accessories

### Source
- **Database:** `productContent.accessories[]`
- **Admin UI:** `/admin/product-pricing.html` → Accessories

### Complete Pricing Table

| ID | Name | Description | Mfr Cost | Margin % | Cust Price | Price Type |
|----|------|-------------|----------|----------|------------|------------|
| acc-001 | **Smart Hub** | Connect motorized blinds to smart home | **$23.50** | **40%** | **$32.90** | flat (per unit) |
| acc-002 | **USB Charger** | USB charging cable for motorized blinds | **$5.00** | **40%** | **$7.00** | flat (per unit) |

### Transformation Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ACCESSORIES CALCULATION                                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ Accessories are quantity-based (configuration.smartHubQty, usbChargerQty)       │
│                                                                                  │
│ Smart Hub (1 unit):                                                              │
│   Mfr Cost = 1 × $23.50 = $23.50                                                │
│   Margin = 40%                                                                   │
│   Cust Price = $23.50 × 1.40 = $32.90                                           │
│                                                                                  │
│ Smart Hub (2 units):                                                             │
│   Mfr Cost = 2 × $23.50 = $47.00                                                │
│   Cust Price = 2 × $32.90 = $65.80                                              │
│                                                                                  │
│ USB Charger (1 unit):                                                            │
│   Mfr Cost = 1 × $5.00 = $5.00                                                  │
│   Margin = 40%                                                                   │
│   Cust Price = $5.00 × 1.40 = $7.00                                             │
│                                                                                  │
│ USB Charger (3 units):                                                           │
│   Mfr Cost = 3 × $5.00 = $15.00                                                 │
│   Cust Price = 3 × $7.00 = $21.00                                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Display Mapping (Quantity = 1)

| Portal | Smart Hub (×1) | USB Charger (×1) |
|--------|----------------|------------------|
| Product UI | $32.90 | $7.00 |
| Orders Portal | $32.90 | $7.00 |
| Invoice Portal | $32.90 | $7.00 |
| Manufacturer Portal | $23.50 | $5.00 |

---

## 13. Margin Rules

### Source
- **Database:** `customerPriceRules[]`
- **Admin UI:** `/admin/margins.html`

### Active Margin Rules

| ID | Name | Product Type | Product ID | Margin Type | Margin % | Priority |
|----|------|--------------|------------|-------------|----------|----------|
| cpr-prod-81ccd028 | Affordable Custom Roller Blinds | roller | b23180d5-... | percentage | **50%** | 10 |
| cpr-default-roller | Default Roller Blinds | roller | (all) | percentage | 0% | 1 |
| cpr-default-zebra | Default Zebra Blinds | zebra | (all) | percentage | 45% | 1 |
| cpr-default-honeycomb | Default Honeycomb Blinds | honeycomb | (all) | percentage | 50% | 1 |
| cpr-default-roman | Default Roman Shades | roman | (all) | percentage | 45% | 1 |

**Note:** NO minimum margin - margin is purely percentage based.

### Priority Resolution

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ MARGIN RULE PRIORITY (Highest to Lowest)                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ 1. Per-Fabric Margin (manufacturerPrices.manualMargin)                          │
│    → If fabric has specific margin set in admin                                 │
│                                                                                  │
│ 2. Product + Fabric Specific (productId + fabricCode)                           │
│    → Most specific rule                                                         │
│                                                                                  │
│ 3. Product Specific (productId only)                                            │
│    → Affordable Roller = 50%                                                    │
│                                                                                  │
│ 4. Fabric Specific (fabricCode only)                                            │
│                                                                                  │
│ 5. Product Type (productType = 'roller', 'zebra', etc.)                         │
│                                                                                  │
│ 6. WARNING: If no rule found → return warning, sell at cost (no profit)         │
│                                                                                  │
│ For Affordable Roller Blinds (productId = b23180d5-...):                        │
│   Matched Rule: cpr-prod-81ccd028 (priority 10)                                 │
│   Margin = 50% (NO minimum)                                                      │
│   Customer Price = Mfr Cost × 1.50                                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Portal Display Mapping

### Price Snapshot Structure

When item is added to cart, complete pricing is captured:

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
          "price": 63.00,
          "manufacturerCost": 45.00
        },
        {
          "type": "remote",
          "code": "6-channel",
          "name": "6 Channel",
          "price": 9.24,
          "manufacturerCost": 6.60
        },
        {
          "type": "solar",
          "code": "solar-panel",
          "name": "Yes",
          "price": 28.70,
          "manufacturerCost": 20.50
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

### Portal Field Mapping

| Field | Product UI | Orders Portal | Invoice Portal | Manufacturer Portal |
|-------|------------|---------------|----------------|---------------------|
| Fabric Base | unit_price - options | item.unit_price | item.unitPrice | manufacturer_price.unit_cost |
| Motor | options_breakdown[motorization].price | (in unit_price) | (in unitPrice) | options_breakdown[motorization].manufacturerCost |
| Remote | options_breakdown[remote].price | (in unit_price) | (in unitPrice) | options_breakdown[remote].manufacturerCost |
| Solar | options_breakdown[solar].price | (in unit_price) | (in unitPrice) | options_breakdown[solar].manufacturerCost |
| Valance | options_breakdown[valance_type].price | (in unit_price) | (in unitPrice) | options_breakdown[valance_type].manufacturerCost |
| Bottom Rail | options_breakdown[bottom_rail].price | (in unit_price) | (in unitPrice) | options_breakdown[bottom_rail].manufacturerCost |
| Smart Hub | options_breakdown[accessory:smart-hub].price | (in unit_price) | (in unitPrice) | options_breakdown[accessory:smart-hub].manufacturerCost |
| USB Charger | options_breakdown[accessory:usb-charger].price | (in unit_price) | (in unitPrice) | options_breakdown[accessory:usb-charger].manufacturerCost |
| **Total** | **unit_price** | **line_total** | **lineTotal** | **sum(manufacturerCost)** |

---

## 15. Complete Calculation Example

### Scenario: 40" × 50" Motorized Roller with All Premium Options

**Configuration:**
```json
{
  "width": 40,
  "height": 50,
  "fabricCode": "82086B",
  "controlType": "motorized",
  "motorBrand": "dooya",
  "motorType": "battery",
  "remoteType": "15-channel",
  "solarType": "yes",
  "standardCassette": "fabric-wrapped-v3",
  "standardBottomBar": "type-b",
  "rollerType": "forward-roll",
  "mountType": "inside",
  "smartHubQty": 1,
  "usbChargerQty": 1
}
```

### Step-by-Step Calculation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ COMPLETE PRICE BREAKDOWN                                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ STEP 1: DIMENSIONS                                                               │
│ ─────────────────────────────────────────────────────────────────────────────── │
│ Width:  40" × 0.0254 = 1.016 m                                                  │
│ Height: 50" × 0.0254 = 1.270 m                                                  │
│ Area:   MAX(1.016 × 1.270, 1.2) = 1.29 m²                                       │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ STEP 2: FABRIC BASE PRICE                                                        │
│ ─────────────────────────────────────────────────────────────────────────────── │
│ Source: manufacturerPrices[82086B].pricePerSqMeter = $12.99/m²                  │
│ Mfr Cost: 1.29 × $12.99 = $16.76                                                │
│ Margin Rule: 50% (NO minimum)                                                    │
│ Margin Amount: $16.76 × 50% = $8.38                                             │
│ Customer Base: $16.76 + $8.38 = $25.14                                          │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ STEP 3: OPTIONS BREAKDOWN                                                        │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│ Component              │ Mfr Cost   │ Margin │ Cust Price │ Formula             │
│ ───────────────────────┼────────────┼────────┼────────────┼──────────────────── │
│ Fabric (82086B)        │ $16.76     │ 50%    │ $25.14     │ Mfr × 1.50          │
│ Dooya Motor            │ $47.00     │ 40%    │ $65.80     │ Mfr × 1.40          │
│ 15-Channel Remote      │ $11.35     │ 40%    │ $15.89     │ Mfr × 1.40          │
│ Solar Panel            │ $20.50     │ 40%    │ $28.70     │ Mfr × 1.40          │
│ Fabric Wrapped V3      │ $2.84      │ 40%    │ $3.97      │ 1.29m² × $2.20 × 1.40 │
│ Type B Bottom Rail     │ $2.84      │ 40%    │ $3.97      │ 1.29m² × $2.20 × 1.40 │
│ Smart Hub (×1)         │ $23.50     │ 40%    │ $32.90     │ Mfr × 1.40          │
│ USB Charger (×1)       │ $5.00      │ 40%    │ $7.00      │ Mfr × 1.40          │
│ ───────────────────────┼────────────┼────────┼────────────┼──────────────────── │
│ TOTAL                  │ $129.79    │        │ $183.37    │                     │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ STEP 4: FINAL SUMMARY                                                            │
│ ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│ Customer Unit Price:  $183.37                                                    │
│ Manufacturer Cost:    $129.79                                                    │
│ Gross Profit:         $53.58                                                     │
│ Gross Margin:         29.2%                                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Portal Verification

| Portal | Field | Value |
|--------|-------|-------|
| **Product UI** | Unit Price | $183.37 |
| **Orders Portal** | Line Total | $183.37 |
| **Invoice Portal** | Unit Price | $183.37 |
| **Manufacturer Portal** | Total Mfr Cost | $129.79 |

### Options Breakdown in Price Snapshot

| Option | Customer Price | Manufacturer Cost | Margin % |
|--------|----------------|-------------------|----------|
| Fabric (base) | $25.14 | $16.76 | 50% |
| Dooya Motor | $65.80 | $47.00 | 40% |
| 15-Channel Remote | $15.89 | $11.35 | 40% |
| Solar Panel | $28.70 | $20.50 | 40% |
| Fabric Wrapped V3 (1.29m²) | $3.97 | $2.84 | 40% |
| Type B Bottom Rail (1.29m²) | $3.97 | $2.84 | 40% |
| Smart Hub | $32.90 | $23.50 | 40% |
| USB Charger | $7.00 | $5.00 | 40% |
| **TOTAL** | **$183.37** | **$129.79** | **~29%** |

---

## Appendix A: Code File References

| File | Function | Purpose |
|------|----------|---------|
| `backend/services/extended-pricing-engine.js:140-289` | `calculateCustomerPrice()` | Main pricing calculation |
| `backend/services/extended-pricing-engine.js:299-402` | `getManufacturerCost()` | Fabric m² calculation |
| `backend/services/extended-pricing-engine.js:408-535` | `applyMarginRules()` | Margin application |
| `backend/services/extended-pricing-engine.js:540-822` | `calculateOptionCosts()` | All options pricing |
| `backend/services/extended-pricing-engine.js:53-98` | `getHardwareOptionPrice()` | Per-sqm hardware lookup |
| `backend/services/extended-pricing-engine.js:107-131` | `getMotorBrandPrice()` | Motor brand lookup |
| `backend/server.js:450-520` | Cart add endpoint | Price snapshot generation |
| `backend/services/invoice-service.js:51-253` | `createInvoiceFromOrder()` | Invoice generation |

---

## Appendix B: Database Schema

### manufacturerPrices[]
```json
{
  "id": "mp-...",
  "fabricCode": "82086B",
  "productType": "roller",
  "pricePerSqMeter": 12.99,
  "pricePerSqMeterCordless": 16.24,
  "minAreaSqMeter": 1.2,
  "manualMargin": 40,
  "cordlessMargin": 40,
  "status": "active"
}
```

### motorBrands[]
```json
{
  "id": "motor-aok",
  "value": "aok",
  "name": "AOK Motor (App Control)",
  "manufacturerCost": 45,
  "margin": 40,
  "price": 63,
  "priceType": "flat",
  "isActive": true
}
```

### productContent.hardwareOptions.valanceType[]
```json
{
  "id": "val-002",
  "value": "fabric-wrapped-v3",
  "label": "Fabric Wrapped V3",
  "manufacturerCost": 2.2,
  "margin": 40,
  "price": 3.08,
  "priceType": "sqm",
  "isActive": true
}
```

### productContent.accessories[]
```json
{
  "id": "acc-001",
  "name": "Smart Hub",
  "manufacturerCost": 23.5,
  "margin": 40,
  "price": 32.9,
  "isActive": true
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-04 | Claude | Initial documentation |
| 2.0 | 2026-01-04 | Claude | Complete rewrite with ALL options, sub-options, mfr cost, customer price, margin % |
