/**
 * PEEKABOO SHADES - MANUFACTURER ASSIGNMENT SERVICE
 * ==================================================
 *
 * Handles automatic and manual assignment of orders to manufacturers.
 * One manufacturer per order based on product types.
 */

const { loadDB, saveDB } = require('./db-loader');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Load database
 */
function loadDatabase() {
  try {
    return loadDB();
  } catch (error) {
    console.error('Error loading database:', error);
    return null;
  }
}

/**
 * Save database
 */
function saveDatabase(db) {
  try {
    saveDB(db);
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

// ============================================
// MANUFACTURER LOOKUP
// ============================================

/**
 * Get all active manufacturers
 */
function getActiveManufacturers() {
  const db = loadDatabase();
  if (!db) return [];

  return (db.manufacturers || []).filter(m => m.status === 'active');
}

/**
 * Get manufacturer by ID
 */
function getManufacturerById(manufacturerId) {
  const db = loadDatabase();
  if (!db) return null;

  return (db.manufacturers || []).find(m => m.id === manufacturerId);
}

/**
 * Find manufacturers that can handle a specific product type
 * @param {string} productType - Product type (roller, zebra, honeycomb, roman)
 * @returns {Array} List of manufacturers sorted by assignment priority
 */
function findManufacturersForProductType(productType) {
  const db = loadDatabase();
  if (!db) return [];

  const manufacturers = (db.manufacturers || [])
    .filter(m =>
      m.status === 'active' &&
      m.productTypes &&
      (m.productTypes.includes(productType) || m.productTypes.includes('all'))
    )
    .sort((a, b) => (a.assignmentPriority || 999) - (b.assignmentPriority || 999));

  return manufacturers;
}

/**
 * Find manufacturers that have pricing for a specific product type
 * @param {string} productType - Product type
 * @returns {Array} List of manufacturers with pricing data
 */
function findManufacturersWithPricing(productType) {
  const db = loadDatabase();
  if (!db) return [];

  const manufacturersWithPricing = new Set();

  // Check manufacturerPrices for fabric pricing
  (db.manufacturerPrices || []).forEach(price => {
    if (price.productType === productType && price.status === 'active') {
      manufacturersWithPricing.add(price.manufacturerId);
    }
  });

  // Return only active manufacturers that have pricing
  return (db.manufacturers || [])
    .filter(m =>
      m.status === 'active' &&
      manufacturersWithPricing.has(m.id)
    )
    .sort((a, b) => (a.assignmentPriority || 999) - (b.assignmentPriority || 999));
}

// ============================================
// ORDER ANALYSIS
// ============================================

/**
 * Extract product types from order items
 * @param {Object} order - Order object
 * @returns {Array} Unique product types in the order
 */
function extractProductTypesFromOrder(order) {
  const productTypes = new Set();

  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(item => {
      if (item.productType) {
        productTypes.add(item.productType.toLowerCase());
      } else if (item.productSlug) {
        // Infer product type from slug
        const slug = item.productSlug.toLowerCase();
        if (slug.includes('roller')) productTypes.add('roller');
        else if (slug.includes('zebra')) productTypes.add('zebra');
        else if (slug.includes('honeycomb') || slug.includes('cellular')) productTypes.add('honeycomb');
        else if (slug.includes('roman')) productTypes.add('roman');
      }
    });
  }

  return Array.from(productTypes);
}

/**
 * Find the best manufacturer for an order
 * Priority:
 * 1. Manufacturer with pricing for ALL product types in order
 * 2. Manufacturer with lowest assignment priority that handles all types
 * 3. First manufacturer that can handle at least one product type
 *
 * @param {Object} order - Order object
 * @returns {Object|null} Best manufacturer or null if none found
 */
function findBestManufacturerForOrder(order) {
  const productTypes = extractProductTypesFromOrder(order);

  if (productTypes.length === 0) {
    console.log('No product types found in order');
    return null;
  }

  const db = loadDatabase();
  if (!db) return null;

  const activeManufacturers = (db.manufacturers || []).filter(m => m.status === 'active');

  if (activeManufacturers.length === 0) {
    console.log('No active manufacturers found');
    return null;
  }

  // Score each manufacturer
  const scoredManufacturers = activeManufacturers.map(mfr => {
    let score = 0;
    let canHandleAllTypes = true;
    let hasPricingForAllTypes = true;

    productTypes.forEach(pt => {
      // Check if manufacturer handles this product type
      if (mfr.productTypes && (mfr.productTypes.includes(pt) || mfr.productTypes.includes('all'))) {
        score += 10;
      } else {
        canHandleAllTypes = false;
      }

      // Check if manufacturer has pricing for this product type
      const hasPricing = (db.manufacturerPrices || []).some(
        p => p.manufacturerId === mfr.id && p.productType === pt && p.status === 'active'
      );
      if (hasPricing) {
        score += 20;
      } else {
        hasPricingForAllTypes = false;
      }
    });

    // Bonus for handling all types
    if (canHandleAllTypes) score += 50;
    if (hasPricingForAllTypes) score += 100;

    // Priority adjustment (lower priority number = higher score)
    score -= (mfr.assignmentPriority || 100);

    return {
      manufacturer: mfr,
      score,
      canHandleAllTypes,
      hasPricingForAllTypes
    };
  });

  // Sort by score (highest first)
  scoredManufacturers.sort((a, b) => b.score - a.score);

  // Return the best match
  if (scoredManufacturers.length > 0 && scoredManufacturers[0].score > 0) {
    return scoredManufacturers[0].manufacturer;
  }

  // Fallback: return first active manufacturer
  return activeManufacturers[0] || null;
}

// ============================================
// ORDER ASSIGNMENT
// ============================================

/**
 * Auto-assign a manufacturer to an order
 * @param {string} orderId - Order ID
 * @returns {Object} Assignment result
 */
function autoAssignManufacturer(orderId) {
  const db = loadDatabase();
  if (!db) {
    return { success: false, error: 'Failed to load database' };
  }

  const orderIndex = (db.orders || []).findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { success: false, error: 'Order not found' };
  }

  const order = db.orders[orderIndex];

  // Check if already assigned
  if (order.manufacturerId) {
    return {
      success: true,
      alreadyAssigned: true,
      manufacturerId: order.manufacturerId,
      message: 'Order already has a manufacturer assigned'
    };
  }

  // Find best manufacturer
  const manufacturer = findBestManufacturerForOrder(order);

  if (!manufacturer) {
    return {
      success: false,
      error: 'No suitable manufacturer found for order product types'
    };
  }

  // Assign manufacturer
  const now = new Date().toISOString();
  db.orders[orderIndex].manufacturerId = manufacturer.id;
  db.orders[orderIndex].manufacturerName = manufacturer.name;
  db.orders[orderIndex].manufacturerAssignedAt = now;
  db.orders[orderIndex].manufacturerAssignedBy = 'system';
  db.orders[orderIndex].manufacturerAssignmentMethod = 'auto';
  db.orders[orderIndex].updatedAt = now;

  if (!saveDatabase(db)) {
    return { success: false, error: 'Failed to save assignment' };
  }

  return {
    success: true,
    manufacturerId: manufacturer.id,
    manufacturerName: manufacturer.name,
    assignmentMethod: 'auto',
    productTypes: extractProductTypesFromOrder(order)
  };
}

