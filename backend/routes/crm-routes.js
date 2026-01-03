/**
 * PEEKABOO SHADES - CRM/OMS/FINANCE/ANALYTICS ROUTES
 * ===================================================
 *
 * API routes for:
 * - Extended Pricing (manufacturer costs, margins)
 * - Manufacturer Management
 * - Price Import (PDF/CSV)
 * - Customer Price Rules
 * - Order Workflow & Status
 * - Shipment & Tracking
 * - Invoicing
 * - Finance & P&L
 * - Analytics
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Services
const { extendedPricingEngine } = require('../services/extended-pricing-engine');
const { priceImportService } = require('../services/price-import-service');
const { extendDatabase, ORDER_STATUS_WORKFLOW, CARRIERS } = require('../services/database-schema');

// Database path
const DB_PATH = path.join(__dirname, '../database.json');

// Helper functions
function loadDatabase() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading database:', error);
    return null;
  }
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

// File upload configuration for price imports
const priceImportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/price-imports');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const priceImportUpload = multer({
  storage: priceImportStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|pdf|xlsx/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (ext) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, PDF, and XLSX files are allowed'));
    }
  }
});

// ============================================
// DATABASE SCHEMA INITIALIZATION
// ============================================

/**
 * Initialize/extend database schema
 */
