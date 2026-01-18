# Peekaboo Shades Admin Panel - Complete Knowledge Transfer Document

**Document Type:** Subject Matter Expert (SME) Knowledge Transfer
**Version:** 1.0
**Date:** 2026-01-18
**Purpose:** Comprehensive documentation of all admin panel functionality for onboarding, training, and maintenance

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Dashboard](#1-dashboard)
3. [Catalog Management](#2-catalog-management)
4. [Order Management](#3-order-management)
5. [Customer Management](#4-customer-management)
6. [Marketing](#5-marketing)
7. [Analytics & Reporting](#6-analytics--reporting)
8. [Content Management](#7-content-management)
9. [Settings & Configuration](#8-settings--configuration)
10. [Security](#9-security)

---

## System Overview

### What is Peekaboo Shades?
Peekaboo Shades is a custom window treatment e-commerce platform specializing in:
- **Roller Shades** - Single fabric panel that rolls up/down
- **Zebra Shades** - Dual-layer fabric with alternating sheer/opaque stripes
- **Outdoor Shades** - Weather-resistant exterior blinds
- **Motorized Options** - Smart home integration with motors

### Admin Panel Architecture
```
Frontend (HTML/CSS/JS) ←→ REST API ←→ Backend (Node.js/Express) ←→ Database (JSON)
```

### Authentication Flow
1. Admin enters credentials at `/admin/login.html`
2. Backend validates and returns JWT token
3. Token stored in localStorage
4. All subsequent API calls include `Authorization: Bearer <token>` header
5. Token expires after 24 hours

---

## 1. DASHBOARD

### Page: `/admin/index.html`

### Business Purpose
The dashboard is the command center for store owners. It provides at-a-glance visibility into business health, recent activity, and items requiring attention. A store manager typically starts their day here to understand what happened overnight and what needs immediate action.

---

### Element 1: Revenue Card
**Location:** Top stats grid, first card
**Visual:** Large number with currency formatting and trend indicator

**What It Does:**
- Displays total revenue (sum of all completed order totals) for the selected time period
- Shows percentage change compared to previous period (e.g., +12% vs last week)
- Green arrow = revenue increase, Red arrow = revenue decrease

**Business Logic:**
```
Revenue = SUM(orders.total) WHERE orders.status IN ('completed', 'delivered')
         AND orders.createdAt >= startDate AND orders.createdAt <= endDate
```

**Why It Matters:**
Revenue is the primary health indicator. Store owners check this first to know if marketing campaigns are working, if there are seasonal trends, or if something is wrong (sudden drop).

**API Call:** `GET /api/admin/analytics/dashboard`
**Response Field:** `stats.totalRevenue`

---

### Element 2: Orders Card
**Location:** Top stats grid, second card
**Visual:** Number with order count

**What It Does:**
- Shows total number of orders placed in the selected period
- Includes all order statuses (pending, processing, shipped, delivered)
- Does NOT include cancelled orders

**Business Logic:**
```
OrderCount = COUNT(orders) WHERE orders.status != 'cancelled'
             AND orders.createdAt >= startDate
```

**Why It Matters:**
Order volume indicates customer demand. Compare with revenue to calculate Average Order Value (AOV). Low orders + high revenue = premium products selling. High orders + low revenue = need to upsell.

**API Call:** `GET /api/admin/analytics/dashboard`
**Response Field:** `stats.totalOrders`

---

### Element 3: Page Views Card
**Location:** Top stats grid, third card
**Visual:** Number representing website traffic

**What It Does:**
- Counts total page views across the storefront
- Tracked via analytics events when pages load
- Helps understand traffic patterns

**Business Logic:**
```
PageViews = COUNT(analytics_events) WHERE event_type = 'page_view'
            AND timestamp >= startDate
```

**Why It Matters:**
Traffic is top-of-funnel. No traffic = no sales. Compare with orders to calculate conversion rate. If traffic is high but orders low, there's a conversion problem (pricing, UX, trust).

**API Call:** `GET /api/admin/analytics/dashboard`
**Response Field:** `stats.pageViews`

---

### Element 4: Conversion Rate Card
**Location:** Top stats grid, fourth card
**Visual:** Percentage with trend

**What It Does:**
- Calculates: (Orders / Unique Visitors) × 100
- Industry benchmark for custom products: 1-3%
- Shows how effectively the site converts browsers to buyers

**Business Logic:**
```
ConversionRate = (OrderCount / UniqueVisitors) × 100
```

**Why It Matters:**
This is the efficiency metric. A 1% improvement in conversion can dramatically impact revenue. Low conversion triggers investigation: Are prices too high? Is checkout broken? Is product info unclear?

**API Call:** `GET /api/admin/analytics/dashboard`
**Response Field:** `stats.conversionRate`

---

### Element 5: Date Range Picker
**Location:** Top right of dashboard
**Visual:** Button group with options: 7d | 30d | 90d

**What It Does:**
- **7d (7 Days):** Shows last week's data - good for recent trends
- **30d (30 Days):** Shows last month - standard reporting period
- **90d (90 Days):** Shows last quarter - seasonal analysis

**How It Works:**
1. User clicks a date range button
2. Button becomes visually "active" (highlighted)
3. JavaScript calculates start/end dates
4. All dashboard API calls are re-triggered with new date params
5. Charts and stats update to reflect selected period

**Business Logic:**
```javascript
if (range === '7d') startDate = today - 7 days
if (range === '30d') startDate = today - 30 days
if (range === '90d') startDate = today - 90 days
endDate = today
```

---

### Element 6: Sales Chart
**Location:** Main content area, left side
**Visual:** Line chart showing revenue over time

**What It Does:**
- X-axis: Days/weeks in selected period
- Y-axis: Revenue in dollars
- Line shows daily revenue trend
- Helps identify patterns (weekends slower, Mondays spike, etc.)

**Data Source:**
```javascript
// Groups orders by day and sums revenue
{
  labels: ['Mon', 'Tue', 'Wed', ...],
  data: [1250.00, 890.50, 2100.00, ...]
}
```

**Why It Matters:**
Visual trends are easier to spot than numbers. Sudden dips might indicate:
- Website issues (check error logs)
- Competitor promotion
- Holiday impact
- Payment processor problems

**API Call:** `GET /api/admin/analytics/sales?groupBy=day`

---

### Element 7: Recent Orders Table
**Location:** Below sales chart
**Visual:** Table with 10 most recent orders

**Columns Explained:**

| Column | Description | Business Use |
|--------|-------------|--------------|
| Order # | Unique identifier (e.g., ORD-2024-001234) | Click to view full order details |
| Customer | Customer name and email | Identify VIP customers, contact if needed |
| Items | Number of line items in order | Quick complexity indicator |
| Total | Order value in dollars | Spot high-value orders for priority handling |
| Status | Current order status badge | See what needs action |
| Date | When order was placed | Identify processing delays |

**Status Badges Explained:**
- 🟡 **Pending** - Payment received, awaiting processing
- 🔵 **Processing** - Being prepared for production
- 🟣 **Manufacturing** - In factory production
- 🟢 **Shipped** - Out for delivery
- ✅ **Delivered** - Customer received order
- 🔴 **Cancelled** - Order cancelled/refunded

**Interaction:**
Clicking any row navigates to `/admin/orders.html?id={orderId}` for full details.

**API Call:** `GET /api/admin/orders?limit=10&sort=createdAt:desc`

---

### Element 8: Notifications Panel
**Location:** Right sidebar
**Visual:** List of notification cards with icons

**What It Does:**
Shows system alerts and action items:
- New orders requiring attention
- Low inventory warnings
- Quote requests waiting for response
- Customer reviews to moderate
- System updates/maintenance notices

**Notification Types:**

| Icon | Type | Action Required |
|------|------|-----------------|
| 🛒 Order | New order placed | Review and process |
| 📋 Quote | Quote request received | Send pricing |
| ⭐ Review | Customer left review | Moderate/respond |
| ⚠️ System | Technical alert | Check system health |
| 📦 Inventory | Stock low | Reorder supplies |

**Mark as Read:**
- Click notification to mark as read
- "Mark All Read" button clears all
- Read notifications move to history

**API Calls:**
- `GET /api/admin/notifications` - Fetch notifications
- `PUT /api/admin/notifications/read-all` - Mark all read

---

## 2. CATALOG MANAGEMENT

### Page: `/admin/products.html`

### Business Purpose
Product management is the core of the catalog. Each "product" represents a type of window treatment (e.g., "Roller Shades", "Zebra Shades"). Products contain configuration options that customers use to customize their order.

---

### Element 1: Products Table
**Location:** Main content area
**Visual:** Data table with sortable columns

**Columns Explained:**

| Column | Description | Example |
|--------|-------------|---------|
| Image | Product thumbnail | Photo of roller shade |
| Name | Product display name | "Premium Roller Shades" |
| Category | Product type | Roller Shades |
| Base Price | Starting price | $89.00 |
| Status | Active/Inactive | Active |
| Featured | Homepage highlight | Yes/No |
| Actions | Edit/Delete buttons | - |

**What "Active" Means:**
- Active products appear on the storefront
- Inactive products are hidden from customers
- Use inactive for seasonal items or discontinued products

**What "Featured" Means:**
- Featured products appear on homepage
- Shown in "Popular Products" sections
- Limited to 4-6 products typically

---

### Element 2: Add Product Button
**Location:** Top right of page
**Visual:** Primary button "Add Product"

**What It Does:**
Navigates to product editor (`/admin/product-editor.html`) with blank form for creating new product.

**Required Fields for New Product:**
1. Product Name (display name)
2. URL Slug (SEO-friendly URL)
3. Category (dropdown)
4. Base Price (starting price before customization)
5. Description (appears on product page)
6. At least one product image

---

### Element 3: Search Input
**Location:** Above table
**Visual:** Text input with search icon

**What It Does:**
- Filters products as you type
- Searches: name, SKU, description
- Case-insensitive matching
- Instant results (no button click needed)

**How It Works:**
```javascript
products.filter(p =>
  p.name.toLowerCase().includes(searchTerm) ||
  p.sku.toLowerCase().includes(searchTerm)
)
```

---

### Element 4: Category Filter
**Location:** Above table, next to search
**Visual:** Dropdown select

**Options:**
- All Categories (default)
- Roller Shades
- Zebra Shades
- Outdoor Shades
- Honeycomb Shades
- etc.

**What It Does:**
Filters table to show only products in selected category. Useful when you have 50+ products and need to find specific types.

---

### Element 5: Status Toggle
**Location:** In each product row
**Visual:** Toggle switch

**What It Does:**
- ON (green): Product visible on storefront
- OFF (gray): Product hidden from customers

**Use Cases:**
- Temporarily hide product during price updates
- Disable seasonal products (outdoor shades in winter)
- Soft-delete without losing data

**API Call:** `PUT /api/admin/products/:id/toggle`

---

### Element 6: Featured Toggle
**Location:** In each product row
**Visual:** Star icon (filled/empty)

**What It Does:**
- Filled star: Product appears in featured sections
- Empty star: Normal product display

**Business Rule:**
Limit featured products to maintain impact. Too many featured items dilutes the concept.

**API Call:** `PUT /api/admin/products/:id/featured`

---

### Element 7: Delete Button
**Location:** Actions column in each row
**Visual:** Red trash icon

**What It Does:**
1. Shows confirmation dialog: "Are you sure? This cannot be undone."
2. If confirmed, removes product from database
3. Associated images remain in media library
4. Historical orders referencing this product keep their data

**Warning:** Deleting is permanent. Consider using "Inactive" status instead.

**API Call:** `DELETE /api/admin/products/:id`

---

### Element 8: Margin Calculator (Modal)
**Location:** Click "Calculate Margin" in product row
**Visual:** Modal popup with pricing breakdown

**What It Does:**
Shows profit analysis for a product:

```
Manufacturer Cost:    $45.00
Your Selling Price:   $89.00
────────────────────────────
Gross Profit:         $44.00
Margin Percentage:    49.4%
```

**Why It Matters:**
Ensures pricing covers costs and desired profit. Industry standard margins for custom blinds: 40-60%.

**API Call:** `GET /api/admin/margins/product/:productId`

---

## Page: `/admin/fabrics.html`

### Business Purpose
Fabrics are the materials customers choose for their window treatments. Each fabric has different properties (light filtering, blackout, color) and prices. Managing fabrics well is crucial as this is often the primary decision factor for customers.

---

### Element 1: Roller Fabrics Tab
**Location:** Tab bar at top
**Visual:** Tab button

**What It Does:**
Shows fabrics available for Roller Shades. These are typically:
- Light Filtering (translucent)
- Room Darkening (blocks most light)
- Blackout (100% light blocking)
- Sunscreen (see-through, UV blocking)

**API Call:** `GET /api/admin/fabrics`

---

### Element 2: Zebra Fabrics Tab
**Location:** Tab bar at top
**Visual:** Tab button

**What It Does:**
Shows fabrics for Zebra Shades. Zebra fabrics have alternating stripes and different construction than roller fabrics.

**API Call:** `GET /api/admin/zebra/fabrics`

---

### Element 3: Fabric Grid
**Location:** Main content area
**Visual:** Card grid showing fabric swatches

**Each Card Contains:**
- Swatch image (fabric photo)
- Fabric name (e.g., "Pearl White")
- Fabric code (e.g., "RLR-001")
- Price per square meter
- Light filtering level
- Status badge (Active/Inactive)

**Grid Behavior:**
- Responsive: 4 columns on desktop, 2 on tablet, 1 on mobile
- Cards can be dragged to reorder
- Order determines display sequence on storefront

---

### Element 4: Add Fabric Button
**Location:** Top right
**Visual:** Primary button "+ Add Fabric"

**Opens Modal With Fields:**

| Field | Type | Description |
|-------|------|-------------|
| Fabric Name | Text | Display name (e.g., "Ocean Blue") |
| Fabric Code | Text | Unique SKU (e.g., "RLR-042") |
| Category | Dropdown | Light Filtering / Blackout / etc. |
| Color Family | Dropdown | White / Gray / Blue / etc. |
| Price/sqm | Number | Cost per square meter |
| Swatch Image | File Upload | Photo of fabric |
| Description | Textarea | Features and benefits |

---

### Element 5: Image Upload
**Location:** In fabric modal
**Visual:** Drag-drop zone or file picker

**What It Does:**
1. User selects image file (JPEG, PNG, WebP)
2. Image uploaded to server
3. Stored in `/images/fabrics/swatches/`
4. Thumbnail generated automatically
5. URL saved with fabric record

**Image Requirements:**
- Minimum: 400x400 pixels
- Maximum: 2MB file size
- Square aspect ratio preferred

**API Call:** `POST /api/admin/fabrics/upload-image`

---

### Element 6: Drag Reorder
**Location:** Fabric cards have drag handles
**Visual:** Six-dot grip icon

**What It Does:**
- Drag cards to change display order
- Order saved automatically on drop
- Determines sequence in customer fabric picker

**Why It Matters:**
Put best-selling or highest-margin fabrics first. Customers often choose from the first options they see.

**API Call:** `PUT /api/admin/fabrics/reorder`
**Payload:** `{ fabricIds: ['fab-001', 'fab-003', 'fab-002', ...] }`

---

### Element 7: Toggle Active
**Location:** Each fabric card
**Visual:** Toggle switch

**What It Does:**
- Active: Fabric appears in product configurator
- Inactive: Fabric hidden from customers

**Use Cases:**
- Temporarily out of stock
- Discontinued fabric
- Seasonal availability

**API Call:** `PUT /api/admin/fabrics/:id/toggle`

---

### Element 8: Bulk Upload
**Location:** "Bulk Upload" button
**Visual:** Modal with file input

**What It Does:**
Import multiple fabrics via CSV file:

```csv
code,name,category,color,price_sqm
RLR-050,Sunset Orange,light_filtering,orange,12.50
RLR-051,Midnight Black,blackout,black,18.00
```

**Process:**
1. Upload CSV file
2. System validates format
3. Preview shown with any errors highlighted
4. Confirm to import all valid rows
5. Skip rows with errors

**API Call:** `POST /api/admin/fabrics/bulk-upload`

---

## Page: `/admin/hardware-options.html`

### Business Purpose
Hardware options are the physical components of window treatments beyond fabric: valances (top covers), bottom rails (weights), cassettes (housing), brackets, and chains. Each option has pricing that affects final order total.

---

### Element 1: Shade Type Tabs
**Location:** Top of page
**Visual:** Tab buttons: "Roller Shades" | "Zebra Shades"

**What It Does:**
Hardware differs by shade type. Roller shades use different cassette sizes and rail types than zebra shades. Switching tabs loads hardware specific to that product type.

---

### Element 2: Category Dropdown
**Location:** Below tabs
**Visual:** Select dropdown

**Categories:**
- **Valance** - Decorative top cover hiding mounting brackets
- **Bottom Rail** - Weight bar at bottom of shade
- **Cassette** - Housing that contains rolled fabric
- **Brackets** - Wall/ceiling mounting hardware
- **Chain/Wand** - Manual operation mechanism

---

### Element 3: Hardware Table
**Location:** Main content
**Visual:** Data table

**Columns:**

| Column | Description |
|--------|-------------|
| Name | Option name (e.g., "Standard Valance") |
| SKU | Internal code |
| Price | Flat price OR price per sqm |
| Price Type | "Flat" or "Per Square Meter" |
| Default | Is this the default selection? |
| Status | Active/Inactive |

---

### Element 4: Add Option Button
**Location:** Above table
**Visual:** "+ Add Option"

**Opens Modal:**

| Field | Description |
|-------|-------------|
| Name | Display name |
| SKU | Unique code |
| Price | Dollar amount |
| Price Type | Flat or Per-sqm |
| Description | Help text for customers |
| Set as Default | Pre-select this option |

---

### Element 5: Price Type Toggle
**Location:** In add/edit modal
**Visual:** Radio buttons

**Options:**

1. **Flat Price** - Same price regardless of shade size
   - Example: $15 for chain control (small part, fixed cost)

2. **Per Square Meter** - Price scales with shade size
   - Example: $8/sqm for valance (larger shade = more material)

**Business Logic:**
```javascript
if (priceType === 'flat') {
  optionCost = flatPrice
} else {
  optionCost = pricePerSqm * (width * height / 10000)
}
```

---

## Page: `/admin/accessories.html`

### Business Purpose
Accessories are add-on products sold alongside window treatments: remotes, smart home hubs, USB chargers, installation kits. These increase average order value and provide convenience to customers.

---

### Element 1: Accessories Grid
**Location:** Main content
**Visual:** Card grid

**Each Card Shows:**
- Icon/image
- Accessory name
- Price
- Brief description
- Status (Active/Inactive)
- Edit/Delete buttons

---

### Element 2: Add Accessory Modal

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Name | Text | Yes | "15-Channel Remote" |
| Price | Number | Yes | $45.00 |
| SKU | Text | Yes | "ACC-RMT-15" |
| Description | Textarea | No | Features list |
| Icon | File Upload | No | Product image |
| Category | Select | Yes | Remote / Hub / Charger |
| Compatibility | Multi-select | No | Which products work with |

---

### Common Accessories:

| Accessory | Purpose | Typical Price |
|-----------|---------|---------------|
| 1-Channel Remote | Control single motorized shade | $25 |
| 15-Channel Remote | Control up to 15 shades | $45 |
| Smart Hub | WiFi bridge for app control | $89 |
| USB Charger | Rechargeable battery charger | $29 |
| Wall Bracket | Alternative mounting option | $15 |

---

## 3. ORDER MANAGEMENT

### Page: `/admin/orders.html`

### Business Purpose
Order management is the operational heart of the business. Every sale flows through here from payment to delivery. Efficient order processing directly impacts customer satisfaction and reviews.

---

### Element 1: Orders Table
**Location:** Main content
**Visual:** Full-width data table with pagination

**Columns Explained:**

| Column | Description | Example |
|--------|-------------|---------|
| Order # | Unique identifier | PB-2024-001234 |
| Date | Order timestamp | Jan 15, 2024 2:30 PM |
| Customer | Name + email | John Smith (john@email.com) |
| Items | Line item count | 3 items |
| Total | Order value | $847.50 |
| Status | Current stage | Processing |
| Payment | Payment status | Paid |
| Actions | View/Edit buttons | - |

---

### Element 2: Status Filter
**Location:** Filter bar above table
**Visual:** Dropdown select

**Status Options:**

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| All | Show everything | - |
| Pending | Awaiting payment confirmation | Verify payment |
| Processing | Being prepared | Start production |
| Manufacturing | In factory | Monitor progress |
| Quality Check | QA inspection | Review before ship |
| Ready to Ship | Packaged | Generate label |
| Shipped | In transit | Track delivery |
| Delivered | Customer received | Close order |
| Cancelled | Order cancelled | Process refund |

---

### Element 3: Search Input
**Location:** Filter bar
**Visual:** Text input

**Searches:**
- Order number (exact or partial)
- Customer name
- Customer email
- Product names in order

**Example Searches:**
- "PB-2024" - All 2024 orders
- "john@" - Orders by Johns
- "Zebra" - Orders containing zebra shades

---

### Element 4: Date Range Filter
**Location:** Filter bar
**Visual:** Two date pickers (From/To)

**What It Does:**
Filters orders by creation date. Useful for:
- Monthly reporting
- Finding orders from specific period
- Analyzing seasonal trends

---

### Element 5: Order Row Click
**Location:** Any row in table
**Visual:** Entire row is clickable

**What It Does:**
Opens order detail view showing:
- Complete customer information
- All line items with specifications
- Pricing breakdown
- Status history timeline
- Internal notes
- Shipping information

---

### Element 6: Status Dropdown (In-Row)
**Location:** Status column in each row
**Visual:** Dropdown that replaces badge on click

**What It Does:**
Quick status update without opening full order:
1. Click current status badge
2. Dropdown appears with valid next statuses
3. Select new status
4. System updates and logs change
5. Customer notified if email enabled

**Status Flow:**
```
Pending → Processing → Manufacturing → Quality Check → Ready to Ship → Shipped → Delivered
                                                          ↓
                                                     Cancelled (from any status)
```

**API Call:** `PUT /api/admin/orders/:id/status`

---

### Element 7: Export Button
**Location:** Top right
**Visual:** "Export CSV" button

**What It Does:**
Downloads spreadsheet of current filtered orders:
- Respects all active filters
- Includes all order details
- Opens in Excel/Google Sheets
- Useful for accounting, reporting

**Export Columns:**
Order#, Date, Customer, Email, Phone, Items, Subtotal, Tax, Shipping, Total, Status, Payment

---

### Element 8: Auto-Delivery Button
**Location:** Top actions area
**Visual:** "Auto-Update Delivered" button

**What It Does:**
Bulk updates shipped orders that are likely delivered:
1. Finds all "Shipped" orders older than X days
2. Checks if tracking shows delivered
3. Updates status to "Delivered"
4. Shows count of updated orders

**Business Logic:**
```javascript
ordersToUpdate = orders.filter(o =>
  o.status === 'shipped' &&
  daysSince(o.shippedAt) > 7
)
```

**API Call:** `POST /api/admin/orders/auto-delivery`

---

### Element 9: Print Invoice
**Location:** Order row actions
**Visual:** Printer icon

**What It Does:**
Opens print-friendly invoice view:
- Company letterhead
- Customer billing/shipping address
- Itemized line items
- Tax breakdown
- Payment terms
- Optimized for printing

**Navigation:** Opens `/admin/print-invoice.html?orderId={id}`

---

## Page: `/admin/quotes.html`

### Business Purpose
Quotes are pre-sale price estimates. Customers request quotes when:
- They need pricing for budgeting
- Order is complex/large
- They want to compare with competitors
- B2B customers need formal quotes

Converting quotes to orders is a key sales metric.

---

### Element 1: Quotes Table
**Location:** Main content
**Visual:** Data table

**Columns:**

| Column | Description |
|--------|-------------|
| Quote # | Unique ID (QT-2024-001) |
| Date | Request timestamp |
| Customer | Name and contact |
| Items | What they want quoted |
| Estimated Total | Calculated price |
| Status | New / Sent / Converted / Expired |
| Actions | View / Convert / Delete |

---

### Element 2: Quote Statuses

| Status | Meaning | Next Steps |
|--------|---------|------------|
| New | Just received | Review and send quote |
| Sent | Quote emailed to customer | Follow up in 3-5 days |
| Viewed | Customer opened quote email | High intent - call them |
| Converted | Became an order | Success! |
| Expired | Past validity period | Offer to re-quote |
| Declined | Customer said no | Log reason for learning |

---

### Element 3: Convert to Order Button
**Location:** Quote actions
**Visual:** "Convert to Order" button

**What It Does:**
1. Creates new order from quote data
2. Copies all line items and specs
3. Pre-fills customer information
4. Sends payment link to customer
5. Marks quote as "Converted"
6. Links order back to original quote

**API Call:** `POST /api/admin/orders` with quote data

---

### Element 4: Create Quote Modal
**Location:** "New Quote" button
**Visual:** Multi-step form

**Steps:**
1. **Customer Info** - Name, email, phone
2. **Product Selection** - Choose products
3. **Configuration** - Size, fabric, options
4. **Pricing** - Review calculated total
5. **Send** - Email quote to customer

---

## Page: `/admin/invoices.html`

### Business Purpose
Invoices are financial documents for completed orders. They serve as:
- Payment requests for unpaid orders
- Receipts for paid orders
- Accounting records
- Tax documentation

---

### Element 1: Summary Stats
**Location:** Top of page
**Visual:** Four stat cards

**Cards:**

| Card | Description |
|------|-------------|
| Total Outstanding | Sum of unpaid invoices |
| Paid This Month | Revenue collected |
| Overdue | Invoices past due date |
| Average Days to Pay | Payment speed metric |

---

### Element 2: Invoice Statuses

| Status | Meaning | Color |
|--------|---------|-------|
| Draft | Not yet sent | Gray |
| Sent | Emailed to customer | Blue |
| Viewed | Customer opened | Yellow |
| Paid | Payment received | Green |
| Overdue | Past due date | Red |
| Cancelled | Voided | Gray strikethrough |

---

### Element 3: Record Payment
**Location:** Invoice actions
**Visual:** "Record Payment" button → Modal

**Modal Fields:**
- Amount received
- Payment date
- Payment method (Credit Card / Bank Transfer / Check / Cash)
- Reference number (check # or transaction ID)
- Notes

**What Happens:**
1. Invoice marked as "Paid"
2. Payment logged in order history
3. Customer receipt sent (optional)
4. Updates revenue reports

**API Call:** `POST /api/admin/invoices/:id/payment`

---

### Element 4: Send Invoice
**Location:** Invoice actions
**Visual:** "Send" button

**What It Does:**
Emails invoice to customer with:
- PDF attachment
- Payment link
- Due date reminder
- Company contact info

**API Call:** `POST /api/admin/invoices/:id/send`

---

### Element 5: Generate Missing Invoices
**Location:** Top actions
**Visual:** "Generate Missing" button

**What It Does:**
Creates invoices for orders that don't have them:
- Scans all completed orders
- Identifies orders without invoices
- Bulk creates invoice records
- Useful after system migration

**API Call:** `POST /api/admin/invoices/generate-missing`

---

## Page: `/admin/abandoned-checkouts.html`

### Business Purpose
Abandoned checkouts represent lost revenue - customers who added items to cart and started checkout but didn't complete purchase. Recovery campaigns can recapture 5-15% of these sales.

---

### Element 1: Checkouts Table
**Location:** Main content
**Visual:** Data table

**Columns:**

| Column | Description |
|--------|-------------|
| Email | Customer email (if provided) |
| Cart Value | Total of items in cart |
| Items | Products left behind |
| Abandoned At | When they left |
| Recovery Status | None / Email Sent / Recovered |
| Actions | Send Email / Convert / Delete |

---

### Element 2: Send Recovery Email
**Location:** Row actions
**Visual:** "Send Recovery" button

**What It Does:**
1. Sends templated email with:
   - "You left something behind!"
   - Cart contents reminder
   - Direct link to resume checkout
   - Optional discount code incentive
2. Updates status to "Recovery Sent"
3. Tracks if email is opened

**API Call:** `POST /api/admin/abandoned-checkouts/:id/send-recovery`

---

### Element 3: Convert to Draft Order
**Location:** Row actions
**Visual:** "Create Draft" button

**What It Does:**
Creates draft order from abandoned cart:
- Preserves all cart items
- Copies customer info
- Allows manual follow-up
- Can be completed over phone

**Use Case:**
Customer calls saying they had trouble checking out. Staff can find their abandoned cart, convert to draft, and complete the order by phone.

**API Call:** `POST /api/admin/abandoned-checkouts/:id/convert-to-draft`

---

### Element 4: Change Status
**Location:** Status column dropdown
**Visual:** Select dropdown

**Statuses:**
- **Abandoned** - No recovery attempt yet
- **Recovery Sent** - Email sent
- **Recovered** - Customer completed purchase
- **Lost** - Marked as unrecoverable

**API Call:** `PUT /api/admin/abandoned-checkouts/:id/status`

---

## 4. CUSTOMER MANAGEMENT

### Page: `/admin/customers.html`

### Business Purpose
Customer database contains everyone who has:
- Created an account
- Placed an order
- Requested a quote
- Subscribed to newsletter

Understanding customers enables personalized service, targeted marketing, and relationship building.

---

### Element 1: Customers Table
**Location:** Main content
**Visual:** Sortable data table

**Columns:**

| Column | Description | Use |
|--------|-------------|-----|
| Name | Full name | Personalized communication |
| Email | Contact email | Primary identifier |
| Phone | Phone number | Follow-up calls |
| Orders | Total order count | Identify VIPs |
| Total Spent | Lifetime value | Prioritization |
| Last Order | Most recent purchase | Re-engagement timing |
| Status | Active / Inactive | Account health |

---

### Element 2: Customer Segments
**Location:** Filter tabs
**Visual:** Tab buttons

**Segments:**

| Segment | Criteria | Marketing Use |
|---------|----------|---------------|
| All | Everyone | - |
| New | First order < 30 days | Welcome series |
| Returning | 2+ orders | Loyalty program |
| VIP | Spent > $1000 | Exclusive offers |
| At Risk | No order > 90 days | Win-back campaign |
| Inactive | No order > 180 days | Re-engagement |

---

### Element 3: Add Customer
**Location:** "+ Add Customer" button
**Visual:** Modal form

**Fields:**
- First Name *
- Last Name *
- Email *
- Phone
- Company (optional)
- Address
- Notes

**Use Cases:**
- Adding walk-in customers
- Phone order customers
- Trade/dealer accounts

**API Call:** `POST /api/admin/customers`

---

### Element 4: Customer Detail View
**Location:** Click customer row → `/admin/customer.html?id=xxx`
**Visual:** Full customer profile page

**Sections:**

1. **Overview Card**
   - Contact information
   - Account status
   - Customer since date

2. **Order History Tab**
   - All past orders
   - Order values
   - Product preferences

3. **Notes Tab**
   - Internal notes
   - Communication log
   - Follow-up reminders

4. **Activity Timeline**
   - Account created
   - Orders placed
   - Emails sent
   - Status changes

---

## 5. MARKETING

### Page: `/admin/marketing/promotions.html`

### Business Purpose
Promotions drive sales through discounts and special offers. Strategic promotions can:
- Clear old inventory
- Acquire new customers
- Reward loyal customers
- Boost slow periods

---

### Element 1: Promotions List
**Location:** Main content
**Visual:** Card list

**Each Card Shows:**
- Promotion name
- Discount amount/percentage
- Valid dates
- Usage count
- Status (Active/Scheduled/Expired)

---

### Element 2: Promotion Types

| Type | Description | Example |
|------|-------------|---------|
| Percentage Off | Discount by % | 20% off all orders |
| Fixed Amount | Dollar discount | $50 off orders over $500 |
| Free Shipping | No shipping charge | Free shipping weekend |
| BOGO | Buy one get one | Buy 2 get 1 free |
| Bundle | Package deal | Shade + Motor for $X |

---

### Element 3: Promotion Rules
**Location:** In promotion editor modal
**Visual:** Form fields

**Configurable Rules:**

| Rule | Description |
|------|-------------|
| Minimum Order | Must spend $X to qualify |
| Maximum Discount | Cap the discount amount |
| Product Specific | Only certain products |
| Customer Specific | Only certain segments |
| Usage Limit | Max times can be used |
| One Per Customer | Single use per person |
| Valid Dates | Start and end dates |
| Coupon Code | Required code to apply |

---

### Page: `/admin/marketing/campaigns.html`

### Business Purpose
Email campaigns communicate with customers at scale. Well-timed campaigns drive traffic and sales. Key campaigns include product launches, promotions, and seasonal messaging.

---

### Element 1: Campaign List
**Location:** Main content
**Visual:** Table

**Columns:**
- Campaign Name
- Subject Line
- Status (Draft / Scheduled / Sent)
- Recipients
- Open Rate
- Click Rate
- Send Date

---

### Element 2: Campaign Editor
**Location:** Create/Edit campaign modal
**Visual:** Multi-section form

**Sections:**

1. **Setup**
   - Campaign name (internal)
   - Subject line (what recipient sees)
   - Preview text (inbox preview)

2. **Recipients**
   - All customers
   - Specific segment
   - Manual selection
   - Exclude groups

3. **Content**
   - Rich text editor
   - Product blocks
   - Image upload
   - Call-to-action buttons

4. **Schedule**
   - Send now
   - Schedule for later
   - Time zone selection

---

### Element 3: Email Templates
**Location:** Template selector in editor
**Visual:** Visual template gallery

**Pre-built Templates:**
- Product Announcement
- Sale/Promotion
- Newsletter
- Order Follow-up
- Abandoned Cart Recovery
- Welcome Series

---

## 6. ANALYTICS & REPORTING

### Page: `/admin/analytics.html`

### Business Purpose
Analytics transform raw data into actionable insights. Understanding what's working (and what isn't) drives better business decisions.

---

### Element 1: Product Insights Tab
**Location:** Tab navigation
**Visual:** Charts and tables

**Metrics:**
- **Best Sellers** - Top products by revenue
- **Conversion by Product** - Which products convert visitors to buyers
- **Product Views** - Most viewed items
- **Configuration Trends** - Popular sizes, colors, options

**Business Questions Answered:**
- Which products should we promote more?
- What inventory should we stock?
- Which products need better photos/descriptions?

**API Call:** `GET /api/admin/analytics/product-insights`

---

### Element 2: Customer Insights Tab
**Location:** Tab navigation
**Visual:** Charts and metrics

**Metrics:**
- **Customer Acquisition** - New vs returning
- **Lifetime Value (LTV)** - Average customer worth
- **Repeat Rate** - % who buy again
- **Geographic Distribution** - Where customers are located

**Business Questions Answered:**
- How much can we spend to acquire a customer?
- Where should we focus marketing?
- Is our retention improving?

**API Call:** `GET /api/admin/analytics/customer-insights`

---

### Element 3: Finance Insights Tab
**Location:** Tab navigation
**Visual:** Revenue charts

**Metrics:**
- **Revenue Trend** - Daily/weekly/monthly revenue
- **Average Order Value** - Typical purchase size
- **Revenue by Channel** - Direct, Google, Referral
- **Profit Margins** - Gross and net

**Business Questions Answered:**
- Are we growing?
- Should we raise prices?
- Which marketing channels are profitable?

**API Call:** `GET /api/admin/analytics/finance-insights`

---

### Element 4: Traffic Insights Tab
**Location:** Tab navigation
**Visual:** Traffic charts

**Metrics:**
- **Sessions** - Website visits
- **Page Views** - Total pages viewed
- **Bounce Rate** - % who leave immediately
- **Top Pages** - Most visited pages
- **Traffic Sources** - How visitors find us

**Business Questions Answered:**
- Is our SEO working?
- Which pages need improvement?
- Where should we advertise?

**API Call:** `GET /api/admin/analytics/traffic-insights`

---

## 7. CONTENT MANAGEMENT

### Page: `/admin/pages.html`

### Business Purpose
Static pages provide information beyond products: About Us, Contact, Shipping Policy, FAQs. Good content builds trust and answers questions that might prevent purchases.

---

### Element 1: Pages List
**Location:** Main content
**Visual:** Table

**Columns:**
- Page Title
- URL Slug
- Status (Published / Draft)
- Last Updated
- Actions

---

### Element 2: Page Templates

| Template | Use Case |
|----------|----------|
| Standard | Basic text content |
| Landing Page | Marketing campaigns |
| Contact | Contact form |
| FAQ | Expandable questions |
| Policy | Terms, Privacy, etc. |

---

### Page: `/admin/faqs.html`

### Business Purpose
FAQs reduce support burden by answering common questions upfront. Good FAQs:
- Reduce customer service inquiries
- Build buyer confidence
- Improve SEO
- Address objections

---

### Element 1: FAQ List
**Location:** Main content
**Visual:** Accordion list

**Each FAQ Shows:**
- Question (clickable header)
- Answer (expands on click)
- Category label
- Edit/Delete buttons

---

### Element 2: FAQ Categories

| Category | Topics Covered |
|----------|----------------|
| Ordering | How to order, payment, quotes |
| Products | Materials, options, customization |
| Shipping | Delivery times, tracking, international |
| Installation | DIY, professional, guides |
| Returns | Policy, process, timeframes |
| Warranty | Coverage, claims, repairs |

---

### Page: `/admin/media-library.html`

### Business Purpose
Centralized storage for all images and files. Good media management ensures:
- Consistent image quality
- Fast page loading (optimized images)
- Easy reuse across pages
- Organized asset library

---

### Element 1: Media Grid
**Location:** Main content
**Visual:** Thumbnail grid

**Each Thumbnail Shows:**
- Image preview
- Filename
- File size
- Dimensions
- Selection checkbox

---

### Element 2: Upload Area
**Location:** Top of page or modal
**Visual:** Drag-and-drop zone

**Accepts:**
- Images: JPEG, PNG, WebP, GIF
- Documents: PDF
- Maximum: 10MB per file

**Auto-Processing:**
- Generates thumbnails
- Creates optimized web versions
- Extracts metadata

---

### Element 3: Folder Organization
**Location:** Left sidebar
**Visual:** Folder tree

**Default Folders:**
- /products - Product images
- /fabrics - Fabric swatches
- /banners - Homepage banners
- /blog - Blog post images
- /misc - Uncategorized

---

## 8. SETTINGS & CONFIGURATION

### Page: `/admin/settings.html`

### Business Purpose
Global configuration that affects the entire store. Changes here impact customer experience, pricing, and operations.

---

### Element 1: Store Settings Form
**Location:** First section
**Visual:** Form card

**Fields:**

| Field | Purpose |
|-------|---------|
| Store Name | Appears in emails, invoices |
| Contact Email | Customer replies go here |
| Phone Number | Displayed on site |
| Address | Invoice/shipping return address |
| Currency | Price display format |
| Timezone | Order timestamps |

---

### Element 2: Pricing Settings
**Location:** Second section
**Visual:** Form card

**Fields:**

| Field | Purpose |
|-------|---------|
| Global Markup | Default profit margin |
| Tax Rate | Sales tax percentage |
| Tax Included | Prices include tax? |
| Round Prices | Round to nearest dollar? |

---

### Element 3: Password Change
**Location:** Security section
**Visual:** Password form

**Fields:**
- Current Password
- New Password
- Confirm New Password

**Validation:**
- Minimum 8 characters
- Must differ from current
- Confirmation must match

**API Call:** `PUT /api/admin/password`

---

## 9. SECURITY

### Page: `/admin/security/audit-logs.html`

### Business Purpose
Audit logs track all administrative actions for:
- Security monitoring
- Compliance requirements
- Troubleshooting issues
- Accountability

---

### Element 1: Logs Table
**Location:** Main content
**Visual:** Data table

**Columns:**

| Column | Description |
|--------|-------------|
| Timestamp | When action occurred |
| User | Who performed action |
| Action | What was done |
| Resource | What was affected |
| IP Address | Origin of request |
| Details | Additional context |

---

### Element 2: Logged Actions

| Action | Description |
|--------|-------------|
| LOGIN | User logged in |
| LOGOUT | User logged out |
| CREATE | New record created |
| UPDATE | Record modified |
| DELETE | Record removed |
| EXPORT | Data exported |
| SETTINGS | Configuration changed |

---

## Appendix A: API Reference Quick Guide

### Authentication
All admin APIs require: `Authorization: Bearer <jwt_token>`

### Common Response Format
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## Appendix B: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `Esc` | Close modal |
| `Ctrl+S` | Save current form |
| `?` | Show help |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| SKU | Stock Keeping Unit - unique product identifier |
| AOV | Average Order Value |
| LTV | Lifetime Value - total customer worth |
| Conversion | Visitor becoming buyer |
| Funnel | Customer journey stages |
| Churn | Customers who stop buying |

---

*Document End - Knowledge Transfer Complete*
