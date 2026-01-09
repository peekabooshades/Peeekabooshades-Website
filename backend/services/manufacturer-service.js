/**
 * MANUFACTURER SERVICE - Portal & Order Management
 * Ticket 004: Manufacturer Portal
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { auditLogger, AUDIT_ACTIONS } = require('./audit-logger');

const DB_PATH = path.join(__dirname, '../database.json');

// Manufacturer Order Statuses (subset of order states they can manage)
const MFR_ORDER_STATUSES = {
  PENDING: 'order_received',       // Ready to start manufacturing
  IN_PRODUCTION: 'manufacturing',  // In production
  QA: 'qa',                        // Quality assurance
  SHIPPED: 'shipped'
};

// Valid manufacturer status transitions
const MFR_VALID_TRANSITIONS = {
  'order_received': ['manufacturing'],
  'manufacturing': ['qa'],
  'qa': ['shipped', 'manufacturing'],
  'shipped': []
};

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Create manufacturer user account
 */
function createManufacturerUser(manufacturerId, userData) {
  const db = loadDatabase();

  if (!db.manufacturerUsers) db.manufacturerUsers = [];

  // Check manufacturer exists
  const manufacturer = (db.manufacturers || []).find(m => m.id === manufacturerId);
  if (!manufacturer) {
    throw new Error('Manufacturer not found');
  }

  // Check email not already used
  if (db.manufacturerUsers.find(u => u.email === userData.email)) {
    throw new Error('Email already registered');
  }

  const hashedPassword = bcrypt.hashSync(userData.password, 10);

  const user = {
    id: `mfr-user-${uuidv4().slice(0, 8)}`,
    manufacturerId,
    manufacturerName: manufacturer.name,
    name: userData.name,
    email: userData.email,
    password: hashedPassword,
    role: userData.role || 'operator', // operator, manager, admin
    status: 'active',
    lastLogin: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.manufacturerUsers.push(user);
  saveDatabase(db);

  // Return without password
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * Authenticate manufacturer user
 */
function authenticateManufacturer(email, password) {
  const db = loadDatabase();
  const users = db.manufacturerUsers || [];

  const user = users.find(u => u.email === email && u.status === 'active');
  if (!user) {
    return null;
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return null;
  }

  // Update last login
  const userIndex = users.findIndex(u => u.id === user.id);
  db.manufacturerUsers[userIndex].lastLogin = new Date().toISOString();
  saveDatabase(db);

  // Return without password
  const { password: pwd, ...safeUser } = user;
  return safeUser;
}

/**
 * Get orders for manufacturer
 */
function getManufacturerOrders(manufacturerId, filters = {}) {
  const db = loadDatabase();
  let orders = db.orders || [];

  // Filter by manufacturer (for now, all orders go to default manufacturer)
  // In future, orders will have manufacturerId field
  orders = orders.filter(o => {
    // Include orders in manufacturer-relevant statuses
    const mfrStatuses = Object.values(MFR_ORDER_STATUSES);
    return mfrStatuses.includes(o.status);
  });

  // Apply filters
  if (filters.status) {
    orders = orders.filter(o => o.status === filters.status);
  }
  if (filters.orderNumber) {
    orders = orders.filter(o =>
      o.order_number.toLowerCase().includes(filters.orderNumber.toLowerCase())
    );
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    orders = orders.filter(o => new Date(o.created_at) >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    orders = orders.filter(o => new Date(o.created_at) <= end);
  }

  // Sort by date (newest first)
  orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return orders.map(o => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    customer: o.customer?.name || o.customer_name || 'N/A',
    itemCount: o.items?.length || 0,
    items: o.items?.map(item => ({
      productName: item.product_name,
      fabricCode: item.price_breakdown?.fabricCode || 'N/A',
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      options: item.configuration
    })),
    createdAt: o.created_at,
    placedAt: o.placed_at,
    shippingAddress: o.customer?.address || o.shipping_address
  }));
}

/**
 * Get single order details for manufacturer
 */
function getManufacturerOrderDetail(manufacturerId, orderId) {
  const db = loadDatabase();
  const order = db.orders.find(o => o.id === orderId || o.order_number === orderId);

  if (!order) {
    return null;
  }

  // Get status history
  const statusHistory = (db.orderStatusHistory || [])
    .filter(h => h.orderId === order.id)
    .sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

  // Get manufacturer invoice for this order
  const mfrInvoice = (db.invoices || []).find(
    inv => inv.orderId === order.id && inv.type === 'manufacturer'
  );

  // Get customer invoice for reference
  const customerInvoice = (db.invoices || []).find(
    inv => inv.orderId === order.id && inv.type === 'customer'
  );

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    customer: {
      name: order.customer?.name || order.customer_name,
      email: order.customer?.email || order.customer_email,
      phone: order.customer?.phone || order.customer_phone,
      address: order.customer?.address || order.shipping_address
    },
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    shipping_address: order.shipping_address,
    // Invoice information
    manufacturerInvoice: mfrInvoice ? {
      invoiceNumber: mfrInvoice.invoiceNumber,
      total: mfrInvoice.total,
      status: mfrInvoice.status
    } : null,
    customerInvoice: customerInvoice ? {
      invoiceNumber: customerInvoice.invoiceNumber,
      total: customerInvoice.total
    } : null,
    // Order totals
    pricing: {
      subtotal: order.pricing?.subtotal || 0,
      tax: order.pricing?.tax || 0,
      total: order.pricing?.total || 0,
      manufacturerCost: order.pricing?.manufacturer_cost_total || 0
    },
    items: order.items?.map(item => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      fabricCode: item.price_breakdown?.fabricCode || 'N/A',
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      configuration: item.configuration,
      roomLabel: item.room_label,
      room_label: item.room_label,
      notes: item.notes,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      price_breakdown: item.price_breakdown,
      price_snapshot: item.price_snapshot || item.price_snapshots,
      price_snapshots: item.price_snapshot || item.price_snapshots
    })),
    statusHistory,
    trackingInfo: order.tracking_info,
    notes: order.notes,
    createdAt: order.created_at,
    placedAt: order.placed_at,
    paymentReceivedAt: order.payment?.paid_at
  };
}

