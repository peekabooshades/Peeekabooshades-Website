# Dealer Portal Documentation

Complete guide for the Peekaboo Shades Dealer Portal.

---

## Overview

The Dealer Portal is a B2B platform for authorized resellers to:
- Place wholesale orders with discounted pricing
- Manage their end customers
- Track orders and commissions
- Access dealer-specific resources

---

## Access

**URL**: `http://localhost:3001/dealer/`

**Test Credentials**:
- Email: `john@abcwindows.com`
- Password: `dealer123`

---

## Pages

### 1. Login (`/dealer/login.html`)

Secure login page with JWT authentication.

**Features**:
- Email/password authentication
- 24-hour token expiry
- Auto-redirect if already logged in
- Error handling for invalid credentials

**Token Storage**:
```javascript
localStorage.setItem('dealerToken', token);
localStorage.setItem('dealerUser', JSON.stringify(user));
```

---

### 2. Dashboard (`/dealer/index.html`)

Main landing page after login.

**Stats Cards**:
| Metric | Description |
|--------|-------------|
| Total Orders | Lifetime order count |
| Total Revenue | Lifetime revenue |
| Commissions Earned | Total commission earnings |
| Total Customers | Number of end customers |

**Quick Actions**:
- New Order → `/dealer/new-order.html`
- View Customers → `/dealer/customers.html`
- View Commissions → `/dealer/commissions.html`
- Download Price List (coming soon)

**Recent Orders Table**:
- Shows last 5 orders
- Click to view details
- Link to full order list

---

### 3. Orders (`/dealer/orders.html`)

Complete order management.

**Features**:
- Order list with pagination
- Filter by status (Pending, Processing, Shipped, Delivered)
- Filter by date range (7, 30, 90 days)
- Search by order number or customer name
- Click order to view details modal

**Order Detail Modal**:
- Order status
- Customer information
- Order date
- Item list with dimensions and options
- Subtotal and commission breakdown

---

### 4. New Order (`/dealer/new-order.html`)

Full product configurator for creating orders.

**Step 1: Select Product**
- Grid of available products
- Click to select
- Shows product image and base price

**Step 2: Customer Information**
- Select existing customer from dropdown
- Or enter new customer details:
  - Name (required)
  - Email
  - Phone
  - Address

**Step 3: Dimensions**
- Width input (inches)
- Height input (inches)
- Auto-calculated area in sq ft

**Step 4: Shade Style & Fabric**
- Light filtering options:
  - Light Filtering
  - Blackout (default)
  - Semi-Blackout
- Fabric color swatches
- Click to select fabric

**Step 5: Hardware Options**
| Option | Choices |
|--------|---------|
| Mount Type | Inside Mount, Outside Mount |
| Control Type | Bead Chain, Cordless, Motorized |
| Motor Brand | AOK ($55), Dooya ($47) - shown when motorized |
| Valance Type | No Valance, Fabric Wrapped (+$2.20/m²) |
| Bottom Rail | Standard, Fabric Wrapped (+$2.20/m²) |
| Roller Type | Standard Roll, Reverse Roll (free) |

**Step 6: Accessories**
- Smart Hub (+$23.50)
- USB Charger (+$5.00)
- 15-Channel Remote (+$15.00)

**Step 7: Order Notes**
- Special instructions for manufacturing/shipping

**Order Summary Sidebar**:
- Product image and details
- Price breakdown:
  - Base Price
  - Fabric
  - Hardware
  - Accessories
  - Retail Subtotal
  - Dealer Discount (15-25%)
  - **Your Price**
- Quantity selector
- Add to Cart button
- Save as Quote button

---

### 5. Customers (`/dealer/customers.html`)

End-customer management.

**Features**:
- Customer cards with avatar
- Search by name or email
- Add new customer button
- Edit/Delete actions per customer

**Customer Card Shows**:
- Name and email
- Order count
- Total spent

**Add/Edit Modal**:
- Name (required)
- Email (required)
- Phone
- Address
- City
- Notes

---

### 6. Commissions (`/dealer/commissions.html`)

Earnings and tier tracking.

