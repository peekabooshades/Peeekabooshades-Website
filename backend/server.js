const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { authMiddleware, generateToken, verifyToken } = require('./middleware/auth');

// ============================================
// ENTERPRISE SERVICES (Admin-Driven Architecture)
// ============================================
const { systemConfig } = require('./config/system-config');
const { pricingEngine } = require('./services/pricing-engine');
const { extendedPricingEngine } = require('./services/extended-pricing-engine');
const { auditLogger, AUDIT_ACTIONS, SEVERITY } = require('./services/audit-logger');
const { requirePermission, requireRole, ROLES } = require('./middleware/rbac');
const { validate, validateParams, sanitizeBody, isValidUUID } = require('./middleware/validation');
const { mediaManager, MEDIA_CATEGORIES } = require('./services/media-manager');
const { contentManager } = require('./services/content-manager');
const { realtimeSync } = require('./services/realtime-sync');
const { ORDER_STATES, createOrderFromCart, transitionOrderStatus, simulateFakePayment, getOrderWithHistory } = require('./services/order-service');
const { createOrderLedgerEntries, getEntriesForOrder, recordShippedProfit } = require('./services/ledger-service');
const analyticsService = require('./services/analytics-service');
const manufacturerService = require('./services/manufacturer-service');
const dealerService = require('./services/dealer-service');
const invoiceService = require('./services/invoice-service');

// ============================================
// CRM/OMS/FINANCE/ANALYTICS ROUTES
// ============================================
const crmRoutes = require('./routes/crm-routes');

// ============================================
// DATABASE SCHEMA INITIALIZATION
// ============================================
const { extendDatabase } = require('./services/database-schema');
// Initialize extended schema on server start
extendDatabase();

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../frontend/public/images/uploads');
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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 3001;

// Database file path
const DB_PATH = path.join(__dirname, 'database.json');

// ============================================
// DATABASE CACHING
// ============================================
let dbCache = null;
let dbCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds cache TTL

// Initialize database
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      categories: [
        { id: uuidv4(), name: 'Roller Shades', slug: 'roller-shades', description: 'Affordable custom roller blinds & shades' },
        { id: uuidv4(), name: 'Roman Shades', slug: 'roman-shades', description: 'Energy efficient roman shades' },
        { id: uuidv4(), name: 'Natural Woven Shades', slug: 'natural-woven-shades', description: 'Natural woven window blinds' },
        { id: uuidv4(), name: 'Honeycomb/Cellular Shades', slug: 'honeycomb-shades', description: 'Honeycomb cellular shades' },
        { id: uuidv4(), name: 'Drapes', slug: 'drapes', description: 'Custom drapes and curtains' }
      ],
      products: [],
      cart: [],
      orders: [],
      quotes: [],
      faqs: [
        {
          id: uuidv4(),
          question: 'How do I measure my window for the right fit?',
          answer: 'Measure the width and height of your window opening in inches. For inside mount, measure the exact opening. For outside mount, add 2-3 inches on each side for optimal coverage and light blockage.'
        },
        {
          id: uuidv4(),
          question: 'Are the blinds easy to install?',
          answer: 'Yes! All our blinds come with easy-to-follow installation instructions and mounting hardware. Most customers complete installation in 15-30 minutes per window.'
        },
        {
          id: uuidv4(),
          question: 'What is your return policy?',
          answer: 'We offer a 30-day satisfaction guarantee on all products. If you\'re not completely satisfied, you can return unused items in original packaging for a full refund.'
        }
      ],
      roomLabels: [
        'Master Bedroom', 'Guest Bedroom', 'Living Room', 'Dining Room',
        'Kitchen', 'Bathroom', 'Office', 'Kids Room', 'Nursery', 'Other'
      ]
    };

    // Add sample products
    const categories = initialData.categories;
    initialData.products = [
      {
        id: uuidv4(),
        category_id: categories[0].id,
        category_name: 'Roller Shades',
        category_slug: 'roller-shades',
        name: 'Affordable Custom Roller Blinds & shades',
        slug: 'affordable-custom-roller-blinds',
        description: 'Discover our selection! Roller blinds offer a clean and sleek line that complements any home style.',
        base_price: 40.00,
        sale_price: null,
        is_featured: true,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[1].id,
        category_name: 'Roman Shades',
        category_slug: 'roman-shades',
        name: 'Energy Efficient Roman Shades',
        slug: 'energy-efficient-roman-shades',
        description: 'Premium roman shades with energy efficient design. Perfect for any room.',
        base_price: 89.79,
        sale_price: null,
        is_featured: true,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[2].id,
        category_name: 'Natural Woven Shades',
        category_slug: 'natural-woven-shades',
        name: 'Affordable Custom Zebra Window Blinds',
        slug: 'affordable-zebra-window-blinds',
        description: 'Natural woven shades - Timeless Elegance with Organic Appeal',
        base_price: 50.00,
        sale_price: null,
        is_featured: true,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[3].id,
        category_name: 'Honeycomb Shades',
        category_slug: 'honeycomb-shades',
        name: 'Natural Woven Shades - Timeless Elegance',
        slug: 'natural-woven-timeless',
        description: 'Honeycomb cellular shades for energy efficiency',
        base_price: 65.00,
        sale_price: null,
        is_featured: true,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[0].id,
        category_name: 'Roller Shades',
        category_slug: 'roller-shades',
        name: 'Blackout Roller Blinds',
        slug: 'blackout-roller-blinds',
        description: 'Complete blackout roller blinds for bedrooms',
        base_price: 45.00,
        sale_price: null,
        is_featured: false,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[1].id,
        category_name: 'Roman Shades',
        category_slug: 'roman-shades',
        name: 'Premium Roman Window Shades',
        slug: 'premium-roman-window-shades',
        description: 'Luxurious roman shades with premium fabric',
        base_price: 95.00,
        sale_price: null,
        is_featured: false,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[4].id,
        category_name: 'Drapes',
        category_slug: 'drapes',
        name: 'Custom Blackout Drapes',
        slug: 'custom-blackout-drapes',
        description: 'Custom made blackout drapes',
        base_price: 120.00,
        sale_price: null,
        is_featured: false,
        is_active: true
      },
      {
        id: uuidv4(),
        category_id: categories[3].id,
        category_name: 'Honeycomb Shades',
        category_slug: 'honeycomb-shades',
        name: 'Cellular Honeycomb Blinds',
        slug: 'cellular-honeycomb-blinds',
        description: 'Energy efficient cellular blinds',
        base_price: 70.00,
        sale_price: null,
        is_featured: false,
        is_active: true
      }
    ];

    saveDatabase(initialData);
    console.log('Database initialized with sample data');
  }
}

// Load database with caching
function loadDatabase() {
  const now = Date.now();
  if (dbCache && (now - dbCacheTime) < CACHE_TTL) {
    return dbCache;
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    dbCache = JSON.parse(data);
    dbCacheTime = now;
    return dbCache;
  } catch (error) {
    initDatabase();
    const data = fs.readFileSync(DB_PATH, 'utf8');
    dbCache = JSON.parse(data);
    dbCacheTime = now;
    return dbCache;
  }
}

// Save database and invalidate cache
function saveDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  dbCache = data;
  dbCacheTime = Date.now();
}