/**
 * Update order status (manufacturer action)
 */
function updateOrderStatus(manufacturerId, orderId, newStatus, userId, notes = '') {
  const db = loadDatabase();

  const orderIndex = db.orders.findIndex(o => o.id === orderId || o.order_number === orderId);
  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const order = db.orders[orderIndex];
  const previousStatus = order.status;

  // Validate transition is allowed for manufacturer
  const allowedTransitions = MFR_VALID_TRANSITIONS[previousStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Cannot transition from ${previousStatus} to ${newStatus}`);
  }

  const now = new Date().toISOString();

  // Update order
  order.status = newStatus;
  order.updated_at = now;

  // Add status-specific data
  if (newStatus === MFR_ORDER_STATUSES.IN_PRODUCTION) {
    order.production_started_at = now;
  } else if (newStatus === MFR_ORDER_STATUSES.QA) {
    order.qa_started_at = now;
  } else if (newStatus === MFR_ORDER_STATUSES.SHIPPED) {
    order.shipped_at = now;
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
    changedByType: 'manufacturer',
    changedAt: now,
    reason: notes || `Manufacturer status update`,
    manufacturerId
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
    metadata: { manufacturerId, notes, source: 'manufacturer_portal' }
  });

  return order;
}

/**
 * Add tracking info to order
 */
function addTrackingInfo(manufacturerId, orderId, trackingData, userId) {
  const db = loadDatabase();

  const orderIndex = db.orders.findIndex(o => o.id === orderId || o.order_number === orderId);
  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const order = db.orders[orderIndex];
  const now = new Date().toISOString();

  // Add shipping info
  if (!order.shipping) order.shipping = {};
  order.shipping.carrier = trackingData.carrier;
  order.shipping.trackingNumber = trackingData.trackingNumber;
  order.shipping.trackingUrl = trackingData.trackingUrl || null;
  order.shipping.estimatedDelivery = trackingData.estimatedDelivery || null;
  order.shipping.updatedAt = now;
  order.shipping.updatedBy = userId;

  order.updated_at = now;

  db.orders[orderIndex] = order;
  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ORDER_UPDATE,
    userId,
    resourceType: 'order',
    resourceId: order.id,
    resourceName: order.order_number,
    newState: { shipping: order.shipping },
    metadata: { manufacturerId, source: 'manufacturer_portal' }
  });

  return order;
}

/**
 * Get manufacturer dashboard stats
 */
function getManufacturerStats(manufacturerId) {
  const db = loadDatabase();
  const orders = db.orders || [];

  const mfrOrders = orders.filter(o => {
    const mfrStatuses = Object.values(MFR_ORDER_STATUSES);
    return mfrStatuses.includes(o.status);
  });

  return {
    pending: mfrOrders.filter(o => o.status === MFR_ORDER_STATUSES.PENDING).length,
    inProduction: mfrOrders.filter(o => o.status === MFR_ORDER_STATUSES.IN_PRODUCTION).length,
    inQA: mfrOrders.filter(o => o.status === MFR_ORDER_STATUSES.QA).length,
    shipped: mfrOrders.filter(o => o.status === MFR_ORDER_STATUSES.SHIPPED).length,
    totalActive: mfrOrders.filter(o => o.status !== MFR_ORDER_STATUSES.SHIPPED).length
  };
}

/**
 * Get all manufacturers
 */
function getManufacturers() {
  const db = loadDatabase();
  return db.manufacturers || [];
}

/**
 * Get manufacturer by ID
 */
function getManufacturer(manufacturerId) {
  const db = loadDatabase();
  return (db.manufacturers || []).find(m => m.id === manufacturerId);
}

module.exports = {
  MFR_ORDER_STATUSES,
  MFR_VALID_TRANSITIONS,
  createManufacturerUser,
  authenticateManufacturer,
  getManufacturerOrders,
  getManufacturerOrderDetail,
  updateOrderStatus,
  addTrackingInfo,
  getManufacturerStats,
  getManufacturers,
  getManufacturer
};
