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

    // Step 2: Apply margin rules
    const marginResult = this.applyMarginRules({
      manufacturerCost: manufacturerCost.unitCost,
      productType,
      productId: product.id,
      fabricCode,
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

      // Use cordless pricing if control type is cordless or motorized
      const isCordless = controlType === 'cordless' || controlType === 'motorized';
      if (isCordless && priceRecord.pricePerSqMeterCordless) {
        pricePerSqMeter = priceRecord.pricePerSqMeterCordless;
      }

      // Calculate unit cost: area × price per m²
      const unitCost = areaSqMeters * pricePerSqMeter;

      return {
        unitCost,
        source: 'manufacturer_price',
        manufacturerId: priceRecord.manufacturerId,
        priceRecordId: priceRecord.id,
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
          controlType: isCordless ? 'cordless' : 'manual'
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
   */
  applyMarginRules(params) {
    const { manufacturerCost, productType, productId, fabricCode, db } = params;

    // Get applicable margin rules (sorted by priority)
    const rules = (db.customerPriceRules || [])
      .filter(r => r.status === 'active')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Find the most specific matching rule
    let matchedRule = null;

    // Priority 1: Product + Fabric specific
    matchedRule = rules.find(r =>
      r.productId === productId && r.fabricCode === fabricCode
    );

    // Priority 2: Product specific
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.productId === productId && !r.fabricCode
      );
    }

    // Priority 3: Fabric specific
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.fabricCode === fabricCode && !r.productId
      );
    }

    // Priority 4: Product type specific
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.productType === productType && !r.productId && !r.fabricCode
      );
    }

    // Priority 5: Default rule (all)
    if (!matchedRule) {
      matchedRule = rules.find(r =>
        r.productType === 'all' && !r.productId && !r.fabricCode
      );
    }

    // If no rule found, use default 40% margin
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
    const areaSqMeters = widthMeters * heightMeters;

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

    // Motorized control pricing (synced with customer-config pricingData.ts)
    // Motor Brand prices from MOTOR_PRICES:
    // - AOK_NORMAL: $45, AOK_ULTRA_QUIET: $57
    // - DOOYA: $47
    // - MATTER: $85, COLLISE: $160, SOMFY: $600, BLISS: $540
    if (options.controlType === 'motorized' || options.controlType === 'motorized-app' || options.controlType === 'cordless-motorized') {
      // Motor brand selection (default to AOK)
      // Prices from customer-config pricingData.ts MOTOR_PRICES
      const motorBrand = options.motorBrand || 'aok';

      // AOK Motor prices (from customer-config)
      const aokMotorPrices = {
        'am28': 57.00,              // AOK_ULTRA_QUIET: $57
        'am28-ultra': 57.00,        // AOK AM28mm Ultra quiet motor
        '25mm': 45.00,              // AOK_NORMAL: $45
        '35mm': 57.00,              // AOK 35mm = Ultra quiet price
        'battery': 45.00,           // Default to 25mm for battery
        'plugin-wire': 57.00,       // Default to AM28 for plugin
        'solar-powered': 57.00      // Default to AM28 for solar
      };

      // Dooya Motor prices (from customer-config DOOYA: $47)
      const dooyaMotorPrices = {
        'standard': 47.00,          // DOOYA: $47
        'battery': 47.00,           // Dooya battery motor
        'plugin-wire': 47.00,       // Dooya plugin motor (same base price)
        'solar-powered': 47.00      // Dooya solar motor (same base price)
      };

      // Other motor brands (from customer-config)
      const otherMotorPrices = {
        'matter': 85.00,            // MATTER: $85
        'collise': 160.00,          // COLLISE: $160
        'somfy': 600.00,            // SOMFY: $600
        'bliss': 540.00             // BLISS: $540
      };

      // Get motor price based on brand and type
      const motorType = options.motorType || (motorBrand === 'aok' ? 'battery' : 'standard');
      let motorPrice, motorName;

      if (motorBrand === 'dooya') {
        motorPrice = dooyaMotorPrices[motorType] || 47.00;
        motorName = 'Dooya Motor';
      } else if (otherMotorPrices[motorBrand]) {
        motorPrice = otherMotorPrices[motorBrand];
        motorName = motorBrand.charAt(0).toUpperCase() + motorBrand.slice(1) + ' Motor';
      } else {
        // Default to AOK
        motorPrice = aokMotorPrices[motorType] || 45.00;
        motorName = motorPrice === 45 ? 'AOK 25mm Motor' : 'AOK AM28mm Ultra Quiet Motor';
      }

      breakdown.push({
        type: 'motorization',
        code: options.controlType,
        name: motorName,
        brand: motorBrand,
        price: motorPrice,
        manufacturerCost: motorPrice * 0.6
      });
      total += motorPrice;
      manufacturerCost += motorPrice * 0.6;

      // Note: Cordless-motorized combo - no additional cordless fee per customer-config
      // Motor price already includes all necessary components

      // Remote type (prices from customer-config pricingData.ts)
      if (options.remoteType) {
        const remoteTypePrices = {
          'single-channel': 6.00,    // Single Channel Remote
          '6-channel': 6.60,         // 6 Channel Remote
          '15-channel': 11.35,       // 15 Channel Remote
          '16-channel': 11.35        // Alias for 15 channel
        };
        const remotePrice = remoteTypePrices[options.remoteType] || 0;
        if (remotePrice > 0) {
          breakdown.push({
            type: 'remote',
            code: options.remoteType,
            name: options.remoteType.replace(/-/g, ' '),
            price: remotePrice,
            manufacturerCost: remotePrice * 0.5
          });
          total += remotePrice;
          manufacturerCost += remotePrice * 0.5;
        }
      }
    }

    // Note: Cordless control has no additional fee per customer-config
    // Control system options (manual, cordless, motorized) don't have base prices
    // Motor price is charged separately based on motor brand selection

    // Mount type
    if (options.mountType) {
      const mountTypePrices = {
        'inside': 0,
        'outside': 10
      };
      const mountPrice = mountTypePrices[options.mountType] || 0;
      if (mountPrice > 0) {
        breakdown.push({
          type: 'mount_type',
          code: options.mountType,
          name: options.mountType.replace(/-/g, ' '),
          price: mountPrice,
          manufacturerCost: mountPrice * 0.5
        });
        total += mountPrice;
        manufacturerCost += mountPrice * 0.5;
      }
    }

    // Valance/Cassette type pricing - PER SQUARE METER (from customer-config pricingData.ts)
    // VALANCE_PRICES: TOP_PLAIN_SQUARE: 0, TOP_FABRIC_WRAPPED: 2.2, TOP_FABRIC_INSERT: 2.2
    const valanceValue = options.valanceType || options.standardCassette;
    if (valanceValue) {
      // Prices per square meter ($/m²) from customer-config
      const valanceTypePricesPerSqM = {
        'square-v1': 0,               // Plain square - free
        'square-v2': 0,               // Plain square - free
        'square-v3': 0,               // Plain square - free
        'fabric-wrapped-v3': 2.20,    // Fabric wrapped = $2.20/m²
        'fabric-wrapped-sa': 2.20,    // Fabric wrapped = $2.20/m²
        'fabric-wrapped-s3': 2.20,    // Fabric wrapped = $2.20/m²
        'fabric-inserted-s1': 2.20,   // Fabric insert = $2.20/m²
        'curve-white-s2': 2.20,       // Other type = $2.20/m²
        'simple-rolling': 0,          // Simple rolling - free
        'burliness': 2.20             // Other type = $2.20/m²
      };
      const valancePricePerSqM = valanceTypePricesPerSqM[valanceValue] || 0;
      if (valancePricePerSqM > 0) {
        // Calculate total price: rate per m² × area in m²
        const valancePrice = this.round(valancePricePerSqM * areaSqMeters);
        breakdown.push({
          type: 'valance_type',
          code: valanceValue,
          name: valanceValue.replace(/-/g, ' '),
          price: valancePrice,
          pricePerSqM: valancePricePerSqM,
          areaSqMeters: this.round(areaSqMeters * 100) / 100,
          manufacturerCost: valancePrice * 0.5
        });
        total += valancePrice;
        manufacturerCost += valancePrice * 0.5;
      }
    }

    // Bottom rail/bar pricing - PER SQUARE METER (from customer-config pricingData.ts)
    // VALANCE_PRICES: BOTTOM_PLAIN: 0, BOTTOM_OTHER: 2.2
    if (options.bottomRail || options.standardBottomBar) {
      const bottomBarValue = options.bottomRail || options.standardBottomBar;
      // Prices per square meter ($/m²) from customer-config
      const bottomRailPricesPerSqM = {
        // Plain types - free
        'type-a-waterdrop': 0,        // Streamlined water-drop = free
        'type-a-white': 0,            // Type A White = free
        'type-a-gray': 0,             // Type A Gray = free
        'type-a-black': 0,            // Type A Black = free
        'standard': 0,                // Standard = free
        // Other types = $2.20/m²
        'simple-rolling': 2.20,       // Simple rolling = $2.20/m²
        'type-b': 2.20,               // Type B = $2.20/m²
        'type-b-white': 2.20,         // Type B White = $2.20/m²
        'type-b-gray': 2.20,          // Type B Gray = $2.20/m²
        'type-b-black': 2.20,         // Type B Black = $2.20/m²
        'type-c-fabric-wrapped': 2.20, // Type C Fabric Wrapped = $2.20/m²
        'type-d': 2.20,               // Type D = $2.20/m²
        'fabric-inserted-z1': 2.20,   // Fabric inserted Z1 = $2.20/m²
        'end-cap-free-z2': 2.20       // End cap free Z2 = $2.20/m²
      };
      const bottomRailPricePerSqM = bottomRailPricesPerSqM[bottomBarValue] || 0;
      if (bottomRailPricePerSqM > 0) {
        // Calculate total price: rate per m² × area in m²
        const bottomRailPrice = this.round(bottomRailPricePerSqM * areaSqMeters);
        breakdown.push({
          type: 'bottom_rail',
          code: bottomBarValue,
          name: bottomBarValue.replace(/-/g, ' '),
          price: bottomRailPrice,
          pricePerSqM: bottomRailPricePerSqM,
          areaSqMeters: this.round(areaSqMeters * 100) / 100,
          manufacturerCost: bottomRailPrice * 0.5
        });
        total += bottomRailPrice;
        manufacturerCost += bottomRailPrice * 0.5;
      }
    }

    // Accessories - hardcoded prices synced with customer-config
    const accessoryPrices = {
      'smartHub': 23.50,
      'smart-hub': 23.50,
      'usbCharger': 5.00,
      'usb-charger': 5.00
    };

    // Handle smartHub quantity
    if (options.smartHubQty && options.smartHubQty > 0) {
      const smartHubTotal = options.smartHubQty * accessoryPrices.smartHub;
      breakdown.push({
        type: 'accessory',
        code: 'smart-hub',
        name: `Smart Hub x${options.smartHubQty}`,
        price: smartHubTotal,
        manufacturerCost: smartHubTotal * 0.5
      });
      total += smartHubTotal;
      manufacturerCost += smartHubTotal * 0.5;
    }

    // Handle usbCharger quantity
    if (options.usbChargerQty && options.usbChargerQty > 0) {
      const usbChargerTotal = options.usbChargerQty * accessoryPrices.usbCharger;
      breakdown.push({
        type: 'accessory',
        code: 'usb-charger',
        name: `USB Charger x${options.usbChargerQty}`,
        price: usbChargerTotal,
        manufacturerCost: usbChargerTotal * 0.5
      });
      total += usbChargerTotal;
      manufacturerCost += usbChargerTotal * 0.5;
    }

    // Legacy accessories handling from database
    if (options.accessories && Array.isArray(options.accessories)) {
      const accessories = db.productContent?.accessories || [];
      for (const accId of options.accessories) {
        const accessory = accessories.find(a => a.id === accId);
        // Use hardcoded price if available, otherwise use database price
        const price = accessoryPrices[accId] || accessory?.price || 0;
        if (price > 0) {
          breakdown.push({
            type: 'accessory',
            code: accessory?.id || accId,
            name: accessory?.name || accId,
            price: price,
            manufacturerCost: price * 0.5
          });
          total += price;
          manufacturerCost += price * 0.5;
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
