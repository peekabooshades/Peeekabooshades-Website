# PEEKABOO SHADES - NON-FUNCTIONAL ELEMENTS REPORT
## Complete List of Broken, Unlinked, and Stub Features

**Audit Date:** January 11, 2026
**Document Type:** Production Readiness - Non-Functional Elements Inventory

---

# SUMMARY STATISTICS

| Category | Count |
|----------|-------|
| **Total Non-Functional Elements** | 127 |
| **Broken Links (href="#")** | 47 |
| **Stub Pages (UI Only, No Backend)** | 12 |
| **Buttons with No Action** | 28 |
| **Admin Features Not Connected to Frontend** | 18 |
| **Backend APIs with No Frontend UI** | 8 |
| **Placeholder Functions** | 14 |

---

# PART 1: CUSTOMER FRONTEND PAGES

## 1.1 SHOP.HTML - Product Listing Page

### Broken Links (href="#")
| Line | Element | Text | Issue |
|------|---------|------|-------|
| 911 | `<a href="#">` | Free Samples | No destination |
| 912 | `<a href="#">` | Trade Program | No destination |
| 913 | `<a href="#">` | Help | No destination |
| 936 | `<a href="#">` | Curtains | No destination |
| 937 | `<a href="#">` | Look up My Order | No destination |
| 938 | `<a href="#">` | Bulk Orders/Wholesale | No destination |
| 939 | `<a href="#">` | Contact Us | Should link to /contact.html |
| 940 | `<a href="#">` | My Account | No account system |
| 949 | `<a href="#">` | Heart/Wishlist Icon | No wishlist system |
| 950 | `<a href="#">` | User Account Icon | No account system |
| 1119 | `<a href="#">` | Facebook Icon | No social link |
| 1120 | `<a href="#">` | Instagram Icon | No social link |
| 1121 | `<a href="#">` | Twitter Icon | No social link |
| 1122 | `<a href="#">` | Pinterest Icon | No social link |

### Non-Functional Filters
| Element | Function | Current Behavior | Expected Behavior |
|---------|----------|------------------|-------------------|
| Filter Button | `toggleFilterPanel()` | Shows "Filter panel coming soon!" toast | Should open filter panel |
| Room Filter Dropdown | - | No handler | Should filter by room |
| Color Filter | - | No handler | Should filter by color |
| Price Range Slider | - | No handler | Should filter by price |
| Material Filter | - | No handler | Should filter by material |
| Light Filtering Filter | - | No handler | Should filter products |

### Missing Backend Connections
| Feature | Frontend Element | Backend Status |
|---------|------------------|----------------|
| Wishlist | Heart icon buttons | No wishlist API exists |
| User Account | User icon | No customer account system |
| Product Search | Search bar | Search works but limited |
| Quick View | Quick view button | Modal shows but limited data |

---

## 1.2 INDEX.HTML - Homepage

### Broken Links
| Element | Text | Issue |
|---------|------|-------|
| Footer Links | Various | Multiple placeholder links |
| Social Icons | Facebook, Instagram, Twitter, Pinterest | href="#" - no URLs |

### Stub Functions
| Function | Line | Current Behavior |
|----------|------|------------------|
| Newsletter Subscribe | 1768 | Shows toast only, no backend email capture |

---

## 1.3 PRODUCT.HTML - Roller Shades Configurator

### Non-Functional Elements
| Element | Issue |
|---------|-------|
| Share to Facebook | Opens Facebook but may not format correctly |
| Share to Pinterest | Opens Pinterest but may not format correctly |
| Share to Twitter | Opens Twitter but may not format correctly |

### Missing Backend for Admin Features
| Admin Setting | Admin Page | Frontend Impact |
|---------------|------------|-----------------|
| Image positions | product-page-editor.html | Changes saved but require manual CSS update |

---

## 1.4 CART.HTML - Shopping Cart

