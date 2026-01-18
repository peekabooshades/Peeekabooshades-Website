# Non-Functional Elements Fixes

## Overview

This document tracks all non-functional elements that have been identified and fixed in the Peekaboo Shades website. Non-functional elements include dead links (`href="#"`), placeholder alerts, empty functions, and stub functionality.

## Automated Checker

A script has been created to automatically scan all HTML files for non-functional patterns:

```bash
node scripts/framework/check-nonfunctional.js
```

The checker detects:
- `href="#"` dead links (excluding valid patterns like anchor links and JS handlers)
- "Coming soon" placeholder alerts (excluding proper `showToast()` notifications)
- Empty onclick handlers
- `action="#"` dead forms
- Empty function bodies
- TODO/FIXME/PLACEHOLDER comments in scripts

## Fix Patterns

### Pattern 1: Feature Coming Soon (Disabled State)
For features that are planned but not yet implemented:

```html
<a href="javascript:void(0)"
   onclick="showToast('Feature coming soon!', 'info')"
   style="opacity:0.6"
   title="Coming soon">Feature Name</a>
```

### Pattern 2: Wire to Existing Page
For links that should point to existing pages:

```html
<a href="/contact.html">Contact Us</a>
<a href="/shipping.html">Shipping Info</a>
<a href="/guides/">How to Measure</a>
```

### Pattern 3: Dynamic Preview Links
For admin editor preview links:

```html
<a href="javascript:void(0)"
   onclick="window.open('/product/' + getProductSlug(), '_blank')">View Page</a>
```

## Fixes by File

### Customer Frontend

#### shop.html
- **Top bar links**: Free Samples, Trade Program, Help - wired to appropriate pages/disabled
- **Main nav**: Windows Blinds (working), Curtains (coming soon), Look up My Order (disabled), Bulk Orders (link to /dealer/), Contact Us (wired)
- **Header icons**: Wishlist (coming soon), User icon (coming soon)
- **Footer social icons**: All disabled with opacity + title (no social accounts yet)
- **Footer links**: Customer Service, Talk To Us, Resources columns - all wired to existing pages

#### index.html
- Same header/footer fixes as shop.html
- Instagram section: @Peekabooshades link fixed

#### cart.html
- Same header/footer pattern fixes

#### product.html
- Same header/footer pattern fixes

#### zebra-product.html
- Same header/footer pattern fixes
- Note: `updateControlValueDisplay()` is empty stub (needs implementation)

### Policies Pages

#### policies/contact.html
- "Start Chat" link: Changed to showToast (live chat not implemented)

### Admin Portal

#### admin/marketing/subscribers.html
- "Download sample CSV template": Implemented actual CSV download function

#### admin/product-editor-v2.html
- "View Page" preview link: Now dynamically opens product page

#### admin/product-page-editor.html
- "View Page" preview link: Now dynamically opens product page

#### admin/page-builder.html
- Slider preview button link: Now uses buttonLink from slide data

#### admin/security/index.html
- `loadThreats()`, `loadRecentActivity()`: Empty stubs (security dashboard not implemented)

### Dealer Portal

#### dealer/commissions.html
- CSV export: Fully implemented - downloads commissions as CSV file

#### dealer/index.html
- Price list download: Fully implemented - downloads products as CSV file

## Remaining Items (Low Priority)

The following items are intentionally left as stubs pending backend implementation:

| File | Function | Status |
|------|----------|--------|
| admin/security/index.html | loadThreats() | Stub - needs backend |
| admin/security/index.html | loadRecentActivity() | Stub - needs backend |
| zebra-product.html | updateControlValueDisplay() | Stub - needs implementation |

## Running the Checker

```bash
# From project root
node scripts/framework/check-nonfunctional.js

# Results are written to:
# - Console output with colored severity levels
# - docs/nonfunctional-check-results.json (machine-readable)
```

### Severity Levels

- **HIGH**: Dead links without proper handlers - MUST be fixed before deployment
- **MEDIUM**: Placeholder alerts, empty functions - should be addressed
- **LOW**: TODO markers in scripts - informational

## Statistics

### Before Fixes
- Total issues: 120+
- HIGH severity: 47+ broken links
- Files affected: 13+

### After Fixes
- Total issues: 3
- HIGH severity: 0
- MEDIUM severity: 3 (empty stub functions)
- Files with issues: 2