router.post('/init-schema', (req, res) => {
  try {
    const result = extendDatabase();
    res.json({
      success: result,
      message: result ? 'Database schema initialized successfully' : 'Failed to initialize schema'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EXTENDED PRICING API
// ============================================

/**
 * Calculate customer price with full breakdown
 * PUBLIC ENDPOINT - No auth required
 */
router.post('/pricing/calculate', (req, res) => {
  try {
    const result = extendedPricingEngine.calculateCustomerPrice(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get pricing summary for admin dashboard
 */
router.get('/pricing/summary', (req, res) => {
  try {
    const summary = extendedPricingEngine.getPricingSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Simulate pricing changes (what-if analysis)
 */
router.post('/pricing/simulate', (req, res) => {
  try {
    const result = extendedPricingEngine.simulatePricing(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// MANUFACTURER MANAGEMENT
// ============================================

/**
 * List manufacturers
 */
router.get('/manufacturers', (req, res) => {
  try {
    const db = loadDatabase();
    const manufacturers = db.manufacturers || [];
    res.json({ success: true, data: manufacturers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get manufacturer by ID
 */
router.get('/manufacturers/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const manufacturer = (db.manufacturers || []).find(m => m.id === req.params.id);
    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }
    res.json({ success: true, data: manufacturer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create manufacturer
 */
router.post('/manufacturers', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.manufacturers) db.manufacturers = [];

    const manufacturer = {
      id: `mfr-${uuidv4().slice(0, 8)}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin?.id || 'system'
    };

    db.manufacturers.push(manufacturer);
    saveDatabase(db);

    res.status(201).json({ success: true, data: manufacturer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update manufacturer
 */
router.put('/manufacturers/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.manufacturers || []).findIndex(m => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    db.manufacturers[index] = {
      ...db.manufacturers[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.admin?.id || 'system'
    };

    saveDatabase(db);
    res.json({ success: true, data: db.manufacturers[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete manufacturer
 */
router.delete('/manufacturers/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.manufacturers || []).findIndex(m => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    db.manufacturers.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Manufacturer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MANUFACTURER PRICES
// ============================================

/**
 * List manufacturer prices
 */
router.get('/manufacturer-prices', (req, res) => {
  try {
    const { manufacturerId, productType, fabricCode, status = 'active' } = req.query;
    const prices = priceImportService.getManufacturerPrices({
      manufacturerId,
      productType,
      fabricCode,
      status
    });
    res.json({ success: true, data: prices, total: prices.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Import prices from file (CSV or PDF)
 */
router.post('/manufacturer-prices/import', priceImportUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { manufacturerId = 'mfr-default', productType = 'roller' } = req.body;
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let result;
    if (ext === '.csv') {
      result = await priceImportService.importFromCSV(filePath, {
        manufacturerId,
        productType,
        userId: req.admin?.id || 'system'
      });
    } else if (ext === '.pdf') {
      result = await priceImportService.importFromPDF(filePath, {
        manufacturerId,
        productType,
        userId: req.admin?.id || 'system'
      });
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file type' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get import history
 */
router.get('/manufacturer-prices/import-history', (req, res) => {
  try {
    const { limit, status, manufacturerId } = req.query;
    const history = priceImportService.getImportHistory({
      limit: parseInt(limit) || 50,
      status,
      manufacturerId
    });
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Download CSV template
 */
router.get('/manufacturer-prices/template', (req, res) => {
  try {
    const { productType = 'roller' } = req.query;
    const csv = priceImportService.generateCSVTemplate(productType);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=price-import-template-${productType}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Scan downloads folder for price files
 */
router.get('/manufacturer-prices/scan-folder', (req, res) => {
  try {
    const { folderPath = '/Users/m_830614/Downloads' } = req.query;
    const files = priceImportService.scanDirectory(folderPath);
    res.json({ success: true, data: files, total: files.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create/update manufacturer price manually
 */
router.post('/manufacturer-prices', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.manufacturerPrices) db.manufacturerPrices = [];

    const price = {
      id: `mp-${uuidv4().slice(0, 8)}`,
      ...req.body,
      importSource: 'manual',
      importDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin?.id || 'system'
    };

    db.manufacturerPrices.push(price);
    saveDatabase(db);

    res.status(201).json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update manufacturer price
 */
router.put('/manufacturer-prices/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.manufacturerPrices || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Price record not found' });
    }

    db.manufacturerPrices[index] = {
      ...db.manufacturerPrices[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.admin?.id || 'system'
    };

    saveDatabase(db);
    res.json({ success: true, data: db.manufacturerPrices[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete manufacturer price
 */
router.delete('/manufacturer-prices/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.manufacturerPrices || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Price record not found' });
    }

    db.manufacturerPrices.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Price record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CUSTOMER PRICE RULES (MARGINS)
// ============================================

/**
 * List price rules
 */
router.get('/price-rules', (req, res) => {
  try {
    const db = loadDatabase();
    const rules = db.customerPriceRules || [];
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create price rule
 */
router.post('/price-rules', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.customerPriceRules) db.customerPriceRules = [];

    const rule = {
      id: `cpr-${uuidv4().slice(0, 8)}`,
      ...req.body,
      status: req.body.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin?.id || 'system'
    };

    db.customerPriceRules.push(rule);
    saveDatabase(db);

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update price rule
 */
router.put('/price-rules/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.customerPriceRules || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Price rule not found' });
    }

    db.customerPriceRules[index] = {
      ...db.customerPriceRules[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.admin?.id || 'system'
    };

    saveDatabase(db);
    res.json({ success: true, data: db.customerPriceRules[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete price rule
 */
router.delete('/price-rules/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.customerPriceRules || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Price rule not found' });
    }

    db.customerPriceRules.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Price rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ORDER STATUS WORKFLOW
// ============================================

/**
 * Get order status workflow configuration
 */
router.get('/order-workflow', (req, res) => {
  try {
    res.json({ success: true, data: ORDER_STATUS_WORKFLOW });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update order status with audit trail
 */
router.put('/orders/:id/status', (req, res) => {
  try {
    const { status, notes } = req.body;
    const db = loadDatabase();

    const orderIndex = (db.orders || []).findIndex(o => o.id === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = db.orders[orderIndex];
    const previousStatus = order.status;

    // Validate transition
    const validTransitions = ORDER_STATUS_WORKFLOW.transitions[previousStatus] || [];
    if (!validTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition from ${previousStatus} to ${status}`,
        validTransitions
      });
    }

    // Update order
    order.status = status;
    order.updatedAt = new Date().toISOString();

    // Add to status history
    if (!db.orderStatusHistory) db.orderStatusHistory = [];
    db.orderStatusHistory.push({
      id: `osh-${uuidv4().slice(0, 8)}`,
      orderId: order.id,
      previousStatus,
      newStatus: status,
      changedBy: req.admin?.id || 'system',
      changedByName: req.admin?.name || 'System',
      changedByRole: req.admin?.role || 'system',
      notes: notes || '',
      timestamp: new Date().toISOString()
    });

    saveDatabase(db);

    res.json({
      success: true,
      data: order,
      statusHistory: db.orderStatusHistory.filter(h => h.orderId === order.id)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get order status history
 */
router.get('/orders/:id/status-history', (req, res) => {
  try {
    const db = loadDatabase();
    const history = (db.orderStatusHistory || [])
      .filter(h => h.orderId === req.params.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SHIPMENTS & TRACKING
// ============================================

/**
 * Get carriers list
 */
router.get('/carriers', (req, res) => {
  try {
    res.json({ success: true, data: Object.values(CARRIERS) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create shipment for order
 */
router.post('/orders/:orderId/shipments', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.shipments) db.shipments = [];

    const order = (db.orders || []).find(o => o.id === req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const carrier = CARRIERS[req.body.carrier];
    const trackingUrl = carrier
      ? carrier.trackingUrlTemplate.replace('{trackingNumber}', req.body.trackingNumber)
      : null;

    const shipment = {
      id: `ship-${uuidv4().slice(0, 8)}`,
      orderId: req.params.orderId,
      ...req.body,
      trackingUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin?.id || 'system'
    };

    db.shipments.push(shipment);
    saveDatabase(db);

    res.status(201).json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get shipments for order
 */
router.get('/orders/:orderId/shipments', (req, res) => {
  try {
    const db = loadDatabase();
    const shipments = (db.shipments || []).filter(s => s.orderId === req.params.orderId);
    res.json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update shipment status
 */
router.put('/shipments/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.shipments || []).findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Shipment not found' });
    }

    db.shipments[index] = {
      ...db.shipments[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, data: db.shipments[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add tracking event
 */
router.post('/shipments/:id/tracking-events', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.trackingEvents) db.trackingEvents = [];

    const shipment = (db.shipments || []).find(s => s.id === req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, error: 'Shipment not found' });
    }

    const event = {
      id: `te-${uuidv4().slice(0, 8)}`,
      shipmentId: req.params.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      ...req.body,
      source: req.body.source || 'manual',
      createdAt: new Date().toISOString()
    };

    db.trackingEvents.push(event);

    // Update shipment status
    const shipmentIndex = db.shipments.findIndex(s => s.id === req.params.id);
    if (shipmentIndex >= 0 && req.body.status) {
      db.shipments[shipmentIndex].status = req.body.status;
      db.shipments[shipmentIndex].updatedAt = new Date().toISOString();
    }

    saveDatabase(db);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get tracking events for shipment
 */
router.get('/shipments/:id/tracking-events', (req, res) => {
  try {
    const db = loadDatabase();
    const events = (db.trackingEvents || [])
      .filter(e => e.shipmentId === req.params.id)
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// INVOICES
// ============================================

/**
 * List invoices
 */
router.get('/invoices', (req, res) => {
  try {
    const db = loadDatabase();
    let invoices = db.invoices || [];

    // Filters
    if (req.query.orderId) {
      invoices = invoices.filter(i => i.orderId === req.query.orderId);
    }
    if (req.query.status) {
      invoices = invoices.filter(i => i.status === req.query.status);
    }

    res.json({ success: true, data: invoices, total: invoices.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate invoice for order
 */
router.post('/invoices', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.invoices) db.invoices = [];

    const order = (db.orders || []).find(o => o.id === req.body.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Generate invoice number
    const invoiceCount = db.invoices.length + 1;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount).padStart(4, '0')}`;

    // Build line items with costs
    const lineItems = (order.items || []).map(item => {
      // Get manufacturer cost if available
      const priceRecord = (db.manufacturerPrices || []).find(p =>
        p.fabricCode === item.configuration?.fabricCode
      );
      const manufacturerCost = priceRecord?.basePrice || item.unitPrice * 0.5;
      const margin = item.unitPrice - manufacturerCost;

      return {
        id: uuidv4(),
        productId: item.productId,
        productName: item.productName,
        description: `${item.width}" x ${item.height}" ${item.configuration?.fabricCode || ''}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        manufacturerCost,
        margin,
        discount: 0,
        lineTotal: item.unitPrice * item.quantity
      };
    });

    const invoice = {
      id: `inv-${uuidv4().slice(0, 8)}`,
      invoiceNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer?.name,
      customerEmail: order.customer?.email,
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      lineItems,
      subtotal: order.subtotal || lineItems.reduce((sum, li) => sum + li.lineTotal, 0),
      discountAmount: order.discount || 0,
      discountCode: order.promoCode,
      shippingAmount: order.shipping || 0,
      taxRate: order.taxRate || 0.08,
      taxAmount: order.tax || 0,
      totalAmount: order.total,
      currency: 'USD',
      status: 'draft',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paidDate: null,
      paymentMethod: null,
      paymentId: null,
      notes: '',
      termsAndConditions: 'Payment due within 30 days. Thank you for your business.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin?.id || 'system'
    };

    db.invoices.push(invoice);
    saveDatabase(db);

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get invoice by ID
 */
router.get('/invoices/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const invoice = (db.invoices || []).find(i => i.id === req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update invoice
 */
router.put('/invoices/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.invoices || []).findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    db.invoices[index] = {
      ...db.invoices[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, data: db.invoices[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FINANCE & P&L
// ============================================

/**
 * Get finance summary
 */
router.get('/finance/summary', (req, res) => {
  try {
    const db = loadDatabase();
    const { from, to, period = 'month' } = req.query;

    // Calculate date range
    let startDate, endDate;
    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
    } else {
      endDate = new Date();
      startDate = new Date();
      if (period === 'day') {
        startDate.setDate(startDate.getDate() - 1);
      } else if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else if (period === 'quarter') {
        startDate.setMonth(startDate.getMonth() - 3);
      } else if (period === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }
    }

    // Filter orders by date
    const orders = (db.orders || []).filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // Calculate revenue
    const grossRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const refunds = (db.refunds || [])
      .filter(r => {
        const refundDate = new Date(r.createdAt);
        return refundDate >= startDate && refundDate <= endDate;
      })
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const netRevenue = grossRevenue - refunds;

    // Calculate costs
    let manufacturerCosts = 0;
    let shippingCosts = 0;

    for (const order of orders) {
      // Estimate manufacturer costs from order items
      for (const item of (order.items || [])) {
        const priceRecord = (db.manufacturerPrices || []).find(p =>
          p.fabricCode === item.configuration?.fabricCode
        );
        manufacturerCosts += priceRecord?.basePrice || (item.unitPrice * 0.5);
      }
      shippingCosts += order.shipping || 0;
    }

    // Get expenses
    const expenses = (db.expenses || [])
      .filter(e => {
        const expenseDate = new Date(e.createdAt);
        return expenseDate >= startDate && expenseDate <= endDate;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate profit
    const grossProfit = netRevenue - manufacturerCosts;
    const netProfit = grossProfit - shippingCosts - expenses;
    const marginPercent = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    // Tax summary
    const taxCollected = orders.reduce((sum, o) => sum + (o.tax || 0), 0);

    res.json({
      success: true,
      data: {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        orderCount: orders.length,
        revenue: {
          gross: Math.round(grossRevenue * 100) / 100,
          refunds: Math.round(refunds * 100) / 100,
          net: Math.round(netRevenue * 100) / 100
        },
        costs: {
          manufacturerCosts: Math.round(manufacturerCosts * 100) / 100,
          shippingCosts: Math.round(shippingCosts * 100) / 100,
          expenses: Math.round(expenses * 100) / 100
        },
        profit: {
          gross: Math.round(grossProfit * 100) / 100,
          net: Math.round(netProfit * 100) / 100,
          marginPercent: Math.round(marginPercent * 100) / 100
        },
        taxes: {
          collected: Math.round(taxCollected * 100) / 100
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get tax report
 */
router.get('/finance/tax-report', (req, res) => {
  try {
    const db = loadDatabase();
    const { period } = req.query;

    // Group tax by state
    const taxByState = {};

    for (const order of (db.orders || [])) {
      const state = order.shippingAddress?.state || 'Unknown';
      if (!taxByState[state]) {
        taxByState[state] = { state, taxableAmount: 0, taxCollected: 0, orderCount: 0 };
      }
      taxByState[state].taxableAmount += (order.subtotal || 0);
      taxByState[state].taxCollected += (order.tax || 0);
      taxByState[state].orderCount++;
    }

    const byState = Object.values(taxByState).sort((a, b) => b.taxCollected - a.taxCollected);
    const total = {
      taxableAmount: byState.reduce((sum, s) => sum + s.taxableAmount, 0),
      taxCollected: byState.reduce((sum, s) => sum + s.taxCollected, 0)
    };

    res.json({
      success: true,
      data: {
        period: period || 'all-time',
        byState,
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add expense
 */
router.post('/finance/expenses', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.expenses) db.expenses = [];

    const expense = {
      id: `exp-${uuidv4().slice(0, 8)}`,
      ...req.body,
      status: req.body.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.admin?.id || 'system'
    };

    db.expenses.push(expense);
    saveDatabase(db);

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * List expenses
 */
router.get('/finance/expenses', (req, res) => {
  try {
    const db = loadDatabase();
    let expenses = db.expenses || [];

    if (req.query.orderId) {
      expenses = expenses.filter(e => e.orderId === req.query.orderId);
    }
    if (req.query.category) {
      expenses = expenses.filter(e => e.category === req.query.category);
    }

    res.json({ success: true, data: expenses, total: expenses.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * Track analytics event
 * PUBLIC ENDPOINT
 */
router.post('/analytics/event', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.analyticsEvents) db.analyticsEvents = [];

    const event = {
      id: `ae-${uuidv4().slice(0, 8)}`,
      ...req.body,
      timestamp: new Date().toISOString()
    };

    db.analyticsEvents.push(event);
    saveDatabase(db);

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get funnel analytics
 */
router.get('/analytics/funnel', (req, res) => {
  try {
    const db = loadDatabase();
    const events = db.analyticsEvents || [];
    const { period = 'week' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (period === 'day') {
      startDate.setDate(startDate.getDate() - 1);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // Filter events by date
    const periodEvents = events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });

    // Count by event type
    const funnelStages = ['product_view', 'option_select', 'add_to_cart', 'checkout_start', 'payment_complete'];
    const counts = {};

    for (const stage of funnelStages) {
      counts[stage] = periodEvents.filter(e => e.eventType === stage).length;
    }

    // Build funnel with dropoff
    const funnel = funnelStages.map((stage, index) => {
      const count = counts[stage] || 0;
      const prevCount = index > 0 ? (counts[funnelStages[index - 1]] || 0) : count;
      const dropoffPercent = prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0;

      return {
        stage,
        count,
        dropoffPercent: Math.round(dropoffPercent * 10) / 10
      };
    });

    const conversionRate = counts['product_view'] > 0
      ? (counts['payment_complete'] / counts['product_view']) * 100
      : 0;

    res.json({
      success: true,
      data: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        stages: funnel,
        conversionRate: Math.round(conversionRate * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get segmentation analytics
 */
router.get('/analytics/segments', (req, res) => {
  try {
    const db = loadDatabase();
    const { type = 'product' } = req.query;
    const orders = db.orders || [];

    let segments = [];

    if (type === 'product') {
      // Segment by product type
      const byProduct = {};
      for (const order of orders) {
        for (const item of (order.items || [])) {
          const productName = item.productName || 'Unknown';
          if (!byProduct[productName]) {
            byProduct[productName] = { segment: productName, orders: 0, revenue: 0, quantity: 0 };
          }
          byProduct[productName].orders++;
          byProduct[productName].revenue += (item.unitPrice || 0) * (item.quantity || 1);
          byProduct[productName].quantity += item.quantity || 1;
        }
      }
      segments = Object.values(byProduct);
    } else if (type === 'device') {
      // Segment by device
      const events = db.analyticsEvents || [];
      const byDevice = {};
      for (const event of events) {
        const device = event.device || 'unknown';
        if (!byDevice[device]) {
          byDevice[device] = { segment: device, count: 0 };
        }
        byDevice[device].count++;
      }
      segments = Object.values(byDevice);
    } else if (type === 'geo') {
      // Segment by state
      const byState = {};
      for (const order of orders) {
        const state = order.shippingAddress?.state || 'Unknown';
        if (!byState[state]) {
          byState[state] = { segment: state, orders: 0, revenue: 0 };
        }
        byState[state].orders++;
        byState[state].revenue += order.total || 0;
      }
      segments = Object.values(byState);
    }

    // Calculate percentages
    const total = segments.reduce((sum, s) => sum + (s.orders || s.count || 0), 0);
    segments = segments.map(s => ({
      ...s,
      percent: total > 0 ? Math.round(((s.orders || s.count) / total) * 1000) / 10 : 0
    }));

    // Sort by orders/count descending
    segments.sort((a, b) => (b.orders || b.count || 0) - (a.orders || a.count || 0));

    res.json({
      success: true,
      data: {
        type,
        segments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PUBLIC ORDER TRACKING
// ============================================

/**
 * Track order (public endpoint with token)
 */
router.get('/track/:orderNumber', (req, res) => {
  try {
    const { token } = req.query;
    const db = loadDatabase();

    const order = (db.orders || []).find(o =>
      o.orderNumber === req.params.orderNumber
    );

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // In production, verify token matches order
    // For now, allow access with any token or email verification

    // Get status history
    const statusHistory = (db.orderStatusHistory || [])
      .filter(h => h.orderId === order.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Get shipments
    const shipments = (db.shipments || [])
      .filter(s => s.orderId === order.id)
      .map(s => {
        const carrier = CARRIERS[s.carrier];
        return {
          ...s,
          carrierName: carrier?.name || s.carrier,
          trackingUrl: s.trackingUrl || (carrier
            ? carrier.trackingUrlTemplate.replace('{trackingNumber}', s.trackingNumber)
            : null)
        };
      });

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        statusInfo: ORDER_STATUS_WORKFLOW.statuses.find(s => s.id === order.status),
        createdAt: order.createdAt,
        statusHistory: statusHistory.map(h => ({
          status: h.newStatus,
          statusInfo: ORDER_STATUS_WORKFLOW.statuses.find(s => s.id === h.newStatus),
          timestamp: h.timestamp,
          notes: h.notes
        })),
        shipments,
        estimatedDelivery: shipments[0]?.estimatedDelivery || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
