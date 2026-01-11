const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Get zebra data
const zebraFabrics = db.zebraFabrics || [];
const zebraPrices = db.zebraManufacturerPrices || [];

// Initialize main arrays if needed
if (!db.manufacturerPrices) db.manufacturerPrices = [];

// Remove old zebra entries from manufacturerPrices
db.manufacturerPrices = db.manufacturerPrices.filter(p => p.productType !== 'zebra');

// Add zebra fabrics to main manufacturerPrices
zebraPrices.forEach(price => {
  const fabric = zebraFabrics.find(f => f.code === price.fabricCode) || {};

  // Calculate customer price with margin
  const margin = price.manualMargin || 40;
  const customerPriceManual = price.pricePerSqMeterManual * (1 + margin / 100);
  const customerPriceCordless = price.pricePerSqMeterCordless * (1 + margin / 100);

  const entry = {
    fabricCode: price.fabricCode,
    fabricName: `Zebra ${fabric.shadingType || 'Semi-Blackout'} ${price.fabricCode}`,
    fabricCategory: fabric.category || 'semi-blackout',
    productType: 'zebra',
    series: price.fabricCode.substring(0, 5),

    // Manufacturer cost
    pricePerSqMeter: price.pricePerSqMeterManual,
    pricePerSqMeterCordless: price.pricePerSqMeterCordless,

    // Customer price (with margin)
    customerPricePerSqMeter: Math.round(customerPriceManual * 100) / 100,
    customerPricePerSqMeterCordless: Math.round(customerPriceCordless * 100) / 100,

    // Margin
    manualMargin: margin,

    // Min area
    minAreaSqMeter: price.minAreaSqMeter || 1.2,

    // Fabric specs
    composition: fabric.composition || '100% Polyester',
    weight: fabric.weight || '',
    repeat: fabric.repeat || '',
    thickness: fabric.thickness || '',
    width: fabric.width || 300,

    // Features
    waterResistant: fabric.waterResistant || false,
    fireResistant: fabric.fireResistant || false,

    // Images
    image: fabric.image || null,
    thumbnail: fabric.image || null,
    hasImage: fabric.hasImage || false,

    // Status
    status: 'active',
    enabled: true,

    // Limits
    widthMin: 12,
    widthMax: 90,
    heightMin: 12,
    heightMax: 120,

    updatedAt: new Date().toISOString()
  };

  db.manufacturerPrices.push(entry);
});

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('Added', zebraPrices.length, 'zebra fabrics to main manufacturerPrices');
console.log('Total manufacturerPrices:', db.manufacturerPrices.length);

// Count by type
const byType = {};
db.manufacturerPrices.forEach(p => {
  byType[p.productType] = (byType[p.productType] || 0) + 1;
});
console.log('By product type:', byType);
