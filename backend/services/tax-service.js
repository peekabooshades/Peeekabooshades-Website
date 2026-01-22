/**
 * PEEKABOO SHADES - TAX CALCULATION SERVICE
 * ==========================================
 * Handles sales tax calculation by state/region
 */

const { loadDB, saveDB } = require('./db-loader');

// US State tax rates (2024 averages - should be updated periodically)
const STATE_TAX_RATES = {
  'AL': 0.04, 'AK': 0.00, 'AZ': 0.056, 'AR': 0.065, 'CA': 0.0725,
  'CO': 0.029, 'CT': 0.0635, 'DE': 0.00, 'FL': 0.06, 'GA': 0.04,
  'HI': 0.04, 'ID': 0.06, 'IL': 0.0625, 'IN': 0.07, 'IA': 0.06,
  'KS': 0.065, 'KY': 0.06, 'LA': 0.0445, 'ME': 0.055, 'MD': 0.06,
  'MA': 0.0625, 'MI': 0.06, 'MN': 0.06875, 'MS': 0.07, 'MO': 0.04225,
  'MT': 0.00, 'NE': 0.055, 'NV': 0.0685, 'NH': 0.00, 'NJ': 0.06625,
  'NM': 0.05125, 'NY': 0.04, 'NC': 0.0475, 'ND': 0.05, 'OH': 0.0575,
  'OK': 0.045, 'OR': 0.00, 'PA': 0.06, 'RI': 0.07, 'SC': 0.06,
  'SD': 0.045, 'TN': 0.07, 'TX': 0.0625, 'UT': 0.061, 'VT': 0.06,
  'VA': 0.053, 'WA': 0.065, 'WV': 0.06, 'WI': 0.05, 'WY': 0.04,
  'DC': 0.06, 'PR': 0.115
};

// States with no sales tax
const TAX_FREE_STATES = ['AK', 'DE', 'MT', 'NH', 'OR'];

