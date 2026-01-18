#!/usr/bin/env node
/**
 * Category Seeder Script
 * Seeds/updates the 4 primary shade categories with professional descriptions
 *
 * IDEMPOTENT: Safe to run multiple times
 * - Updates existing categories by slug (preserves ID for product references)
 * - Adds new categories if slug doesn't exist
 * - Does NOT delete existing categories
 *
 * Usage: node scripts/seed-categories.js
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'database.json');

// =============================================================================
// CATEGORY DEFINITIONS
// =============================================================================
const CATEGORIES_TO_SEED = [
  {
    name: 'Zebra Shades',
    slug: 'zebra-shades',
    sortOrder: 1,
    isActive: true,
    showInMenu: true,
    description: "Zebra shades combine alternating sheer and solid bands so you can fine-tune light and privacy throughout the day. They're a modern, clean look that works especially well in living rooms and master bedrooms. Choose light filtering for soft daylight or blackout styles for maximum privacy and better room darkening. Order swatches to match your décor and get custom sizing for a perfect fit."
  },
  {
    name: 'Roller Shades',
    slug: 'roller-shades',
    sortOrder: 2,
    isActive: true,
    showInMenu: true,
    description: "Roller shades are a sleek, minimal option that fits almost any style—from modern to traditional. They're easy to maintain and available in light filtering and blackout fabrics for glare control, privacy, and room darkening. Great for bedrooms, offices, and large windows. Customize your measurements, choose your control type, and get a smooth, tailored finish."
  },
  {
    name: 'Roman Shades',
    slug: 'roman-shades',
    sortOrder: 3,
    isActive: true,
    showInMenu: true,
    description: "Roman shades bring a soft, designer feel with elegant fabric folds and a tailored finish. They're ideal for bedrooms, dining rooms, and spaces where you want warmth and texture. Choose from light filtering or room darkening options, with clean lines that elevate the room. Custom sizing ensures a polished fit and premium look."
  },
  {
    name: 'Honeycomb Shades',
    slug: 'honeycomb-shades',
    sortOrder: 4,
    isActive: true,
    showInMenu: true,
    description: "Honeycomb (cellular) shades are designed for comfort—helping reduce heat gain/loss with an insulating cellular structure while offering excellent light control. They're a top choice for bedrooms, nurseries, and any room where energy efficiency and privacy matter. Available in light filtering and blackout styles, with cordless and motorized options for a clean, safe setup."
  }
];

// =============================================================================
// MAIN LOGIC
// =============================================================================
function seedCategories() {
  console.log('='.repeat(60));
  console.log('CATEGORY SEEDER');
  console.log('='.repeat(60));
  console.log('');

  // Load database
  let db;
  try {
    const rawData = fs.readFileSync(DB_PATH, 'utf8');
    db = JSON.parse(rawData);
  } catch (error) {
    console.error('ERROR: Could not load database.json');
    console.error(error.message);
    process.exit(1);
  }

  // Ensure categories array exists
  if (!Array.isArray(db.categories)) {
    db.categories = [];
  }

  console.log(`Current categories in DB: ${db.categories.length}`);
  console.log('');

  let created = 0;
  let updated = 0;

  for (const seedData of CATEGORIES_TO_SEED) {
    // Find existing category by slug (slug is the unique identifier)
    const existingIndex = db.categories.findIndex(c => c.slug === seedData.slug);

    if (existingIndex >= 0) {
      // UPDATE existing category (preserve ID)
      const existing = db.categories[existingIndex];
      const oldName = existing.name;
      const oldDescription = existing.description;

      // Update fields
      existing.name = seedData.name;
      existing.description = seedData.description;
      existing.sortOrder = seedData.sortOrder;
      existing.isActive = seedData.isActive;
      existing.showInMenu = seedData.showInMenu;

      console.log(`[UPDATE] ${seedData.slug}`);
      console.log(`   ID: ${existing.id} (preserved)`);
      if (oldName !== seedData.name) {
        console.log(`   Name: "${oldName}" -> "${seedData.name}"`);
      }
      if (oldDescription !== seedData.description) {
        console.log(`   Description: Updated to professional copy`);
      }
      console.log(`   sortOrder: ${seedData.sortOrder}, isActive: ${seedData.isActive}`);
      console.log('');

      updated++;

      // Sync name to products if changed
      if (oldName !== seedData.name) {
        db.products.forEach(p => {
          if (p.category_id === existing.id) {
            p.category_name = seedData.name;
            console.log(`   -> Synced product: ${p.name}`);
          }
        });
      }
    } else {
      // CREATE new category
      const newCategory = {
        id: uuidv4(),
        name: seedData.name,
        slug: seedData.slug,
        description: seedData.description,
        sortOrder: seedData.sortOrder,
        isActive: seedData.isActive,
        showInMenu: seedData.showInMenu
      };

      db.categories.push(newCategory);

      console.log(`[CREATE] ${seedData.slug}`);
      console.log(`   ID: ${newCategory.id}`);
      console.log(`   Name: ${seedData.name}`);
      console.log(`   sortOrder: ${seedData.sortOrder}`);
      console.log('');

      created++;
    }
  }

  // Sort categories by sortOrder
  db.categories.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

  // Save database
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Categories created: ${created}`);
    console.log(`Categories updated: ${updated}`);
    console.log(`Total categories now: ${db.categories.length}`);
    console.log('');
    console.log('Database saved successfully!');
  } catch (error) {
    console.error('ERROR: Could not save database.json');
    console.error(error.message);
    process.exit(1);
  }

  // List all categories
  console.log('');
  console.log('='.repeat(60));
  console.log('CURRENT CATEGORIES');
  console.log('='.repeat(60));
  db.categories.forEach((cat, i) => {
    const productCount = db.products.filter(p => p.category_id === cat.id).length;
    console.log(`${i + 1}. ${cat.name}`);
    console.log(`   slug: ${cat.slug}`);
    console.log(`   id: ${cat.id}`);
    console.log(`   products: ${productCount}`);
    console.log(`   sortOrder: ${cat.sortOrder || 'N/A'}, isActive: ${cat.isActive ?? 'N/A'}`);
    console.log('');
  });
}

// Run
seedCategories();
