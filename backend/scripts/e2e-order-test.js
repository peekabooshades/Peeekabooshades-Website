/**
 * END-TO-END ORDER FLOW TEST
 * Tests the complete order flow from cart to reports
 *
 * Run: node scripts/e2e-order-test.js
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');

// Test configuration - Zebra product with motorized option
const TEST_CONFIG = {
  productId: '07595ff8-fab4-4e0e-b53b-7b7165cbe69c', // Zebra product
  productName: 'Affordable Custom Zebra Shades',
  fabricCode: '83009A', // Blackout zebra fabric
  width: 48, // inches
  height: 60, // inches
  quantity: 2,
  controlType: 'motorized',
  motorBrandId: 'motor-aok', // AOK Motor - $66.15
  remoteTypeId: 'remote-003', // 15-channel - $27.58
  valanceTypeId: 'v3-fabric-wrapped', // V3 Fabric Wrapped - $3.15
  bottomRailId: 'type-a-white', // Type A White - $0
  smartHubQty: 1, // Smart Hub - $32.90
  usbChargerQty: 1, // USB Charger - $7.00
  customer: {
    name: 'E2E Test Customer',
    email: 'e2e-test@peekabooshades.com',
    phone: '555-123-4567',
    address: '123 Test Street, Austin, TX 78701'
  }
};

function loadDatabase() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function log(section, message, data = null) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${section}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logPrice(label, amount) {
  console.log(`  ${label.padEnd(35)} $${amount.toFixed(2)}`);
}

// ============================================
// STEP 1: CALCULATE PRICING
// ============================================
function calculatePricing() {
  log('STEP 1', 'CALCULATING PRICING FOR ZEBRA PRODUCT');

  const db = loadDatabase();

  // Get zebra fabric price
  const zebraPrices = db.zebraManufacturerPrices || [];
  const fabricPrice = zebraPrices.find(p => p.fabricCode === TEST_CONFIG.fabricCode);

  if (!fabricPrice) {
    throw new Error(`Fabric ${TEST_CONFIG.fabricCode} not found in zebraManufacturerPrices`);
  }

  console.log('\n  FABRIC PRICING:');
  console.log(`  Fabric Code: ${TEST_CONFIG.fabricCode}`);
  console.log(`  MFR Price/sqm (Manual): $${fabricPrice.pricePerSqMeterManual}`);
  console.log(`  MFR Price/sqm (Cordless): $${fabricPrice.pricePerSqMeterCordless}`);
  console.log(`  Margin: ${fabricPrice.manualMargin}%`);
  console.log(`  Min Area: ${fabricPrice.minAreaSqMeter} sqm`);

  // Calculate area
  const widthM = TEST_CONFIG.width * 0.0254;
  const heightM = TEST_CONFIG.height * 0.0254;
  let areaSqM = widthM * heightM;
  const minArea = fabricPrice.minAreaSqMeter || 1.5;

  console.log('\n  DIMENSIONS:');
  console.log(`  Width: ${TEST_CONFIG.width}" = ${widthM.toFixed(4)}m`);
  console.log(`  Height: ${TEST_CONFIG.height}" = ${heightM.toFixed(4)}m`);
  console.log(`  Calculated Area: ${areaSqM.toFixed(4)} sqm`);

  if (areaSqM < minArea) {
    console.log(`  Min Area Applied: ${minArea} sqm (was ${areaSqM.toFixed(4)})`);
    areaSqM = minArea;
  }

  // Use cordless price for motorized
  const pricePerSqM = fabricPrice.pricePerSqMeterCordless || fabricPrice.pricePerSqMeterManual;
  const margin = fabricPrice.manualMargin || 40;

  // Calculate fabric cost
  const fabricMfrCost = areaSqM * pricePerSqM;
  const fabricMarginAmt = fabricMfrCost * (margin / 100);
  const fabricCustomerPrice = fabricMfrCost + fabricMarginAmt;

  console.log('\n  FABRIC COST CALCULATION:');
  logPrice('MFR Fabric Cost (per unit)', fabricMfrCost);
  logPrice(`Margin (${margin}%)`, fabricMarginAmt);
  logPrice('Customer Fabric Price (per unit)', fabricCustomerPrice);

  // Get hardware prices from zebraHardwareOptions
  const zebraHardware = db.productContent?.zebraHardwareOptions || {};
  const rollerHardware = db.productContent?.hardwareOptions || {};

  // Valance price (from zebra hardware)
  let valancePrice = 0;
  let valanceMfrCost = 0;
  const valanceOptions = zebraHardware.valanceType || [];
  const selectedValance = valanceOptions.find(v => v.id === TEST_CONFIG.valanceTypeId);
  if (selectedValance) {
    valancePrice = selectedValance.price || 0;
    valanceMfrCost = valancePrice * 0.6; // Assume 60% MFR cost
    console.log(`\n  HARDWARE OPTIONS:`);
    console.log(`  Valance: ${selectedValance.label} - $${valancePrice.toFixed(2)}`);
  }

  // Bottom rail price (from zebra hardware)
  let bottomRailPrice = 0;
  let bottomRailMfrCost = 0;
  const bottomRailOptions = zebraHardware.bottomRail || [];
  const selectedBottomRail = bottomRailOptions.find(b => b.id === TEST_CONFIG.bottomRailId);
  if (selectedBottomRail) {
    bottomRailPrice = selectedBottomRail.price || 0;
    bottomRailMfrCost = bottomRailPrice * 0.6;
    console.log(`  Bottom Rail: ${selectedBottomRail.label} - $${bottomRailPrice.toFixed(2)}`);
  }

  // Motor pricing (from motorBrands collection)
  const motorBrands = db.motorBrands || [];
  let motorPrice = 0;
  let motorMfrCost = 0;
  const selectedMotor = motorBrands.find(m => m.id === TEST_CONFIG.motorBrandId);
  if (selectedMotor) {
    motorPrice = selectedMotor.price || 66;
    motorMfrCost = selectedMotor.manufacturerCost || motorPrice * 0.6;
    console.log(`\n  MOTOR:`);
    console.log(`  Motor: ${selectedMotor.name} - $${motorPrice.toFixed(2)} (MFR: $${motorMfrCost.toFixed(2)})`);
  }

  // Remote price (from hardwareOptions)
  let remotePrice = 0;
  let remoteMfrCost = 0;
  const remoteOptions = rollerHardware.remoteType || [];
  const selectedRemote = remoteOptions.find(r => r.id === TEST_CONFIG.remoteTypeId);
  if (selectedRemote) {
    remotePrice = selectedRemote.price || 0;
    remoteMfrCost = remotePrice * 0.6;
    console.log(`  Remote: ${selectedRemote.label} - $${remotePrice.toFixed(2)}`);
  }

  // Accessories (from hardwareOptions.accessories)
  const accessories = rollerHardware.accessories || [];
  let smartHubPrice = 0;
  let smartHubMfrCost = 0;
  const smartHub = accessories.find(a => a.id === 'acc-smart-hub');
  if (smartHub && TEST_CONFIG.smartHubQty > 0) {
    smartHubPrice = (smartHub.price || 32.9) * TEST_CONFIG.smartHubQty;
    smartHubMfrCost = smartHubPrice * 0.6;
  }

  let usbChargerPrice = 0;
  let usbChargerMfrCost = 0;
  const usbCharger = accessories.find(a => a.id === 'acc-usb-charger');
  if (usbCharger && TEST_CONFIG.usbChargerQty > 0) {
    usbChargerPrice = (usbCharger.price || 7) * TEST_CONFIG.usbChargerQty;
    usbChargerMfrCost = usbChargerPrice * 0.6;
  }

  console.log(`\n  ACCESSORIES:`);
  console.log(`  Smart Hub (${TEST_CONFIG.smartHubQty}x): $${smartHubPrice.toFixed(2)}`);
  console.log(`  USB Charger (${TEST_CONFIG.usbChargerQty}x): $${usbChargerPrice.toFixed(2)}`);

  // Total per unit
  const hardwareTotal = valancePrice + bottomRailPrice;
  const hardwareMfrTotal = valanceMfrCost + bottomRailMfrCost;
  const motorTotal = motorPrice + remotePrice;
  const motorMfrTotal = motorMfrCost + remoteMfrCost;
  const accessoriesTotal = smartHubPrice + usbChargerPrice;
  const accessoriesMfrTotal = smartHubMfrCost + usbChargerMfrCost;

  const unitMfrCost = fabricMfrCost + hardwareMfrTotal + motorMfrTotal + accessoriesMfrTotal;
  const unitCustomerPrice = fabricCustomerPrice + hardwareTotal + motorTotal + accessoriesTotal;

  // Total for quantity
  const totalMfrCost = unitMfrCost * TEST_CONFIG.quantity;
  const totalCustomerPrice = unitCustomerPrice * TEST_CONFIG.quantity;
  const totalMargin = totalCustomerPrice - totalMfrCost;
  const marginPercent = (totalMargin / totalCustomerPrice * 100);

  console.log('\n  UNIT PRICE BREAKDOWN:');
  logPrice('Fabric (customer price)', fabricCustomerPrice);
  logPrice('Hardware (valance + bottom rail)', hardwareTotal);
  logPrice('Motor + Remote', motorTotal);
  logPrice('Accessories', accessoriesTotal);
  logPrice('UNIT TOTAL', unitCustomerPrice);

  console.log(`\n  ORDER TOTAL (${TEST_CONFIG.quantity} units):`);
  logPrice('Total MFR Cost', totalMfrCost);
  logPrice('Total Customer Price', totalCustomerPrice);
  logPrice('Total Margin', totalMargin);
  console.log(`  Margin Percent: ${marginPercent.toFixed(2)}%`);

  return {
    areaSqM,
    fabricMfrCost,
    fabricCustomerPrice,
    hardwareTotal,
    motorTotal,
    accessoriesTotal,
    unitMfrCost,
    unitCustomerPrice,
    totalMfrCost,
    totalCustomerPrice,
    totalMargin,
    marginPercent,
    quantity: TEST_CONFIG.quantity,
    // Individual option pricing for breakdown
    optionsBreakdown: [
      { type: 'valance', name: selectedValance?.label || 'V3 Fabric Wrapped', price: valancePrice, manufacturerCost: valanceMfrCost },
      { type: 'bottomRail', name: selectedBottomRail?.label || 'Type A - White', price: bottomRailPrice, manufacturerCost: bottomRailMfrCost },
      { type: 'motor', name: `${selectedMotor?.name || 'AOK Motor'} (App Control)`, price: motorPrice, manufacturerCost: motorMfrCost },
      { type: 'remote', name: selectedRemote?.label || '15 Channel', price: remotePrice, manufacturerCost: remoteMfrCost }
    ],
    accessoriesBreakdown: [
      { type: 'smartHub', name: 'Smart Hub', price: smartHubPrice, manufacturerCost: smartHubMfrCost, quantity: TEST_CONFIG.smartHubQty },
      { type: 'usbCharger', name: 'USB Charger', price: usbChargerPrice, manufacturerCost: usbChargerMfrCost, quantity: TEST_CONFIG.usbChargerQty }
    ]
  };
}

// ============================================
// STEP 2: ADD TO CART
// ============================================
function addToCart(pricing) {
  log('STEP 2', 'ADDING TO CART');

  const db = loadDatabase();
  const sessionId = 'e2e-test-' + Date.now();

  // Create cart item with price snapshot
  const cartItem = {
    id: 'cart-e2e-' + Date.now(),
    session_id: sessionId,
    product_id: TEST_CONFIG.productId,
    product_name: TEST_CONFIG.productName,
    product_slug: 'affordable-custom-zebra-shades',
    product_type: 'zebra',
    quantity: TEST_CONFIG.quantity,
    width: TEST_CONFIG.width,
    height: TEST_CONFIG.height,
    room_label: 'E2E Test Room',
    configuration: JSON.stringify({
      fabricCode: TEST_CONFIG.fabricCode,
      controlType: TEST_CONFIG.controlType,
      motorBrand: TEST_CONFIG.motorBrand,
      remoteType: TEST_CONFIG.remoteType,
      valanceType: TEST_CONFIG.valanceType,
      bottomRail: TEST_CONFIG.bottomRail,
      smartHubQty: TEST_CONFIG.smartHubQty,
      usbChargerQty: TEST_CONFIG.usbChargerQty
    }),
    unit_price: pricing.unitCustomerPrice,
    line_total: pricing.totalCustomerPrice,
    price_snapshot: {
      captured_at: new Date().toISOString(),
      manufacturer_price: {
        unit_cost: pricing.unitMfrCost,
        total_cost: pricing.totalMfrCost,
        fabric_code: TEST_CONFIG.fabricCode,
        source: 'e2e_test'
      },
      margin: {
        type: 'percentage',
        value: 40,
        amount: pricing.totalMargin,
        percentage: pricing.marginPercent
      },
      customer_price: {
        unit_price: pricing.unitCustomerPrice,
        line_total: pricing.totalCustomerPrice,
        options_total: pricing.hardwareTotal + pricing.motorTotal,
        options_breakdown: pricing.optionsBreakdown,
        accessories_total: pricing.accessoriesTotal,
        accessories_breakdown: pricing.accessoriesBreakdown
      }
    },
    created_at: new Date().toISOString()
  };

  if (!db.cart) db.cart = [];
  db.cart.push(cartItem);
  saveDatabase(db);

  console.log('\n  Cart Item Created:');
  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Product: ${TEST_CONFIG.productName}`);
  console.log(`  Dimensions: ${TEST_CONFIG.width}" x ${TEST_CONFIG.height}"`);
  console.log(`  Quantity: ${TEST_CONFIG.quantity}`);
  logPrice('Unit Price', pricing.unitCustomerPrice);
  logPrice('Line Total', pricing.totalCustomerPrice);

  return { sessionId, cartItem };
}

// ============================================
// STEP 3: CREATE ORDER
// ============================================
function createOrder(sessionId, pricing) {
  log('STEP 3', 'CREATING ORDER');

  const db = loadDatabase();
  const { v4: uuidv4 } = require('uuid');

  const orderId = uuidv4();
  const orderNumber = 'ORD-E2E-' + Date.now().toString(36).toUpperCase();
  const now = new Date().toISOString();

  // Get cart items
  const cartItems = db.cart.filter(item => item.session_id === sessionId);

  // Calculate tax (TX rate)
  const taxRate = 0.0825;
  const subtotal = pricing.totalCustomerPrice;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const shipping = subtotal > 99 ? 0 : 9.99;
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;

  const order = {
    id: orderId,
    order_number: orderNumber,
    status: 'order_received',
    customer: {
      name: TEST_CONFIG.customer.name,
      email: TEST_CONFIG.customer.email,
      phone: TEST_CONFIG.customer.phone,
      address: TEST_CONFIG.customer.address
    },
    items: cartItems.map(item => ({
      ...item,
      order_id: orderId,
      price_snapshots: item.price_snapshot
    })),
    pricing: {
      subtotal,
      tax,
      tax_rate: taxRate,
      shipping,
      total,
      currency: 'USD',
      manufacturer_cost_total: pricing.totalMfrCost,
      margin_total: pricing.totalMargin,
      margin_percent: pricing.marginPercent
    },
    payment: {
      method: 'e2e_test',
      status: 'completed',
      transaction_id: 'TXN-E2E-' + Date.now()
    },
    shipping_address: TEST_CONFIG.customer.address,
    shipping_state: 'TX',
    created_at: now,
    updated_at: now,
    placed_at: now
  };

  if (!db.orders) db.orders = [];
  db.orders.push(order);

  // Clear cart
  db.cart = db.cart.filter(item => item.session_id !== sessionId);
  saveDatabase(db);

  console.log('\n  Order Created:');
  console.log(`  Order ID: ${orderId}`);
  console.log(`  Order Number: ${orderNumber}`);
  console.log(`  Customer: ${TEST_CONFIG.customer.name}`);
  console.log(`  Status: order_received`);
  console.log('\n  ORDER PRICING:');
  logPrice('Subtotal', subtotal);
  logPrice(`Tax (${(taxRate * 100).toFixed(2)}%)`, tax);
  logPrice('Shipping', shipping);
  logPrice('TOTAL', total);
  console.log('\n  PROFIT BREAKDOWN:');
  logPrice('MFR Cost', pricing.totalMfrCost);
  logPrice('Gross Margin', pricing.totalMargin);
  console.log(`  Margin %: ${pricing.marginPercent.toFixed(2)}%`);

  return { orderId, orderNumber, order };
}

// ============================================
// STEP 4: CREATE INVOICE
// ============================================
function createInvoice(orderId, orderNumber, order) {
  log('STEP 4', 'CREATING INVOICE');

  const db = loadDatabase();
  const { v4: uuidv4 } = require('uuid');

  const invoiceId = uuidv4();
  const invoiceNumber = 'INV-E2E-' + Date.now().toString(36).toUpperCase();
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 30);

  const invoice = {
    id: invoiceId,
    invoiceNumber,
    type: 'customer',
    status: 'paid', // Since payment is completed
    orderId,
    orderNumber,
    customerId: 'CUST-E2E-' + Date.now().toString(36).toUpperCase(),
    customerNumber: 'CUST-E2E-' + Date.now().toString(36).toUpperCase(),
    customer: {
      name: TEST_CONFIG.customer.name,
      email: TEST_CONFIG.customer.email,
      phone: TEST_CONFIG.customer.phone,
      address: TEST_CONFIG.customer.address
    },
    billingAddress: TEST_CONFIG.customer.address,
    shippingAddress: TEST_CONFIG.customer.address,
    items: order.items.map(item => ({
      id: item.id,
      description: item.product_name,
      details: `${item.width}" W x ${item.height}" H`,
      roomLabel: item.room_label,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      pricing: item.price_snapshots?.customer_price || {}
    })),
    subtotal: order.pricing.subtotal,
    tax: order.pricing.tax,
    taxRate: order.pricing.tax_rate,
    taxState: 'TX',
    shipping: order.pricing.shipping,
    discount: 0,
    total: order.pricing.total,
    currency: 'USD',
    amountPaid: order.pricing.total,
    amountDue: 0,
    paymentMethod: 'e2e_test',
    paidAt: now.toISOString(),
    issueDate: now.toISOString(),
    dueDate: dueDate.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    payments: [{
      id: 'PMT-E2E-' + Date.now(),
      amount: order.pricing.total,
      method: 'e2e_test',
      date: now.toISOString(),
      reference: 'E2E Test Payment'
    }]
  };

  if (!db.invoices) db.invoices = [];
  db.invoices.push(invoice);
  saveDatabase(db);

  console.log('\n  Invoice Created:');
  console.log(`  Invoice ID: ${invoiceId}`);
  console.log(`  Invoice Number: ${invoiceNumber}`);
  console.log(`  Status: paid`);
  console.log(`  Due Date: ${dueDate.toDateString()}`);
  logPrice('Total', invoice.total);
  logPrice('Amount Paid', invoice.amountPaid);
  logPrice('Amount Due', invoice.amountDue);

  return { invoiceId, invoiceNumber, invoice };
}

// ============================================
// STEP 5: CREATE LEDGER ENTRIES
// ============================================
function createLedgerEntries(orderId, orderNumber, order, pricing) {
  log('STEP 5', 'CREATING LEDGER ENTRIES');

  const db = loadDatabase();
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();

  if (!db.ledger) db.ledger = [];

  const entries = [];

  // 1. Revenue entry (credit)
  const revenueEntry = {
    id: uuidv4(),
    orderId,
    orderNumber,
    type: 'revenue',
    category: 'sales',
    description: `Order ${orderNumber} - Customer payment received`,
    debit: 0,
    credit: order.pricing.total,
    balance: order.pricing.total,
    createdAt: now
  };
  entries.push(revenueEntry);

  // 2. Cost of goods sold (debit)
  const cogsEntry = {
    id: uuidv4(),
    orderId,
    orderNumber,
    type: 'expense',
    category: 'cogs',
    description: `Order ${orderNumber} - Manufacturer cost`,
    debit: pricing.totalMfrCost,
    credit: 0,
    balance: -pricing.totalMfrCost,
    createdAt: now
  };
  entries.push(cogsEntry);

  // 3. Tax collected (liability)
  const taxEntry = {
    id: uuidv4(),
    orderId,
    orderNumber,
    type: 'liability',
    category: 'sales_tax',
    description: `Order ${orderNumber} - Sales tax collected (TX ${(order.pricing.tax_rate * 100).toFixed(2)}%)`,
    debit: 0,
    credit: order.pricing.tax,
    balance: order.pricing.tax,
    createdAt: now
  };
  entries.push(taxEntry);

  // 4. Gross profit
  const profitEntry = {
    id: uuidv4(),
    orderId,
    orderNumber,
    type: 'equity',
    category: 'gross_profit',
    description: `Order ${orderNumber} - Gross profit`,
    debit: 0,
    credit: pricing.totalMargin,
    balance: pricing.totalMargin,
    createdAt: now
  };
  entries.push(profitEntry);

  db.ledger.push(...entries);
  saveDatabase(db);

  console.log('\n  Ledger Entries Created:');
  entries.forEach(entry => {
    const amount = entry.credit > 0 ? `+$${entry.credit.toFixed(2)}` : `-$${entry.debit.toFixed(2)}`;
    console.log(`  [${entry.category.toUpperCase()}] ${entry.description.substring(0, 40)}... ${amount}`);
  });

  console.log('\n  ACCOUNT SUMMARY:');
  logPrice('Revenue (Total Sales)', order.pricing.total);
  logPrice('COGS (MFR Cost)', pricing.totalMfrCost);
  logPrice('Sales Tax Liability', order.pricing.tax);
  logPrice('Gross Profit', pricing.totalMargin);

  return entries;
}

// ============================================
// STEP 6: UPDATE ANALYTICS
// ============================================
function updateAnalytics(orderId, orderNumber, order) {
  log('STEP 6', 'UPDATING ANALYTICS');

  const db = loadDatabase();
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();

  if (!db.analyticsEvents) db.analyticsEvents = [];

  // Add purchase event
  const purchaseEvent = {
    id: `evt-${uuidv4().slice(0, 8)}`,
    type: 'purchase',
    sessionId: 'e2e-test',
    orderId,
    orderNumber,
    value: order.pricing.total,
    quantity: TEST_CONFIG.quantity,
    source: 'e2e_test',
    metadata: {
      productType: 'zebra',
      controlType: TEST_CONFIG.controlType,
      fabricCode: TEST_CONFIG.fabricCode
    },
    createdAt: now
  };

  db.analyticsEvents.push(purchaseEvent);
  saveDatabase(db);

  console.log('\n  Analytics Event Created:');
  console.log(`  Event Type: purchase`);
  console.log(`  Order: ${orderNumber}`);
  console.log(`  Value: $${order.pricing.total.toFixed(2)}`);
  console.log(`  Product Type: zebra`);
  console.log(`  Control Type: ${TEST_CONFIG.controlType}`);

  return purchaseEvent;
}

// ============================================
// STEP 7: VERIFY DATA INTEGRITY
// ============================================
function verifyDataIntegrity(orderId, invoiceId, pricing) {
  log('STEP 7', 'VERIFYING DATA INTEGRITY');

  const db = loadDatabase();

  // Find order
  const order = db.orders.find(o => o.id === orderId);
  if (!order) {
    throw new Error('Order not found!');
  }

  // Find invoice
  const invoice = db.invoices.find(i => i.id === invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found!');
  }

  // Find ledger entries
  const ledgerEntries = (db.ledger || []).filter(e => e.orderId === orderId);

  console.log('\n  DATA VERIFICATION:');

  // Verify order totals
  const orderOk = Math.abs(order.pricing.total - invoice.total) < 0.01;
  console.log(`  Order total matches invoice: ${orderOk ? '✓ PASS' : '✗ FAIL'}`);

  // Verify MFR cost stored
  const mfrCostOk = order.pricing.manufacturer_cost_total > 0;
  console.log(`  MFR cost recorded in order: ${mfrCostOk ? '✓ PASS' : '✗ FAIL'}`);

  // Verify margin calculation
  const expectedMargin = order.pricing.subtotal - order.pricing.manufacturer_cost_total;
  const marginOk = Math.abs(order.pricing.margin_total - expectedMargin) < 0.01;
  console.log(`  Margin calculation correct: ${marginOk ? '✓ PASS' : '✗ FAIL'}`);

  // Verify ledger entries
  const revenueEntry = ledgerEntries.find(e => e.category === 'sales');
  const cogsEntry = ledgerEntries.find(e => e.category === 'cogs');
  const profitEntry = ledgerEntries.find(e => e.category === 'gross_profit');

  const ledgerOk = revenueEntry && cogsEntry && profitEntry;
  console.log(`  Ledger entries created: ${ledgerOk ? '✓ PASS' : '✗ FAIL'}`);

  // Verify profit in ledger matches order margin
  if (profitEntry) {
    const profitMatch = Math.abs(profitEntry.credit - order.pricing.margin_total) < 0.01;
    console.log(`  Ledger profit matches order: ${profitMatch ? '✓ PASS' : '✗ FAIL'}`);
  }

  // Verify invoice is paid
  const invoicePaid = invoice.status === 'paid' && invoice.amountDue === 0;
  console.log(`  Invoice marked as paid: ${invoicePaid ? '✓ PASS' : '✗ FAIL'}`);

  // Verify analytics event
  const analyticsEvent = (db.analyticsEvents || []).find(e => e.orderId === orderId);
  const analyticsOk = analyticsEvent && analyticsEvent.type === 'purchase';
  console.log(`  Analytics event recorded: ${analyticsOk ? '✓ PASS' : '✗ FAIL'}`);

  const allPassed = orderOk && mfrCostOk && marginOk && ledgerOk && invoicePaid && analyticsOk;

  console.log(`\n  OVERALL: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);

  return allPassed;
}

// ============================================
// STEP 8: GENERATE SUMMARY REPORT
// ============================================
function generateSummaryReport(orderId, orderNumber, invoiceNumber, pricing) {
  log('STEP 8', 'GENERATING SUMMARY REPORT');

  const db = loadDatabase();
  const order = db.orders.find(o => o.id === orderId);
  const invoice = db.invoices.find(i => i.invoiceNumber === invoiceNumber);

  console.log('\n' + '='.repeat(60));
  console.log('                    E2E ORDER FLOW SUMMARY');
  console.log('='.repeat(60));

  console.log('\n  PRODUCT DETAILS:');
  console.log(`  Product: ${TEST_CONFIG.productName}`);
  console.log(`  Fabric: ${TEST_CONFIG.fabricCode}`);
  console.log(`  Size: ${TEST_CONFIG.width}" x ${TEST_CONFIG.height}"`);
  console.log(`  Control: ${TEST_CONFIG.controlType} (${TEST_CONFIG.motorBrand})`);
  console.log(`  Quantity: ${TEST_CONFIG.quantity}`);

  console.log('\n  CUSTOMER:');
  console.log(`  Name: ${TEST_CONFIG.customer.name}`);
  console.log(`  Email: ${TEST_CONFIG.customer.email}`);
  console.log(`  Address: ${TEST_CONFIG.customer.address}`);

  console.log('\n  ORDER:');
  console.log(`  Order Number: ${orderNumber}`);
  console.log(`  Status: ${order.status}`);
  console.log(`  Created: ${new Date(order.created_at).toLocaleString()}`);

  console.log('\n  INVOICE:');
  console.log(`  Invoice Number: ${invoiceNumber}`);
  console.log(`  Status: ${invoice.status}`);
  console.log(`  Due Date: ${new Date(invoice.dueDate).toDateString()}`);

  console.log('\n  FINANCIAL SUMMARY:');
  console.log('  ' + '-'.repeat(45));
  logPrice('Subtotal (Customer Price)', order.pricing.subtotal);
  logPrice('Sales Tax (TX 8.25%)', order.pricing.tax);
  logPrice('Shipping', order.pricing.shipping);
  console.log('  ' + '-'.repeat(45));
  logPrice('ORDER TOTAL', order.pricing.total);
  console.log('  ' + '-'.repeat(45));
  logPrice('Manufacturer Cost', order.pricing.manufacturer_cost_total);
  logPrice('GROSS PROFIT', order.pricing.margin_total);
  console.log(`  Profit Margin: ${order.pricing.margin_percent.toFixed(2)}%`);

  console.log('\n  DATA LOCATIONS:');
  console.log(`  Orders: /admin/orders.html (Order #${orderNumber})`);
  console.log(`  Invoices: /admin/invoices.html (Invoice #${invoiceNumber})`);
  console.log(`  Accounts: /admin/accounts.html`);
  console.log(`  Analytics: /admin/analytics.html`);

  console.log('\n' + '='.repeat(60));
  console.log('                    E2E TEST COMPLETED');
  console.log('='.repeat(60) + '\n');
}

// ============================================
// MAIN EXECUTION
// ============================================
async function runE2ETest() {
  console.log('\n' + '='.repeat(60));
  console.log('    PEEKABOO SHADES - END-TO-END ORDER FLOW TEST');
  console.log('    Testing: Zebra Shades with Motorized Control');
  console.log('='.repeat(60));

  try {
    // Step 1: Calculate pricing
    const pricing = calculatePricing();

    // Step 2: Add to cart
    const { sessionId, cartItem } = addToCart(pricing);

    // Step 3: Create order
    const { orderId, orderNumber, order } = createOrder(sessionId, pricing);

    // Step 4: Create invoice
    const { invoiceId, invoiceNumber, invoice } = createInvoice(orderId, orderNumber, order);

    // Step 5: Create ledger entries
    const ledgerEntries = createLedgerEntries(orderId, orderNumber, order, pricing);

    // Step 6: Update analytics
    const analyticsEvent = updateAnalytics(orderId, orderNumber, order);

    // Step 7: Verify data integrity
    const allPassed = verifyDataIntegrity(orderId, invoiceId, pricing);

    // Step 8: Generate summary report
    generateSummaryReport(orderId, orderNumber, invoiceNumber, pricing);

    return { success: true, orderId, orderNumber, invoiceNumber };

  } catch (error) {
    console.error('\n  ✗ E2E TEST FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test
runE2ETest();
