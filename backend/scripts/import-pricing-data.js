/**
 * Import Pricing Data from customer-config tool
 *
 * This script imports the fabric pricing data into the manufacturerPrices collection
 * using the pricing formula:
 * - Price per m² (square meter)
 * - Convert inches to meters: inches × 0.0254
 * - Minimum area: 1.2 m² for roller, 1.5 m² for zebra
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

// Fabric pricing data from customer-config pricingData.ts
const ROLLER_BLINDS_PRICING = [
  // 82086K/W/B/C/E - semi-blackout
  { codes: ['82086K', '82086W', '82086B', '82086C', '82086E'], bean: 12.99, cordless: 16.24, shading: 'semi-blackout' },
  // 82067E/F - Transparent
  { codes: ['82067E', '82067F'], bean: 13.34, cordless: 16.59, shading: 'transparent' },
  // 82159A/C/D/E - semi-blackout
  { codes: ['82159A', '82159C', '82159D', '82159E'], bean: 13.27, cordless: 16.59, shading: 'semi-blackout' },
  // 82006S/H/F - Transparent 5%
  { codes: ['82006S', '82006H', '82006F'], bean: 13.34, cordless: 16.59, shading: 'transparent' },
  // 82010G/V/J/T/E/L/Y/I/M - Blackout
  { codes: ['82010G', '82010V', '82010J', '82010T', '82010E', '82010L', '82010Y', '82010I', '82010M'], bean: 14.03, cordless: 17.28, shading: 'blackout' },
  // 82067M/N/G/H/I/U - semi-blackout
  { codes: ['82067M', '82067N', '82067G', '82067H', '82067I', '82067U'], bean: 14.03, cordless: 17.28, shading: 'semi-blackout' },
  // 82082A/B/K/D/I/C - semi-blackout
  { codes: ['82082A', '82082B', '82082K', '82082D', '82082I', '82082C'], bean: 14.38, cordless: 17.63, shading: 'semi-blackout' },
  // 82086F/G/H/J - Blackout
  { codes: ['82086F', '82086G', '82086H', '82086J'], bean: 14.45, cordless: 17.69, shading: 'blackout' },
  // 82072C/D/I - semi-blackout
  { codes: ['82072C', '82072D', '82072I'], bean: 14.51, cordless: 17.76, shading: 'semi-blackout' },
  // 82027F/G/A/B/C/E/H - semi-blackout
  { codes: ['82027F', '82027G', '82027A', '82027B', '82027C', '82027E', '82027H'], bean: 14.72, cordless: 17.97, shading: 'semi-blackout' },
  // 82076A/B/C/D - semi-blackout
  { codes: ['82076A', '82076B', '82076C', '82076D'], bean: 14.72, cordless: 17.97, shading: 'semi-blackout' },
  // 82146A/B/C/D/E - semi-blackout
  { codes: ['82146A', '82146B', '82146C', '82146D', '82146E'], bean: 14.72, cordless: 17.97, shading: 'semi-blackout' },
  // 82006A/B/C/O/Q/R/M/L/N - Transparent 5%
  { codes: ['82006A', '82006B', '82006C', '82006O', '82006Q', '82006R', '82006M', '82006L', '82006N'], bean: 14.93, cordless: 18.18, shading: 'transparent' },
  // 82141A/B/C/D - semi-blackout
  { codes: ['82141A', '82141B', '82141C', '82141D'], bean: 15.41, cordless: 18.66, shading: 'semi-blackout' },
  // 82156A/B/C/D/E/F - semi-blackout
  { codes: ['82156A', '82156B', '82156C', '82156D', '82156E', '82156F'], bean: 15.41, cordless: 18.66, shading: 'semi-blackout' },
  // 82167A/B/C/D/E - semi-blackout
  { codes: ['82167A', '82167B', '82167C', '82167D', '82167E'], bean: 15.41, cordless: 18.66, shading: 'semi-blackout' },
  // 82072F/G/H - Transparent
  { codes: ['82072F', '82072G', '82072H'], bean: 15.41, cordless: 18.66, shading: 'transparent' },
  // 82067K/L/A/B/O/P/C/V - Blackout
  { codes: ['82067K', '82067L', '82067A', '82067B', '82067O', '82067P', '82067C', '82067V'], bean: 15.76, cordless: 19.01, shading: 'blackout' },
  // 82161A/B/C - semi-blackout
  { codes: ['82161A', '82161B', '82161C'], bean: 15.76, cordless: 19.01, shading: 'semi-blackout' },
  // 82144A/B/C/D - semi-blackout
  { codes: ['82144A', '82144B', '82144C', '82144D'], bean: 16.10, cordless: 19.35, shading: 'semi-blackout' },
  // 82026A/B/C/E/F - Blackout
  { codes: ['82026A', '82026B', '82026C', '82026E', '82026F'], bean: 16.10, cordless: 19.35, shading: 'blackout' },
  // 82137A/D/E/C/F/G/B - Blackout
  { codes: ['82137A', '82137D', '82137E', '82137C', '82137F', '82137G', '82137B'], bean: 16.45, cordless: 19.70, shading: 'blackout' },
  // 82147A/B/C/D - semi-blackout
  { codes: ['82147A', '82147B', '82147C', '82147D'], bean: 16.45, cordless: 19.70, shading: 'semi-blackout' },
  // 82066A/B/C/D/E/F/G - Blackout
  { codes: ['82066A', '82066B', '82066C', '82066D', '82066E', '82066F', '82066G'], bean: 17.14, cordless: 20.39, shading: 'blackout' },
  // 82133A/B/C/D/E - Super Blackout (from 2025 wholesale quotation PDF)
  { codes: ['82133A', '82133B', '82133C', '82133D', '82133E'], bean: 17.14, cordless: 20.39, shading: 'super-blackout' },
  // 82077A/B/C/D - Blackout
  { codes: ['82077A', '82077B', '82077C', '82077D'], bean: 17.14, cordless: 20.39, shading: 'blackout' },
  // 82028F/G/H/A/B/C/E - Blackout
  { codes: ['82028F', '82028G', '82028H', '82028A', '82028B', '82028C', '82028E'], bean: 17.14, cordless: 20.39, shading: 'blackout' },
  // 82024A/B/C/E - semi-blackout
  { codes: ['82024A', '82024B', '82024C', '82024E'], bean: 17.14, cordless: 20.39, shading: 'semi-blackout' },
  // 82032A/B/D/E/F/G/H/I - Blackout
  { codes: ['82032A', '82032B', '82032D', '82032E', '82032F', '82032G', '82032H', '82032I'], bean: 19.91, cordless: 23.15, shading: 'blackout' },
  // 82143A/B/C - Blackout
  { codes: ['82143A', '82143B', '82143C'], bean: 19.91, cordless: 23.15, shading: 'blackout' },
  // 82132D/E/F/G - semi-blackout
  { codes: ['82132D', '82132E', '82132F', '82132G'], bean: 20.94, cordless: 24.19, shading: 'semi-blackout' },
  // 82170A/B/C - Blackout
  { codes: ['82170A', '82170B', '82170C'], bean: 21.28, cordless: 24.53, shading: 'blackout' },
];

const ZEBRA_BLINDS_PRICING = [
  // 83003L/M/H/N/O/P/C/E/F/G - semi-blackout
  { codes: ['83003L', '83003M', '83003H', '83003N', '83003O', '83003P', '83003C', '83003E', '83003F', '83003G'], bean: 14.17, cordless: 17.97, shading: 'semi-blackout' },
  // 83030A/B/D/E/F/G - semi-blackout
  { codes: ['83030A', '83030B', '83030D', '83030E', '83030F', '83030G'], bean: 14.65, cordless: 18.45, shading: 'semi-blackout' },
  // 83052A/B/C/D/E/F/G - semi-blackout
  { codes: ['83052A', '83052B', '83052C', '83052D', '83052E', '83052F', '83052G'], bean: 15.90, cordless: 19.70, shading: 'semi-blackout' },
  // 83051A/B/C/D/E/F/G/H/I/J - semi-blackout
  { codes: ['83051A', '83051B', '83051C', '83051D', '83051E', '83051F', '83051G', '83051H', '83051I', '83051J'], bean: 16.24, cordless: 20.04, shading: 'semi-blackout' },
  // 83046A/B/C/D/E/F/G/H - semi-blackout
  { codes: ['83046A', '83046B', '83046C', '83046D', '83046E', '83046F', '83046G', '83046H'], bean: 16.59, cordless: 20.39, shading: 'semi-blackout' },
  // 83059A/B/C/D/E/F/G - semi-blackout
  { codes: ['83059A', '83059B', '83059C', '83059D', '83059E', '83059F', '83059G'], bean: 17.28, cordless: 21.08, shading: 'semi-blackout' },
  // 83013A/B/C/D/E/F/G - Blackout
  { codes: ['83013A', '83013B', '83013C', '83013D', '83013E', '83013F', '83013G'], bean: 18.66, cordless: 22.46, shading: 'blackout' },
  // 83064A/B/C/D/E - Blackout
  { codes: ['83064A', '83064B', '83064C', '83064D', '83064E'], bean: 24.19, cordless: 27.99, shading: 'blackout' },
];

function loadDatabase() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading database:', error);
    return null;
  }
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

function importPricingData() {
  console.log('Starting pricing data import...\n');

  const db = loadDatabase();
  if (!db) {
    console.error('Failed to load database');
    return;
  }

  // Initialize collections if needed
  if (!db.manufacturerPrices) db.manufacturerPrices = [];

  let imported = 0;
  let updated = 0;

  // Import Roller Blinds
  console.log('Importing Roller Blinds pricing...');
  for (const group of ROLLER_BLINDS_PRICING) {
    for (const code of group.codes) {
      const existing = db.manufacturerPrices.find(p =>
        p.fabricCode === code && p.productType === 'roller'
      );

      const priceRecord = {
        id: existing?.id || `mp-${uuidv4().slice(0, 8)}`,
        manufacturerId: 'mfr-default',
        productType: 'roller',
        fabricCode: code,
        fabricName: `Roller ${group.shading} ${code}`,
        fabricCategory: group.shading,
        // Pricing per square meter
        pricePerSqMeter: group.bean,  // Manual/bean chain price
        pricePerSqMeterCordless: group.cordless,  // Cordless price
        // Also store as base price for compatibility
        basePrice: group.bean,
        // Minimum area in m² (1.2 for roller)
        minAreaSqMeter: 1.2,
        // Dimension limits in inches
        widthMin: 12,
        widthMax: 144,
        heightMin: 12,
        heightMax: 120,
        importSource: 'customer-config',
        importFile: 'pricingData.ts',
        importDate: new Date().toISOString(),
        effectiveDate: '2025-01-01',
        status: 'active',
        notes: `${group.shading} fabric - Bean chain: $${group.bean}/m², Cordless: $${group.cordless}/m²`,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'import-script'
      };

      if (existing) {
        const idx = db.manufacturerPrices.findIndex(p => p.id === existing.id);
        db.manufacturerPrices[idx] = priceRecord;
        updated++;
      } else {
        db.manufacturerPrices.push(priceRecord);
        imported++;
      }
    }
  }

  // Import Zebra Blinds
  console.log('Importing Zebra Blinds pricing...');
  for (const group of ZEBRA_BLINDS_PRICING) {
    for (const code of group.codes) {
      const existing = db.manufacturerPrices.find(p =>
        p.fabricCode === code && p.productType === 'zebra'
      );

      const priceRecord = {
        id: existing?.id || `mp-${uuidv4().slice(0, 8)}`,
        manufacturerId: 'mfr-default',
        productType: 'zebra',
        fabricCode: code,
        fabricName: `Zebra ${group.shading} ${code}`,
        fabricCategory: group.shading,
        // Pricing per square meter
        pricePerSqMeter: group.bean,
        pricePerSqMeterCordless: group.cordless,
        basePrice: group.bean,
        // Minimum area in m² (1.5 for zebra)
        minAreaSqMeter: 1.5,
        widthMin: 12,
        widthMax: 120,
        heightMin: 12,
        heightMax: 96,
        importSource: 'customer-config',
        importFile: 'pricingData.ts',
        importDate: new Date().toISOString(),
        effectiveDate: '2025-01-01',
        status: 'active',
        notes: `${group.shading} fabric - Bean chain: $${group.bean}/m², Cordless: $${group.cordless}/m²`,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'import-script'
      };

      if (existing) {
        const idx = db.manufacturerPrices.findIndex(p => p.id === existing.id);
        db.manufacturerPrices[idx] = priceRecord;
        updated++;
      } else {
        db.manufacturerPrices.push(priceRecord);
        imported++;
      }
    }
  }

  // Save database
  if (saveDatabase(db)) {
    console.log(`\n✅ Import complete!`);
    console.log(`   - New records: ${imported}`);
    console.log(`   - Updated records: ${updated}`);
    console.log(`   - Total fabric prices: ${db.manufacturerPrices.length}`);
  } else {
    console.error('\n❌ Failed to save database');
  }
}

// Run import
importPricingData();
