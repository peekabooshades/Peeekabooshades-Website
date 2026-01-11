const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');
const IMAGES_DIR = path.join(__dirname, '../frontend/public/images/fabrics/zebra');
const PDF_DATA_PATH = '/Users/surya/Desktop/FabricSwatches/extraction_20260110_005540/technical_specifications.json';

// Load PDF extracted data (the correct source of truth)
const pdfData = JSON.parse(fs.readFileSync(PDF_DATA_PATH, 'utf8'));

console.log('PDF fabrics count:', pdfData.length);

// Get unique fabric codes from PDF
const uniqueCodes = [...new Set(pdfData.map(f => f.code))];
console.log('Unique fabric codes from PDF:', uniqueCodes.length);

// Create fabric entries from PDF data
const zebraFabrics = [];
const zebraPrices = [];

// Group by code to get unique fabrics
const fabricMap = {};
pdfData.forEach(item => {
  if (!fabricMap[item.code]) {
    fabricMap[item.code] = item;
  }
});

// Default pricing (will need to be updated by user in admin)
const defaultPriceManual = 45;  // Default price per sqm
const defaultPriceCordless = 55;
const defaultMargin = 40;

Object.values(fabricMap).forEach(item => {
  const category = item.category === 'Blackout' ? 'blackout' : 'semi-blackout';
  const shadingType = item.category === 'Blackout' ? 'Blackout' : 'Semi-Blackout';

  // Determine image extension
  let imagePath = null;
  const possibleExtensions = ['.png', '.jpeg', '.jpg'];
  for (const ext of possibleExtensions) {
    const testPath = path.join(IMAGES_DIR, item.code + ext);
    if (fs.existsSync(testPath)) {
      imagePath = `/images/fabrics/zebra/${item.code}${ext}`;
      break;
    }
  }

  // Create fabric entry
  zebraFabrics.push({
    code: item.code,
    name: `Zebra ${shadingType} ${item.code}`,
    category: category,
    shadingType: shadingType,
    composition: item.composition || '100% Polyester',
    weight: item.weight || '',
    width: parseInt(item.max_width) || 300,
    thickness: item.thickness || '0.5mm',
    image: imagePath,
    hasImage: imagePath !== null,
    status: 'active'
  });

  // Create price entry
  zebraPrices.push({
    fabricCode: item.code,
    pricePerSqMeterManual: defaultPriceManual,
    pricePerSqMeterCordless: defaultPriceCordless,
    manualMargin: defaultMargin,
    minAreaSqMeter: 1.2,
    status: 'active'
  });
});

// Sort by code
zebraFabrics.sort((a, b) => a.code.localeCompare(b.code));
zebraPrices.sort((a, b) => a.fabricCode.localeCompare(b.fabricCode));

console.log('Created', zebraFabrics.length, 'fabric entries');
console.log('Created', zebraPrices.length, 'price entries');

// Load database
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Replace zebra data
db.zebraFabrics = zebraFabrics;
db.zebraManufacturerPrices = zebraPrices;

// Update manufacturerPrices - remove old zebra entries and add new ones
db.manufacturerPrices = (db.manufacturerPrices || []).filter(p => p.productType !== 'zebra');

// Add zebra to main manufacturerPrices
zebraPrices.forEach(price => {
  const fabric = zebraFabrics.find(f => f.code === price.fabricCode) || {};

  const margin = price.manualMargin || 40;
  const customerPriceManual = price.pricePerSqMeterManual * (1 + margin / 100);
  const customerPriceCordless = price.pricePerSqMeterCordless * (1 + margin / 100);

  db.manufacturerPrices.push({
    fabricCode: price.fabricCode,
    fabricName: fabric.name || `Zebra ${price.fabricCode}`,
    fabricCategory: fabric.category || 'semi-blackout',
    productType: 'zebra',
    series: price.fabricCode.substring(0, 5),
    pricePerSqMeter: price.pricePerSqMeterManual,
    pricePerSqMeterCordless: price.pricePerSqMeterCordless,
    customerPricePerSqMeter: Math.round(customerPriceManual * 100) / 100,
    customerPricePerSqMeterCordless: Math.round(customerPriceCordless * 100) / 100,
    manualMargin: margin,
    minAreaSqMeter: price.minAreaSqMeter || 1.2,
    composition: fabric.composition || '100% Polyester',
    weight: fabric.weight || '',
    thickness: fabric.thickness || '',
    width: fabric.width || 300,
    image: fabric.image || null,
    thumbnail: fabric.image || null,
    hasImage: fabric.hasImage || false,
    status: 'active',
    enabled: true,
    widthMin: 12,
    widthMax: 90,
    heightMin: 12,
    heightMax: 120,
    updatedAt: new Date().toISOString()
  });
});

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('Database saved');

// Count fabrics with images
const withImages = zebraFabrics.filter(f => f.hasImage).length;
const withoutImages = zebraFabrics.filter(f => !f.hasImage).length;
console.log('');
console.log('Fabrics with images:', withImages);
console.log('Fabrics without images:', withoutImages);

if (withoutImages > 0) {
  console.log('Missing images for:', zebraFabrics.filter(f => !f.hasImage).map(f => f.code).join(', '));
}

// List by category
const blackout = zebraFabrics.filter(f => f.category === 'blackout');
const semiBlackout = zebraFabrics.filter(f => f.category === 'semi-blackout');
console.log('');
console.log('Blackout fabrics:', blackout.length);
console.log('Semi-Blackout fabrics:', semiBlackout.length);
