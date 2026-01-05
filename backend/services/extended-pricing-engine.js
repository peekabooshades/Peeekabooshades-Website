/**
 * PEEKABOO SHADES - EXTENDED PRICING ENGINE
 * ==========================================
 *
 * Extends the base pricing engine with:
 * - Manufacturer cost lookup
 * - Margin rules application
 * - Full price breakdown (cost, margin, customer price)
 * - Tax and shipping calculations
 * - Audit trail for pricing changes
 *
 * PRICING FLOW:
 * 1. Look up manufacturer cost for fabric/dimensions
 * 2. Apply margin rules (%, fixed, or tiered)
 * 3. Add option costs (hardware, motorization, accessories)
 * 4. Add shipping estimate
 * 5. Add tax estimate
 * 6. Return complete breakdown
 */

const fs = require('fs');
const path = require('path');
const { systemConfig } = require('../config/system-config');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * ExtendedPricingEngine Class
 */
class ExtendedPricingEngine {

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
   * Get hardware option price from database
   * @param {Object} db - Database
   * @param {string} category - Option category (e.g., 'mountType', 'valanceType')
   * @param {string} optionId - Option ID or code to lookup
   * @param {number} areaSqMeters - Area in square meters (for per-sqm pricing)
   * @returns {Object} - { price, manufacturerCost, priceType, name }
   */
  getHardwareOptionPrice(db, category, optionId, areaSqMeters = 1) {
    const hardwareOptions = db?.productContent?.hardwareOptions || {};
    const categoryOptions = hardwareOptions[category] || [];

    // Normalize optionId for comparison
    const normalizedId = optionId?.toLowerCase()?.replace(/[-_\s]/g, '');

    // Find the option by id, code, value, or label (handle various naming conventions)
    const option = categoryOptions.find(opt => {
      const optId = opt.id?.toLowerCase()?.replace(/[-_\s]/g, '');
      const optCode = opt.code?.toLowerCase()?.replace(/[-_\s]/g, '');
      const optValue = opt.value?.toLowerCase()?.replace(/[-_\s]/g, '');
      const optLabel = opt.label?.toLowerCase()?.replace(/[-_\s]/g, '');
      const optName = opt.name?.toLowerCase()?.replace(/[-_\s]/g, '');

      return optId === normalizedId ||
             optCode === normalizedId ||
             optValue === normalizedId ||
             optLabel === normalizedId ||
             optName === normalizedId ||
             // Also match partial label/name (e.g., "inside" matches "Inside Mount")
             optLabel?.includes(normalizedId) ||
             optName?.includes(normalizedId);
    });

    if (!option) {
      return { price: 0, manufacturerCost: 0, priceType: 'flat', name: optionId };
    }

    let price = option.price || 0;
    let mfrCost = option.manufacturerCost || 0;
    const priceType = option.priceType || 'flat';

    // If price type is per square meter, multiply by area
    if (priceType === 'sqm' || priceType === 'per_sqm' || priceType === 'persqm') {
      price = price * areaSqMeters;
      mfrCost = mfrCost * areaSqMeters;
    }

    return {
      price: this.round(price),
      manufacturerCost: this.round(mfrCost),
      priceType,
      name: option.name || option.label || optionId
    };
  }

  /**
   * Get motor brand price from database
   * @param {Object} db - Database
   * @param {string} brandId - Motor brand ID
   * @param {string} motorType - Motor type (battery, plugin-wire, etc.)
   * @returns {Object} - { price, manufacturerCost, name }
   */
  getMotorBrandPrice(db, brandId, motorType = 'standard') {
    const motorBrands = db?.motorBrands || [];
    const brand = motorBrands.find(b => b.id === brandId || b.code === brandId);

    if (!brand) {
      // Fallback to default prices if brand not found
      return { price: 45, manufacturerCost: 27, name: 'Motor' };
    }

    // Get price based on motor type if available
    let price = brand.price || 0;
    let mfrCost = brand.manufacturerCost || price * 0.6;

    // Check for type-specific pricing
    if (brand.types && brand.types[motorType]) {
      price = brand.types[motorType].price || price;
      mfrCost = brand.types[motorType].manufacturerCost || price * 0.6;
    }

    return {
      price: this.round(price),
      manufacturerCost: this.round(mfrCost),
      name: brand.name || brandId
    };
  }

