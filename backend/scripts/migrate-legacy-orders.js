/**
 * BUG-015 Migration Script
 * Backfills price_snapshot structure for legacy orders
 *
 * Usage: node scripts/migrate-legacy-orders.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.json');
const DRY_RUN = process.argv.includes('--dry-run');

function loadDatabase() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Get hardware option price from database
 */
function getOptionPrice(db, category, value) {
  const options = db.productContent?.hardwareOptions?.[category] || [];
  const option = options.find(o =>
    o.value === value || o.id === value || o.label === value
  );
  return option ? {
    price: option.price || 0,
    manufacturerCost: option.manufacturerCost || 0,
    priceType: option.priceType || 'flat',
    name: option.label || option.name || value
  } : null;
}

/**
 * Get motor brand price from database
 */
function getMotorPrice(db, brandId) {
  const brands = db.motorBrands || [];
  const brand = brands.find(b =>
    b.id === brandId ||
    b.id === `motor-${brandId}` ||
    b.value === brandId ||
    b.id?.includes(brandId)
  );
  return brand ? {
    price: brand.price || 0,
    manufacturerCost: brand.manufacturerCost || 0,
    name: brand.label || brand.name || brandId
  } : null;
}

/**
 * Build options breakdown from configuration
 */
function buildOptionsBreakdown(db, config, areaSqMeters) {
  const breakdown = [];

  // Motor/Motorization
  if (config.controlType === 'motorized' && config.motorBrand) {
    const motor = getMotorPrice(db, config.motorBrand);
    if (motor) {
      breakdown.push({
        type: 'motorization',
        code: config.motorBrand,
        name: motor.name,
        price: motor.price,
        manufacturerCost: motor.manufacturerCost,
        estimated: true
      });
    }
  }

  // Remote
  if (config.remoteType) {
    const remote = getOptionPrice(db, 'remoteType', config.remoteType);
    if (remote) {
      breakdown.push({
        type: 'remote',
        code: config.remoteType,
        name: remote.name,
        price: remote.price,
        manufacturerCost: remote.manufacturerCost,
        estimated: true
      });
    }
  }

  // Solar
  if (config.solarType === 'yes') {
    const solar = getOptionPrice(db, 'solarPanel', 'yes');
    if (solar) {
      breakdown.push({
        type: 'solar',
        code: 'solar-panel',
        name: solar.name,
        price: solar.price,
        manufacturerCost: solar.manufacturerCost,
        estimated: true
      });
    }
  }

  // Valance/Cassette
  const valanceValue = config.valanceType || config.standardCassette;
  if (valanceValue && valanceValue !== 'none') {
    const valance = getOptionPrice(db, 'valanceType', valanceValue);
    if (valance && valance.price > 0) {
      const price = valance.priceType === 'sqm' ? valance.price * areaSqMeters : valance.price;
      const mfrCost = valance.priceType === 'sqm' ? valance.manufacturerCost * areaSqMeters : valance.manufacturerCost;
      breakdown.push({
        type: 'valance_type',
        code: valanceValue,
        name: valance.name,
        price: Math.round(price * 100) / 100,
        manufacturerCost: Math.round(mfrCost * 100) / 100,
        priceType: valance.priceType,
        estimated: true
      });
    }
  }

  // Bottom Rail
  const railValue = config.bottomRail || config.standardBottomBar;
  if (railValue && railValue !== 'none' && railValue !== 'standard') {
    const rail = getOptionPrice(db, 'bottomRail', railValue);
    if (rail && rail.price > 0) {
      const price = rail.priceType === 'sqm' ? rail.price * areaSqMeters : rail.price;
      const mfrCost = rail.priceType === 'sqm' ? rail.manufacturerCost * areaSqMeters : rail.manufacturerCost;
      breakdown.push({
        type: 'bottom_rail',
        code: railValue,
        name: rail.name,
        price: Math.round(price * 100) / 100,
        manufacturerCost: Math.round(mfrCost * 100) / 100,
        priceType: rail.priceType,
        estimated: true
      });
    }
  }

  return breakdown;
}

/**
 * Build accessories breakdown from configuration
 */
function buildAccessoriesBreakdown(db, config) {
  const breakdown = [];
  const accessories = db.productContent?.hardwareOptions?.accessories || [];

  if (config.smartHubQty > 0) {
    const hub = accessories.find(a => a.id === 'acc-smart-hub' || a.value === 'smart-hub');
    if (hub) {
      breakdown.push({
        type: 'accessory',
        code: 'smart-hub',
        name: `Smart Hub x${config.smartHubQty}`,
        price: (hub.price || 32.90) * config.smartHubQty,
        manufacturerCost: (hub.manufacturerCost || 23.50) * config.smartHubQty,
        estimated: true
      });
    }
  }

  if (config.usbChargerQty > 0) {
    const charger = accessories.find(a => a.id === 'acc-usb-charger' || a.value === 'usb-charger');
    if (charger) {
      breakdown.push({
        type: 'accessory',
        code: 'usb-charger',
        name: `USB Charger x${config.usbChargerQty}`,
        price: (charger.price || 7.00) * config.usbChargerQty,
        manufacturerCost: (charger.manufacturerCost || 5.00) * config.usbChargerQty,
        estimated: true
      });
    }
  }

  return breakdown;
}

