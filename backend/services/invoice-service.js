/**
 * INVOICE SERVICE - Invoice Generation & Management
 * Ticket 006: Invoices
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

// US State Sales Tax Rates - Combined State + Average Local (July 2025)
// Source: Tax Foundation - taxfoundation.org/data/all/state/sales-tax-rates/
const STATE_TAX_RATES = {
  'AL': 0.0944,  // Alabama
  'AK': 0.0182,  // Alaska (local only, no state tax)
  'AZ': 0.0852,  // Arizona
  'AR': 0.0948,  // Arkansas
  'CA': 0.0898,  // California
  'CO': 0.0786,  // Colorado
  'CT': 0.0635,  // Connecticut
  'DE': 0,       // Delaware - no sales tax
  'FL': 0.0702,  // Florida
  'GA': 0.0744,  // Georgia
  'HI': 0.045,   // Hawaii (GET)
  'ID': 0.0603,  // Idaho
  'IL': 0.0892,  // Illinois
  'IN': 0.07,    // Indiana
  'IA': 0.0694,  // Iowa
  'KS': 0.0878,  // Kansas
  'KY': 0.06,    // Kentucky
  'LA': 0.1011,  // Louisiana
  'ME': 0.055,   // Maine
  'MD': 0.06,    // Maryland
  'MA': 0.0625,  // Massachusetts
  'MI': 0.06,    // Michigan
  'MN': 0.0813,  // Minnesota
  'MS': 0.0706,  // Mississippi
  'MO': 0.0841,  // Missouri
  'MT': 0,       // Montana - no sales tax
  'NE': 0.0698,  // Nebraska
  'NV': 0.0824,  // Nevada
  'NH': 0,       // New Hampshire - no sales tax
  'NJ': 0.066,   // New Jersey
  'NM': 0.0767,  // New Mexico
  'NY': 0.0854,  // New York
  'NC': 0.07,    // North Carolina
  'ND': 0.0708,  // North Dakota
  'OH': 0.073,   // Ohio
  'OK': 0.0905,  // Oklahoma
  'OR': 0,       // Oregon - no sales tax
  'PA': 0.0634,  // Pennsylvania
  'RI': 0.07,    // Rhode Island
  'SC': 0.0749,  // South Carolina
  'SD': 0.0611,  // South Dakota
  'TN': 0.0961,  // Tennessee
  'TX': 0.0825,  // Texas (max combined rate)
  'UT': 0.0742,  // Utah
  'VT': 0.0639,  // Vermont
  'VA': 0.0577,  // Virginia
  'WA': 0.0947,  // Washington
  'WV': 0.0658,  // West Virginia
  'WI': 0.0572,  // Wisconsin
  'WY': 0.0556,  // Wyoming
  'DC': 0.06     // District of Columbia
};

/**
 * Extract state from address string
 * Supports formats like:
 * - "123 Main St, City, CA 90210"
 * - "123 Main St, City, California 90210"
 * - "CA" (just state code)
 */
function extractStateFromAddress(address) {
  if (!address || typeof address !== 'string') return null;

  const stateAbbreviations = Object.keys(STATE_TAX_RATES);

  // State full names to abbreviations
  const stateNames = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
    'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
    'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
    'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
    'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
    'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
    'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
    'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
    'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
  };

  const upperAddress = address.toUpperCase();

  // Try to find state abbreviation with zip code pattern (e.g., "CA 90210" or "CA, 90210")
  const stateZipRegex = /\b([A-Z]{2})\s*,?\s*(\d{5}(-\d{4})?)\b/;
  const stateZipMatch = upperAddress.match(stateZipRegex);
  if (stateZipMatch && stateAbbreviations.includes(stateZipMatch[1])) {
    return stateZipMatch[1];
  }

  // Try to find state abbreviation after comma (e.g., ", CA")
  const commaStateRegex = /,\s*([A-Z]{2})\b/;
  const commaStateMatch = upperAddress.match(commaStateRegex);
  if (commaStateMatch && stateAbbreviations.includes(commaStateMatch[1])) {
    return commaStateMatch[1];
  }

  // Try to find full state name
  for (const [fullName, abbr] of Object.entries(stateNames)) {
    if (upperAddress.includes(fullName)) {
      return abbr;
    }
  }

  // Last resort: look for any standalone state abbreviation
  for (const abbr of stateAbbreviations) {
    const regex = new RegExp(`\\b${abbr}\\b`);
    if (regex.test(upperAddress)) {
      return abbr;
    }
  }

  return null;
}

