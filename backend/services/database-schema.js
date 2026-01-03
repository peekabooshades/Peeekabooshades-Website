/**
 * PEEKABOO SHADES - DATABASE SCHEMA EXTENSION
 * ===========================================
 *
 * Extends the database with new collections for:
 * - Manufacturers
 * - Manufacturer Prices
 * - Customer Price Rules (Margins)
 * - Order Status History
 * - Shipments & Tracking
 * - Invoices
 * - Payments & Refunds
 * - Expenses
 * - Tax Records
 * - Analytics Events
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * Extended Database Schema
 * All new collections with their default structure
 */
const SCHEMA_EXTENSIONS = {
  // ============================================
  // MANUFACTURER MANAGEMENT
  // ============================================
  manufacturers: [
    // Example structure:
    // {
    //   id: 'mfr-001',
    //   name: 'ZSTARR',
    //   code: 'ZSTARR',
    //   contactName: 'Alice Wang',
    //   email: 'alice@zstarr.com',
    //   phone: '+86-123-456-7890',
    //   address: { street: '', city: '', state: '', country: 'China', zip: '' },
    //   leadTimeDays: 14,
    //   shippingMethod: 'ocean_freight',
    //   status: 'active', // active, inactive, suspended
    //   notes: '',
    //   productTypes: ['roller', 'zebra', 'honeycomb'],
    //   paymentTerms: 'net30',
    //   createdAt: '2025-01-01T00:00:00.000Z',
    //   updatedAt: '2025-01-01T00:00:00.000Z',
    //   createdBy: 'admin-001',
    //   updatedBy: 'admin-001'
    // }
  ],

  // ============================================
  // MANUFACTURER PRICES (parsed from PDFs/CSVs)
  // ============================================
  manufacturerPrices: [
    // Example structure:
    // {
    //   id: 'mp-001',
    //   manufacturerId: 'mfr-001',
    //   productType: 'roller', // roller, zebra, honeycomb, roman
    //   fabricCode: '82032A',
    //   fabricName: 'Light Filtering White',
    //   fabricCategory: 'light_filtering', // light_filtering, blackout, semi_blackout, super_blackout
    //   widthMin: 12, // inches
    //   widthMax: 144,
    //   heightMin: 12,
    //   heightMax: 120,
    //   priceMatrix: [
    //     { widthRange: [12, 24], heightRange: [12, 36], price: 25.00 },
    //     { widthRange: [24, 48], heightRange: [12, 36], price: 35.00 },
    //     // ... more ranges
    //   ],
    //   basePrice: 25.00, // fallback if no matrix match
    //   pricePerSqFt: null, // alternative pricing method
    //   importSource: 'pdf', // pdf, csv, manual
    //   importFile: '2025 Roller blind wholesale quotation.pdf',
    //   importDate: '2025-01-01T00:00:00.000Z',
    //   effectiveDate: '2025-01-01',
    //   expirationDate: null,
    //   status: 'active', // active, expired, draft
    //   notes: '',
    //   createdAt: '2025-01-01T00:00:00.000Z',
    //   updatedAt: '2025-01-01T00:00:00.000Z',
    //   createdBy: 'admin-001'
    // }
  ],

  // ============================================
  // CUSTOMER PRICE RULES (Margin Configuration)
  // ============================================
  customerPriceRules: [
    // Example structure:
    // {
    //   id: 'cpr-001',
    //   name: 'Default Roller Margin',
    //   productType: 'roller', // roller, zebra, honeycomb, roman, all
    //   productId: null, // specific product override
    //   fabricCode: null, // specific fabric override
    //   marginType: 'percentage', // percentage, fixed, tiered
    //   marginValue: 40, // 40% markup
    //   tierRules: [
    //     { minCost: 0, maxCost: 50, margin: 50 },
    //     { minCost: 50, maxCost: 100, margin: 40 },
    //     { minCost: 100, maxCost: Infinity, margin: 35 }
    //   ],
    //   minMarginAmount: 15.00, // minimum profit per unit
    //   maxCustomerPrice: null, // price ceiling
    //   priority: 1, // higher priority rules override lower
    //   status: 'active',
    //   effectiveDate: '2025-01-01',
    //   expirationDate: null,
    //   createdAt: '2025-01-01T00:00:00.000Z',
    //   updatedAt: '2025-01-01T00:00:00.000Z',
    //   createdBy: 'admin-001'
    // }
  ],

  // ============================================
  // ORDER STATUS HISTORY (Audit Trail)
  // ============================================
  orderStatusHistory: [
    // Example structure:
    // {
    //   id: 'osh-001',
    //   orderId: 'ORD-123456789',
    //   previousStatus: 'pending',
    //   newStatus: 'payment_received',
    //   changedBy: 'admin-001',
    //   changedByName: 'Admin User',
    //   changedByRole: 'admin',
    //   notes: 'Payment confirmed via Stripe',
    //   metadata: { paymentId: 'pay_xxx', amount: 299.99 },
    //   timestamp: '2025-01-01T12:00:00.000Z'
    // }
  ],

  // ============================================
  // SHIPMENTS (Order Fulfillment)
  // ============================================
  shipments: [
    // Example structure:
    // {
    //   id: 'ship-001',
    //   orderId: 'ORD-123456789',
    //   orderItemIds: ['item-001', 'item-002'],
    //   manufacturerId: 'mfr-001',
    //   carrier: 'ups', // ups, fedex, usps
    //   trackingNumber: '1Z999AA10123456784',
    //   trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    //   shipmentType: 'customer', // manufacturer_to_warehouse, warehouse_to_customer, customer
    //   status: 'in_transit', // pending, label_created, picked_up, in_transit, out_for_delivery, delivered, exception
    //   estimatedDelivery: '2025-01-15',
    //   actualDelivery: null,
    //   shippingCost: 15.99,
    //   insuranceAmount: 0,
    //   weight: 5.2, // lbs
    //   dimensions: { length: 48, width: 6, height: 6 }, // inches
    //   fromAddress: { name: 'ZSTARR Factory', ... },
    //   toAddress: { name: 'John Doe', street: '123 Main St', ... },
    //   notes: '',
    //   createdAt: '2025-01-01T00:00:00.000Z',
    //   updatedAt: '2025-01-01T00:00:00.000Z',
    //   createdBy: 'mfr-001'
    // }
  ],

  // ============================================
  // TRACKING EVENTS (Shipment Updates)
  // ============================================
  trackingEvents: [
    // Example structure:
    // {
    //   id: 'te-001',
    //   shipmentId: 'ship-001',
    //   orderId: 'ORD-123456789',
    //   carrier: 'ups',
    //   trackingNumber: '1Z999AA10123456784',
    //   status: 'in_transit',
    //   statusDescription: 'Package in transit to destination',
    //   location: { city: 'Louisville', state: 'KY', country: 'US' },
    //   timestamp: '2025-01-10T14:30:00.000Z',
    //   source: 'api', // api, webhook, manual
    //   rawData: { ... }, // original carrier response
    //   createdAt: '2025-01-10T14:31:00.000Z'
    // }
  ],

  // ============================================
  // INVOICES
  // ============================================
  invoices: [
    // Example structure:
    // {
    //   id: 'inv-001',
    //   invoiceNumber: 'INV-2025-0001',
    //   orderId: 'ORD-123456789',
    //   orderNumber: 'PS-150421',
    //   customerId: null,
    //   customerName: 'John Doe',
    //   customerEmail: 'john@example.com',
    //   billingAddress: { ... },
    //   shippingAddress: { ... },
    //   lineItems: [
    //     {
    //       id: 'li-001',
    //       productId: 'prod-001',
    //       productName: 'Affordable Custom Roller Blinds',
    //       description: '36" x 48" Light Filtering, White',
    //       quantity: 2,
    //       unitPrice: 89.99,
    //       manufacturerCost: 45.00,
    //       margin: 44.99,
    //       discount: 0,
    //       lineTotal: 179.98
    //     }
    //   ],
    //   subtotal: 179.98,
    //   discountAmount: 0,
    //   discountCode: null,
    //   shippingAmount: 9.99,
    //   taxRate: 0.08,
    //   taxAmount: 15.20,
    //   totalAmount: 205.17,
    //   currency: 'USD',
    //   status: 'paid', // draft, sent, paid, overdue, cancelled, refunded
    //   dueDate: '2025-01-15',
    //   paidDate: '2025-01-02',
    //   paymentMethod: 'credit_card',
    //   paymentId: 'pay_xxx',
    //   notes: '',
    //   termsAndConditions: 'Standard terms apply...',
    //   pdfUrl: '/invoices/INV-2025-0001.pdf',
    //   sentAt: '2025-01-02T12:00:00.000Z',
    //   createdAt: '2025-01-02T10:00:00.000Z',
    //   updatedAt: '2025-01-02T12:00:00.000Z',
    //   createdBy: 'system'
    // }
  ],

  // ============================================
  // PAYMENTS
  // ============================================
  payments: [
    // Example structure:
    // {
    //   id: 'pay-001',
    //   orderId: 'ORD-123456789',
    //   invoiceId: 'inv-001',
    //   amount: 205.17,
    //   currency: 'USD',
    //   method: 'credit_card', // credit_card, debit_card, paypal, bank_transfer, check
    //   processor: 'stripe', // stripe, paypal, square, manual
    //   processorTransactionId: 'ch_xxx',
    //   status: 'completed', // pending, processing, completed, failed, refunded, partially_refunded
    //   cardBrand: 'visa',
    //   cardLast4: '4242',
    //   billingAddress: { ... },
    //   metadata: { ... },
    //   failureReason: null,
    //   refundedAmount: 0,
    //   createdAt: '2025-01-02T11:00:00.000Z',
    //   processedAt: '2025-01-02T11:00:05.000Z'
    // }
  ],

  // ============================================
  // REFUNDS
  // ============================================
  refunds: [
    // Example structure:
    // {
    //   id: 'ref-001',
    //   orderId: 'ORD-123456789',
    //   invoiceId: 'inv-001',
    //   paymentId: 'pay-001',
    //   amount: 89.99,
    //   reason: 'product_damaged', // product_damaged, wrong_item, customer_request, order_cancelled, other
    //   reasonDetails: 'Customer reported damage during shipping',
    //   type: 'partial', // full, partial
    //   status: 'completed', // pending, processing, completed, failed
    //   processorRefundId: 're_xxx',
    //   refundMethod: 'original_payment', // original_payment, store_credit, check
    //   processedBy: 'admin-001',
    //   processedByName: 'Admin User',
    //   approvedBy: 'admin-001',
    //   notes: '',
    //   createdAt: '2025-01-10T00:00:00.000Z',
    //   processedAt: '2025-01-10T01:00:00.000Z'
    // }
  ],

  // ============================================
  // EXPENSES (Post-Order Costs)
  // ============================================
  expenses: [
    // Example structure:
    // {
    //   id: 'exp-001',
    //   orderId: 'ORD-123456789', // null for general expenses
    //   category: 'repair', // repair, reshipping, damage_claim, return_shipping, other
    //   description: 'Replacement blind due to manufacturing defect',
    //   amount: 45.00,
    //   currency: 'USD',
    //   vendor: 'ZSTARR',
    //   vendorInvoiceNumber: 'ZS-2025-001',
    //   status: 'paid', // pending, approved, paid, rejected
    //   paidDate: '2025-01-15',
    //   paymentMethod: 'bank_transfer',
    //   receiptUrl: '/receipts/exp-001.pdf',
    //   notes: '',
    //   approvedBy: 'admin-001',
    //   createdAt: '2025-01-12T00:00:00.000Z',
    //   updatedAt: '2025-01-15T00:00:00.000Z',
    //   createdBy: 'admin-001'
    // }
  ],

  // ============================================
  // TAX RECORDS
  // ============================================
  taxRecords: [
    // Example structure:
    // {
    //   id: 'tax-001',
    //   orderId: 'ORD-123456789',
    //   invoiceId: 'inv-001',
    //   taxableAmount: 189.97,
    //   taxRate: 0.0725,
    //   taxAmount: 13.77,
    //   taxType: 'sales_tax',
    //   jurisdiction: 'CA', // state/region code
    //   jurisdictionName: 'California',
    //   country: 'US',
    //   reportingPeriod: '2025-Q1',
    //   status: 'collected', // collected, reported, remitted
    //   remittedDate: null,
    //   remittanceId: null,
    //   createdAt: '2025-01-02T00:00:00.000Z'
    // }
  ],

  // ============================================
  // ANALYTICS EVENTS (Anonymized)
  // ============================================
  analyticsEvents: [
    // Example structure:
    // {
    //   id: 'ae-001',
    //   eventType: 'page_view', // page_view, product_view, option_select, add_to_cart, checkout_start, payment_complete
    //   sessionId: 'sess_xxx', // hashed session ID
    //   visitorId: 'visitor_xxx', // hashed visitor ID (not IP)
    //   pageUrl: '/product/affordable-custom-roller-blinds',
    //   referrer: 'google.com',
    //   productId: 'prod-001',
    //   productSlug: 'affordable-custom-roller-blinds',
    //   eventData: {
    //     fabricCode: '82032A',
    //     width: 36,
    //     height: 48,
    //     price: 89.99
    //   },
    //   device: 'desktop', // desktop, tablet, mobile
    //   browser: 'chrome',
    //   os: 'macos',
    //   geo: { // anonymized to city/state level only
    //     city: 'San Francisco',
    //     state: 'CA',
    //     country: 'US',
    //     postalPrefix: '941' // only first 3 digits of zip
    //   },
    //   timestamp: '2025-01-02T14:30:00.000Z'
    // }
  ],

  // ============================================
  // PRICE IMPORT LOGS
  // ============================================
  priceImportLogs: [
    // Example structure:
    // {
    //   id: 'pil-001',
    //   importType: 'pdf', // pdf, csv
    //   fileName: '2025 Roller blind wholesale quotation.pdf',
    //   filePath: '/uploads/price-imports/xxx.pdf',
    //   status: 'completed', // pending, processing, completed, failed, partial
    //   recordsFound: 150,
    //   recordsImported: 148,
    //   recordsSkipped: 2,
    //   recordsFailed: 0,
    //   errors: [],
    //   warnings: ['Row 45: Price seems unusually high'],
    //   manufacturerId: 'mfr-001',
    //   processedBy: 'admin-001',
    //   startedAt: '2025-01-01T10:00:00.000Z',
    //   completedAt: '2025-01-01T10:05:00.000Z',
    //   createdAt: '2025-01-01T10:00:00.000Z'
    // }
  ],

  // ============================================
  // EMAIL LOGS (Dev Mode)
  // ============================================
  emailLogs: [
    // Example structure:
    // {
    //   id: 'email-001',
    //   templateId: 'order_confirmation',
    //   to: 'john@example.com',
    //   cc: null,
    //   bcc: null,
    //   subject: 'Order Confirmation - PS-150421',
    //   body: '<html>...</html>',
    //   textBody: 'Plain text version...',
    //   orderId: 'ORD-123456789',
    //   status: 'sent', // queued, sent, delivered, bounced, failed
    //   provider: 'dev_log', // dev_log, sendgrid, mailgun
    //   providerId: null,
    //   sentAt: '2025-01-02T12:00:00.000Z',
    //   deliveredAt: null,
    //   openedAt: null,
    //   clickedAt: null,
    //   errorMessage: null,
    //   createdAt: '2025-01-02T12:00:00.000Z'
    // }
  ]
};

