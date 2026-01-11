/**
 * E2E Order Creation Test
 * Tests the full flow from cart to order creation
 */

const sessionId = 'e2e-test-' + Date.now();

const cartData = {
  productId: 'b23180d5-7989-4f9d-bf28-9b210cb31256',
  sessionId: sessionId,
  productName: 'E2E Test Roller Blinds',
  width: 48,
  height: 60,
  quantity: 1,
  fabricCode: '82032B',
  roomLabel: 'E2E Test Room',
  configuration: {
    lightFiltering: 'blackout',
    fabricCode: '82032B',
    valanceType: 'fabric-wrapped-v3',
    bottomRail: 'type-b',
    chainSide: 'left',
    rollerType: 'forward-roll',
    mountType: 'inside',
    controlType: 'motorized',
    motorBrand: 'aok-(remote-control)',
    motorType: 'solar-powered',
    remoteType: 'single-channel',
    solarType: 'yes',
    smartHubQty: 1
  }
};

async function runTest() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   E2E ORDER CREATION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Session:', sessionId);
  console.log('');

  // Step 1: Add to cart
  console.log('📦 Step 1: Adding to cart...');
  const cartRes = await fetch('http://localhost:3001/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cartData)
  }).then(r => r.json());

  if (!cartRes.success) {
    console.log('  ❌ Cart ERROR:', cartRes.error);
    return;
  }

  console.log('  ✅ Cart item created:', cartRes.cartItemId);
  console.log('  Unit price: $' + cartRes.pricing?.unitPrice);
  console.log('  Options total: $' + cartRes.pricing?.optionsTotal);

  // Step 2: Create order
  console.log('');
  console.log('📋 Step 2: Creating order...');
  const orderData = {
    sessionId: sessionId,
    customer: {
      firstName: 'E2E',
      lastName: 'Test',
      email: 'e2e@test.com',
      phone: '555-0123'
    },
    shippingAddress: {
      street: '123 Test St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      country: 'US'
    },
    shippingMethod: 'standard',
    shippingState: 'TX',
    taxRate: 8.25,
    paymentMethod: 'test'
  };

  const orderRes = await fetch('http://localhost:3001/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  }).then(r => r.json());

  if (!orderRes.success) {
    console.log('  ❌ Order ERROR:', orderRes.error);
    return;
  }

  console.log('  ✅ Order created:', orderRes.data?.order_number);
  console.log('  Order ID:', orderRes.data?.id);

  // Step 3: Verify order data
  console.log('');
  console.log('🔍 Step 3: Verifying order data...');
  const db = require('./database.json');
  const order = db.orders.find(o => o.id === orderRes.data?.id);

  if (!order) {
    console.log('  ❌ Order not found in database');
    return;
  }

  const results = [];

  // BUG-008: Check tax rate and shipping state
  if (order.shipping_state) {
    results.push({ test: 'BUG-008: shipping_state stored', pass: true, value: order.shipping_state });
  } else {
    results.push({ test: 'BUG-008: shipping_state stored', pass: false, value: 'NOT SET' });
  }

  if (order.tax_rate !== undefined) {
    results.push({ test: 'BUG-008: tax_rate stored', pass: true, value: order.tax_rate + '%' });
  } else {
    results.push({ test: 'BUG-008: tax_rate stored', pass: false, value: 'NOT SET' });
  }

  // BUG-006: Check options breakdown
  const breakdown = order.items?.[0]?.price_snapshot?.customer_price?.options_breakdown || [];

  const checkOption = (type, label) => {
    const opt = breakdown.find(b => b.type === type);
    if (opt && opt.price > 0 && opt.manufacturerCost > 0) {
      results.push({ test: `BUG-006: ${label} captured`, pass: true, value: `$${opt.price.toFixed(2)} (MFR: $${opt.manufacturerCost.toFixed(2)})` });
    } else {
      results.push({ test: `BUG-006: ${label} captured`, pass: false, value: opt ? `$${opt.price}` : 'NOT FOUND' });
    }
  };

  checkOption('valance_type', 'Valance');
  checkOption('bottom_rail', 'Bottom rail');
  checkOption('remote', 'Remote');
  checkOption('solar', 'Solar');
  checkOption('motorization', 'Motor');

  // Check MFR cost total
  if (order.pricing?.manufacturer_cost_total > 0) {
    results.push({ test: 'MFR cost total stored', pass: true, value: `$${order.pricing.manufacturer_cost_total.toFixed(2)}` });
  } else {
    results.push({ test: 'MFR cost total stored', pass: false, value: 'NOT SET' });
  }

  // Print results
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════');

  let passed = 0, failed = 0;
  results.forEach(r => {
    if (r.pass) {
      passed++;
      console.log(`  ✅ ${r.test}: ${r.value}`);
    } else {
      failed++;
      console.log(`  ❌ ${r.test}: ${r.value}`);
    }
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`   SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════');

  // Show full breakdown
  console.log('');
  console.log('📊 Full Options Breakdown:');
  breakdown.forEach(opt => {
    console.log(`  - ${opt.type}: $${opt.price?.toFixed(2)} (MFR: $${opt.manufacturerCost?.toFixed(2)})`);
  });

  // Show invoice if created
  const invoice = db.invoices?.find(i => i.order_id === order.id);
  if (invoice) {
    console.log('');
    console.log('🧾 Invoice Created:', invoice.invoice_number);
    console.log('  Total: $' + invoice.total?.toFixed(2));
  }
}

runTest().catch(e => console.error('Test error:', e));