  /**
   * Calculate complete customer price with full breakdown
   * This is the SINGLE SOURCE OF TRUTH for pricing
   *
   * @param {Object} params - Pricing parameters
   * @returns {Object} - Complete price breakdown
   */
  calculateCustomerPrice(params) {
    const {
      productId,
      productSlug,
      productType = 'roller',
      width,
      height,
      quantity = 1,
      fabricCode,
      options = {},
      shippingState = null,
      includeShipping = false,
      includeTax = false
    } = params;

    const db = this.loadDatabase();
    if (!db) {
      throw new Error('Database unavailable');
    }

    // Get product info
    const product = productSlug
      ? db.products.find(p => p.slug === productSlug)
      : db.products.find(p => p.id === productId);

    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.is_active) {
      throw new Error('Product is not available');
    }

    // Validate dimensions
    const productRules = systemConfig.getProductRules();
    const validatedWidth = this.validateDimension(width, 'width', productRules.dimensions);
    const validatedHeight = this.validateDimension(height, 'height', productRules.dimensions);
    const validatedQty = this.validateQuantity(quantity, productRules.quantity);

    // Step 1: Get manufacturer cost
    const controlType = options.controlType || 'manual';
    const manufacturerCost = this.getManufacturerCost({
      productType,
      fabricCode,
      width: validatedWidth,
      height: validatedHeight,
      controlType,
      db
    });

    // Step 2: Apply margin rules (use per-fabric margin from admin portal if set)
    const marginResult = this.applyMarginRules({
      manufacturerCost: manufacturerCost.unitCost,
      productType,
      productId: product.id,
      fabricCode,
      fabricMargin: manufacturerCost.fabricMargin,  // Per-fabric margin from admin portal
      db
    });

    // Step 3: Calculate option costs (pass dimensions for per-sqm pricing)
    const optionCosts = this.calculateOptionCosts(options, db, validatedWidth, validatedHeight);

    // Step 4: Calculate base customer price
    let baseCustomerPrice = marginResult.customerPrice;

    // Use product base_price as minimum floor if manufacturer cost not found
    if (manufacturerCost.source === 'fallback') {
      baseCustomerPrice = Math.max(baseCustomerPrice, product.base_price);
    }

    // Add option costs
    const unitPrice = baseCustomerPrice + optionCosts.total;
    const lineTotal = unitPrice * validatedQty;

    // Step 5: Calculate shipping (if requested)
    let shippingEstimate = { amount: 0, method: null, description: null };
    if (includeShipping) {
      const shippingConfig = systemConfig.getShipping();
      shippingEstimate = this.calculateShipping(lineTotal, validatedQty, shippingState, shippingConfig);
    }

    // Step 6: Calculate tax (if requested)
    let taxEstimate = { rate: 0, amount: 0, description: null };
    if (includeTax && shippingState) {
      const taxConfig = systemConfig.getTax();
      taxEstimate = this.calculateTax(lineTotal + shippingEstimate.amount, shippingState, taxConfig);
    }

    // Calculate grand total
    const grandTotal = lineTotal + shippingEstimate.amount + taxEstimate.amount;

