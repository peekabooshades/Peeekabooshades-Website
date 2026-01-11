#!/usr/bin/env node
/**
 * Fix Bottom Rail - Remove Type E and Type F
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔧 Fixing Bottom Rail options - removing Type E and Type F...\n');

// Keep only Type A, B, C, D (remove Type E and F)
db.productContent.zebraHardwareOptions.bottomRail = [
  {
    id: 'type-a-streamlined',
    value: 'type-a-streamlined',
    label: 'Type A - Streamlined',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page13_bottomrail_img13_745x820.png',
    description: 'Streamlined waterdrop bottom rail',
    isDefault: true,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'type-b-standard',
    value: 'type-b-standard',
    label: 'Type B - Standard',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page13_bottomrail_img14_671x785.png',
    description: 'Standard profile bottom rail',
    isDefault: false,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'type-c-wide',
    value: 'type-c-wide',
    label: 'Type C - Wide Profile',
    price: 2.50,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page13_bottomrail_img15_892x853.png',
    description: 'Wide profile bottom rail',
    isDefault: false,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'type-d-fabric',
    value: 'type-d-fabric',
    label: 'Type D - Fabric Wrapped',
    price: 3.32,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page13_bottomrail_img3_1382x1466.png',
    description: 'Bottom rail wrapped with matching fabric',
    isDefault: false,
    isActive: true,
    sortOrder: 4
  }
];

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('Bottom Rails: ' + db.productContent.zebraHardwareOptions.bottomRail.length + ' options');
db.productContent.zebraHardwareOptions.bottomRail.forEach((b, i) => {
  console.log(`  ${i + 1}. ${b.label}`);
});

console.log('\n✅ Type E and Type F removed!');