/**
 * ORDER STATUS WORKFLOW
 * Defines valid status transitions
 */
const ORDER_STATUS_WORKFLOW = {
  statuses: [
    { id: 'pending', name: 'Order Placed', color: '#6c757d', icon: 'fa-clock' },
    { id: 'payment_received', name: 'Payment Received', color: '#17a2b8', icon: 'fa-credit-card' },
    { id: 'sent_to_manufacturer', name: 'Sent to Manufacturer', color: '#ffc107', icon: 'fa-paper-plane' },
    { id: 'in_manufacturing', name: 'In Manufacturing', color: '#fd7e14', icon: 'fa-industry' },
    { id: 'in_testing', name: 'In Testing', color: '#6f42c1', icon: 'fa-vial' },
    { id: 'in_shipping', name: 'In Shipping', color: '#007bff', icon: 'fa-truck' },
    { id: 'delivered', name: 'Delivered', color: '#28a745', icon: 'fa-check-circle' },
    { id: 'closed', name: 'Closed', color: '#28a745', icon: 'fa-flag-checkered' },
    { id: 'refunded', name: 'Refunded', color: '#dc3545', icon: 'fa-undo' },
    { id: 'disputed', name: 'Disputed', color: '#dc3545', icon: 'fa-exclamation-triangle' },
    { id: 'cancelled', name: 'Cancelled', color: '#6c757d', icon: 'fa-times-circle' }
  ],
  transitions: {
    'pending': ['payment_received', 'cancelled'],
    'payment_received': ['sent_to_manufacturer', 'refunded', 'cancelled'],
    'sent_to_manufacturer': ['in_manufacturing', 'refunded'],
    'in_manufacturing': ['in_testing', 'disputed'],
    'in_testing': ['in_shipping', 'in_manufacturing', 'disputed'],
    'in_shipping': ['delivered', 'disputed'],
    'delivered': ['closed', 'refunded', 'disputed'],
    'closed': ['refunded'],
    'refunded': [],
    'disputed': ['refunded', 'closed'],
    'cancelled': []
  }
};