### Missing Features
| Feature | Status |
|---------|--------|
| Apply Coupon | Button exists, validation limited |
| Save for Later | No feature exists |
| Estimated Delivery | Static text, not calculated |

---

## 1.5 PAGE.HTML - CMS Dynamic Page

### Placeholder Functions
| Function | Line | Behavior |
|----------|------|----------|
| selectFabric() | 797 | `alert('Selected fabric: ' + code)` - just shows alert |
| Newsletter form | 828 | `alert('Thank you for subscribing with: ' + email)` - no backend |

---

# PART 2: DEALER PORTAL

## 2.1 DEALER/INDEX.HTML - Dashboard

### Non-Functional Buttons
| Button | Function | Current Behavior |
|--------|----------|------------------|
| Download Price List | `downloadPriceList()` | Shows `alert('Price list download coming soon!')` |

---

## 2.2 DEALER/COMMISSIONS.HTML - Commission Tracking

### Non-Functional Buttons
| Button | Function | Line | Current Behavior |
|--------|----------|------|------------------|
| Export CSV | `exportToCsv()` | 477 | Shows `alert('CSV export coming soon!')` |

### Missing Backend Features
| Feature | Status |
|---------|--------|
| Commission calculation | Displays mock data |
| Payment tracking | No payment integration |
| Historical data | Limited to current period |

---

## 2.3 DEALER/NEW-ORDER.HTML - Create Order

### Working but Limited
| Feature | Status |
|---------|--------|
| Customer lookup | Works |
| Product selection | Works |
| Price calculation | Works |
| Order submission | Works but no email confirmation |

---

## 2.4 DEALER/ORDERS.HTML - Order List

### Limited Features
| Feature | Issue |
|---------|-------|
| Bulk actions | Not available |
| Export orders | Not available |

---

## 2.5 DEALER/CUSTOMERS.HTML - Customer Management

### Working Features
All core CRUD operations work.

### Missing Features
| Feature | Status |
|---------|--------|
| Import customers | Not available |
| Export customers | Not available |
| Merge duplicates | Not available |

---

# PART 3: MANUFACTURER PORTAL

## 3.1 MANUFACTURER/INDEX.HTML - Dashboard

### Fully Functional Features
- Order list
- Status updates
- Download order sheet (CSV)
- Download order sheet (PDF)
- Tracking number entry
- Shipping cost entry

### No Issues Found
Manufacturer portal is the most complete portal.

---

# PART 4: ADMIN PORTAL - SECURITY SECTION

## 4.1 SECURITY/TWO-FACTOR.HTML - 2FA Setup

### STATUS: COMPLETE UI STUB - NO BACKEND

| Button | Expected Action | Actual Behavior |
|--------|-----------------|-----------------|
| Enable 2FA | Start 2FA setup | No backend endpoint |
| Verify Code | Verify TOTP code | No backend endpoint |
| Generate Backup Codes | Create recovery codes | No backend endpoint |
| Disable 2FA | Turn off 2FA | No backend endpoint |

### Missing Backend Endpoints
```
POST /api/admin/security/2fa/enable     - Does not exist
POST /api/admin/security/2fa/verify     - Does not exist
POST /api/admin/security/2fa/backup     - Does not exist
DELETE /api/admin/security/2fa          - Does not exist
```

---

## 4.2 SECURITY/SSO.HTML - Single Sign-On

### STATUS: COMPLETE UI STUB - NO BACKEND

| Provider | Button | Status |
|----------|--------|--------|
| Google Workspace | Configure | UI only, no OAuth integration |
| Microsoft Azure AD | Configure | UI only, no OAuth integration |
| Okta | Configure | UI only, no SAML integration |
| Custom SAML | Configure | UI only, no SAML integration |
| LDAP/Active Directory | Configure | UI only, no LDAP integration |
| GitHub | Configure | UI only, no OAuth integration |

