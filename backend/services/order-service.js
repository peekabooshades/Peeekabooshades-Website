/**
 * ORDER SERVICE - State Machine + Audit Integration
 * Ticket 002: Cart + Fake Checkout + Orders + AuditLog
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { auditLogger, AUDIT_ACTIONS } = require('./audit-logger');

const DB_PATH = path.join(__dirname, '../database.json');

// Order Status State Machine (per business requirements)
const ORDER_STATES = {
  DRAFT: 'draft',
  CART: 'cart',
  ORDER_PLACED: 'order_placed',
  ORDER_RECEIVED: 'order_received',      // Payment confirmed
  MANUFACTURING: 'manufacturing',         // In production
  QA: 'qa',                               // Quality assurance
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  ISSUE_REPORTED: 'issue_reported',
  REFUND_REQUESTED: 'refund_requested',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled'
};

// Valid transitions (immutable state machine)
const VALID_TRANSITIONS = {
  [ORDER_STATES.DRAFT]: [ORDER_STATES.CART, ORDER_STATES.CANCELLED],
  [ORDER_STATES.CART]: [ORDER_STATES.ORDER_PLACED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.ORDER_PLACED]: [ORDER_STATES.ORDER_RECEIVED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.ORDER_RECEIVED]: [ORDER_STATES.MANUFACTURING, ORDER_STATES.REFUND_REQUESTED],
  [ORDER_STATES.MANUFACTURING]: [ORDER_STATES.QA, ORDER_STATES.ISSUE_REPORTED],
  [ORDER_STATES.QA]: [ORDER_STATES.SHIPPED, ORDER_STATES.MANUFACTURING, ORDER_STATES.ISSUE_REPORTED],
  [ORDER_STATES.SHIPPED]: [ORDER_STATES.DELIVERED, ORDER_STATES.ISSUE_REPORTED],
  [ORDER_STATES.DELIVERED]: [ORDER_STATES.ISSUE_REPORTED, ORDER_STATES.REFUND_REQUESTED],
  [ORDER_STATES.ISSUE_REPORTED]: [ORDER_STATES.REFUND_REQUESTED, ORDER_STATES.MANUFACTURING, ORDER_STATES.CANCELLED],
  [ORDER_STATES.REFUND_REQUESTED]: [ORDER_STATES.REFUNDED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.REFUNDED]: [],
  [ORDER_STATES.CANCELLED]: []
};

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Calculate price based on area (inches to sq meters)
 */
function calculateAreaPrice(widthInches, heightInches, pricePerSqMeter, minAreaSqMeter = 1.2) {
  const widthMeters = widthInches * 0.0254;
  const heightMeters = heightInches * 0.0254;
  let areaSqMeters = widthMeters * heightMeters;

  // Apply minimum area
  if (areaSqMeters < minAreaSqMeter) {
    areaSqMeters = minAreaSqMeter;
  }

  return areaSqMeters * pricePerSqMeter;
}

/**
 * Validate state transition
 */
function canTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Create order from cart (checkout)
 */
