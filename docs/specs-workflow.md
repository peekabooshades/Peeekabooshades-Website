# Specs Library Workflow Documentation

## Overview

The Specs Library system manages technical specifications for all product types (Roller, Zebra, Roman, Honeycomb shades). It provides a centralized source of truth with evidence tracking for every spec field.

## Architecture

```
Backend Data Files:
├── backend/data/product_specs.json    # Canonical specs per product type
└── backend/data/content_sources.json  # Evidence/source tracking per field

API Endpoints:
├── GET /api/specs?productType=roller|zebra|roman|honeycomb  # Public
├── GET /api/admin/specs                                      # Admin list
├── PUT /api/admin/specs                                      # Update specs
├── GET /api/admin/specs/sources                              # Get sources
├── PUT /api/admin/specs/sources                              # Update sources
└── GET /api/admin/specs/sources/:productType                 # Product sources

Admin UI:
└── /admin/specs-library.html          # 3-panel specs editor

Frontend Integration:
├── product.html                       # Loads specs via loadProductSpecs()
└── zebra-product.html                 # Loads specs via loadZebraSpecs()
```

## Data Structure

### product_specs.json

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-01-11",
  "products": {
    "roller": {
      "id": "roller",
      "name": "Roller Shades",
      "pdfPages": [3, 4, 5, 6, 7, 8, 9, 10],
      "description": {
        "short": "...",
        "long": "..."
      },
      "features": ["..."],
      "specifications": {
        "dimensions": {...},
        "controlSystems": [...],
        "valanceTypes": [...],
        "bottomRails": [...],
        "rollTypes": [...],
        "sideCoverColors": [...],
        "lightBlocker": {...},
        "fabricTypes": [...],
        "minimumArea": {...}
      },
      "materials": {...},
      "installation": {...},
      "warranty": "...",
      "careInstructions": "..."
    }
  },
  "commonSpecs": {
    "motors": {...},
    "mounting": {...},
    "childSafety": {...}
  }
}
```

### content_sources.json

```json
{
  "primarySources": {
    "pdf-001": {
      "id": "pdf-001",
      "type": "manufacturer-catalog",
      "title": "Zstarr Blinds Product Catalog 2025",
      "filename": "成品帘总目录册-印刷版-2025.5.16(1).pdf",
      "reliability": "primary"
    }
  },
  "webSources": {},
  "fieldSources": {
    "roller": {
      "description.short": {
        "sourceId": "pdf-001",
        "type": "pdf",
        "page": 3,
        "confidence": "high"
      }
    }
  },
  "missingFields": [...]
}
```

## Admin Workflow

### Adding/Editing Specs

1. Navigate to `/admin/specs-library.html`
2. Select product type from left panel
3. Edit fields in center panel (Description, Specifications, Materials, Installation tabs)
4. For each field edited, click the source indicator to add evidence
5. Click "Save Changes" to persist

### Adding Sources

1. Click the source indicator next to any field
2. Select source type:
   - **PDF**: Link to manufacturer catalog page
   - **Web**: Add URL with extraction date
   - **Admin Written**: Mark as internally authored
3. Add relevant metadata (page number, snippet, confidence level)
4. Save source

### Source Indicators

- **Blue (PDF)**: Sourced from manufacturer catalog
- **Green (Web)**: Sourced from website
- **Yellow (Admin)**: Admin-written content
- **Red (None)**: No source attached - needs attention

## Frontend Integration

The frontend product pages automatically load specs from the API:

```javascript
// In product.html
async function loadProductSpecs() {
  const productType = determineProductType(); // roller|zebra|roman|honeycomb
  const response = await fetch(`/api/specs?productType=${productType}`);
  const { data: specs, commonSpecs } = await response.json();

  // Update page elements with spec data
  updateFeaturesList(specs.features);
  updateCareInstructions(specs.careInstructions);
  updateWarranty(specs.warranty);
  // ... etc
}
```

## Best Practices

1. **Always add sources**: Every spec field should have a source for credibility
2. **Use PDF sources**: Manufacturer catalogs are the most reliable
3. **Track missing fields**: Review `missingFields` array regularly
4. **Version control**: The `version` and `lastUpdated` fields track changes
5. **Confidence levels**: Use "high" for direct quotes, "medium" for interpretations

## API Reference

### GET /api/specs

Public endpoint for fetching product specs.

**Query Parameters:**
- `productType`: (optional) roller|zebra|roman|honeycomb

**Response (with productType):**
```json
{
  "success": true,
  "data": { /* product spec object */ },
  "commonSpecs": { /* shared specs */ }
}
```

**Response (without productType):**
```json
{
  "success": true,
  "data": [
    { "id": "roller", "name": "Roller Shades", "slug": "roller-shades", "pdfPages": [...] }
  ]
}
```

### PUT /api/admin/specs

Update product specifications (admin only).

**Request Body:**
```json
{
  "productType": "roller",
  "specs": { /* updated spec object */ }
}
```

### PUT /api/admin/specs/sources

Update source tracking (admin only).

**Request Body:**
```json
{
  "productType": "roller",
  "fieldPath": "description.short",
  "source": {
    "sourceId": "pdf-001",
    "type": "pdf",
    "page": 3,
    "confidence": "high"
  }
}
```

## Troubleshooting

### Specs not loading on product page

1. Check browser console for API errors
2. Verify server is running on port 3001
3. Check `/api/specs?productType=roller` returns data
4. Ensure `loadProductSpecs()` is called in DOMContentLoaded

### Admin page not saving

1. Verify you're logged in (JWT token valid)
2. Check browser network tab for 401/500 errors
3. Ensure `backend/data/` directory is writable

### Sources not appearing

1. Check `content_sources.json` file exists
2. Verify field path matches exactly (case-sensitive)
3. Look for errors in server console