### Missing Backend Endpoints
```
POST /api/admin/security/sso/google     - Does not exist
POST /api/admin/security/sso/microsoft  - Does not exist
POST /api/admin/security/sso/okta       - Does not exist
POST /api/admin/security/sso/saml       - Does not exist
POST /api/admin/security/sso/ldap       - Does not exist
POST /api/admin/security/sso/github     - Does not exist
```

---

## 4.3 SECURITY/FIREWALL.HTML - IP Firewall

### STATUS: COMPLETE UI STUB - NO ENFORCEMENT

| Feature | UI Status | Backend Status |
|---------|-----------|----------------|
| Enable/Disable Firewall | Toggle exists | No middleware to enforce |
| IP Whitelist | Can add IPs | IPs not persisted |
| IP Blacklist | Can add IPs | IPs not persisted |
| Country Blocking | Can select countries | No enforcement |
| Rate Limiting | Toggle exists | No rate limiter middleware |

### Missing Backend
```
POST /api/admin/security/firewall/rules     - Does not exist
GET /api/admin/security/firewall/rules      - Does not exist
DELETE /api/admin/security/firewall/rules   - Does not exist
POST /api/admin/security/firewall/toggle    - Does not exist
```

### Missing Middleware
- No IP checking middleware in server.js
- No rate limiting middleware
- No country blocking logic

---

## 4.4 SECURITY/SESSIONS.HTML - Active Sessions

### STATUS: PARTIAL - VIEW ONLY

| Feature | UI Status | Backend Status |
|---------|-----------|----------------|
| View Current Session | Works | Shows mock data |
| View All Sessions | Works | Shows mock data |
| Revoke Session | Button exists | **DOES NOT WORK** |
| Revoke All Sessions | Button exists | **DOES NOT WORK** |

### Why Revoke Doesn't Work
- JWT tokens are stateless
- No token blacklist exists
- No session store to invalidate
- Tokens remain valid until expiry

### Missing Backend
```
POST /api/admin/security/sessions/revoke     - Does not exist
POST /api/admin/security/sessions/revoke-all - Does not exist
```

---

## 4.5 SECURITY/API-SECURITY.HTML - API Key Management

### STATUS: PARTIAL

| Feature | UI Status | Backend Status |
|---------|-----------|----------------|
| View API Keys | Works | Shows existing keys |
| Create New Key | Button exists | Limited functionality |
| Revoke Key | Button exists | May work |
| Rate Limit Settings | Form exists | Not enforced |

---

## 4.6 SECURITY/PERMISSIONS.HTML - RBAC Permissions

### STATUS: WORKING
- Role definitions work
- Permission matrix works
- User role assignment works

---

## 4.7 SECURITY/USERS.HTML - Admin Users

### STATUS: WORKING
- Create admin users works
- Edit users works
- Delete users works
- Role assignment works

---

## 4.8 SECURITY/AUDIT-LOGS.HTML - Audit Logs

### STATUS: WORKING
- Logs are recorded
- Logs are displayed
- Filtering works

---

# PART 5: ADMIN PORTAL - MARKETING SECTION

## 5.1 MARKETING/SOCIAL.HTML - Social Media

### STATUS: COMPLETE UI STUB - NO INTEGRATIONS

| Platform | Connect Button | Status |
|----------|----------------|--------|
| Facebook | Connect Account | No OAuth - just UI |
| Instagram | Connect Account | No OAuth - just UI |
| Twitter/X | Connect Account | No OAuth - just UI |
| Pinterest | Connect Account | No OAuth - just UI |
| TikTok | Connect Account | No OAuth - just UI |

| Feature | UI Status | Backend Status |
|---------|-----------|----------------|
| Post Composer | Form exists | Cannot post - no API integration |
| Schedule Posts | UI exists | No scheduling system |
| Analytics | Graphs exist | Mock data only |