/**
 * Migrate a single legacy order
 */
function migrateOrder(db, order) {
  const item = order.items?.[0];
  if (!item) return null;

  // Parse configuration
  let config = {};
  if (typeof item.configuration === 'string') {
    try {
      config = JSON.parse(item.configuration);
    } catch (e) {
      console.log(`  Warning: Could not parse configuration for ${order.order_number}`);
      config = {};
    }
  } else if (item.configuration) {
    config = item.configuration;
  }

  // Calculate area in square meters
  const widthInches = item.width || 24;
  const heightInches = item.height || 36;
  const areaSqMeters = (widthInches * heightInches) / 1550.0031;

  // Get existing price data
  const priceBreakdown = item.price_breakdown || {};
  const unitPrice = item.unit_price || priceBreakdown.unitPrice || 0;
  const lineTotal = item.line_total || priceBreakdown.lineTotal || 0;

  // Calculate manufacturer cost per item
  const totalMfrCost = order.pricing?.manufacturer_cost_total || 0;
  const itemCount = order.items?.length || 1;
  const itemMfrCost = totalMfrCost / itemCount;

  // Build options breakdown
  const optionsBreakdown = buildOptionsBreakdown(db, config, areaSqMeters);
  const optionsTotal = optionsBreakdown.reduce((sum, o) => sum + o.price, 0);
  const optionsMfrCost = optionsBreakdown.reduce((sum, o) => sum + o.manufacturerCost, 0);

  // Build accessories breakdown
  const accessoriesBreakdown = buildAccessoriesBreakdown(db, config);
  const accessoriesTotal = accessoriesBreakdown.reduce((sum, a) => sum + a.price, 0);
  const accessoriesMfrCost = accessoriesBreakdown.reduce((sum, a) => sum + a.manufacturerCost, 0);

  // Calculate fabric cost (total MFR - options MFR - accessories MFR)
  const fabricMfrCost = Math.max(0, itemMfrCost - optionsMfrCost - accessoriesMfrCost);

  // Build price_snapshot
  const priceSnapshot = {
    captured_at: order.created_at || new Date().toISOString(),
    migrated_at: new Date().toISOString(),
    migration_note: 'Backfilled by BUG-015 migration script. Options breakdown is estimated from current prices.',
    manufacturer_price: {
      unit_cost: Math.round(fabricMfrCost * 100) / 100,
      total_cost: Math.round(fabricMfrCost * (item.quantity || 1) * 100) / 100,
      source: 'migrated_estimate',
      fabric_code: config.fabricCode || priceBreakdown.fabricCode || 'unknown'
    },
    margin: {
      type: 'percentage',
      value: order.pricing?.margin_percent || 40,
      amount: Math.round((order.pricing?.margin_total || 0) / itemCount * 100) / 100,
      percentage: order.pricing?.margin_percent || 40
    },
    customer_price: {
      unit_price: unitPrice,
      line_total: lineTotal,
      options_total: Math.round(optionsTotal * 100) / 100,
      options_breakdown: optionsBreakdown,
      accessories_total: Math.round(accessoriesTotal * 100) / 100,
      accessories_breakdown: accessoriesBreakdown
    }
  };

  return priceSnapshot;
}

/**
 * Main migration function
 */
function migrate() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   BUG-015: Legacy Orders Migration');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const db = loadDatabase();
  const orders = db.orders || [];

  // Find legacy orders (no price_snapshot.captured_at)
  const legacyOrders = orders.filter(o => {
    const snapshot = o.items?.[0]?.price_snapshot;
    return !snapshot?.captured_at;
  });

  console.log(`Found ${legacyOrders.length} legacy orders to migrate`);
  console.log('');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  legacyOrders.forEach(order => {
    try {
      const priceSnapshot = migrateOrder(db, order);

      if (!priceSnapshot) {
        console.log(`  ⚠️  Skipped ${order.order_number}: No items`);
        skipped++;
        return;
      }

      // Update the order's first item with price_snapshot
      if (!DRY_RUN) {
        const orderIndex = db.orders.findIndex(o => o.id === order.id);
        if (orderIndex !== -1 && db.orders[orderIndex].items?.[0]) {
          db.orders[orderIndex].items[0].price_snapshot = priceSnapshot;
        }
      }

      const optionsCount = priceSnapshot.customer_price.options_breakdown.length;
      console.log(`  ✅ ${order.order_number}: ${optionsCount} options estimated`);
      migrated++;
    } catch (e) {
      console.log(`  ❌ ${order.order_number}: Error - ${e.message}`);
      errors++;
    }
  });

  // Save database
  if (!DRY_RUN && migrated > 0) {
    saveDatabase(db);
    console.log('');
    console.log('Database saved.');
  }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped:  ${skipped}`);
  console.log(`   Errors:   ${errors}`);
  console.log('═══════════════════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('');
    console.log('This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run migration
migrate();
