# Categories Setup Documentation

## Overview

This document describes the category data model, how products reference categories, and how to run the category seed script.

---

## Category Data Model

### Storage Location

```
backend/database.json → categories[]
```

### Category Schema

| Field        | Type    | Required | Description                              |
|--------------|---------|----------|------------------------------------------|
| `id`         | UUID    | Yes      | Unique identifier (auto-generated)       |
| `name`       | string  | Yes      | Display name (e.g., "Zebra Shades")      |
| `slug`       | string  | Yes      | URL-safe identifier (e.g., "zebra-shades") |
| `description`| string  | No       | Category description for SEO/display     |
| `sortOrder`  | number  | No       | Display order (1 = first)                |
| `isActive`   | boolean | No       | Whether category is active               |
| `showInMenu` | boolean | No       | Whether to show in navigation            |

### Example Category Object

```json
{
  "id": "661962a6-3a97-47b4-a926-d2984eb66d60",
  "name": "Zebra Shades",
  "slug": "zebra-shades",
  "description": "Zebra shades combine alternating sheer and solid bands...",
  "sortOrder": 1,
  "isActive": true,
  "showInMenu": true
}
```

---

## Product-Category Relationship

### How Products Reference Categories

Products use **three fields** to link to categories:

| Product Field    | Type   | Links To           | Purpose                        |
|------------------|--------|--------------------|--------------------------------|
| `category_id`    | UUID   | `categories[].id`  | Primary foreign key reference  |
| `category_name`  | string | `categories[].name`| Denormalized for display       |
| `category_slug`  | string | `categories[].slug`| Denormalized for URLs          |

### Evidence (from database.json)

```json
// Product object (abbreviated)
{
  "id": "07595ff8-fab4-4e0e-b53b-7b7165cbe69c",
  "name": "Affordable Custom Zebra Shades",
  "category_id": "661962a6-3a97-47b4-a926-d2984eb66d60",
  "category_name": "Zebra Shades",
  "category_slug": "zebra-shades"
}
```

### Sync Behavior (backend/server.js:2033-2040)

When a category is updated via the admin API, the server automatically syncs `category_name` and `category_slug` to all products with matching `category_id`.

---

## API Endpoints

### Public API

| Method | Endpoint           | Description           |
|--------|--------------------|-----------------------|
| GET    | `/api/categories`  | List all categories   |

### Admin API (requires auth)

| Method | Endpoint                    | Description                     |
|--------|-----------------------------|---------------------------------|
| GET    | `/api/admin/categories`     | List categories with product count |
| POST   | `/api/admin/categories`     | Create new category             |
| PUT    | `/api/admin/categories/:id` | Update category                 |
| DELETE | `/api/admin/categories/:id` | Delete category                 |

---

## Running the Seed Script

### Location

```
backend/scripts/seed-categories.js
```

### Usage

```bash
cd backend
node scripts/seed-categories.js
```

### What It Does

1. **Updates existing categories** by matching `slug` (preserves `id` for product references)
2. **Adds new categories** if slug doesn't exist
3. **Adds professional descriptions** to all 4 shade categories
4. **Adds fields**: `sortOrder`, `isActive`, `showInMenu`
5. **Syncs product names** if category name changes

### Idempotency

The script is **safe to run multiple times**:
- Matches existing categories by `slug`
- Preserves `id` to maintain product links
- Does NOT delete existing categories
- Does NOT create duplicates

### Expected Output

```
============================================================
CATEGORY SEEDER
============================================================

Current categories in DB: 5

[UPDATE] zebra-shades
   ID: 661962a6-3a97-47b4-a926-d2984eb66d60 (preserved)
   Description: Updated to professional copy
   sortOrder: 1, isActive: true

[UPDATE] roller-shades
   ID: 80634dfd-ee5b-4867-85c9-d7aeee2f1ad6 (preserved)
   Description: Updated to professional copy
   sortOrder: 2, isActive: true

...

============================================================
SUMMARY
============================================================
Categories created: 0
Categories updated: 4
Total categories now: 5
```

---

## Seeded Categories

| #  | Name             | Slug             | sortOrder |
|----|------------------|------------------|-----------|
| 1  | Zebra Shades     | zebra-shades     | 1         |
| 2  | Roller Shades    | roller-shades    | 2         |
| 3  | Roman Shades     | roman-shades     | 3         |
| 4  | Honeycomb Shades | honeycomb-shades | 4         |

---

## Validation Checklist

After running the seed script:

- [ ] Admin panel shows 4+ categories at `/admin/categories.html`
- [ ] Each category has:
  - Correct name
  - Correct slug
  - Professional description
  - Product count (if products exist)
- [ ] Clicking category slug in shop URL works: `/shop?category=zebra-shades`
- [ ] Products remain linked (verify `category_name` matches)

---

## Files Referenced

| File | Line(s) | Purpose |
|------|---------|---------|
| `backend/database.json` | categories array | Category storage |
| `backend/server.js` | 1964-1977 | GET categories API |
| `backend/server.js` | 1981-2005 | POST create category |
| `backend/server.js` | 2009-2048 | PUT update category |
| `backend/server.js` | 2033-2040 | Product sync on update |
| `frontend/public/admin/categories.html` | all | Admin UI |
| `backend/scripts/seed-categories.js` | all | Seed script |

---

## Notes

- The `Drapes` category may exist in the database; the seed script does NOT remove it
- If adding new categories in the future, add them to `CATEGORIES_TO_SEED` in the seed script
- Frontend navigation may be static; check `/frontend/public/index.html` nav if categories aren't showing dynamically