### Missing Backend
- No OAuth tokens stored
- No social media API integrations
- No scheduling cron jobs
- No analytics data collection

---

## 5.2 MARKETING/CAMPAIGNS.HTML - Email Campaigns

### STATUS: PARTIAL UI - NO EMAIL SERVICE

| Feature | UI Status | Backend Status |
|---------|-----------|----------------|
| Create Campaign | Form exists | No email service configured |
| Campaign Templates | Gallery exists | Templates not functional |
| Send Campaign | Button exists | **CANNOT SEND - No SMTP** |
| Analytics | Dashboard exists | No data collection |

### Missing Configuration
```javascript
// Required but missing:
SMTP_HOST=           // Not configured
SMTP_PORT=           // Not configured
SMTP_USER=           // Not configured
SMTP_PASS=           // Not configured
FROM_EMAIL=          // Not configured
```

---

## 5.3 MARKETING/AUTOMATIONS.HTML - Email Automations

### STATUS: UI STUB ONLY

| Automation Type | UI Status | Backend Status |
|-----------------|-----------|----------------|
| Welcome Email | Template exists | Cannot send |
| Abandoned Cart | Template exists | Cannot send |
| Order Confirmation | Template exists | Cannot send |
| Review Request | Template exists | Cannot send |
| Re-engagement | Template exists | Cannot send |

### Why Not Working
- No email service configured
- No automation triggers implemented
- No cron jobs for scheduled sends

---

## 5.4 MARKETING/SUBSCRIBERS.HTML - Email Subscribers

### STATUS: PARTIAL

| Feature | Status |
|---------|--------|
| View Subscribers | Works (if any exist) |
| Add Subscriber | Works |
| Delete Subscriber | Works |
| Export List | May not work |
| Send Email | **CANNOT SEND** |

---

## 5.5 MARKETING/PROMOTIONS.HTML - Coupon Codes

### STATUS: MOSTLY WORKING

| Feature | Status |
|---------|--------|
| Create Coupon | Works |
| Edit Coupon | Works |
| Delete Coupon | Works |
| Apply at Checkout | Partially works |

### Limitations
- Limited validation rules
- No usage tracking
- No customer-specific coupons

---

# PART 6: ADMIN PORTAL - ONLINE STORE SECTION

## 6.1 ONLINE-STORE/HOMEPAGE.HTML

### STATUS: WORKING
Settings save and affect frontend.

---

## 6.2 ONLINE-STORE/BANNERS.HTML

### STATUS: WORKING
- Create banners works
- Toggle visibility works
- Delete works

---

## 6.3 ONLINE-STORE/NAVIGATION.HTML

### STATUS: WORKING
- Edit navigation works
- Saves to database
- Reflects on frontend

---

## 6.4 ONLINE-STORE/THEMES.HTML

### STATUS: PARTIAL

| Feature | Status |
|---------|--------|
| View Themes | Works |
| Select Theme | Works |
| Custom Colors | Works |
| Upload Custom Theme | **NOT WORKING** |

---

## 6.5 ONLINE-STORE/SHOP-SETTINGS.HTML

### STATUS: WORKING
Settings save and affect shop page.

---

# PART 7: ADMIN PORTAL - CONTENT SECTION

## 7.1 BLOG/POSTS.HTML

### STATUS: ADMIN ONLY - NO PUBLIC BLOG

| Feature | Admin Status | Public Status |
|---------|--------------|---------------|
| Create Post | Works | **No public blog page** |
| Edit Post | Works | **No public blog page** |
| Delete Post | Works | **No public blog page** |
| Categories | Works | **No public blog page** |

### Missing
```
/blog.html                    - Does not exist
/blog/:slug.html              - Does not exist
/api/public/blog/posts        - Does not exist
```

---

## 7.2 PAGES.HTML - CMS Pages

### STATUS: WORKING
- Create pages works
- Edit pages works
- Delete pages works
- Public /page.html?slug=xxx works

