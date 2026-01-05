/**
 * INVOICE SERVICE - Invoice Generation & Management
 * Ticket 006: Invoices
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

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
    // Customer invoice - what customer owes us
    invoice = {
      id: uuidv4(),
      invoiceNumber: generateInvoiceNumber('customer'),
      type: INVOICE_TYPE.CUSTOMER,
      status: order.payment?.status === 'completed' ? INVOICE_STATUS.PAID : INVOICE_STATUS.DRAFT,
      orderId: order.id,
      orderNumber: order.order_number,

      // Customer info
      customer: {
        name: order.customer?.name || 'Unknown',
        email: order.customer?.email || '',
        phone: order.customer?.phone || '',
        address: order.customer?.address || ''
      },

      // Billing/Shipping
      billingAddress: order.billing_address || order.customer?.address || '',
      shippingAddress: order.shipping_address || order.customer?.address || '',

      // Line items - include full configuration details
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

        return {
          id: item.id,
          description: item.product_name,
          details: `${item.width}" W x ${item.height}" H`,
          roomLabel: item.room_label || '',
          width: item.width,
          height: item.height,
          quantity: item.quantity,
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
          motorType: cfg.motorType || '',
          remoteType: cfg.remoteType || '',
          solarType: cfg.solarType || '',
          chainType: cfg.chainType || '',
          chainSide: cfg.chainSide || '',
          configuration: item.configuration || '{}'
        };
      }),

      // Totals
      subtotal: order.pricing?.subtotal || 0,
      tax: order.pricing?.tax || 0,
      taxRate: order.pricing?.tax_rate || 0.0725,
      shipping: order.pricing?.shipping || 0,
      discount: order.pricing?.discount || 0,
      total: order.pricing?.total || 0,
      currency: 'USD',

      // Payment info
      amountPaid: order.payment?.status === 'completed' ? order.pricing?.total : 0,
      amountDue: order.payment?.status === 'completed' ? 0 : order.pricing?.total,
      paymentMethod: order.payment?.method || null,
      paidAt: order.payment?.paid_at || null,

      // Dates
      issueDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
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
          motorType: cfg.motorType || '',
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
  generateInvoiceNumber,
  createInvoiceFromOrder,
  getInvoices,
  getInvoice,
  updateInvoice,
  recordPayment,
  getInvoiceSummary,
  updateOverdueInvoices,
  generateMissingInvoices
};