    return {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        type: productType
      },
      dimensions: {
        width: validatedWidth,
        height: validatedHeight,
        squareInches: validatedWidth * validatedHeight,
        squareFeet: (validatedWidth * validatedHeight) / 144,
        // Include m² calculation details
        ...(manufacturerCost.calculation && {
          squareMeters: manufacturerCost.calculation.appliedAreaSqMeters,
          minAreaApplied: manufacturerCost.calculation.minAreaApplied
        })
      },
      quantity: validatedQty,
      fabricCode,
      pricing: {
        manufacturerCost: {
          unitCost: this.round(manufacturerCost.unitCost),
          totalCost: this.round(manufacturerCost.unitCost * validatedQty),
          source: manufacturerCost.source,
          manufacturerId: manufacturerCost.manufacturerId
        },
        margin: {
          type: marginResult.marginType,
          value: marginResult.marginValue,
          amount: this.round(marginResult.marginAmount),
          percentage: this.round(marginResult.marginPercentage)
        },
        options: {
          breakdown: optionCosts.breakdown,
          total: this.round(optionCosts.total)
        },
        unitPrice: this.round(unitPrice),
        lineTotal: this.round(lineTotal),
        shipping: includeShipping ? {
          method: shippingEstimate.method,
          amount: this.round(shippingEstimate.amount),
          description: shippingEstimate.description
        } : null,
        tax: includeTax ? {
          rate: taxEstimate.rate,
          amount: this.round(taxEstimate.amount),
          description: taxEstimate.description
        } : null,
        grandTotal: this.round(grandTotal)
      },
      profitAnalysis: {
        grossProfit: this.round((unitPrice - manufacturerCost.unitCost - optionCosts.manufacturerCost) * validatedQty),
        grossMarginPercent: this.round(((unitPrice - manufacturerCost.unitCost - optionCosts.manufacturerCost) / unitPrice) * 100)
      }
    };
  }

  /**
   * Get manufacturer cost for a specific product/fabric/dimensions
   * Uses the m² (square meter) pricing formula from customer-config:
   * - Convert inches to meters: inches × 0.0254
   * - Calculate area in m²
   * - Apply minimum area: 1.2m² for roller, 1.5m² for zebra
   * - Price = area × pricePerSqMeter
   */
  getManufacturerCost(params) {
    const { productType, fabricCode, width, height, db, controlType = 'manual' } = params;

    // Convert inches to meters
    const INCHES_TO_METERS = 0.0254;
    const widthMeters = width * INCHES_TO_METERS;
    const heightMeters = height * INCHES_TO_METERS;

    // Calculate area in square meters
    let areaSqMeters = widthMeters * heightMeters;

    // Minimum area by product type (from customer-config)
    const MIN_AREA = {
      roller: 1.2,  // 1.2 m² minimum for roller blinds
      zebra: 1.5,   // 1.5 m² minimum for zebra blinds
      honeycomb: 1.2,
      roman: 1.5
    };

    const minArea = MIN_AREA[productType] || 1.2;
    areaSqMeters = Math.max(areaSqMeters, minArea);

    // Look up manufacturer price
    const manufacturerPrices = db.manufacturerPrices || [];
    const priceRecord = manufacturerPrices.find(p =>
      p.productType === productType &&
      p.fabricCode === fabricCode &&
      p.status === 'active'
    );

    if (priceRecord) {
      // Use pricePerSqMeter for m² pricing (from imported customer-config data)
      let pricePerSqMeter = priceRecord.pricePerSqMeter || priceRecord.basePrice;

      // Get per-fabric margin from admin portal (if set)
      let fabricMargin = priceRecord.manualMargin;

      // Use cordless pricing ONLY for cordless control type (includes cordless spring mechanism)
      // Motorized uses standard fabric price + motor brand cost separately
      if (controlType === 'cordless') {
        if (priceRecord.pricePerSqMeterCordless) {
          pricePerSqMeter = priceRecord.pricePerSqMeterCordless;
        }
        // Use cordless margin if set
        if (priceRecord.cordlessMargin !== undefined && priceRecord.cordlessMargin !== null) {
          fabricMargin = priceRecord.cordlessMargin;
        }
      }

      // Calculate unit cost: area × price per m²
      const unitCost = areaSqMeters * pricePerSqMeter;

      return {
        unitCost,
        source: 'manufacturer_price',
        manufacturerId: priceRecord.manufacturerId,
        priceRecordId: priceRecord.id,
        // Include per-fabric margin from admin portal
        fabricMargin: fabricMargin,
        // Include calculation details for transparency
        calculation: {
          widthInches: width,
          heightInches: height,
          widthMeters: this.round(widthMeters * 100) / 100,
          heightMeters: this.round(heightMeters * 100) / 100,
          rawAreaSqMeters: this.round(widthMeters * heightMeters * 100) / 100,
          appliedAreaSqMeters: this.round(areaSqMeters * 100) / 100,
          minAreaApplied: widthMeters * heightMeters < minArea,
          pricePerSqMeter,
          controlType: controlType
        }
      };
    }

    // Fallback: Use m² pricing with default rate
    // Average fabric price from customer-config is ~$15/m² for basic fabrics
    const DEFAULT_PRICE_PER_SQ_METER = {
      roller: 14.00,
      zebra: 16.00,
      honeycomb: 18.00,
      roman: 17.00
    };

    const fallbackPricePerSqMeter = DEFAULT_PRICE_PER_SQ_METER[productType] || 14.00;
    const estimatedCost = areaSqMeters * fallbackPricePerSqMeter;

    return {
      unitCost: estimatedCost,
      source: 'fallback',
      manufacturerId: null,
      priceRecordId: null,
      calculation: {
        widthInches: width,
        heightInches: height,
        widthMeters: this.round(widthMeters * 100) / 100,
        heightMeters: this.round(heightMeters * 100) / 100,
        rawAreaSqMeters: this.round(widthMeters * heightMeters * 100) / 100,
        appliedAreaSqMeters: this.round(areaSqMeters * 100) / 100,
        minAreaApplied: widthMeters * heightMeters < minArea,
        pricePerSqMeter: fallbackPricePerSqMeter,
        note: 'Using fallback pricing - fabric not found in manufacturer prices'
      }
    };
  }

  /**
   * Apply margin rules to get customer price
   * Priority: 1) Per-fabric margin from admin portal, 2) customerPriceRules, 3) Default 40%
   */
  applyMarginRules(params) {
    const { manufacturerCost, productType, productId, fabricCode, fabricMargin, db } = params;

    // PRIORITY 1: Use per-fabric margin from admin portal if set
    if (fabricMargin !== undefined && fabricMargin !== null) {
      const marginAmount = manufacturerCost * (fabricMargin / 100);
      const customerPrice = manufacturerCost + marginAmount;

      return {
        marginType: 'percentage',
        marginValue: fabricMargin,
        marginAmount,
        marginPercentage: fabricMargin,
        customerPrice,
        ruleId: null,
        ruleName: 'Per-Fabric Margin (Admin Portal)'
      };
    }

    // PRIORITY 2: Use customerPriceRules
    // Get applicable margin rules (sorted by priority)
    const rules = (db.customerPriceRules || [])
      .filter(r => r.status === 'active')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Find the most specific matching rule
    let matchedRule = null;

    // Priority 2a: Product + Fabric specific
    matchedRule = rules.find(r =>
      r.productId === productId && r.fabricCode === fabricCode
    );

    // Priority 2b: Product specific
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.productId === productId && !r.fabricCode
      );
    }

    // Priority 2c: Fabric specific
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.fabricCode === fabricCode && !r.productId
      );
    }

    // Priority 2d: Product type specific
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.productType === productType && !r.productId && !r.fabricCode
      );
    }

    // Priority 2e: Default rule (all)
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.productType === 'all' && !r.productId && !r.fabricCode
      );
    }

    // PRIORITY 3: If no rule found, use default 40% margin
    if (!matchedRule) {
      const defaultMargin = 0.40;
      const marginAmount = manufacturerCost * defaultMargin;
      const customerPrice = manufacturerCost + marginAmount;

      return {
        marginType: 'percentage',
        marginValue: 40,
        marginAmount,
        marginPercentage: 40,
        customerPrice,
        ruleId: null,
        ruleName: 'Default (40%)'
      };
    }

    let marginAmount = 0;
    let customerPrice = manufacturerCost;

    switch (matchedRule.marginType) {
      case 'percentage':
        marginAmount = manufacturerCost * (matchedRule.marginValue / 100);
        break;

      case 'fixed':
        marginAmount = matchedRule.marginValue;
        break;

      case 'tiered':
        if (matchedRule.tierRules && matchedRule.tierRules.length > 0) {
          const tier = matchedRule.tierRules.find(t =>
            manufacturerCost >= t.minCost && manufacturerCost < (t.maxCost || Infinity)
          );
          if (tier) {
            marginAmount = manufacturerCost * (tier.margin / 100);
          }
        }
        break;

      default:
        marginAmount = manufacturerCost * 0.40; // 40% default
    }

    // Apply minimum margin if set
    if (matchedRule.minMarginAmount && marginAmount < matchedRule.minMarginAmount) {
      marginAmount = matchedRule.minMarginAmount;
    }

    customerPrice = manufacturerCost + marginAmount;

    // Apply maximum price ceiling if set
    if (matchedRule.maxCustomerPrice && customerPrice > matchedRule.maxCustomerPrice) {
      customerPrice = matchedRule.maxCustomerPrice;
      marginAmount = customerPrice - manufacturerCost;
    }

    return {
      marginType: matchedRule.marginType,
      marginValue: matchedRule.marginValue,
      marginAmount,
      marginPercentage: (marginAmount / manufacturerCost) * 100,
      customerPrice,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name
    };
  }

  /**
   * Calculate option costs
   */
  calculateOptionCosts(options, db, width = 60, height = 50) {
    const breakdown = [];
    let total = 0;
    let manufacturerCost = 0;

    // Calculate area in square meters for per-sqm pricing
    // Formula: width(inches) × 0.0254 × height(inches) × 0.0254
    const widthMeters = width * 0.0254;
    const heightMeters = height * 0.0254;
    let areaSqMeters = widthMeters * heightMeters;

    // Minimum area for roller shades: 1.2 m²
    // If area is less than 1.2 m², charge as if it were 1.2 m²
    const minArea = 1.2;
    const minAreaApplied = areaSqMeters < minArea;
    if (minAreaApplied) {
      areaSqMeters = minArea;
    }

    // Fabric upgrade cost
    if (options.fabricCode) {
      const fabrics = db.productContent?.fabrics || [];
      for (const category of fabrics) {
        const fabric = category.items?.find(f => f.code === options.fabricCode);
        if (fabric && fabric.priceAdjustment) {
          breakdown.push({
            type: 'fabric',
            code: options.fabricCode,
            name: fabric.name || options.fabricCode,
            price: fabric.priceAdjustment,
            manufacturerCost: fabric.manufacturerCost || fabric.priceAdjustment * 0.5
          });
          total += fabric.priceAdjustment;
          manufacturerCost += fabric.manufacturerCost || fabric.priceAdjustment * 0.5;
        }
      }
    }

    // Hardware options
    const hardwareOptions = ['standardCassette', 'standardBottomBar', 'rollerType'];
    for (const hwOption of hardwareOptions) {
      if (options[hwOption]) {
        const hardware = db.productContent?.hardwareOptions?.[hwOption];
        if (hardware) {
          const item = hardware.find(h => h.id === options[hwOption] || h.code === options[hwOption]);
          if (item && item.priceAdjustment) {
            breakdown.push({
              type: 'hardware',
              subtype: hwOption,
              code: item.id || item.code,
              name: item.name,
              price: item.priceAdjustment,
              manufacturerCost: item.manufacturerCost || item.priceAdjustment * 0.5
            });
            total += item.priceAdjustment;
            manufacturerCost += item.manufacturerCost || item.priceAdjustment * 0.5;
          }
        }
      }
    }

    // Motorized control pricing - prices from database (Admin > Product Pricing > Motor Brands)
    if (options.controlType === 'motorized' || options.controlType === 'motorized-app' || options.controlType === 'cordless-motorized') {
      const motorBrand = options.motorBrand || 'aok';
      const motorType = options.motorType || 'battery';

      // Look up motor brand from database
      const motorBrands = db?.motorBrands || [];
      const brand = motorBrands.find(b =>
        b.id === motorBrand ||
        b.id === `motor-${motorBrand}` ||
        b.value === motorBrand ||
        b.code === motorBrand ||
        b.name?.toLowerCase().includes(motorBrand.toLowerCase())
      );

      let motorPrice, motorMfrCost, motorName;

      if (brand) {
        // Use database prices
        motorPrice = brand.price || 45;
        motorMfrCost = brand.manufacturerCost || motorPrice * 0.6;
        motorName = brand.name || `${motorBrand} Motor`;

        // Check for motor type specific pricing
        if (brand.types && brand.types[motorType]) {
          motorPrice = brand.types[motorType].price || motorPrice;
          motorMfrCost = brand.types[motorType].manufacturerCost || motorMfrCost;
        }
      } else {
        // Fallback defaults
        motorPrice = 45;
        motorMfrCost = 27;
        motorName = 'Motor';
      }

      breakdown.push({
        type: 'motorization',
        code: options.controlType,
        name: motorName,
        brand: motorBrand,
        price: this.round(motorPrice),
        manufacturerCost: this.round(motorMfrCost)
      });
      total += motorPrice;
      manufacturerCost += motorMfrCost;

      // Note: Cordless-motorized combo - no additional cordless fee per customer-config
      // Motor price already includes all necessary components

      // Remote type - prices from database (Admin > Product Pricing)
      if (options.remoteType) {
        const remoteOption = this.getHardwareOptionPrice(db, 'remoteType', options.remoteType, areaSqMeters);
        if (remoteOption.price > 0) {
          breakdown.push({
            type: 'remote',
            code: options.remoteType,
            name: remoteOption.name,
            price: remoteOption.price,
            manufacturerCost: remoteOption.manufacturerCost
          });
          total += remoteOption.price;
          manufacturerCost += remoteOption.manufacturerCost;
        }
      }

      // Solar panel - prices from database (Admin > Product Pricing)
      if (options.solarType === 'yes') {
        const solarOption = this.getHardwareOptionPrice(db, 'solarPanel', 'yes', areaSqMeters);
        const solarPrice = solarOption.price > 0 ? solarOption.price : 20.50;
        const solarMfrCost = solarOption.manufacturerCost > 0 ? solarOption.manufacturerCost : 15;
        breakdown.push({
          type: 'solar',
          code: 'solar-panel',
          name: solarOption.name || 'Solar Panel',
          price: solarPrice,
          manufacturerCost: solarMfrCost
        });
        total += solarPrice;
        manufacturerCost += solarMfrCost;
      }
    }

    // Note: Cordless control has no additional fee per customer-config
    // Control system options (manual, cordless, motorized) don't have base prices
    // Motor price is charged separately based on motor brand selection

    // Mount type - prices from database (Admin > Product Pricing)
    if (options.mountType) {
      const mountOption = this.getHardwareOptionPrice(db, 'mountType', options.mountType, areaSqMeters);
      if (mountOption.price > 0) {
        breakdown.push({
          type: 'mount_type',
          code: options.mountType,
          name: mountOption.name,
          price: mountOption.price,
          manufacturerCost: mountOption.manufacturerCost
        });
        total += mountOption.price;
        manufacturerCost += mountOption.manufacturerCost;
      }
    }

    // Valance/Cassette type pricing - prices from database (Admin > Product Pricing)
    const valanceValue = options.valanceType || options.standardCassette;
    if (valanceValue) {
      const valanceOption = this.getHardwareOptionPrice(db, 'valanceType', valanceValue, areaSqMeters);
      if (valanceOption.price > 0) {
        breakdown.push({
          type: 'valance_type',
          code: valanceValue,
          name: valanceOption.name,
          price: valanceOption.price,
          priceType: valanceOption.priceType,
          areaSqMeters: valanceOption.priceType === 'sqm' ? this.round(areaSqMeters * 100) / 100 : undefined,
          manufacturerCost: valanceOption.manufacturerCost
        });
        total += valanceOption.price;
        manufacturerCost += valanceOption.manufacturerCost;
      }
    }

    // Bottom rail/bar pricing - prices from database (Admin > Product Pricing)
    if (options.bottomRail || options.standardBottomBar) {
      const bottomBarValue = options.bottomRail || options.standardBottomBar;
      const bottomOption = this.getHardwareOptionPrice(db, 'bottomRail', bottomBarValue, areaSqMeters);
      if (bottomOption.price > 0) {
        breakdown.push({
          type: 'bottom_rail',
          code: bottomBarValue,
          name: bottomOption.name,
          price: bottomOption.price,
          priceType: bottomOption.priceType,
          areaSqMeters: bottomOption.priceType === 'sqm' ? this.round(areaSqMeters * 100) / 100 : undefined,
          manufacturerCost: bottomOption.manufacturerCost
        });
        total += bottomOption.price;
        manufacturerCost += bottomOption.manufacturerCost;
      }
    }

    // Accessories - prices from database (Admin > Product Pricing)
    const accessories = db?.productContent?.accessories || [];

    // Helper to get accessory price from database
    const getAccessoryPrice = (accId) => {
      // Normalize for comparison
      const normalizedId = accId?.toLowerCase()?.replace(/[-_\s]/g, '');

      const accessory = accessories.find(a => {
        const aId = a.id?.toLowerCase()?.replace(/[-_\s]/g, '');
        const aCode = a.code?.toLowerCase()?.replace(/[-_\s]/g, '');
        const aName = a.name?.toLowerCase()?.replace(/[-_\s]/g, '');

        return aId === normalizedId ||
               aCode === normalizedId ||
               aName === normalizedId ||
               aName?.includes(normalizedId) ||
               normalizedId?.includes(aName);
      });

      return accessory ? {
        price: accessory.price || 0,
        manufacturerCost: accessory.manufacturerCost || (accessory.price || 0) * 0.5,
        name: accessory.name || accId
      } : { price: 0, manufacturerCost: 0, name: accId };
    };

    // Handle smartHub quantity
    if (options.smartHubQty && options.smartHubQty > 0) {
      const smartHubInfo = getAccessoryPrice('smart-hub');
      const smartHubTotal = options.smartHubQty * smartHubInfo.price;
      const smartHubMfrTotal = options.smartHubQty * smartHubInfo.manufacturerCost;
      breakdown.push({
        type: 'accessory',
        code: 'smart-hub',
        name: `${smartHubInfo.name} x${options.smartHubQty}`,
        price: smartHubTotal,
        manufacturerCost: smartHubMfrTotal
      });
      total += smartHubTotal;
      manufacturerCost += smartHubMfrTotal;
    }

    // Handle usbCharger quantity
    if (options.usbChargerQty && options.usbChargerQty > 0) {
      const usbInfo = getAccessoryPrice('usb-charger');
      const usbChargerTotal = options.usbChargerQty * usbInfo.price;
      const usbMfrTotal = options.usbChargerQty * usbInfo.manufacturerCost;
      breakdown.push({
        type: 'accessory',
        code: 'usb-charger',
        name: `${usbInfo.name} x${options.usbChargerQty}`,
        price: usbChargerTotal,
        manufacturerCost: usbMfrTotal
      });
      total += usbChargerTotal;
      manufacturerCost += usbMfrTotal;
    }

    // Legacy accessories handling from database
    if (options.accessories && Array.isArray(options.accessories)) {
      for (const accId of options.accessories) {
        const accInfo = getAccessoryPrice(accId);
        if (accInfo.price > 0) {
          breakdown.push({
            type: 'accessory',
            code: accId,
            name: accInfo.name,
            price: accInfo.price,
            manufacturerCost: accInfo.manufacturerCost
          });
          total += accInfo.price;
          manufacturerCost += accInfo.manufacturerCost;
        }
      }
    }

    return {
      breakdown,
      total,
      manufacturerCost
    };
  }

  /**
   * Calculate shipping estimate
   */
  calculateShipping(subtotal, quantity, shippingState, shippingConfig) {
    // Check free shipping threshold
    if (subtotal >= shippingConfig.freeShippingThreshold) {
      return {
        method: 'free',
        amount: 0,
        description: `Free shipping on orders over $${shippingConfig.freeShippingThreshold}`
      };
    }

    // Zone-based shipping
    if (shippingConfig.zones && shippingState) {
      const alaskaHawaii = ['AK', 'HI'];
      const isRemote = alaskaHawaii.includes(shippingState.toUpperCase());

      const zone = shippingConfig.zones.find(z =>
        isRemote ? z.id === 'alaska-hawaii' : z.id === 'domestic'
      ) || shippingConfig.zones[0];

      // Estimate weight (2 lbs per blind)
      const estimatedWeight = quantity * 2;
      const rateTier = zone.rates.find(r => estimatedWeight <= r.maxWeight) || zone.rates[zone.rates.length - 1];

      return {
        method: 'standard',
        amount: rateTier.price,
        description: `${zone.name} shipping (${estimatedWeight} lbs)`
      };
    }

    // Default flat rate
    return {
      method: 'standard',
      amount: shippingConfig.defaultRate,
      description: 'Standard shipping'
    };
  }

  /**
   * Calculate tax estimate
   */
  calculateTax(taxableAmount, shippingState, taxConfig) {
    if (!taxConfig.enabled) {
      return { rate: 0, amount: 0, description: 'Tax exempt' };
    }

    const state = shippingState?.toUpperCase() || 'default';
    const taxRule = taxConfig.rules.find(r => r.region === state) ||
                    taxConfig.rules.find(r => r.region === 'default');

    const rate = taxRule ? taxRule.rate : taxConfig.defaultRate;
    const amount = taxableAmount * rate;

    return {
      rate,
      amount,
      description: taxRule ? taxRule.name : 'Sales Tax'
    };
  }

  /**
   * Validate dimension
   */
  validateDimension(value, dimensionType, rules) {
    const config = rules[dimensionType];
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      throw new Error(`Invalid ${dimensionType}: must be a number`);
    }

    if (numValue < config.min) {
      return config.min; // Auto-correct to minimum
    }

    if (numValue > config.max) {
      return config.max; // Auto-correct to maximum
    }

    return numValue;
  }

  /**
   * Validate quantity
   */
  validateQuantity(value, rules) {
    const numValue = parseInt(value);

    if (isNaN(numValue) || numValue < rules.min) {
      return rules.min;
    }

    if (numValue > rules.max) {
      return rules.max;
    }

    return numValue;
  }

  /**
   * Round to currency precision
   */
  round(value) {
    return Math.round(value * 100) / 100;
  }

  /**
   * Get pricing summary for admin dashboard
   */
  getPricingSummary(options = {}) {
    const db = this.loadDatabase();
    if (!db) return null;

    const manufacturerPrices = db.manufacturerPrices || [];
    const priceRules = db.customerPriceRules || [];

    // Group by product type
    const byProductType = {};
    for (const price of manufacturerPrices) {
      if (!byProductType[price.productType]) {
        byProductType[price.productType] = {
          count: 0,
          avgCost: 0,
          minCost: Infinity,
          maxCost: 0,
          totalCost: 0
        };
      }
      const group = byProductType[price.productType];
      group.count++;
      group.totalCost += price.basePrice;
      group.minCost = Math.min(group.minCost, price.basePrice);
      group.maxCost = Math.max(group.maxCost, price.basePrice);
    }

    // Calculate averages
    for (const type in byProductType) {
      const group = byProductType[type];
      group.avgCost = group.count > 0 ? group.totalCost / group.count : 0;
      if (group.minCost === Infinity) group.minCost = 0;
    }

    return {
      totalManufacturerPrices: manufacturerPrices.length,
      totalPriceRules: priceRules.length,
      byProductType,
      lastUpdated: manufacturerPrices.length > 0
        ? manufacturerPrices.reduce((latest, p) =>
            new Date(p.updatedAt) > new Date(latest) ? p.updatedAt : latest,
            manufacturerPrices[0].updatedAt
          )
        : null
    };
  }

  /**
   * Simulate pricing for what-if analysis
   */
  simulatePricing(params) {
    const { productType, fabricCodes = [], marginAdjustment = 0 } = params;

    const db = this.loadDatabase();
    if (!db) return null;

    const manufacturerPrices = (db.manufacturerPrices || [])
      .filter(p => p.productType === productType && p.status === 'active');

    const simulations = [];

    for (const price of manufacturerPrices) {
      if (fabricCodes.length > 0 && !fabricCodes.includes(price.fabricCode)) {
        continue;
      }

      const currentResult = this.applyMarginRules({
        manufacturerCost: price.basePrice,
        productType,
        productId: null,
        fabricCode: price.fabricCode,
        db
      });

      const adjustedMargin = currentResult.marginPercentage + marginAdjustment;
      const adjustedMarginAmount = price.basePrice * (adjustedMargin / 100);
      const adjustedPrice = price.basePrice + adjustedMarginAmount;

      simulations.push({
        fabricCode: price.fabricCode,
        manufacturerCost: price.basePrice,
        currentCustomerPrice: currentResult.customerPrice,
        currentMarginPercent: currentResult.marginPercentage,
        simulatedCustomerPrice: adjustedPrice,
        simulatedMarginPercent: adjustedMargin,
        priceChange: adjustedPrice - currentResult.customerPrice,
        priceChangePercent: ((adjustedPrice - currentResult.customerPrice) / currentResult.customerPrice) * 100
      });
    }

    return {
      productType,
      marginAdjustment,
      simulations,
      summary: {
        avgPriceChange: simulations.length > 0
          ? simulations.reduce((sum, s) => sum + s.priceChange, 0) / simulations.length
          : 0,
        totalSimulated: simulations.length
      }
    };
  }
}

// Singleton instance
const extendedPricingEngine = new ExtendedPricingEngine();

module.exports = { extendedPricingEngine, ExtendedPricingEngine };
