/**
 * DEALER SERVICE - Portal & Order Management
 * Ticket 007: Dealer Portal
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { auditLogger, AUDIT_ACTIONS } = require('./audit-logger');

const DB_PATH = path.join(__dirname, '../database.json');

// Dealer Tiers and Discounts
const DEALER_TIERS = {
  BRONZE: { name: 'bronze', minOrders: 0, discount: 15 },
  SILVER: { name: 'silver', minOrders: 11, discount: 20 },
  GOLD: { name: 'gold', minOrders: 51, discount: 25 }
};

// Dealer Order Statuses
const DEALER_ORDER_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Create dealer user account
 */
function createDealerUser(dealerId, userData) {
  const db = loadDatabase();

  if (!db.dealerUsers) db.dealerUsers = [];

  // Check dealer exists
  const dealer = (db.dealers || []).find(d => d.id === dealerId);
  if (!dealer) {
    throw new Error('Dealer not found');
  }

  // Check email not already used
  if (db.dealerUsers.find(u => u.email === userData.email)) {
    throw new Error('Email already registered');
  }

  const hashedPassword = bcrypt.hashSync(userData.password, 10);

  const user = {
    id: `dealer-user-${uuidv4().slice(0, 8)}`,
    dealerId,
    dealerName: dealer.companyName,
    name: userData.name,
    email: userData.email,
    password: hashedPassword,
    role: userData.role || 'staff', // staff, manager, admin
    status: 'active',
    lastLogin: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.dealerUsers.push(user);
  saveDatabase(db);

  // Return without password
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * Authenticate dealer user
 */
function authenticateDealer(email, password) {
  const db = loadDatabase();
  const users = db.dealerUsers || [];

  const user = users.find(u => u.email === email && u.status === 'active');
  if (!user) {
    return null;
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return null;
  }

  // Get dealer info
  const dealer = (db.dealers || []).find(d => d.id === user.dealerId);

  // Update last login
  const userIndex = users.findIndex(u => u.id === user.id);
  db.dealerUsers[userIndex].lastLogin = new Date().toISOString();
  saveDatabase(db);

  // Return without password, with dealer info
  const { password: pwd, ...safeUser } = user;
  return {
    ...safeUser,
    dealer: dealer ? {
      id: dealer.id,
      companyName: dealer.companyName,
      tier: dealer.tier,
      discountPercent: dealer.discountPercent,
      commissionRate: dealer.commissionRate
    } : null
  };
}

/**
 * Get dealer by ID
 */
function getDealer(dealerId) {
  const db = loadDatabase();
  return (db.dealers || []).find(d => d.id === dealerId);
}

/**
 * Get all dealers (for admin)
 */
function getDealers() {
  const db = loadDatabase();
  return db.dealers || [];
}

/**
 * Get dealer dashboard stats
 */
function getDealerStats(dealerId) {
  const db = loadDatabase();
  const orders = (db.dealerOrders || []).filter(o => o.dealerId === dealerId);
  const dealer = (db.dealers || []).find(d => d.id === dealerId);
  const customers = (db.dealerCustomers || []).filter(c => c.dealerId === dealerId);

  // Calculate monthly stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyOrders = orders.filter(o => new Date(o.createdAt) >= startOfMonth);
  const monthlyRevenue = monthlyOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const monthlyCommission = monthlyOrders.reduce((sum, o) => sum + (o.commission || 0), 0);

  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'processing').length,
    completedOrders: orders.filter(o => o.status === 'delivered').length,
    monthlyOrders: monthlyOrders.length,
    monthlyRevenue,
    monthlyCommission,
    totalRevenue: dealer?.totalRevenue || 0,
    totalCommission: orders.reduce((sum, o) => sum + (o.commission || 0), 0),
    customerCount: customers.length,
    tier: dealer?.tier || 'bronze',
    discountPercent: dealer?.discountPercent || 15
  };
}

/**
 * Get orders for dealer
 */