/**
 * Manually assign a manufacturer to an order
 * @param {string} orderId - Order ID
 * @param {string} manufacturerId - Manufacturer ID to assign
 * @param {string} assignedBy - User ID who made the assignment
 * @returns {Object} Assignment result
 */
function manualAssignManufacturer(orderId, manufacturerId, assignedBy) {
  const db = loadDatabase();
  if (!db) {
    return { success: false, error: 'Failed to load database' };
  }

  const orderIndex = (db.orders || []).findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { success: false, error: 'Order not found' };
  }

  const manufacturer = (db.manufacturers || []).find(m => m.id === manufacturerId);
  if (!manufacturer) {
    return { success: false, error: 'Manufacturer not found' };
  }

  if (manufacturer.status !== 'active') {
    return { success: false, error: 'Manufacturer is not active' };
  }

  const order = db.orders[orderIndex];
  const previousManufacturerId = order.manufacturerId;

  // Assign manufacturer
  const now = new Date().toISOString();
  db.orders[orderIndex].manufacturerId = manufacturer.id;
  db.orders[orderIndex].manufacturerName = manufacturer.name;
  db.orders[orderIndex].manufacturerAssignedAt = now;
  db.orders[orderIndex].manufacturerAssignedBy = assignedBy;
  db.orders[orderIndex].manufacturerAssignmentMethod = 'manual';
  db.orders[orderIndex].updatedAt = now;

  if (!saveDatabase(db)) {
    return { success: false, error: 'Failed to save assignment' };
  }

  return {
    success: true,
    manufacturerId: manufacturer.id,
    manufacturerName: manufacturer.name,
    assignmentMethod: 'manual',
    previousManufacturerId,
    productTypes: extractProductTypesFromOrder(order)
  };
}

/**
 * Unassign manufacturer from an order
 * @param {string} orderId - Order ID
 * @param {string} unassignedBy - User ID who made the unassignment
 * @returns {Object} Result
 */
