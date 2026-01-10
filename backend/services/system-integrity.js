/**
 * SYSTEM INTEGRITY LAYER
 * Cross-portal validation and data consistency checks
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

/**
 * Validate pricing consistency across portals
 */
function validatePricingIntegrity() {
  const db = loadDatabase();
  const issues = [];

  // Check all manufacturer prices have valid margins
  const manufacturerPrices = db.manufacturerPrices || [];
  for (const price of manufacturerPrices) {
    if (!price.fabricCode) {
      issues.push({
        type: 'missing_fabric_code',
        severity: 'error',
        message: `Price entry missing fabric code`,
        data: price
      });
    }
    if (price.pricePerSqMeter === undefined || price.pricePerSqMeter <= 0) {
      issues.push({
        type: 'invalid_price',
        severity: 'warning',
        message: `Fabric ${price.fabricCode} has invalid price: ${price.pricePerSqMeter}`,
        data: { fabricCode: price.fabricCode, price: price.pricePerSqMeter }
      });
    }
    if (price.manualMargin === undefined) {
      issues.push({
        type: 'missing_margin',
        severity: 'warning',
        message: `Fabric ${price.fabricCode} missing manual margin, using default 40%`,
        data: { fabricCode: price.fabricCode }
      });
    }
  }

  // Check hardware options have valid prices
  const hardwareOptions = db.productContent?.hardwareOptions || {};
  for (const [category, options] of Object.entries(hardwareOptions)) {
    if (!Array.isArray(options)) continue;
    for (const option of options) {
      if (option.manufacturerCost === undefined && option.price > 0) {
        issues.push({
          type: 'missing_manufacturer_cost',
          severity: 'warning',
          message: `${category} option "${option.name || option.label}" has customer price but no manufacturer cost`,
          data: { category, option: option.name || option.label }
        });
      }
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    stats: {
      fabricPrices: manufacturerPrices.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length
    }
  };
}

/**
 * Validate order data integrity
 */
function validateOrderIntegrity(orderId = null) {
  const db = loadDatabase();
  const issues = [];
  const orders = orderId
    ? db.orders.filter(o => o.id === orderId || o.order_number === orderId)
    : db.orders || [];

  for (const order of orders) {
    // Check customer data
    if (!order.customer || !order.customer.email) {
      issues.push({
        type: 'missing_customer',
        severity: 'error',
        orderId: order.id,
        orderNumber: order.order_number,
        message: 'Order missing customer data'
      });
    }

    // Check items
    if (!order.items || order.items.length === 0) {
      issues.push({
        type: 'empty_order',
        severity: 'error',
        orderId: order.id,
        orderNumber: order.order_number,
        message: 'Order has no items'
      });
    }

    // Check pricing
    if (!order.pricing || order.pricing.total <= 0) {
      issues.push({
        type: 'invalid_total',
        severity: 'error',
        orderId: order.id,
        orderNumber: order.order_number,
        message: 'Order has invalid total'
      });
    }

    // Check price snapshots exist
    for (const item of (order.items || [])) {
      if (!item.price_snapshots && !item.calculated_price) {
        issues.push({
          type: 'missing_price_snapshot',
          severity: 'warning',
          orderId: order.id,
          orderNumber: order.order_number,
          message: `Item ${item.id} missing price snapshot`
        });
      }
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    stats: {
      ordersChecked: orders.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length
    }
  };
}

/**
 * Validate customer database integrity
 */
function validateCustomerIntegrity() {
  const db = loadDatabase();
  const issues = [];
  const customers = db.customers || [];

  // Check for duplicate emails
  const emailCounts = {};
  for (const customer of customers) {
    const email = customer.email?.toLowerCase();
    if (email) {
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    } else {
      issues.push({
        type: 'missing_email',
        severity: 'error',
        customerId: customer.id,
        message: 'Customer missing email'
      });
    }
  }

  for (const [email, count] of Object.entries(emailCounts)) {
    if (count > 1) {
      issues.push({
        type: 'duplicate_email',
        severity: 'warning',
        message: `Duplicate customer email: ${email} (${count} records)`
      });
    }
  }

  // Check orders match customer records
  const orders = db.orders || [];
  for (const order of orders) {
    const customerEmail = order.customer?.email?.toLowerCase();
    if (customerEmail) {
      const customerExists = customers.some(c => c.email?.toLowerCase() === customerEmail);
      if (!customerExists) {
        issues.push({
          type: 'orphan_order',
          severity: 'info',
          orderNumber: order.order_number,
          message: `Order customer not in customer database: ${customerEmail}`
        });
      }
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    stats: {
      customersChecked: customers.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length
    }
  };
}

/**
 * Run full system integrity check
 */
function runFullIntegrityCheck() {
  const pricing = validatePricingIntegrity();
  const orders = validateOrderIntegrity();
  const customers = validateCustomerIntegrity();

  return {
    timestamp: new Date().toISOString(),
    overall: {
      valid: pricing.valid && orders.valid && customers.valid,
      totalErrors: pricing.stats.errors + orders.stats.errors + customers.stats.errors,
      totalWarnings: pricing.stats.warnings + orders.stats.warnings + customers.stats.warnings
    },
    pricing,
    orders,
    customers
  };
}

module.exports = {
  validatePricingIntegrity,
  validateOrderIntegrity,
  validateCustomerIntegrity,
  runFullIntegrityCheck
};
