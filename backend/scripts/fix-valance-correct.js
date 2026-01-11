#!/usr/bin/env node
/**
 * Fix Valance Types with CORRECT mapping from PDF Page 12
 * Based on visual layout: 3 rows, 8 images with labels below each
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('🔧 Updating Valance Types with CORRECT PDF mapping...\n');

// Row 1: Square V2, Fabric wrapped V3, Fabric wrapped SA
// Row 2: Fabric inserted S1, Curve white S2, Fabric wrapped S3
// Row 3: Z3, Fabric wrapped Z3

// Matching extracted images to PDF layout:
// img1 = Square V2 (square white cassette)
// img4 = Fabric wrapped V3 (rounded end cap with fabric)
// img3 = Fabric wrapped SA (round end with screws)
// img9 = Fabric inserted S1 (curved with fabric insert)
// img5 = Curve white S2 (smooth curved white)
// img6 = Fabric wrapped S3 (fabric rounded)
// img7 = Z3 (full blind with square valance)
// img8 = Fabric wrapped Z3 (chevron pattern)

db.productContent.zebraHardwareOptions.valanceType = [
  {
    id: 'v2-square',
    value: 'V2',
    label: 'Square V2',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page12_valance_img1_1459x1613.jpeg',
    description: 'Square cassette design',
    isDefault: true,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'v3-fabric-wrapped',
    value: 'V3',
    label: 'Fabric wrapped V3',
    price: 3.15,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img4_1159x983.jpeg',
    description: 'Fabric wrapped V3 cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'sa-fabric-wrapped',
    value: 'SA',
    label: 'Fabric wrapped SA',
    price: 3.15,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img3_1142x1089.jpeg',
    description: 'Fabric wrapped SA cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 's1-fabric-inserted',
    value: 'S1',
    label: 'Fabric inserted S1',
    price: 3.19,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img9_1337x1532.jpeg',
    description: 'Fabric inserted S1 cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 4
  },
  {
    id: 's2-curve-white',
    value: 'S2',
    label: 'Curve white S2',
    price: 3.12,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img5_1468x1595.png',
    description: 'Curved white S2 cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 5
  },
  {
    id: 's3-fabric-wrapped',
    value: 'S3',
    label: 'Fabric wrapped S3',
    price: 3.12,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img6_1510x1631.png',
    description: 'Fabric wrapped S3 cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 6
  },
  {
    id: 'z3-standard',
    value: 'Z3',
    label: 'Z3',
    price: 0,
    priceType: 'flat',
    imageUrl: '/images/hardware/zebra/page12_valance_img7_883x1049.jpeg',
    description: 'Z3 standard cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 7
  },
  {
    id: 'z3-fabric-wrapped',
    value: 'Z3-FW',
    label: 'Fabric wrapped Z3',
    price: 3.50,
    priceType: 'sqm',
    imageUrl: '/images/hardware/zebra/page12_valance_img8_915x1006.jpeg',
    description: 'Fabric wrapped Z3 cassette',
    isDefault: false,
    isActive: true,
    sortOrder: 8
  }
];

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('Valance Types: ' + db.productContent.zebraHardwareOptions.valanceType.length + ' options');
db.productContent.zebraHardwareOptions.valanceType.forEach((v, i) => {
  console.log(`  ${i + 1}. ${v.label} → ${v.imageUrl.split('/').pop()}`);
});

console.log('\n✅ Valance types updated!');