// Middleware
app.use(compression({ level: 6 })); // Enable gzip compression
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files with cache headers
app.use(express.static(path.join(__dirname, '../frontend/public'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Longer cache for images
    if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.svg') || filePath.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    }
    // No cache for JS/CSS during development
    else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // NO CACHE for HTML files - always serve fresh during development
    else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Initialize database on startup
initDatabase();

// ============================================
// MOUNT CRM/OMS/FINANCE/ANALYTICS ROUTES
// ============================================
// Public pricing endpoint (no auth)
app.use('/api/v1', crmRoutes);

// Admin CRM routes (auth required for most)
app.use('/api/admin/crm', authMiddleware, crmRoutes);

// Public order tracking (no auth, uses token verification)
app.use('/api/public', crmRoutes);

// ============================================
// API ROUTES
// ============================================

// Get all categories
app.get('/api/categories', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all products with optional filtering
app.get('/api/products', (req, res) => {
  try {
    const db = loadDatabase();
    const { category, featured, search, sort, limit, offset } = req.query;

    let products = db.products.filter(p => p.is_active);

    if (category) {
      products = products.filter(p => p.category_slug === category);
    }

    if (featured === 'true') {
      products = products.filter(p => p.is_featured);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        products.sort((a, b) => a.base_price - b.base_price);
        break;
      case 'price_desc':
        products.sort((a, b) => b.base_price - a.base_price);
        break;
      case 'name':
        products.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    const total = products.length;

    // Pagination
    if (offset) {
      products = products.slice(parseInt(offset));
    }
    if (limit) {
      products = products.slice(0, parseInt(limit));
    }

    res.json({ success: true, data: products, total });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single product by slug
app.get('/api/products/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const product = db.products.find(p => p.slug === req.params.slug);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get room labels
app.get('/api/room-labels', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.roomLabels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CART ROUTES
// ============================================

// Get cart items
app.get('/api/cart/:sessionId', (req, res) => {
  try {
    const db = loadDatabase();
    const items = db.cart.filter(item => item.session_id === req.params.sessionId);

    // Use line_total which already includes (unit_price × quantity) + accessories
    const subtotal = items.reduce((sum, item) => sum + (item.line_total || item.unit_price * item.quantity), 0);

    res.json({
      success: true,
      data: items,
      subtotal,
      itemCount: items.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add to cart - CRITICAL: Price is ALWAYS calculated server-side
app.post('/api/cart', (req, res) => {
  try {
    const db = loadDatabase();
    const {
      sessionId, productId, quantity, width, height,
      roomLabel, configuration, extendedWarranty, options
    } = req.body;

    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    // Verify product exists and is active
    const product = db.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    if (!product.is_active) {
      return res.status(400).json({ success: false, error: 'Product is not available' });
    }

    // CRITICAL: Calculate price SERVER-SIDE using pricing engine
    // NEVER trust client-provided price

    // Parse configuration if it's a string
    let configObj = configuration;
    if (typeof configuration === 'string') {
      try { configObj = JSON.parse(configuration); } catch (e) { configObj = {}; }
    }
    configObj = configObj || {};

    // Build options object from configuration for pricing engine
    const pricingOptions = {
      fabricCode: configObj.fabricCode,
      controlType: configObj.controlType,
      motorType: configObj.motorType,
      // Motor brand can come from motorBrand field or chainType (legacy)
      motorBrand: configObj.motorBrand || configObj.chainType,
      remoteType: configObj.remoteType,
      solarType: configObj.solarType,
      smartHubQty: configObj.smartHubQty || 0,
      usbChargerQty: configObj.usbChargerQty || 0,
      // Hardware options - pass directly for pricing engine
      // BUG-006 FIX: Prioritize valanceType/bottomRail over standardCassette/standardBottomBar
      // Frontend may send both fields with different values - valanceType/bottomRail are the correct pricing keys
      standardCassette: configObj.valanceType || configObj.standardCassette,
      valanceType: configObj.valanceType || configObj.standardCassette,
      standardBottomBar: configObj.bottomRail || configObj.standardBottomBar,
      bottomRail: configObj.bottomRail || configObj.standardBottomBar,
      rollerType: configObj.rollerType,
      // Also keep nested hardware for backward compatibility
      hardware: {
        cassette: configObj.valanceType || configObj.standardCassette,
        bottomBar: configObj.bottomRail || configObj.standardBottomBar,
        rollerType: configObj.rollerType
      },
      ...options // Allow override with explicit options
    };

    // TICKET 009: Use ExtendedPricingEngine for customer vs manufacturer pricing split
    let priceResult;
    try {
      priceResult = extendedPricingEngine.calculateCustomerPrice({
        productId,
        productSlug: product.slug,
        productType: product.category_slug?.replace('-shades', '') || 'roller',
        width: width || 24,
        height: height || 36,
        quantity: quantity || 1,
        fabricCode: pricingOptions.fabricCode,
        options: pricingOptions
      });
    } catch (priceError) {
      return res.status(400).json({ success: false, error: priceError.message });
    }

    if (!priceResult.success) {
      return res.status(400).json({ success: false, error: 'Price calculation failed' });
    }

    const now = new Date().toISOString();
    // BUG-019 FIX: Include product_slug and product_type for proper product type identification
    const productType = product.category_slug?.replace('-shades', '') || 'roller';
    const cartItem = {
      id: uuidv4(),
      session_id: sessionId,
      product_id: productId,
      product_name: product.name,
      product_slug: product.slug,
      product_type: productType,
      quantity: quantity || 1,
      width: priceResult.dimensions.width,
      height: priceResult.dimensions.height,
      room_label: roomLabel || '',
      configuration: typeof configuration === 'string' ? configuration : JSON.stringify(configuration || {}),
      // CRITICAL: Use server-calculated CUSTOMER price (manufacturer + margin)
      unit_price: priceResult.pricing.unitPrice,
      line_total: priceResult.pricing.lineTotal,
      extended_warranty: extendedWarranty ? 1 : 0,
      // TICKET 009: Store BOTH manufacturer and customer price breakdowns
      price_snapshot: {
        captured_at: now,
        manufacturer_price: {
          unit_cost: priceResult.pricing.manufacturerCost.unitCost,
          total_cost: priceResult.pricing.manufacturerCost.totalCost,
          source: priceResult.pricing.manufacturerCost.source,
          fabric_code: priceResult.fabricCode
        },
        margin: {
          type: priceResult.pricing.margin.type,
          value: priceResult.pricing.margin.value,
          amount: priceResult.pricing.margin.amount,
          percentage: priceResult.pricing.margin.percentage
        },
        customer_price: {
          unit_price: priceResult.pricing.unitPrice,
          line_total: priceResult.pricing.lineTotal,
          options_total: priceResult.pricing.options.total,
          options_breakdown: priceResult.pricing.options.breakdown,
          accessories_total: priceResult.pricing.accessories?.total || 0,
          accessories_breakdown: priceResult.pricing.accessories?.breakdown || []
        }
      },
      created_at: now
    };

    db.cart.push(cartItem);
    saveDatabase(db);

    res.json({
      success: true,
      message: 'Item added to cart',
      cartItemId: cartItem.id,
      // TICKET 009: Return customer-facing price only
      pricing: {
        unitPrice: priceResult.pricing.unitPrice,
        lineTotal: priceResult.pricing.lineTotal,
        optionsTotal: priceResult.pricing.options.total
      },
      // Full breakdown for debugging (admin can see manufacturer cost)
      priceSnapshot: cartItem.price_snapshot
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update cart item
app.put('/api/cart/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const { quantity } = req.body;

    const item = db.cart.find(i => i.id === req.params.id);
    if (item) {
      item.quantity = quantity;
      saveDatabase(db);
    }

    res.json({ success: true, message: 'Cart updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove from cart
app.delete('/api/cart/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const index = db.cart.findIndex(i => i.id === req.params.id);
    if (index > -1) {
      db.cart.splice(index, 1);
      saveDatabase(db);
    }

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear cart
app.delete('/api/cart/clear/:sessionId', (req, res) => {
  try {
    const db = loadDatabase();
    db.cart = db.cart.filter(item => item.session_id !== req.params.sessionId);
    saveDatabase(db);

    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ORDER ROUTES
// ============================================

// Create order
app.post('/api/orders', (req, res) => {
  try {
    const db = loadDatabase();
    // BUG-008 FIX: Also extract shippingState and taxRate for record keeping
    const {
      sessionId, customerName, customerEmail, customerPhone,
      shippingAddress, shippingState, taxRate, subtotal, tax, shipping
    } = req.body;

    const orderId = uuidv4();
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
    const total = subtotal + (tax || 0) + (shipping || 0);

    // Get cart items
    const cartItems = db.cart.filter(item => item.session_id === sessionId);

    // Calculate manufacturer cost totals from item price_snapshots
    let totalManufacturerCost = 0;
    let totalOptionsManufacturerCost = 0;
    let totalAccessoriesManufacturerCost = 0;

    cartItems.forEach(item => {
      const ps = item.price_snapshot || {};
      const mfrPrice = ps.manufacturer_price || {};
      const customerPrice = ps.customer_price || {};
      const qty = item.quantity || 1;

      // Fabric manufacturer cost
      totalManufacturerCost += (mfrPrice.unit_cost || mfrPrice.cost || 0) * qty;

      // Options manufacturer cost
      const optionsBreakdown = customerPrice.options_breakdown || [];
      optionsBreakdown.forEach(opt => {
        totalOptionsManufacturerCost += (opt.manufacturerCost || 0) * qty;
      });

      // Accessories manufacturer cost
      const accessoriesBreakdown = customerPrice.accessories_breakdown || [];
      accessoriesBreakdown.forEach(acc => {
        totalAccessoriesManufacturerCost += (acc.manufacturerCost || 0);
      });
    });

    const totalMfrCost = totalManufacturerCost + totalOptionsManufacturerCost + totalAccessoriesManufacturerCost;
    const marginTotal = subtotal - totalMfrCost;
    const marginPercent = subtotal > 0 ? ((marginTotal / subtotal) * 100) : 0;

    const order = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      shipping_address: shippingAddress,
      // BUG-008 FIX: Store shipping state and tax rate for audit/display
      shipping_state: shippingState || null,
      tax_rate: taxRate || null,
      subtotal,
      tax: tax || 0,
      shipping: shipping || 0,
      total,
      status: 'pending',
      items: cartItems.map(item => ({
        ...item,
        order_id: orderId
      })),
      // Add pricing object with manufacturer cost analysis
      pricing: {
        subtotal,
        tax: tax || 0,
        tax_rate: taxRate || null,
        shipping: shipping || 0,
        total,
        manufacturer_cost_total: Math.round(totalMfrCost * 100) / 100,
        margin_total: Math.round(marginTotal * 100) / 100,
        margin_percent: Math.round(marginPercent * 100) / 100
      },
      created_at: new Date().toISOString()
    };

    db.orders.push(order);

    // Clear cart
    db.cart = db.cart.filter(item => item.session_id !== sessionId);
    saveDatabase(db);

    // Auto-generate customer invoice
    let invoice = null;
    try {
      invoice = invoiceService.createInvoiceFromOrder(order.id, 'customer', {
        notes: 'Auto-generated with order'
      });
      console.log(`Invoice ${invoice.invoiceNumber} created for order ${order.order_number}`);
    } catch (invoiceError) {
      console.error('Invoice creation error (non-fatal):', invoiceError.message);
    }

    res.json({
      success: true,
      message: 'Order created successfully',
      orderId,
      orderNumber,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order by number
app.get('/api/orders/:orderNumber', (req, res) => {
  try {
    const db = loadDatabase();
    const order = db.orders.find(o => o.order_number === req.params.orderNumber);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Checkout endpoint (Ticket 002: Fake Checkout + Orders + Ledger)
app.post('/api/checkout', (req, res) => {
  try {
    const { sessionId, customer, payment } = req.body;

    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    if (!customer || !customer.name || !customer.email) {
      return res.status(400).json({ success: false, error: 'Customer name and email are required' });
    }

    // Create order from cart using order-service
    const order = createOrderFromCart(sessionId, customer, payment || {}, 'customer');

    // Simulate fake payment if PAYMENT_MODE=fake (default for local dev)
    const paymentMode = process.env.PAYMENT_MODE || 'fake';
    if (paymentMode === 'fake') {
      simulateFakePayment(order.id, 'system');
      order.status = ORDER_STATES.ORDER_RECEIVED;
      order.payment.status = 'completed';
    }

    // Create ledger entries
    const ledgerEntries = createOrderLedgerEntries(order);

    // Track analytics event (Ticket 003)
    analyticsService.trackOrderCompletion(order);

    // TICKET 012: Create customer invoice automatically with order
    let invoice = null;
    try {
      invoice = invoiceService.createInvoiceFromOrder(order.id, 'customer', {
        notes: 'Auto-generated with order'
      });
      console.log(`Invoice ${invoice.invoiceNumber} created for order ${order.order_number}`);
    } catch (invoiceError) {
      // Log but don't fail checkout if invoice creation fails
      console.error('Invoice creation error (non-fatal):', invoiceError.message);
    }

    res.json({
      success: true,
      message: 'Checkout complete',
      data: {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          total: order.pricing.total,
          itemCount: order.items.length
        },
        payment: {
          status: order.payment.status,
          method: order.payment.method
        },
        ledgerEntriesCreated: ledgerEntries.length,
        // TICKET 012: Include invoice info in response
        invoice: invoice ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          total: invoice.total
        } : null
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    // TICKET 010: Handle price validation errors specially
    if (error.code === 'PRICE_VALIDATION_FAILED') {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'PRICE_VALIDATION_FAILED',
        issues: error.issues,
        action: 'Please refresh your cart to get updated pricing'
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order with status history
app.get('/api/orders/:orderId/history', (req, res) => {
  try {
    const order = getOrderWithHistory(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get ledger entries for an order
app.get('/api/orders/:orderId/ledger', (req, res) => {
  try {
    const entries = getEntriesForOrder(req.params.orderId);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transition order status (admin)
app.post('/api/orders/:orderId/transition', authMiddleware, (req, res) => {
  try {
    const { newStatus, reason } = req.body;
    const userId = req.user?.id || 'admin';

    const order = transitionOrderStatus(req.params.orderId, newStatus, userId, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// QUOTE ROUTES
// ============================================

// Request quote
app.post('/api/quotes', (req, res) => {
  try {
    const db = loadDatabase();
    const {
      customerName, customerEmail, customerPhone, productId,
      productName, configuration, width, height, quantity, message
    } = req.body;

    const quoteId = uuidv4();
    const quoteNumber = 'QT-' + Date.now().toString(36).toUpperCase();

    const quote = {
      id: quoteId,
      quote_number: quoteNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      product_id: productId,
      product_name: productName,
      configuration: typeof configuration === 'string' ? configuration : JSON.stringify(configuration),
      width,
      height,
      quantity: quantity || 1,
      message,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    db.quotes.push(quote);
    saveDatabase(db);

    res.json({
      success: true,
      message: 'Quote request submitted successfully',
      quoteNumber
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FAQ ROUTES
// ============================================

app.get('/api/faqs', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.faqs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PUBLIC PAGES ROUTES
// ============================================

// Get page by slug (public)
app.get('/api/pages/by-slug/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const slug = req.params.slug.startsWith('/') ? req.params.slug : '/' + req.params.slug;
    const page = (db.pages || []).find(p => {
      const pageSlug = p.slug.startsWith('/') ? p.slug : '/' + p.slug;
      return pageSlug === slug && (p.isPublished || p.isVisible);
    });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all published pages (public)
app.get('/api/pages', (req, res) => {
  try {
    const db = loadDatabase();
    const pages = (db.pages || []).filter(p => p.isPublished || p.isVisible).map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug
    }));
    res.json({ success: true, pages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CONTACT ROUTES
// ============================================

app.post('/api/contact', (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // In production, you would save this to database and/or send email
    console.log('Contact form submission:', { name, email, phone, subject, message });

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRICE CALCULATOR (Using Centralized Pricing Engine)
// ============================================

/**
 * Calculate product price - ALL pricing logic is server-side
 * Frontend should NEVER calculate prices locally
 */
app.post('/api/calculate-price', (req, res) => {
  try {
    const { productId, width, height, options, quantity, extendedWarranty } = req.body;

    // Use centralized pricing engine
    const result = pricingEngine.calculateProductPrice({
      productId,
      width: width || 24,
      height: height || 36,
      quantity: quantity || 1,
      options: options || {},
      extendedWarranty: extendedWarranty || false
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: 'Price calculation failed' });
    }

    res.json({
      success: true,
      ...result.pricing,
      breakdown: result.breakdown
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * V1 Pricing API - Uses Extended Pricing Engine with fabric-based cordless pricing
 * This is the PREFERRED pricing endpoint for product pages
 */
app.post('/api/v1/pricing/calculate', (req, res) => {
  try {
    const { productSlug, productType, width, height, quantity, fabricCode, options } = req.body;

    // Find product by slug
    const db = getDatabase();
    const product = db.products.find(p => p.slug === productSlug);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Use extended pricing engine with fabric-based pricing
    const result = extendedPricingEngine.calculateCustomerPrice({
      productId: product.id,
      productSlug: productSlug,
      productType: productType || product.category_slug?.replace('-shades', '') || 'roller',
      fabricCode: fabricCode || null,
      width: width || 24,
      height: height || 36,
      quantity: quantity || 1,
      options: options || {}
    });

    res.json(result);
  } catch (error) {
    console.error('V1 Pricing error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Calculate complete order total - including tax, shipping, discounts
 * This is the ONLY source of truth for order pricing
 */
app.post('/api/calculate-order-total', (req, res) => {
  try {
    const { items, shippingAddress, promoCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided' });
    }

    const db = loadDatabase();
    const lineItems = [];
    let subtotal = 0;

    // Calculate each item using extendedPricingEngine (same as cart)
    for (const item of items) {
      const product = db.products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const priceResult = extendedPricingEngine.calculateCustomerPrice({
        productId: item.productId,
        productSlug: product.slug,
        productType: product.category_slug?.replace('-shades', '') || 'roller',
        width: item.width || 24,
        height: item.height || 36,
        quantity: item.quantity || 1,
        fabricCode: item.options?.fabricCode,
        options: item.options || {}
      });

      if (!priceResult.success) {
        throw new Error(`Pricing failed for product ${item.productId}`);
      }

      lineItems.push({
        itemId: item.id,
        productId: product.id,
        productName: product.name,
        unitPrice: priceResult.pricing.unitPrice,
        lineTotal: priceResult.pricing.lineTotal,
        quantity: priceResult.quantity
      });

      subtotal += priceResult.pricing.lineTotal;
    }

    // Calculate tax (CA default 7.25%)
    const taxRate = 0.0725;
    const taxAmount = subtotal * taxRate;

    // Calculate shipping
    const shippingAmount = subtotal >= 99 ? 0 : 9.99;

    // Calculate grand total
    const grandTotal = subtotal + taxAmount + shippingAmount;

    res.json({
      success: true,
      lineItems,
      summary: {
        subtotal: Math.round(subtotal * 100) / 100,
        discount: { code: null, amount: 0, description: null },
        tax: {
          rate: taxRate,
          amount: Math.round(taxAmount * 100) / 100,
          description: 'California Sales Tax'
        },
        shipping: {
          method: shippingAmount === 0 ? 'free' : 'standard',
          amount: shippingAmount,
          description: shippingAmount === 0 ? 'Free shipping' : 'Standard shipping'
        },
        grandTotal: Math.round(grandTotal * 100) / 100
      },
      currency: 'USD'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get pricing configuration (for frontend to display rules, NOT calculate)
 */
app.get('/api/pricing-config', (req, res) => {
  try {
    const config = systemConfig.loadConfig();

    // Return only display information, not calculation rules
    res.json({
      success: true,
      data: {
        currency: config.pricing.currency,
        freeShippingThreshold: config.shipping.freeShippingThreshold,
        dimensions: config.products.dimensions,
        warrantyOptions: {
          extended: {
            price: config.pricing.warranty.extended.price,
            duration: config.pricing.warranty.extended.duration
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN AUTHENTICATION ROUTES
// ============================================

// Admin Login
app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const db = loadDatabase();

    const admin = db.adminUsers.find(u => u.email === email);

    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValidPassword = bcrypt.compareSync(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Update last login
    admin.lastLogin = new Date().toISOString();
    saveDatabase(db);

    const token = generateToken(admin);

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify Token
app.get('/api/admin/verify', authMiddleware, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ============================================
// ADMIN DASHBOARD ROUTES
// ============================================

app.get('/api/admin/dashboard', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();

    // Calculate stats
    const totalOrders = db.orders.length;
    const pendingOrders = db.orders.filter(o => o.status === 'pending').length;
    const totalRevenue = db.orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalProducts = db.products.length;
    const activeProducts = db.products.filter(p => p.is_active).length;
    const totalQuotes = db.quotes.length;
    const pendingQuotes = db.quotes.filter(q => q.status === 'pending').length;

    // Invoice stats
    const invoices = db.invoices || [];
    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter(i => i.status === 'paid').length;
    const pendingInvoices = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length;
    const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;
    const totalInvoiceValue = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
    const totalDue = invoices.reduce((sum, i) => sum + (i.amountDue || 0), 0);

    // Recent orders (last 5)
    const recentOrders = db.orders
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Recent quotes (last 5)
    const recentQuotes = db.quotes
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Recent invoices (last 5)
    const recentInvoices = invoices
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        stats: {
          totalOrders,
          pendingOrders,
          totalRevenue,
          totalProducts,
          activeProducts,
          totalQuotes,
          pendingQuotes,
          totalInvoices,
          paidInvoices,
          pendingInvoices,
          overdueInvoices,
          totalInvoiceValue,
          totalPaid,
          totalDue
        },
        recentOrders,
        recentQuotes,
        recentInvoices
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN PRODUCTS ROUTES
// ============================================

// Get all products (including inactive)
app.get('/api/admin/products', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { search, category, status, featured } = req.query;

    let products = [...db.products];

    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.slug.toLowerCase().includes(searchLower)
      );
    }

    if (category) {
      products = products.filter(p => p.category_slug === category);
    }

    if (status === 'active') {
      products = products.filter(p => p.is_active);
    } else if (status === 'inactive') {
      products = products.filter(p => !p.is_active);
    }

    if (featured === 'true') {
      products = products.filter(p => p.is_featured);
    } else if (featured === 'false') {
      products = products.filter(p => !p.is_featured);
    }

    res.json({ success: true, data: products, total: products.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single product by ID
app.get('/api/admin/products/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const product = db.products.find(p => p.id === req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create product
app.post('/api/admin/products', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { name, slug, description, category_id, base_price, sale_price, is_featured, is_active, image_url } = req.body;

    // Get category info
    const category = db.categories.find(c => c.id === category_id);
    if (!category) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }

    // Check slug uniqueness
    const existingSlug = db.products.find(p => p.slug === slug);
    if (existingSlug) {
      return res.status(400).json({ success: false, error: 'Slug already exists' });
    }

    const product = {
      id: uuidv4(),
      name,
      slug,
      description,
      category_id,
      category_name: category.name,
      category_slug: category.slug,
      base_price: parseFloat(base_price),
      sale_price: sale_price ? parseFloat(sale_price) : null,
      is_featured: is_featured || false,
      is_active: is_active !== false,
      image_url: image_url || null,
      gallery_images: req.body.gallery_images || [],
      created_at: new Date().toISOString()
    };

    db.products.push(product);
    saveDatabase(db);

    res.json({ success: true, message: 'Product created', data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product
app.put('/api/admin/products/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const productIndex = db.products.findIndex(p => p.id === req.params.id);

    if (productIndex === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const { name, slug, description, category_id, base_price, sale_price, is_featured, is_active, image_url, stock_status, is_discontinued } = req.body;

    // Check slug uniqueness (exclude current product)
    if (slug && slug !== db.products[productIndex].slug) {
      const existingSlug = db.products.find(p => p.slug === slug && p.id !== req.params.id);
      if (existingSlug) {
        return res.status(400).json({ success: false, error: 'Slug already exists' });
      }
    }

    // Get category info if changed
    if (category_id) {
      const category = db.categories.find(c => c.id === category_id);
      if (!category) {
        return res.status(400).json({ success: false, error: 'Invalid category' });
      }
      db.products[productIndex].category_id = category_id;
      db.products[productIndex].category_name = category.name;
      db.products[productIndex].category_slug = category.slug;
    }

    // Update fields
    if (name) db.products[productIndex].name = name;
    if (slug) db.products[productIndex].slug = slug;
    if (description !== undefined) db.products[productIndex].description = description;
    if (base_price !== undefined) db.products[productIndex].base_price = parseFloat(base_price);
    if (sale_price !== undefined) db.products[productIndex].sale_price = sale_price ? parseFloat(sale_price) : null;
    if (is_featured !== undefined) db.products[productIndex].is_featured = is_featured;
    if (is_active !== undefined) db.products[productIndex].is_active = is_active;
    if (image_url !== undefined) db.products[productIndex].image_url = image_url;
    if (req.body.gallery_images !== undefined) db.products[productIndex].gallery_images = req.body.gallery_images;
    // New fields for stock and discontinued status
    if (stock_status !== undefined) {
      if (!['in_stock', 'out_of_stock'].includes(stock_status)) {
        return res.status(400).json({ success: false, error: 'Invalid stock_status. Must be in_stock or out_of_stock' });
      }
      db.products[productIndex].stock_status = stock_status;
    }
    if (is_discontinued !== undefined) db.products[productIndex].is_discontinued = Boolean(is_discontinued);

    db.products[productIndex].updated_at = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, message: 'Product updated', data: db.products[productIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete product
app.delete('/api/admin/products/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = db.products.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    db.products.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle product active status
app.put('/api/admin/products/:id/toggle', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const product = db.products.find(p => p.id === req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    product.is_active = !product.is_active;
    saveDatabase(db);

    res.json({ success: true, message: `Product ${product.is_active ? 'activated' : 'deactivated'}`, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle product featured status
app.put('/api/admin/products/:id/featured', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const product = db.products.find(p => p.id === req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    product.is_featured = !product.is_featured;
    saveDatabase(db);

    res.json({ success: true, message: `Product ${product.is_featured ? 'featured' : 'unfeatured'}`, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN ORDERS ROUTES
// ============================================

// Get all orders
app.get('/api/admin/orders', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { status, search } = req.query;

    let orders = [...(db.orders || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter(o => {
        const orderNum = (o.order_number || o.orderNumber || '').toLowerCase();
        const custName = (o.customer_name || o.customer?.name || '').toLowerCase();
        const custEmail = (o.customer_email || o.customer?.email || '').toLowerCase();
        return orderNum.includes(searchLower) || custName.includes(searchLower) || custEmail.includes(searchLower);
      });
    }

    // Normalize order data for frontend compatibility
    const normalizedOrders = orders.map(o => ({
      ...o,
      order_number: o.order_number || o.orderNumber,
      customer_name: o.customer_name || o.customer?.name || 'Guest',
      customer_email: o.customer_email || o.customer?.email || '',
      total: o.total || o.pricing?.total || 0
    }));

    res.json({ success: true, orders: normalizedOrders, total: normalizedOrders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single order
app.get('/api/admin/orders/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    // Search by id OR order_number
    const order = db.orders.find(o => o.id === req.params.id || o.order_number === req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// TICKET 011: Validation function for ORDER_RECEIVED transition
function validateOrderReceivedTransition(order, db) {
  const errors = [];
  const warnings = [];

  // 1. Check if invoice exists and is linked to order
  const invoice = (db.invoices || []).find(inv =>
    inv.orderId === order.id || inv.order_id === order.id
  );

  if (!invoice) {
    errors.push({
      code: 'INVOICE_MISSING',
      message: 'Invoice must be created before transitioning to ORDER_RECEIVED'
    });
  } else {
    // 2. Validate invoice totals match order customer totals
    const orderTotal = order.total || order.pricing?.total;
    const invoiceTotal = invoice.total || invoice.amount;

    if (Math.abs(orderTotal - invoiceTotal) > 0.01) {
      errors.push({
        code: 'INVOICE_TOTAL_MISMATCH',
        message: `Invoice total ($${invoiceTotal}) does not match order total ($${orderTotal})`,
        orderTotal,
        invoiceTotal,
        difference: Math.abs(orderTotal - invoiceTotal).toFixed(2)
      });
    }
  }

  // 3. Validate manufacturer cost breakdown exists
  const items = order.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const snapshot = item.price_snapshots || item.price_snapshot;

    if (!snapshot || !snapshot.manufacturer_price) {
      errors.push({
        code: 'MANUFACTURER_COST_MISSING',
        message: `Item ${i + 1} (${item.room_label || item.product_name}) is missing manufacturer cost breakdown`,
        itemId: item.id
      });
    } else {
      // 4. Check for equal manufacturer and customer prices (warning)
      const mfrCost = snapshot.manufacturer_price?.cost || snapshot.manufacturer_price?.unit_cost;
      const custPrice = snapshot.customer_price?.unit_price || item.unit_price;

      if (mfrCost && custPrice && Math.abs(mfrCost - custPrice) < 0.01) {
        warnings.push({
          code: 'ZERO_MARGIN_WARNING',
          message: `Item ${i + 1} (${item.room_label || item.product_name}) has zero margin - manufacturer cost equals customer price ($${mfrCost})`,
          itemId: item.id,
          manufacturerCost: mfrCost,
          customerPrice: custPrice
        });
      }
    }
  }

  // 5. Validate order has pricing breakdown
  if (!order.pricing || order.pricing.manufacturer_cost_total === undefined) {
    warnings.push({
      code: 'MANUFACTURER_TOTAL_MISSING',
      message: 'Order is missing manufacturer cost total - profit tracking may be affected'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Update order status
app.put('/api/admin/orders/:id/status', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const order = db.orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const { status, notes } = req.body;

    // All valid order statuses matching the complete workflow
    const validStatuses = [
      'pending',              // Order placed, awaiting payment
      'order_placed',         // Order placed by customer
      'payment_received',     // Payment confirmed
      'order_received',       // Ready for manufacturer
      'sent_to_manufacturer', // Sent to manufacturer
      'manufacturing',        // In production
      'in_manufacturing',     // In production (alias)
      'qa',                   // Quality assurance
      'in_testing',           // Quality assurance (alias)
      'shipped',              // Shipped to customer
      'in_shipping',          // In transit (alias)
      'delivered',            // Delivered to customer
      'closed',               // Order completed
      'issue_reported',       // Customer reported an issue
      'refund_requested',     // Customer requested refund
      'refunded',             // Order refunded
      'disputed',             // Customer dispute
      'cancelled'             // Order cancelled
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses: validStatuses
      });
    }

    // TICKET 011: Validation gate for ORDER_RECEIVED transition (soft validation - warnings only)
    let validationWarnings = [];
    if (status === 'order_received') {
      const validationResult = validateOrderReceivedTransition(order, db);
      // Convert errors to warnings for softer validation - admin can still proceed
      validationWarnings = [...(validationResult.errors || []), ...(validationResult.warnings || [])];
      if (validationWarnings.length > 0) {
        // Add warnings to notes for audit trail
        const warningNotes = validationWarnings.map(w => w.message).join('; ');
        req.body.notes = (notes || '') + ' [Validation notes: ' + warningNotes + ']';
      }
    }

    // Record status change in history
    const previousStatus = order.status;
    order.status = status;
    order.updated_at = new Date().toISOString();

    // Add to status history
    if (!order.status_history) order.status_history = [];
    order.status_history.push({
      previousStatus,
      newStatus: status,
      changedAt: new Date().toISOString(),
      notes: notes || ''
    });

    saveDatabase(db);

    // TICKET 014: Record profit when order ships
    let profitInfo = null;
    if (status === 'shipped' && previousStatus !== 'shipped') {
      try {
        profitInfo = recordShippedProfit(order.id);
        console.log(`Profit recorded for order ${order.order_number}:`, profitInfo);
      } catch (profitError) {
        console.error('Error recording profit:', profitError.message);
      }
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: order,
      profitInfo: profitInfo,
      validationWarnings: validationWarnings.length > 0 ? validationWarnings : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete order
app.delete('/api/admin/orders/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = db.orders.findIndex(o => o.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    db.orders.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Order deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN QUOTES ROUTES
// ============================================

// Get all quotes
app.get('/api/admin/quotes', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { status, search } = req.query;

    let quotes = [...db.quotes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (status) {
      quotes = quotes.filter(q => q.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      quotes = quotes.filter(q =>
        q.quote_number.toLowerCase().includes(searchLower) ||
        q.customer_name.toLowerCase().includes(searchLower) ||
        q.customer_email.toLowerCase().includes(searchLower)
      );
    }

    res.json({ success: true, data: quotes, total: quotes.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single quote
app.get('/api/admin/quotes/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const quote = db.quotes.find(q => q.id === req.params.id);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update quote status
app.put('/api/admin/quotes/:id/status', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const quote = db.quotes.find(q => q.id === req.params.id);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    const { status } = req.body;
    const validStatuses = ['pending', 'responded', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    quote.status = status;
    quote.updated_at = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, message: 'Quote status updated', data: quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete quote
app.delete('/api/admin/quotes/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = db.quotes.findIndex(q => q.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    db.quotes.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Quote deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN CATEGORIES ROUTES
// ============================================

// Get all categories
app.get('/api/admin/categories', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();

    // Add product count to each category
    const categories = db.categories.map(cat => ({
      ...cat,
      product_count: db.products.filter(p => p.category_id === cat.id).length
    }));

    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create category
app.post('/api/admin/categories', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { name, slug, description } = req.body;

    // Check slug uniqueness
    const existingSlug = db.categories.find(c => c.slug === slug);
    if (existingSlug) {
      return res.status(400).json({ success: false, error: 'Slug already exists' });
    }

    const category = {
      id: uuidv4(),
      name,
      slug,
      description: description || ''
    };

    db.categories.push(category);
    saveDatabase(db);

    res.json({ success: true, message: 'Category created', data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update category
app.put('/api/admin/categories/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const category = db.categories.find(c => c.id === req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const { name, slug, description } = req.body;

    // Check slug uniqueness
    if (slug && slug !== category.slug) {
      const existingSlug = db.categories.find(c => c.slug === slug && c.id !== req.params.id);
      if (existingSlug) {
        return res.status(400).json({ success: false, error: 'Slug already exists' });
      }
    }

    if (name) category.name = name;
    if (slug) category.slug = slug;
    if (description !== undefined) category.description = description;

    // Update products with new category info
    if (name || slug) {
      db.products.forEach(p => {
        if (p.category_id === req.params.id) {
          if (name) p.category_name = name;
          if (slug) p.category_slug = slug;
        }
      });
    }

    saveDatabase(db);

    res.json({ success: true, message: 'Category updated', data: category });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete category
app.delete('/api/admin/categories/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = db.categories.findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    // Check if category has products
    const productCount = db.products.filter(p => p.category_id === req.params.id).length;
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category with ${productCount} products. Move or delete products first.`
      });
    }

    db.categories.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN FAQS ROUTES
// ============================================

// Get all FAQs
app.get('/api/admin/faqs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.faqs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create FAQ
app.post('/api/admin/faqs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { question, answer } = req.body;

    const faq = {
      id: uuidv4(),
      question,
      answer
    };

    db.faqs.push(faq);
    saveDatabase(db);

    res.json({ success: true, message: 'FAQ created', data: faq });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update FAQ
app.put('/api/admin/faqs/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const faq = db.faqs.find(f => f.id === req.params.id);

    if (!faq) {
      return res.status(404).json({ success: false, error: 'FAQ not found' });
    }

    const { question, answer } = req.body;
    if (question) faq.question = question;
    if (answer) faq.answer = answer;

    saveDatabase(db);

    res.json({ success: true, message: 'FAQ updated', data: faq });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete FAQ
app.delete('/api/admin/faqs/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = db.faqs.findIndex(f => f.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'FAQ not found' });
    }

    db.faqs.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'FAQ deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN SETTINGS ROUTES
// ============================================

// Get settings
app.get('/api/admin/settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update settings
app.put('/api/admin/settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { storeName, storeEmail, storePhone, logoUrl, taxRate, shippingRate, freeShippingThreshold } = req.body;

    if (storeName !== undefined) db.settings.storeName = storeName;
    if (storeEmail !== undefined) db.settings.storeEmail = storeEmail;
    if (storePhone !== undefined) db.settings.storePhone = storePhone;
    if (logoUrl !== undefined) db.settings.logoUrl = logoUrl;
    if (taxRate !== undefined) db.settings.taxRate = parseFloat(taxRate);
    if (shippingRate !== undefined) db.settings.shippingRate = parseFloat(shippingRate);
    if (freeShippingThreshold !== undefined) db.settings.freeShippingThreshold = parseFloat(freeShippingThreshold);

    saveDatabase(db);

    res.json({ success: true, message: 'Settings updated', data: db.settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SYSTEM INTEGRITY API
// Cross-portal validation and data consistency
// ============================================
const systemIntegrity = require('./services/system-integrity');

// Run full system integrity check
app.get('/api/admin/system-integrity', authMiddleware, (req, res) => {
  try {
    const result = systemIntegrity.runFullIntegrityCheck();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate pricing integrity only
app.get('/api/admin/system-integrity/pricing', authMiddleware, (req, res) => {
  try {
    const result = systemIntegrity.validatePricingIntegrity();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate order integrity
app.get('/api/admin/system-integrity/orders', authMiddleware, (req, res) => {
  try {
    const orderId = req.query.orderId;
    const result = systemIntegrity.validateOrderIntegrity(orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate customer integrity
app.get('/api/admin/system-integrity/customers', authMiddleware, (req, res) => {
  try {
    const result = systemIntegrity.validateCustomerIntegrity();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change admin password
app.put('/api/admin/password', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { currentPassword, newPassword } = req.body;

    const admin = db.adminUsers.find(u => u.id === req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, admin.password)) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash new password
    admin.password = bcrypt.hashSync(newPassword, 12);
    saveDatabase(db);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SITE CONTENT API (PUBLIC - For Frontend)
// ============================================

// Get all site content for frontend
app.get('/api/site-content', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, content: db.siteContent || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get theme settings
app.get('/api/site-content/theme', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, theme: db.siteContent?.theme || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get navigation
app.get('/api/site-content/navigation', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({
      success: true,
      topBar: db.siteContent?.topBar || {},
      header: db.siteContent?.header || {},
      navigation: db.siteContent?.navigation || {},
      footer: db.siteContent?.footer || {}
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get hero slides
app.get('/api/site-content/hero-slides', (req, res) => {
  try {
    const db = loadDatabase();
    const slides = (db.siteContent?.heroSlides || []).filter(s => s.active);
    res.json({ success: true, slides });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get homepage content
app.get('/api/site-content/homepage', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({
      success: true,
      sections: db.siteContent?.homepage?.sections || {},
      trustBadges: db.siteContent?.homepage?.trustBadges || [],
      testimonials: db.siteContent?.homepage?.testimonials || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get shop page settings
app.get('/api/site-content/shop', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, shopPage: db.siteContent?.shopPage || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get announcements
app.get('/api/site-content/announcements', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, announcements: db.siteContent?.announcements || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SITE CONTENT ADMIN API (Protected)
// ============================================

// Get all site content for admin
app.get('/api/admin/site-content', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, content: db.siteContent || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update theme settings
app.put('/api/admin/site-content/theme', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.theme = { ...db.siteContent.theme, ...req.body };
    saveDatabase(db);
    res.json({ success: true, theme: db.siteContent.theme });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update top bar
app.put('/api/admin/site-content/topbar', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.topBar = { ...db.siteContent.topBar, ...req.body };
    saveDatabase(db);
    res.json({ success: true, topBar: db.siteContent.topBar });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update header settings
app.put('/api/admin/site-content/header', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.header = { ...db.siteContent.header, ...req.body };
    saveDatabase(db);
    res.json({ success: true, header: db.siteContent.header });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get navigation
app.get('/api/admin/site-content/navigation', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, navigation: db.siteContent?.navigation || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update main menu
app.put('/api/admin/site-content/navigation/main-menu', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.navigation) db.siteContent.navigation = {};
    db.siteContent.navigation.mainMenu = req.body.items || [];
    saveDatabase(db);
    res.json({ success: true, mainMenu: db.siteContent.navigation.mainMenu });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update footer columns
app.put('/api/admin/site-content/navigation/footer', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.navigation) db.siteContent.navigation = {};
    db.siteContent.navigation.footerColumns = req.body.columns || [];
    saveDatabase(db);
    res.json({ success: true, footerColumns: db.siteContent.navigation.footerColumns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update social links
app.put('/api/admin/site-content/navigation/social', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.navigation) db.siteContent.navigation = {};
    db.siteContent.navigation.socialLinks = req.body.links || [];
    saveDatabase(db);
    res.json({ success: true, socialLinks: db.siteContent.navigation.socialLinks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get hero slides
app.get('/api/admin/site-content/hero-slides', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, slides: db.siteContent?.heroSlides || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add hero slide
app.post('/api/admin/site-content/hero-slides', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.heroSlides) db.siteContent.heroSlides = [];

    const newSlide = {
      id: uuidv4(),
      ...req.body,
      position: db.siteContent.heroSlides.length + 1,
      active: true
    };

    db.siteContent.heroSlides.push(newSlide);
    saveDatabase(db);
    res.json({ success: true, slide: newSlide });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update hero slide
app.put('/api/admin/site-content/hero-slides/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const slideIndex = db.siteContent?.heroSlides?.findIndex(s => s.id === req.params.id);

    if (slideIndex === -1) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    db.siteContent.heroSlides[slideIndex] = {
      ...db.siteContent.heroSlides[slideIndex],
      ...req.body
    };
    saveDatabase(db);
    res.json({ success: true, slide: db.siteContent.heroSlides[slideIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete hero slide
app.delete('/api/admin/site-content/hero-slides/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent?.heroSlides) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    db.siteContent.heroSlides = db.siteContent.heroSlides.filter(s => s.id !== req.params.id);
    saveDatabase(db);
    res.json({ success: true, message: 'Slide deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update homepage sections
app.put('/api/admin/site-content/homepage/sections', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.homepage) db.siteContent.homepage = {};
    db.siteContent.homepage.sections = { ...db.siteContent.homepage.sections, ...req.body };
    saveDatabase(db);
    res.json({ success: true, sections: db.siteContent.homepage.sections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update trust badges
app.put('/api/admin/site-content/homepage/trust-badges', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.homepage) db.siteContent.homepage = {};
    db.siteContent.homepage.trustBadges = req.body.badges || [];
    saveDatabase(db);
    res.json({ success: true, trustBadges: db.siteContent.homepage.trustBadges });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update testimonials
app.put('/api/admin/site-content/homepage/testimonials', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.homepage) db.siteContent.homepage = {};
    db.siteContent.homepage.testimonials = req.body.testimonials || [];
    saveDatabase(db);
    res.json({ success: true, testimonials: db.siteContent.homepage.testimonials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add testimonial
app.post('/api/admin/site-content/homepage/testimonials', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    if (!db.siteContent.homepage) db.siteContent.homepage = {};
    if (!db.siteContent.homepage.testimonials) db.siteContent.homepage.testimonials = [];

    const newTestimonial = {
      id: uuidv4(),
      ...req.body,
      enabled: true
    };

    db.siteContent.homepage.testimonials.push(newTestimonial);
    saveDatabase(db);
    res.json({ success: true, testimonial: newTestimonial });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete testimonial
app.delete('/api/admin/site-content/homepage/testimonials/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent?.homepage?.testimonials) {
      return res.status(404).json({ success: false, error: 'Testimonial not found' });
    }

    db.siteContent.homepage.testimonials = db.siteContent.homepage.testimonials.filter(t => t.id !== req.params.id);
    saveDatabase(db);
    res.json({ success: true, message: 'Testimonial deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shop page settings
app.put('/api/admin/site-content/shop', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.shopPage = { ...db.siteContent.shopPage, ...req.body };
    saveDatabase(db);
    res.json({ success: true, shopPage: db.siteContent.shopPage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update footer settings
app.put('/api/admin/site-content/footer', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.footer = { ...db.siteContent.footer, ...req.body };
    saveDatabase(db);
    res.json({ success: true, footer: db.siteContent.footer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update announcements
app.put('/api/admin/site-content/announcements', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.announcements = { ...db.siteContent.announcements, ...req.body };
    saveDatabase(db);
    res.json({ success: true, announcements: db.siteContent.announcements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update SEO settings
app.put('/api/admin/site-content/seo', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteContent) db.siteContent = {};
    db.siteContent.seo = { ...db.siteContent.seo, ...req.body };
    saveDatabase(db);
    res.json({ success: true, seo: db.siteContent.seo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCT CONTENT API (Public)
// ============================================

// Get all product content
// Fast combined endpoint for product page - single request for all data
app.get('/api/product-page-data', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute cache
    const db = loadDatabase();
    const fabrics = (db.productContent?.fabrics || []).filter(f => f.isActive);
    const accessories = (db.productContent?.accessories || []).filter(a => a.isActive);
    res.json({
      success: true,
      fabrics,
      hardware: db.productContent?.hardwareOptions || {},
      accessories,
      roomLabels: db.roomLabels || [],
      gallery: db.productContent?.galleryImages || {},
      simulator: db.productContent?.shadeSimulator || {},
      catalog: db.productContent?.productCatalog || {}
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/product-content', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    const db = loadDatabase();
    res.json({ success: true, content: db.productContent || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fabrics only
app.get('/api/product-content/fabrics', (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = (db.productContent?.fabrics || []).filter(f => f.isActive);
    res.json({ success: true, fabrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get hardware options only
app.get('/api/product-content/hardware', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, hardware: db.productContent?.hardwareOptions || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get accessories only
app.get('/api/product-content/accessories', (req, res) => {
  try {
    const db = loadDatabase();
    const accessories = (db.productContent?.accessories || []).filter(a => a.isActive);
    res.json({ success: true, accessories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fabrics by product type (roller, zebra, etc.) from manufacturerPrices
app.get('/api/fabrics/:productType', (req, res) => {
  try {
    const { productType } = req.params;
    const db = loadDatabase();

    let fabrics = [];

    // For zebra products, use dedicated zebraFabrics data
    if (productType === 'zebra') {
      const zebraFabrics = (db.zebraFabrics || []).filter(f => f.enabled !== false);
      const zebraPrices = db.zebraManufacturerPrices || [];

      fabrics = zebraFabrics.map(fabric => {
        const price = zebraPrices.find(p => p.fabricCode === fabric.code) || {};
        const margin = price.manualMargin || 40;

        return {
          code: fabric.code,
          name: fabric.name,
          category: fabric.category,
          shadingType: fabric.shadingType,
          series: fabric.code.replace(/[A-Z]$/, ''),
          pricePerSqMeter: Math.round((price.pricePerSqMeterManual || 0) * (1 + margin / 100) * 100) / 100,
          pricePerSqMeterCordless: Math.round((price.pricePerSqMeterCordless || 0) * (1 + margin / 100) * 100) / 100,
          pricePerSqMeterManual: Math.round((price.pricePerSqMeterManual || 0) * (1 + margin / 100) * 100) / 100,
          image: fabric.image || `/images/fabrics/zebra/${fabric.code}.png`,
          thumbnail: fabric.image || `/images/fabrics/zebra/${fabric.code}.png`,
          hasImage: fabric.hasImage || false,
          weight: fabric.weight || '',
          repeat: fabric.repeat || '',
          thickness: fabric.thickness || '',
          composition: fabric.composition || '100% Polyester',
          waterResistant: fabric.waterResistant || false,
          fireResistant: fabric.fireResistant || false,
          features: [],
          minArea: price.minAreaSqMeter || 1.5,
          minAreaSqMeter: price.minAreaSqMeter || 1.5,
          widthMin: 12,
          widthMax: 118,
          heightMin: 12,
          heightMax: 98
        };
      }).sort((a, b) => a.code.localeCompare(b.code));
    } else {
      // Get fabrics from manufacturerPrices for other product types
      fabrics = (db.manufacturerPrices || [])
        .filter(p => p.productType === productType && p.status === 'active')
        .map(p => ({
          code: p.fabricCode,
          name: p.fabricName,
          category: p.fabricCategory,
          series: p.series || '',
          pricePerSqMeter: p.pricePerSqMeter,
          pricePerSqMeterCordless: p.pricePerSqMeterCordless,
          image: p.image || '',
          thumbnail: p.thumbnail || p.image || '',
          hasImage: p.hasImage || false,
          weight: p.weight || '',
          repeat: p.repeat || '',
          composition: p.composition || '100% Polyester',
          features: p.features || [],
          minArea: p.minAreaSqMeter || 1,
          widthMin: p.widthMin || 50,
          widthMax: p.widthMax || 230,
          heightMin: p.heightMin || 50,
          heightMax: p.heightMax || 330
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      fabrics,
      total: fabrics.length,
      productType
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCT CONTENT ADMIN API (Protected)
// ============================================

// --- FABRICS ---
app.get('/api/admin/fabrics', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, fabrics: db.productContent?.fabrics || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/fabrics', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.fabrics) db.productContent.fabrics = [];
    const newFabric = {
      id: `fab-${Date.now()}`,
      ...req.body,
      isActive: req.body.isActive !== false
    };
    db.productContent.fabrics.push(newFabric);
    saveDatabase(db);
    res.json({ success: true, fabric: newFabric });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reorder fabrics (must be before :id routes)
app.put('/api/admin/fabrics/reorder', authMiddleware, (req, res) => {
  try {
    const { fabricIds } = req.body;
    if (!Array.isArray(fabricIds)) {
      return res.status(400).json({ success: false, error: 'fabricIds must be an array' });
    }
    const db = loadDatabase();
    const fabrics = db.productContent?.fabrics || [];

    // Update sortOrder for each fabric based on position in fabricIds array
    fabricIds.forEach((id, index) => {
      const fabric = fabrics.find(f => f.id === id);
      if (fabric) {
        fabric.sortOrder = index + 1;
      }
    });

    saveDatabase(db);
    res.json({ success: true, fabrics: db.productContent.fabrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/fabrics/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = db.productContent?.fabrics;
    if (!fabrics) return res.status(404).json({ success: false, error: 'Fabric not found' });
    const index = fabrics.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Fabric not found' });
    fabrics[index] = { ...fabrics[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, fabric: fabrics[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/fabrics/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = db.productContent?.fabrics;
    if (!fabrics) return res.status(404).json({ success: false, error: 'Fabric not found' });
    const index = fabrics.findIndex(f => f.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Fabric not found' });
    fabrics.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/fabrics/:id/toggle', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fabric = db.productContent?.fabrics?.find(f => f.id === req.params.id);
    if (!fabric) return res.status(404).json({ success: false, error: 'Fabric not found' });
    fabric.isActive = !fabric.isActive;
    saveDatabase(db);
    res.json({ success: true, fabric });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk import fabrics from PDF extraction
app.post('/api/admin/fabrics/bulk-import', authMiddleware, (req, res) => {
  try {
    const { fabrics } = req.body;
    if (!fabrics || !Array.isArray(fabrics)) {
      return res.status(400).json({ success: false, error: 'Fabrics array required' });
    }

    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.fabrics) db.productContent.fabrics = [];
    if (!db.manufacturerPrices) db.manufacturerPrices = [];

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const fabric of fabrics) {
      if (!fabric.code) {
        skipped++;
        continue;
      }

      // Check if fabric already exists
      const existingIndex = db.productContent.fabrics.findIndex(f => f.code === fabric.code);

      const fabricData = {
        id: fabric.id || uuidv4(),
        code: fabric.code,
        name: fabric.name || fabric.code,
        category: fabric.category || 'Blackout',
        filterType: fabric.filterType || 'blackout',
        image: fabric.image || `/images/fabrics/${fabric.code}.jpg`,
        color: fabric.color || '#FFFFFF',
        isActive: fabric.isActive !== false,
        sortOrder: fabric.sortOrder || 0,
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        // Update existing
        db.productContent.fabrics[existingIndex] = { ...db.productContent.fabrics[existingIndex], ...fabricData };
        updated++;
      } else {
        // Add new
        fabricData.createdAt = new Date().toISOString();
        db.productContent.fabrics.push(fabricData);
        imported++;
      }

      // Also add/update manufacturer price if provided
      if (fabric.pricePerSqMeter !== undefined) {
        const priceIndex = db.manufacturerPrices.findIndex(p => p.fabricCode === fabric.code);
        const priceData = {
          fabricCode: fabric.code,
          fabricName: fabric.name || fabric.code,
          pricePerSqMeter: parseFloat(fabric.pricePerSqMeter) || 0,
          pricePerSqMeterCordless: parseFloat(fabric.pricePerSqMeterCordless) || parseFloat(fabric.pricePerSqMeter) || 0,
          manualMargin: parseFloat(fabric.margin) || 40,
          cordlessMargin: parseFloat(fabric.cordlessMargin) || 40,
          updatedAt: new Date().toISOString()
        };

        if (priceIndex >= 0) {
          db.manufacturerPrices[priceIndex] = { ...db.manufacturerPrices[priceIndex], ...priceData };
        } else {
          priceData.createdAt = new Date().toISOString();
          db.manufacturerPrices.push(priceData);
        }
      }
    }

    saveDatabase(db);
    res.json({
      success: true,
      message: `Imported ${imported}, updated ${updated}, skipped ${skipped}`,
      stats: { imported, updated, skipped, total: fabrics.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- MOTOR BRANDS ---
// Get all motor brands (public - for product page)
app.get('/api/motor-brands', (req, res) => {
  try {
    const db = loadDatabase();
    const brands = (db.motorBrands || []).filter(b => b.isActive);
    res.json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MANUFACTURER FABRIC PRICES API
// Dynamic pricing per fabric code (manual/cordless per m²)
// ============================================

// Get all manufacturer fabric prices
app.get('/api/admin/manufacturer-prices', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { productType, fabricCode, search } = req.query;

    let prices = [];

    // For zebra products, use zebraManufacturerPrices joined with zebraFabrics
    if (productType === 'zebra') {
      const zebraPrices = db.zebraManufacturerPrices || [];
      const zebraFabrics = db.zebraFabrics || [];

      prices = zebraPrices.map(price => {
        const fabric = zebraFabrics.find(f => f.code === price.fabricCode) || {};
        return {
          id: `zmp-${price.fabricCode}`,
          manufacturerId: 'zebra-mfr',
          productType: 'zebra',
          fabricCode: price.fabricCode,
          fabricName: fabric.name || `Zebra ${price.fabricCode}`,
          category: fabric.category,
          shadingType: fabric.shadingType,
          pricePerSqMeter: price.pricePerSqMeterManual,
          pricePerSqMeterCordless: price.pricePerSqMeterCordless,
          basePrice: price.pricePerSqMeterManual,
          manualMargin: price.manualMargin || 40,
          cordlessMargin: price.manualMargin || 40,
          minAreaSqMeter: price.minAreaSqMeter || 1.5,
          status: price.status || 'active',
          updatedAt: price.updatedAt
        };
      });
    } else {
      // Default: use manufacturerPrices for roller and other products
      prices = db.manufacturerPrices || [];
      if (productType) {
        prices = prices.filter(p => p.productType === productType);
      }
    }

    if (fabricCode) {
      prices = prices.filter(p => p.fabricCode === fabricCode);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      prices = prices.filter(p =>
        (p.fabricCode && p.fabricCode.toLowerCase().includes(searchLower)) ||
        (p.fabricName && p.fabricName.toLowerCase().includes(searchLower))
      );
    }

    res.json({ success: true, data: prices, total: prices.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single manufacturer price by fabric code
app.get('/api/admin/manufacturer-prices/:fabricCode', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const price = (db.manufacturerPrices || []).find(p =>
      p.fabricCode === req.params.fabricCode || p.id === req.params.fabricCode
    );

    if (!price) {
      return res.status(404).json({ success: false, error: 'Fabric price not found' });
    }

    res.json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update manufacturer price for a fabric
app.put('/api/admin/manufacturer-prices/:fabricCode', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const paramFabricCode = req.params.fabricCode;

    // Check if it's a zebra fabric (id starts with zmp- or productType is zebra)
    const isZebra = paramFabricCode.startsWith('zmp-') || req.body.productType === 'zebra';
    const actualFabricCode = paramFabricCode.replace('zmp-', '');

    if (isZebra) {
      // Update zebra fabric pricing
      if (!db.zebraManufacturerPrices) db.zebraManufacturerPrices = [];

      const index = db.zebraManufacturerPrices.findIndex(p => p.fabricCode === actualFabricCode);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Zebra fabric price not found' });
      }

      const { pricePerSqMeter, pricePerSqMeterCordless, manualMargin } = req.body;

      if (pricePerSqMeter !== undefined) {
        db.zebraManufacturerPrices[index].pricePerSqMeterManual = parseFloat(pricePerSqMeter);
        db.zebraManufacturerPrices[index].pricePerSqMeter = parseFloat(pricePerSqMeter);
      }
      if (pricePerSqMeterCordless !== undefined) {
        db.zebraManufacturerPrices[index].pricePerSqMeterCordless = parseFloat(pricePerSqMeterCordless);
      }
      if (manualMargin !== undefined) {
        const val = parseFloat(manualMargin);
        if (isNaN(val) || val < 0 || val > 500) {
          return res.status(400).json({ success: false, error: 'manualMargin must be between 0% and 500%' });
        }
        db.zebraManufacturerPrices[index].manualMargin = val;
      }
      db.zebraManufacturerPrices[index].updatedAt = new Date().toISOString();

      saveDatabase(db);
      return res.json({ success: true, data: db.zebraManufacturerPrices[index] });
    }

    // Regular (roller) fabric pricing update
    if (!db.manufacturerPrices) db.manufacturerPrices = [];

    const index = db.manufacturerPrices.findIndex(p =>
      p.fabricCode === paramFabricCode || p.id === paramFabricCode
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Fabric price not found' });
    }

    const { pricePerSqMeter, pricePerSqMeterCordless, margin, manualMargin, cordlessMargin } = req.body;

    // BUG-013 FIX: Validate margins are not negative
    const marginFields = [
      { name: 'margin', value: margin },
      { name: 'manualMargin', value: manualMargin },
      { name: 'cordlessMargin', value: cordlessMargin }
    ];
    for (const field of marginFields) {
      if (field.value !== undefined) {
        const val = parseFloat(field.value);
        if (isNaN(val) || val < 0 || val > 500) {
          return res.status(400).json({ success: false, error: `${field.name} must be between 0% and 500%` });
        }
      }
    }

    // Update only provided fields
    if (pricePerSqMeter !== undefined) {
      db.manufacturerPrices[index].pricePerSqMeter = parseFloat(pricePerSqMeter);
      db.manufacturerPrices[index].basePrice = parseFloat(pricePerSqMeter);
    }
    if (pricePerSqMeterCordless !== undefined) {
      db.manufacturerPrices[index].pricePerSqMeterCordless = parseFloat(pricePerSqMeterCordless);
    }
    if (margin !== undefined) {
      db.manufacturerPrices[index].margin = parseFloat(margin);
    }
    if (manualMargin !== undefined) {
      db.manufacturerPrices[index].manualMargin = parseFloat(manualMargin);
    }
    if (cordlessMargin !== undefined) {
      db.manufacturerPrices[index].cordlessMargin = parseFloat(cordlessMargin);
    }

    db.manufacturerPrices[index].updatedAt = new Date().toISOString();
    db.manufacturerPrices[index].updatedBy = req.user?.id || 'admin';

    saveDatabase(db);

    res.json({ success: true, data: db.manufacturerPrices[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new manufacturer price entry
app.post('/api/admin/manufacturer-prices', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.manufacturerPrices) db.manufacturerPrices = [];

    const { fabricCode, fabricName, productType, pricePerSqMeter, pricePerSqMeterCordless } = req.body;

    if (!fabricCode || !pricePerSqMeter) {
      return res.status(400).json({ success: false, error: 'fabricCode and pricePerSqMeter are required' });
    }

    // Check if already exists
    const existing = db.manufacturerPrices.find(p =>
      p.fabricCode === fabricCode && p.productType === (productType || 'roller')
    );
    if (existing) {
      return res.status(409).json({ success: false, error: 'Price entry already exists for this fabric' });
    }

    const newPrice = {
      id: `mp-${Date.now().toString(36)}`,
      manufacturerId: 'mfr-default',
      productType: productType || 'roller',
      fabricCode,
      fabricName: fabricName || fabricCode,
      pricePerSqMeter: parseFloat(pricePerSqMeter),
      pricePerSqMeterCordless: parseFloat(pricePerSqMeterCordless) || parseFloat(pricePerSqMeter) * 1.25,
      basePrice: parseFloat(pricePerSqMeter),
      minAreaSqMeter: 1.2,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: req.user?.id || 'admin'
    };

    db.manufacturerPrices.push(newPrice);
    saveDatabase(db);

    res.json({ success: true, data: newPrice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk update manufacturer prices
app.post('/api/admin/manufacturer-prices/bulk-update', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.manufacturerPrices) db.manufacturerPrices = [];

    const { updates } = req.body; // Array of { fabricCode, pricePerSqMeter, pricePerSqMeterCordless }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'updates must be an array' });
    }

    let updated = 0;
    updates.forEach(update => {
      const index = db.manufacturerPrices.findIndex(p => p.fabricCode === update.fabricCode);
      if (index !== -1) {
        if (update.pricePerSqMeter !== undefined) {
          db.manufacturerPrices[index].pricePerSqMeter = parseFloat(update.pricePerSqMeter);
          db.manufacturerPrices[index].basePrice = parseFloat(update.pricePerSqMeter);
        }
        if (update.pricePerSqMeterCordless !== undefined) {
          db.manufacturerPrices[index].pricePerSqMeterCordless = parseFloat(update.pricePerSqMeterCordless);
        }
        db.manufacturerPrices[index].updatedAt = new Date().toISOString();
        updated++;
      }
    });

    saveDatabase(db);

    res.json({ success: true, message: `Updated ${updated} fabric prices` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all motor brands (admin)
app.get('/api/admin/motor-brands', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.motorBrands || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create motor brand
app.post('/api/admin/motor-brands', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.motorBrands) db.motorBrands = [];

    const mfrCost = parseFloat(req.body.manufacturerCost) || 0;
    const margin = parseFloat(req.body.margin) || 40;

    // BUG-013 FIX: Validate margin is not negative
    if (margin < 0 || margin > 500) {
      return res.status(400).json({ success: false, error: 'Margin must be between 0% and 500%' });
    }

    const newBrand = {
      id: `motor-${Date.now()}`,
      value: req.body.value || req.body.label.toLowerCase().replace(/\s+/g, '-'),
      label: req.body.label,
      manufacturerCost: mfrCost,
      margin: margin,
      price: mfrCost * (1 + margin / 100),
      priceType: 'flat',
      isActive: req.body.isActive !== false,
      sortOrder: db.motorBrands.length + 1
    };

    db.motorBrands.push(newBrand);
    saveDatabase(db);
    res.json({ success: true, data: newBrand });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update motor brand
app.put('/api/admin/motor-brands/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.motorBrands || []).findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Motor brand not found' });

    const mfrCost = parseFloat(req.body.manufacturerCost) || db.motorBrands[index].manufacturerCost;
    const margin = parseFloat(req.body.margin) || db.motorBrands[index].margin;

    // BUG-013 FIX: Validate margin is not negative
    if (margin < 0 || margin > 500) {
      return res.status(400).json({ success: false, error: 'Margin must be between 0% and 500%' });
    }

    db.motorBrands[index] = {
      ...db.motorBrands[index],
      ...req.body,
      manufacturerCost: mfrCost,
      margin: margin,
      price: mfrCost * (1 + margin / 100)
    };

    saveDatabase(db);
    res.json({ success: true, data: db.motorBrands[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete motor brand
app.delete('/api/admin/motor-brands/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.motorBrands || []).findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Motor brand not found' });

    db.motorBrands.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- HARDWARE OPTIONS ---

// Get ALL hardware options (used by admin orders page)
app.get('/api/admin/hardware', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const hardwareOptions = db.productContent?.hardwareOptions || {};
    res.json({ success: true, data: hardwareOptions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get hardware options by category
app.get('/api/admin/hardware/:category', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const options = db.productContent?.hardwareOptions?.[req.params.category] || [];
    res.json({ success: true, options });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/hardware/:category', authMiddleware, (req, res) => {
  try {
    // BUG-013 FIX: Validate margin is not negative
    const margin = parseFloat(req.body.margin);
    if (!isNaN(margin) && (margin < 0 || margin > 500)) {
      return res.status(400).json({ success: false, error: 'Margin must be between 0% and 500%' });
    }

    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.hardwareOptions) db.productContent.hardwareOptions = {};
    if (!db.productContent.hardwareOptions[req.params.category]) db.productContent.hardwareOptions[req.params.category] = [];
    const newOption = {
      id: `${req.params.category}-${Date.now()}`,
      ...req.body,
      isActive: req.body.isActive !== false
    };
    db.productContent.hardwareOptions[req.params.category].push(newOption);
    saveDatabase(db);
    res.json({ success: true, option: newOption });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
    // BUG-013 FIX: Validate margin is not negative
    const margin = parseFloat(req.body.margin);
    if (!isNaN(margin) && (margin < 0 || margin > 500)) {
      return res.status(400).json({ success: false, error: 'Margin must be between 0% and 500%' });
    }

    const db = loadDatabase();
    const options = db.productContent?.hardwareOptions?.[req.params.category];
    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });
    const index = options.findIndex(o => o.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Option not found' });
    options[index] = { ...options[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, option: options[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const options = db.productContent?.hardwareOptions?.[req.params.category];
    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });
    const index = options.findIndex(o => o.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Option not found' });
    options.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ZEBRA HARDWARE OPTIONS API
// ============================================

// Get all zebra hardware options
app.get('/api/admin/zebra/hardware', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.productContent?.zebraHardwareOptions || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get zebra hardware by category (valanceType, bottomRail, chainSide)
app.get('/api/admin/zebra/hardware/:category', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const options = db.productContent?.zebraHardwareOptions?.[req.params.category];
    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, options });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new zebra hardware option
app.post('/api/admin/zebra/hardware/:category', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.zebraHardwareOptions) db.productContent.zebraHardwareOptions = {};
    if (!db.productContent.zebraHardwareOptions[req.params.category]) {
      db.productContent.zebraHardwareOptions[req.params.category] = [];
    }
    const newOption = {
      id: `z${req.params.category.charAt(0)}-${Date.now()}`,
      ...req.body,
      isActive: req.body.isActive !== false
    };
    db.productContent.zebraHardwareOptions[req.params.category].push(newOption);
    saveDatabase(db);
    res.json({ success: true, option: newOption });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update zebra hardware option
app.put('/api/admin/zebra/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const options = db.productContent?.zebraHardwareOptions?.[req.params.category];
    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });
    const index = options.findIndex(o => o.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Option not found' });
    options[index] = { ...options[index], ...req.body, id: req.params.id };
    saveDatabase(db);
    res.json({ success: true, option: options[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete zebra hardware option
app.delete('/api/admin/zebra/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const options = db.productContent?.zebraHardwareOptions?.[req.params.category];
    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });
    const index = options.findIndex(o => o.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Option not found' });
    options.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public API for zebra hardware options (frontend use)
app.get('/api/zebra/hardware', (req, res) => {
  try {
    const db = loadDatabase();
    const zebraHardware = db.productContent?.zebraHardwareOptions || {};
    // Filter to only active options
    const filteredHardware = {};
    for (const [category, options] of Object.entries(zebraHardware)) {
      filteredHardware[category] = options.filter(opt => opt.isActive !== false);
    }
    res.json({ success: true, data: filteredHardware });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- ACCESSORIES ---
app.get('/api/admin/accessories', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, accessories: db.productContent?.accessories || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/accessories', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.accessories) db.productContent.accessories = [];
    const newAccessory = {
      id: `acc-${Date.now()}`,
      ...req.body,
      isActive: req.body.isActive !== false
    };
    db.productContent.accessories.push(newAccessory);
    saveDatabase(db);
    res.json({ success: true, accessory: newAccessory });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/accessories/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const accessories = db.productContent?.accessories;
    if (!accessories) return res.status(404).json({ success: false, error: 'Accessory not found' });
    const index = accessories.findIndex(a => a.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Accessory not found' });
    accessories[index] = { ...accessories[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, accessory: accessories[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/accessories/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const accessories = db.productContent?.accessories;
    if (!accessories) return res.status(404).json({ success: false, error: 'Accessory not found' });
    const index = accessories.findIndex(a => a.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Accessory not found' });
    accessories.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PRODUCT CATALOG ---
app.get('/api/admin/product-catalog', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, catalog: db.productContent?.productCatalog || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/product-catalog/features', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.productCatalog) db.productContent.productCatalog = {};
    db.productContent.productCatalog.features = req.body.features || [];
    saveDatabase(db);
    res.json({ success: true, features: db.productContent.productCatalog.features });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/product-catalog/care', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.productCatalog) db.productContent.productCatalog = {};
    db.productContent.productCatalog.careInstructions = req.body.careInstructions || '';
    saveDatabase(db);
    res.json({ success: true, careInstructions: db.productContent.productCatalog.careInstructions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/product-catalog/warranty', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.productCatalog) db.productContent.productCatalog = {};
    db.productContent.productCatalog.warrantyInfo = req.body.warrantyInfo || '';
    saveDatabase(db);
    res.json({ success: true, warrantyInfo: db.productContent.productCatalog.warrantyInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- GALLERY & SIMULATOR ---
app.get('/api/admin/product-content/gallery', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, gallery: db.productContent?.galleryImages || { main: '', thumbnails: ['', '', '', ''] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/product-content/simulator', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, simulator: db.productContent?.shadeSimulator || { views: { front: { imageUrl: '' }, side: { imageUrl: '' }, outside: { imageUrl: '' } } } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/product-content/gallery', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    db.productContent.galleryImages = req.body;
    saveDatabase(db);
    res.json({ success: true, gallery: db.productContent.galleryImages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/product-content/simulator', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    db.productContent.shadeSimulator = req.body;
    saveDatabase(db);
    res.json({ success: true, simulator: db.productContent.shadeSimulator });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- ROOM LABELS ---
app.get('/api/admin/room-labels', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, labels: db.roomLabels || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/room-labels', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    db.roomLabels = req.body.labels || req.body.roomLabels || [];
    saveDatabase(db);
    res.json({ success: true, labels: db.roomLabels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAGE ROUTES
// ============================================

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// Shop page
app.get('/shop', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/shop.html'));
});

// Products page (alias for shop)
app.get('/products', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/shop.html'));
});

// Category page (shows products filtered by category)
app.get('/category/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/shop.html'));
});

// ============================================
// SEO LANDING PAGES
// ============================================

// Product category landing pages
app.get('/roller-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/roller-shades.html'));
});

app.get('/zebra-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/zebra-shades.html'));
});

app.get('/blackout-roller-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/blackout-roller-shades.html'));
});

app.get('/blackout-zebra-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/blackout-zebra-shades.html'));
});

app.get('/motorized-roller-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/motorized-roller-shades.html'));
});

app.get('/cordless-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/cordless-shades.html'));
});

app.get('/light-filtering-roller-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/light-filtering-roller-shades.html'));
});

// Room-specific landing pages
app.get('/window-shades-for-bedroom', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/window-shades-bedroom.html'));
});

app.get('/window-shades-for-living-room', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/landing/window-shades-living-room.html'));
});

// ============================================
// GUIDES & RESOURCES
// ============================================

// Guides hub page
app.get('/guides', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/index.html'));
});

// Individual guide articles
app.get('/guides/how-to-measure-for-blinds', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/how-to-measure-for-blinds.html'));
});

app.get('/guides/zebra-vs-roller-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/zebra-vs-roller-shades.html'));
});

app.get('/guides/blackout-shades-what-to-know', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/blackout-shades-what-to-know.html'));
});

app.get('/guides/cordless-vs-motorized', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/cordless-vs-motorized.html'));
});

// ============================================
// POLICY & TRUST PAGES
// ============================================

app.get('/shipping', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/shipping.html'));
});

app.get('/returns', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/returns.html'));
});

app.get('/warranty', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/warranty.html'));
});

app.get('/child-safety', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/child-safety.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/contact.html'));
});

// Product detail page - Route to appropriate page based on product type
app.get('/product/:slug', (req, res) => {
  const slug = req.params.slug;
  const db = loadDatabase();
  const product = db.products.find(p => p.slug === slug);

  // If product found and is zebra category, serve zebra page
  if (product && (product.category_slug === 'zebra-shades' || slug.includes('zebra'))) {
    return res.sendFile(path.join(__dirname, '../frontend/public/zebra-product.html'));
  }

  // Default to roller blinds product page
  res.sendFile(path.join(__dirname, '../frontend/public/product.html'));
});

// Cart page
app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/cart.html'));
});

// ============================================
// IMAGE UPLOAD API
// ============================================

// Upload single image
app.post('/api/admin/upload', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const imageUrl = `/images/uploads/${req.file.filename}`;
    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload to specific category folder
app.post('/api/admin/upload/:category', authMiddleware, (req, res, next) => {
  const category = req.params.category;
  const categoryPaths = {
    'fabrics': '../frontend/public/images/fabrics/swatches',
    'hardware': '../frontend/public/images/hardware',
    'accessories': '../frontend/public/images/accessories',
    'products': '../frontend/public/images/products',
    'gallery': '../frontend/public/images/gallery'
  };

  const uploadPath = categoryPaths[category] || '../frontend/public/images/uploads';
  const fullPath = path.join(__dirname, uploadPath);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const categoryStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, fullPath),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = req.body.filename || `${Date.now()}-${uuidv4().slice(0, 8)}`;
      cb(null, `${name}${ext}`);
    }
  });

  const categoryUpload = multer({
    storage: categoryStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
      const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      if (ext) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  }).single('image');

  categoryUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const basePath = uploadPath.replace('../frontend/public', '');
    res.json({
      success: true,
      url: `${basePath}/${req.file.filename}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  });
});

// Delete uploaded image
app.delete('/api/admin/upload', authMiddleware, (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'No URL provided' });
    }
    const filePath = path.join(__dirname, '../frontend/public', url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted' });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ENTERPRISE MEDIA LIBRARY API
// ============================================

// Get all media assets with filtering and pagination
app.get('/api/admin/media', authMiddleware, (req, res) => {
  try {
    const options = {
      category: req.query.category,
      tags: req.query.tags ? req.query.tags.split(',') : null,
      type: req.query.type,
      search: req.query.search,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    const result = mediaManager.getAssets(options);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single asset
app.get('/api/admin/media/:assetId', authMiddleware, (req, res) => {
  try {
    const asset = mediaManager.getAsset(req.params.assetId);
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }
    res.json({ success: true, asset });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload and register new media asset
app.post('/api/admin/media/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileInfo = {
      url: `/images/uploads/${req.file.filename}`,
      category: req.body.category || 'uploads',
      mimeType: req.file.mimetype,
      size: req.file.size
    };

    const metadata = {
      name: req.body.name || req.file.originalname,
      description: req.body.description || '',
      altText: req.body.altText || '',
      tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
      createdBy: req.user?.userId || 'admin'
    };

    const result = mediaManager.registerAsset(fileInfo, metadata);

    // Audit log
    if (result.success) {
      auditLogger.log({
        action: 'MEDIA_UPLOAD',
        entityType: 'media',
        entityId: result.asset.id,
        userId: req.user?.userId,
        newState: result.asset,
        severity: 'info'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update asset metadata
app.put('/api/admin/media/:assetId', authMiddleware, (req, res) => {
  try {
    const oldAsset = mediaManager.getAsset(req.params.assetId);
    const result = mediaManager.updateAsset(
      req.params.assetId,
      req.body,
      req.user?.userId || 'admin'
    );

    if (result.success) {
      auditLogger.log({
        action: 'MEDIA_UPDATE',
        entityType: 'media',
        entityId: req.params.assetId,
        userId: req.user?.userId,
        previousState: oldAsset,
        newState: result.asset,
        severity: 'info'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add new version to asset
app.post('/api/admin/media/:assetId/version', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const newFileInfo = {
      url: `/images/uploads/${req.file.filename}`,
      size: req.file.size
    };

    const result = mediaManager.addVersion(
      req.params.assetId,
      newFileInfo,
      req.user?.userId || 'admin'
    );

    if (result.success) {
      auditLogger.log({
        action: 'MEDIA_VERSION_ADD',
        entityType: 'media',
        entityId: req.params.assetId,
        userId: req.user?.userId,
        newState: { version: result.version },
        severity: 'info'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Revert to previous version
app.post('/api/admin/media/:assetId/revert', authMiddleware, (req, res) => {
  try {
    const { version } = req.body;
    if (!version) {
      return res.status(400).json({ success: false, error: 'Version number required' });
    }

    const result = mediaManager.revertToVersion(
      req.params.assetId,
      parseInt(version),
      req.user?.userId || 'admin'
    );

    if (result.success) {
      auditLogger.log({
        action: 'MEDIA_VERSION_REVERT',
        entityType: 'media',
        entityId: req.params.assetId,
        userId: req.user?.userId,
        newState: { revertedToVersion: version },
        severity: 'warning'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete asset
app.delete('/api/admin/media/:assetId', authMiddleware, (req, res) => {
  try {
    const hardDelete = req.query.hard === 'true';
    const asset = mediaManager.getAsset(req.params.assetId);

    const result = mediaManager.deleteAsset(
      req.params.assetId,
      hardDelete,
      req.user?.userId || 'admin'
    );

    if (result.success) {
      auditLogger.log({
        action: hardDelete ? 'MEDIA_HARD_DELETE' : 'MEDIA_SOFT_DELETE',
        entityType: 'media',
        entityId: req.params.assetId,
        userId: req.user?.userId,
        previousState: asset,
        severity: hardDelete ? 'critical' : 'warning'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get media storage statistics
app.get('/api/admin/media/stats/overview', authMiddleware, (req, res) => {
  try {
    const stats = mediaManager.getStorageStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all tags
app.get('/api/admin/media/tags/all', authMiddleware, (req, res) => {
  try {
    const tags = mediaManager.getTags();
    res.json({ success: true, tags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new tag
app.post('/api/admin/media/tags', authMiddleware, (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Tag name required' });
    }

    const result = mediaManager.addTag(name, color);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync filesystem with database
app.post('/api/admin/media/sync', authMiddleware, (req, res) => {
  try {
    const result = mediaManager.syncFilesystem();

    auditLogger.log({
      action: 'MEDIA_SYNC',
      entityType: 'media',
      userId: req.user?.userId,
      newState: {
        scanned: result.scanned,
        newAssets: result.newAssets,
        orphanedAssets: result.orphanedAssets
      },
      severity: 'info'
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get media categories configuration
app.get('/api/admin/media/categories', authMiddleware, (req, res) => {
  try {
    res.json({
      success: true,
      categories: Object.entries(MEDIA_CATEGORIES).map(([key, value]) => ({
        id: key,
        ...value
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CONTENT MANAGEMENT SYSTEM (CMS) API
// ============================================

// Initialize CMS content
contentManager.initializeContent();

// PUBLIC: Get frontend bundle (global settings, nav, banners)
app.get('/api/content/bundle', (req, res) => {
  try {
    const bundle = contentManager.getFrontendBundle();
    res.json({ success: true, ...bundle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get global settings
app.get('/api/content/global', (req, res) => {
  try {
    const settings = contentManager.getGlobalSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get navigation
app.get('/api/content/navigation/:type?', (req, res) => {
  try {
    const type = req.params.type || 'main';
    const navigation = contentManager.getNavigation(type);
    res.json({ success: true, navigation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get page content
app.get('/api/content/pages/:slug', (req, res) => {
  try {
    const page = contentManager.getPageContent(req.params.slug);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get product page content
app.get('/api/content/product/:slug', (req, res) => {
  try {
    const content = contentManager.getProductPageContent(req.params.slug);
    res.json({ success: true, ...content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get active banners
app.get('/api/content/banners', (req, res) => {
  try {
    const location = req.query.location;
    const banners = contentManager.getBanners(location);
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Update global settings
app.put('/api/admin/content/global', authMiddleware, (req, res) => {
  try {
    const result = contentManager.updateGlobalSettings(req.body, req.user?.userId);

    auditLogger.log({
      action: 'CMS_GLOBAL_UPDATE',
      entityType: 'cms',
      userId: req.user?.userId,
      previousState: result.previous,
      newState: result.settings,
      severity: 'info'
    });

    // Real-time notification
    realtimeSync.notifyContentUpdate('global', 'settings', result.settings);

    res.json({ success: true, settings: result.settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Update navigation
app.put('/api/admin/content/navigation/:type', authMiddleware, (req, res) => {
  try {
    const result = contentManager.updateNavigation(
      req.params.type,
      req.body.items,
      req.user?.userId
    );

    auditLogger.log({
      action: 'CMS_NAVIGATION_UPDATE',
      entityType: 'cms',
      userId: req.user?.userId,
      newState: { type: req.params.type, items: result.navigation },
      severity: 'info'
    });

    // Real-time notification
    realtimeSync.notifyContentUpdate('navigation', req.params.type, { items: result.navigation });

    res.json({ success: true, navigation: result.navigation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Save page content
app.put('/api/admin/content/pages/:slug', authMiddleware, (req, res) => {
  try {
    const result = contentManager.savePageContent(
      req.params.slug,
      req.body,
      req.user?.userId
    );

    auditLogger.log({
      action: 'CMS_PAGE_UPDATE',
      entityType: 'cms',
      entityId: req.params.slug,
      userId: req.user?.userId,
      previousState: result.previousContent,
      newState: result.page,
      severity: 'info'
    });

    // Real-time notification
    realtimeSync.notifyContentUpdate('page', req.params.slug, result.page);

    res.json({ success: true, page: result.page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Save product page content
app.put('/api/admin/content/product/:slug', authMiddleware, (req, res) => {
  try {
    const result = contentManager.saveProductPageContent(
      req.params.slug,
      req.body,
      req.user?.userId
    );

    auditLogger.log({
      action: 'CMS_PRODUCT_PAGE_UPDATE',
      entityType: 'cms',
      entityId: req.params.slug,
      userId: req.user?.userId,
      previousState: result.previous,
      newState: result.content,
      severity: 'info'
    });

    // Real-time notification
    realtimeSync.notifyContentUpdate('product', req.params.slug, result.content);

    res.json({ success: true, content: result.content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Create banner
app.post('/api/admin/content/banners', authMiddleware, (req, res) => {
  try {
    const result = contentManager.createBanner(req.body, req.user?.userId);

    auditLogger.log({
      action: 'CMS_BANNER_CREATE',
      entityType: 'cms',
      entityId: result.banner.id,
      userId: req.user?.userId,
      newState: result.banner,
      severity: 'info'
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Update banner
app.put('/api/admin/content/banners/:id', authMiddleware, (req, res) => {
  try {
    const result = contentManager.updateBanner(
      req.params.id,
      req.body,
      req.user?.userId
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    auditLogger.log({
      action: 'CMS_BANNER_UPDATE',
      entityType: 'cms',
      entityId: req.params.id,
      userId: req.user?.userId,
      newState: result.banner,
      severity: 'info'
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Delete banner
app.delete('/api/admin/content/banners/:id', authMiddleware, (req, res) => {
  try {
    const result = contentManager.deleteBanner(req.params.id);

    if (result.success) {
      auditLogger.log({
        action: 'CMS_BANNER_DELETE',
        entityType: 'cms',
        entityId: req.params.id,
        userId: req.user?.userId,
        severity: 'warning'
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS API ENDPOINTS
// ============================================

// Public: Track analytics event
app.post('/api/analytics/event', (req, res) => {
  try {
    const { type, sessionId, productId, value, source, page } = req.body;
    const db = loadDatabase();
    if (!db.analytics) db.analytics = [];

    const event = {
      id: `event-${uuidv4().slice(0, 8)}`,
      type: type || 'page_view',
      sessionId: sessionId || 'anonymous',
      productId: productId || null,
      value: value || 0,
      source: source || 'direct',
      page: page || '',
      createdAt: new Date().toISOString()
    };

    db.analytics.push(event);
    saveDatabase(db);
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get enhanced dashboard stats
app.get('/api/admin/analytics/dashboard', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { startDate, endDate } = req.query;

    let analytics = db.analytics || [];
    // Filter out orders with invalid dates
    let orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));

    // Filter by date range if provided
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        analytics = analytics.filter(e => e.createdAt && new Date(e.createdAt) >= start);
        orders = orders.filter(o => new Date(o.created_at) >= start);
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        analytics = analytics.filter(e => e.createdAt && new Date(e.createdAt) <= end);
        orders = orders.filter(o => new Date(o.created_at) <= end);
      }
    }

    // Calculate metrics
    const purchases = analytics.filter(e => e.type === 'purchase');
    const totalRevenue = purchases.reduce((sum, e) => sum + (e.value || 0), 0) +
                        orders.reduce((sum, o) => sum + (o.pricing?.total || o.total || 0), 0);
    const totalOrders = orders.length + purchases.length;
    const pageViews = analytics.filter(e => e.type === 'page_view').length;
    const addToCarts = analytics.filter(e => e.type === 'add_to_cart').length;

    // Traffic sources
    const trafficSources = {};
    analytics.forEach(e => {
      const source = e.source || 'direct';
      trafficSources[source] = (trafficSources[source] || 0) + 1;
    });

    // Top products
    const productCounts = {};
    analytics.filter(e => e.productId).forEach(e => {
      productCounts[e.productId] = (productCounts[e.productId] || 0) + 1;
    });

    const products = db.products || [];
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const product = products.find(p => p.id === id);
        return { id, name: product?.name || 'Unknown', count };
      });

    // Conversion rate
    const conversionRate = pageViews > 0 ? ((purchases.length / pageViews) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalOrders,
        pageViews,
        addToCarts,
        conversionRate,
        averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0
      },
      trafficSources,
      topProducts,
      pendingQuotes: (db.quotes || []).filter(q => q.status === 'pending').length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      totalProducts: products.filter(p => p.is_active).length,
      totalCustomers: (db.customers || []).length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get sales analytics
app.get('/api/admin/analytics/sales', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { startDate, endDate, groupBy } = req.query;

    let analytics = (db.analytics || []).filter(e => e.type === 'purchase');
    // Filter out orders with invalid dates
    let orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        analytics = analytics.filter(e => e.createdAt && new Date(e.createdAt) >= start);
        orders = orders.filter(o => new Date(o.created_at) >= start);
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        analytics = analytics.filter(e => e.createdAt && new Date(e.createdAt) <= end);
        orders = orders.filter(o => new Date(o.created_at) <= end);
      }
    }

    // Group by day/week/month
    const salesByDate = {};
    const countByDate = {};
    const addToGroup = (date, value, isOrder = false) => {
      if (!date) return;
      const d = new Date(date);
      if (isNaN(d.getTime())) return; // Skip invalid dates

      let key;
      if (groupBy === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = d.toISOString().split('T')[0];
      }
      salesByDate[key] = (salesByDate[key] || 0) + value;
      if (isOrder) {
        countByDate[key] = (countByDate[key] || 0) + 1;
      }
    };

    analytics.forEach(e => addToGroup(e.createdAt, e.value || 0, false));
    orders.forEach(o => addToGroup(o.created_at, o.pricing?.total || o.total || 0, true));

    const salesData = Object.entries(salesByDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value, count: countByDate[date] || 0 }));

    res.json({ success: true, salesData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get top products analytics
app.get('/api/admin/analytics/products', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const analytics = db.analytics || [];
    const orders = db.orders || [];
    const products = db.products || [];

    const productStats = {};

    // Initialize stats from analytics events
    analytics.filter(e => e.productId).forEach(e => {
      if (!productStats[e.productId]) {
        productStats[e.productId] = { views: 0, carts: 0, purchases: 0, revenue: 0, orders: 0, addToCart: 0 };
      }
      if (e.type === 'page_view' || e.type === 'product_view') productStats[e.productId].views++;
      if (e.type === 'add_to_cart') productStats[e.productId].addToCart++;
      if (e.type === 'purchase') {
        productStats[e.productId].purchases++;
        productStats[e.productId].revenue += e.value || 0;
      }
    });

    // Aggregate data from actual orders
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const productId = item.productId || item.product_id;
        if (productId) {
          if (!productStats[productId]) {
            productStats[productId] = { views: 0, carts: 0, purchases: 0, revenue: 0, orders: 0, addToCart: 0 };
          }
          productStats[productId].orders++;
          productStats[productId].revenue += item.lineTotal || item.price || 0;
        }
      });
    });

    const topProducts = Object.entries(productStats)
      .map(([id, stats]) => {
        const product = products.find(p => p.id === id);
        return {
          id,
          name: product?.name || 'Unknown',
          slug: product?.slug || '',
          count: stats.views,
          addToCart: stats.addToCart,
          orders: stats.orders,
          revenue: stats.revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({ success: true, products: topProducts, topProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get top fabrics analytics
app.get('/api/admin/analytics/fabrics', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = db.orders || [];
    const fabrics = db.productContent?.fabrics || [];
    const manufacturerPrices = db.manufacturerPrices || [];

    const fabricStats = {};

    // Aggregate from orders (more reliable than cart)
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        // Try to get fabric code from various places
        let fabricCode = item.fabricCode;
        if (!fabricCode && item.configuration) {
          try {
            const config = typeof item.configuration === 'string'
              ? JSON.parse(item.configuration)
              : item.configuration;
            fabricCode = config.fabricCode || config.fabric_code;
          } catch (e) {}
        }

        if (fabricCode) {
          if (!fabricStats[fabricCode]) {
            fabricStats[fabricCode] = { orders: 0, revenue: 0, quantity: 0 };
          }
          fabricStats[fabricCode].orders++;
          fabricStats[fabricCode].quantity += item.quantity || 1;
          fabricStats[fabricCode].revenue += item.lineTotal || item.price || 0;
        }
      });
    });

    const topFabrics = Object.entries(fabricStats)
      .map(([code, stats]) => {
        // Try to find fabric info from fabrics or manufacturerPrices
        const fabric = fabrics.find(f => f.code === code);
        const mfrPrice = manufacturerPrices.find(p => p.fabricCode === code);
        return {
          code,
          name: fabric?.name || mfrPrice?.fabricName || code,
          filterType: fabric?.filterType || mfrPrice?.filterType || 'unknown',
          orders: stats.orders,
          revenue: stats.revenue,
          count: stats.quantity  // For backward compatibility
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ success: true, fabrics: topFabrics, topFabrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get traffic sources
app.get('/api/admin/analytics/traffic', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const analytics = db.analytics || [];

    const sources = {};
    analytics.forEach(e => {
      const source = e.source || 'direct';
      sources[source] = (sources[source] || 0) + 1;
    });

    const trafficData = Object.entries(sources)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, trafficData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ticket 003: Enhanced Analytics Endpoints using analytics-service

// Track event (enhanced)
app.post('/api/v1/analytics/track', (req, res) => {
  try {
    const event = analyticsService.trackEvent(req.body);
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dashboard widgets (consolidated)
app.get('/api/admin/analytics/widgets', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const widgets = analyticsService.getDashboardWidgets(startDate, endDate);
    res.json({ success: true, data: widgets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Conversion funnel
app.get('/api/admin/analytics/funnel', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const funnel = analyticsService.getConversionFunnel(startDate, endDate);
    res.json({ success: true, data: funnel });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Revenue by period
app.get('/api/admin/analytics/revenue', authMiddleware, (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const data = analyticsService.getRevenueByPeriod(period || 'daily', startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-time stats
app.get('/api/admin/analytics/realtime', authMiddleware, (req, res) => {
  try {
    const stats = analyticsService.getRealTimeStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sales by category (uses actual categories from database)
app.get('/api/admin/analytics/sales-by-category', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = analyticsService.getSalesByCategory(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// COMPREHENSIVE ANALYTICS ENDPOINTS
// ============================================

// Product Analytics - Blinds Type, Control System, Measurements
app.get('/api/admin/analytics/product-insights', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));
    const products = db.products || [];
    const categories = db.categories || [];

    // Blinds Type Analytics (by category)
    const blindsTypeStats = {};
    categories.forEach(cat => {
      blindsTypeStats[cat.slug] = { name: cat.name, orders: 0, revenue: 0, items: 0 };
    });

    // Product Type Analytics (roller, zebra, honeycomb, roman)
    const productTypeStats = {
      roller: { type: 'roller', orders: 0, revenue: 0, items: 0 },
      zebra: { type: 'zebra', orders: 0, revenue: 0, items: 0 },
      honeycomb: { type: 'honeycomb', orders: 0, revenue: 0, items: 0 },
      roman: { type: 'roman', orders: 0, revenue: 0, items: 0 }
    };

    // Control System Analytics
    const controlSystemStats = {
      manual: { name: 'Manual', orders: 0, revenue: 0 },
      cordless: { name: 'Cordless', orders: 0, revenue: 0 },
      motorized: { name: 'Motorized', orders: 0, revenue: 0 }
    };

    // Motor Brand Analytics
    const motorBrandStats = {};

    // Measurements Analytics (size ranges)
    const measurementStats = {
      'small': { label: 'Small (< 24")', widthRange: [0, 24], orders: 0, revenue: 0 },
      'medium': { label: 'Medium (24-48")', widthRange: [24, 48], orders: 0, revenue: 0 },
      'large': { label: 'Large (48-72")', widthRange: [48, 72], orders: 0, revenue: 0 },
      'xlarge': { label: 'X-Large (> 72")', widthRange: [72, 999], orders: 0, revenue: 0 }
    };

    // Popular Sizes (exact dimensions)
    const popularSizes = {};

    // Hardware Options Analytics
    const valanceStats = {};
    const bottomRailStats = {};
    const rollerTypeStats = {};

    // Light Filtering Analytics
    const lightFilteringStats = {
      blackout: { name: 'Blackout', orders: 0, revenue: 0 },
      'semi-blackout': { name: 'Semi-Blackout', orders: 0, revenue: 0 },
      transparent: { name: 'Light Filtering', orders: 0, revenue: 0 },
      'super-blackout': { name: 'Super Blackout', orders: 0, revenue: 0 }
    };

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const revenue = item.lineTotal || item.price || 0;
        const qty = item.quantity || 1;

        // Get configuration
        let config = {};
        if (item.configuration) {
          try {
            config = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : item.configuration;
          } catch (e) {}
        }

        // Get product category
        const productId = item.productId || item.product_id;
        const product = products.find(p => p.id === productId);
        if (product && product.category_slug) {
          if (!blindsTypeStats[product.category_slug]) {
            blindsTypeStats[product.category_slug] = { name: product.category_slug, orders: 0, revenue: 0, items: 0 };
          }
          blindsTypeStats[product.category_slug].orders++;
          blindsTypeStats[product.category_slug].revenue += revenue;
          blindsTypeStats[product.category_slug].items += qty;
        }

        // Determine product type (roller, zebra, honeycomb, roman)
        let productType = item.product_type || 'roller';
        if (!item.product_type) {
          // Try to infer from product slug or name
          const slug = item.product_slug || (product && product.slug) || '';
          const name = (item.product_name || (product && product.name) || '').toLowerCase();
          if (slug.includes('zebra') || name.includes('zebra')) {
            productType = 'zebra';
          } else if (slug.includes('honeycomb') || slug.includes('cellular') || name.includes('honeycomb') || name.includes('cellular')) {
            productType = 'honeycomb';
          } else if (slug.includes('roman') || name.includes('roman')) {
            productType = 'roman';
          } else {
            productType = 'roller';
          }
        }
        if (productTypeStats[productType]) {
          productTypeStats[productType].orders++;
          productTypeStats[productType].revenue += revenue;
          productTypeStats[productType].items += qty;
        }

        // Control System
        const controlType = config.controlType || item.controlType || 'manual';
        if (controlSystemStats[controlType]) {
          controlSystemStats[controlType].orders++;
          controlSystemStats[controlType].revenue += revenue;
        }

        // Motor Brand (for motorized)
        if (controlType === 'motorized') {
          const motorBrand = config.motorBrand || item.motorBrand || 'unknown';
          if (!motorBrandStats[motorBrand]) {
            motorBrandStats[motorBrand] = { name: motorBrand, orders: 0, revenue: 0 };
          }
          motorBrandStats[motorBrand].orders++;
          motorBrandStats[motorBrand].revenue += revenue;
        }

        // Measurements
        const width = item.width || config.width || 24;
        const height = item.height || config.height || 36;
        const sizeKey = `${width}x${height}`;

        if (!popularSizes[sizeKey]) {
          popularSizes[sizeKey] = { width, height, orders: 0, revenue: 0 };
        }
        popularSizes[sizeKey].orders++;
        popularSizes[sizeKey].revenue += revenue;

        // Size range
        for (const [key, range] of Object.entries(measurementStats)) {
          if (width >= range.widthRange[0] && width < range.widthRange[1]) {
            measurementStats[key].orders++;
            measurementStats[key].revenue += revenue;
            break;
          }
        }

        // Light Filtering
        const lightFiltering = config.lightFiltering || item.lightFiltering || 'blackout';
        if (lightFilteringStats[lightFiltering]) {
          lightFilteringStats[lightFiltering].orders++;
          lightFilteringStats[lightFiltering].revenue += revenue;
        }

        // Valance Type
        const valance = config.standardCassette || config.valanceType || item.valanceType;
        if (valance) {
          if (!valanceStats[valance]) valanceStats[valance] = { name: valance, orders: 0 };
          valanceStats[valance].orders++;
        }

        // Bottom Rail
        const bottomRail = config.standardBottomBar || config.bottomRail || item.bottomRail;
        if (bottomRail) {
          if (!bottomRailStats[bottomRail]) bottomRailStats[bottomRail] = { name: bottomRail, orders: 0 };
          bottomRailStats[bottomRail].orders++;
        }

        // Roller Type
        const rollerType = config.rollerType || item.rollerType;
        if (rollerType) {
          if (!rollerTypeStats[rollerType]) rollerTypeStats[rollerType] = { name: rollerType, orders: 0 };
          rollerTypeStats[rollerType].orders++;
        }
      });
    });

    // Sort and format results
    const topSizes = Object.values(popularSizes)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);

    // Calculate product type percentages
    const totalProductTypeOrders = Object.values(productTypeStats).reduce((sum, pt) => sum + pt.orders, 0);
    const productTypesWithPercentage = Object.values(productTypeStats).map(pt => ({
      ...pt,
      percentage: totalProductTypeOrders > 0 ? Math.round(pt.orders / totalProductTypeOrders * 100) : 0
    })).sort((a, b) => b.orders - a.orders);

    res.json({
      success: true,
      productTypes: productTypesWithPercentage,
      blindsType: Object.values(blindsTypeStats).filter(s => s.orders > 0).sort((a, b) => b.orders - a.orders),
      controlSystem: Object.values(controlSystemStats).sort((a, b) => b.orders - a.orders),
      motorBrands: Object.values(motorBrandStats).sort((a, b) => b.orders - a.orders),
      measurements: Object.values(measurementStats),
      popularSizes: topSizes,
      lightFiltering: Object.values(lightFilteringStats).filter(s => s.orders > 0).sort((a, b) => b.orders - a.orders),
      valanceTypes: Object.values(valanceStats).sort((a, b) => b.orders - a.orders).slice(0, 10),
      bottomRails: Object.values(bottomRailStats).sort((a, b) => b.orders - a.orders).slice(0, 10),
      rollerTypes: Object.values(rollerTypeStats).sort((a, b) => b.orders - a.orders)
    });
  } catch (error) {
    console.error('Product insights error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Customer Analytics
app.get('/api/admin/analytics/customer-insights', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));
    const customers = db.customers || [];

    // Customer by location (state/city)
    const locationStats = { byState: {}, byCity: {} };

    // Customer by order count (new vs returning)
    const customerOrderCount = {};
    const customerTypeStats = { new: 0, returning: 0, loyal: 0 };

    // Customer acquisition by date
    const acquisitionByDate = {};

    // Average order value by customer type
    let newCustomerRevenue = 0, returningRevenue = 0;

    // Social login stats
    const socialLoginStats = {
      email: { name: 'Email', count: 0 },
      google: { name: 'Google', count: 0 },
      facebook: { name: 'Facebook', count: 0 },
      apple: { name: 'Apple', count: 0 }
    };

    // Top customers by spend
    const customerSpend = {};

    orders.forEach(order => {
      const email = order.customer_email || order.customer?.email || 'guest';
      const total = order.pricing?.total || order.total || 0;

      // Track customer orders
      if (!customerOrderCount[email]) {
        customerOrderCount[email] = { orders: 0, revenue: 0, firstOrder: order.created_at };
      }
      customerOrderCount[email].orders++;
      customerOrderCount[email].revenue += total;

      // Customer spend tracking
      if (!customerSpend[email]) {
        customerSpend[email] = {
          email,
          name: order.customer_name || order.customer?.name || 'Guest',
          orders: 0,
          revenue: 0
        };
      }
      customerSpend[email].orders++;
      customerSpend[email].revenue += total;

      // Location tracking
      const state = order.shipping?.state || order.shippingAddress?.state || order.customer?.address?.state;
      const city = order.shipping?.city || order.shippingAddress?.city || order.customer?.address?.city;

      if (state) {
        if (!locationStats.byState[state]) locationStats.byState[state] = { name: state, orders: 0, revenue: 0 };
        locationStats.byState[state].orders++;
        locationStats.byState[state].revenue += total;
      }
      if (city) {
        if (!locationStats.byCity[city]) locationStats.byCity[city] = { name: city, orders: 0, revenue: 0 };
        locationStats.byCity[city].orders++;
        locationStats.byCity[city].revenue += total;
      }

      // Acquisition date
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!acquisitionByDate[date]) acquisitionByDate[date] = { date, newCustomers: 0, orders: 0 };
      acquisitionByDate[date].orders++;
    });

    // Categorize customers
    for (const [email, data] of Object.entries(customerOrderCount)) {
      if (data.orders === 1) {
        customerTypeStats.new++;
        newCustomerRevenue += data.revenue;
      } else if (data.orders >= 3) {
        customerTypeStats.loyal++;
        returningRevenue += data.revenue;
      } else {
        customerTypeStats.returning++;
        returningRevenue += data.revenue;
      }

      // Track new customer acquisition
      const date = new Date(data.firstOrder).toISOString().split('T')[0];
      if (acquisitionByDate[date]) {
        acquisitionByDate[date].newCustomers++;
      }
    }

    // Social login from customers table
    customers.forEach(c => {
      const loginMethod = c.loginMethod || c.authProvider || 'email';
      if (socialLoginStats[loginMethod]) {
        socialLoginStats[loginMethod].count++;
      } else {
        socialLoginStats.email.count++;
      }
    });

    // Sort and limit results
    const topStates = Object.values(locationStats.byState).sort((a, b) => b.orders - a.orders).slice(0, 10);
    const topCities = Object.values(locationStats.byCity).sort((a, b) => b.orders - a.orders).slice(0, 10);
    const topCustomers = Object.values(customerSpend).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const acquisitionTrend = Object.values(acquisitionByDate).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      summary: {
        totalCustomers: Object.keys(customerOrderCount).length,
        newCustomers: customerTypeStats.new,
        returningCustomers: customerTypeStats.returning,
        loyalCustomers: customerTypeStats.loyal,
        avgOrderValueNew: customerTypeStats.new > 0 ? (newCustomerRevenue / customerTypeStats.new).toFixed(2) : 0,
        avgOrderValueReturning: (customerTypeStats.returning + customerTypeStats.loyal) > 0
          ? (returningRevenue / (customerTypeStats.returning + customerTypeStats.loyal)).toFixed(2) : 0
      },
      customerTypes: [
        { name: 'New (1 order)', value: customerTypeStats.new },
        { name: 'Returning (2 orders)', value: customerTypeStats.returning },
        { name: 'Loyal (3+ orders)', value: customerTypeStats.loyal }
      ],
      topStates,
      topCities,
      topCustomers,
      acquisitionTrend,
      socialLogin: Object.values(socialLoginStats)
    });
  } catch (error) {
    console.error('Customer insights error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Finance Analytics
app.get('/api/admin/analytics/finance-insights', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));
    const ledger = db.ledgerEntries || [];
    const invoices = db.invoices || [];

    // Revenue breakdown
    let totalRevenue = 0, totalMfrCost = 0, totalTax = 0, totalShipping = 0;
    let grossProfit = 0;

    // Revenue by date
    const revenueByDate = {};

    // Revenue by product category
    const revenueByCategory = {};

    // Revenue by product type (roller, zebra, honeycomb, roman)
    const productTypeRevenue = {
      roller: { type: 'roller', revenue: 0, orders: 0, mfrCost: 0 },
      zebra: { type: 'zebra', revenue: 0, orders: 0, mfrCost: 0 },
      honeycomb: { type: 'honeycomb', revenue: 0, orders: 0, mfrCost: 0 },
      roman: { type: 'roman', revenue: 0, orders: 0, mfrCost: 0 }
    };

    // Profit margin trend
    const profitByDate = {};

    // Payment method breakdown (if tracked)
    const paymentMethods = {};

    // Order status breakdown
    const orderStatusStats = {};

    // Invoice status
    const invoiceStats = { paid: 0, pending: 0, overdue: 0, totalPaid: 0, totalPending: 0 };

    orders.forEach(order => {
      const total = order.pricing?.total || order.total || 0;
      const subtotal = order.pricing?.subtotal || total;
      const tax = order.pricing?.tax || 0;
      const shipping = order.pricing?.shipping || 0;
      const mfrCost = order.pricing?.manufacturer_cost_total || 0;

      totalRevenue += total;
      totalTax += tax;
      totalShipping += shipping;
      totalMfrCost += mfrCost;

      // By date
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!revenueByDate[date]) {
        revenueByDate[date] = { date, revenue: 0, orders: 0, mfrCost: 0, profit: 0 };
      }
      revenueByDate[date].revenue += total;
      revenueByDate[date].orders++;
      revenueByDate[date].mfrCost += mfrCost;
      revenueByDate[date].profit += (subtotal - mfrCost);

      // By product category and product type
      (order.items || []).forEach(item => {
        const product = (db.products || []).find(p => p.id === (item.productId || item.product_id));
        const category = product?.category_slug || 'other';
        if (!revenueByCategory[category]) {
          revenueByCategory[category] = { name: category, revenue: 0, orders: 0 };
        }
        const itemRevenue = item.lineTotal || item.price || 0;
        const itemMfrCost = item.manufacturer_cost || item.mfrCost || 0;
        revenueByCategory[category].revenue += itemRevenue;
        revenueByCategory[category].orders++;

        // Determine product type (roller, zebra, honeycomb, roman)
        let productType = item.product_type || 'roller';
        if (!item.product_type) {
          const slug = item.product_slug || (product && product.slug) || '';
          const name = (item.product_name || (product && product.name) || '').toLowerCase();
          if (slug.includes('zebra') || name.includes('zebra')) {
            productType = 'zebra';
          } else if (slug.includes('honeycomb') || slug.includes('cellular') || name.includes('honeycomb') || name.includes('cellular')) {
            productType = 'honeycomb';
          } else if (slug.includes('roman') || name.includes('roman')) {
            productType = 'roman';
          } else {
            productType = 'roller';
          }
        }
        if (productTypeRevenue[productType]) {
          productTypeRevenue[productType].revenue += itemRevenue;
          productTypeRevenue[productType].orders++;
          productTypeRevenue[productType].mfrCost += itemMfrCost;
        }
      });

      // Order status
      const status = order.status || 'pending';
      if (!orderStatusStats[status]) orderStatusStats[status] = { name: status, count: 0, revenue: 0 };
      orderStatusStats[status].count++;
      orderStatusStats[status].revenue += total;

      // Payment method
      const paymentMethod = order.paymentMethod || order.payment?.method || 'card';
      if (!paymentMethods[paymentMethod]) paymentMethods[paymentMethod] = { name: paymentMethod, count: 0, revenue: 0 };
      paymentMethods[paymentMethod].count++;
      paymentMethods[paymentMethod].revenue += total;
    });

    // Ledger summary
    let totalPaymentsReceived = 0, totalPayableToMfr = 0, totalMfrPaid = 0;
    ledger.forEach(entry => {
      if (entry.type === 'customer_payment_received') totalPaymentsReceived += entry.amount || 0;
      if (entry.type === 'manufacturer_payable') totalPayableToMfr += Math.abs(entry.amount || 0);
      if (entry.type === 'manufacturer_paid') totalMfrPaid += Math.abs(entry.amount || 0);
    });

    // Invoice stats
    invoices.forEach(inv => {
      if (inv.status === 'paid') {
        invoiceStats.paid++;
        invoiceStats.totalPaid += inv.total || 0;
      } else if (inv.status === 'pending' || inv.status === 'sent') {
        invoiceStats.pending++;
        invoiceStats.totalPending += inv.total || 0;
      } else if (inv.status === 'overdue') {
        invoiceStats.overdue++;
        invoiceStats.totalPending += inv.total || 0;
      }
    });

    // BUG-012 FIX: Subtract shipping from gross profit calculation
    // Gross profit should be: Revenue - MFR Cost - Tax - Shipping
    // This makes it consistent with daily profit calculation (subtotal - mfrCost)
    grossProfit = totalRevenue - totalMfrCost - totalTax - totalShipping;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Sort product type revenue
    const sortedProductTypeRevenue = Object.values(productTypeRevenue)
      .filter(pt => pt.orders > 0 || pt.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      success: true,
      summary: {
        totalRevenue,
        totalMfrCost,
        grossProfit,
        profitMargin,
        totalTax,
        totalShipping,
        totalOrders: orders.length,
        avgOrderValue: orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : 0
      },
      productTypeRevenue: sortedProductTypeRevenue,
      revenueByDate: Object.values(revenueByDate).sort((a, b) => a.date.localeCompare(b.date)),
      revenueByCategory: Object.values(revenueByCategory).sort((a, b) => b.revenue - a.revenue),
      orderStatus: Object.values(orderStatusStats),
      paymentMethods: Object.values(paymentMethods),
      ledgerSummary: {
        paymentsReceived: totalPaymentsReceived,
        payableToManufacturer: totalPayableToMfr,
        paidToManufacturer: totalMfrPaid,
        outstandingPayable: totalPayableToMfr - totalMfrPaid
      },
      invoiceStats
    });
  } catch (error) {
    console.error('Finance insights error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Traffic & Session Analytics
app.get('/api/admin/analytics/traffic-insights', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const analytics = db.analytics || [];
    const sessions = db.sessions || [];
    const orders = db.orders || [];

    // Page views by page
    const pageViews = {};
    analytics.filter(e => e.type === 'page_view' || e.type === 'product_view').forEach(e => {
      const page = e.page || e.productSlug || '/';
      if (!pageViews[page]) pageViews[page] = { page, views: 0, uniqueVisitors: new Set() };
      pageViews[page].views++;
      if (e.sessionId) pageViews[page].uniqueVisitors.add(e.sessionId);
    });

    // Traffic sources
    const trafficSources = {};
    analytics.forEach(e => {
      const source = e.source || e.utm_source || 'direct';
      if (!trafficSources[source]) trafficSources[source] = { name: source, visits: 0, conversions: 0 };
      trafficSources[source].visits++;
      if (e.type === 'purchase') trafficSources[source].conversions++;
    });

    // Geographic data from orders (more reliable than analytics)
    const geoData = { byState: {}, byCity: {}, byCountry: {} };
    orders.forEach(order => {
      const state = order.shipping?.state || order.shippingAddress?.state;
      const city = order.shipping?.city || order.shippingAddress?.city;
      const country = order.shipping?.country || order.shippingAddress?.country || 'US';

      if (state) {
        if (!geoData.byState[state]) geoData.byState[state] = { name: state, orders: 0, revenue: 0 };
        geoData.byState[state].orders++;
        geoData.byState[state].revenue += order.pricing?.total || order.total || 0;
      }
      if (city) {
        if (!geoData.byCity[city]) geoData.byCity[city] = { name: city, orders: 0, revenue: 0 };
        geoData.byCity[city].orders++;
        geoData.byCity[city].revenue += order.pricing?.total || order.total || 0;
      }
      if (country) {
        if (!geoData.byCountry[country]) geoData.byCountry[country] = { name: country, orders: 0, revenue: 0 };
        geoData.byCountry[country].orders++;
        geoData.byCountry[country].revenue += order.pricing?.total || order.total || 0;
      }
    });

    // Session data
    const now = new Date();
    const activeSessionThreshold = 15 * 60 * 1000; // 15 minutes
    let activeSessions = 0;
    let totalSessionDuration = 0;
    let sessionCount = 0;

    // Aggregate sessions from analytics events
    const sessionData = {};
    analytics.forEach(e => {
      if (e.sessionId) {
        if (!sessionData[e.sessionId]) {
          sessionData[e.sessionId] = {
            id: e.sessionId,
            startTime: e.createdAt,
            lastActivity: e.createdAt,
            pageViews: 0,
            events: []
          };
        }
        sessionData[e.sessionId].pageViews++;
        sessionData[e.sessionId].lastActivity = e.createdAt;
        sessionData[e.sessionId].events.push(e.type);
      }
    });

    // Calculate session metrics
    Object.values(sessionData).forEach(session => {
      const lastActivity = new Date(session.lastActivity);
      const startTime = new Date(session.startTime);

      // Check if active
      if ((now - lastActivity) < activeSessionThreshold) {
        activeSessions++;
      }

      // Calculate duration
      const duration = lastActivity - startTime;
      if (duration > 0 && duration < 24 * 60 * 60 * 1000) { // Max 24 hours
        totalSessionDuration += duration;
        sessionCount++;
      }
    });

    const avgSessionDuration = sessionCount > 0 ? Math.round(totalSessionDuration / sessionCount / 1000) : 0; // in seconds

    // Device/Browser (if tracked in analytics)
    const deviceStats = { desktop: 0, mobile: 0, tablet: 0 };
    const browserStats = {};
    analytics.forEach(e => {
      if (e.device) {
        deviceStats[e.device] = (deviceStats[e.device] || 0) + 1;
      }
      if (e.browser) {
        browserStats[e.browser] = (browserStats[e.browser] || 0) + 1;
      }
    });

    // Social media referrals
    const socialReferrals = {
      facebook: { name: 'Facebook', visits: 0 },
      instagram: { name: 'Instagram', visits: 0 },
      pinterest: { name: 'Pinterest', visits: 0 },
      twitter: { name: 'Twitter/X', visits: 0 },
      tiktok: { name: 'TikTok', visits: 0 },
      youtube: { name: 'YouTube', visits: 0 }
    };
    analytics.forEach(e => {
      const source = (e.source || e.utm_source || '').toLowerCase();
      for (const platform of Object.keys(socialReferrals)) {
        if (source.includes(platform)) {
          socialReferrals[platform].visits++;
        }
      }
    });

    // Format page views
    const topPages = Object.values(pageViews)
      .map(p => ({ ...p, uniqueVisitors: p.uniqueVisitors.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    res.json({
      success: true,
      summary: {
        totalPageViews: analytics.filter(e => e.type === 'page_view').length,
        uniqueSessions: Object.keys(sessionData).length,
        activeSessions,
        avgSessionDuration, // in seconds
        avgSessionDurationFormatted: `${Math.floor(avgSessionDuration / 60)}m ${avgSessionDuration % 60}s`,
        bounceRate: 0 // Would need more data to calculate
      },
      topPages,
      trafficSources: Object.values(trafficSources).sort((a, b) => b.visits - a.visits),
      geographic: {
        topStates: Object.values(geoData.byState).sort((a, b) => b.orders - a.orders).slice(0, 10),
        topCities: Object.values(geoData.byCity).sort((a, b) => b.orders - a.orders).slice(0, 10),
        topCountries: Object.values(geoData.byCountry).sort((a, b) => b.orders - a.orders)
      },
      devices: Object.entries(deviceStats).map(([name, count]) => ({ name, count })),
      browsers: Object.entries(browserStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      socialReferrals: Object.values(socialReferrals).filter(s => s.visits > 0)
    });
  } catch (error) {
    console.error('Traffic insights error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Product Type Comparison API for Reports
app.get('/api/admin/analytics/product-comparison', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));
    const products = db.products || [];

    // Initialize product type stats
    const productTypeStats = {
      roller: { type: 'roller', orders: 0, items: 0, revenue: 0, mfrCost: 0, profit: 0, avgOrderValue: 0, avgItemValue: 0 },
      zebra: { type: 'zebra', orders: 0, items: 0, revenue: 0, mfrCost: 0, profit: 0, avgOrderValue: 0, avgItemValue: 0 },
      honeycomb: { type: 'honeycomb', orders: 0, items: 0, revenue: 0, mfrCost: 0, profit: 0, avgOrderValue: 0, avgItemValue: 0 },
      roman: { type: 'roman', orders: 0, items: 0, revenue: 0, mfrCost: 0, profit: 0, avgOrderValue: 0, avgItemValue: 0 }
    };

    // Configuration preferences by type
    const configByType = {
      roller: { controlTypes: {}, mountTypes: {}, lightFiltering: {}, motorBrands: {} },
      zebra: { controlTypes: {}, mountTypes: {}, lightFiltering: {}, motorBrands: {} },
      honeycomb: { controlTypes: {}, mountTypes: {}, lightFiltering: {}, motorBrands: {} },
      roman: { controlTypes: {}, mountTypes: {}, lightFiltering: {}, motorBrands: {} }
    };

    // Size ranges by type
    const sizeByType = {
      roller: { avgWidth: 0, avgHeight: 0, totalItems: 0 },
      zebra: { avgWidth: 0, avgHeight: 0, totalItems: 0 },
      honeycomb: { avgWidth: 0, avgHeight: 0, totalItems: 0 },
      roman: { avgWidth: 0, avgHeight: 0, totalItems: 0 }
    };

    // Track unique orders containing each product type
    const ordersByType = {
      roller: new Set(),
      zebra: new Set(),
      honeycomb: new Set(),
      roman: new Set()
    };

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const revenue = item.lineTotal || item.price || 0;
        const mfrCost = item.manufacturer_cost || item.mfrCost || 0;
        const qty = item.quantity || 1;

        // Determine product type
        let productType = item.product_type || 'roller';
        if (!item.product_type) {
          const product = products.find(p => p.id === (item.productId || item.product_id));
          const slug = item.product_slug || (product && product.slug) || '';
          const name = (item.product_name || (product && product.name) || '').toLowerCase();
          if (slug.includes('zebra') || name.includes('zebra')) {
            productType = 'zebra';
          } else if (slug.includes('honeycomb') || slug.includes('cellular') || name.includes('honeycomb') || name.includes('cellular')) {
            productType = 'honeycomb';
          } else if (slug.includes('roman') || name.includes('roman')) {
            productType = 'roman';
          }
        }

        if (productTypeStats[productType]) {
          productTypeStats[productType].items += qty;
          productTypeStats[productType].revenue += revenue;
          productTypeStats[productType].mfrCost += mfrCost;
          productTypeStats[productType].profit += (revenue - mfrCost);
          ordersByType[productType].add(order.id);

          // Parse configuration
          let config = {};
          if (item.configuration) {
            try {
              config = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : item.configuration;
            } catch (e) {}
          }

          // Track configuration preferences
          const controlType = config.controlType || item.controlType || 'manual';
          const mountType = config.mountType || 'inside';
          const lightFiltering = config.lightFiltering || 'blackout';
          const motorBrand = config.motorBrand || (controlType === 'motorized' ? 'unknown' : null);

          if (!configByType[productType].controlTypes[controlType]) configByType[productType].controlTypes[controlType] = 0;
          configByType[productType].controlTypes[controlType]++;

          if (!configByType[productType].mountTypes[mountType]) configByType[productType].mountTypes[mountType] = 0;
          configByType[productType].mountTypes[mountType]++;

          if (!configByType[productType].lightFiltering[lightFiltering]) configByType[productType].lightFiltering[lightFiltering] = 0;
          configByType[productType].lightFiltering[lightFiltering]++;

          if (motorBrand) {
            if (!configByType[productType].motorBrands[motorBrand]) configByType[productType].motorBrands[motorBrand] = 0;
            configByType[productType].motorBrands[motorBrand]++;
          }

          // Track sizes
          const width = item.width || config.width || 0;
          const height = item.height || config.height || 0;
          if (width > 0 && height > 0) {
            sizeByType[productType].avgWidth += width * qty;
            sizeByType[productType].avgHeight += height * qty;
            sizeByType[productType].totalItems += qty;
          }
        }
      });
    });

    // Calculate averages and order counts
    Object.keys(productTypeStats).forEach(type => {
      productTypeStats[type].orders = ordersByType[type].size;
      if (productTypeStats[type].orders > 0) {
        productTypeStats[type].avgOrderValue = productTypeStats[type].revenue / productTypeStats[type].orders;
      }
      if (productTypeStats[type].items > 0) {
        productTypeStats[type].avgItemValue = productTypeStats[type].revenue / productTypeStats[type].items;
      }
      // Calculate profit margin
      if (productTypeStats[type].revenue > 0) {
        productTypeStats[type].profitMargin = ((productTypeStats[type].profit / productTypeStats[type].revenue) * 100).toFixed(1);
      } else {
        productTypeStats[type].profitMargin = '0.0';
      }

      // Calculate average sizes
      if (sizeByType[type].totalItems > 0) {
        sizeByType[type].avgWidth = (sizeByType[type].avgWidth / sizeByType[type].totalItems).toFixed(1);
        sizeByType[type].avgHeight = (sizeByType[type].avgHeight / sizeByType[type].totalItems).toFixed(1);
      }
    });

    // Format configuration preferences
    const formattedConfig = {};
    Object.keys(configByType).forEach(type => {
      formattedConfig[type] = {
        topControlType: Object.entries(configByType[type].controlTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        topMountType: Object.entries(configByType[type].mountTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        topLightFiltering: Object.entries(configByType[type].lightFiltering).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        topMotorBrand: Object.entries(configByType[type].motorBrands).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        controlTypes: Object.entries(configByType[type].controlTypes).map(([name, count]) => ({ name, count })),
        mountTypes: Object.entries(configByType[type].mountTypes).map(([name, count]) => ({ name, count })),
        lightFiltering: Object.entries(configByType[type].lightFiltering).map(([name, count]) => ({ name, count }))
      };
    });

    // Calculate totals
    const totals = Object.values(productTypeStats).reduce((acc, type) => ({
      orders: acc.orders + type.orders,
      items: acc.items + type.items,
      revenue: acc.revenue + type.revenue,
      mfrCost: acc.mfrCost + type.mfrCost,
      profit: acc.profit + type.profit
    }), { orders: 0, items: 0, revenue: 0, mfrCost: 0, profit: 0 });

    // Calculate percentages
    Object.keys(productTypeStats).forEach(type => {
      productTypeStats[type].revenuePercentage = totals.revenue > 0 ? ((productTypeStats[type].revenue / totals.revenue) * 100).toFixed(1) : '0.0';
      productTypeStats[type].ordersPercentage = totals.orders > 0 ? ((productTypeStats[type].orders / totals.orders) * 100).toFixed(1) : '0.0';
    });

    res.json({
      success: true,
      comparison: Object.values(productTypeStats).sort((a, b) => b.revenue - a.revenue),
      totals,
      configPreferences: formattedConfig,
      avgSizes: sizeByType
    });
  } catch (error) {
    console.error('Product comparison error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track analytics event (for frontend to send events)
app.post('/api/analytics/track', (req, res) => {
  try {
    const db = loadDatabase();
    const {
      type, // page_view, product_view, add_to_cart, checkout_start, purchase
      sessionId,
      page,
      productId,
      productSlug,
      value,
      source,
      utm_source,
      utm_medium,
      utm_campaign,
      device,
      browser,
      referrer
    } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Event type required' });
    }

    const event = {
      id: require('uuid').v4(),
      type,
      sessionId: sessionId || req.headers['x-session-id'] || 'unknown',
      page,
      productId,
      productSlug,
      value: value || 0,
      source: source || utm_source || 'direct',
      utm_medium,
      utm_campaign,
      device,
      browser,
      referrer,
      createdAt: new Date().toISOString(),
      ip: req.ip
    };

    if (!db.analytics) db.analytics = [];
    db.analytics.push(event);

    // Keep only last 10000 events
    if (db.analytics.length > 10000) {
      db.analytics = db.analytics.slice(-10000);
    }

    saveDatabase(db);
    res.json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ============================================
// LEDGER/ACCOUNTING ENDPOINTS
// ============================================

// Get all ledger entries for admin accounts page
app.get('/api/admin/ledger', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { type, startDate, endDate } = req.query;

    let entries = db.ledgerEntries || [];

    // Filter by type if specified
    if (type) {
      entries = entries.filter(e => e.type === type);
    }

    // Filter by date range
    if (startDate) {
      entries = entries.filter(e => new Date(e.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      entries = entries.filter(e => new Date(e.createdAt) <= new Date(endDate));
    }

    // Sort by date descending (newest first)
    entries = entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Transform entries for the UI (convert amount to debit/credit)
    const transformedEntries = entries.map(entry => {
      // Find order number if available
      const order = entry.orderId ? (db.orders || []).find(o => o.id === entry.orderId) : null;

      return {
        id: entry.id,
        type: entry.type,
        orderId: entry.orderId,
        orderNumber: entry.metadata?.orderNumber || (order ? order.order_number : null),
        description: entry.description,
        debit: entry.amount < 0 ? Math.abs(entry.amount) : null,
        credit: entry.amount > 0 ? entry.amount : null,
        createdAt: entry.createdAt,
        metadata: entry.metadata
      };
    });

    // Calculate totals for stats
    let totalPayments = 0, totalTax = 0, totalPayable = 0;
    entries.forEach(e => {
      if (e.type === 'customer_payment_received') totalPayments += e.amount;
      if (e.type === 'sales_tax_collected') totalTax += e.amount;
      if (e.type === 'manufacturer_payable') totalPayable += Math.abs(e.amount);
    });

    res.json({
      success: true,
      entries: transformedEntries,
      stats: {
        totalPayments,
        totalTax,
        totalPayable,
        netBalance: totalPayments - totalTax - totalPayable
      }
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get ledger summary for accounts page
app.get('/api/admin/ledger/summary', authMiddleware, (req, res) => {
  try {
    const { getLedgerSummary } = require('./services/ledger-service');
    const { startDate, endDate } = req.query;

    const summary = getLedgerSummary(startDate, endDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching ledger summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// MARGIN MANAGEMENT ENDPOINTS (Admin Ticket 001)
// ============================================

// Get all margin rules
app.get('/api/admin/margins', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const margins = db.customerPriceRules || [];
    res.json({ success: true, data: margins });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get margin rules summary per product type
app.get('/api/admin/margins/summary', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const margins = db.customerPriceRules || [];

    // Group by product type
    const summary = {};
    for (const rule of margins.filter(r => r.status === 'active')) {
      const type = rule.productType || 'all';
      if (!summary[type]) {
        summary[type] = {
          productType: type,
          marginValue: rule.marginValue,
          marginType: rule.marginType,
          minMarginAmount: rule.minMarginAmount,
          ruleId: rule.id,
          ruleName: rule.name
        };
      }
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get margin for specific product
app.get('/api/admin/margins/product/:productId', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { productId } = req.params;

    // Find product
    const product = db.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Find product-specific margin rule
    const productMargin = (db.customerPriceRules || []).find(r =>
      r.productId === productId && r.status === 'active'
    );

    // Find product type margin rule
    const categorySlug = product.category_slug || '';
    let productType = 'roller';
    if (categorySlug.includes('zebra')) productType = 'zebra';
    else if (categorySlug.includes('honeycomb') || categorySlug.includes('cellular')) productType = 'honeycomb';
    else if (categorySlug.includes('roman')) productType = 'roman';

    const typeMargin = (db.customerPriceRules || []).find(r =>
      r.productType === productType && !r.productId && r.status === 'active'
    );

    res.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        productType,
        productMargin: productMargin || null,
        typeMargin: typeMargin || null,
        effectiveMargin: productMargin ? productMargin.marginValue : (typeMargin ? typeMargin.marginValue : 40),
        marginType: productMargin ? productMargin.marginType : (typeMargin ? typeMargin.marginType : 'percentage')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update or create margin for specific product
app.put('/api/admin/margins/product/:productId', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { productId } = req.params;
    const { marginValue, marginType = 'percentage', minMarginAmount } = req.body;

    // Validate
    if (marginValue === undefined || marginValue < 0 || marginValue > 500) {
      return res.status(400).json({ success: false, error: 'Invalid margin value (0-500%)' });
    }

    // Find product
    const product = db.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (!db.customerPriceRules) db.customerPriceRules = [];

    // Check if product-specific rule exists
    const existingIndex = db.customerPriceRules.findIndex(r => r.productId === productId);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update existing
      db.customerPriceRules[existingIndex].marginValue = parseFloat(marginValue);
      db.customerPriceRules[existingIndex].marginType = marginType;
      if (minMarginAmount !== undefined) {
        db.customerPriceRules[existingIndex].minMarginAmount = parseFloat(minMarginAmount);
      }
      db.customerPriceRules[existingIndex].updatedAt = now;
      db.customerPriceRules[existingIndex].updatedBy = req.user?.id || 'admin';
    } else {
      // Create new product-specific rule
      const categorySlug = product.category_slug || '';
      let productType = 'roller';
      if (categorySlug.includes('zebra')) productType = 'zebra';
      else if (categorySlug.includes('honeycomb') || categorySlug.includes('cellular')) productType = 'honeycomb';
      else if (categorySlug.includes('roman')) productType = 'roman';

      const newRule = {
        id: `cpr-prod-${uuidv4().slice(0, 8)}`,
        name: `${product.name} Margin`,
        productType,
        productId,
        fabricCode: null,
        marginType,
        marginValue: parseFloat(marginValue),
        tierRules: null,
        minMarginAmount: minMarginAmount ? parseFloat(minMarginAmount) : 15.00,
        maxCustomerPrice: null,
        priority: 10, // Product-specific rules have higher priority
        status: 'active',
        effectiveDate: now.split('T')[0],
        expirationDate: null,
        createdAt: now,
        updatedAt: now,
        createdBy: req.user?.id || 'admin'
      };
      db.customerPriceRules.push(newRule);
    }

    saveDatabase(db);

    // Audit log
    auditLogger.log({
      action: AUDIT_ACTIONS.UPDATE,
      userId: req.user?.id || 'admin',
      resourceType: 'customerPriceRule',
      resourceId: productId,
      resourceName: product.name,
      newState: { marginValue, marginType },
      metadata: { source: 'admin_products' }
    });

    res.json({ success: true, message: 'Margin updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update margin for product type (roller, zebra, etc.)
app.put('/api/admin/margins/type/:productType', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { productType } = req.params;
    const { marginValue, marginType = 'percentage', minMarginAmount } = req.body;

    // Validate product type
    const validTypes = ['roller', 'zebra', 'honeycomb', 'roman', 'all'];
    if (!validTypes.includes(productType)) {
      return res.status(400).json({ success: false, error: 'Invalid product type' });
    }

    // Validate margin value
    if (marginValue === undefined || marginValue < 0 || marginValue > 500) {
      return res.status(400).json({ success: false, error: 'Invalid margin value (0-500%)' });
    }

    if (!db.customerPriceRules) db.customerPriceRules = [];

    // Find existing type rule
    const existingIndex = db.customerPriceRules.findIndex(r =>
      r.productType === productType && !r.productId && !r.fabricCode
    );
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update existing
      db.customerPriceRules[existingIndex].marginValue = parseFloat(marginValue);
      db.customerPriceRules[existingIndex].marginType = marginType;
      if (minMarginAmount !== undefined) {
        db.customerPriceRules[existingIndex].minMarginAmount = parseFloat(minMarginAmount);
      }
      db.customerPriceRules[existingIndex].updatedAt = now;
      db.customerPriceRules[existingIndex].updatedBy = req.user?.id || 'admin';
    } else {
      // Create new type rule
      const newRule = {
        id: `cpr-type-${productType}-${uuidv4().slice(0, 8)}`,
        name: `Default ${productType.charAt(0).toUpperCase() + productType.slice(1)} Margin`,
        productType,
        productId: null,
        fabricCode: null,
        marginType,
        marginValue: parseFloat(marginValue),
        tierRules: null,
        minMarginAmount: minMarginAmount ? parseFloat(minMarginAmount) : 15.00,
        maxCustomerPrice: null,
        priority: 1,
        status: 'active',
        effectiveDate: now.split('T')[0],
        expirationDate: null,
        createdAt: now,
        updatedAt: now,
        createdBy: req.user?.id || 'admin'
      };
      db.customerPriceRules.push(newRule);
    }

    saveDatabase(db);

    // Audit log
    auditLogger.log({
      action: AUDIT_ACTIONS.UPDATE,
      userId: req.user?.id || 'admin',
      resourceType: 'customerPriceRule',
      resourceId: productType,
      resourceName: `${productType} type margin`,
      newState: { marginValue, marginType },
      metadata: { source: 'admin_margins' }
    });

    res.json({ success: true, message: 'Type margin updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete product-specific margin (falls back to type margin)
app.delete('/api/admin/margins/product/:productId', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { productId } = req.params;

    if (!db.customerPriceRules) {
      return res.json({ success: true, message: 'No margin to delete' });
    }

    const initialLength = db.customerPriceRules.length;
    db.customerPriceRules = db.customerPriceRules.filter(r => r.productId !== productId);

    if (db.customerPriceRules.length < initialLength) {
      saveDatabase(db);

      auditLogger.log({
        action: AUDIT_ACTIONS.DELETE,
        userId: req.user?.id || 'admin',
        resourceType: 'customerPriceRule',
        resourceId: productId,
        metadata: { source: 'admin_products' }
      });
    }

    res.json({ success: true, message: 'Product margin removed, will use type default' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ZEBRA SHADES FABRIC & PRICING API
// ============================================

// Get all zebra fabrics
app.get('/api/admin/zebra/fabrics', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = db.zebraFabrics || [];
    const prices = db.zebraManufacturerPrices || [];

    // Merge fabric info with pricing
    const enrichedFabrics = fabrics.map(fabric => {
      const price = prices.find(p => p.fabricCode === fabric.code) || {};
      return {
        ...fabric,
        pricePerSqMeterManual: price.pricePerSqMeterManual || 0,
        pricePerSqMeterCordless: price.pricePerSqMeterCordless || 0
      };
    });

    res.json({ success: true, fabrics: enrichedFabrics, total: enrichedFabrics.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get zebra fabric by code
app.get('/api/admin/zebra/fabrics/:code', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fabric = (db.zebraFabrics || []).find(f => f.code === req.params.code);
    if (!fabric) {
      return res.status(404).json({ success: false, error: 'Fabric not found' });
    }
    res.json({ success: true, data: fabric });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update zebra fabric
app.put('/api/admin/zebra/fabrics/:code', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { code } = req.params;
    const fabricIndex = (db.zebraFabrics || []).findIndex(f => f.code === code);

    if (fabricIndex === -1) {
      return res.status(404).json({ success: false, error: 'Fabric not found' });
    }

    // Update allowed fields
    const allowedFields = ['enabled', 'name', 'image', 'hasImage', 'status'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        db.zebraFabrics[fabricIndex][field] = req.body[field];
      }
    });
    db.zebraFabrics[fabricIndex].updatedAt = new Date().toISOString();

    saveDatabase(db);
    res.json({ success: true, data: db.zebraFabrics[fabricIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload zebra fabric image
app.post('/api/admin/zebra/fabrics/upload-image', authMiddleware, upload.single('image'), (req, res) => {
  try {
    const db = loadDatabase();
    const { fabricCode } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const fabricIndex = (db.zebraFabrics || []).findIndex(f => f.code === fabricCode);
    if (fabricIndex === -1) {
      return res.status(404).json({ success: false, error: 'Fabric not found' });
    }

    // Move file to zebra fabrics folder
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../frontend/public/images/fabrics/zebra');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const newFilename = `${fabricCode}${ext}`;
    const newPath = path.join(uploadDir, newFilename);

    // Move file from temp uploads
    fs.renameSync(req.file.path, newPath);

    // Update fabric record
    db.zebraFabrics[fabricIndex].image = `/images/fabrics/zebra/${newFilename}`;
    db.zebraFabrics[fabricIndex].hasImage = true;
    db.zebraFabrics[fabricIndex].updatedAt = new Date().toISOString();

    saveDatabase(db);

    res.json({
      success: true,
      data: {
        fabricCode,
        image: db.zebraFabrics[fabricIndex].image
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all zebra pricing with margins
app.get('/api/admin/zebra/pricing', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = db.zebraFabrics || [];
    const prices = db.zebraManufacturerPrices || [];

    // Merge fabric info with pricing
    const pricingData = prices.map(price => {
      const fabric = fabrics.find(f => f.code === price.fabricCode) || {};
      const margin = price.manualMargin || 40;
      const customerPriceManual = price.pricePerSqMeterManual * (1 + margin / 100);
      const customerPriceCordless = price.pricePerSqMeterCordless * (1 + margin / 100);

      return {
        fabricCode: price.fabricCode,
        shadingType: fabric.shadingType || 'Unknown',
        category: fabric.category || 'unknown',
        composition: fabric.composition || '',
        image: fabric.image,
        hasImage: fabric.hasImage || false,
        // Manufacturer costs
        manufacturerPriceManual: price.pricePerSqMeterManual,
        manufacturerPriceCordless: price.pricePerSqMeterCordless,
        // Margin
        margin: margin,
        marginType: 'percentage',
        // Customer prices (calculated)
        customerPriceManual: Math.round(customerPriceManual * 100) / 100,
        customerPriceCordless: Math.round(customerPriceCordless * 100) / 100,
        // Profit
        profitManual: Math.round((customerPriceManual - price.pricePerSqMeterManual) * 100) / 100,
        profitCordless: Math.round((customerPriceCordless - price.pricePerSqMeterCordless) * 100) / 100,
        minAreaSqMeter: price.minAreaSqMeter || 1.2,
        notes: price.notes,
        updatedAt: price.updatedAt
      };
    });

    res.json({
      success: true,
      data: pricingData,
      total: pricingData.length,
      summary: {
        totalFabrics: pricingData.length,
        withImages: pricingData.filter(p => p.hasImage).length,
        blackout: pricingData.filter(p => p.category === 'blackout').length,
        semiBlackout: pricingData.filter(p => p.category === 'semi-blackout').length,
        superBlackout: pricingData.filter(p => p.category === 'super-blackout').length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update zebra fabric pricing/margin
app.put('/api/admin/zebra/pricing/:fabricCode', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { fabricCode } = req.params;
    const { margin, pricePerSqMeterManual, pricePerSqMeterCordless } = req.body;

    const priceIndex = (db.zebraManufacturerPrices || []).findIndex(p => p.fabricCode === fabricCode);
    if (priceIndex === -1) {
      return res.status(404).json({ success: false, error: 'Pricing entry not found' });
    }

    if (margin !== undefined) {
      db.zebraManufacturerPrices[priceIndex].manualMargin = parseFloat(margin);
    }
    if (pricePerSqMeterManual !== undefined) {
      db.zebraManufacturerPrices[priceIndex].pricePerSqMeterManual = parseFloat(pricePerSqMeterManual);
      db.zebraManufacturerPrices[priceIndex].pricePerSqMeter = parseFloat(pricePerSqMeterManual);
    }
    if (pricePerSqMeterCordless !== undefined) {
      db.zebraManufacturerPrices[priceIndex].pricePerSqMeterCordless = parseFloat(pricePerSqMeterCordless);
    }
    db.zebraManufacturerPrices[priceIndex].updatedAt = new Date().toISOString();

    saveDatabase(db);
    res.json({ success: true, message: 'Pricing updated', data: db.zebraManufacturerPrices[priceIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk update zebra margins
app.put('/api/admin/zebra/pricing/bulk-margin', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { margin, category } = req.body;

    if (margin === undefined || margin < 0 || margin > 500) {
      return res.status(400).json({ success: false, error: 'Invalid margin value' });
    }

    let updated = 0;
    const fabrics = db.zebraFabrics || [];

    (db.zebraManufacturerPrices || []).forEach(price => {
      const fabric = fabrics.find(f => f.code === price.fabricCode);
      if (!category || (fabric && fabric.category === category)) {
        price.manualMargin = parseFloat(margin);
        price.updatedAt = new Date().toISOString();
        updated++;
      }
    });

    saveDatabase(db);
    res.json({ success: true, message: `Updated margin for ${updated} fabrics`, updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public API: Get zebra fabrics for frontend configurator
// Also aliased as /api/fabrics/zebra for zebra-product.html
const zebraFabricsHandler = (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = (db.zebraFabrics || []).filter(f => f.enabled !== false);
    const prices = db.zebraManufacturerPrices || [];

    // Merge with customer pricing
    const result = fabrics.map(fabric => {
      const price = prices.find(p => p.fabricCode === fabric.code) || {};
      const margin = price.manualMargin || 40;

      return {
        code: fabric.code,
        name: fabric.name,
        category: fabric.category,
        shadingType: fabric.shadingType,
        image: fabric.image,
        composition: fabric.composition,
        width: fabric.width,
        weight: fabric.weight,
        thickness: fabric.thickness,
        waterResistant: fabric.waterResistant,
        fireResistant: fabric.fireResistant,
        // Customer prices only (not manufacturer cost)
        pricePerSqMeterManual: Math.round(price.pricePerSqMeterManual * (1 + margin / 100) * 100) / 100,
        pricePerSqMeterCordless: Math.round(price.pricePerSqMeterCordless * (1 + margin / 100) * 100) / 100,
        // BUG-014 FIX: Zebra default min area is 1.5 sq meter (not 1.2 like roller)
        minAreaSqMeter: price.minAreaSqMeter || 1.5
      };
    });

    res.json({ success: true, fabrics: result, total: result.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
app.get('/api/zebra/fabrics', zebraFabricsHandler);
app.get('/api/fabrics/zebra', zebraFabricsHandler);

// Get zebra page content
app.get('/api/admin/zebra/page-content', authMiddleware, (req, res) => {
  try {
    const content = db.zebraPageContent || {};
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update zebra page content
app.put('/api/admin/zebra/page-content', authMiddleware, (req, res) => {
  try {
    db.zebraPageContent = {
      ...db.zebraPageContent,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    saveDatabase();
    res.json({ success: true, message: 'Page content updated', data: db.zebraPageContent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// INVOICE ENDPOINTS (Admin)
// ============================================

/**
 * GET /api/admin/invoices
 * Get all invoices with filters
 */
app.get('/api/admin/invoices', authMiddleware, (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      status: req.query.status,
      search: req.query.search,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    const result = invoiceService.getInvoices(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/invoices/summary
 * Get invoice summary/stats
 */
app.get('/api/admin/invoices/summary', authMiddleware, (req, res) => {
  try {
    const type = req.query.type || null;
    const summary = invoiceService.getInvoiceSummary(type);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/invoices/:id
 * Get invoice by ID or invoice number
 */
app.get('/api/admin/invoices/:id', authMiddleware, (req, res) => {
  try {
    const invoice = invoiceService.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    // TICKET 012: Return as 'invoice' to match frontend expectation
    res.json({ success: true, invoice: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/invoices
 * Create invoice from order
 */
app.post('/api/admin/invoices', authMiddleware, (req, res) => {
  try {
    const { orderId, type = 'customer', notes, dueDays } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' });
    }

    const invoice = invoiceService.createInvoiceFromOrder(orderId, type, {
      notes,
      dueDays: dueDays || 30
    });

    // Audit log
    auditLogger.log({
      action: 'invoice.create',
      userId: req.admin?.id,
      userEmail: req.admin?.email,
      resourceType: 'invoice',
      resourceId: invoice.id,
      resourceName: invoice.invoiceNumber,
      newState: { invoiceNumber: invoice.invoiceNumber, total: invoice.total, type }
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/invoices/:id
 * Update invoice
 */
app.put('/api/admin/invoices/:id', authMiddleware, (req, res) => {
  try {
    const { status, notes, internalNotes, dueDate } = req.body;

    const invoice = invoiceService.updateInvoice(req.params.id, {
      status,
      notes,
      internalNotes,
      dueDate
    });

    // Audit log
    auditLogger.log({
      action: 'invoice.update',
      userId: req.admin?.id,
      userEmail: req.admin?.email,
      resourceType: 'invoice',
      resourceId: invoice.id,
      resourceName: invoice.invoiceNumber,
      changes: { status, notes }
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/invoices/:id/payment
 * Record payment on invoice
 */
app.post('/api/admin/invoices/:id/payment', authMiddleware, (req, res) => {
  try {
    const { amount, method, reference, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    const invoice = invoiceService.recordPayment(req.params.id, {
      amount: parseFloat(amount),
      method,
      reference,
      notes,
      recordedBy: req.admin?.email || 'admin'
    });

    // Audit log
    auditLogger.log({
      action: 'invoice.payment',
      userId: req.admin?.id,
      userEmail: req.admin?.email,
      resourceType: 'invoice',
      resourceId: invoice.id,
      resourceName: invoice.invoiceNumber,
      changes: { amount, method, newAmountDue: invoice.amountDue }
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/invoices/:id/send
 * Mark invoice as sent (email would be sent here)
 */
app.post('/api/admin/invoices/:id/send', authMiddleware, (req, res) => {
  try {
    const invoice = invoiceService.updateInvoice(req.params.id, {
      status: invoiceService.INVOICE_STATUS.SENT
    });

    // In a real system, we'd send email here
    // For now, just update status

    res.json({ success: true, data: invoice, message: 'Invoice marked as sent' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/invoices/generate-missing
 * Generate invoices for orders that don't have one
 */
app.post('/api/admin/invoices/generate-missing', authMiddleware, (req, res) => {
  try {
    const count = invoiceService.generateMissingInvoices();
    res.json({ success: true, message: `Generated ${count} invoice(s)` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/invoices/:id/print
 * Get printable invoice (public with invoice ID)
 */
app.get('/api/invoices/:id/print', (req, res) => {
  try {
    const invoice = invoiceService.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Return invoice data for print view
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRICING ENDPOINTS (Admin + Store)
// ============================================

/**
 * POST /api/admin/manufacturer/price-preview
 * Admin-only: Get manufacturer price (without margin) for a product configuration
 */
app.post('/api/admin/manufacturer/price-preview', authMiddleware, (req, res) => {
  try {
    const { productSlug, width, height, options = {} } = req.body;

    if (!productSlug || !width || !height) {
      return res.status(400).json({
        success: false,
        error: 'productSlug, width, and height are required'
      });
    }

    // Calculate full pricing (includes manufacturer cost)
    const result = extendedPricingEngine.calculateCustomerPrice({
      productSlug,
      width: parseFloat(width),
      height: parseFloat(height),
      options
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: 'Failed to calculate price' });
    }

    // Return ONLY manufacturer price breakdown (no margin/customer price)
    res.json({
      success: true,
      data: {
        productSlug,
        dimensions: result.dimensions,
        manufacturerPrice: result.pricing.manufacturerCost.unitCost,
        optionsCost: result.pricing.options.total,
        totalManufacturerCost: result.pricing.manufacturerCost.unitCost + result.pricing.options.total,
        breakdown: {
          fabricBase: result.pricing.manufacturerCost.unitCost,
          fabricSource: result.pricing.manufacturerCost.source,
          options: result.pricing.options.breakdown
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/store/price-quote
 * Public: Get customer price quote (manufacturer cost + margin)
 */
app.post('/api/store/price-quote', (req, res) => {
  try {
    const { productSlug, width, height, quantity = 1, fabricCode, options = {} } = req.body;

    if (!productSlug || !width || !height) {
      return res.status(400).json({
        success: false,
        error: 'productSlug, width, and height are required'
      });
    }

    // Check if product is available
    const db = loadDatabase();
    const product = db.products.find(p => p.slug === productSlug);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (!product.is_active || product.is_discontinued) {
      return res.status(400).json({
        success: false,
        error: 'Product is not available for purchase',
        productStatus: {
          is_active: product.is_active,
          is_discontinued: product.is_discontinued
        }
      });
    }

    // Calculate full pricing - pass fabricCode from top-level or options
    const effectiveFabricCode = fabricCode || options.fabricCode;
    const result = extendedPricingEngine.calculateCustomerPrice({
      productSlug,
      width: parseFloat(width),
      height: parseFloat(height),
      quantity: parseInt(quantity),
      fabricCode: effectiveFabricCode,
      options
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: 'Failed to calculate price' });
    }

    // Return customer-facing price quote
    res.json({
      success: true,
      data: {
        productSlug,
        productName: result.product.name,
        dimensions: result.dimensions,
        quantity: result.quantity,
        // Price breakdown for transparency
        manufacturerPrice: result.pricing.manufacturerCost.unitCost,
        marginAmount: result.pricing.margin.amount,
        marginPercent: result.pricing.margin.percentage,
        optionsCost: result.pricing.options.total,
        // Final customer prices
        unitPrice: result.pricing.unitPrice,
        lineTotal: result.pricing.lineTotal,
        // Stock status
        stockStatus: product.stock_status || 'in_stock',
        canPurchase: product.stock_status !== 'out_of_stock'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MANUFACTURER PORTAL ENDPOINTS (Ticket 004)
// ============================================

// Manufacturer login
app.post('/api/manufacturer/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const user = manufacturerService.authenticateManufacturer(email, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'manufacturer',
      manufacturerId: user.manufacturerId,
      manufacturerName: user.manufacturerName
    });

    res.json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manufacturer auth middleware
const manufacturerAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || decoded.role !== 'manufacturer') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  req.manufacturer = decoded;
  next();
};

// Get manufacturer dashboard stats
app.get('/api/manufacturer/stats', manufacturerAuthMiddleware, (req, res) => {
  try {
    const stats = manufacturerService.getManufacturerStats(req.manufacturer.manufacturerId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get manufacturer orders
app.get('/api/manufacturer/orders', manufacturerAuthMiddleware, (req, res) => {
  try {
    const { status, orderNumber, startDate, endDate } = req.query;
    const orders = manufacturerService.getManufacturerOrders(
      req.manufacturer.manufacturerId,
      { status, orderNumber, startDate, endDate }
    );
    res.json({ success: true, data: orders, total: orders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single order detail
app.get('/api/manufacturer/orders/:orderId', manufacturerAuthMiddleware, (req, res) => {
  try {
    const order = manufacturerService.getManufacturerOrderDetail(
      req.manufacturer.manufacturerId,
      req.params.orderId
    );
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order status
app.post('/api/manufacturer/orders/:orderId/status', manufacturerAuthMiddleware, (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = manufacturerService.updateOrderStatus(
      req.manufacturer.manufacturerId,
      req.params.orderId,
      status,
      req.manufacturer.id,
      notes
    );
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add tracking info
app.post('/api/manufacturer/orders/:orderId/tracking', manufacturerAuthMiddleware, (req, res) => {
  try {
    const { carrier, trackingNumber, trackingUrl, estimatedDelivery } = req.body;

    if (!carrier || !trackingNumber) {
      return res.status(400).json({ success: false, error: 'Carrier and tracking number required' });
    }

    const order = manufacturerService.addTrackingInfo(
      req.manufacturer.manufacturerId,
      req.params.orderId,
      { carrier, trackingNumber, trackingUrl, estimatedDelivery },
      req.manufacturer.id
    );
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update shipping charges - manufacturer sets shipping when ready to ship
app.post('/api/manufacturer/orders/:orderId/shipping', manufacturerAuthMiddleware, (req, res) => {
  try {
    const { shippingCost } = req.body;

    if (shippingCost === undefined || shippingCost === null) {
      return res.status(400).json({ success: false, error: 'Shipping cost is required' });
    }

    const cost = parseFloat(shippingCost);
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ success: false, error: 'Invalid shipping cost' });
    }

    const db = loadDatabase();
    const order = db.orders.find(o => o.id === req.params.orderId || o.order_number === req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Update shipping cost
    order.shipping = cost;
    order.pricing = order.pricing || {};
    order.pricing.shipping = cost;

    // Recalculate total
    const subtotal = order.subtotal || order.pricing?.subtotal || 0;
    const tax = order.tax || order.pricing?.tax || 0;
    order.total = Math.round((subtotal + tax + cost) * 100) / 100;
    order.pricing.total = order.total;

    // Add to status history
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      fromStatus: order.status,
      toStatus: order.status,
      changedAt: new Date().toISOString(),
      changedBy: req.manufacturer.id,
      reason: `Shipping cost updated to $${cost.toFixed(2)}`
    });

    order.updated_at = new Date().toISOString();
    saveDatabase(db);

    // Update invoice if exists
    const invoice = db.invoices?.find(inv => inv.orderId === order.id);
    if (invoice) {
      invoice.shipping = cost;
      invoice.total = Math.round((invoice.subtotal + (invoice.tax || 0) + cost) * 100) / 100;
      saveDatabase(db);
    }

    // Update ledger
    const ledgerEntry = db.ledgerEntries?.find(e => e.orderId === order.id && e.type === 'shipping_charged');
    if (ledgerEntry) {
      ledgerEntry.amount = cost;
      saveDatabase(db);
    } else if (cost > 0) {
      // Create new shipping ledger entry
      db.ledgerEntries = db.ledgerEntries || [];
      db.ledgerEntries.push({
        id: `ledger-${Date.now()}`,
        orderId: order.id,
        orderNumber: order.order_number,
        type: 'shipping_charged',
        amount: cost,
        direction: 'credit',
        description: `Shipping charges for order ${order.order_number}`,
        createdAt: new Date().toISOString()
      });
      saveDatabase(db);
    }

    res.json({ success: true, message: 'Shipping cost updated', data: { shipping: cost, total: order.total } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create manufacturer user
app.post('/api/admin/manufacturers/:manufacturerId/users', authMiddleware, (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password required' });
    }

    const user = manufacturerService.createManufacturerUser(
      req.params.manufacturerId,
      { name, email, password, role }
    );
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Admin: Get manufacturers list
app.get('/api/admin/manufacturers', authMiddleware, (req, res) => {
  try {
    const manufacturers = manufacturerService.getManufacturers();
    res.json({ success: true, data: manufacturers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DEALER PORTAL ENDPOINTS (Ticket 007)
// ============================================

// Dealer login
app.post('/api/dealer/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const user = dealerService.authenticateDealer(email, password);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'dealer',
      dealerId: user.dealerId,
      dealerName: user.dealerName
    });

    res.json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dealer auth middleware
const dealerAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded || decoded.role !== 'dealer') {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  req.dealer = decoded;
  next();
};

// Get dealer dashboard stats
app.get('/api/dealer/stats', dealerAuthMiddleware, (req, res) => {
  try {
    const stats = dealerService.getDealerStats(req.dealer.dealerId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dealer orders
app.get('/api/dealer/orders', dealerAuthMiddleware, (req, res) => {
  try {
    const { status, orderNumber, customerId, startDate, endDate } = req.query;
    const orders = dealerService.getDealerOrders(
      req.dealer.dealerId,
      { status, orderNumber, customerId, startDate, endDate }
    );
    res.json({ success: true, data: orders, total: orders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single dealer order detail
app.get('/api/dealer/orders/:orderId', dealerAuthMiddleware, (req, res) => {
  try {
    const order = dealerService.getDealerOrderDetail(
      req.dealer.dealerId,
      req.params.orderId
    );
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create dealer order
app.post('/api/dealer/orders', dealerAuthMiddleware, (req, res) => {
  try {
    const order = dealerService.createDealerOrder(
      req.dealer.dealerId,
      req.body,
      req.dealer.id
    );

    // Auto-generate customer invoice for dealer order
    let invoice = null;
    try {
      invoice = invoiceService.createInvoiceFromOrder(order.id, 'customer', {
        notes: 'Auto-generated from dealer order'
      });
      console.log(`Invoice ${invoice.invoiceNumber} created for dealer order ${order.order_number || order.id}`);
    } catch (invoiceError) {
      console.error('Invoice creation error (non-fatal):', invoiceError.message);
    }

    res.json({ success: true, data: order, invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update dealer order status
app.post('/api/dealer/orders/:orderId/status', dealerAuthMiddleware, (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = dealerService.updateDealerOrderStatus(
      req.dealer.dealerId,
      req.params.orderId,
      status,
      req.dealer.id,
      notes
    );
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get dealer customers
app.get('/api/dealer/customers', dealerAuthMiddleware, (req, res) => {
  try {
    const { search } = req.query;
    const customers = dealerService.getDealerCustomers(req.dealer.dealerId, { search });
    res.json({ success: true, data: customers, total: customers.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add dealer customer
app.post('/api/dealer/customers', dealerAuthMiddleware, (req, res) => {
  try {
    const customer = dealerService.addDealerCustomer(
      req.dealer.dealerId,
      req.body,
      req.dealer.id
    );
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update dealer customer
app.put('/api/dealer/customers/:customerId', dealerAuthMiddleware, (req, res) => {
  try {
    const customer = dealerService.updateDealerCustomer(
      req.dealer.dealerId,
      req.params.customerId,
      req.body
    );
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete dealer customer
app.delete('/api/dealer/customers/:customerId', dealerAuthMiddleware, (req, res) => {
  try {
    dealerService.deleteDealerCustomer(req.dealer.dealerId, req.params.customerId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get dealer commissions
app.get('/api/dealer/commissions', dealerAuthMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const commissions = dealerService.getDealerCommissions(
      req.dealer.dealerId,
      { startDate, endDate }
    );
    res.json({ success: true, data: commissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dealer pricing
app.get('/api/dealer/pricing', dealerAuthMiddleware, (req, res) => {
  try {
    const pricing = dealerService.getDealerPricing(req.dealer.dealerId);
    res.json({ success: true, data: pricing });
  } catch (error) {
    // Return 401 for dealer not found (need to re-login)
    if (error.code === 'DEALER_NOT_FOUND') {
      return res.status(401).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get dealers list
app.get('/api/admin/dealers', authMiddleware, (req, res) => {
  try {
    const dealers = dealerService.getDealers();
    res.json({ success: true, data: dealers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get single dealer
app.get('/api/admin/dealers/:dealerId', authMiddleware, (req, res) => {
  try {
    const dealer = dealerService.getDealer(req.params.dealerId);
    if (!dealer) {
      return res.status(404).json({ success: false, error: 'Dealer not found' });
    }
    res.json({ success: true, data: dealer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create dealer
app.post('/api/admin/dealers', authMiddleware, (req, res) => {
  try {
    const dealer = dealerService.createDealer(req.body, req.admin.id);
    res.json({ success: true, data: dealer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Admin: Update dealer
app.put('/api/admin/dealers/:dealerId', authMiddleware, (req, res) => {
  try {
    const dealer = dealerService.updateDealer(
      req.params.dealerId,
      req.body,
      req.admin.id
    );
    res.json({ success: true, data: dealer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Admin: Create dealer user
app.post('/api/admin/dealers/:dealerId/users', authMiddleware, (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password required' });
    }

    const user = dealerService.createDealerUser(
      req.params.dealerId,
      { name, email, password, role }
    );
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// NOTIFICATIONS API ENDPOINTS
// ============================================

// Admin: Get notifications
app.get('/api/admin/notifications', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const notifications = (db.notifications || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Mark notification as read
app.put('/api/admin/notifications/:id/read', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const notification = (db.notifications || []).find(n => n.id === req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    notification.read = true;
    saveDatabase(db);
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Mark all notifications as read
app.put('/api/admin/notifications/read-all', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    (db.notifications || []).forEach(n => n.read = true);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: Create notification
function createNotification(db, type, title, message, link) {
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: `notif-${uuidv4().slice(0, 8)}`,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString()
  });
}

// ============================================
// CUSTOMERS API ENDPOINTS
// ============================================

// Admin: Get all customers
app.get('/api/admin/customers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    let customers = db.customers || [];
    const { search, type, sort } = req.query;

    if (search) {
      const s = search.toLowerCase();
      customers = customers.filter(c =>
        c.email.toLowerCase().includes(s) ||
        c.firstName.toLowerCase().includes(s) ||
        c.lastName.toLowerCase().includes(s) ||
        (c.companyName && c.companyName.toLowerCase().includes(s))
      );
    }

    if (type) {
      customers = customers.filter(c => c.type === type);
    }

    if (sort === 'spent') {
      customers.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sort === 'orders') {
      customers.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (sort === 'recent') {
      customers.sort((a, b) => new Date(b.lastOrderAt || b.createdAt) - new Date(a.lastOrderAt || a.createdAt));
    } else {
      customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ success: true, customers, total: customers.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get single customer with orders
app.get('/api/admin/customers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customer = (db.customers || []).find(c => c.id === req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const orders = (db.orders || []).filter(o => o.customerId === customer.id);
    res.json({ success: true, customer, orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create customer
app.post('/api/admin/customers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.customers) db.customers = [];

    const { email, firstName, lastName, phone, type, companyName, addresses, tags, notes } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'Email, first name, and last name are required' });
    }

    const existing = db.customers.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, error: 'Customer with this email already exists' });
    }

    const customer = {
      id: `cust-${uuidv4().slice(0, 8)}`,
      email,
      firstName,
      lastName,
      phone: phone || '',
      type: type || 'retail',
      companyName: companyName || '',
      addresses: addresses || [],
      tags: tags || [],
      notes: notes || '',
      totalOrders: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      lastOrderAt: null
    };

    db.customers.push(customer);
    saveDatabase(db);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update customer
app.put('/api/admin/customers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customerIndex = (db.customers || []).findIndex(c => c.id === req.params.id);
    if (customerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const { email, firstName, lastName, phone, type, companyName, addresses, tags, notes } = req.body;
    const customer = db.customers[customerIndex];

    if (email) customer.email = email;
    if (firstName) customer.firstName = firstName;
    if (lastName) customer.lastName = lastName;
    if (phone !== undefined) customer.phone = phone;
    if (type) customer.type = type;
    if (companyName !== undefined) customer.companyName = companyName;
    if (addresses) customer.addresses = addresses;
    if (tags) customer.tags = tags;
    if (notes !== undefined) customer.notes = notes;

    saveDatabase(db);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete customer
app.delete('/api/admin/customers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customerIndex = (db.customers || []).findIndex(c => c.id === req.params.id);
    if (customerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    db.customers.splice(customerIndex, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Add customer note
app.post('/api/admin/customers/:id/notes', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customer = (db.customers || []).find(c => c.id === req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const { note } = req.body;
    customer.notes = customer.notes ? `${customer.notes}\n\n${new Date().toLocaleString()}: ${note}` : note;
    saveDatabase(db);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DRAFT ORDERS API ENDPOINTS
// ============================================

// Admin: Get all draft orders with search, filtering, and pagination
app.get('/api/admin/draft-orders', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { search, status, page = 1, limit = 20 } = req.query;

    let draftOrders = [...(db.draftOrders || [])];

    // Filter by status
    if (status) {
      draftOrders = draftOrders.filter(d => d.status === status);
    }

    // Search by draft number, customer name, or email
    if (search) {
      const searchLower = search.toLowerCase();
      draftOrders = draftOrders.filter(d =>
        (d.draftNumber && d.draftNumber.toLowerCase().includes(searchLower)) ||
        (d.customerName && d.customerName.toLowerCase().includes(searchLower)) ||
        (d.customerEmail && d.customerEmail.toLowerCase().includes(searchLower)) ||
        (d.id && d.id.toLowerCase().includes(searchLower))
      );
    }

    // Sort by creation date (newest first)
    draftOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get total before pagination
    const total = draftOrders.length;

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedOrders = draftOrders.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      draftOrders: paginatedOrders,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get single draft order
app.get('/api/admin/draft-orders/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const draftOrder = (db.draftOrders || []).find(d => d.id === req.params.id);
    if (!draftOrder) {
      return res.status(404).json({ success: false, error: 'Draft order not found' });
    }
    res.json({ success: true, draftOrder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create draft order
app.post('/api/admin/draft-orders', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.draftOrders) db.draftOrders = [];

    const draftCount = db.draftOrders.length + 1;
    const draftNumber = `D-${String(draftCount).padStart(3, '0')}`;

    const draftOrder = {
      id: `draft-${uuidv4().slice(0, 8)}`,
      draftNumber,
      customerId: req.body.customerId || null,
      customerEmail: req.body.customerEmail || '',
      customerName: req.body.customerName || '',
      items: req.body.items || [],
      measurements: req.body.measurements || {},
      subtotal: req.body.subtotal || 0,
      discount: req.body.discount || null,
      tax: req.body.tax || 0,
      shipping: req.body.shipping || 0,
      total: req.body.total || 0,
      status: 'open',
      paymentStatus: 'pending',
      internalNotes: req.body.internalNotes || '',
      attachments: [],
      timeline: [{ action: 'created', timestamp: new Date().toISOString(), user: 'Admin' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.draftOrders.push(draftOrder);
    saveDatabase(db);
    res.json({ success: true, draftOrder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update draft order
app.put('/api/admin/draft-orders/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const draftOrder = (db.draftOrders || []).find(d => d.id === req.params.id);
    if (!draftOrder) {
      return res.status(404).json({ success: false, error: 'Draft order not found' });
    }

    Object.assign(draftOrder, req.body, { updatedAt: new Date().toISOString() });
    draftOrder.timeline.push({ action: 'updated', timestamp: new Date().toISOString(), user: 'Admin' });

    saveDatabase(db);
    res.json({ success: true, draftOrder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete draft order
app.delete('/api/admin/draft-orders/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.draftOrders || []).findIndex(d => d.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Draft order not found' });
    }
    db.draftOrders.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Convert draft order to real order
app.post('/api/admin/draft-orders/:id/complete', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const draftOrder = (db.draftOrders || []).find(d => d.id === req.params.id);
    if (!draftOrder) {
      return res.status(404).json({ success: false, error: 'Draft order not found' });
    }

    if (!db.orders) db.orders = [];
    const orderCount = db.orders.length + 1;
    const orderNumber = `ORD-${String(orderCount).padStart(6, '0')}`;

    // Calculate manufacturer cost totals from items
    let totalManufacturerCost = 0;
    let totalOptionsManufacturerCost = 0;
    let totalAccessoriesManufacturerCost = 0;

    (draftOrder.items || []).forEach(item => {
      const ps = item.price_snapshot || {};
      const mfrPrice = ps.manufacturer_price || {};
      const customerPrice = ps.customer_price || {};
      const qty = item.quantity || 1;

      totalManufacturerCost += (mfrPrice.unit_cost || mfrPrice.cost || 0) * qty;

      (customerPrice.options_breakdown || []).forEach(opt => {
        totalOptionsManufacturerCost += (opt.manufacturerCost || 0) * qty;
      });

      (customerPrice.accessories_breakdown || []).forEach(acc => {
        totalAccessoriesManufacturerCost += (acc.manufacturerCost || 0);
      });
    });

    const totalMfrCost = totalManufacturerCost + totalOptionsManufacturerCost + totalAccessoriesManufacturerCost;
    const subtotal = draftOrder.subtotal || 0;
    const marginTotal = subtotal - totalMfrCost;
    const marginPercent = subtotal > 0 ? ((marginTotal / subtotal) * 100) : 0;

    const order = {
      id: uuidv4(),
      order_number: orderNumber,
      customerId: draftOrder.customerId,
      customer_name: draftOrder.customerName,
      customer_email: draftOrder.customerEmail,
      items: draftOrder.items,
      subtotal: draftOrder.subtotal,
      tax: draftOrder.tax,
      shipping: draftOrder.shipping,
      total: draftOrder.total,
      status: 'pending',
      fulfillmentStatus: 'unfulfilled',
      timeline: [{ action: 'created', timestamp: new Date().toISOString(), user: 'Admin' }],
      internalNotes: draftOrder.internalNotes ? [{ id: uuidv4(), text: draftOrder.internalNotes, createdBy: 'Admin', createdAt: new Date().toISOString() }] : [],
      attachments: draftOrder.attachments || [],
      pricing: {
        subtotal: draftOrder.subtotal,
        tax: draftOrder.tax,
        shipping: draftOrder.shipping,
        total: draftOrder.total,
        manufacturer_cost_total: Math.round(totalMfrCost * 100) / 100,
        margin_total: Math.round(marginTotal * 100) / 100,
        margin_percent: Math.round(marginPercent * 100) / 100
      },
      created_at: new Date().toISOString()
    };

    db.orders.push(order);
    draftOrder.status = 'completed';
    draftOrder.timeline.push({ action: 'converted_to_order', timestamp: new Date().toISOString(), user: 'Admin', orderNumber });

    // Update customer stats
    if (draftOrder.customerId) {
      const customer = (db.customers || []).find(c => c.id === draftOrder.customerId);
      if (customer) {
        customer.totalOrders++;
        customer.totalSpent += draftOrder.total;
        customer.lastOrderAt = new Date().toISOString();
      }
    }

    createNotification(db, 'order', 'New Order Created', `Order ${orderNumber} created from draft`, `/admin/orders.html?id=${order.id}`);
    saveDatabase(db);

    // Auto-generate customer invoice
    let invoice = null;
    try {
      invoice = invoiceService.createInvoiceFromOrder(order.id, 'customer', {
        notes: 'Auto-generated from draft order'
      });
      console.log(`Invoice ${invoice.invoiceNumber} created for order ${order.order_number}`);
    } catch (invoiceError) {
      console.error('Invoice creation error (non-fatal):', invoiceError.message);
    }

    res.json({ success: true, order, draftOrder, invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ABANDONED CHECKOUTS API ENDPOINTS
// ============================================

// Admin: Get abandoned checkouts with filtering, search, and pagination
app.get('/api/admin/abandoned-checkouts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { search, status, page = 1, limit = 20 } = req.query;

    let checkouts = [...(db.abandonedCheckouts || [])];

    // Filter by status
    if (status) {
      checkouts = checkouts.filter(c => c.status === status);
    }

    // Search by customer name, email, or checkout ID
    if (search) {
      const searchLower = search.toLowerCase();
      checkouts = checkouts.filter(c =>
        (c.customer_name && c.customer_name.toLowerCase().includes(searchLower)) ||
        (c.customerName && c.customerName.toLowerCase().includes(searchLower)) ||
        (c.customer_email && c.customer_email.toLowerCase().includes(searchLower)) ||
        (c.customerEmail && c.customerEmail.toLowerCase().includes(searchLower)) ||
        (c.id && c.id.toLowerCase().includes(searchLower))
      );
    }

    // Sort by creation date (newest first)
    checkouts.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

    // Calculate stats
    const stats = {
      total: checkouts.length,
      abandoned: checkouts.filter(c => c.status === 'abandoned' || !c.status).length,
      recovered: checkouts.filter(c => c.status === 'recovered').length,
      emailed: checkouts.filter(c => c.status === 'emailed').length,
      potentialRevenue: checkouts.reduce((sum, c) => sum + (c.total || 0), 0)
    };

    // Get total before pagination
    const total = checkouts.length;

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedCheckouts = checkouts.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      abandonedCheckouts: paginatedCheckouts,
      stats,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get single abandoned checkout
app.get('/api/admin/abandoned-checkouts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkout = (db.abandonedCheckouts || []).find(c => c.id === req.params.id);
    if (!checkout) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }
    res.json({ success: true, checkout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update abandoned checkout status (mark as recovered, etc.)
app.put('/api/admin/abandoned-checkouts/:id/status', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkout = (db.abandonedCheckouts || []).find(c => c.id === req.params.id);
    if (!checkout) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    const { status } = req.body;
    const validStatuses = ['abandoned', 'emailed', 'recovered', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Valid: abandoned, emailed, recovered, expired' });
    }

    checkout.status = status;
    checkout.updatedAt = new Date().toISOString();

    if (status === 'recovered') {
      checkout.recoveredAt = new Date().toISOString();
    }

    saveDatabase(db);
    res.json({ success: true, checkout, message: `Checkout marked as ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Send recovery email for abandoned checkout
app.post('/api/admin/abandoned-checkouts/:id/send-recovery', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkout = (db.abandonedCheckouts || []).find(c => c.id === req.params.id);
    if (!checkout) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    const email = checkout.customer_email || checkout.customerEmail;
    if (!email) {
      return res.status(400).json({ success: false, error: 'No email address associated with this checkout' });
    }

    // Update checkout status and log the email attempt
    checkout.status = 'emailed';
    checkout.lastEmailSentAt = new Date().toISOString();
    checkout.emailCount = (checkout.emailCount || 0) + 1;
    checkout.updatedAt = new Date().toISOString();

    // Add to email history
    if (!checkout.emailHistory) checkout.emailHistory = [];
    checkout.emailHistory.push({
      sentAt: new Date().toISOString(),
      type: 'recovery',
      sentBy: 'Admin'
    });

    saveDatabase(db);

    // In production, you would send actual email here
    // For now, we just log and update status
    console.log(`Recovery email queued for ${email} - Checkout ID: ${checkout.id}`);

    res.json({
      success: true,
      message: `Recovery email sent to ${email}`,
      checkout
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete abandoned checkout
app.delete('/api/admin/abandoned-checkouts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.abandonedCheckouts || []).findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }
    db.abandonedCheckouts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Abandoned checkout deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Convert abandoned checkout to draft order
app.post('/api/admin/abandoned-checkouts/:id/convert-to-draft', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkout = (db.abandonedCheckouts || []).find(c => c.id === req.params.id);
    if (!checkout) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    if (!db.draftOrders) db.draftOrders = [];

    const draftCount = db.draftOrders.length + 1;
    const draftNumber = `D-${String(draftCount).padStart(3, '0')}`;

    const draftOrder = {
      id: `draft-${uuidv4().slice(0, 8)}`,
      draftNumber,
      customerId: checkout.customerId || null,
      customerEmail: checkout.customer_email || checkout.customerEmail || '',
      customerName: checkout.customer_name || checkout.customerName || '',
      items: checkout.items || [],
      subtotal: checkout.subtotal || 0,
      tax: checkout.tax || 0,
      shipping: checkout.shipping || 0,
      total: checkout.total || 0,
      status: 'open',
      paymentStatus: 'pending',
      internalNotes: `Converted from abandoned checkout ${checkout.id}`,
      timeline: [
        { action: 'created_from_abandoned', timestamp: new Date().toISOString(), user: 'Admin', sourceId: checkout.id }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.draftOrders.push(draftOrder);

    // Update abandoned checkout status
    checkout.status = 'recovered';
    checkout.recoveredAt = new Date().toISOString();
    checkout.convertedToDraftId = draftOrder.id;
    checkout.updatedAt = new Date().toISOString();

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Abandoned checkout converted to draft order',
      draftOrder,
      checkout
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BLOG POSTS API ENDPOINTS
// ============================================

// Public: Get published blog posts
app.get('/api/blog/posts', (req, res) => {
  try {
    const db = loadDatabase();
    const posts = (db.blogPosts || [])
      .filter(p => p.status === 'published' && new Date(p.publishedAt) <= new Date())
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Get single blog post by slug
app.get('/api/blog/posts/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const post = (db.blogPosts || []).find(p => p.slug === req.params.slug && p.status === 'published');
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all blog posts
app.get('/api/admin/blog/posts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const posts = (db.blogPosts || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get single blog post
app.get('/api/admin/blog/posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const post = (db.blogPosts || []).find(p => p.id === req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create blog post
app.post('/api/admin/blog/posts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.blogPosts) db.blogPosts = [];

    const { title, slug, content, excerpt, featuredImage, status, publishedAt, tags, seoTitle, seoDescription } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const post = {
      id: `post-${uuidv4().slice(0, 8)}`,
      title,
      slug: postSlug,
      content: content || '',
      excerpt: excerpt || '',
      author: 'Admin',
      featuredImage: featuredImage || '',
      status: status || 'draft',
      publishedAt: publishedAt || new Date().toISOString(),
      tags: tags || [],
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || excerpt,
      createdAt: new Date().toISOString()
    };

    db.blogPosts.push(post);
    saveDatabase(db);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update blog post
app.put('/api/admin/blog/posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const post = (db.blogPosts || []).find(p => p.id === req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    Object.assign(post, req.body);
    saveDatabase(db);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete blog post
app.delete('/api/admin/blog/posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.blogPosts || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    db.blogPosts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAGES API ENDPOINTS
// ============================================

// Public: Get page by slug
app.get('/api/pages/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const page = (db.pages || []).find(p => p.slug === req.params.slug && p.isVisible);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all pages
app.get('/api/admin/pages', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const pages = db.pages || [];
    res.json({ success: true, pages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get single page
app.get('/api/admin/pages/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const page = (db.pages || []).find(p => p.id === req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create page
app.post('/api/admin/pages', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.pages) db.pages = [];

    const { title, slug, content, template, isVisible, seoTitle, seoDescription } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const pageSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const page = {
      id: `page-${uuidv4().slice(0, 8)}`,
      title,
      slug: pageSlug,
      content: content || '',
      template: template || 'default',
      isVisible: isVisible !== false,
      seoTitle: seoTitle || title,
      seoDescription: seoDescription || '',
      createdAt: new Date().toISOString()
    };

    db.pages.push(page);
    saveDatabase(db);
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update page
app.put('/api/admin/pages/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const page = (db.pages || []).find(p => p.id === req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    Object.assign(page, req.body);
    saveDatabase(db);
    res.json({ success: true, page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete page
app.delete('/api/admin/pages/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.pages || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    db.pages.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Duplicate page
app.post('/api/admin/pages/:id/duplicate', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const page = (db.pages || []).find(p => p.id === req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
    const newPage = {
      ...JSON.parse(JSON.stringify(page)),
      id: `page-${Date.now()}`,
      title: page.title + ' (Copy)',
      slug: page.slug + '-copy-' + Date.now(),
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!db.pages) db.pages = [];
    db.pages.push(newPage);
    saveDatabase(db);
    res.json({ success: true, page: newPage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAGE BUILDER TEMPLATES API
// ============================================

// Get all templates
app.get('/api/admin/page-templates', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, templates: db.pageTemplates || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create template from page
app.post('/api/admin/page-templates', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.pageTemplates) db.pageTemplates = [];
    const template = {
      id: `template-${Date.now()}`,
      name: req.body.name,
      description: req.body.description || '',
      thumbnail: req.body.thumbnail || '',
      category: req.body.category || 'custom',
      content: req.body.content,
      createdAt: new Date().toISOString()
    };
    db.pageTemplates.push(template);
    saveDatabase(db);
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete template
app.delete('/api/admin/page-templates/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.pageTemplates || []).findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    db.pageTemplates.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BLOG POSTS API
// ============================================

// Get all blog posts
app.get('/api/admin/blog-posts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, posts: db.blogPosts || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single blog post
app.get('/api/admin/blog-posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const post = (db.blogPosts || []).find(p => p.id === req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create blog post
app.post('/api/admin/blog-posts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.blogPosts) db.blogPosts = [];

    const newPost = {
      id: 'post-' + Date.now(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.blogPosts.unshift(newPost);
    saveDatabase(db);
    res.json({ success: true, post: newPost });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update blog post
app.put('/api/admin/blog-posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.blogPosts || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    db.blogPosts[index] = {
      ...db.blogPosts[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, post: db.blogPosts[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete blog post
app.delete('/api/admin/blog-posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.blogPosts || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    db.blogPosts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public blog posts API (for frontend)
app.get('/api/blog-posts', (req, res) => {
  try {
    const db = loadDatabase();
    const posts = (db.blogPosts || [])
      .filter(p => p.status === 'published')
      .map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        featuredImage: p.featuredImage,
        author: p.author,
        category: p.category,
        tags: p.tags,
        publishedAt: p.publishedAt
      }));
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single blog post by slug (public)
app.get('/api/blog-posts/by-slug/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const post = (db.blogPosts || []).find(p => p.slug === req.params.slug && p.status === 'published');
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MARKETING API
// ============================================

// Email Campaigns
app.get('/api/admin/marketing/campaigns', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, campaigns: db.emailCampaigns || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/marketing/campaigns/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const campaign = (db.emailCampaigns || []).find(c => c.id === req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/marketing/campaigns', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.emailCampaigns) db.emailCampaigns = [];
    const campaign = {
      id: `campaign-${Date.now()}`,
      ...req.body,
      recipients: 0,
      sent: 0,
      opened: 0,
      clicked: 0,
      createdAt: new Date().toISOString()
    };
    db.emailCampaigns.push(campaign);
    saveDatabase(db);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/marketing/campaigns/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.emailCampaigns || []).findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    db.emailCampaigns[index] = { ...db.emailCampaigns[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, campaign: db.emailCampaigns[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/marketing/campaigns/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.emailCampaigns || []).findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    db.emailCampaigns.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Social Media Posts
app.get('/api/admin/marketing/social-posts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, posts: db.socialPosts || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/marketing/social-posts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.socialPosts) db.socialPosts = [];
    const post = {
      id: `social-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    db.socialPosts.push(post);
    saveDatabase(db);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/marketing/social-posts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.socialPosts || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    db.socialPosts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Promotions / Discount Codes
app.get('/api/admin/marketing/promotions', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, promotions: db.promotions || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/marketing/promotions/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const promo = (db.promotions || []).find(p => p.id === req.params.id);
    if (!promo) {
      return res.status(404).json({ success: false, error: 'Promotion not found' });
    }
    res.json({ success: true, promotion: promo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/marketing/promotions', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.promotions) db.promotions = [];
    const promo = {
      id: `promo-${Date.now()}`,
      ...req.body,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
    db.promotions.push(promo);
    saveDatabase(db);
    res.json({ success: true, promotion: promo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/marketing/promotions/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.promotions || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Promotion not found' });
    }
    db.promotions[index] = { ...db.promotions[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, promotion: db.promotions[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/marketing/promotions/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.promotions || []).findIndex(p => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Promotion not found' });
    }
    db.promotions.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate promo code (public API for checkout)
app.post('/api/validate-promo', (req, res) => {
  try {
    const db = loadDatabase();
    const { code, orderTotal } = req.body;
    const promo = (db.promotions || []).find(p =>
      p.code.toLowerCase() === code.toLowerCase() &&
      p.status === 'active'
    );

    if (!promo) {
      return res.json({ success: false, error: 'Invalid or expired promo code' });
    }

    // Check minimum purchase
    if (promo.minPurchase && orderTotal < promo.minPurchase) {
      return res.json({ success: false, error: `Minimum purchase of $${promo.minPurchase} required` });
    }

    // Check usage limit
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      return res.json({ success: false, error: 'Promo code usage limit reached' });
    }

    // Check date validity
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) {
      return res.json({ success: false, error: 'Promo code not yet active' });
    }
    if (promo.endDate && new Date(promo.endDate) < now) {
      return res.json({ success: false, error: 'Promo code has expired' });
    }

    res.json({
      success: true,
      promotion: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        minPurchase: promo.minPurchase
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subscribers
app.get('/api/admin/marketing/subscribers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, subscribers: db.subscribers || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/marketing/subscribers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const sub = (db.subscribers || []).find(s => s.id === req.params.id);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Subscriber not found' });
    }
    res.json({ success: true, subscriber: sub });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/marketing/subscribers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.subscribers) db.subscribers = [];

    // Check for duplicate email
    if (db.subscribers.some(s => s.email.toLowerCase() === req.body.email.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    const sub = {
      id: `sub-${Date.now()}`,
      ...req.body,
      status: 'subscribed',
      engagement: 0,
      subscribedDate: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    db.subscribers.push(sub);
    saveDatabase(db);
    res.json({ success: true, subscriber: sub });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/marketing/subscribers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.subscribers || []).findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Subscriber not found' });
    }
    db.subscribers[index] = { ...db.subscribers[index], ...req.body, lastActivity: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, subscriber: db.subscribers[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/marketing/subscribers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.subscribers || []).findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Subscriber not found' });
    }
    db.subscribers.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public newsletter subscription endpoint
app.post('/api/subscribe', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.subscribers) db.subscribers = [];

    const { email, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Check for duplicate
    if (db.subscribers.some(s => s.email.toLowerCase() === email.toLowerCase())) {
      return res.json({ success: true, message: 'You are already subscribed!' });
    }

    const sub = {
      id: `sub-${Date.now()}`,
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      status: 'subscribed',
      tags: ['newsletter'],
      engagement: 0,
      subscribedDate: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    db.subscribers.push(sub);
    saveDatabase(db);
    res.json({ success: true, message: 'Successfully subscribed!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Automations
app.get('/api/admin/marketing/automations', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, automations: db.automations || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/marketing/automations/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const auto = (db.automations || []).find(a => a.id === req.params.id);
    if (!auto) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    res.json({ success: true, automation: auto });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/marketing/automations', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.automations) db.automations = [];
    const auto = {
      id: `auto-${Date.now()}`,
      ...req.body,
      active: false,
      stats: { sent: 0, opened: 0, clicked: 0, revenue: 0 },
      createdAt: new Date().toISOString()
    };
    db.automations.push(auto);
    saveDatabase(db);
    res.json({ success: true, automation: auto });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/marketing/automations/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.automations || []).findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    db.automations[index] = { ...db.automations[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, automation: db.automations[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/marketing/automations/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.automations || []).findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    db.automations.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Social Media Accounts
app.get('/api/admin/marketing/social-accounts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, accounts: db.socialAccounts || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/marketing/social-accounts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.socialAccounts) db.socialAccounts = [];
    const account = {
      id: `social-acc-${Date.now()}`,
      ...req.body,
      connected: true,
      connectedAt: new Date().toISOString()
    };
    db.socialAccounts.push(account);
    saveDatabase(db);
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/marketing/social-accounts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.socialAccounts || []).findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }
    db.socialAccounts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAGE BUILDER COMPONENTS API
// ============================================

// Get component library (global reusable components)
app.get('/api/admin/page-components', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, components: db.pageComponents || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save component to library
app.post('/api/admin/page-components', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.pageComponents) db.pageComponents = [];
    const component = {
      id: `comp-${Date.now()}`,
      name: req.body.name,
      category: req.body.category || 'custom',
      data: req.body.data,
      createdAt: new Date().toISOString()
    };
    db.pageComponents.push(component);
    saveDatabase(db);
    res.json({ success: true, component });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete component from library
app.delete('/api/admin/page-components/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.pageComponents || []).findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }
    db.pageComponents.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAGE BUILDER GLOBAL STYLES API
// ============================================

// Get global styles
app.get('/api/admin/page-builder-settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, settings: db.pageBuilderSettings || {
      globalStyles: {
        primaryColor: '#8E6545',
        secondaryColor: '#333333',
        fontFamily: 'Montserrat, sans-serif',
        headingFont: 'Montserrat, sans-serif',
        baseFontSize: '16px',
        containerWidth: '1200px'
      },
      defaultSections: []
    }});
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update global styles
app.put('/api/admin/page-builder-settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    db.pageBuilderSettings = { ...db.pageBuilderSettings, ...req.body };
    saveDatabase(db);
    res.json({ success: true, settings: db.pageBuilderSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FILES API ENDPOINTS
// ============================================

// Admin: Get all files
app.get('/api/admin/files', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    let files = db.files || [];
    const { category, search } = req.query;

    if (category) {
      files = files.filter(f => f.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      files = files.filter(f =>
        f.filename.toLowerCase().includes(s) ||
        f.originalName.toLowerCase().includes(s) ||
        (f.tags || []).some(t => t.toLowerCase().includes(s))
      );
    }

    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Upload file to media library
app.post('/api/admin/files', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const db = loadDatabase();
    if (!db.files) db.files = [];

    const file = {
      id: `file-${uuidv4().slice(0, 8)}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/images/uploads/${req.file.filename}`,
      alt: req.body.alt || '',
      category: req.body.category || 'general',
      tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
      createdAt: new Date().toISOString()
    };

    db.files.push(file);
    saveDatabase(db);
    res.json({ success: true, file });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update file metadata
app.put('/api/admin/files/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const file = (db.files || []).find(f => f.id === req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const { alt, category, tags } = req.body;
    if (alt !== undefined) file.alt = alt;
    if (category) file.category = category;
    if (tags) file.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());

    saveDatabase(db);
    res.json({ success: true, file });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete file
app.delete('/api/admin/files/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const fileIndex = (db.files || []).findIndex(f => f.id === req.params.id);
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const file = db.files[fileIndex];
    const filePath = path.join(__dirname, '../frontend/public', file.url);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.files.splice(fileIndex, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Bulk delete files
app.post('/api/admin/files/bulk-delete', authMiddleware, (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'File IDs required' });
    }

    const db = loadDatabase();
    let deletedCount = 0;

    ids.forEach(id => {
      const fileIndex = (db.files || []).findIndex(f => f.id === id);
      if (fileIndex !== -1) {
        const file = db.files[fileIndex];
        const filePath = path.join(__dirname, '../frontend/public', file.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        db.files.splice(fileIndex, 1);
        deletedCount++;
      }
    });

    saveDatabase(db);
    res.json({ success: true, deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCT PAGE ELEMENTS API ENDPOINTS
// ============================================

// Admin: Get product page elements
app.get('/api/admin/product-page-elements', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const elements = db.productPageElements || { sections: [], globalElements: {} };
    res.json({ success: true, elements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update all product page elements
app.put('/api/admin/product-page-elements', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    db.productPageElements = req.body;
    saveDatabase(db);
    res.json({ success: true, elements: db.productPageElements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Add section
app.post('/api/admin/product-page-elements/section', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productPageElements) db.productPageElements = { sections: [], globalElements: {} };

    const section = {
      id: `section-${uuidv4().slice(0, 8)}`,
      type: req.body.type || 'custom',
      title: req.body.title || 'New Section',
      isVisible: req.body.isVisible !== false,
      sortOrder: db.productPageElements.sections.length + 1,
      elements: []
    };

    db.productPageElements.sections.push(section);
    saveDatabase(db);
    res.json({ success: true, section });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update section
app.put('/api/admin/product-page-elements/section/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const section = (db.productPageElements?.sections || []).find(s => s.id === req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    Object.assign(section, req.body);
    saveDatabase(db);
    res.json({ success: true, section });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete section
app.delete('/api/admin/product-page-elements/section/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const sections = db.productPageElements?.sections || [];
    const index = sections.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }
    sections.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Add element to section
app.post('/api/admin/product-page-elements/element', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { sectionId, type, content, link, icon, style } = req.body;

    const section = (db.productPageElements?.sections || []).find(s => s.id === sectionId);
    if (!section) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    const element = {
      id: `elem-${uuidv4().slice(0, 8)}`,
      type: type || 'text',
      content: content || '',
      link: link || '',
      icon: icon || '',
      style: style || {},
      isVisible: true,
      sortOrder: section.elements.length + 1
    };

    section.elements.push(element);
    saveDatabase(db);
    res.json({ success: true, element });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update element
app.put('/api/admin/product-page-elements/element/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    let element = null;

    for (const section of db.productPageElements?.sections || []) {
      element = section.elements.find(e => e.id === req.params.id);
      if (element) break;
    }

    if (!element) {
      return res.status(404).json({ success: false, error: 'Element not found' });
    }

    Object.assign(element, req.body);
    saveDatabase(db);
    res.json({ success: true, element });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete element
app.delete('/api/admin/product-page-elements/element/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();

    for (const section of db.productPageElements?.sections || []) {
      const index = section.elements.findIndex(e => e.id === req.params.id);
      if (index !== -1) {
        section.elements.splice(index, 1);
        saveDatabase(db);
        return res.json({ success: true });
      }
    }

    res.status(404).json({ success: false, error: 'Element not found' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Reorder sections/elements
app.put('/api/admin/product-page-elements/reorder', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { sections } = req.body;

    if (sections) {
      db.productPageElements.sections = sections;
    }

    saveDatabase(db);
    res.json({ success: true, elements: db.productPageElements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PRODUCT PAGE SECTIONS API (Shopify-like Page Builder)
// ============================================================================

// Get page sections for a product
app.get('/api/admin/product-page-sections/:slug', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    if (!db.productPageSections) db.productPageSections = {};
    if (!db.productPageLayouts) db.productPageLayouts = {};
    if (!db.productPageStyles) db.productPageStyles = {};

    const sections = db.productPageSections[slug] || [];
    const layout = db.productPageLayouts[slug] || {
      galleryPosition: 'left',
      configuratorStyle: 'dropdown',
      showBreadcrumbs: true,
      stickyConfigurator: true,
      mobileLayout: 'stacked'
    };
    const styles = db.productPageStyles[slug] || {};

    res.json({ success: true, sections, layout, styles, slug });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save page sections for a product
app.put('/api/admin/product-page-sections/:slug', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;
    const { sections, layout, styles } = req.body;

    if (!db.productPageSections) db.productPageSections = {};
    if (!db.productPageLayouts) db.productPageLayouts = {};
    if (!db.productPageStyles) db.productPageStyles = {};

    db.productPageSections[slug] = sections;

    // Save layout settings if provided
    if (layout) {
      db.productPageLayouts[slug] = layout;
    }

    // Save CSS styles if provided
    if (styles) {
      db.productPageStyles[slug] = styles;
    }

    saveDatabase(db);

    // Also update the product's name and description if product-title section exists
    const titleSection = sections.find(s => s.type === 'product-title' && s.isVisible);
    if (titleSection && titleSection.data) {
      const product = db.products.find(p => p.slug === slug);
      if (product) {
        if (titleSection.data.title) product.name = titleSection.data.title;
        if (titleSection.data.description) product.description = titleSection.data.description;
        product.updated_at = new Date().toISOString();
        saveDatabase(db);
      }
    }

    // Update product images if image-gallery section exists
    const gallerySection = sections.find(s => s.type === 'image-gallery' && s.isVisible);
    if (gallerySection && gallerySection.data) {
      const product = db.products.find(p => p.slug === slug);
      if (product) {
        if (gallerySection.data.mainImage) product.image_url = gallerySection.data.mainImage;
        if (gallerySection.data.images) product.gallery_images = gallerySection.data.images.filter(Boolean);
        product.updated_at = new Date().toISOString();
        saveDatabase(db);
      }
    }

    res.json({ success: true, sections, message: 'Page sections saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get page sections for public access (no auth required)
app.get('/api/product-page-sections/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    if (!db.productPageSections) db.productPageSections = {};
    if (!db.productPageLayouts) db.productPageLayouts = {};
    if (!db.productPageStyles) db.productPageStyles = {};

    // Only return visible sections
    const sections = (db.productPageSections[slug] || []).filter(s => s.isVisible !== false);

    // Return layout settings (with defaults)
    const layout = db.productPageLayouts[slug] || {
      galleryPosition: 'left',
      configuratorStyle: 'dropdown',
      showBreadcrumbs: true,
      stickyConfigurator: true,
      mobileLayout: 'stacked'
    };

    // Return CSS styles
    const styles = db.productPageStyles[slug] || {};

    res.json({ success: true, sections, layout, styles, slug });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PRODUCT OPTIONS CONFIGURATION API
// ============================================================================

// Default product options template (used when no custom options exist)
// Organized by MAIN OPTIONS (accordion sections) with their SUB-OPTIONS
const defaultProductOptions = {
  // ============================================
  // MAIN OPTION SECTIONS (Accordion Groups)
  // ============================================
  mainSections: [
    { id: "dimensions", label: "Width X Height", order: 1, required: true },
    { id: "roomLabel", label: "Room Label", order: 2, required: false },
    { id: "shadeStyle", label: "Shade Style", order: 3, required: true },
    { id: "mountControlSolar", label: "Mount, Control and Solar Type", order: 4, required: true },
    { id: "hardwareType", label: "Hardware Type", order: 5, required: true },
    { id: "accessories", label: "Accessories", order: 6, required: false }
  ],

  // ============================================
  // 1. DIMENSIONS (Width X Height)
  // ============================================
  dimensions: {
    label: "Width X Height",
    section: "dimensions",
    type: "dimensions",
    settings: {
      minWidth: 12,
      maxWidth: 120,
      minHeight: 12,
      maxHeight: 120,
      defaultWidth: 24,
      defaultHeight: 36,
      units: ["in", "cm", "mm"],
      defaultUnit: "in"
    }
  },

  // ============================================
  // 2. ROOM LABEL
  // ============================================
  roomLabel: {
    label: "Room Label",
    section: "roomLabel",
    type: "dropdown",
    options: [
      { value: "master-bedroom", name: "Master Bedroom", isDefault: true },
      { value: "guest-bedroom", name: "Guest Bedroom" },
      { value: "living-room", name: "Living Room" },
      { value: "dining-room", name: "Dining Room" },
      { value: "kitchen", name: "Kitchen" },
      { value: "bathroom", name: "Bathroom" },
      { value: "office", name: "Office" }
    ]
  },

  // ============================================
  // 3. SHADE STYLE (Light Filtering + Fabric Color)
  // ============================================
  lightFiltering: {
    label: "Light Filtering",
    section: "shadeStyle",
    type: "buttons",
    options: [
      { value: "transparent", name: "Light Filtering", price: 0 },
      { value: "blackout", name: "Blackout", price: 0, isDefault: true },
      { value: "semi-blackout", name: "Semi-Blackout", price: 0 },
      { value: "super-blackout", name: "Super Blackout", price: 5.00 }
    ]
  },

  fabricColor: {
    label: "Fabric Color",
    section: "shadeStyle",
    type: "swatches",
    note: "Fabric swatches are loaded based on Light Filtering selection",
    categories: {
      blackout: { folder: "/images/RollerBlinds_Zstar_Fabric_Samples/Blackout/", prefix: "_blackout" },
      transparent: { folder: "/images/RollerBlinds_Zstar_Fabric_Samples/LightFiltering/", prefix: "_lightfiltering" },
      "semi-blackout": { folder: "/images/RollerBlinds_Zstar_Fabric_Samples/SemiBlackout/", prefix: "_semiblackout" },
      "super-blackout": { folder: "/images/RollerBlinds_Zstar_Fabric_Samples/SuperBlackout/", prefix: "_superblackout" }
    }
  },

  // ============================================
  // 4. MOUNT, CONTROL AND SOLAR TYPE
  // ============================================
  mountType: {
    label: "Mount Type",
    section: "mountControlSolar",
    type: "image-swatches",
    options: [
      { value: "inside", name: "Inside Mount", price: 0, image: "/images/mount-control/inside-mount.svg", isDefault: true },
      { value: "outside", name: "Outside Mount", price: 10.00, image: "/images/mount-control/outside-mount.svg" }
    ]
  },

  controlType: {
    label: "Control Type",
    section: "mountControlSolar",
    type: "image-swatches",
    options: [
      { value: "manual", name: "Manual", price: 0, image: "/images/mount-control/manual.svg", isDefault: true },
      { value: "cordless", name: "Cordless", price: 25.00, image: "/images/mount-control/cordless.svg" },
      { value: "motorized", name: "Motorized", price: 100.00, image: "/images/mount-control/motorized.svg" }
    ]
  },

  chainLocation: {
    label: "Chain Location",
    section: "mountControlSolar",
    type: "buttons",
    showWhen: { controlType: "manual" },
    options: [
      { value: "left", name: "Left", isDefault: true },
      { value: "right", name: "Right" }
    ]
  },

  motorLocation: {
    label: "Motor Location",
    section: "mountControlSolar",
    type: "buttons",
    showWhen: { controlType: "motorized" },
    options: [
      { value: "right", name: "Right", isDefault: true },
      { value: "left", name: "Left" }
    ]
  },

  chainType: {
    label: "Control System",
    section: "mountControlSolar",
    type: "image-swatches",
    options: [
      { value: "bead-chain-plastic", name: "Bead Chain", price: 0, image: "/images/control-system/bead-chain.png", isDefault: true },
      { value: "bead-chain-wand", name: "Chain + Wand", price: 8.00, image: "/images/control-system/bead-chain-wand.png" },
      { value: "cordless", name: "Cordless", price: 25.00, image: "/images/control-system/cordless.png" },
      { value: "motorized-app", name: "Motorized", price: 100.00, image: "/images/control-system/motorized-app.png" },
      { value: "cordless-motorized", name: "2 in 1", price: 120.00, image: "/images/control-system/cordless-motorized.png" }
    ]
  },

  motorType: {
    label: "Motor Type",
    section: "mountControlSolar",
    type: "buttons",
    options: [
      { value: "battery", name: "Battery", isDefault: true },
      { value: "plugin-wire", name: "Plugin Wire" },
      { value: "solar-powered", name: "Solar Powered" }
    ]
  },

  remoteType: {
    label: "Remote Type",
    section: "mountControlSolar",
    type: "buttons",
    options: [
      { value: "single-channel", name: "Single Channel", isDefault: true },
      { value: "6-channel", name: "6 Channel" },
      { value: "15-channel", name: "15 Channel" }
    ]
  },

  solarType: {
    label: "Solar Type",
    section: "mountControlSolar",
    type: "buttons",
    options: [
      { value: "yes", name: "Yes", isDefault: true },
      { value: "no", name: "No" }
    ]
  },

  // ============================================
  // 5. HARDWARE TYPE
  // ============================================
  valanceType: {
    label: "Valance Type",
    section: "hardwareType",
    type: "image-swatches",
    options: [
      { value: "square-v2", name: "Square V2", price: 0, image: "/images/hardware/square-v2.png", isDefault: true },
      { value: "fabric-wrapped-v3", name: "Fabric Wrapped V3", price: 6.00, image: "/images/hardware/fabric-wrapped-v3.png" },
      { value: "fabric-inserted-s1", name: "Fabric Inserted S1", price: 3.50, image: "/images/hardware/fabric-inserted-s1.png" },
      { value: "curve-white-s2", name: "Curve White S2", price: 5.00, image: "/images/hardware/curve-white-s2.png" },
      { value: "fabric-wrapped-s3", name: "Fabric Wrapped S3", price: 5.50, image: "/images/hardware/fabric-wrapped-s3.png" },
      { value: "simple-rolling", name: "Simple Rolling", price: 0, image: "/images/hardware/simple-rolling.png" }
    ]
  },

  bottomRail: {
    label: "Bottom Rail",
    section: "hardwareType",
    type: "image-swatches",
    options: [
      { value: "type-a-waterdrop", name: "Type A Streamlined Water-drop", price: 0, image: "/images/bottom-rail/type-a-waterdrop.png", isDefault: true },
      { value: "simple-rolling", name: "Simple Rolling", price: 0.90, image: "/images/bottom-rail/simple-rolling.png" },
      { value: "type-b", name: "Type B", price: 1.00, image: "/images/bottom-rail/type-b.png" },
      { value: "type-c-fabric-wrapped", name: "Type C Fabric Wrapped", price: 1.50, image: "/images/bottom-rail/type-c-fabric-wrapped.png" },
      { value: "type-d", name: "Type D", price: 1.50, image: "/images/bottom-rail/type-d.png" }
    ]
  },

  rollerType: {
    label: "Roller Type",
    section: "hardwareType",
    type: "image-swatches",
    options: [
      { value: "forward-roll", name: "Forward Roll", price: 0, image: "/images/mount-control/forward-roll.svg", description: "Close to window", isDefault: true },
      { value: "reverse-roll", name: "Reverse Roll", price: 5.00, image: "/images/mount-control/reverse-roll.svg", description: "Extra clearance" }
    ]
  },

  sideCover: {
    label: "Side Cover Color",
    section: "hardwareType",
    type: "color-swatches",
    options: [
      { value: "white", name: "White", price: 0, color: "#FFFFFF", isDefault: true },
      { value: "gray", name: "Gray", price: 0, color: "#808080" },
      { value: "black", name: "Black", price: 0, color: "#333333" }
    ]
  },

  // ============================================
  // 6. ACCESSORIES
  // ============================================
  accessories: {
    label: "Accessories",
    section: "accessories",
    type: "quantity-items",
    options: [
      { value: "smartHub", name: "Smart Hub", price: 45.00, maxQty: 10 },
      { value: "usbCharger", name: "USB Charger", price: 15.00, maxQty: 10 }
    ]
  }
};

// Get product options configuration (Admin)
app.get('/api/admin/products/:slug/options', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    if (!db.productOptions) db.productOptions = {};

    // Return product-specific options or defaults
    const options = db.productOptions[slug] || JSON.parse(JSON.stringify(defaultProductOptions));

    res.json({
      success: true,
      slug,
      options,
      isDefault: !db.productOptions[slug]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save product options configuration (Admin)
app.put('/api/admin/products/:slug/options', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;
    const { options } = req.body;

    if (!db.productOptions) db.productOptions = {};

    // Save options for this product
    db.productOptions[slug] = options;

    saveDatabase(db);
    res.json({ success: true, message: 'Product options saved successfully', options });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product options configuration (Public - for product page)
app.get('/api/products/:slug/options', (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    if (!db.productOptions) db.productOptions = {};

    // Return product-specific options or defaults
    const options = db.productOptions[slug] || JSON.parse(JSON.stringify(defaultProductOptions));

    // Include motor brands from database (filtered to active only)
    const motorBrands = (db.motorBrands || [])
      .filter(b => b.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(b => ({
        value: b.value,
        label: b.label,
        price: b.price,
        priceType: b.priceType || 'flat',
        manufacturerCost: b.manufacturerCost
      }));

    // Merge pricing from hardwareOptions (primary source - check productContent first)
    const hw = db.productContent?.hardwareOptions || db.hardwareOptions || {};

    // Helper function to merge hardware options
    const mergeHardwareOptions = (optionKey, targetKey) => {
      if (hw[optionKey] && options[targetKey] && options[targetKey].options) {
        const hwMap = {};
        hw[optionKey].forEach(opt => { hwMap[opt.value] = opt; });
        options[targetKey].options = options[targetKey].options.map(opt => ({
          ...opt,
          price: hwMap[opt.value]?.price ?? opt.price,
          priceType: hwMap[opt.value]?.priceType || 'flat'
        }));
      }
    };

    // Merge all hardware options
    mergeHardwareOptions('chainType', 'chainType');
    mergeHardwareOptions('valanceType', 'valanceType');
    mergeHardwareOptions('bottomRail', 'bottomRail');
    mergeHardwareOptions('rollerType', 'rollerType');
    mergeHardwareOptions('remoteType', 'remoteType');
    mergeHardwareOptions('accessories', 'accessories');
    mergeHardwareOptions('solarPanel', 'solarPanel');
    mergeHardwareOptions('mountType', 'mountType');
    mergeHardwareOptions('controlType', 'controlType');

    // Remote types - use hardwareOptions or default prices
    if (options.remoteType && options.remoteType.options) {
      const hwRemote = {};
      (hw.remoteType || []).forEach(r => { hwRemote[r.value] = r; });
      const defaultRemotePrices = { 'single-channel': 6, '1-channel': 4.40, '6-channel': 6.60, '15-channel': 11.35 };
      options.remoteType.options = options.remoteType.options.map(opt => ({
        ...opt,
        price: hwRemote[opt.value]?.price ?? defaultRemotePrices[opt.value] ?? opt.price ?? 0
      }));
    }

    // Merge product-specific pricing from productPageLayouts if exists (overrides hardwareOptions)
    if (db.productPageLayouts && db.productPageLayouts[slug]) {
      const layout = db.productPageLayouts[slug];

      // Merge chainType prices
      if (layout.chainType && options.chainType) {
        const layoutChainMap = {};
        layout.chainType.forEach(opt => { layoutChainMap[opt.value] = opt; });
        options.chainType.options = options.chainType.options.map(opt => ({
          ...opt,
          price: layoutChainMap[opt.value]?.price ?? opt.price,
          priceType: layoutChainMap[opt.value]?.priceType || opt.priceType || 'flat'
        }));
      }

      // Merge valanceType prices
      if (layout.valanceType && options.valanceType) {
        const layoutValanceMap = {};
        layout.valanceType.forEach(opt => { layoutValanceMap[opt.value] = opt; });
        options.valanceType.options = options.valanceType.options.map(opt => ({
          ...opt,
          price: layoutValanceMap[opt.value]?.price ?? opt.price,
          priceType: layoutValanceMap[opt.value]?.priceType || opt.priceType || 'flat'
        }));
      }

      // Merge bottomRail prices
      if (layout.bottomRail && options.bottomRail) {
        const layoutBottomMap = {};
        layout.bottomRail.forEach(opt => { layoutBottomMap[opt.value] = opt; });
        options.bottomRail.options = options.bottomRail.options.map(opt => ({
          ...opt,
          price: layoutBottomMap[opt.value]?.price ?? opt.price,
          priceType: layoutBottomMap[opt.value]?.priceType || opt.priceType || 'flat'
        }));
      }

      // Merge rollerType prices
      if (layout.rollerType && options.rollerType) {
        const layoutRollerMap = {};
        layout.rollerType.forEach(opt => { layoutRollerMap[opt.value] = opt; });
        options.rollerType.options = options.rollerType.options.map(opt => ({
          ...opt,
          price: layoutRollerMap[opt.value]?.price ?? opt.price,
          priceType: layoutRollerMap[opt.value]?.priceType || opt.priceType || 'flat'
        }));
      }

      // Merge remoteType prices
      if (layout.remoteType && options.remoteType) {
        const layoutRemoteMap = {};
        layout.remoteType.forEach(opt => { layoutRemoteMap[opt.value] = opt; });
        options.remoteType.options = options.remoteType.options.map(opt => ({
          ...opt,
          price: layoutRemoteMap[opt.value]?.price ?? opt.price,
          priceType: layoutRemoteMap[opt.value]?.priceType || opt.priceType || 'flat'
        }));
      }

      // Merge accessories prices
      if (layout.accessories && options.accessories) {
        const layoutAccMap = {};
        layout.accessories.forEach(opt => { layoutAccMap[opt.value] = opt; });
        options.accessories.options = options.accessories.options.map(opt => ({
          ...opt,
          price: layoutAccMap[opt.value]?.price ?? opt.price
        }));
      }
    }

    res.json({
      success: true,
      slug,
      options,
      motorBrands
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// VISUAL BUILDER API ENDPOINTS
// ============================================================================

// Get visual builder layout for a page
app.get('/api/admin/visual-builder/:page', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { page } = req.params;

    if (!db.visualBuilderLayouts) db.visualBuilderLayouts = {};

    const layout = db.visualBuilderLayouts[page] || { elements: [] };
    res.json({ success: true, ...layout });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save visual builder layout for a page
app.put('/api/admin/visual-builder/:page', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { page } = req.params;
    const { elements, lastModified } = req.body;

    if (!db.visualBuilderLayouts) db.visualBuilderLayouts = {};

    db.visualBuilderLayouts[page] = {
      elements: elements || [],
      lastModified: lastModified || new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, message: 'Layout saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// THEME & CUSTOMIZATION API ENDPOINTS
// ============================================================================

// Get all theme settings
app.get('/api/admin/theme', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.themeSettings) {
      db.themeSettings = {
        colors: {
          primary: '#8E6545',
          primaryDark: '#7a5539',
          secondary: '#333333',
          accent: '#C49B6C',
          textDark: '#1a1a1a',
          textLight: '#ffffff',
          textMuted: '#6b7280',
          bgCream: '#F6F1EB',
          bgLight: '#f9fafb',
          bgWhite: '#ffffff',
          borderLight: '#e5e7eb',
          borderMedium: '#d1d5db',
          success: '#28a745',
          error: '#dc3545',
          warning: '#ffc107'
        },
        fonts: {
          primary: { family: 'Montserrat', url: '' },
          secondary: { family: 'Open Sans', url: '' },
          sizes: {
            xs: '11px',
            sm: '13px',
            base: '14px',
            md: '16px',
            lg: '18px',
            xl: '22px'
          }
        },
        spacing: {},
        borderRadius: {},
        shadows: {}
      };
      saveDatabase(db);
    }
    // Ensure all color keys exist (for existing databases missing some colors)
    const defaultColors = {
      primary: '#8E6545',
      primaryDark: '#7a5539',
      secondary: '#333333',
      accent: '#C49B6C',
      textDark: '#1a1a1a',
      textLight: '#ffffff',
      textMuted: '#6b7280',
      bgCream: '#F6F1EB',
      bgLight: '#f9fafb',
      bgWhite: '#ffffff',
      borderLight: '#e5e7eb',
      borderMedium: '#d1d5db',
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107'
    };
    db.themeSettings.colors = { ...defaultColors, ...db.themeSettings.colors };
    res.json({ success: true, data: db.themeSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update theme colors
app.put('/api/admin/theme/colors', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.themeSettings) db.themeSettings = {};
    db.themeSettings.colors = { ...db.themeSettings.colors, ...req.body };
    saveDatabase(db);
    res.json({ success: true, message: 'Colors updated', data: db.themeSettings.colors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update theme fonts
app.put('/api/admin/theme/fonts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.themeSettings) db.themeSettings = {};
    db.themeSettings.fonts = { ...db.themeSettings.fonts, ...req.body };
    saveDatabase(db);
    res.json({ success: true, message: 'Fonts updated', data: db.themeSettings.fonts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add custom font
app.post('/api/admin/theme/fonts/add', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.themeSettings) db.themeSettings = {};
    if (!db.themeSettings.customFonts) db.themeSettings.customFonts = [];

    const newFont = {
      id: uuidv4(),
      family: req.body.family,
      url: req.body.url,
      weights: req.body.weights || ['400'],
      createdAt: new Date().toISOString()
    };

    db.themeSettings.customFonts.push(newFont);
    saveDatabase(db);
    res.json({ success: true, message: 'Font added', data: newFont });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete custom font
app.delete('/api/admin/theme/fonts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.themeSettings?.customFonts) {
      return res.status(404).json({ success: false, error: 'No custom fonts found' });
    }

    const index = db.themeSettings.customFonts.findIndex(f => f.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Font not found' });
    }

    db.themeSettings.customFonts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Font deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update full theme settings
app.put('/api/admin/theme', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    db.themeSettings = { ...db.themeSettings, ...req.body };
    saveDatabase(db);
    res.json({ success: true, message: 'Theme settings updated', data: db.themeSettings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SITE IMAGES API ENDPOINTS
// ============================================================================

// Get all site images
app.get('/api/admin/images', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteImages) {
      db.siteImages = { logo: null, favicon: null, gallery: [] };
      saveDatabase(db);
    }

    // Also get list of uploaded files
    const uploadsPath = path.join(__dirname, '../frontend/public/images/uploads');
    let uploadedFiles = [];
    if (fs.existsSync(uploadsPath)) {
      uploadedFiles = fs.readdirSync(uploadsPath)
        .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
        .map(f => ({
          filename: f,
          url: `/images/uploads/${f}`,
          size: fs.statSync(path.join(uploadsPath, f)).size,
          modified: fs.statSync(path.join(uploadsPath, f)).mtime
        }));
    }

    res.json({ success: true, data: db.siteImages, uploadedFiles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update site images
app.put('/api/admin/images', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    db.siteImages = { ...db.siteImages, ...req.body };
    saveDatabase(db);
    res.json({ success: true, message: 'Images updated', data: db.siteImages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add image to gallery
app.post('/api/admin/images/gallery', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteImages) db.siteImages = { gallery: [] };
    if (!db.siteImages.gallery) db.siteImages.gallery = [];

    const newImage = {
      id: uuidv4(),
      url: req.body.url,
      alt: req.body.alt || '',
      category: req.body.category || 'general',
      createdAt: new Date().toISOString()
    };

    db.siteImages.gallery.push(newImage);
    saveDatabase(db);
    res.json({ success: true, message: 'Image added to gallery', data: newImage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete image from gallery
app.delete('/api/admin/images/gallery/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.siteImages?.gallery) {
      return res.status(404).json({ success: false, error: 'Gallery not found' });
    }

    const index = db.siteImages.gallery.findIndex(img => img.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    db.siteImages.gallery.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Image removed from gallery' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete uploaded file
app.delete('/api/admin/images/file/:filename', authMiddleware, (req, res) => {
  try {
    const filePath = path.join(__dirname, '../frontend/public/images/uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted' });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PAGE SECTIONS API ENDPOINTS
// ============================================================================

// Get page sections configuration
app.get('/api/admin/page-sections', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.pageSections) {
      db.pageSections = { product: {} };
      saveDatabase(db);
    }
    res.json({ success: true, data: db.pageSections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update page sections
app.put('/api/admin/page-sections', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    db.pageSections = { ...db.pageSections, ...req.body };
    saveDatabase(db);
    res.json({ success: true, message: 'Page sections updated', data: db.pageSections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update specific page section
app.put('/api/admin/page-sections/:page/:section', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { page, section } = req.params;

    if (!db.pageSections) db.pageSections = {};
    if (!db.pageSections[page]) db.pageSections[page] = {};

    db.pageSections[page][section] = req.body;
    saveDatabase(db);
    res.json({ success: true, message: `${section} updated`, data: db.pageSections[page][section] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FABRIC CATEGORIES API ENDPOINTS
// ============================================================================

// Get fabric categories
app.get('/api/admin/fabric-categories', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.fabricCategories) {
      db.fabricCategories = [
        { id: 'blackout', name: 'Blackout', folder: 'Blackout', enabled: true }
      ];
      saveDatabase(db);
    }

    // Get actual fabric files for each category
    const fabricsPath = path.join(__dirname, '../frontend/public/images/RollerBlinds_Zstar_Fabric_Samples');
    const categoriesWithFiles = db.fabricCategories.map(cat => {
      const catPath = path.join(fabricsPath, cat.folder);
      let files = [];
      if (fs.existsSync(catPath)) {
        files = fs.readdirSync(catPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
      }
      return { ...cat, fileCount: files.length, files };
    });

    res.json({ success: true, data: categoriesWithFiles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update fabric category
app.put('/api/admin/fabric-categories/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.fabricCategories) db.fabricCategories = [];

    const index = db.fabricCategories.findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    db.fabricCategories[index] = { ...db.fabricCategories[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, message: 'Category updated', data: db.fabricCategories[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add fabric category
app.post('/api/admin/fabric-categories', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.fabricCategories) db.fabricCategories = [];

    const newCategory = {
      id: req.body.id || uuidv4(),
      name: req.body.name,
      folder: req.body.folder,
      enabled: req.body.enabled !== false
    };

    db.fabricCategories.push(newCategory);

    // Create folder if it doesn't exist
    const folderPath = path.join(__dirname, '../frontend/public/images/RollerBlinds_Zstar_Fabric_Samples', newCategory.folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    saveDatabase(db);
    res.json({ success: true, message: 'Category added', data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete fabric category
app.delete('/api/admin/fabric-categories/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.fabricCategories) {
      return res.status(404).json({ success: false, error: 'No categories found' });
    }

    const index = db.fabricCategories.findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    db.fabricCategories.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload fabric image to category
app.post('/api/admin/fabric-categories/:id/upload', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const db = loadDatabase();
    const category = db.fabricCategories?.find(c => c.id === req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    // Move file to category folder
    const destFolder = path.join(__dirname, '../frontend/public/images/RollerBlinds_Zstar_Fabric_Samples', category.folder);
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    const destPath = path.join(destFolder, req.file.filename);
    fs.renameSync(req.file.path, destPath);

    const imageUrl = `/images/RollerBlinds_Zstar_Fabric_Samples/${category.folder}/${req.file.filename}`;
    res.json({ success: true, url: imageUrl, filename: req.file.filename });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete fabric image
app.delete('/api/admin/fabric-categories/:categoryId/image/:filename', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const category = db.fabricCategories?.find(c => c.id === req.params.categoryId);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const filePath = path.join(__dirname, '../frontend/public/images/RollerBlinds_Zstar_Fabric_Samples', category.folder, req.params.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Fabric image deleted' });
    } else {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PUBLIC THEME API (for frontend to load settings)
// ============================================================================

app.get('/api/theme', (req, res) => {
  try {
    const db = loadDatabase();

    // Default theme colors
    const defaultColors = {
      primary: '#8E6545',
      primaryDark: '#7A5539',
      secondary: '#F6F1EB',
      accent: '#D4A574',
      textDark: '#333333',
      textLight: '#666666',
      textMuted: '#999999',
      bgCream: '#F8F6F3',
      bgLight: '#FAFAFA',
      bgWhite: '#FFFFFF',
      borderLight: '#E8E8E8',
      borderMedium: '#D4D4D4',
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107'
    };

    // Default fonts
    const defaultFonts = {
      primary: { family: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap' },
      secondary: { family: 'Open Sans', url: '' },
      sizes: { xs: '11px', sm: '13px', base: '14px', md: '16px', lg: '18px', xl: '22px' }
    };

    res.json({
      success: true,
      data: {
        colors: { ...defaultColors, ...(db.themeSettings?.colors || {}) },
        fonts: { ...defaultFonts, ...(db.themeSettings?.fonts || {}) },
        images: db.siteImages || {},
        header: db.pageSections?.product?.header || { logoText: 'PEEKABOO SHADES', navItems: [] },
        topBar: db.pageSections?.product?.topBar || { phone: '1-800-PEEKABOO', email: 'info@peekabooshades.com' },
        footer: db.pageSections?.product?.footer || { copyright: '© 2024 Peekaboo Shades. All rights reserved.' }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get comprehensive product page content (public)
app.get('/api/product-page-content/:slug', (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    // Get product data
    const product = db.products.find(p => p.slug === slug);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Get theme settings
    const defaultColors = {
      primary: '#8E6545',
      primaryDark: '#7A5539',
      secondary: '#F6F1EB',
      textDark: '#333333',
      textLight: '#666666',
      textMuted: '#999999',
      bgCream: '#F8F6F3',
      borderLight: '#E8E8E8'
    };

    const defaultFonts = {
      primary: { family: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap' },
      sizes: { base: '14px' }
    };

    // Get product-specific content
    const productContent = db.productPageContent?.[slug] || {};

    res.json({
      success: true,
      data: {
        product,
        theme: {
          colors: { ...defaultColors, ...(db.themeSettings?.colors || {}) },
          fonts: { ...defaultFonts, ...(db.themeSettings?.fonts || {}) }
        },
        content: {
          header: db.pageSections?.product?.header || { logoText: 'PEEKABOO SHADES' },
          topBar: db.pageSections?.product?.topBar || { phone: '1-800-PEEKABOO', email: 'info@peekabooshades.com' },
          footer: db.pageSections?.product?.footer || { copyright: '© 2024 Peekaboo Shades. All rights reserved.' },
          gallery: productContent.gallery || product.gallery_images || [],
          features: productContent.features || [],
          trustBadges: productContent.trustBadges || [
            { icon: 'fa-award', title: 'Industry-leading warranty' },
            { icon: 'fa-truck', title: 'Free Shipping' },
            { icon: 'fa-undo', title: 'Easy Returns' }
          ],
          sections: db.pageSections?.product || {}
        },
        images: db.siteImages || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update product page content
app.put('/api/admin/product-page-content/:slug', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    if (!db.productPageContent) db.productPageContent = {};

    db.productPageContent[slug] = {
      ...db.productPageContent[slug],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, message: 'Product page content updated', data: db.productPageContent[slug] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get product page content
app.get('/api/admin/product-page-content/:slug', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;

    const product = db.products.find(p => p.slug === slug);
    const productContent = db.productPageContent?.[slug] || {};

    res.json({
      success: true,
      data: {
        product,
        content: productContent,
        theme: db.themeSettings || {},
        pageSections: db.pageSections?.product || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/page-config/:page', (req, res) => {
  try {
    const db = loadDatabase();
    const pageConfig = db.pageSections?.[req.params.page] || {};
    res.json({ success: true, data: pageConfig });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SECURITY CENTER API ENDPOINTS
// ============================================================================

// Initialize security data structure
function initSecurityData(db) {
  if (!db.security) {
    db.security = {
      adminUsers: [
        { id: 'admin-1', name: 'John Admin', email: 'admin@peekabooshades.com', role: 'admin', status: 'active', twoFactorEnabled: true, lastLogin: '2024-12-30T10:00:00Z', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'admin-2', name: 'Sarah Manager', email: 'sarah@peekabooshades.com', role: 'manager', status: 'active', twoFactorEnabled: true, lastLogin: '2024-12-29T15:30:00Z', createdAt: '2024-06-15T00:00:00Z' }
      ],
      firewall: {
        enabled: true,
        blockedIPs: ['203.0.113.50', '198.51.100.25'],
        allowedIPs: ['192.168.1.0/24', '10.0.0.0/8'],
        blockedCountries: ['RU', 'CN', 'KP'],
        maxLoginAttempts: 5,
        lockoutDuration: 30
      },
      sessions: [],
      auditLogs: [],
      apiKeys: [],
      settings: {
        requireTwoFactor: true,
        sessionTimeout: 240,
        singleSessionOnly: false,
        alertOnNewLogin: true,
        blockSuspiciousLocations: true
      }
    };
    saveDatabase(db);
  }
  return db.security;
}

// Get security overview/stats
app.get('/api/admin/security/overview', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const stats = {
      totalUsers: security.adminUsers.length,
      activeUsers: security.adminUsers.filter(u => u.status === 'active').length,
      twoFactorAdoption: Math.round((security.adminUsers.filter(u => u.twoFactorEnabled).length / security.adminUsers.length) * 100),
      blockedIPs: security.firewall.blockedIPs.length,
      activeSessions: security.sessions.filter(s => s.status === 'active').length,
      recentAlerts: security.auditLogs.filter(l => l.severity === 'warning' || l.severity === 'critical').slice(0, 10).length,
      securityScore: 85
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Admin Users Management
// ============================================================================

// Get all admin users
app.get('/api/admin/security/users', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);
    res.json({ success: true, users: security.adminUsers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create admin user
app.post('/api/admin/security/users', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const newUser = {
      id: `admin-${Date.now()}`,
      name: req.body.name,
      email: req.body.email,
      role: req.body.role || 'viewer',
      status: 'pending',
      twoFactorEnabled: false,
      lastLogin: null,
      createdAt: new Date().toISOString()
    };

    security.adminUsers.push(newUser);

    // Log the action
    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'user_created',
      user: req.body.adminEmail || 'admin',
      target: newUser.email,
      details: { role: newUser.role },
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'info'
    });

    saveDatabase(db);
    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update admin user
app.put('/api/admin/security/users/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const index = security.adminUsers.findIndex(u => u.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    security.adminUsers[index] = { ...security.adminUsers[index], ...req.body };

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'user_updated',
      user: req.body.adminEmail || 'admin',
      target: security.adminUsers[index].email,
      details: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'info'
    });

    saveDatabase(db);
    res.json({ success: true, user: security.adminUsers[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete admin user
app.delete('/api/admin/security/users/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const user = security.adminUsers.find(u => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    security.adminUsers = security.adminUsers.filter(u => u.id !== req.params.id);

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'user_deleted',
      user: 'admin',
      target: user.email,
      details: { userId: req.params.id },
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Firewall / IP Management
// ============================================================================

// Get firewall settings
app.get('/api/admin/security/firewall', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);
    res.json({ success: true, firewall: security.firewall });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update firewall settings
app.put('/api/admin/security/firewall', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    security.firewall = { ...security.firewall, ...req.body };

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'firewall_updated',
      user: 'admin',
      target: 'firewall',
      details: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true, firewall: security.firewall });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Block an IP
app.post('/api/admin/security/firewall/block', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const { ip, reason } = req.body;

    if (!security.firewall.blockedIPs.includes(ip)) {
      security.firewall.blockedIPs.push(ip);

      security.auditLogs.unshift({
        id: `log-${Date.now()}`,
        event: 'ip_blocked',
        user: 'admin',
        target: ip,
        details: { reason },
        ip: req.ip,
        timestamp: new Date().toISOString(),
        severity: 'warning'
      });

      saveDatabase(db);
    }

    res.json({ success: true, blockedIPs: security.firewall.blockedIPs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unblock an IP
app.post('/api/admin/security/firewall/unblock', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const { ip } = req.body;

    security.firewall.blockedIPs = security.firewall.blockedIPs.filter(blocked => blocked !== ip);

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'ip_unblocked',
      user: 'admin',
      target: ip,
      details: {},
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'info'
    });

    saveDatabase(db);
    res.json({ success: true, blockedIPs: security.firewall.blockedIPs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Session Management
// ============================================================================

// Get all sessions
app.get('/api/admin/security/sessions', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);
    res.json({ success: true, sessions: security.sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// End a specific session
app.delete('/api/admin/security/sessions/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const session = security.sessions.find(s => s.id === req.params.id);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date().toISOString();

      security.auditLogs.unshift({
        id: `log-${Date.now()}`,
        event: 'session_ended',
        user: 'admin',
        target: session.userId,
        details: { sessionId: req.params.id },
        ip: req.ip,
        timestamp: new Date().toISOString(),
        severity: 'info'
      });

      saveDatabase(db);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// End all sessions except current
app.post('/api/admin/security/sessions/end-all', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const { currentSessionId } = req.body;

    security.sessions.forEach(session => {
      if (session.id !== currentSessionId && session.status === 'active') {
        session.status = 'ended';
        session.endedAt = new Date().toISOString();
      }
    });

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'all_sessions_ended',
      user: 'admin',
      target: 'all',
      details: { exceptSession: currentSessionId },
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Audit Logs
// ============================================================================

// Get audit logs
app.get('/api/admin/security/audit-logs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    let logs = [...security.auditLogs];

    // Filter by severity
    if (req.query.severity) {
      logs = logs.filter(l => l.severity === req.query.severity);
    }

    // Filter by event type
    if (req.query.event) {
      logs = logs.filter(l => l.event === req.query.event);
    }

    // Filter by user
    if (req.query.user) {
      logs = logs.filter(l => l.user === req.query.user);
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const start = (page - 1) * limit;
    const paginatedLogs = logs.slice(start, start + limit);

    res.json({
      success: true,
      logs: paginatedLogs,
      total: logs.length,
      page,
      pages: Math.ceil(logs.length / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add audit log (internal use)
app.post('/api/admin/security/audit-logs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const newLog = {
      id: `log-${Date.now()}`,
      event: req.body.event,
      user: req.body.user,
      target: req.body.target,
      details: req.body.details || {},
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: req.body.severity || 'info'
    };

    security.auditLogs.unshift(newLog);

    // Keep only last 10000 logs
    if (security.auditLogs.length > 10000) {
      security.auditLogs = security.auditLogs.slice(0, 10000);
    }

    saveDatabase(db);
    res.json({ success: true, log: newLog });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// API Keys Management
// ============================================================================

// Get API keys
app.get('/api/admin/security/api-keys', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    // Return keys with masked secrets
    const maskedKeys = security.apiKeys.map(key => ({
      ...key,
      key: key.key.substring(0, 8) + '...' + key.key.substring(key.key.length - 4)
    }));

    res.json({ success: true, apiKeys: maskedKeys });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create API key
app.post('/api/admin/security/api-keys', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const crypto = require('crypto');
    const apiKey = 'pk_' + crypto.randomBytes(32).toString('hex');

    const newKey = {
      id: `key-${Date.now()}`,
      name: req.body.name,
      key: apiKey,
      permissions: req.body.permissions || ['read'],
      rateLimit: req.body.rateLimit || 100,
      status: 'active',
      lastUsed: null,
      createdAt: new Date().toISOString()
    };

    security.apiKeys.push(newKey);

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'api_key_created',
      user: 'admin',
      target: newKey.name,
      details: { keyId: newKey.id },
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'info'
    });

    saveDatabase(db);

    // Return full key only on creation
    res.json({ success: true, apiKey: newKey });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Revoke API key
app.delete('/api/admin/security/api-keys/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const key = security.apiKeys.find(k => k.id === req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    key.status = 'revoked';
    key.revokedAt = new Date().toISOString();

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'api_key_revoked',
      user: 'admin',
      target: key.name,
      details: { keyId: req.params.id },
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Security Settings
// ============================================================================

// Get security settings
app.get('/api/admin/security/settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);
    res.json({ success: true, settings: security.settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update security settings
app.put('/api/admin/security/settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    security.settings = { ...security.settings, ...req.body };

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'security_settings_updated',
      user: 'admin',
      target: 'security_settings',
      details: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true, settings: security.settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Two-Factor Authentication
// ============================================================================

// Enable 2FA for user
app.post('/api/admin/security/2fa/enable', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const { userId } = req.body;
    const user = security.adminUsers.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Generate mock secret (in production, use speakeasy or similar)
    const secret = 'MOCK2FASECRET' + Math.random().toString(36).substring(7).toUpperCase();

    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: '2fa_enabled',
      user: user.email,
      target: user.email,
      details: {},
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'info'
    });

    saveDatabase(db);
    res.json({ success: true, secret, qrCodeUrl: `otpauth://totp/PeekabooShades:${user.email}?secret=${secret}&issuer=PeekabooShades` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disable 2FA for user
app.post('/api/admin/security/2fa/disable', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    const { userId } = req.body;
    const user = security.adminUsers.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.twoFactorEnabled = false;
    delete user.twoFactorSecret;

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: '2fa_disabled',
      user: user.email,
      target: user.email,
      details: {},
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Page Permissions
// ============================================================================

// Get page permissions
app.get('/api/admin/security/permissions', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.pagePermissions) {
      db.pagePermissions = {
        adminPages: [
          { page: 'dashboard', path: '/admin/index.html', roles: ['admin', 'manager', 'editor', 'viewer'] },
          { page: 'orders', path: '/admin/orders.html', roles: ['admin', 'manager', 'viewer'] },
          { page: 'products', path: '/admin/products.html', roles: ['admin', 'manager', 'editor'] },
          { page: 'customers', path: '/admin/customers.html', roles: ['admin', 'manager'] },
          { page: 'analytics', path: '/admin/analytics.html', roles: ['admin', 'manager', 'viewer'] },
          { page: 'marketing', path: '/admin/marketing/', roles: ['admin', 'manager', 'editor'] },
          { page: 'settings', path: '/admin/settings.html', roles: ['admin'] },
          { page: 'security', path: '/admin/security/', roles: ['admin'] },
          { page: 'page-builder', path: '/admin/page-builder.html', roles: ['admin', 'manager', 'editor'] },
          { page: 'blog', path: '/admin/blog/', roles: ['admin', 'manager', 'editor'] }
        ],
        storefrontPages: [
          { page: 'home', path: '/index.html', visibility: 'public' },
          { page: 'product', path: '/product.html', visibility: 'public' },
          { page: 'cart', path: '/cart.html', visibility: 'public' },
          { page: 'checkout', path: '/checkout.html', visibility: 'public' }
        ]
      };
      saveDatabase(db);
    }
    res.json({ success: true, permissions: db.pagePermissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update page permissions
app.put('/api/admin/security/permissions/:page', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const security = initSecurityData(db);

    if (!db.pagePermissions) {
      return res.status(400).json({ success: false, error: 'Permissions not initialized' });
    }

    const pageIndex = db.pagePermissions.adminPages.findIndex(p => p.page === req.params.page);
    if (pageIndex !== -1) {
      db.pagePermissions.adminPages[pageIndex] = { ...db.pagePermissions.adminPages[pageIndex], ...req.body };
    }

    security.auditLogs.unshift({
      id: `log-${Date.now()}`,
      event: 'permissions_updated',
      user: 'admin',
      target: req.params.page,
      details: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      severity: 'warning'
    });

    saveDatabase(db);
    res.json({ success: true, permissions: db.pagePermissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PUBLIC API ENDPOINTS (Option 1 - API Key Authentication)
// ============================================================================

// Initialize API data
function initApiData(db) {
  if (!db.apiConfig) {
    db.apiConfig = {
      keys: [
        {
          id: 'key-demo-1',
          name: 'Demo API Key',
          key: 'pk_demo_12345678901234567890',
          permissions: ['read', 'write'],
          rateLimit: 100,
          status: 'active',
          allowedOrigins: ['*'],
          lastUsed: null,
          requestCount: 0,
          createdAt: new Date().toISOString()
        }
      ],
      webhooks: [
        {
          id: 'webhook-demo-1',
          name: 'Demo Webhook',
          url: 'https://webhook.site/test',
          events: ['order.created', 'order.updated', 'product.updated'],
          status: 'active',
          secret: 'whsec_demo_secret_key',
          lastTriggered: null,
          failureCount: 0,
          createdAt: new Date().toISOString()
        }
      ],
      logs: []
    };
    saveDatabase(db);
  }
  return db.apiConfig;
}

// API Key authentication middleware
function apiKeyAuth(req, res, next) {
  const db = loadDatabase();
  const apiConfig = initApiData(db);

  // Get API key from header or query
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      message: 'Provide API key via X-API-Key header, Authorization Bearer, or api_key query parameter'
    });
  }

  // Find matching key
  const keyRecord = apiConfig.keys.find(k => k.key === apiKey && k.status === 'active');

  if (!keyRecord) {
    // Log failed attempt
    apiConfig.logs.unshift({
      id: `log-${Date.now()}`,
      type: 'auth_failure',
      apiKey: apiKey.substring(0, 8) + '...',
      endpoint: req.originalUrl,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    saveDatabase(db);

    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is invalid or inactive'
    });
  }

  // Check CORS/origin if configured
  const origin = req.headers.origin || req.headers.referer;
  if (keyRecord.allowedOrigins && !keyRecord.allowedOrigins.includes('*')) {
    if (origin && !keyRecord.allowedOrigins.some(o => origin.includes(o))) {
      return res.status(403).json({
        success: false,
        error: 'Origin not allowed',
        message: 'This API key is not authorized for this origin'
      });
    }
  }

  // Update usage stats
  keyRecord.lastUsed = new Date().toISOString();
  keyRecord.requestCount = (keyRecord.requestCount || 0) + 1;

  // Log successful request
  apiConfig.logs.unshift({
    id: `log-${Date.now()}`,
    type: 'api_request',
    apiKeyId: keyRecord.id,
    apiKeyName: keyRecord.name,
    endpoint: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Keep only last 1000 logs
  if (apiConfig.logs.length > 1000) {
    apiConfig.logs = apiConfig.logs.slice(0, 1000);
  }

  saveDatabase(db);

  // Attach key info to request
  req.apiKey = keyRecord;
  next();
}

// ============================================================================
// PUBLIC API ROUTES
// ============================================================================

// API Health Check (no auth required)
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get API info (no auth required)
app.get('/api/v1/info', (req, res) => {
  res.json({
    success: true,
    api: {
      name: 'Peekaboo Shades Public API',
      version: '1.0.0',
      documentation: '/admin/api-docs.html',
      endpoints: {
        products: '/api/v1/products',
        categories: '/api/v1/categories',
        orders: '/api/v1/orders',
        inventory: '/api/v1/inventory'
      },
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        alternative: 'Authorization: Bearer <api_key>'
      }
    }
  });
});

// PUBLIC: Get Products
app.get('/api/v1/products', apiKeyAuth, (req, res) => {
  try {
    const db = loadDatabase();
    let products = db.products || [];

    // Filtering
    if (req.query.category) {
      products = products.filter(p => p.category === req.query.category);
    }
    if (req.query.status) {
      products = products.filter(p => p.status === req.query.status);
    }
    if (req.query.minPrice) {
      products = products.filter(p => p.price >= parseFloat(req.query.minPrice));
    }
    if (req.query.maxPrice) {
      products = products.filter(p => p.price <= parseFloat(req.query.maxPrice));
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const start = (page - 1) * limit;
    const paginatedProducts = products.slice(start, start + limit);

    res.json({
      success: true,
      data: paginatedProducts,
      pagination: {
        page,
        limit,
        total: products.length,
        pages: Math.ceil(products.length / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get Single Product
app.get('/api/v1/products/:id', apiKeyAuth, (req, res) => {
  try {
    const db = loadDatabase();
    const product = (db.products || []).find(p => p.id === req.params.id || p.slug === req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get Categories
app.get('/api/v1/categories', apiKeyAuth, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({
      success: true,
      data: db.categories || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Check Inventory
app.get('/api/v1/inventory', apiKeyAuth, (req, res) => {
  try {
    const db = loadDatabase();
    const products = db.products || [];

    const inventory = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku || `SKU-${p.id}`,
      stock: p.stock || Math.floor(Math.random() * 100),
      status: p.stock > 10 ? 'in_stock' : p.stock > 0 ? 'low_stock' : 'out_of_stock'
    }));

    res.json({
      success: true,
      data: inventory,
      summary: {
        totalProducts: inventory.length,
        inStock: inventory.filter(i => i.status === 'in_stock').length,
        lowStock: inventory.filter(i => i.status === 'low_stock').length,
        outOfStock: inventory.filter(i => i.status === 'out_of_stock').length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Create Order (from external site)
app.post('/api/v1/orders', apiKeyAuth, (req, res) => {
  try {
    // Check write permission
    if (!req.apiKey.permissions.includes('write')) {
      return res.status(403).json({
        success: false,
        error: 'Write permission required',
        message: 'This API key does not have write permissions'
      });
    }

    const db = loadDatabase();

    const newOrder = {
      id: `ORD-${Date.now()}`,
      orderNumber: `PS-${Math.floor(100000 + Math.random() * 900000)}`,
      source: 'api',
      apiKeyId: req.apiKey.id,
      customer: req.body.customer || {},
      items: req.body.items || [],
      shippingAddress: req.body.shippingAddress || {},
      billingAddress: req.body.billingAddress || {},
      subtotal: req.body.subtotal || 0,
      shipping: req.body.shipping || 0,
      tax: req.body.tax || 0,
      total: req.body.total || 0,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!db.orders) db.orders = [];
    db.orders.unshift(newOrder);
    saveDatabase(db);

    // Trigger webhook
    triggerWebhook('order.created', newOrder);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get Order Status
app.get('/api/v1/orders/:id', apiKeyAuth, (req, res) => {
  try {
    const db = loadDatabase();
    const order = (db.orders || []).find(o => o.id === req.params.id || o.orderNumber === req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Validate Promo Code
app.post('/api/v1/promo/validate', apiKeyAuth, (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const db = loadDatabase();

    // Demo promo codes
    const promoCodes = db.promotions || [
      { code: 'SAVE10', type: 'percentage', value: 10, minPurchase: 50, active: true },
      { code: 'FLAT20', type: 'fixed', value: 20, minPurchase: 100, active: true },
      { code: 'FREESHIP', type: 'shipping', value: 0, minPurchase: 75, active: true }
    ];

    const promo = promoCodes.find(p => p.code === code?.toUpperCase() && p.active);

    if (!promo) {
      return res.json({ success: false, valid: false, error: 'Invalid promo code' });
    }

    if (cartTotal < promo.minPurchase) {
      return res.json({
        success: false,
        valid: false,
        error: `Minimum purchase of $${promo.minPurchase} required`
      });
    }

    let discount = 0;
    if (promo.type === 'percentage') {
      discount = (cartTotal * promo.value) / 100;
    } else if (promo.type === 'fixed') {
      discount = promo.value;
    }

    res.json({
      success: true,
      valid: true,
      promo: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        discount: discount.toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// WEBHOOK SYSTEM (Option 2)
// ============================================================================

// Trigger webhook function
async function triggerWebhook(event, data) {
  const db = loadDatabase();
  const apiConfig = initApiData(db);

  const webhooks = apiConfig.webhooks.filter(w =>
    w.status === 'active' && w.events.includes(event)
  );

  for (const webhook of webhooks) {
    try {
      const payload = {
        id: `evt_${Date.now()}`,
        event: event,
        timestamp: new Date().toISOString(),
        data: data
      };

      // Create signature
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      // Send webhook (async, don't wait)
      fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event
        },
        body: JSON.stringify(payload)
      }).then(response => {
        webhook.lastTriggered = new Date().toISOString();
        if (!response.ok) {
          webhook.failureCount = (webhook.failureCount || 0) + 1;
        } else {
          webhook.failureCount = 0;
        }
        saveDatabase(db);
      }).catch(err => {
        webhook.failureCount = (webhook.failureCount || 0) + 1;
        saveDatabase(db);
        console.error(`Webhook ${webhook.name} failed:`, err.message);
      });

      // Log webhook trigger
      apiConfig.logs.unshift({
        id: `log-${Date.now()}`,
        type: 'webhook_triggered',
        webhookId: webhook.id,
        webhookName: webhook.name,
        event: event,
        url: webhook.url,
        timestamp: new Date().toISOString()
      });
      saveDatabase(db);

    } catch (error) {
      console.error(`Webhook ${webhook.name} error:`, error.message);
    }
  }
}

// ============================================================================
// WEBHOOK MANAGEMENT API
// ============================================================================

// Get all webhooks
app.get('/api/admin/webhooks', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);
    res.json({ success: true, webhooks: apiConfig.webhooks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create webhook
app.post('/api/admin/webhooks', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);
    const crypto = require('crypto');

    const newWebhook = {
      id: `webhook-${Date.now()}`,
      name: req.body.name,
      url: req.body.url,
      events: req.body.events || ['order.created'],
      status: 'active',
      secret: 'whsec_' + crypto.randomBytes(24).toString('hex'),
      lastTriggered: null,
      failureCount: 0,
      createdAt: new Date().toISOString()
    };

    apiConfig.webhooks.push(newWebhook);
    saveDatabase(db);

    res.json({ success: true, webhook: newWebhook });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update webhook
app.put('/api/admin/webhooks/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);

    const index = apiConfig.webhooks.findIndex(w => w.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    apiConfig.webhooks[index] = { ...apiConfig.webhooks[index], ...req.body };
    saveDatabase(db);

    res.json({ success: true, webhook: apiConfig.webhooks[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete webhook
app.delete('/api/admin/webhooks/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);

    apiConfig.webhooks = apiConfig.webhooks.filter(w => w.id !== req.params.id);
    saveDatabase(db);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test webhook
app.post('/api/admin/webhooks/:id/test', authMiddleware, async (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);

    const webhook = apiConfig.webhooks.find(w => w.id === req.params.id);
    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const testPayload = {
      id: `evt_test_${Date.now()}`,
      event: 'test.webhook',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Peekaboo Shades',
        webhookId: webhook.id
      }
    };

    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test.webhook'
        },
        body: JSON.stringify(testPayload)
      });

      webhook.lastTriggered = new Date().toISOString();
      saveDatabase(db);

      res.json({
        success: true,
        message: 'Test webhook sent',
        response: {
          status: response.status,
          statusText: response.statusText
        }
      });
    } catch (fetchError) {
      res.json({
        success: false,
        error: 'Failed to send webhook',
        details: fetchError.message
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get API logs
app.get('/api/admin/api-logs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);

    let logs = apiConfig.logs || [];

    // Filter by type
    if (req.query.type) {
      logs = logs.filter(l => l.type === req.query.type);
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const start = (page - 1) * limit;

    res.json({
      success: true,
      logs: logs.slice(start, start + limit),
      total: logs.length,
      page,
      pages: Math.ceil(logs.length / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get/Create Public API Keys
app.get('/api/admin/public-api-keys', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);

    // Mask keys for display
    const maskedKeys = apiConfig.keys.map(k => ({
      ...k,
      key: k.key.substring(0, 10) + '...' + k.key.substring(k.key.length - 4)
    }));

    res.json({ success: true, apiKeys: maskedKeys });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/public-api-keys', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);
    const crypto = require('crypto');

    const newKey = {
      id: `key-${Date.now()}`,
      name: req.body.name || 'New API Key',
      key: 'pk_' + crypto.randomBytes(24).toString('hex'),
      permissions: req.body.permissions || ['read'],
      rateLimit: req.body.rateLimit || 100,
      status: 'active',
      allowedOrigins: req.body.allowedOrigins || ['*'],
      lastUsed: null,
      requestCount: 0,
      createdAt: new Date().toISOString()
    };

    apiConfig.keys.push(newKey);
    saveDatabase(db);

    // Return full key only on creation
    res.json({ success: true, apiKey: newKey });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/public-api-keys/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const apiConfig = initApiData(db);

    const key = apiConfig.keys.find(k => k.id === req.params.id);
    if (key) {
      key.status = 'revoked';
    }

    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ADMIN SYSTEM CONFIGURATION API (Admin-Driven Architecture)
// ============================================================================

/**
 * Get complete system configuration
 */
app.get('/api/admin/system-config', authMiddleware, (req, res) => {
  try {
    const config = systemConfig.loadConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update pricing configuration
 */
app.put('/api/admin/system-config/pricing', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const previousConfig = db.systemConfig?.pricing;

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.pricing = { ...db.systemConfig.pricing, ...req.body };

    saveDatabase(db);
    systemConfig.invalidateCache();

    // Audit log
    auditLogger.logConfigChange('pricing', previousConfig, db.systemConfig.pricing, req.admin, req);

    res.json({ success: true, message: 'Pricing configuration updated', data: db.systemConfig.pricing });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update tax configuration
 */
app.put('/api/admin/system-config/tax', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const previousConfig = db.systemConfig?.tax;

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.tax = { ...db.systemConfig.tax, ...req.body };

    saveDatabase(db);
    systemConfig.invalidateCache();

    auditLogger.logConfigChange('tax', previousConfig, db.systemConfig.tax, req.admin, req);

    res.json({ success: true, message: 'Tax configuration updated', data: db.systemConfig.tax });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update shipping configuration
 */
app.put('/api/admin/system-config/shipping', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const previousConfig = db.systemConfig?.shipping;

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.shipping = { ...db.systemConfig.shipping, ...req.body };

    saveDatabase(db);
    systemConfig.invalidateCache();

    auditLogger.logConfigChange('shipping', previousConfig, db.systemConfig.shipping, req.admin, req);

    res.json({ success: true, message: 'Shipping configuration updated', data: db.systemConfig.shipping });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update business rules
 */
app.put('/api/admin/system-config/business-rules', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const previousConfig = db.systemConfig?.businessRules;

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.businessRules = { ...db.systemConfig.businessRules, ...req.body };

    saveDatabase(db);
    systemConfig.invalidateCache();

    auditLogger.logConfigChange('businessRules', previousConfig, db.systemConfig.businessRules, req.admin, req);

    res.json({ success: true, message: 'Business rules updated', data: db.systemConfig.businessRules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get audit logs
 */
app.get('/api/admin/audit-logs', authMiddleware, (req, res) => {
  try {
    const { action, actionPrefix, userId, resourceType, resourceId, startDate, endDate, severity, limit, offset } = req.query;

    const logs = auditLogger.query({
      action,
      actionPrefix,
      userId,
      resourceType,
      resourceId,
      startDate,
      endDate,
      severity,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    });

    res.json({ success: true, data: logs, total: logs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get resource history
 */
app.get('/api/admin/audit-logs/resource/:type/:id', authMiddleware, (req, res) => {
  try {
    const { type, id } = req.params;
    const logs = auditLogger.getResourceHistory(type, id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);

// Initialize real-time sync WebSocket server
realtimeSync.initialize(server);

// API endpoint for WebSocket stats
app.get('/api/admin/realtime/stats', authMiddleware, (req, res) => {
  try {
    const stats = realtimeSync.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SEO ENDPOINTS - Sitemap & Robots.txt
// ============================================
const seoService = require('./services/seo-service');

// Sitemap.xml endpoint
app.get('/sitemap.xml', (req, res) => {
  try {
    const db = loadDatabase();
    const products = db.products || [];
    const categories = db.categories || [];
    const urls = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/shop', priority: '0.9', changefreq: 'daily' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
      { url: '/contact', priority: '0.6', changefreq: 'monthly' },
      { url: '/faq', priority: '0.7', changefreq: 'weekly' }
    ];
    categories.forEach(cat => urls.push({ url: `/category/${cat.slug}`, priority: '0.8', changefreq: 'weekly' }));
    products.filter(p => p.status === 'active').forEach(prod => urls.push({ url: `/product/${prod.slug}`, priority: '0.8', changefreq: 'weekly' }));
    ['/roller-shades', '/zebra-shades', '/blackout-roller-shades', '/motorized-roller-shades', '/cordless-shades'].forEach(p => urls.push({ url: p, priority: '0.9', changefreq: 'weekly' }));
    ['/texas', '/dallas-custom-blinds', '/austin-window-shades', '/houston-custom-shades', '/san-antonio-window-blinds', '/fort-worth-custom-blinds'].forEach(p => urls.push({ url: p, priority: '0.8', changefreq: 'monthly' }));
    res.set('Content-Type', 'application/xml');
    res.send(seoService.generateSitemapXML(urls));
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt endpoint
app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(seoService.generateRobotsTxt());
});

// SEO metadata API
app.get('/api/seo/page-meta', (req, res) => {
  try {
    const { page, slug, city } = req.query;
    const db = loadDatabase();
    let seoData = {};
    if (page === 'product' && slug) {
      const product = (db.products || []).find(p => p.slug === slug);
      if (product) {
        seoData = { title: `${product.name} - Custom Window Shades | Peekaboo Shades`, description: product.description?.substring(0, 155) || `Shop ${product.name}. Free shipping in Texas.`, canonical: `${seoService.BASE_URL}/product/${slug}` };
      }
    } else if (page === 'local' && city) {
      const cityNames = { dallas: 'Dallas', austin: 'Austin', houston: 'Houston', 'san-antonio': 'San Antonio', 'fort-worth': 'Fort Worth' };
      const cityName = cityNames[city] || city;
      seoData = { title: `Custom Blinds & Shades in ${cityName}, TX | Peekaboo Shades`, description: `Affordable custom window blinds and shades serving ${cityName}, Texas. Free shipping!`, includeLocalBusiness: true, city: cityName };
    }
    res.json({ success: true, data: seoData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🏠 PEEKABOO SHADES - E-commerce Platform              ║
║                                                            ║
║     Server running on: http://localhost:${PORT}              ║
║     WebSocket:         ws://localhost:${PORT}/ws             ║
║                                                            ║
║     Pages:                                                 ║
║     • Home:     http://localhost:${PORT}/                    ║
║     • Shop:     http://localhost:${PORT}/shop                ║
║     • Product:  http://localhost:${PORT}/product/[slug]      ║
║     • Cart:     http://localhost:${PORT}/cart                ║
║     • Admin:    http://localhost:${PORT}/admin               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