/**
 * Calculate sales tax based on shipping address
 */
function calculateSalesTax(subtotal, shippingAddress) {
  const state = extractStateFromAddress(shippingAddress);

  if (!state) {
    // Default to California rate if state cannot be determined
    return {
      taxRate: 0.0725,
      taxAmount: Math.round(subtotal * 0.0725 * 100) / 100,
      state: 'CA',
      note: 'Default CA rate used - shipping state not determined'
    };
  }

  const taxRate = STATE_TAX_RATES[state] || 0;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;

  return {
    taxRate,
    taxAmount,
    state,
    note: taxRate === 0 ? `${state} has no state sales tax` : null
  };
}

// Invoice Statuses
const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Invoice Types
const INVOICE_TYPE = {
  CUSTOMER: 'customer',      // Invoice to customer
  MANUFACTURER: 'manufacturer' // Invoice from manufacturer (payable)
};

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Generate invoice number
 */
function generateInvoiceNumber(type = 'customer') {
  const prefix = type === 'manufacturer' ? 'MFR-INV' : 'INV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Create invoice from order
 */
function createInvoiceFromOrder(orderId, type = 'customer', options = {}) {
  const db = loadDatabase();

  if (!db.invoices) db.invoices = [];

  // Find order
  const order = db.orders.find(o => o.id === orderId || o.order_number === orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Check if invoice already exists for this order and type
  const existing = db.invoices.find(i => i.orderId === order.id && i.type === type && i.status !== INVOICE_STATUS.CANCELLED);
  if (existing && !options.allowDuplicate) {
    throw new Error(`Invoice already exists for this order: ${existing.invoiceNumber}`);
  }

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + (options.dueDays || 30));

  let invoice;

  if (type === INVOICE_TYPE.CUSTOMER) {
    // Handle both new format (order.customer.name) and legacy format (order.customer_name)
    const customerName = order.customer?.name || order.customer_name || 'Unknown';
    const customerEmail = order.customer?.email || order.customer_email || '';
    const customerPhone = order.customer?.phone || order.customer_phone || '';
    const customerAddress = order.customer?.address || order.shipping_address || '';
    const customerId = order.customer?.id || order.customerId;

    // Generate customer number if not present
    const customerNumber = customerId ||
      'CUST-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Customer invoice - what customer owes us
    invoice = {
      id: uuidv4(),
      invoiceNumber: generateInvoiceNumber('customer'),
      type: INVOICE_TYPE.CUSTOMER,
      status: order.payment?.status === 'completed' ? INVOICE_STATUS.PAID : INVOICE_STATUS.DRAFT,
      orderId: order.id,
      orderNumber: order.order_number,

      // Customer info with ID/Number - supports both new and legacy order formats
      customerId: customerId || customerNumber,
      customerNumber: customerNumber,
      customer: {
        id: customerId || customerNumber,
        number: customerNumber,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: customerAddress
      },

      // Billing/Shipping
      billingAddress: order.billing_address || customerAddress,
      shippingAddress: order.shipping_address || customerAddress,

      // Line items - include full configuration details and customer pricing
      items: order.items.map(item => {
        // Parse configuration if it's a string
        let cfg = {};
        if (item.configuration) {
          try {
            cfg = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : item.configuration;
          } catch (e) {
            cfg = {};
          }
        }

        // Get price snapshot data for detailed breakdown
        // Check both price_snapshots (plural - from order-service) and price_snapshot (singular - from cart)
        const priceSnapshots = item.price_snapshots || {};
        const priceSnapshotSingular = item.price_snapshot || {};

        // Use plural first, fallback to singular for each field
        const mfrPrice = priceSnapshots.manufacturer_price || priceSnapshotSingular.manufacturer_price || {};
        const margin = priceSnapshots.margin || priceSnapshotSingular.margin || {};
        const customerPriceP = priceSnapshots.customer_price || {};
        const customerPriceS = priceSnapshotSingular.customer_price || {};

        // Merge customer price fields, preferring plural but falling back to singular
        const customerPrice = {
          unit_price: customerPriceP.unit_price || customerPriceS.unit_price,
          line_total: customerPriceP.line_total || customerPriceS.line_total,
          options_total: customerPriceP.options_total || customerPriceS.options_total,
          options_breakdown: customerPriceP.options_breakdown || customerPriceS.options_breakdown || [],
          accessories_total: customerPriceP.accessories_total ?? customerPriceS.accessories_total ?? 0,
          accessories_breakdown: customerPriceP.accessories_breakdown?.length > 0
            ? customerPriceP.accessories_breakdown
            : (customerPriceS.accessories_breakdown || [])
        };

        const optionsBreakdown = customerPrice.options_breakdown || [];
        const accessoriesBreakdown = customerPrice.accessories_breakdown || [];

        // Build pricing details object for each option type
        const getOptionPrice = (type) => {
          const opt = optionsBreakdown.find(o => o.type === type);
          return opt ? { name: opt.name, price: opt.price, manufacturerCost: opt.manufacturerCost } : null;
        };

        return {
          id: item.id,
          description: item.product_name,
          details: `${item.width}" W x ${item.height}" H`,
          roomLabel: item.room_label || '',
          width: item.width,
          height: item.height,
          quantity: item.quantity,

          // Customer Pricing Details
          pricing: {
            fabricBasePrice: (mfrPrice.cost || mfrPrice.unit_cost) ? ((mfrPrice.cost || mfrPrice.unit_cost) + (margin.amount || 0)) : item.unit_price,
            manufacturerCost: mfrPrice.cost || mfrPrice.unit_cost || 0,
            marginPercent: margin.percentage || margin.percent || margin.value || 0,
            marginAmount: margin.amount || 0,
            optionsTotal: customerPrice.options_total || 0,
            accessoriesTotal: customerPrice.accessories_total || 0,
            unitPrice: item.unit_price,
            lineTotal: item.line_total || (item.unit_price * item.quantity)
          },

          // Options with Customer Prices
          optionsPricing: {
            motor: getOptionPrice('motorization'),
            remote: getOptionPrice('remote'),
            solar: getOptionPrice('solar'),
            valance: getOptionPrice('valance_type'),
            bottomRail: getOptionPrice('bottom_rail'),
            roller: getOptionPrice('roller_type')
          },

          // Accessories with Customer Prices
          accessoriesPricing: accessoriesBreakdown.map(acc => ({
            name: acc.name,
            code: acc.code,
            price: acc.price,
            manufacturerCost: acc.manufacturerCost
          })),

          // Full options breakdown (all options with prices)
          optionsBreakdown: optionsBreakdown,
          accessoriesBreakdown: accessoriesBreakdown,

          // Legacy fields for compatibility
          unitPrice: item.unit_price,
          lineTotal: item.line_total || (item.unit_price * item.quantity),

          // Configuration columns
          fabricCode: cfg.fabricCode || '',
          fabricColor: cfg.fabricColor || '',
          lightFiltering: cfg.lightFiltering || '',
          standardCassette: cfg.standardCassette || '',
          standardBottomBar: cfg.standardBottomBar || '',
          rollerType: cfg.rollerType || '',
          mountType: cfg.mountType || '',
          controlType: cfg.controlType || '',
          motorType: cfg.motorType || cfg.motorBrand || '',
          motorBrand: cfg.motorBrand || '',
          remoteType: cfg.remoteType || '',
          solarType: cfg.solarType || '',
          chainType: cfg.chainType || '',
          chainSide: cfg.chainSide || '',
          smartHubQty: cfg.smartHubQty || 0,
          usbChargerQty: cfg.usbChargerQty || 0,
          configuration: item.configuration || '{}'
        };
      }),

      // Totals - USE ORDER'S STORED VALUES (invoice must match what customer was charged)
      // BUG FIX: Previously recalculated tax instead of using order's stored tax
      subtotal: (() => {
        const orderSubtotal = order.pricing?.subtotal || order.subtotal || 0;
        return orderSubtotal;
      })(),
      // Use order's stored tax value - DO NOT recalculate
      ...(() => {
        const orderSubtotal = order.pricing?.subtotal || order.subtotal || 0;
        // Use stored tax from order - this is what customer was charged at checkout
        const orderTax = order.pricing?.tax || order.tax || 0;
        // Ensure shipping is a number (could be an object with tracking info)
        const rawShipping = order.pricing?.shipping || order.shipping || 0;
        const orderShipping = typeof rawShipping === 'number' ? rawShipping : 0;
        const orderDiscount = order.pricing?.discount || order.discount || 0;
        // Use order's stored total, or calculate from stored values
        const orderTotal = order.pricing?.total || order.total ||
          Math.round((orderSubtotal + orderTax + orderShipping - orderDiscount) * 100) / 100;

        // Extract state for reference only (don't use for tax calculation)
        const shippingAddr = order.shipping_address || customerAddress;
        const stateInfo = extractStateFromAddress(shippingAddr);

        return {
          tax: orderTax,
          taxRate: orderSubtotal > 0 ? (orderTax / orderSubtotal) : 0,
          taxState: stateInfo,
          taxNote: null,
          shipping: orderShipping,
          shippingInfo: typeof rawShipping === 'object' ? rawShipping : null,
          discount: orderDiscount,
          total: orderTotal
        };
      })(),
      currency: 'USD',

      // Payment info - use order's stored total (not recalculated)
      ...(() => {
        // Use the order's stored total - this is what customer was actually charged
        const orderTotal = order.pricing?.total || order.total || 0;

        return {
          amountPaid: order.payment?.status === 'completed' ? orderTotal : 0,
          amountDue: order.payment?.status === 'completed' ? 0 : orderTotal
        };
      })(),
      paymentMethod: order.payment?.method || null,

      // Important Dates
      invoiceGeneratedAt: now.toISOString(),    // Invoice generated date/time
      invoiceGeneratedDate: now.toLocaleDateString('en-US'),
      invoiceGeneratedTime: now.toLocaleTimeString('en-US'),
      paymentDate: order.payment?.status === 'completed' ? now.toISOString() : null,  // Payment date/time
      paymentDateFormatted: order.payment?.status === 'completed' ? now.toLocaleDateString('en-US') : null,
      paymentTimeFormatted: order.payment?.status === 'completed' ? now.toLocaleTimeString('en-US') : null,
      orderDate: order.created_at || now.toISOString(),  // Original order date

      // Legacy date fields (kept for compatibility)
      issueDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      paidAt: order.payment?.status === 'completed' ? now.toISOString() : null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),

      // Notes
      notes: options.notes || '',
      internalNotes: options.internalNotes || ''
    };
  } else {
    // Manufacturer invoice - what we owe manufacturer
    const manufacturerCost = order.pricing?.manufacturer_cost_total ||
      order.items.reduce((sum, item) => {
        const mfrPrice = item.price_snapshots?.manufacturer_price?.cost || (item.unit_price * 0.6);
        return sum + (mfrPrice * item.quantity);
      }, 0);

    invoice = {
      id: uuidv4(),
      invoiceNumber: generateInvoiceNumber('manufacturer'),
      type: INVOICE_TYPE.MANUFACTURER,
      status: INVOICE_STATUS.DRAFT,
      orderId: order.id,
      orderNumber: order.order_number,

      // Manufacturer info (would come from manufacturer record)
      manufacturer: {
        id: options.manufacturerId || 'mfr-default',
        name: options.manufacturerName || 'Default Manufacturer',
        email: options.manufacturerEmail || ''
      },

      // Line items with manufacturer costs - include full configuration
      items: order.items.map(item => {
        const mfrCost = item.price_snapshots?.manufacturer_price?.cost || (item.unit_price * 0.6);

        // Parse configuration if it's a string
        let cfg = {};
        if (item.configuration) {
          try {
            cfg = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : item.configuration;
          } catch (e) {
            cfg = {};
          }
        }

        return {
          id: item.id,
          description: item.product_name,
          details: `${item.width}" W x ${item.height}" H - Fabric: ${cfg.fabricCode || 'N/A'}`,
          roomLabel: item.room_label || '',
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          unitPrice: mfrCost,
          lineTotal: mfrCost * item.quantity,
          // Configuration columns
          fabricCode: cfg.fabricCode || '',
          fabricColor: cfg.fabricColor || '',
          lightFiltering: cfg.lightFiltering || '',
          standardCassette: cfg.standardCassette || '',
          standardBottomBar: cfg.standardBottomBar || '',
          rollerType: cfg.rollerType || '',
          mountType: cfg.mountType || '',
          controlType: cfg.controlType || '',
          motorType: cfg.motorType || cfg.motorBrand || '',
          motorBrand: cfg.motorBrand || '',
          remoteType: cfg.remoteType || '',
          solarType: cfg.solarType || '',
          chainType: cfg.chainType || '',
          chainSide: cfg.chainSide || '',
          configuration: item.configuration || '{}'
        };
      }),

      // Totals
      subtotal: manufacturerCost,
      tax: 0, // Usually no tax on B2B
      shipping: 0,
      total: manufacturerCost,
      currency: 'USD',

      // Payment info
      amountPaid: 0,
      amountDue: manufacturerCost,

      // Dates
      issueDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),

      // Notes
      notes: options.notes || '',
      internalNotes: options.internalNotes || ''
    };
  }

  db.invoices.push(invoice);
  saveDatabase(db);

  return invoice;
}

