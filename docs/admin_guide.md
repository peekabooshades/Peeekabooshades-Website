# Peekaboo Shades - Admin Guide

## Pricing System Overview

The pricing system uses a two-tier approach:

### Manufacturer Price (Source of Truth)
- Configured in **Admin → Manufacturer** section
- Based on fabric cost matrices and dimensional calculations
- This is your cost from the supplier

### Customer Price (Final Price)
- Automatically calculated: `Manufacturer Price + Margin = Customer Price`
- Displayed to customers on the Product Detail Page (PDP)
- Shown in Admin Products table for reference

---

## Margin Configuration

### Accessing Margin Settings
1. Go to **Admin Dashboard**
2. Navigate to **Products** section
3. Click **Manage Margins** button

### Margin Types

| Type | Description | Example |
|------|-------------|---------|
| **Percent** | Adds percentage of manufacturer price | 40% margin on $20 mfr = $28 customer price |
| **Fixed** | Adds fixed dollar amount | $15 fixed margin on $20 mfr = $35 customer price |

### Margin Priority (Highest to Lowest)
1. **Product + Fabric specific** - Margin for specific product AND fabric combination
2. **Fabric specific** - Margin for all products using a specific fabric
3. **Product type** - Margin for product category (e.g., all roller blinds)
4. **Default** - Fallback margin when no specific rule matches

### Setting a Margin
1. Open **Manage Margins** dialog
2. Select scope (Default, Product Type, Fabric, or Product+Fabric)
3. Choose margin type (Percent or Fixed)
4. Enter value (e.g., 40 for 40% or 25 for $25)
5. Click **Save**

---

## Product Status Management

### Stock Status
Located in the **Stock** column of the Products table:

| Status | Effect |
|--------|--------|
| **In Stock** | Product can be purchased normally |
| **Out of Stock** | Add to Cart button disabled, shows "Out of Stock" message |

To change: Use the dropdown in the Stock column.

### Active/Inactive Toggle
Located in the **Status** column:

| Status | Effect |
|--------|--------|
| **Active** | Product visible and purchasable |
| **Inactive** | Product hidden from customers, shows "Product Unavailable" |

### Discontinued Flag
Set via product edit:

| Status | Effect |
|--------|--------|
| **Not Discontinued** | Normal product |
| **Discontinued** | Product page shows unavailable message |

---

## Understanding the Products Table

### Columns Explained

| Column | Description |
|--------|-------------|
| **Product** | Product name with image |
| **Slug** | URL-friendly identifier |
| **Category** | Product category |
| **Base Price** | Fallback price (used when no fabric selected) |
| **Mfr Price** | Manufacturer/cost price for sample dimensions |
| **Customer Price** | Final price after margin (what customer pays) |
| **Stock** | Inventory status dropdown |
| **Status** | Active/Inactive toggle |
| **Actions** | Edit and delete buttons |

### Price Display Notes

The **Mfr Price** and **Customer Price** columns show sample pricing for:
- Dimensions: 24" width × 36" height
- Quantity: 1
- No fabric selected (fallback pricing)

**Important**: These are reference prices only. Actual customer pricing on the PDP will vary based on:
- Selected fabric
- Actual dimensions entered
- Quantity ordered
- Any selected options (motorization, etc.)

---

## Pricing Calculation Rules

### Minimum Area
- Roller blinds have a minimum billable area of **1.2 square meters**
- Small blinds (under 1.2 m²) are billed at the minimum area rate

### Dimension Conversion
```
Square Inches = Width × Height
Square Feet = Square Inches ÷ 144
Square Meters = Square Feet × 0.092903
```

### Price Formula
```
1. Calculate area (apply minimum if needed)
2. Look up fabric cost per square meter
3. Manufacturer Price = Area × Fabric Cost
4. Customer Price = Manufacturer Price + Margin
```

---

## Common Tasks

### Updating Product Margins
1. Products → Manage Margins
2. Select the product from dropdown
3. Set margin type and value
4. Save

### Marking Product Out of Stock
1. Products table → Find product row
2. Stock column → Select "Out of Stock"
3. Changes save automatically

### Deactivating a Product
1. Products table → Find product row
2. Status column → Toggle to OFF
3. Product immediately hidden from customers

### Viewing Price Breakdown
1. Go to the actual PDP as a customer would
2. Select a fabric and enter dimensions
3. Price updates in real-time showing customer price

---

## API Endpoints Reference

### For Admin Use

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/margins` | GET | List all margin rules |
| `/api/admin/margins` | POST | Create new margin rule |
| `/api/admin/margins/:id` | PUT | Update margin rule |
| `/api/admin/margins/:id` | DELETE | Remove margin rule |
| `/api/admin/products/:id` | PUT | Update product (incl. stock_status) |
| `/api/admin/manufacturer/price-preview` | POST | Get manufacturer price for dimensions |

### For Store/Customer Use

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/store/price-quote` | POST | Get customer price quote |
| `/api/products/:slug` | GET | Get product details (includes stock status) |

---

## Troubleshooting

### Customer Price Not Changing When Margin Updated
- The Products table shows fallback pricing (no fabric selected)
- Actual customer pricing on PDP will reflect the margin
- Test by visiting the actual product page and selecting a fabric

### Price Shows $40 (Base Price)
- This occurs when no fabric is selected
- The base_price acts as a floor price for fallback scenarios
- Once a fabric is selected on PDP, dimension-based pricing applies

### Product Still Visible After Deactivating
- Clear browser cache
- Check that is_active is actually false in database
- Verify the toggle saved (check for success message)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-03 | 1.0 | Initial documentation |
