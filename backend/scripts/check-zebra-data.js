#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Check for any duplicate fabric codes
const zebraPrices = db.zebraManufacturerPrices || [];
const codes = zebraPrices.map(p => p.fabricCode);
const uniqueCodes = [...new Set(codes)];
console.log('Total zebraManufacturerPrices entries:', codes.length);
console.log('Unique codes:', uniqueCodes.length);

if (codes.length !== uniqueCodes.length) {
  console.log('\nDuplicate codes found!');
  const duplicates = codes.filter((code, i) => codes.indexOf(code) !== i);
  console.log('Duplicates:', [...new Set(duplicates)].slice(0, 10));
}

// Check if zebraFabrics and zebraManufacturerPrices have matching codes
const fabricCodes = (db.zebraFabrics || []).map(f => f.code);
const priceCodes = zebraPrices.map(p => p.fabricCode);

const missingInFabrics = priceCodes.filter(c => !fabricCodes.includes(c));
const missingInPrices = fabricCodes.filter(c => !priceCodes.includes(c));

console.log('\nCode matching:');
console.log('Prices with no matching fabric:', missingInFabrics.length);
console.log('Fabrics with no matching price:', missingInPrices.length);

// Show first few price entries for verification
console.log('\nFirst 5 zebra prices (fabricCode, manual, cordless):');
zebraPrices.slice(0, 5).forEach(p => {
  console.log(`  ${p.fabricCode}: $${p.pricePerSqMeterManual}/m² (manual), $${p.pricePerSqMeterCordless}/m² (cordless)`);
});

// Show price range
const manualPrices = zebraPrices.map(p => p.pricePerSqMeterManual).filter(p => p);
const cordlessPrices = zebraPrices.map(p => p.pricePerSqMeterCordless).filter(p => p);
console.log('\nPrice ranges:');
console.log(`  Manual: $${Math.min(...manualPrices).toFixed(2)} - $${Math.max(...manualPrices).toFixed(2)}`);
console.log(`  Cordless: $${Math.min(...cordlessPrices).toFixed(2)} - $${Math.max(...cordlessPrices).toFixed(2)}`);