/**
 * Get all invoices with filters
 */
function getInvoices(filters = {}) {
  const db = loadDatabase();
  let invoices = db.invoices || [];

  // Filter by type
  if (filters.type) {
    invoices = invoices.filter(i => i.type === filters.type);
  }

  // Filter by status
  if (filters.status) {
    invoices = invoices.filter(i => i.status === filters.status);
  }

  // Filter by customer
  if (filters.customerId) {
    invoices = invoices.filter(i => i.customer?.id === filters.customerId);
  }

  // Filter by order
  if (filters.orderId) {
    invoices = invoices.filter(i => i.orderId === filters.orderId);
  }

  // Filter by date range
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    invoices = invoices.filter(i => new Date(i.issueDate) >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    invoices = invoices.filter(i => new Date(i.issueDate) <= end);
  }

  // Search
  if (filters.search) {
    const search = filters.search.toLowerCase();
    invoices = invoices.filter(i =>
      i.invoiceNumber.toLowerCase().includes(search) ||
      i.orderNumber?.toLowerCase().includes(search) ||
      i.customer?.name?.toLowerCase().includes(search) ||
      i.customer?.email?.toLowerCase().includes(search)
    );
  }

  // Sort
  invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;
  const total = invoices.length;

  return {
    invoices: invoices.slice(offset, offset + limit),
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

/**
 * Get invoice by ID
 */
function getInvoice(invoiceId) {
  const db = loadDatabase();
  return (db.invoices || []).find(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
}

/**
 * Update invoice
 */
function updateInvoice(invoiceId, updates) {
  const db = loadDatabase();

  const index = (db.invoices || []).findIndex(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
  if (index === -1) {
    throw new Error('Invoice not found');
  }

  const invoice = db.invoices[index];

  // Update allowed fields
  if (updates.status) invoice.status = updates.status;
  if (updates.notes !== undefined) invoice.notes = updates.notes;
  if (updates.internalNotes !== undefined) invoice.internalNotes = updates.internalNotes;
  if (updates.dueDate) invoice.dueDate = updates.dueDate;

  invoice.updatedAt = new Date().toISOString();

  db.invoices[index] = invoice;
  saveDatabase(db);

  return invoice;
}

/**
 * Record payment on invoice
 */
function recordPayment(invoiceId, payment) {
  const db = loadDatabase();

  const index = (db.invoices || []).findIndex(i => i.id === invoiceId || i.invoiceNumber === invoiceId);
  if (index === -1) {
    throw new Error('Invoice not found');
  }

  const invoice = db.invoices[index];

  // Record payment
  if (!invoice.payments) invoice.payments = [];

  const paymentRecord = {
    id: uuidv4(),
    amount: payment.amount,
    method: payment.method || 'other',
    reference: payment.reference || '',
    notes: payment.notes || '',
    recordedAt: new Date().toISOString(),
    recordedBy: payment.recordedBy || 'admin'
  };

  invoice.payments.push(paymentRecord);

  // Update amounts
  invoice.amountPaid = (invoice.amountPaid || 0) + payment.amount;
  invoice.amountDue = invoice.total - invoice.amountPaid;

  // Update status
  if (invoice.amountDue <= 0) {
    invoice.status = INVOICE_STATUS.PAID;
    invoice.paidAt = new Date().toISOString();
  } else if (invoice.amountPaid > 0) {
    invoice.status = INVOICE_STATUS.PARTIALLY_PAID;
  }

  invoice.updatedAt = new Date().toISOString();

  db.invoices[index] = invoice;
  saveDatabase(db);

  return invoice;
}

/**
 * Get invoice summary/stats
 */
function getInvoiceSummary(type = null) {
  const db = loadDatabase();
  let invoices = db.invoices || [];

  if (type) {
    invoices = invoices.filter(i => i.type === type);
  }

  const summary = {
    total: invoices.length,
    totalAmount: invoices.reduce((sum, i) => sum + i.total, 0),
    totalPaid: invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0),
    totalDue: invoices.reduce((sum, i) => sum + (i.amountDue || i.total), 0),
    byStatus: {}
  };

  // Group by status
  for (const status of Object.values(INVOICE_STATUS)) {
    const statusInvoices = invoices.filter(i => i.status === status);
    summary.byStatus[status] = {
      count: statusInvoices.length,
      amount: statusInvoices.reduce((sum, i) => sum + i.total, 0)
    };
  }

  return summary;
}

/**
 * Check for overdue invoices and update status
 */
function updateOverdueInvoices() {
  const db = loadDatabase();
  const now = new Date();
  let updated = 0;

  (db.invoices || []).forEach((invoice, index) => {
    if (invoice.status === INVOICE_STATUS.SENT || invoice.status === INVOICE_STATUS.PARTIALLY_PAID) {
      if (new Date(invoice.dueDate) < now) {
        db.invoices[index].status = INVOICE_STATUS.OVERDUE;
        db.invoices[index].updatedAt = now.toISOString();
        updated++;
      }
    }
  });

  if (updated > 0) {
    saveDatabase(db);
  }

  return updated;
}

/**
 * Generate invoices for all orders that don't have one
 */
function generateMissingInvoices() {
  const db = loadDatabase();
  const orders = db.orders || [];
  const invoices = db.invoices || [];

  let created = 0;

  for (const order of orders) {
    // Check if customer invoice exists
    const hasCustomerInvoice = invoices.some(i =>
      i.orderId === order.id &&
      i.type === INVOICE_TYPE.CUSTOMER &&
      i.status !== INVOICE_STATUS.CANCELLED
    );

    if (!hasCustomerInvoice) {
      try {
        createInvoiceFromOrder(order.id, INVOICE_TYPE.CUSTOMER);
        created++;
      } catch (e) {
        console.error(`Failed to create invoice for order ${order.order_number}:`, e.message);
      }
    }
  }

  return created;
}

module.exports = {
  INVOICE_STATUS,
  INVOICE_TYPE,
  STATE_TAX_RATES,
  generateInvoiceNumber,
  extractStateFromAddress,
  calculateSalesTax,
  createInvoiceFromOrder,
  getInvoices,
  getInvoice,
  updateInvoice,
  recordPayment,
  getInvoiceSummary,
  updateOverdueInvoices,
  generateMissingInvoices
};