function getDealerOrders(dealerId, filters = {}) {
  const db = loadDatabase();
  let orders = (db.dealerOrders || []).filter(o => o.dealerId === dealerId);

  // Apply filters
  if (filters.status) {
    orders = orders.filter(o => o.status === filters.status);
  }
  if (filters.orderNumber) {
    orders = orders.filter(o =>
      o.orderNumber.toLowerCase().includes(filters.orderNumber.toLowerCase())
    );
  }
  if (filters.customerId) {
    orders = orders.filter(o => o.customerId === filters.customerId);
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    orders = orders.filter(o => new Date(o.createdAt) >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    orders = orders.filter(o => new Date(o.createdAt) <= end);
  }

  // Sort by date (newest first)
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return orders;
}

/**
 * Get single order details
 */
function getDealerOrderDetail(dealerId, orderId) {
  const db = loadDatabase();
  const order = (db.dealerOrders || []).find(
    o => o.dealerId === dealerId && (o.id === orderId || o.orderNumber === orderId)
  );

  if (!order) {
    return null;
  }

  // Get customer info
  const customer = (db.dealerCustomers || []).find(c => c.id === order.customerId);

  return {
    ...order,
    customer: customer || null
  };
}

/**
 * Create dealer order
 */
function createDealerOrder(dealerId, orderData, userId) {
  const db = loadDatabase();
  const dealer = (db.dealers || []).find(d => d.id === dealerId);

  if (!dealer) {
    throw new Error('Dealer not found');
  }

  if (!db.dealerOrders) db.dealerOrders = [];

  // Generate order number
  const orderCount = db.dealerOrders.length + 1;
  const orderNumber = `DLR-${String(orderCount).padStart(6, '0')}`;

  // Calculate totals with dealer discount
  const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = subtotal * (dealer.discountPercent / 100);
  const dealerPrice = subtotal - discountAmount;
  const commission = dealerPrice * (dealer.commissionRate || 0.10);

  const order = {
    id: uuidv4(),
    dealerId,
    orderNumber,
    customerId: orderData.customerId,
    customerName: orderData.customerName,
    customerEmail: orderData.customerEmail,
    customerAddress: orderData.customerAddress,
    items: orderData.items.map(item => ({
      id: uuidv4(),
      productId: item.productId,
      productName: item.productName,
      fabricCode: item.fabricCode,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      retailPrice: item.price,
      dealerPrice: item.price * (1 - dealer.discountPercent / 100),
      options: item.options || {}
    })),
    subtotal,
    discountPercent: dealer.discountPercent,
    discountAmount,
    total: dealerPrice,
    commission,
    status: orderData.status || 'pending',
    notes: orderData.notes || '',
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.dealerOrders.push(order);

  // Update dealer stats
  const dealerIndex = db.dealers.findIndex(d => d.id === dealerId);
  if (dealerIndex !== -1) {
    db.dealers[dealerIndex].totalOrders = (db.dealers[dealerIndex].totalOrders || 0) + 1;
    db.dealers[dealerIndex].totalRevenue = (db.dealers[dealerIndex].totalRevenue || 0) + dealerPrice;
    db.dealers[dealerIndex].monthlyOrderCount = (db.dealers[dealerIndex].monthlyOrderCount || 0) + 1;
    db.dealers[dealerIndex].updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ORDER_CREATE,
    userId,
    resourceType: 'dealer_order',
    resourceId: order.id,
    resourceName: order.orderNumber,
    newState: { status: order.status, total: order.total },
    metadata: { dealerId, source: 'dealer_portal' }
  });

  return order;
}

/**
 * Update dealer order status
 */
function updateDealerOrderStatus(dealerId, orderId, newStatus, userId, notes = '') {
  const db = loadDatabase();

  const orderIndex = (db.dealerOrders || []).findIndex(
    o => o.dealerId === dealerId && (o.id === orderId || o.orderNumber === orderId)
  );

  if (orderIndex === -1) {
    throw new Error('Order not found');
  }

  const order = db.dealerOrders[orderIndex];
  const previousStatus = order.status;

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();
  if (notes) {
    order.statusNotes = notes;
  }

  db.dealerOrders[orderIndex] = order;
  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ORDER_STATUS_CHANGE,
    userId,
    resourceType: 'dealer_order',
    resourceId: order.id,
    resourceName: order.orderNumber,
    previousState: { status: previousStatus },
    newState: { status: newStatus },
    metadata: { dealerId, notes, source: 'dealer_portal' }
  });

  return order;
}

/**
 * Get dealer customers
 */
function getDealerCustomers(dealerId, filters = {}) {
  const db = loadDatabase();
  let customers = (db.dealerCustomers || []).filter(c => c.dealerId === dealerId);

  if (filters.search) {
    const search = filters.search.toLowerCase();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.email.toLowerCase().includes(search)
    );
  }

  // Sort by name
  customers.sort((a, b) => a.name.localeCompare(b.name));

  return customers;
}

/**
 * Add dealer customer
 */