/**
 * CARRIER DEFINITIONS
 */
const CARRIERS = {
  ups: {
    id: 'ups',
    name: 'UPS',
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={trackingNumber}',
    logo: '/images/carriers/ups.png'
  },
  fedex: {
    id: 'fedex',
    name: 'FedEx',
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
    logo: '/images/carriers/fedex.png'
  },
  usps: {
    id: 'usps',
    name: 'USPS',
    trackingUrlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}',
    logo: '/images/carriers/usps.png'
  }
};

/**
 * Initialize or extend database with new collections
 */
function extendDatabase() {
  let db;

  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    db = JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return false;
  }

  let modified = false;

  // Add each new collection if it doesn't exist
  for (const [collection, defaultValue] of Object.entries(SCHEMA_EXTENSIONS)) {
    if (!db[collection]) {
      console.log(`Adding new collection: ${collection}`);
      db[collection] = defaultValue;
      modified = true;
    }
  }

  // Add order status workflow config
  if (!db.orderStatusWorkflow) {
    db.orderStatusWorkflow = ORDER_STATUS_WORKFLOW;
    modified = true;
  }

  // Add carrier definitions
  if (!db.carriers) {
    db.carriers = CARRIERS;
    modified = true;
  }

  // Add default manufacturer if none exists
  if (db.manufacturers && db.manufacturers.length === 0) {
    const defaultManufacturer = {
      id: 'mfr-default',
      name: 'Default Manufacturer',
      code: 'DEFAULT',
      contactName: '',
      email: '',
      phone: '',
      address: {},
      leadTimeDays: 14,
      shippingMethod: 'standard',
      status: 'active',
      notes: 'Default manufacturer for initial setup',
      productTypes: ['roller', 'zebra', 'honeycomb', 'roman'],
      paymentTerms: 'net30',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system'
    };
    db.manufacturers.push(defaultManufacturer);
    modified = true;
  }

  // Add default margin rules if none exist
  if (db.customerPriceRules && db.customerPriceRules.length === 0) {
    const defaultRules = [
      {
        id: 'cpr-default-roller',
        name: 'Default Roller Blinds Margin',
        productType: 'roller',
        productId: null,
        fabricCode: null,
        marginType: 'percentage',
        marginValue: 40,
        tierRules: null,
        minMarginAmount: 15.00,
        maxCustomerPrice: null,
        priority: 1,
        status: 'active',
        effectiveDate: '2025-01-01',
        expirationDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'cpr-default-zebra',
        name: 'Default Zebra Blinds Margin',
        productType: 'zebra',
        productId: null,
        fabricCode: null,
        marginType: 'percentage',
        marginValue: 45,
        tierRules: null,
        minMarginAmount: 20.00,
        maxCustomerPrice: null,
        priority: 1,
        status: 'active',
        effectiveDate: '2025-01-01',
        expirationDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'cpr-default-honeycomb',
        name: 'Default Honeycomb Blinds Margin',
        productType: 'honeycomb',
        productId: null,
        fabricCode: null,
        marginType: 'percentage',
        marginValue: 50,
        tierRules: null,
        minMarginAmount: 25.00,
        maxCustomerPrice: null,
        priority: 1,
        status: 'active',
        effectiveDate: '2025-01-01',
        expirationDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'cpr-default-roman',
        name: 'Default Roman Shades Margin',
        productType: 'roman',
        productId: null,
        fabricCode: null,
        marginType: 'percentage',
        marginValue: 45,
        tierRules: null,
        minMarginAmount: 20.00,
        maxCustomerPrice: null,
        priority: 1,
        status: 'active',
        effectiveDate: '2025-01-01',
        expirationDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }
    ];
    db.customerPriceRules = defaultRules;
    modified = true;
  }

  if (modified) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      console.log('Database schema extended successfully');
      return true;
    } catch (error) {
      console.error('Error writing database:', error);
      return false;
    }
  }

  console.log('Database schema already up to date');
  return true;
}

/**
 * Get schema version info
 */
function getSchemaInfo() {
  const collections = Object.keys(SCHEMA_EXTENSIONS);
  return {
    version: '2.0.0',
    collections,
    orderStatuses: ORDER_STATUS_WORKFLOW.statuses.map(s => s.id),
    carriers: Object.keys(CARRIERS)
  };
}

module.exports = {
  extendDatabase,
  getSchemaInfo,
  SCHEMA_EXTENSIONS,
  ORDER_STATUS_WORKFLOW,
  CARRIERS
};