## Change Log

| Date | Files Changed | Description |
|------|---------------|-------------|
| 2026-01-12 | shop.html, cart.html, product.html | **Free Samples links now work** - Linked to /samples.html page |
| 2026-01-12 | shop.html | **Shop filters fully functional** - Added filter panel with Room, Color, Price, Light Control, Material filters |
| 2026-01-12 | index.html, page.html | **Newsletter subscribe API wired** - Now calls /api/subscribe endpoint |
| 2026-01-12 | shop.html | **Wishlist uses localStorage** - addToWishlist() now persists to localStorage |
| 2026-01-12 | admin/security/index.html, two-factor.html, firewall.html, sso.html | **Security stub pages marked** - Added "UI Preview Only" banners and disabled badges |
| 2025-01-11 | shop.html, index.html, cart.html, product.html, zebra-product.html | Fixed all header/footer broken links |
| 2025-01-11 | policies/contact.html | Fixed chat link |
| 2025-01-11 | dealer/commissions.html | Implemented CSV export |
| 2025-01-11 | dealer/index.html | Implemented price list download |
| 2025-01-11 | admin/*.html | Fixed preview links, CSV template download |
| 2025-01-11 | scripts/framework/check-nonfunctional.js | Created automated checker |

---

## Phase Summary (2026-01-12)

### Phase 1: Customer Frontend Broken Links
- **Free Samples**: Changed from toast "coming soon" to link to `/samples.html`
- Files: `shop.html`, `cart.html`, `product.html` (header and footer)

### Phase 2: Shop Filters Implementation
- Added slide-out filter panel with:
  - Room filter (Living Room, Bedroom, Kitchen, Bathroom, Home Office)
  - Color swatches (10 colors)
  - Price ranges (Under $50, $50-100, $100-200, $200+)
  - Light control (Blackout, Room Darkening, Light Filtering, Sheer)
  - Material (Fabric, Faux Wood, Natural Woven, Vinyl)
- Active filter tags display
- Clear All / Apply Filters buttons
- Filter state persistence during session
- Files: `shop.html`

### Phase 3: Newsletter Subscribe
- Changed from toast-only to actual API call
- Wired to existing `/api/subscribe` endpoint
- Saves: email, source, timestamp to database
- Files: `index.html`, `page.html`

### Phase 4: Wishlist/Account Icons
- Wishlist now uses localStorage for persistence
- Account icons clearly labeled "Coming soon" with reduced opacity
- Files: `shop.html`

### Phase 5: Admin Stub Pages
- Security pages (two-factor.html, firewall.html, sso.html) marked as "UI Preview Only"
- Added banner at top of each page
- Navigation links show "Preview" badge
- Cards on overview show "--" for statistics
- Files: `admin/security/index.html`, `admin/security/two-factor.html`, `admin/security/firewall.html`, `admin/security/sso.html`

---

## Manual Test Steps

### Test Free Samples Link
1. Go to `/shop.html`
2. Click "Free Samples" in top bar
3. Verify redirects to `/samples.html`
4. Verify samples order form is functional

### Test Shop Filters
1. Go to `/shop.html`
2. Click "Filters" button
3. Verify filter panel slides out
4. Select a price range (e.g., "$50 - $100")
5. Click "Apply Filters"
6. Verify product count updates
7. Verify active filter tag appears
8. Click X on filter tag to remove
9. Verify products reset

### Test Newsletter Subscribe
1. Go to `/` (homepage)
2. Scroll to newsletter section
3. Enter email address
4. Click "Subscribe Now!"
5. Verify loading state on button
6. Verify success toast appears
7. Check backend: database.json should have new entry in subscribers array

### Test Security Preview Pages
1. Login to admin panel
2. Go to `/admin/security/`
3. Verify 2FA, Firewall, SSO show "Preview" badge
4. Click on "Two-Factor Auth"
5. Verify purple banner appears: "UI Preview Only"
6. Verify actions don't actually modify anything

---

## QA Commands

```bash
# Run link checker
node backend/scripts/qa-checklist.js

# Run smoke tests (requires server running)
node backend/scripts/smoke-test.js

# Check for remaining href="#"
grep -rn 'href="#"' frontend/public/*.html --include="*.html"
```