function addDealerCustomer(dealerId, customerData, userId) {
  const db = loadDatabase();

  if (!db.dealerCustomers) db.dealerCustomers = [];

  const customer = {
    id: `dc-${uuidv4().slice(0, 8)}`,
    dealerId,
    name: customerData.name,
    email: customerData.email,
    phone: customerData.phone || '',
    address: customerData.address || {},
    notes: customerData.notes || '',
    totalOrders: 0,
    totalSpent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.dealerCustomers.push(customer);
  saveDatabase(db);

  return customer;
}

/**
 * Update dealer customer
 */
function updateDealerCustomer(dealerId, customerId, customerData) {
  const db = loadDatabase();

  const customerIndex = (db.dealerCustomers || []).findIndex(
    c => c.dealerId === dealerId && c.id === customerId
  );

  if (customerIndex === -1) {
    throw new Error('Customer not found');
  }

  const customer = db.dealerCustomers[customerIndex];

  // Update fields
  if (customerData.name) customer.name = customerData.name;
  if (customerData.email) customer.email = customerData.email;
  if (customerData.phone !== undefined) customer.phone = customerData.phone;
  if (customerData.address) customer.address = customerData.address;
  if (customerData.notes !== undefined) customer.notes = customerData.notes;
  customer.updatedAt = new Date().toISOString();

  db.dealerCustomers[customerIndex] = customer;
  saveDatabase(db);

  return customer;
}

/**
 * Delete dealer customer
 */
function deleteDealerCustomer(dealerId, customerId) {
  const db = loadDatabase();

  const customerIndex = (db.dealerCustomers || []).findIndex(
    c => c.dealerId === dealerId && c.id === customerId
  );

  if (customerIndex === -1) {
    throw new Error('Customer not found');
  }

  // Check if customer has orders
  const hasOrders = (db.dealerOrders || []).some(o => o.customerId === customerId);
  if (hasOrders) {
    throw new Error('Cannot delete customer with existing orders');
  }

  db.dealerCustomers.splice(customerIndex, 1);
  saveDatabase(db);

  return { success: true };
}

/**
 * Get dealer commissions
 */
function getDealerCommissions(dealerId, dateRange = {}) {
  const db = loadDatabase();
  let orders = (db.dealerOrders || []).filter(o => o.dealerId === dealerId);

  // Filter by date range
  if (dateRange.startDate) {
    const start = new Date(dateRange.startDate);
    orders = orders.filter(o => new Date(o.createdAt) >= start);
  }
  if (dateRange.endDate) {
    const end = new Date(dateRange.endDate);
    orders = orders.filter(o => new Date(o.createdAt) <= end);
  }

  // Group by month
  const monthlyCommissions = {};
  orders.forEach(order => {
    const date = new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyCommissions[monthKey]) {
      monthlyCommissions[monthKey] = {
        month: monthKey,
        orderCount: 0,
        revenue: 0,
        commission: 0
      };
    }

    monthlyCommissions[monthKey].orderCount += 1;
    monthlyCommissions[monthKey].revenue += order.total || 0;
    monthlyCommissions[monthKey].commission += order.commission || 0;
  });

  // Convert to array and sort
  const commissions = Object.values(monthlyCommissions).sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  // Calculate totals
  const totalCommission = orders.reduce((sum, o) => sum + (o.commission || 0), 0);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return {
    orders: orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      total: o.total,
      commission: o.commission,
      status: o.status,
      createdAt: o.createdAt
    })),
    monthlyBreakdown: commissions,
    summary: {
      totalOrders: orders.length,
      totalRevenue,
      totalCommission,
      averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      averageCommission: orders.length > 0 ? totalCommission / orders.length : 0
    }
  };
}

/**
 * Get dealer pricing (products with dealer discount applied)
 */
function getDealerPricing(dealerId) {
  const db = loadDatabase();
  const dealer = (db.dealers || []).find(d => d.id === dealerId);

  if (!dealer) {
    throw new Error('Dealer not found');
  }

  const products = db.products || [];
  const fabrics = db.fabrics || [];

  return {
    tier: dealer.tier,
    discountPercent: dealer.discountPercent,
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      basePrice: p.basePrice,
      dealerPrice: p.basePrice * (1 - dealer.discountPercent / 100)
    })),
    fabrics: fabrics.slice(0, 50).map(f => ({
      id: f.id,
      code: f.code,
      name: f.name,
      pricePerSqMeter: f.pricePerSqMeter,
      dealerPricePerSqMeter: f.pricePerSqMeter * (1 - dealer.discountPercent / 100)
    }))
  };
}