function unassignManufacturer(orderId, unassignedBy) {
  const db = loadDatabase();
  if (!db) {
    return { success: false, error: 'Failed to load database' };
  }

  const orderIndex = (db.orders || []).findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    return { success: false, error: 'Order not found' };
  }

  const previousManufacturerId = db.orders[orderIndex].manufacturerId;

  // Remove assignment
  const now = new Date().toISOString();
  db.orders[orderIndex].manufacturerId = null;
  db.orders[orderIndex].manufacturerName = null;
  db.orders[orderIndex].manufacturerAssignedAt = null;
  db.orders[orderIndex].manufacturerAssignedBy = null;
  db.orders[orderIndex].manufacturerAssignmentMethod = null;
  db.orders[orderIndex].updatedAt = now;

  if (!saveDatabase(db)) {
    return { success: false, error: 'Failed to save changes' };
  }

  return {
    success: true,
    previousManufacturerId,
    message: 'Manufacturer unassigned from order'
  };
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Get all unassigned orders
 * @returns {Array} List of orders without manufacturer assignment
 */
function getUnassignedOrders() {
  const db = loadDatabase();
  if (!db) return [];

  return (db.orders || []).filter(o =>
    !o.manufacturerId &&
    o.status !== 'cancelled' &&
    o.status !== 'refunded'
  );
}

/**
 * Get orders assigned to a specific manufacturer
 * @param {string} manufacturerId - Manufacturer ID
 * @param {Object} filters - Optional filters { status, dateFrom, dateTo }
 * @returns {Array} List of orders
 */
function getOrdersByManufacturer(manufacturerId, filters = {}) {
  const db = loadDatabase();
  if (!db) return [];

  let orders = (db.orders || []).filter(o => o.manufacturerId === manufacturerId);

  if (filters.status) {
    orders = orders.filter(o => o.status === filters.status);
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    orders = orders.filter(o => new Date(o.createdAt) >= from);
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    orders = orders.filter(o => new Date(o.createdAt) <= to);
  }

  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Auto-assign manufacturers to all unassigned orders
 * @returns {Object} Summary of assignments
 */
function autoAssignAllUnassignedOrders() {
  const unassignedOrders = getUnassignedOrders();
  const results = {
    total: unassignedOrders.length,
    assigned: 0,
    failed: 0,
    assignments: []
  };

  unassignedOrders.forEach(order => {
    const result = autoAssignManufacturer(order.id);
    if (result.success && !result.alreadyAssigned) {
      results.assigned++;
      results.assignments.push({
        orderId: order.id,
        orderNumber: order.order_number,
        manufacturerId: result.manufacturerId,
        manufacturerName: result.manufacturerName
      });
    } else {
      results.failed++;
    }
  });

  return results;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get assignment statistics
 * @returns {Object} Statistics
 */
function getAssignmentStats() {
  const db = loadDatabase();
  if (!db) return null;

  const orders = db.orders || [];
  const manufacturers = db.manufacturers || [];

  const stats = {
    totalOrders: orders.length,
    assignedOrders: 0,
    unassignedOrders: 0,
    autoAssigned: 0,
    manuallyAssigned: 0,
    byManufacturer: {}
  };

  orders.forEach(order => {
    if (order.manufacturerId) {
      stats.assignedOrders++;
      if (order.manufacturerAssignmentMethod === 'auto') {
        stats.autoAssigned++;
      } else {
        stats.manuallyAssigned++;
      }

      // Count by manufacturer
      const mfrName = order.manufacturerName || order.manufacturerId;
      if (!stats.byManufacturer[mfrName]) {
        stats.byManufacturer[mfrName] = { total: 0, pending: 0, completed: 0 };
      }
      stats.byManufacturer[mfrName].total++;
      if (order.status === 'delivered' || order.status === 'closed') {
        stats.byManufacturer[mfrName].completed++;
      } else if (order.status !== 'cancelled' && order.status !== 'refunded') {
        stats.byManufacturer[mfrName].pending++;
      }
    } else {
      stats.unassignedOrders++;
    }
  });

  return stats;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Lookup
  getActiveManufacturers,
  getManufacturerById,
  findManufacturersForProductType,
  findManufacturersWithPricing,

  // Order Analysis
  extractProductTypesFromOrder,
  findBestManufacturerForOrder,

  // Assignment
  autoAssignManufacturer,
  manualAssignManufacturer,
  unassignManufacturer,

  // Bulk Operations
  getUnassignedOrders,
  getOrdersByManufacturer,
  autoAssignAllUnassignedOrders,

  // Statistics
  getAssignmentStats
};
