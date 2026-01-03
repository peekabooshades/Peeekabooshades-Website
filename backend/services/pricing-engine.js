/**
 * PEEKABOO SHADES - CENTRALIZED PRICING ENGINE
 * =============================================
 *
 * CORE PRINCIPLE: ALL pricing calculations happen HERE.
 * Frontend NEVER calculates prices - only displays what server provides.
 *
 * This engine is the SINGLE SOURCE OF TRUTH for:
 * - Product pricing
 * - Dimension-based pricing
 * - Option/variant pricing
 * - Tax calculation
 * - Shipping calculation
 * - Discount application
 * - Total order calculation
 */

const fs = require('fs');
const path = require('path');
const { systemConfig } = require('../config/system-config');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * PricingEngine Class
 * Handles all pricing calculations server-side
 */
class PricingEngine {

  /**
   * Load database
   */
  loadDatabase() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading database:', error);
      return null;
    }
  }

  /**
   * Calculate product price based on dimensions and options
   * @param {Object} params - Pricing parameters
   * @returns {Object} - Calculated price breakdown
   */
  calculateProductPrice(params) {
    const {
      productId,
      width,
      height,
      quantity = 1,
      options = {},
      extendedWarranty = false
    } = params;

    const db = this.loadDatabase();
    if (!db) {
      throw new Error('Database unavailable');
    }

    const product = db.products.find(p => p.id === productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.is_active) {
      throw new Error('Product is not available');
    }

    const pricingConfig = systemConfig.getPricing();
    const productRules = systemConfig.getProductRules();

    // Validate dimensions
    const validatedWidth = this.validateDimension(width, 'width', productRules.dimensions);
    const validatedHeight = this.validateDimension(height, 'height', productRules.dimensions);
    const validatedQty = this.validateQuantity(quantity, productRules.quantity);

    // Calculate base price with dimension multiplier
    const basePrice = this.calculateDimensionPrice(
      product.base_price,
      validatedWidth,
      validatedHeight,
      pricingConfig.dimensionMultiplier
    );

    // Calculate option prices
    const optionPrice = this.calculateOptionPrices(options, db);

    // Calculate warranty
    const warrantyPrice = extendedWarranty ? pricingConfig.warranty.extended.price : 0;

    // Unit price (before quantity)
    const unitPrice = basePrice + optionPrice + warrantyPrice;

    // Total for this line item
    const lineTotal = unitPrice * validatedQty;

    return {
      success: true,
      breakdown: {
        productId: product.id,
        productName: product.name,
        basePrice: this.round(product.base_price),
        dimensionAdjustedPrice: this.round(basePrice),
        width: validatedWidth,
        height: validatedHeight,
        quantity: validatedQty,
        optionPrice: this.round(optionPrice),
        warrantyPrice: this.round(warrantyPrice),
        unitPrice: this.round(unitPrice),
        lineTotal: this.round(lineTotal)
      },
      pricing: {
        unitPrice: this.round(unitPrice),
        totalPrice: this.round(lineTotal)
      }
    };
  }

  /**
   * Calculate dimension-based price adjustment
   */
  calculateDimensionPrice(basePrice, width, height, config) {
    const squareInches = width * height;
    const baseSquareInches = config.baseSquareInches || 864;

    let multiplier = squareInches / baseSquareInches;

    // Apply min/max bounds
    multiplier = Math.max(config.minimumMultiplier || 1.0, multiplier);
    multiplier = Math.min(config.maximumMultiplier || 10.0, multiplier);

    return basePrice * multiplier;
  }

  /**
   * Calculate option/variant prices
   */
  calculateOptionPrices(options, db) {
    let totalOptionPrice = 0;

    // Fabric pricing
    if (options.fabricCode) {
      const fabric = this.findFabric(options.fabricCode, db);
      if (fabric && fabric.priceAdjustment) {
        totalOptionPrice += fabric.priceAdjustment;
      }
    }

    // Hardware pricing
    if (options.hardware) {
      for (const [category, selection] of Object.entries(options.hardware)) {
        const hardwareOption = this.findHardwareOption(category, selection, db);
        if (hardwareOption && hardwareOption.priceAdjustment) {
          totalOptionPrice += hardwareOption.priceAdjustment;
        }
      }
    }

    // Motorization pricing
    if (options.controlType === 'motorized') {
      const motorConfig = db.systemConfig?.motorization || { basePrice: 75 };
      totalOptionPrice += motorConfig.basePrice;

      if (options.motorType) {
        const motorTypePrice = motorConfig[options.motorType] || 0;
        totalOptionPrice += motorTypePrice;
      }
    }

    // Accessories pricing
    if (options.accessories && Array.isArray(options.accessories)) {
      for (const accessoryId of options.accessories) {
        const accessory = this.findAccessory(accessoryId, db);
        if (accessory && accessory.price) {
          totalOptionPrice += accessory.price;
        }
      }
    }

    return totalOptionPrice;
  }

  /**
   * Calculate full cart/order totals
   * @param {Array} items - Cart items
   * @param {Object} orderInfo - Order information (address, etc.)
   * @returns {Object} - Complete order pricing
   */
  calculateOrderTotal(items, orderInfo = {}) {
    const db = this.loadDatabase();
    if (!db) {
      throw new Error('Database unavailable');
    }

    const taxConfig = systemConfig.getTax();
    const shippingConfig = systemConfig.getShipping();
    const businessRules = systemConfig.getBusinessRules();

    // Calculate each line item
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      // Recalculate price server-side (NEVER trust client price)
      const priceResult = this.calculateProductPrice({
        productId: item.productId,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        options: item.options || {},
        extendedWarranty: item.extendedWarranty || false
      });

      if (!priceResult.success) {
        throw new Error(`Pricing failed for product ${item.productId}`);
      }

      lineItems.push({
        ...priceResult.breakdown,
        itemId: item.id
      });

      subtotal += priceResult.breakdown.lineTotal;
    }

    // Calculate tax
    const taxResult = this.calculateTax(subtotal, orderInfo, taxConfig);

    // Calculate shipping
    const shippingResult = this.calculateShipping(
      subtotal,
      lineItems,
      orderInfo,
      shippingConfig
    );

    // Apply discounts/promotions
    const discountResult = this.applyDiscounts(
      subtotal,
      orderInfo.promoCode,
      db
    );

    // Calculate final total
    const grandTotal = subtotal - discountResult.amount + taxResult.amount + shippingResult.amount;

    // Validate against business rules
    this.validateOrderTotal(grandTotal, businessRules);

    return {
      success: true,
      lineItems,
      summary: {
        subtotal: this.round(subtotal),
        discount: {
          code: discountResult.code,
          amount: this.round(discountResult.amount),
          description: discountResult.description
        },
        tax: {
          rate: taxResult.rate,
          amount: this.round(taxResult.amount),
          description: taxResult.description
        },
        shipping: {
          method: shippingResult.method,
          amount: this.round(shippingResult.amount),
          description: shippingResult.description,
          estimatedDays: shippingResult.estimatedDays
        },
        grandTotal: this.round(grandTotal)
      },
      currency: systemConfig.getPricing().currency
    };
  }

  /**
   * Calculate tax based on location
   */
  calculateTax(subtotal, orderInfo, taxConfig) {
    if (!taxConfig.enabled) {
      return { rate: 0, amount: 0, description: 'Tax exempt' };
    }

    const state = orderInfo.shippingState || orderInfo.billingState || 'default';

    // Find applicable tax rule
    const taxRule = taxConfig.rules.find(r => r.region === state) ||
                    taxConfig.rules.find(r => r.region === 'default');

    const rate = taxRule ? taxRule.rate : taxConfig.defaultRate;
    const amount = subtotal * rate;

    return {
      rate,
      amount,
      description: taxRule ? taxRule.name : 'Sales Tax'
    };
  }

  /**
   * Calculate shipping based on order and destination
   */
  calculateShipping(subtotal, lineItems, orderInfo, shippingConfig) {
    // Check free shipping threshold
    if (subtotal >= shippingConfig.freeShippingThreshold) {
      return {
        method: 'free',
        amount: 0,
        description: `Free shipping on orders over $${shippingConfig.freeShippingThreshold}`,
        estimatedDays: '5-7 business days'
      };
    }

    // Calculate based on shipping type
    switch (shippingConfig.calculationType) {
      case 'flat':
        return {
          method: 'standard',
          amount: shippingConfig.defaultRate,
          description: 'Flat rate shipping',
          estimatedDays: '5-7 business days'
        };

      case 'zone':
        return this.calculateZoneShipping(orderInfo, lineItems, shippingConfig);

      case 'weight':
        return this.calculateWeightShipping(lineItems, shippingConfig);

      case 'threshold':
      default:
        return {
          method: 'standard',
          amount: shippingConfig.defaultRate,
          description: 'Standard shipping',
          estimatedDays: '5-7 business days'
        };
    }
  }

  /**
   * Calculate zone-based shipping
   */
  calculateZoneShipping(orderInfo, lineItems, shippingConfig) {
    const country = orderInfo.shippingCountry || 'US';
    const state = orderInfo.shippingState;

    // Find applicable zone
    let zone = shippingConfig.zones.find(z => {
      if (!z.countries.includes(country)) return false;
      if (z.includeStates && !z.includeStates.includes(state)) return false;
      if (z.excludeStates && z.excludeStates.includes(state)) return false;
      return true;
    });

    if (!zone) {
      zone = shippingConfig.zones.find(z => z.id === 'domestic') || shippingConfig.zones[0];
    }

    // Estimate weight (simplified)
    const estimatedWeight = lineItems.reduce((sum, item) => sum + (item.quantity * 2), 0);

    // Find rate tier
    const rateTier = zone.rates.find(r => estimatedWeight <= r.maxWeight) || zone.rates[zone.rates.length - 1];

    return {
      method: 'standard',
      amount: rateTier.price,
      description: `${zone.name} shipping`,
      estimatedDays: '5-7 business days'
    };
  }

  /**
   * Apply promotional discounts
   */
  applyDiscounts(subtotal, promoCode, db) {
    if (!promoCode) {
      return { code: null, amount: 0, description: null };
    }

    const promotions = db.promotions || [];
    const promo = promotions.find(p =>
      p.code.toLowerCase() === promoCode.toLowerCase() &&
      p.status === 'active'
    );

    if (!promo) {
      return { code: promoCode, amount: 0, description: 'Invalid promo code' };
    }

    // Check validity dates
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) {
      return { code: promoCode, amount: 0, description: 'Promo code not yet active' };
    }
    if (promo.endDate && new Date(promo.endDate) < now) {
      return { code: promoCode, amount: 0, description: 'Promo code expired' };
    }

    // Check minimum order
    if (promo.minimumOrderValue && subtotal < promo.minimumOrderValue) {
      return {
        code: promoCode,
        amount: 0,
        description: `Minimum order $${promo.minimumOrderValue} required`
      };
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === 'percentage') {
      discountAmount = subtotal * (promo.discountValue / 100);
      if (promo.maxDiscount) {
        discountAmount = Math.min(discountAmount, promo.maxDiscount);
      }
    } else {
      discountAmount = promo.discountValue;
    }

    return {
      code: promoCode,
      amount: discountAmount,
      description: promo.name
    };
  }

  /**
   * Validate dimension input
   */
  validateDimension(value, dimensionType, rules) {
    const config = rules[dimensionType];
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      throw new Error(`Invalid ${dimensionType}: must be a number`);
    }

    if (numValue < config.min) {
      throw new Error(`${dimensionType} must be at least ${config.min} ${config.unit}`);
    }

    if (numValue > config.max) {
      throw new Error(`${dimensionType} must be no more than ${config.max} ${config.unit}`);
    }

    return numValue;
  }

  /**
   * Validate quantity input
   */
  validateQuantity(value, rules) {
    const numValue = parseInt(value);

    if (isNaN(numValue) || numValue < rules.min) {
      throw new Error(`Quantity must be at least ${rules.min}`);
    }

    if (numValue > rules.max) {
      throw new Error(`Quantity cannot exceed ${rules.max}`);
    }

    return numValue;
  }

  /**
   * Validate order total against business rules
   */
  validateOrderTotal(total, rules) {
    if (total < rules.minimumOrderValue) {
      throw new Error(`Minimum order value is $${rules.minimumOrderValue}`);
    }

    if (total > rules.maximumOrderValue) {
      throw new Error(`Order exceeds maximum allowed value of $${rules.maximumOrderValue}`);
    }
  }

  /**
   * Find fabric by code
   */
  findFabric(code, db) {
    const fabrics = db.fabrics || [];
    for (const category of fabrics) {
      const fabric = category.items?.find(f => f.code === code);
      if (fabric) return fabric;
    }
    return null;
  }

  /**
   * Find hardware option
   */
  findHardwareOption(category, selection, db) {
    const hardware = db.hardware || {};
    const categoryItems = hardware[category] || [];
    return categoryItems.find(h => h.id === selection || h.code === selection);
  }

  /**
   * Find accessory
   */
  findAccessory(id, db) {
    const accessories = db.accessories || [];
    return accessories.find(a => a.id === id);
  }

  /**
   * Round to currency precision
   */
  round(value) {
    const precision = systemConfig.getPricing().currency.decimalPlaces || 2;
    return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  /**
   * Verify a price matches server calculation (for validation)
   * @param {Object} clientPrice - Price sent from client
   * @param {Object} params - Calculation parameters
   * @returns {Object} - Validation result
   */
  verifyPrice(clientPrice, params) {
    const serverResult = this.calculateProductPrice(params);

    if (!serverResult.success) {
      return { valid: false, reason: 'Server calculation failed' };
    }

    const tolerance = 0.01; // 1 cent tolerance for rounding
    const priceDiff = Math.abs(clientPrice - serverResult.pricing.unitPrice);

    if (priceDiff > tolerance) {
      return {
        valid: false,
        reason: 'Price mismatch',
        clientPrice,
        serverPrice: serverResult.pricing.unitPrice,
        difference: priceDiff
      };
    }

    return {
      valid: true,
      verifiedPrice: serverResult.pricing.unitPrice
    };
  }
}

// Singleton instance
const pricingEngine = new PricingEngine();

module.exports = { pricingEngine, PricingEngine };