/**
 * Update dealer tier based on order count
 */
function updateDealerTier(dealerId) {
  const db = loadDatabase();
  const dealerIndex = (db.dealers || []).findIndex(d => d.id === dealerId);

  if (dealerIndex === -1) {
    return null;
  }

  const dealer = db.dealers[dealerIndex];
  const monthlyOrders = dealer.monthlyOrderCount || 0;

  let newTier = 'bronze';
  let newDiscount = 15;

  if (monthlyOrders >= DEALER_TIERS.GOLD.minOrders) {
    newTier = 'gold';
    newDiscount = DEALER_TIERS.GOLD.discount;
  } else if (monthlyOrders >= DEALER_TIERS.SILVER.minOrders) {
    newTier = 'silver';
    newDiscount = DEALER_TIERS.SILVER.discount;
  }

  if (dealer.tier !== newTier) {
    db.dealers[dealerIndex].tier = newTier;
    db.dealers[dealerIndex].discountPercent = newDiscount;
    db.dealers[dealerIndex].updatedAt = new Date().toISOString();
    saveDatabase(db);
  }

  return db.dealers[dealerIndex];
}

/**
 * Create new dealer (admin function)
 */
function createDealer(dealerData, userId) {
  const db = loadDatabase();

  if (!db.dealers) db.dealers = [];

  // Check email not already used
  if (db.dealers.find(d => d.email === dealerData.email)) {
    throw new Error('Email already registered');
  }

  const dealer = {
    id: `dealer-${uuidv4().slice(0, 8)}`,
    companyName: dealerData.companyName,
    contactName: dealerData.contactName,
    email: dealerData.email,
    phone: dealerData.phone || '',
    address: dealerData.address || {},
    tier: 'bronze',
    discountPercent: DEALER_TIERS.BRONZE.discount,
    commissionRate: dealerData.commissionRate || 0.10,
    status: 'active',
    monthlyOrderCount: 0,
    totalOrders: 0,
    totalRevenue: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.dealers.push(dealer);
  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ENTITY_CREATE,
    userId,
    resourceType: 'dealer',
    resourceId: dealer.id,
    resourceName: dealer.companyName,
    newState: dealer,
    metadata: { source: 'admin_portal' }
  });

  return dealer;
}

/**
 * Update dealer (admin function)
 */
function updateDealer(dealerId, dealerData, userId) {
  const db = loadDatabase();
  const dealerIndex = (db.dealers || []).findIndex(d => d.id === dealerId);

  if (dealerIndex === -1) {
    throw new Error('Dealer not found');
  }

  const dealer = db.dealers[dealerIndex];
  const previousState = { ...dealer };

  // Update fields
  if (dealerData.companyName) dealer.companyName = dealerData.companyName;
  if (dealerData.contactName) dealer.contactName = dealerData.contactName;
  if (dealerData.email) dealer.email = dealerData.email;
  if (dealerData.phone !== undefined) dealer.phone = dealerData.phone;
  if (dealerData.address) dealer.address = dealerData.address;
  if (dealerData.tier) {
    dealer.tier = dealerData.tier;
    dealer.discountPercent = DEALER_TIERS[dealerData.tier.toUpperCase()]?.discount || dealer.discountPercent;
  }
  if (dealerData.commissionRate !== undefined) dealer.commissionRate = dealerData.commissionRate;
  if (dealerData.status) dealer.status = dealerData.status;
  dealer.updatedAt = new Date().toISOString();

  db.dealers[dealerIndex] = dealer;
  saveDatabase(db);

  // Audit log
  auditLogger.log({
    action: AUDIT_ACTIONS.ENTITY_UPDATE,
    userId,
    resourceType: 'dealer',
    resourceId: dealer.id,
    resourceName: dealer.companyName,
    previousState,
    newState: dealer,
    metadata: { source: 'admin_portal' }
  });

  return dealer;
}

module.exports = {
  DEALER_TIERS,
  DEALER_ORDER_STATUSES,
  createDealerUser,
  authenticateDealer,
  getDealer,
  getDealers,
  getDealerStats,
  getDealerOrders,
  getDealerOrderDetail,
  createDealerOrder,
  updateDealerOrderStatus,
  getDealerCustomers,
  addDealerCustomer,
  updateDealerCustomer,
  deleteDealerCustomer,
  getDealerCommissions,
  getDealerPricing,
  updateDealerTier,
  createDealer,
  updateDealer
};
