#!/usr/bin/env node
/**
 * Fix Zebra Hardware Options with ALL images from PDF
 * Page 12: 8 Valance/Cassette Types
 * Page 13: Bottom Rails
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔧 Updating Zebra Hardware Options with ALL PDF images...\n');

// Initialize if needed
if (!db.productContent) db.productContent = {};
if (!db.productContent.zebraHardwareOptions) db.productContent.zebraHardwareOptions = {};

// All 8 Valance/Cassette Types from Page 12
// Images extracted from PDF page 12
db.productContent.zebraHardwareOptions.valanceType = [
  {
    id: 'v1-open',
    value: 'V1',
    label: 'V1 Open (No Cassette)',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page12_valance_img1_1459x1613.jpeg',
    description: 'Open roller without cassette cover',
    isDefault: false,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'v2-square',
    value: 'V2',
    label: 'V2 Square Cassette',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page12_valance_img3_1142x1089.jpeg',
    description: 'Classic square cassette design',
    isDefault: true,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'v3-fabric-wrapped',
    value: 'V3',
    label: 'V3 Fabric Wrapped',
    price: 3.15,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img4_1159x983.jpeg',
    description: 'Cassette wrapped with matching fabric',
    isDefault: false,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 's1-fabric-inserted',
    value: 'S1',
    label: 'S1 Fabric Inserted',
    price: 3.19,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img5_1468x1595.png',
    description: 'Cassette with fabric insert panel',
    isDefault: false,
    isActive: true,
    sortOrder: 4
  },
  {
    id: 's2-curve-white',
    value: 'S2',
    label: 'S2 Curve White',
    price: 3.12,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img6_1510x1631.png',
    description: 'Curved white cassette design',
    isDefault: false,
    isActive: true,
    sortOrder: 5
  },
  {
    id: 's3-round',
    value: 'S3',
    label: 'S3 Round Cassette',
    price: 3.12,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img7_883x1049.jpeg',
    description: 'Round profile cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 6
  },
  {
    id: 's4-premium',
    value: 'S4',
    label: 'S4 Premium Cassette',
    price: 3.50,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img8_915x1006.jpeg',
    description: 'Premium finish cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 7
  },
  {
    id: 's5-deluxe',
    value: 'S5',
    label: 'S5 Deluxe Cassette',
    price: 3.75,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img9_1337x1532.jpeg',
    description: 'Deluxe fabric wrapped cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 8
  }
];

// Bottom Rail Types from Page 13
// Images 13-19 are the bottom rail close-ups
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
  },
  {
    id: 'type-e-slim',
    value: 'type-e-slim',
    label: 'Type E - Slim',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page13_bottomrail_img16_636x924.png',
    description: 'Slim profile bottom rail',
    isDefault: false,
    isActive: true,
    sortOrder: 5
  },
  {
    id: 'type-f-premium',
    value: 'type-f-premium',
    label: 'Type F - Premium',
    price: 3.00,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page13_bottomrail_img17_894x859.png',
    description: 'Premium finish bottom rail',
    isDefault: false,
    isActive: true,
    sortOrder: 6
  }
];

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('='.repeat(60));
console.log('ZEBRA HARDWARE OPTIONS UPDATED FROM PDF');
console.log('='.repeat(60));

console.log('\n📦 Valance/Cassette Types (Page 12): ' + db.productContent.zebraHardwareOptions.valanceType.length + ' options');
db.productContent.zebraHardwareOptions.valanceType.forEach((v, i) => {
  console.log(`  ${i + 1}. ${v.label}`);
  console.log(`     Image: ${v.imageUrl}`);
  console.log(`     Price: $${v.price} (${v.priceType})`);
});

console.log('\n📦 Bottom Rails (Page 13): ' + db.productContent.zebraHardwareOptions.bottomRail.length + ' options');
db.productContent.zebraHardwareOptions.bottomRail.forEach((b, i) => {
  console.log(`  ${i + 1}. ${b.label}`);
  console.log(`     Image: ${b.imageUrl}`);
  console.log(`     Price: $${b.price} (${b.priceType})`);
});

console.log('\n✅ All hardware options updated with correct PDF images!');
