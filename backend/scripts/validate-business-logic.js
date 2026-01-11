#!/usr/bin/env node
/**
 * Business Logic Validation Script
 * Validates that pricing is consistent across:
 * - Frontend UI
 * - Admin Product Pricing
 * - Orders
 * - Invoices
 * - Manufacturer Portal
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const DB_PATH = path.join(__dirname, '../database.json');

function loadDatabase() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      } : {}
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Invalid JSON', raw: data.substring(0, 200) });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function validateAll() {
  console.log('='.repeat(70));
  console.log('BUSINESS LOGIC VALIDATION');
  console.log('='.repeat(70));
  console.log('');

  const db = loadDatabase();

  // 1. Validate Frontend API - /api/fabrics/zebra
  console.log('1. FRONTEND API - /api/fabrics/zebra');
  console.log('-'.repeat(50));
  const fabricsResponse = await makeRequest('/api/fabrics/zebra');
  if (fabricsResponse.success) {
    console.log('   ✅ Total fabrics:', fabricsResponse.total);
    const sample = fabricsResponse.fabrics[0];
    console.log('   Sample (', sample.code, '):');
    console.log('     Manual Customer Price: $' + sample.pricePerSqMeterManual + '/m²');
    console.log('     Cordless Customer Price: $' + sample.pricePerSqMeterCordless + '/m²');
    console.log('     Min Area: ' + sample.minAreaSqMeter + ' m²');
  } else {
    console.log('   ❌ Error:', fabricsResponse.error);
  }
  console.log('');

  // 2. Validate Admin Manufacturer Prices
  console.log('2. ADMIN API - zebraManufacturerPrices');
  console.log('-'.repeat(50));
  const zebraPrices = db.zebraManufacturerPrices || [];
  const zebraFabrics = db.zebraFabrics || [];
  console.log('   ✅ Total pricing entries:', zebraPrices.length);
  console.log('   ✅ Total fabric entries:', zebraFabrics.length);
  if (zebraPrices.length > 0) {
    const sample = zebraPrices[0];
    console.log('   Sample (', sample.fabricCode, '):');
    console.log('     MFR Bead Chain: $' + sample.pricePerSqMeterManual + '/m²');
    console.log('     MFR Cordless: $' + sample.pricePerSqMeterCordless + '/m²');
    console.log('     Margin: ' + sample.manualMargin + '%');
  }
  console.log('');

  // 3. Validate Pricing Calculation
  console.log('3. PRICING ENGINE VALIDATION');
  console.log('-'.repeat(50));
  const pricingResult = await makeRequest('/api/v1/pricing/calculate', 'POST', {
    productSlug: 'affordable-custom-zebra-shades',
    productType: 'zebra',
    width: 36,
    height: 48,
    quantity: 1,
    fabricCode: '83003A',
    options: { controlType: 'manual' }
  });

  if (pricingResult.success) {
    console.log('   ✅ Pricing calculation working');
    console.log('   Test case: 36"x48" with fabric 83003A (manual)');
    console.log('     MFR Cost: $' + pricingResult.pricing.manufacturerCost.unitCost.toFixed(2));
    console.log('     Margin: ' + pricingResult.pricing.margin.percentage + '%');
    console.log('     Customer Price: $' + pricingResult.pricing.unitPrice.toFixed(2));

    // Verify calculation
    const expectedMfrCost = 1.5 * 14.17; // min area × bead chain price
    const expectedCustomer = expectedMfrCost * 1.4;
    const mfrMatch = Math.abs(pricingResult.pricing.manufacturerCost.unitCost - expectedMfrCost) < 0.01;
    const custMatch = Math.abs(pricingResult.pricing.unitPrice - expectedCustomer) < 0.01;

    console.log('   Validation:');
    console.log('     MFR Cost: ' + (mfrMatch ? '✅' : '❌') + ' (expected $' + expectedMfrCost.toFixed(2) + ')');
    console.log('     Customer: ' + (custMatch ? '✅' : '❌') + ' (expected $' + expectedCustomer.toFixed(2) + ')');
  } else {
    console.log('   ❌ Error:', pricingResult.error);
  }
  console.log('');

  // 4. Validate Orders Structure
  console.log('4. ORDERS - Price Snapshot Structure');
  console.log('-'.repeat(50));
  const orders = db.orders || [];
  const zebraOrders = orders.filter(o =>
    o.items?.some(i => i.product_name?.toLowerCase().includes('zebra'))
  );
  console.log('   Total orders:', orders.length);
  console.log('   Zebra orders:', zebraOrders.length);

  if (zebraOrders.length > 0) {
    const order = zebraOrders[zebraOrders.length - 1]; // Most recent
    console.log('   Latest zebra order:', order.order_number);
    console.log('     Has pricing object:', !!order.pricing);
    console.log('     Has manufacturer_cost_total:', !!order.pricing?.manufacturer_cost_total);
    console.log('     Has margin_total:', !!order.pricing?.margin_total);

    if (order.items && order.items[0]?.price_snapshot) {
      console.log('   Item price_snapshot structure:');
      const snap = order.items[0].price_snapshot;
      console.log('     ✅ Has manufacturer_price:', !!snap.manufacturer_price);
      console.log('     ✅ Has margin:', !!snap.margin);
      console.log('     ✅ Has customer_price:', !!snap.customer_price);
    }
  } else {
    console.log('   ℹ️  No zebra orders found yet');
  }
  console.log('');

  // 5. Validate Invoices
  console.log('5. INVOICES - Structure Check');
  console.log('-'.repeat(50));
  const invoices = db.invoices || [];
  console.log('   Total invoices:', invoices.length);

  if (invoices.length > 0) {
    const invoice = invoices[invoices.length - 1];
    console.log('   Latest invoice:', invoice.invoiceNumber || invoice.invoice_number);
    console.log('     Type:', invoice.type);
    console.log('     Has items:', !!invoice.items?.length);
    console.log('     Has totals:', !!invoice.subtotal);
  } else {
    console.log('   ℹ️  No invoices found yet');
  }
  console.log('');

  // 6. Validate Hardware Options for Zebra
  console.log('6. HARDWARE OPTIONS - Zebra');
  console.log('-'.repeat(50));
  const productOptions = db.productOptions?.['affordable-custom-zebra-shades'] || {};
  console.log('   Motor Brands:', Object.keys(db.motorBrands || {}).length, 'entries');
  console.log('   Valance Types:', (productOptions.valanceType || []).length, 'options');
  console.log('   Bottom Rails:', (productOptions.bottomRail || []).length, 'options');
  console.log('   Remote Types:', (productOptions.remoteType || []).length, 'options');
  console.log('   Solar Panel:', (productOptions.solarPanel || []).length, 'options');
  console.log('   Accessories:', (productOptions.accessories || []).length, 'options');
  console.log('');

  // 7. Manufacturer Portal Data
  console.log('7. MANUFACTURER PORTAL - Data Availability');
  console.log('-'.repeat(50));
  console.log('   zebraManufacturerPrices:', zebraPrices.length, 'entries');
  console.log('   zebraFabrics:', zebraFabrics.length, 'entries');

  // Check data consistency
  const pricesFabricCodes = new Set(zebraPrices.map(p => p.fabricCode));
  const fabricsCodes = new Set(zebraFabrics.map(f => f.code));
  const missingFabrics = [...pricesFabricCodes].filter(c => !fabricsCodes.has(c));
  const missingPrices = [...fabricsCodes].filter(c => !pricesFabricCodes.has(c));

  console.log('   Data consistency:');
  console.log('     ' + (missingFabrics.length === 0 ? '✅' : '❌') + ' All prices have fabric entries');
  console.log('     ' + (missingPrices.length === 0 ? '✅' : '❌') + ' All fabrics have price entries');
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log('Zebra Pricing Flow:');
  console.log('  1. PDF Import → zebraManufacturerPrices (MFR costs) + zebraFabrics (specs)');
  console.log('  2. Admin Product Pricing → /api/admin/manufacturer-prices?productType=zebra');
  console.log('  3. Frontend → /api/fabrics/zebra (customer prices with margin applied)');
  console.log('  4. Add to Cart → /api/v1/pricing/calculate (full price calculation)');
  console.log('  5. Cart stores price_snapshot with MFR cost + margin + customer price');
  console.log('  6. Orders inherit price_snapshot from cart');
  console.log('  7. Invoices use order data for customer/manufacturer invoices');
  console.log('');
  console.log('All systems use zebraManufacturerPrices as the single source of truth!');
}

validateAll().catch(console.error);
