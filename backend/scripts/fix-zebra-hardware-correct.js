#!/usr/bin/env node
/**
 * Fix Zebra Hardware Options with CORRECT image-to-label mapping
 * Based on PDF Page 12 text labels
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔧 Updating Zebra Hardware Options with CORRECT mapping...\n');

// Initialize if needed
if (!db.productContent) db.productContent = {};
if (!db.productContent.zebraHardwareOptions) db.productContent.zebraHardwareOptions = {};

// Correct mapping based on PDF Page 12 labels and image visual analysis:
// img1/img2 (1459x1613): Square cassette = V2 Square
// img3 (1142x1089): Open roller with round end cap = SA Fabric Wrapped (has fabric visible)
// img4 (1159x983): Similar round end cap style = S3 Fabric Wrapped
// img5 (1468x1595): Smooth curved white cassette = S2 Curve White
// img6 (1510x1631): Fabric wrapped rounded cassette = S1 Fabric Inserted
// img7 (883x1049): Full zebra with square white valance = Z3 Standard
// img8 (915x1006): Fabric insert with chevron pattern = Z3 Fabric Wrapped
// img9 (1337x1532): Fabric wrapped rounded cassette = V3 Fabric Wrapped
// img10 (1091x1117): Square cassette (duplicate of V2)

db.productContent.zebraHardwareOptions.valanceType = [
  {
    id: 'v2-square',
    value: 'V2',
    label: 'V2 Square',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page12_valance_img1_1459x1613.jpeg',
    description: 'Classic square cassette design',
    isDefault: true,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'sa-fabric-wrapped',
    value: 'SA',
    label: 'SA Fabric Wrapped',
    price: 3.15,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img3_1142x1089.jpeg',
    description: 'Fabric wrapped cassette style SA',
    isDefault: false,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 's3-fabric-wrapped',
    value: 'S3',
    label: 'S3 Fabric Wrapped',
    price: 3.15,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img4_1159x983.jpeg',
    description: 'Fabric wrapped cassette style S3',
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
    imageUrl: '/images/hardware/zebra/page12_valance_img5_1468x1595.png',
    description: 'Curved white cassette design',
    isDefault: false,
    isActive: true,
    sortOrder: 4
  },
  {
    id: 's1-fabric-inserted',
    value: 'S1',
    label: 'S1 Fabric Inserted',
    price: 3.19,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img6_1510x1631.png',
    description: 'Cassette with fabric insert panel',
    isDefault: false,
    isActive: true,
    sortOrder: 5
  },
  {
    id: 'z3-standard',
    value: 'Z3',
    label: 'Z3 Standard',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page12_valance_img7_883x1049.jpeg',
    description: 'Z3 standard cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 6
  },
  {
    id: 'z3-fabric-wrapped',
    value: 'Z3-FW',
    label: 'Z3 Fabric Wrapped',
    price: 3.50,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img8_915x1006.jpeg',
    description: 'Z3 fabric wrapped cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 7
  },
  {
    id: 'v3-fabric-wrapped',
    value: 'V3',
    label: 'V3 Fabric Wrapped',
    price: 3.75,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img9_1337x1532.jpeg',
    description: 'V3 fabric wrapped cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 8
  }
];

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('='.repeat(60));
console.log('ZEBRA VALANCE TYPES UPDATED WITH CORRECT LABELS');
console.log('='.repeat(60));

console.log('\n📦 Valance/Cassette Types: ' + db.productContent.zebraHardwareOptions.valanceType.length + ' options');
db.productContent.zebraHardwareOptions.valanceType.forEach((v, i) => {
  console.log(`  ${i + 1}. ${v.label}`);
  console.log(`     Image: ${v.imageUrl}`);
  console.log(`     Price: $${v.price} (${v.priceType})`);
});

console.log('\n✅ Valance types updated with correct PDF labels!');
