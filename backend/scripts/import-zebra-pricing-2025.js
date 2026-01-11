#!/usr/bin/env node
/**
 * Import Zebra Blind Pricing from 2025 Wholesale Quotation PDF
 *
 * Columns:
 * - Item No. (Fabric Code) - each series has multiple codes
 * - Material - Technical specifications
 * - Cordless - Price per sq meter for cordless/motorized
 * - Bean Chain - Price per sq meter for manual (bead chain)
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('🔄 Importing Zebra Pricing from 2025 Wholesale Quotation PDF...\n');

// Parse the PDF data - each row has fabric codes, specs, cordless price, bead chain price
const pricingData = [
  {
    fabricCodes: ['83003L', '83003A', '83003B', '83003D', '83003I', '83003E', '83003C', '83003F', '83003K'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '115g/m²',
    repeat: '7.5*5cm',
    features: ['waterproof'],
    cordlessPrice: 17.97,
    beadChainPrice: 14.17
  },
  {
    fabricCodes: ['83052A', '83052B', '83052C', '83052D', '83052E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '255g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 19.70,
    beadChainPrice: 15.90
  },
  {
    fabricCodes: ['83048A', '83048B', '83048C', '83048D', '83048E', '83048F'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '105g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 19.70,
    beadChainPrice: 15.90
  },
  {
    fabricCodes: ['83038G', '83038H', '83038J', '83038I'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '185g/m²',
    repeat: '8.5*5.5cm',
    features: ['waterproof'],
    cordlessPrice: 19.70,
    beadChainPrice: 15.90
  },
  {
    fabricCodes: ['83011A', '83011B', '83011C', '83011F', '83037C', '83037A'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '140g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 20.74,
    beadChainPrice: 16.93
  },
  {
    fabricCodes: ['83054A', '83054B', '83054C', '83054D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '153g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 20.74,
    beadChainPrice: 16.93
  },
  {
    fabricCodes: ['83055A', '83055B', '83055C', '83055D', '83055E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '120g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 20.74,
    beadChainPrice: 16.93
  },
  {
    fabricCodes: ['83049A', '83049B', '83049C', '83049D', '83049E', '83049F'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '125g/m²',
    repeat: '7.5*4.5cm',
    features: [],
    cordlessPrice: 20.74,
    beadChainPrice: 16.93
  },
  {
    fabricCodes: ['83056A', '83056B', '83056C', '83056D', '83056E', '83056F'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '190g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 21.43,
    beadChainPrice: 17.63
  },
  {
    fabricCodes: ['83061A', '83061B', '83061C', '83061D', '83061E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '177g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 21.43,
    beadChainPrice: 17.63
  },
  {
    fabricCodes: ['83042A', '83042B', '83042C', '83042D', '83042E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '109g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 21.43,
    beadChainPrice: 17.63
  },
  {
    fabricCodes: ['83050B', '83050C', '83050D', '83050E', '83050F'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '145g/m²',
    repeat: '8.5*6cm',
    features: [],
    cordlessPrice: 21.43,
    beadChainPrice: 17.63
  },
  {
    fabricCodes: ['83013F', '83013G', '83013A', '83013B', '83013C', '83013H', '83013I'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '137g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 21.43,
    beadChainPrice: 17.63
  },
  {
    fabricCodes: ['83070A', '83070B', '83070C', '83070D', '83070E'],
    composition: '20% Linen + 80% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 21.43,
    beadChainPrice: 17.63
  },
  {
    fabricCodes: ['83032E', '83032A', '83032F', '83032B', '83032D', '83032C'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '205g/m²',
    repeat: '10*7cm',
    features: ['waterproof'],
    cordlessPrice: 22.12,
    beadChainPrice: 18.32
  },
  {
    fabricCodes: ['83045A', '83045B', '83045C', '83045D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '116g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 22.12,
    beadChainPrice: 18.32
  },
  {
    fabricCodes: ['83071A', '83071B', '83071C', '83071D', '83071E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '204g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 22.12,
    beadChainPrice: 18.32
  },
  {
    fabricCodes: ['83012F', '83012G', '83012A', '83012B', '83012C'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '172g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 22.12,
    beadChainPrice: 18.32
  },
  {
    fabricCodes: ['83009A', '83009B', '83009K', '83009J', '83009L', '83009M'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '195g/m²',
    repeat: '9.5*5.5cm',
    features: [],
    cordlessPrice: 22.46,
    beadChainPrice: 18.66
  },
  {
    fabricCodes: ['83062A', '83062B', '83062C', '83062D', '83062E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '246g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 23.15,
    beadChainPrice: 19.35
  },
  {
    fabricCodes: ['83053A', '83053B', '83053C', '83053D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '265g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 23.15,
    beadChainPrice: 19.35
  },
  {
    fabricCodes: ['83039F', '83039G', '83039A', '83039B', '83039E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '157.5g/m²',
    repeat: '10*6cm',
    features: [],
    cordlessPrice: 23.15,
    beadChainPrice: 19.35
  },
  {
    fabricCodes: ['83067A', '83067B', '83067C', '83067D', '83067E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '176g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 23.15,
    beadChainPrice: 19.35
  },
  {
    fabricCodes: ['83068A', '83068B', '83068C', '83068D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '176g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 23.15,
    beadChainPrice: 19.35
  },
  {
    fabricCodes: ['83070F'],
    composition: '20% Linen + 80% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 23.50,
    beadChainPrice: 19.70
  },
  {
    fabricCodes: ['83047A', '83047B', '83047C', '83047D', '83047E', '83047F', '83047G'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '170g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 23.85,
    beadChainPrice: 20.04
  },
  {
    fabricCodes: ['83040A', '83040B', '83040C', '83040D', '83040E', '83040F', '83040G'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '170g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 23.85,
    beadChainPrice: 20.04
  },
  {
    fabricCodes: ['83066A', '83066B', '83066C', '83066D', '83066E', '83066F'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '265g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 23.85,
    beadChainPrice: 20.04
  },
  {
    fabricCodes: ['83051A', '83051B', '83051C', '83051D', '83051E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '250g/m²',
    repeat: '7.5*5cm',
    features: ['waterResistant', 'fireResistant', 'mildewProof', 'formaldehydeFree'],
    cordlessPrice: 24.54,
    beadChainPrice: 20.74
  },
  {
    fabricCodes: ['83014F', '83014G', '83014H', '83014I'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '224g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 24.54,
    beadChainPrice: 20.74
  },
  {
    fabricCodes: ['83043A', '83043B', '83043C', '83043D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '116g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 24.54,
    beadChainPrice: 20.74
  },
  {
    fabricCodes: ['83065A', '83065B', '83065C', '83065D', '83065E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '175g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 25.23,
    beadChainPrice: 21.43
  },
  {
    fabricCodes: ['83058A', '83058B', '83058C', '83058D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '160g/m²',
    repeat: '10*7cm',
    features: [],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83019F', '83019G', '83019H', '83019I'],
    composition: '35% Polyester + 65% PVC',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '265g/m²',
    repeat: '7.5*5cm',
    features: ['waterResistant', 'fireResistant'],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83020F', '83020G', '83020H', '83020I', '83020E'],
    composition: '35% Polyester + 65% PVC',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '267g/m²',
    repeat: '7.5*5cm',
    features: ['waterResistant', 'fireResistant'],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83044A', '83044B', '83044C', '83044D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '190g/m²',
    repeat: '7.5*5cm',
    features: [],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83068F'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '176g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 25.23,
    beadChainPrice: 21.43
  },
  {
    fabricCodes: ['83059A', '83059B', '83059C', '83059D', '83059E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '263g/m²',
    repeat: '10*6cm',
    features: [],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83060A', '83060B', '83060C', '83060D', '83060E', '83060F'],
    composition: '35% Polyester + 65% PVC',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '265g/m²',
    repeat: '10*6cm',
    features: [],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83046A', '83046B', '83046C', '83046D', '83046E'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'super-blackout',
    weight: '291g/m²',
    repeat: '10*6cm',
    features: [],
    cordlessPrice: 25.57,
    beadChainPrice: 21.77
  },
  {
    fabricCodes: ['83064A', '83064B', '83064C', '83064D'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'blackout',
    weight: '173g/m²',
    repeat: '9*6cm',
    features: [],
    cordlessPrice: 27.99,
    beadChainPrice: 24.19
  },
  {
    fabricCodes: ['83015F', '83015G', '83015H', '83015I'],
    composition: '100% Polyester',
    width: 300,
    shadingEffect: 'semi-blackout',
    weight: '206g/m²',
    repeat: '9*6cm',
    features: ['antiBacteria'],
    cordlessPrice: 27.99,
    beadChainPrice: 24.19
  }
];

// Build zebraManufacturerPrices - one row per fabric code
const zebraManufacturerPrices = [];
const zebraFabrics = [];
const now = new Date().toISOString();

let totalFabrics = 0;

pricingData.forEach((row, rowIndex) => {
  row.fabricCodes.forEach(fabricCode => {
    totalFabrics++;

    // Map shading effect to category
    let category = row.shadingEffect;
    if (category === 'semi-blackout') category = 'semi-blackout';
    else if (category === 'blackout') category = 'blackout';
    else if (category === 'super-blackout') category = 'super-blackout';

    // Get series from fabric code (e.g., 83003A -> 83003)
    const series = fabricCode.replace(/[A-Z]+$/, '');

    // Create manufacturer price entry
    zebraManufacturerPrices.push({
      fabricCode: fabricCode,
      series: series,
      category: category,
      shadingType: row.shadingEffect.charAt(0).toUpperCase() + row.shadingEffect.slice(1).replace('-', ' '),
      pricePerSqMeterManual: row.beadChainPrice,
      pricePerSqMeter: row.beadChainPrice,
      pricePerSqMeterCordless: row.cordlessPrice,
      manualMargin: 40,
      minAreaSqMeter: 1.5,
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

    // Create/update fabric entry
    zebraFabrics.push({
      code: fabricCode,
      name: `Zebra ${row.shadingEffect.charAt(0).toUpperCase() + row.shadingEffect.slice(1).replace('-', ' ')} ${fabricCode}`,
      category: category,
      shadingType: row.shadingEffect.charAt(0).toUpperCase() + row.shadingEffect.slice(1).replace('-', ' '),
      composition: row.composition,
      weight: row.weight,
      width: row.width,
      thickness: '',
      repeat: row.repeat,
      waterResistant: row.features.includes('waterResistant') || row.features.includes('waterproof'),
      fireResistant: row.features.includes('fireResistant'),
      mildewProof: row.features.includes('mildewProof'),
      formaldehydeFree: row.features.includes('formaldehydeFree'),
      antiBacteria: row.features.includes('antiBacteria'),
      image: `/images/fabrics/zebra/${fabricCode}.png`,
      hasImage: false,
      enabled: true,
      status: 'active',
      createdAt: now,
      updatedAt: now
    });
  });
});

// Update database
db.zebraManufacturerPrices = zebraManufacturerPrices;
db.zebraFabrics = zebraFabrics;

// Save database
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

console.log('✅ Import Complete!\n');
console.log('='.repeat(60));
console.log(`📊 Total fabric codes imported: ${totalFabrics}`);
console.log(`📊 Pricing entries created: ${zebraManufacturerPrices.length}`);
console.log(`📊 Fabric entries created: ${zebraFabrics.length}`);
console.log('='.repeat(60));

// Summary by category
const categoryCounts = {};
zebraFabrics.forEach(f => {
  categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
});
console.log('\n📁 By Category:');
Object.entries(categoryCounts).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count} fabrics`);
});

// Price range summary
const prices = zebraManufacturerPrices.map(p => p.pricePerSqMeterManual);
console.log('\n💰 Price Range (Bead Chain/Manual):');
console.log(`   Min: $${Math.min(...prices).toFixed(2)}/m²`);
console.log(`   Max: $${Math.max(...prices).toFixed(2)}/m²`);

const cordlessPrices = zebraManufacturerPrices.map(p => p.pricePerSqMeterCordless);
console.log('\n💰 Price Range (Cordless):');
console.log(`   Min: $${Math.min(...cordlessPrices).toFixed(2)}/m²`);
console.log(`   Max: $${Math.max(...cordlessPrices).toFixed(2)}/m²`);

console.log('\n✅ Database updated successfully!');
console.log('   - zebraManufacturerPrices: Manufacturer costs per fabric');
console.log('   - zebraFabrics: Fabric details with technical specs');
