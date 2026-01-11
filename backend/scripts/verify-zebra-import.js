#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('=== ZEBRA PRICING IMPORT SUMMARY ===\n');
console.log('Total Fabric Codes:', (db.zebraManufacturerPrices || []).length);
console.log('');

const prices = db.zebraManufacturerPrices || [];
const byCategory = {};

prices.forEach(p => {
  if (!byCategory[p.category]) {
    byCategory[p.category] = { count: 0, manualMin: Infinity, manualMax: 0, cordlessMin: Infinity, cordlessMax: 0 };
  }
  byCategory[p.category].count++;
  byCategory[p.category].manualMin = Math.min(byCategory[p.category].manualMin, p.pricePerSqMeterManual);
  byCategory[p.category].manualMax = Math.max(byCategory[p.category].manualMax, p.pricePerSqMeterManual);
  byCategory[p.category].cordlessMin = Math.min(byCategory[p.category].cordlessMin, p.pricePerSqMeterCordless);
  byCategory[p.category].cordlessMax = Math.max(byCategory[p.category].cordlessMax, p.pricePerSqMeterCordless);
});

console.log('Category Breakdown:');
Object.entries(byCategory).forEach(([cat, data]) => {
  console.log('  ' + cat + ': ' + data.count + ' fabrics');
  console.log('    Bead Chain: $' + data.manualMin.toFixed(2) + ' - $' + data.manualMax.toFixed(2) + '/m²');
  console.log('    Cordless:   $' + data.cordlessMin.toFixed(2) + ' - $' + data.cordlessMax.toFixed(2) + '/m²');
});

console.log('\nTechnical Specs Stored:');
console.log('  - composition (e.g., 100% Polyester)');
console.log('  - weight (e.g., 115g/m²)');
console.log('  - width (300cm)');
console.log('  - repeat pattern (e.g., 7.5*5cm)');
console.log('  - waterResistant, fireResistant, mildewProof, antiBacteria');

console.log('\nSample Entry:');
const sample = db.zebraManufacturerPrices[0];
const sampleFabric = db.zebraFabrics.find(f => f.code === sample.fabricCode);
console.log('  Fabric Code:', sample.fabricCode);
console.log('  Series:', sample.series);
console.log('  Bead Chain Price:', '$' + sample.pricePerSqMeterManual + '/m²');
console.log('  Cordless Price:', '$' + sample.pricePerSqMeterCordless + '/m²');
console.log('  Composition:', sampleFabric.composition);
console.log('  Weight:', sampleFabric.weight);
console.log('  Features:', sampleFabric.waterResistant ? 'Waterproof' : 'Standard');

console.log('\n✅ Data ready for admin product-pricing.html');
