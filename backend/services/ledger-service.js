/**
 * LEDGER SERVICE - Accounting Entries
 * Ticket 002: Cart + Fake Checkout + Orders + AuditLog
 * Updated: Proper manufacturer cost calculation from price_snapshot
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * Calculate total manufacturer cost for an item from price snapshots
 * Handles both price_snapshot (singular) and price_snapshots (plural)
 * Includes: Fabric MFR + Options MFR + Accessories MFR
 */
function calculateItemManufacturerCost(item) {
  const qty = item.quantity || 1;

  // Try to get snapshot (prefer plural, fallback to singular)
  const snapshot = item.price_snapshots || item.price_snapshot;
  if (!snapshot) {
    // Fallback to manufacturer_cost field or 60% estimate
    return (item.manufacturer_cost || (item.calculated_price || item.unit_price || 0) * 0.6) * qty;
  }

  // 1. Fabric/Base MFR Cost
  const mfrPrice = snapshot.manufacturer_price;
  const fabricMfr = mfrPrice?.unit_cost || mfrPrice?.cost || 0;

  // 2. Options MFR Cost (per unit)
  const optionsCost = (snapshot.customer_price?.options_breakdown || [])
    .reduce((sum, opt) => sum + (opt.manufacturerCost || 0), 0);

  // 3. Accessories MFR Cost (per order, NOT multiplied by qty)
  const accessoriesCost = (snapshot.customer_price?.accessories_breakdown || [])
    .reduce((sum, acc) => sum + (acc.manufacturerCost || 0), 0);

  // Total = (Fabric + Options) * Quantity + Accessories
  return ((fabricMfr + optionsCost) * qty) + accessoriesCost;
}

/**
 * Calculate total margin/profit for an item
 */
function calculateItemMargin(item) {
  const customerPrice = item.line_total || (item.unit_price * (item.quantity || 1)) || item.calculated_price || 0;
  const mfrCost = calculateItemManufacturerCost(item);
  return customerPrice - mfrCost;
}