**Summary Cards**:
| Card | Description |
|------|-------------|
| Total Earned | Lifetime commissions |
| This Month | Current month earnings |
| Pending Payout | Awaiting payment |
| Commission Rate | Based on tier (15-25%) |

**Tier Progress Bar**:
- Visual progress through tiers
- Shows current monthly order count
- Bronze (0-10) → Silver (11-50) → Gold (50+)

**Commission History Table**:
- Date
- Order number
- Customer name
- Order total
- Commission amount
- Payment status (Paid/Pending)

**Export CSV** button (coming soon)

---

## Pricing Tiers

| Tier | Monthly Orders | Discount | Benefits |
|------|----------------|----------|----------|
| **Bronze** | 0-10 | 15% off | Basic wholesale pricing |
| **Silver** | 11-50 | 20% off | Better margins |
| **Gold** | 50+ | 25% off | Best pricing, priority support |

Tier upgrades are automatic based on monthly order volume.

---

## API Endpoints

All endpoints require authentication:
```
Authorization: Bearer <dealerToken>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dealer/login` | Authenticate |
| GET | `/api/dealer/stats` | Dashboard stats |
| GET | `/api/dealer/orders` | List orders |
| GET | `/api/dealer/orders/:id` | Order details |
| POST | `/api/dealer/orders` | Create order |
| GET | `/api/dealer/customers` | List customers |
| POST | `/api/dealer/customers` | Add customer |
| PUT | `/api/dealer/customers/:id` | Update customer |
| DELETE | `/api/dealer/customers/:id` | Delete customer |
| GET | `/api/dealer/commissions` | Commission history |
| GET | `/api/dealer/pricing` | Dealer price list |

---

## Database Collections

### `dealers`
```javascript
{
  "id": "dealer-001",
  "companyName": "ABC Window Coverings",
  "contactName": "John Smith",
  "email": "info@abcwindows.com",
  "phone": "555-123-4567",
  "address": {
    "street": "123 Main St",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90001"
  },
  "tier": "silver",
  "status": "active",
  "monthlyOrderCount": 25,
  "totalOrders": 150,
  "totalRevenue": 45000,
  "commissionRate": 0.10,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### `dealerUsers`
```javascript
{
  "id": "dealer-user-001",
  "dealerId": "dealer-001",
  "name": "John Smith",
  "email": "john@abcwindows.com",
  "password": "$2b$10$...", // bcrypt hashed
  "role": "admin",
  "status": "active",
  "lastLogin": "2024-01-03T10:00:00.000Z"
}
```

### `dealerCustomers`
```javascript
{
  "id": "dc-001",
  "dealerId": "dealer-001",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "555-9999",
  "address": "456 Oak Ave",
  "city": "San Diego",
  "notes": "Prefers morning delivery",
  "orderCount": 5,
  "totalSpent": 1500,
  "createdAt": "2024-01-15T00:00:00.000Z"
}
```

---

## UI Components

### Color Scheme
- Primary: `#2d5a27` (Green)
- Primary Dark: `#1a3a15`
- Background: `#f5f7fa`
- Cards: `#ffffff`
- Text: `#1a1a2e`
- Muted: `#6b7280`

### Tier Badge Colors
- Bronze: `#cd7f32`
- Silver: `#c0c0c0`
- Gold: `#ffd700`

---

## Security

1. **JWT Authentication**: 24-hour expiry tokens
2. **Dealer Isolation**: Dealers can only see their own data
3. **Password Hashing**: bcrypt with salt rounds
4. **HTTPS**: Required in production
5. **Input Validation**: Server-side validation on all inputs

---

## Troubleshooting

### "No token provided" error
- Check if `dealerToken` exists in localStorage
- Token may have expired (24h limit)
- Clear localStorage and re-login

### Products not loading
- Check API endpoint `/api/products`
- Verify server is running on port 3001

### Commission not showing
- Commissions calculated after order delivery
- Check order status is "delivered"

---

## Future Enhancements

- [ ] Bulk order import (CSV)
- [ ] Price list PDF download
- [ ] Quote management
- [ ] Order reorder functionality
- [ ] Mobile app
- [ ] Email notifications
- [ ] Performance analytics
