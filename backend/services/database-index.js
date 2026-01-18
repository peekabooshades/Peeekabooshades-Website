/**
 * Database Indexing Service
 * Provides in-memory indexes for fast lookups on JSON file database
 * TICKET-011: Performance optimization for JSON database
 */

class DatabaseIndex {
  constructor() {
    this.indexes = {};
    this.lastRebuild = null;
    this.rebuildCount = 0;
  }

  /**
   * Build index for a collection on specified field(s)
   * @param {string} collection - Collection name (e.g., 'orders')
   * @param {string} field - Field to index (e.g., 'id', 'order_number')
   * @param {Array} data - Array of records
   */
  buildIndex(collection, field, data) {
    const indexKey = `${collection}.${field}`;
    this.indexes[indexKey] = new Map();

    if (!data || !Array.isArray(data)) {
      console.log(`Index ${indexKey}: No data to index`);
      return;
    }

    data.forEach((record, arrayIndex) => {
      const value = this.getNestedValue(record, field);
      if (value !== undefined && value !== null) {
        // Store both the record and its array index for fast updates
        this.indexes[indexKey].set(value, { record, arrayIndex });
      }
    });

    console.log(`Index ${indexKey}: ${this.indexes[indexKey].size} entries`);
  }

  /**
   * Build composite index for multiple fields
   * @param {string} collection - Collection name
   * @param {Array<string>} fields - Fields to combine
   * @param {Array} data - Array of records
   */
  buildCompositeIndex(collection, fields, data) {
    const indexKey = `${collection}.${fields.join('+')}`;
    this.indexes[indexKey] = new Map();

    if (!data || !Array.isArray(data)) {
      return;
    }

    data.forEach((record, arrayIndex) => {
      const keyParts = fields.map(f => this.getNestedValue(record, f));
      if (keyParts.every(v => v !== undefined && v !== null)) {
        const compositeKey = keyParts.join('|');
        this.indexes[indexKey].set(compositeKey, { record, arrayIndex });
      }
    });

    console.log(`Composite Index ${indexKey}: ${this.indexes[indexKey].size} entries`);
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) =>
      current && current[key] !== undefined ? current[key] : undefined, obj);
  }

  /**
   * Fast lookup by indexed field
   * @param {string} collection - Collection name
   * @param {string} field - Field name
   * @param {any} value - Value to find
   * @returns {Object|null} Record or null
   */
  findOne(collection, field, value) {
    const indexKey = `${collection}.${field}`;
    const index = this.indexes[indexKey];

    if (!index) {
      console.warn(`No index for ${indexKey}, falling back to linear scan`);
      return null;
    }

    const result = index.get(value);
    return result ? result.record : null;
  }

  /**
   * Find multiple records by field value (for non-unique indexes)
   * @param {string} collection - Collection name
   * @param {string} field - Field name
   * @param {any} value - Value to find
   * @returns {Array} Matching records
   */
  findMany(collection, field, value) {
    const indexKey = `${collection}.${field}`;
    const index = this.indexes[indexKey];

    if (!index) {
      return [];
    }

    const results = [];
    index.forEach((entry, key) => {
      if (key === value) {
        results.push(entry.record);
      }
    });
    return results;
  }

  /**
   * Rebuild all indexes from database
   * @param {Object} db - Database object
   */
  rebuildAll(db) {
    const startTime = Date.now();
    console.log('\n========================================');
    console.log('Building Database Indexes...');
    console.log('========================================');

    // Clear existing indexes
    this.indexes = {};

    // Orders indexes
    this.buildIndex('orders', 'id', db.orders);
    this.buildIndex('orders', 'order_number', db.orders);
    this.buildIndex('orders', 'status', db.orders);
    this.buildIndex('orders', 'customer.email', db.orders);

    // Invoices indexes
    this.buildIndex('invoices', 'id', db.invoices);
    this.buildIndex('invoices', 'invoiceNumber', db.invoices);
    this.buildIndex('invoices', 'orderId', db.invoices);
    this.buildIndex('invoices', 'type', db.invoices);

    // Customers indexes
    this.buildIndex('customers', 'id', db.customers);
    this.buildIndex('customers', 'email', db.customers);

    // Products indexes
    this.buildIndex('products', 'id', db.products);
    this.buildIndex('products', 'slug', db.products);

    // Manufacturer prices indexes (single table for all product types)
    this.buildIndex('manufacturerPrices', 'fabricCode', db.manufacturerPrices);

    // Admin users index
    this.buildIndex('adminUsers', 'email', db.adminUsers);

    // Manufacturer users index
    this.buildIndex('manufacturerUsers', 'email', db.manufacturerUsers);

    // Dealer users index
    this.buildIndex('dealerUsers', 'email', db.dealerUsers);

    this.lastRebuild = new Date();
    this.rebuildCount++;

    const duration = Date.now() - startTime;
    console.log(`========================================`);
    console.log(`Index build complete in ${duration}ms`);
    console.log(`Total indexes: ${Object.keys(this.indexes).length}`);
    console.log(`========================================\n`);
  }

  /**
   * Update index when record is added/modified
   * @param {string} collection - Collection name
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @param {Object} record - Record object
   * @param {number} arrayIndex - Array index
   */
  updateIndex(collection, field, value, record, arrayIndex) {
    const indexKey = `${collection}.${field}`;
    const index = this.indexes[indexKey];

    if (index && value !== undefined && value !== null) {
      index.set(value, { record, arrayIndex });
    }
  }

  /**
   * Remove from index when record is deleted
   * @param {string} collection - Collection name
   * @param {string} field - Field name
   * @param {any} value - Field value to remove
   */
  removeFromIndex(collection, field, value) {
    const indexKey = `${collection}.${field}`;
    const index = this.indexes[indexKey];

    if (index) {
      index.delete(value);
    }
  }

  /**
   * Get index statistics
   */
  getStats() {
    const stats = {
      totalIndexes: Object.keys(this.indexes).length,
      lastRebuild: this.lastRebuild,
      rebuildCount: this.rebuildCount,
      indexes: {}
    };

    Object.entries(this.indexes).forEach(([key, index]) => {
      stats.indexes[key] = index.size;
    });

    return stats;
  }
}

// Singleton instance
const dbIndex = new DatabaseIndex();

module.exports = dbIndex;