class TaxService {
  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    try {
      const db = loadDB();
      this.config = db.systemConfig?.tax || {};
      this.customRates = this.config.rates || {};
      this.nexusStates = this.config.nexusStates || Object.keys(STATE_TAX_RATES);
      this.enabled = this.config.enabled !== false;
    } catch (err) {
      console.error('Error loading tax config:', err);
      this.config = {};
      this.customRates = {};
      this.nexusStates = Object.keys(STATE_TAX_RATES);
      this.enabled = true;
    }
  }

  /**
   * Get tax rate for a state
   */
  getTaxRate(stateCode) {
    if (!this.enabled) return 0;
    if (!stateCode) return 0;

    const state = stateCode.toUpperCase().trim();

    // Check if we have nexus in this state
    if (!this.nexusStates.includes(state)) {
      return 0;
    }

    // Check custom rates first
    if (this.customRates[state] !== undefined) {
      return this.customRates[state];
    }

    // Fall back to default state rates
    return STATE_TAX_RATES[state] || 0;
  }

  /**
   * Calculate tax for an order
   */
  calculateTax(subtotal, shippingAddress) {
    if (!this.enabled || !subtotal || subtotal <= 0) {
      return {
        taxRate: 0,
        taxAmount: 0,
        taxable: false,
        state: null,
        breakdown: []
      };
    }

    const state = this.extractState(shippingAddress);
    if (!state) {
      return {
        taxRate: 0,
        taxAmount: 0,
        taxable: false,
        state: null,
        breakdown: []
      };
    }

    const taxRate = this.getTaxRate(state);
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;

    return {
      taxRate,
      taxAmount,
      taxable: taxRate > 0,
      state,
      breakdown: taxRate > 0 ? [{
        jurisdiction: state,
        rate: taxRate,
        amount: taxAmount,
        type: 'state'
      }] : []
    };
  }

  /**
   * Extract state from address object or string
   */
  extractState(address) {
    if (!address) return null;

    if (typeof address === 'string') {
      // Try to find state code in string
      const stateMatch = address.match(/\b([A-Z]{2})\b/);
      return stateMatch ? stateMatch[1] : null;
    }

    // Object with state property
    return address.state || address.stateCode || address.region || null;
  }

  /**
   * Check if address is in a tax-free state
   */
  isTaxFree(stateCode) {
    return TAX_FREE_STATES.includes(stateCode?.toUpperCase());
  }

  /**
   * Check if customer is tax exempt
   */
  isExempt(customerId) {
    try {
      const db = loadDB();
      const exemptions = db.taxExemptions || [];
      const exemption = exemptions.find(e =>
        e.customerId === customerId &&
        e.status === 'active' &&
        (!e.expiresAt || new Date(e.expiresAt) > new Date())
      );
      return !!exemption;
    } catch (err) {
      return false;
    }
  }

  /**
   * Calculate order total with tax
   */
  calculateOrderTotal(subtotal, shipping, shippingAddress, customerId = null) {
    // Check for tax exemption
    if (customerId && this.isExempt(customerId)) {
      return {
        subtotal,
        shipping: shipping || 0,
        tax: 0,
        taxRate: 0,
        total: subtotal + (shipping || 0),
        taxExempt: true,
        state: this.extractState(shippingAddress)
      };
    }

    const taxResult = this.calculateTax(subtotal, shippingAddress);

    // Some states tax shipping, some don't - defaulting to not taxing shipping
    const taxableAmount = subtotal;
    const taxAmount = Math.round(taxableAmount * taxResult.taxRate * 100) / 100;

    return {
      subtotal,
      shipping: shipping || 0,
      tax: taxAmount,
      taxRate: taxResult.taxRate,
      total: subtotal + (shipping || 0) + taxAmount,
      taxExempt: false,
      state: taxResult.state,
      taxBreakdown: taxResult.breakdown
    };
  }

  /**
   * Get all configured tax rates
   */
  getAllRates() {
    const rates = {};
    for (const state of this.nexusStates) {
      rates[state] = this.customRates[state] ?? STATE_TAX_RATES[state] ?? 0;
    }
    return rates;
  }

  /**
   * Update tax rate for a state
   */
  updateRate(stateCode, rate) {
    const db = loadDB();
    if (!db.systemConfig) db.systemConfig = {};
    if (!db.systemConfig.tax) db.systemConfig.tax = {};
    if (!db.systemConfig.tax.rates) db.systemConfig.tax.rates = {};

    db.systemConfig.tax.rates[stateCode.toUpperCase()] = rate;
    saveDB(db);

    this.loadConfig();
    return { success: true, state: stateCode, rate };
  }

  /**
   * Add tax exemption for customer
   */
  addExemption(customerId, exemptionData) {
    const db = loadDB();
    if (!db.taxExemptions) db.taxExemptions = [];

    const exemption = {
      id: `tex-${Date.now()}`,
      customerId,
      certificateNumber: exemptionData.certificateNumber,
      reason: exemptionData.reason || 'resale',
      state: exemptionData.state,
      status: 'active',
      expiresAt: exemptionData.expiresAt || null,
      createdAt: new Date().toISOString()
    };

    db.taxExemptions.push(exemption);
    saveDB(db);

    return exemption;
  }

  /**
   * Get tax report by state
   */
  getTaxReport(startDate, endDate) {
    const db = loadDB();
    const orders = db.orders || [];

    const report = {};

    orders.forEach(order => {
      if (!order.createdAt) return;
      const orderDate = new Date(order.createdAt);
      if (startDate && orderDate < new Date(startDate)) return;
      if (endDate && orderDate > new Date(endDate)) return;

      const state = order.shippingAddress?.state || 'Unknown';
      if (!report[state]) {
        report[state] = {
          state,
          orderCount: 0,
          totalSales: 0,
          taxCollected: 0
        };
      }

      report[state].orderCount++;
      report[state].totalSales += order.subtotal || 0;
      report[state].taxCollected += order.tax || 0;
    });

    return Object.values(report).sort((a, b) => b.taxCollected - a.taxCollected);
  }
}

const taxService = new TaxService();

module.exports = {
  taxService,
  TaxService,
  STATE_TAX_RATES,
  TAX_FREE_STATES
};
