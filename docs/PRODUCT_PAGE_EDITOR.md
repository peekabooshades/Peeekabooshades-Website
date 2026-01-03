# Product Page Editor - Technical Documentation

## Overview

The Product Page Editor is an admin tool that allows you to customize the product detail page layout and styling without writing code. It works like a Shopify-style visual builder.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN PORTAL                              │
│  /admin/product-page-editor.html?slug=<product-slug>            │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Left Column    │    │  Right Column (Edit Panel)          │ │
│  │  - Preview      │    │  - Element Settings                 │ │
│  │  - Drag & Drop  │    │  - Typography Controls              │ │
│  │  - Visibility   │    │  - Colors, Spacing                  │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SAVE (API Call)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (server.js)                          │
│                                                                  │
│  PUT /api/admin/products/:slug/page-layout                      │
│  GET /api/product-page-sections/:slug                            │
│                                                                  │
│  Stores data in: database.json → productPageLayouts              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ LOAD (API Call)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRODUCT PAGE (product.html)                    │
│  /product/<slug>                                                 │
│                                                                  │
│  1. Fetches layout from API                                     │
│  2. Calls applyLayout() function                                │
│  3. applyElementStyles() applies typography to DOM              │
└─────────────────────────────────────────────────────────────────┘
```

## File Locations

| File | Purpose |
|------|---------|
| `/frontend/public/admin/product-page-editor.html` | Admin visual editor |
| `/frontend/public/product.html` | Customer-facing product page |
| `/backend/server.js` | API endpoints |
| `/backend/database.json` | Data storage (`productPageLayouts` key) |

## Data Flow

### 1. Admin Saves Layout

```javascript
// In product-page-editor.html
async function saveLayout() {
  const response = await Admin.API.put(`/admin/products/${slug}/page-layout`, {
    layout: pageData.layout
  });
}
```

### 2. Backend Stores Data

```javascript
// In server.js
app.put('/api/admin/products/:slug/page-layout', authenticateAdmin, (req, res) => {
  db.data.productPageLayouts[slug] = req.body.layout;
  db.write();
});
```

### 3. Product Page Loads & Applies

```javascript
// In product.html
async function loadProductData() {
  const layoutResponse = await fetch(`/api/product-page-sections/${slug}`);
  const layoutResult = await layoutResponse.json();

  if (layoutResult.success && layoutResult.layout) {
    applyLayout(layoutResult.layout);  // This calls applyElementStyles()
  }
}
```

## Database Structure

Layout data is stored in `database.json` under `productPageLayouts`:

```json
{
  "productPageLayouts": {
    "affordable-custom-roller-blinds": {
      "galleryPosition": "left",
      "configuratorStyle": "dropdown",
      "showBreadcrumbs": true,
      "stickyConfigurator": true,
      "elements": [
        {
          "id": "productTitle",
          "column": "right",
          "order": 2,
          "hidden": false,
          "deleted": false,
          "settings": {
            "title": "Product Name",
            "description": "Product description",
            "titleFontFamily": "Helvetica, Arial, sans-serif",
            "titleFontSize": "28px",
            "titleFontWeight": "700",
            "titleColor": "#333333",
            ...
          }
        },
        // ... more elements
      ]
    }
  }
}
```

## Product Title Typography Settings

The Product Title element supports these settings:

### Title Typography
| Setting | Description | Example Values |
|---------|-------------|----------------|
| `titleFontFamily` | Font family for title | `"Helvetica, Arial, sans-serif"` |
| `titleFontSize` | Font size | `"18px"`, `"24px"`, `"32px"` |
| `titleFontWeight` | Font weight | `"300"` (Light), `"700"` (Bold) |
| `titleItalic` | Italic style | `true` / `false` |
| `titleUnderline` | Underline | `true` / `false` |
| `titleUppercase` | Uppercase transform | `true` / `false` |
| `titleColor` | Text color | `"#333333"` |
| `titleAlign` | Text alignment | `"left"`, `"center"`, `"right"` |

### Description Typography
| Setting | Description | Example Values |
|---------|-------------|----------------|
| `descFontFamily` | Font family | `"Helvetica, Arial, sans-serif"` |
| `descFontSize` | Font size | `"12px"`, `"14px"`, `"16px"` |
| `descColor` | Text color | `"#666666"` |

### Background & Spacing
| Setting | Description | Example Values |
|---------|-------------|----------------|
| `backgroundColor` | Background color | `"#ffffff"` |
| `backgroundTransparent` | Make transparent | `true` / `false` |
| `padding` | Padding | `"0"`, `"8px"`, `"16px"` |
| `borderRadius` | Corner radius | `"0"`, `"4px"`, `"8px"` |

## How Typography is Applied

In `product.html`, the `applyElementStyles()` function:

```javascript
function applyElementStyles(elements) {
  const titleElement = elements.find(el => el.id === 'productTitle');
  if (titleElement && titleElement.settings) {
    const settings = titleElement.settings;
    const titleEl = document.getElementById('productTitle');

    // Apply with !important to override CSS
    if (settings.titleFontFamily) {
      titleEl.style.setProperty('font-family', settings.titleFontFamily, 'important');
    }
    if (settings.titleFontSize) {
      titleEl.style.setProperty('font-size', settings.titleFontSize, 'important');
    }
    // ... more styles
  }
}
```

## Available Page Elements

| Element ID | Description |
|------------|-------------|
| `gallery` | Product image gallery |
| `selectShades` | Shade configuration dropdown |
| `productTitle` | Product name and description |
| `price` | Price display with discount |
| `features` | Feature badges |
| `trustBadges` | Shipping, warranty, returns |
| `addToCart` | Add to cart button |
| `requestQuote` | Request quote button |
| `quantity` | Quantity selector |
| `deliveryInfo` | Delivery information |
| `productDetails` | Product details section |
| `faqSection` | FAQ accordion |
| `exploreTrends` | Related products |

## Troubleshooting

### Changes Not Appearing on Product Page

1. **Hard refresh the browser**: Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

2. **Check browser console**: Open DevTools (F12) and look for:
   ```
   Title styles applied: { titleFontFamily: "Helvetica...", ... }
   ```

3. **Verify data is saved**: Check the API response:
   ```bash
   curl "http://localhost:3001/api/product-page-sections/your-product-slug"
   ```

4. **Clear browser cache**: The browser may be caching the old CSS/JS

### CSS Not Overriding

The code uses `style.setProperty(..., 'important')` to ensure inline styles override CSS. If styles still don't appear:

1. Check if the element ID exists in the HTML (`id="productTitle"`)
2. Verify JavaScript has no errors in the console
3. Ensure the layout API is returning the correct data

## API Endpoints

### Admin Endpoints (Require Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/products/:slug/page-layout` | Get layout for editing |
| PUT | `/api/admin/products/:slug/page-layout` | Save layout changes |
| GET | `/api/admin/products/:slug/options` | Get product options |
| PUT | `/api/admin/products/:slug/options` | Save product options |

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/product-page-sections/:slug` | Get layout for product page |
| GET | `/api/products/:slug/options` | Get product options |

## Adding New Typography Options

To add new typography controls:

1. **Add to Edit Panel** (`product-page-editor.html`):
   - Find the `case 'productTitle':` in `getElementEditPanel()`
   - Add new form fields with appropriate IDs

2. **Add to Save Handler** (`product-page-editor.html`):
   - Find the `case 'productTitle':` in `saveCurrentEdit()`
   - Add code to save the new field values

3. **Add to Frontend** (`product.html`):
   - Find `applyElementStyles()` function
   - Add code to apply the new styles to DOM elements

Example:
```javascript
// In save handler
editingElement.settings.newSetting = document.getElementById('editNewSetting')?.value;

// In applyElementStyles
if (settings.newSetting) {
  titleEl.style.setProperty('css-property', settings.newSetting, 'important');
}
```
