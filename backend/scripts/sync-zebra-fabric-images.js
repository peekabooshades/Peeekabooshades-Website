#!/usr/bin/env node
/**
 * Sync Zebra Fabric Images from local folder
 * Updates hasImage flag for fabrics that have images
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const IMAGES_DIR = path.join(__dirname, '../../frontend/public/images/fabrics/zebra');

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔧 Syncing Zebra Fabric Images...\n');

// Get all image files (exclude room views and nobg versions)
const imageFiles = fs.readdirSync(IMAGES_DIR)
  .filter(f => f.endsWith('.png') && !f.includes('_nobg') && !f.includes('_room_view'))
  .map(f => f.replace('.png', ''));

console.log(`Found ${imageFiles.length} fabric images in folder`);

// Create a set of unique fabric codes from images
const imageFabricCodes = new Set(imageFiles);

// Update zebraFabrics
let updatedCount = 0;
let missingImages = [];

db.zebraFabrics.forEach(fabric => {
  const hasImage = imageFabricCodes.has(fabric.code);
  if (hasImage) {
    fabric.hasImage = true;
    fabric.image = `/images/fabrics/zebra/${fabric.code}.png`;
    updatedCount++;
  } else {
    fabric.hasImage = false;
    missingImages.push(fabric.code);
  }
});

// Check for images without database entries
const dbCodes = new Set(db.zebraFabrics.map(f => f.code));
const orphanImages = imageFiles.filter(code => !dbCodes.has(code));

console.log(`\nUpdated ${updatedCount} fabrics with images`);
console.log(`Fabrics without images: ${missingImages.length}`);
console.log(`Orphan images (no DB entry): ${orphanImages.length}`);

if (orphanImages.length > 0 && orphanImages.length <= 20) {
  console.log('Orphan images:', orphanImages.join(', '));
}

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('\n✅ Sync complete!');
console.log(`Total fabrics in DB: ${db.zebraFabrics.length}`);
console.log(`Fabrics with images: ${updatedCount}`);
