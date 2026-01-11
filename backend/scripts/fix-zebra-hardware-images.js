#!/usr/bin/env node
/**
 * Fix Zebra Hardware Images and Options
 * Updates the zebraHardwareOptions with correct image paths from extracted catalog
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔧 Fixing Zebra Hardware Options...\n');

// Initialize if needed
if (!db.productContent) db.productContent = {};
if (!db.productContent.zebraHardwareOptions) db.productContent.zebraHardwareOptions = {};

// Updated Valance Types with correct catalog images
db.productContent.zebraHardwareOptions.valanceType = [
  {
    id: 'v2-square',
    value: 'V2',
    label: 'V2 Square Cassette',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/zebra_valance_p12_img3_1142x1089.jpeg',
    description: 'Classic square cassette design',
    isDefault: true,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'v3-fabric-wrapped',
    value: 'V3',
    label: 'V3 Fabric Wrapped',
    price: 3.15,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/zebra_valance_p12_img4_1159x983.jpeg',
    description: 'Cassette wrapped with matching fabric',
    isDefault: false,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 's1-fabric-inserted',
    value: 'S1',
    label: 'S1 Fabric Inserted',
    price: 3.19,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/zebra_valance_p12_img9_1337x1532.jpeg',
    description: 'Cassette with fabric insert panel',
    isDefault: false,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 's2-curve-white',
    value: 'S2',
    label: 'S2 Curve White',
    price: 3.12,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/zebra_valance_p12_img7_883x1049.jpeg',
    description: 'Curved white cassette design',
    isDefault: false,
    isActive: true,
    sortOrder: 4
  },
  {
    id: 's3-fabric-wrapped',
    value: 'S3',
    label: 'S3 Fabric Wrapped',
    price: 3.12,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/zebra_valance_p12_img8_915x1006.jpeg',
    description: 'Streamlined fabric wrapped cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 5
  }
];

// Updated Bottom Rail Types with correct catalog images
db.productContent.zebraHardwareOptions.bottomRail = [
  {
    id: 'type-a-white',
    value: 'type-a-white',
    label: 'Type A - White',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/zebra_bottom_rail_p13_img13_745x820.png',
    description: 'Streamlined waterdrop bottom rail - White',
    isDefault: true,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'type-a-gray',
    value: 'type-a-gray',
    label: 'Type A - Gray',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/zebra_bottom_rail_p13_img16_636x924.png',
    description: 'Streamlined waterdrop bottom rail - Gray',
    isDefault: false,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'type-a-black',
    value: 'type-a-black',
    label: 'Type A - Black',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/zebra_bottom_rail_p13_img17_894x859.png',
    description: 'Streamlined waterdrop bottom rail - Black',
    isDefault: false,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'type-b-fabric',
    value: 'type-b-fabric',
    label: 'Type B - Fabric Wrapped',
    price: 3.32,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/zebra_bottom_rail_p13_img3_1382x1466.png',
    description: 'Bottom rail wrapped with matching fabric',
    isDefault: false,
    isActive: true,
    sortOrder: 4
  }
];

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('✅ Updated Valance Types:', db.productContent.zebraHardwareOptions.valanceType.length);
console.log('✅ Updated Bottom Rails:', db.productContent.zebraHardwareOptions.bottomRail.length);

console.log('\nValance Types:');
db.productContent.zebraHardwareOptions.valanceType.forEach(v => {
  console.log(`  - ${v.label}: $${v.price} (${v.priceType})`);
  console.log(`    Image: ${v.imageUrl}`);
});

console.log('\nBottom Rails:');
db.productContent.zebraHardwareOptions.bottomRail.forEach(b => {
  console.log(`  - ${b.label}: $${b.price} (${b.priceType})`);
  console.log(`    Image: ${b.imageUrl}`);
});

console.log('\n✅ Zebra hardware options updated with correct catalog images!');
