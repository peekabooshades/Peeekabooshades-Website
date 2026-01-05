/**
 * LEDGER SERVICE - Accounting Entries
 * Ticket 002: Cart + Fake Checkout + Orders + AuditLog
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

// Ledger Entry Types
const LEDGER_TYPES = {
  CUSTOMER_PAYMENT: 'customer_payment_received',
  SALES_TAX: 'sales_tax_collected',
  SHIPPING_CHARGED: 'shipping_charged',
  MANUFACTURER_PAYABLE: 'manufacturer_payable',
  MANUFACTURER_PAID: 'manufacturer_paid',
  SHIPPING_PAID: 'shipping_paid',
  TRANSACTION_FEE: 'transaction_fee',
  REFUND_PAID: 'refund_paid',
  DAMAGE_COST: 'damage_cost',
  ADJUSTMENT: 'adjustment'
};

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Create ledger entry
 */
function createEntry(type, orderId, amount, description, metadata = {}) {
  const db = loadDatabase();

  if (!db.ledgerEntries) db.ledgerEntries = [];

  const entry = {
    id: uuidv4(),
    type,
    orderId,
    amount: Math.round(amount * 100) / 100,
    description,
    metadata,
    createdAt: new Date().toISOString()
  };

  db.ledgerEntries.push(entry);
  saveDatabase(db);

  return entry;
}

/**
 * Create all ledger entries for an order
 */
function createOrderLedgerEntries(order) {
  const entries = [];

  // Customer payment received
  entries.push(createEntry(
    LEDGER_TYPES.CUSTOMER_PAYMENT,
    order.id,
    order.pricing.total,
    `Payment for order ${order.order_number}`,
    { orderNumber: order.order_number }
  ));

  // Sales tax collected
  if (order.pricing.tax > 0) {
    entries.push(createEntry(
      LEDGER_TYPES.SALES_TAX,
      order.id,
      order.pricing.tax,
      `Sales tax for order ${order.order_number}`,
      { taxRate: order.pricing.tax_rate }
    ));
  }

  // Shipping charged
  if (order.pricing.shipping > 0) {
    entries.push(createEntry(
      LEDGER_TYPES.SHIPPING_CHARGED,
      order.id,
      order.pricing.shipping,
      `Shipping for order ${order.order_number}`
    ));
  }

  // Manufacturer payable (calculate from items)
  const manufacturerCost = order.items.reduce((sum, item) => {
    return sum + (item.manufacturer_cost || item.calculated_price * 0.6);
  }, 0);

  entries.push(createEntry(
    LEDGER_TYPES.MANUFACTURER_PAYABLE,
    order.id,
    -manufacturerCost, // Negative = liability
    `Manufacturer cost for order ${order.order_number}`
  ));

  return entries;
}

/**
 * Get ledger entries for an order
 */
function getEntriesForOrder(orderId) {
  const db = loadDatabase();
  return (db.ledgerEntries || []).filter(e => e.orderId === orderId);
}

/**
 * Get ledger summary
 */
function getLedgerSummary(fromDate = null, toDate = null) {
  const db = loadDatabase();
  let entries = db.ledgerEntries || [];

  if (fromDate) {
    entries = entries.filter(e => new Date(e.createdAt) >= new Date(fromDate));
  }
  if (toDate) {
    entries = entries.filter(e => new Date(e.createdAt) <= new Date(toDate));
  }

  const summary = {};
  for (const type of Object.values(LEDGER_TYPES)) {
    const typeEntries = entries.filter(e => e.type === type);
    summary[type] = {
      count: typeEntries.length,
      total: typeEntries.reduce((sum, e) => sum + e.amount, 0)
    };
  }

  return summary;
}

/**
 * TICKET 014: Record manufacturer payment and realize profit when order ships
 */
function recordShippedProfit(orderId) {
  const db = loadDatabase();

  // Find the order
  const order = db.orders.find(o => o.id === orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Check if already recorded (avoid duplicates)
  const existingPaid = (db.ledgerEntries || []).find(
    e => e.orderId === orderId && e.type === LEDGER_TYPES.MANUFACTURER_PAID
  );
  if (existingPaid) {
    return { alreadyRecorded: true };
  }

  // Calculate manufacturer cost
  const manufacturerCost = order.items.reduce((sum, item) => {
    // Use price_snapshots if available
    const snap = item.price_snapshots?.manufacturer_price;
    if (snap?.cost) return sum + (snap.cost * item.quantity);
    return sum + (item.manufacturer_cost || (item.calculated_price || item.unit_price) * 0.6);
  }, 0);

  // Record manufacturer payment (converts payable to paid)
  const paidEntry = createEntry(
    LEDGER_TYPES.MANUFACTURER_PAID,
    orderId,
    -manufacturerCost, // Negative = money going out
    `Manufacturer payment for order ${order.order_number}`,
    {
      orderNumber: order.order_number,
      shippedAt: new Date().toISOString()
    }
  );

  // Calculate realized profit
  const customerPayment = order.pricing?.total || order.total || 0;
  const salesTax = order.pricing?.tax || 0;
  const profit = customerPayment - salesTax - manufacturerCost;

  return {
    entries: [paidEntry],
    profit: Math.round(profit * 100) / 100,
    manufacturerCost: Math.round(manufacturerCost * 100) / 100
  };
}

module.exports = {
  LEDGER_TYPES,
  createEntry,
  createOrderLedgerEntries,
  getEntriesForOrder,
  getLedgerSummary,
  recordShippedProfit
};
