/**
 * PEEKABOO SHADES - SYSTEM CONFIGURATION
 * =======================================
 *
 * CORE PRINCIPLE: Admin Dashboard is the ONLY authority.
 * All configuration is loaded from database, managed via admin.
 * This file provides the loading mechanism and defaults.
 */

const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '../database.json');

/**
 * Default System Configuration
 * These are ONLY used when database doesn't have values set.
 * Admin can override ALL of these.
 */
const DEFAULT_CONFIG = {
  // Pricing Configuration
  pricing: {
    // Base multiplier for dimension-based pricing
    dimensionMultiplier: {
      baseSquareInches: 864,  // 24" x 36" = standard window
      minimumMultiplier: 1.0,
      maximumMultiplier: 10.0
    },
    // Warranty pricing
    warranty: {
      extended: {
        price: 15.00,
        duration: '5 years',
        enabled: true
      },
      standard: {
        price: 0,
        duration: '2 years',
        enabled: true
      }
    },
    // Currency settings
    currency: {
      code: 'USD',
      symbol: '$',
      decimalPlaces: 2
    }
  },

  // Tax Configuration
  tax: {
    enabled: true,
    defaultRate: 0.08,  // 8%
    calculationType: 'percentage', // 'percentage' or 'fixed'
    includedInPrice: false,
    // Tax rules by state/region (admin configurable)
    rules: [
      { region: 'CA', rate: 0.0725, name: 'California Sales Tax' },
      { region: 'NY', rate: 0.08, name: 'New York Sales Tax' },
      { region: 'TX', rate: 0.0625, name: 'Texas Sales Tax' },
      { region: 'FL', rate: 0.06, name: 'Florida Sales Tax' },
      { region: 'default', rate: 0.08, name: 'Default Tax' }
    ]
  },

  // Shipping Configuration
  shipping: {
    freeShippingThreshold: 499.00,
    defaultRate: 9.99,
    calculationType: 'threshold', // 'flat', 'threshold', 'weight', 'zone'
    zones: [
      {
        id: 'domestic',
        name: 'Continental US',
        countries: ['US'],
        excludeStates: ['AK', 'HI'],
        rates: [
          { maxWeight: 5, price: 9.99 },
          { maxWeight: 20, price: 14.99 },
          { maxWeight: 50, price: 24.99 },
          { maxWeight: Infinity, price: 39.99 }
        ]
      },
      {
        id: 'alaska-hawaii',
        name: 'Alaska & Hawaii',
        countries: ['US'],
        includeStates: ['AK', 'HI'],
        rates: [
          { maxWeight: 5, price: 19.99 },
          { maxWeight: 20, price: 34.99 },
          { maxWeight: Infinity, price: 59.99 }
        ]
      }
    ],
    carriers: [
      { id: 'standard', name: 'Standard Shipping', days: '5-7 business days' },
      { id: 'express', name: 'Express Shipping', days: '2-3 business days', surcharge: 15.00 },
      { id: 'overnight', name: 'Overnight', days: '1 business day', surcharge: 35.00 }
    ]
  },

  // Product Configuration Rules
  products: {
    dimensions: {
      width: { min: 12, max: 144, unit: 'inches' },
      height: { min: 12, max: 120, unit: 'inches' }
    },
    quantity: {
      min: 1,
      max: 100
    }
  },

  // Business Rules
  businessRules: {
    // Minimum order value
    minimumOrderValue: 0,
    // Maximum order value (for fraud prevention)
    maximumOrderValue: 50000,
    // Lead time for custom products
    leadTimeDays: 7,
    // Rush order available
    rushOrderEnabled: true,
    rushOrderSurcharge: 50.00
  },

  // Security Settings
  security: {
    sessionTimeout: 240, // minutes
    maxLoginAttempts: 5,
    lockoutDuration: 30, // minutes
    requireTwoFactor: false,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: false
    }
  }
};

/**
 * SystemConfig Class
 * Manages loading and caching of system configuration from admin database
 */
class SystemConfig {
  constructor() {
    this.cache = null;
    this.cacheTime = 0;
    this.CACHE_TTL = 30000; // 30 seconds cache
  }

  /**
   * Load configuration from database with admin overrides
   */
  loadConfig() {
    const now = Date.now();
    if (this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      const dbData = fs.readFileSync(DB_PATH, 'utf8');
      const db = JSON.parse(dbData);

      // Merge admin configuration with defaults
      const config = this.mergeConfig(DEFAULT_CONFIG, db.systemConfig || {});

      this.cache = config;
      this.cacheTime = now;

      return config;
    } catch (error) {
      console.error('Error loading system config:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Deep merge configuration objects
   */
  mergeConfig(defaults, overrides) {
    const result = { ...defaults };

    for (const key in overrides) {
      if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
        result[key] = this.mergeConfig(defaults[key] || {}, overrides[key]);
      } else if (overrides[key] !== undefined) {
        result[key] = overrides[key];
      }
    }

    return result;
  }

  /**
   * Invalidate cache (called after admin updates)
   */
  invalidateCache() {
    this.cache = null;
    this.cacheTime = 0;
  }

  /**
   * Get specific config section
   */
  get(section) {
    const config = this.loadConfig();
    return section ? config[section] : config;
  }

  /**
   * Get pricing config
   */
  getPricing() {
    return this.get('pricing');
  }

  /**
   * Get tax config
   */
  getTax() {
    return this.get('tax');
  }

  /**
   * Get shipping config
   */
  getShipping() {
    return this.get('shipping');
  }

  /**
   * Get product rules
   */
  getProductRules() {
    return this.get('products');
  }

  /**
   * Get business rules
   */
  getBusinessRules() {
    return this.get('businessRules');
  }

  /**
   * Get security config
   */
  getSecurity() {
    return this.get('security');
  }
}

// Singleton instance
const systemConfig = new SystemConfig();

module.exports = {
  systemConfig,
  DEFAULT_CONFIG
};