---

## 7.3 FAQS.HTML - FAQ Management

### STATUS: WORKING
- CRUD operations work
- Public FAQ display works

---

# PART 8: ADMIN FEATURES NOT CONNECTED TO FRONTEND

## 8.1 Settings That Don't Affect UI

| Admin Page | Setting | Frontend Impact |
|------------|---------|-----------------|
| theme-settings.html | Custom Fonts | Not loaded on frontend |
| theme-settings.html | Custom CSS | Not injected |
| system-config.html | Maintenance Mode | No enforcement |
| system-config.html | Analytics ID | May not be embedded |

## 8.2 Content Management Gaps

| Admin Feature | Editable | Affects Frontend |
|---------------|----------|------------------|
| Hero Section Text | Yes | May not update |
| Feature Icons | Yes | May not update |
| Testimonials | Yes | May not update |
| Partner Logos | Yes | May not update |

## 8.3 Product Page Editor Gaps

| Feature | Admin Behavior | Frontend Behavior |
|---------|----------------|-------------------|
| Image Position | Saves value | Requires CSS update |
| Image Size | Saves value | Requires CSS update |
| Image Alignment | Saves value | Requires CSS update |

---

# PART 9: BACKEND APIs WITHOUT FRONTEND UI

## 9.1 Existing APIs with No Admin Interface

| API Endpoint | Method | Purpose | Admin UI |
|--------------|--------|---------|----------|
| `/api/admin/backup` | POST | Database backup | No UI |
| `/api/admin/restore` | POST | Database restore | No UI |
| `/api/admin/export/orders` | GET | Export all orders | No dedicated UI |
| `/api/admin/import/prices` | POST | Import pricing | No dedicated UI |
| `/api/webhooks` | Various | Webhook management | No UI |

---

# PART 10: COMPLETE ELEMENT CHECKLIST

## Customer Frontend Broken Links (47 total)

| Page | Element | Count |
|------|---------|-------|
| shop.html | Navigation links | 6 |
| shop.html | Footer links | 8 |
| shop.html | Social icons | 4 |
| index.html | Footer links | 12 |
| index.html | Social icons | 4 |
| cart.html | Footer links | 8 |
| product.html | Footer links | 5 |

## Admin Stub Pages (12 total)

| Page | Status |
|------|--------|
| security/two-factor.html | UI only |
| security/sso.html | UI only |
| security/firewall.html | UI only |
| security/sessions.html | View only |
| security/api-security.html | Partial |
| marketing/social.html | UI only |
| marketing/campaigns.html | No email |
| marketing/automations.html | UI only |
| marketing/subscribers.html | No email |
| blog/posts.html | No public page |
| online-store/themes.html | Partial |
| draft-orders.html | Partial |

---

# RECOMMENDATIONS FOR PRODUCTION

## CRITICAL (Must Fix Before Production)

1. **Remove or Hide Non-Functional Security Pages**
   - Either implement 2FA, SSO, Firewall OR remove menu items
   - Showing security features that don't work is misleading

2. **Fix Broken Navigation Links**
   - Update all `href="#"` to proper destinations
   - Remove links to non-existent features

3. **Disable Coming Soon Features**
   - Hide export CSV until implemented
   - Hide price list download until implemented

## HIGH PRIORITY

1. **Add Email Service**
   - Required for order confirmations
   - Required for marketing features

2. **Implement Session Management**
   - Add token blacklist for revocation
   - Track active sessions properly

3. **Fix Shop Page Filters**
   - Implement actual filtering logic
   - Connect to product API

## MEDIUM PRIORITY

1. **Create Public Blog**
   - Add /blog.html
   - Connect to admin blog posts

2. **Complete Theme System**
   - Make custom theme upload work
   - Apply saved theme settings

3. **Add Customer Accounts**
   - User registration
   - Order history
   - Saved addresses

---

# END OF REPORT