// Ledger Entry Types
const LEDGER_TYPES = {
  CUSTOMER_PAYMENT: 'customer_payment_received',
  SALES_TAX: 'sales_tax_collected',
  SHIPPING_CHARGED: 'shipping_charged',
  MANUFACTURER_PAYABLE: 'manufacturer_payable',
  MANUFACTURER_PAID: 'manufacturer_paid',
  MARGIN_EARNED: 'margin_earned',
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

  // Manufacturer payable (calculate from items using price snapshots)
  const manufacturerCost = order.items.reduce((sum, item) => {
    return sum + calculateItemManufacturerCost(item);
  }, 0);

  // Calculate margin/profit
  const subtotal = order.subtotal || order.pricing?.subtotal ||
    order.items.reduce((sum, item) => sum + (item.line_total || item.calculated_price || 0), 0);
  const margin = subtotal - manufacturerCost;

  entries.push(createEntry(
    LEDGER_TYPES.MANUFACTURER_PAYABLE,
    order.id,
    -manufacturerCost, // Negative = liability
    `Manufacturer cost for order ${order.order_number}`,
    {
      orderNumber: order.order_number,
      manufacturerCost: Math.round(manufacturerCost * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent: subtotal > 0 ? Math.round((margin / subtotal * 100) * 100) / 100 : 0
    }
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

  // Calculate manufacturer cost using helper
  const manufacturerCost = order.items.reduce((sum, item) => {
    return sum + calculateItemManufacturerCost(item);
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

/**
 * Backfill missing manufacturer cost and margin data for all orders
 * Also creates missing ledger entries
 */
function backfillOrderPricingAndLedger() {
  const db = loadDatabase();
  const results = { ordersUpdated: 0, ledgerEntriesCreated: 0, errors: [] };

  if (!db.orders) return results;
  if (!db.ledgerEntries) db.ledgerEntries = [];

  for (const order of db.orders) {
    try {
      // Calculate manufacturer cost and margin from items
      const manufacturerCostTotal = order.items.reduce((sum, item) => {
        return sum + calculateItemManufacturerCost(item);
      }, 0);

      const subtotal = order.subtotal || order.pricing?.subtotal ||
        order.items.reduce((sum, item) => sum + (item.line_total || item.calculated_price || 0), 0);
      const marginTotal = subtotal - manufacturerCostTotal;
      const marginPercent = subtotal > 0 ? (marginTotal / subtotal * 100) : 0;

      // Update order pricing if missing
      if (!order.pricing) order.pricing = {};
      if (order.pricing.manufacturer_cost_total === undefined) {
        order.pricing.manufacturer_cost_total = Math.round(manufacturerCostTotal * 100) / 100;
        order.pricing.margin_total = Math.round(marginTotal * 100) / 100;
        order.pricing.margin_percent = Math.round(marginPercent * 100) / 100;
        results.ordersUpdated++;
      }

      // Check for missing ledger entries
      const existingEntries = db.ledgerEntries.filter(e => e.orderId === order.id);
      const hasPayment = existingEntries.some(e => e.type === LEDGER_TYPES.CUSTOMER_PAYMENT);
      const hasMfrPayable = existingEntries.some(e => e.type === LEDGER_TYPES.MANUFACTURER_PAYABLE);
      const hasMargin = existingEntries.some(e => e.type === LEDGER_TYPES.MARGIN_EARNED);

      // Create missing customer payment entry
      if (!hasPayment) {
        const total = order.pricing?.total || order.total || 0;
        if (total > 0) {
          db.ledgerEntries.push({
            id: `ledger-backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: LEDGER_TYPES.CUSTOMER_PAYMENT,
            orderId: order.id,
            orderNumber: order.order_number,
            amount: Math.round(total * 100) / 100,
            description: `Payment for order ${order.order_number}`,
            debit: null,
            credit: Math.round(total * 100) / 100,
            createdAt: order.created_at || new Date().toISOString(),
            metadata: { backfilled: true }
          });
          results.ledgerEntriesCreated++;
        }
      }

      // Create missing manufacturer payable entry
      if (!hasMfrPayable && manufacturerCostTotal > 0) {
        db.ledgerEntries.push({
          id: `ledger-backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: LEDGER_TYPES.MANUFACTURER_PAYABLE,
          orderId: order.id,
          orderNumber: order.order_number,
          amount: -Math.round(manufacturerCostTotal * 100) / 100,
          description: `Manufacturer cost for order ${order.order_number}`,
          debit: Math.round(manufacturerCostTotal * 100) / 100,
          credit: null,
          createdAt: order.created_at || new Date().toISOString(),
          metadata: {
            backfilled: true,
            manufacturerCost: Math.round(manufacturerCostTotal * 100) / 100,
            margin: Math.round(marginTotal * 100) / 100,
            marginPercent: Math.round(marginPercent * 100) / 100
          }
        });
        results.ledgerEntriesCreated++;
      }

      // Create margin earned entry
      if (!hasMargin && marginTotal > 0) {
        db.ledgerEntries.push({
          id: `ledger-backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: LEDGER_TYPES.MARGIN_EARNED,
          orderId: order.id,
          orderNumber: order.order_number,
          amount: Math.round(marginTotal * 100) / 100,
          description: `Margin/profit for order ${order.order_number}`,
          debit: null,
          credit: Math.round(marginTotal * 100) / 100,
          createdAt: order.created_at || new Date().toISOString(),
          metadata: {
            backfilled: true,
            subtotal: Math.round(subtotal * 100) / 100,
            manufacturerCost: Math.round(manufacturerCostTotal * 100) / 100,
            marginPercent: Math.round(marginPercent * 100) / 100
          }
        });
        results.ledgerEntriesCreated++;
      }

    } catch (err) {
      results.errors.push({ orderId: order.id, orderNumber: order.order_number, error: err.message });
    }
  }

  saveDatabase(db);
  return results;
}

module.exports = {
  LEDGER_TYPES,
  createEntry,
  createOrderLedgerEntries,
  getEntriesForOrder,
  getLedgerSummary,
  recordShippedProfit,
  backfillOrderPricingAndLedger,
  calculateItemManufacturerCost,
  calculateItemMargin
};