function createOrderFromCart(sessionId, customerInfo, paymentInfo, userId = 'system') {
  const db = loadDatabase();

  // Get cart items
  const cartItems = (db.cart || []).filter(item => item.session_id === sessionId);
  if (cartItems.length === 0) {
    throw new Error('Cart is empty');
  }

  // Validate cart items have prices (line_total from cart or calculated_price)
  for (const item of cartItems) {
    const price = item.line_total || item.calculated_price || item.unit_price;
    if (!price || price <= 0) {
      throw new Error(`Invalid price for item ${item.id}`);
    }
    // Normalize to calculated_price for order
    item.calculated_price = price;
  }

  const orderId = uuidv4();
  const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
  const now = new Date().toISOString();

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.calculated_price * (item.quantity || 1)), 0);
  const taxRate = 0.0725; // CA default
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const shippingCost = subtotal >= 499 ? 0 : 14.99;
  const total = Math.round((subtotal + tax + shippingCost) * 100) / 100;

  // Build item snapshots with pricing details
  const itemsWithSnapshots = cartItems.map(item => {
    // Get manufacturer price from database if available
    const fabricCode = item.price_breakdown?.fabricCode || item.fabricCode;
    const manufacturerPrice = (db.manufacturerPrices || []).find(mp => mp.fabricCode === fabricCode);

    // Calculate manufacturer cost (60% of customer price as default)
    const customerPrice = item.calculated_price;
    const manufacturerCost = manufacturerPrice?.pricePerSqMeter
      ? calculateAreaPrice(item.width, item.height, manufacturerPrice.pricePerSqMeter, manufacturerPrice.minAreaSqMeter)
      : customerPrice * 0.6;

    // Calculate margin
    const margin = customerPrice - manufacturerCost;
    const marginPercent = customerPrice > 0 ? (margin / customerPrice * 100).toFixed(2) : 0;

    return {
      ...item,
      order_id: orderId,
      snapshot_at: now,
      // Price snapshots (immutable record of pricing at order time)
      price_snapshots: {
        manufacturer_price: {
          cost: Math.round(manufacturerCost * 100) / 100,
          fabricCode: fabricCode || null,
          source: manufacturerPrice ? 'database' : 'calculated',
          captured_at: now
        },
        margin: {
          amount: Math.round(margin * 100) / 100,
          percent: parseFloat(marginPercent),
          captured_at: now
        },
        customer_price: {
          unit_price: item.unit_price || item.calculated_price,
          line_total: item.calculated_price * (item.quantity || 1),
          captured_at: now
        }
      }
    };
  });

  // Calculate total manufacturer cost for order
  const totalManufacturerCost = itemsWithSnapshots.reduce((sum, item) =>
    sum + (item.price_snapshots.manufacturer_price.cost * (item.quantity || 1)), 0);
  const totalMargin = subtotal - totalManufacturerCost;

  // Create order with full snapshots
  const order = {
    id: orderId,
    order_number: orderNumber,
    status: ORDER_STATES.ORDER_PLACED,
    customer: {
      name: customerInfo.name,
      email: customerInfo.email,
      phone: customerInfo.phone || null,
      address: customerInfo.address || null
    },
    items: itemsWithSnapshots,
    pricing: {
      subtotal,
      tax,
      tax_rate: taxRate,
      shipping: shippingCost,
      total,
      currency: 'USD',
      // Order-level price snapshots
      manufacturer_cost_total: Math.round(totalManufacturerCost * 100) / 100,
      margin_total: Math.round(totalMargin * 100) / 100,
      margin_percent: subtotal > 0 ? parseFloat((totalMargin / subtotal * 100).toFixed(2)) : 0
    },
    payment: {
      method: paymentInfo.method || 'fake_checkout',
      status: 'pending',
      masked_card: paymentInfo.cardLast4 ? `****${paymentInfo.cardLast4}` : null,
      transaction_id: null
    },
    created_at: now,
    updated_at: now,
    placed_at: now
  };

  // Initialize collections if needed
  if (!db.orders) db.orders = [];
  if (!db.orderStatusHistory) db.orderStatusHistory = [];

  // Save order
  db.orders.push(order);

  // Record initial status in history
  db.orderStatusHistory.push({
    id: uuidv4(),
    orderId: orderId,
    orderNumber: orderNumber,
    fromStatus: null,
    toStatus: ORDER_STATES.ORDER_PLACED,
    changedBy: userId,
    changedAt: now,
    reason: 'Order created via checkout',
    diff: null
  });

  // Clear cart
  db.cart = (db.cart || []).filter(item => item.session_id !== sessionId);

  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ORDER_CREATE,
    userId,
    resourceType: 'order',
    resourceId: orderId,
    resourceName: orderNumber,
    newState: { orderNumber, total, itemCount: cartItems.length }
  });

  return order;
}

/**
 * Transition order status with audit
 */
function transitionOrderStatus(orderId, newStatus, userId, reason = '') {
  const db = loadDatabase();

  const orderIndex = db.orders.findIndex(o => o.id === orderId || o.order_number === orderId);
  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const order = db.orders[orderIndex];
  const previousStatus = order.status;

  // Validate transition
  if (!canTransition(previousStatus, newStatus)) {
    throw new Error(`Invalid transition from ${previousStatus} to ${newStatus}`);
  }

  const now = new Date().toISOString();

  // Update order
  order.status = newStatus;
  order.updated_at = now;

  // Add status-specific timestamps
  if (newStatus === ORDER_STATES.ORDER_RECEIVED) {
    order.payment.status = 'completed';
    order.payment.paid_at = now;
  } else if (newStatus === ORDER_STATES.SHIPPED) {
    order.shipped_at = now;
  } else if (newStatus === ORDER_STATES.DELIVERED) {
    order.delivered_at = now;
  } else if (newStatus === ORDER_STATES.REFUNDED) {
    order.refunded_at = now;
  }

  // Record in status history
  if (!db.orderStatusHistory) db.orderStatusHistory = [];
  db.orderStatusHistory.push({
    id: uuidv4(),
    orderId: order.id,
    orderNumber: order.order_number,
    fromStatus: previousStatus,
    toStatus: newStatus,
    changedBy: userId,
    changedAt: now,
    reason: reason
  });

  db.orders[orderIndex] = order;
  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGE,
    userId,
    resourceType: 'order',
    resourceId: order.id,
    resourceName: order.order_number,
    previousState: { status: previousStatus },
    newState: { status: newStatus },
    metadata: { reason }
  });

  return order;
}

/**
 * Simulate fake payment (for PAYMENT_MODE=fake)
 */
function simulateFakePayment(orderId, userId = 'system') {
  return transitionOrderStatus(orderId, ORDER_STATES.ORDER_RECEIVED, userId, 'Payment received - fake checkout');
}

/**
 * Get order with status history
 */
function getOrderWithHistory(orderId) {
  const db = loadDatabase();
  const order = db.orders.find(o => o.id === orderId || o.order_number === orderId);
  if (!order) return null;

  const history = (db.orderStatusHistory || [])
    .filter(h => h.orderId === order.id)
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

  return { ...order, statusHistory: history };
}

module.exports = {
  ORDER_STATES,
  VALID_TRANSITIONS,
  canTransition,
  createOrderFromCart,
  transitionOrderStatus,
  simulateFakePayment,
  getOrderWithHistory
};
