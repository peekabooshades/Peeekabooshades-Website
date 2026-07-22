require('dotenv').config();
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (e) {
  console.log('Sentry module not installed - error monitoring disabled');
}
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { authMiddleware, generateToken, verifyToken, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const Anthropic = require('@anthropic-ai/sdk');

// ============================================
// SENTRY ERROR MONITORING
// ============================================
if (Sentry && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration()
    ]
  });
  console.log('Sentry error monitoring initialized');
} else {
  console.log('Sentry DSN not configured - error monitoring disabled');
}

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
const dbIndex = require('./services/database-index');
const { emailService } = require('./services/email-service');
const { notificationService } = require('./services/notification-service');
const { smsService } = require('./services/sms-service');
const { shippingService } = require('./services/shipping-service');
const { savedQuotesService } = require('./services/saved-quotes-service');
const excelPricingService = require('./services/excel-pricing-service');
const manufacturerAssignmentService = require('./services/manufacturer-assignment-service');
const { taxService } = require('./services/tax-service');
const { poService } = require('./services/po-service');
const { cartRecoveryService } = require('./services/cart-recovery-service');
const { accountingExportService } = require('./services/accounting-export-service');
const { scheduledReportsService, REPORT_TYPES, FREQUENCIES } = require('./services/scheduled-reports-service');

// ============================================
// CRM/OMS/FINANCE/ANALYTICS ROUTES
// ============================================
const crmRoutes = require('./routes/crm-routes');
const paymentRoutes = require('./routes/payment-routes');

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
const CACHE_TTL = 30000; // 30 seconds cache TTL for reads

// Initialize database
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      categories: [
        { id: uuidv4(), name: 'Roller Shades', slug: 'roller-shades', description: 'Affordable custom roller blinds & shades' },
        { id: uuidv4(), name: 'Zebra Shades', slug: 'zebra-shades', description: 'Dual-layer zebra blinds for light control' },
        { id: uuidv4(), name: 'Roman Shades', slug: 'roman-shades', description: 'Energy efficient roman shades' },
        { id: uuidv4(), name: 'Honeycomb/Cellular Shades', slug: 'honeycomb-shades', description: 'Honeycomb cellular shades' }
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
        category_id: categories[2].id,
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

// Normalize a product slug from an untrusted source (frontend derives it from
// the URL tail, so it can carry a query string, hash, or trailing slash).
// Fixes BUG-B003: a `?utm=...` or trailing `/` must not break price lookup.
function normalizeSlug(slug) {
  if (typeof slug !== 'string') return slug;
  return slug.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();
}

// Save database and invalidate cache
function saveDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  dbCache = data;
  dbCacheTime = Date.now();
}

// BUG-F005: server.js keeps this inline read cache while the service layer
// (manufacturer-service, ledger-service, …) writes through services/db-loader's
// SEPARATE cache. After a service-layer write to an order, call this so the next
// server-side read (e.g. GET /api/orders/lookup) re-reads fresh disk instead of
// serving a stale, pre-write copy for up to CACHE_TTL.
function invalidateServerDbCache() {
  dbCache = null;
  dbCacheTime = 0;
}

// Middleware
app.use(compression({ level: 6 })); // Enable gzip compression
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// API RESPONSE CACHE (for GET endpoints)
// ============================================
const apiCache = new Map();
const API_CACHE_TTL = 10000; // 10 seconds for API responses

function apiCacheMiddleware(req, res, next) {
  if (req.method !== 'GET') {
    // Invalidate cache on writes
    apiCache.clear();
    return next();
  }

  // SECURITY (BUG-D002): never cache authenticated or admin responses. The cache
  // key is the URL only, so a cached response would otherwise be replayed to any
  // caller regardless of token — leaking admin/customer data (incl. password
  // hashes) to unauthenticated requests and bypassing authMiddleware entirely.
  // Only anonymous, non-admin GETs (public catalog/fabric data) are cacheable.
  if (req.headers.authorization || req.originalUrl.startsWith('/api/admin')) {
    return next();
  }

  const key = req.originalUrl;
  const cached = apiCache.get(key);

  if (cached && (Date.now() - cached.time) < API_CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Content-Type', 'application/json');
    return res.send(cached.body);
  }

  // Capture the response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const body = JSON.stringify(data);
      apiCache.set(key, { body, time: Date.now() });
      // Cap cache size at 200 entries
      if (apiCache.size > 200) {
        const firstKey = apiCache.keys().next().value;
        apiCache.delete(firstKey);
      }
    }
    res.setHeader('X-Cache', 'MISS');
    return originalJson(data);
  };

  next();
}

app.use('/api', apiCacheMiddleware);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ============================================
// TICKET-013: API Response Time Monitoring
// ============================================
const SLOW_THRESHOLD_MS = 500;
app.use((req, res, next) => {
  // Only monitor API endpoints
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const logLevel = duration > SLOW_THRESHOLD_MS ? 'SLOW' : 'OK';

    // Log format: [TIMESTAMP] [LEVEL] METHOD /path - STATUS - DURATIONms
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${logLevel}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`;

    if (duration > SLOW_THRESHOLD_MS) {
      console.warn('\x1b[33m%s\x1b[0m', logMessage); // Yellow for slow
    } else if (res.statusCode >= 400) {
      console.error('\x1b[31m%s\x1b[0m', logMessage); // Red for errors
    }
    // Only log non-GET requests or slow requests to reduce noise
    else if (req.method !== 'GET' || duration > 100) {
      console.log(logMessage);
    }

    // Add response time header
    res.setHeader('X-Response-Time', `${duration}ms`);

    return originalEnd.apply(this, args);
  };

  next();
});

// Route redirects for clean URLs
app.get('/samples', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/samples.html'));
});

app.get('/trade', (req, res) => {
  res.redirect('/dealer/');
});

app.get('/help', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/faqs.html'));
});

app.get('/faq.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/faqs.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/faqs.html'));
});

// Static files with optimized cache headers
app.use(express.static(path.join(__dirname, '../frontend/public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // HTML files - allow ETag-based caching (304 responses)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache'); // Revalidate with ETag
    }
    // Images - long cache
    else if (/\.(jpg|jpeg|png|svg|webp|gif|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
    }
    // CSS/JS - moderate cache
    else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    }
    // Fonts
    else if (/\.(woff|woff2|ttf|eot)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
    }
  }
}));

// Initialize database on startup
initDatabase();

// ============================================
// MOUNT CRM/OMS/FINANCE/ANALYTICS ROUTES
// ============================================
// BUG-H001 (stage-15): the full CRM/OMS/finance router was mounted whole at the
// public prefixes /api/v1 and /api/public, exposing invoices, finance P&L,
// manufacturer prices, price rules and order-status writes with NO auth
// (customer PII + manufacturer cost + margin leaked, OWASP A01). The /api/v1
// prefix is SHARED between crm-routes and many legitimate standalone public
// routes (health, products, orders, promo, categories) defined later, which
// reach their handlers by falling through the crm router. So this gate is a
// deny-list of the sensitive crm handlers only: those return 401; every other
// path (public crm pricing/track/analytics-event + all standalone /api/v1
// routes) passes through untouched. Sensitive handlers stay reachable only via
// the auth-gated app.use('/api/admin/crm', authMiddleware, crmRoutes) mount.
const BLOCKED_PUBLIC_CRM_PATHS = [
  /^\/init-schema(\/|$)/,
  /^\/manufacturers(\/|$)/,
  /^\/manufacturer-prices(\/|$)/,
  /^\/price-rules(\/|$)/,
  /^\/order-workflow(\/|$)/,
  /^\/carriers(\/|$)/,
  /^\/orders\/[^/]+\/(status|status-history|shipments)(\/|$)/,
  /^\/shipments(\/|$)/,
  /^\/invoices(\/|$)/,
  /^\/finance(\/|$)/,
  /^\/analytics\/(funnel|segments)(\/|$)/,
];
function publicCrmGate(req, res, next) {
  if (BLOCKED_PUBLIC_CRM_PATHS.some((re) => re.test(req.path))) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  return next();
}

// Public CRM surface (no auth) — whitelisted paths only
app.use('/api/v1', publicCrmGate, crmRoutes);

// Admin CRM routes (auth required for most)
app.use('/api/admin/crm', authMiddleware, crmRoutes);

// Public order tracking (no auth, uses token verification)
app.use('/api/public', publicCrmGate, crmRoutes);

// Payment routes (public - handles its own validation)
app.use('/api/payments', paymentRoutes);

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

// ============================================
// MANUFACTURERS API - Public Endpoints
// ============================================

// Get all active manufacturers (for product page dropdown)
app.get('/api/manufacturers', (req, res) => {
  try {
    const db = loadDatabase();
    const { productType } = req.query;

    let manufacturers = db.manufacturers || [];

    // Filter by status
    manufacturers = manufacturers.filter(m => m.status === 'active');

    // Filter by product type if specified
    if (productType) {
      manufacturers = manufacturers.filter(m =>
        m.productTypes && m.productTypes.includes(productType.toLowerCase())
      );
    }

    // Return simplified data for frontend
    const result = manufacturers.map(m => ({
      id: m.id,
      name: m.name,
      code: m.code,
      productTypes: m.productTypes || [],
      pricingLinked: m.pricingLinked || false,
      leadTimeDays: m.leadTimeDays || 14,
      status: m.status
    }));

    res.json({ success: true, manufacturers: result });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get manufacturer by ID
app.get('/api/manufacturers/:id', (req, res) => {
  try {
    const db = loadDatabase();
    const manufacturer = db.manufacturers.find(m => m.id === req.params.id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    res.json({ success: true, manufacturer });
  } catch (error) {
    console.error('Error fetching manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if manufacturer has pricing linked for a product type
app.get('/api/manufacturers/:id/pricing-status', (req, res) => {
  try {
    const db = loadDatabase();
    const { productType } = req.query;
    const manufacturer = db.manufacturers.find(m => m.id === req.params.id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    // Check if manufacturer has pricing linked
    let hasPricing = manufacturer.pricingLinked === true;

    // If product type specified, check if there are actual prices in manufacturerPrices
    if (productType && hasPricing) {
      const prices = db.manufacturerPrices || [];
      hasPricing = prices.some(p =>
        p.manufacturerId === manufacturer.id &&
        p.productType === productType.toLowerCase()
      );
    }

    res.json({
      success: true,
      manufacturerId: manufacturer.id,
      manufacturerName: manufacturer.name,
      productType: productType || 'all',
      pricingLinked: hasPricing,
      message: hasPricing ? 'Pricing available' : 'Coming Soon'
    });
  } catch (error) {
    console.error('Error checking pricing status:', error);
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
      standardCassette: configObj.standardCassette,
      valanceType: configObj.standardCassette, // Alias for valance pricing
      standardBottomBar: configObj.standardBottomBar,
      bottomRail: configObj.standardBottomBar, // Alias for bottom rail pricing
      rollerType: configObj.rollerType,
      // Also keep nested hardware for backward compatibility
      hardware: {
        cassette: configObj.standardCassette,
        bottomBar: configObj.standardBottomBar,
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
    const cartItem = {
      id: uuidv4(),
      session_id: sessionId,
      product_id: productId,
      product_name: product.name,
      quantity: quantity || 1,
      width: priceResult.dimensions.width,
      height: priceResult.dimensions.height,
      room_label: roomLabel || '',
      configuration: typeof configuration === 'string' ? configuration : JSON.stringify(configuration || {}),
      // Variant SKU derived from the configuration (skill: sku-generate)
      sku: priceResult.sku || null,
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

// Public order lookup - MUST be before /:orderNumber route to avoid conflicts
app.get('/api/orders/lookup', (req, res) => {
  try {
    const { orderNumber, email } = req.query;

    if (!orderNumber || !email) {
      return res.status(400).json({
        success: false,
        error: 'Order number and email are required'
      });
    }

    const db = loadDatabase();
    const orders = db.orders || [];

    // Find order by order_number and customer_email (case-insensitive email match)
    const order = orders.find(o =>
      (o.order_number === orderNumber || o.id === orderNumber) &&
      o.customer_email &&
      o.customer_email.toLowerCase() === email.toLowerCase()
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found. Please check your order number and email address.'
      });
    }

    // Return limited order info (don't expose sensitive data)
    res.json({
      success: true,
      order: {
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        items: order.items ? order.items.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          width: item.width,
          height: item.height
        })) : [],
        pricing: {
          subtotal: order.subtotal,
          tax: order.tax,
          // order.shipping is the numeric shipping cost; guard against any
          // legacy order where it was corrupted into a tracking object.
          shipping: (typeof order.shipping === 'number')
            ? order.shipping
            : (order.pricing && typeof order.pricing.shipping === 'number' ? order.pricing.shipping : 0),
          total: order.total
        },
        shipping_address: order.shipping_address,
        // Canonical tracking lives on order.tracking; fall back to any legacy
        // tracking that older code wrote onto the order.shipping object.
        tracking: order.tracking
          || (order.shipping && typeof order.shipping === 'object' && order.shipping.trackingNumber ? order.shipping : null)
      }
    });
  } catch (error) {
    console.error('Order lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to look up order. Please try again later.'
    });
  }
});

// Create order
app.post('/api/orders', (req, res) => {
  try {
    const db = loadDatabase();
    const {
      sessionId, customerName, customerEmail, customerPhone,
      shippingAddress, billingAddress,
      paymentMethod, paymentDetails, paymentStatus
    } = req.body;

    const orderId = uuidv4();
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();

    // =====================================================
    // CUSTOMER LINKING: Find or create customer by email/phone
    // =====================================================
    if (!db.customers) db.customers = [];

    // First try to find by email
    let customer = customerEmail
      ? db.customers.find(c => c.email && c.email.toLowerCase() === customerEmail.toLowerCase())
      : null;

    // If not found by email, try to find by phone
    if (!customer && customerPhone) {
      const normalizedPhone = customerPhone.replace(/\D/g, '');
      if (normalizedPhone) {
        customer = db.customers.find(c => {
          if (!c.phone) return false;
          return c.phone.replace(/\D/g, '') === normalizedPhone;
        });
      }
    }

    // Create new customer only if not found by email or phone
    if (!customer && (customerEmail || customerPhone)) {
      const nameParts = (customerName || '').trim().split(' ');
      customer = {
        id: `cust-${uuidv4().slice(0, 8)}`,
        email: customerEmail || '',
        firstName: nameParts[0] || 'Customer',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: customerPhone || '',
        type: 'retail',
        companyName: '',
        addresses: shippingAddress ? [{ type: 'shipping', address: shippingAddress }] : [],
        tags: [],
        notes: 'Auto-created from order',
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString(),
        lastOrderAt: null
      };
      db.customers.push(customer);
      console.log(`New customer created: ${customer.id} (${customerEmail || customerPhone})`);
    }

    const customerId = customer ? customer.id : null;

    // Get cart items
    const cartItems = db.cart.filter(item => item.session_id === sessionId);

    // BUG-H003 (checkout): reject orders with no server-side cart (empty cart /
    // bad session) instead of persisting an empty, mispriced order.
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty or session not found' });
    }

    // BUG-J001 / BUG-H001 (checkout price tampering): the order total was built
    // from client-supplied subtotal/tax/shipping — a caller could POST
    // subtotal:0.01 for a real cart and get a fully-priced order for one cent.
    // Recompute money SERVER-SIDE from the engine-authoritative cart line totals
    // (same field GET /api/cart trusts) and the canonical tax/shipping rules from
    // /api/calculate-order-total. Any client-sent amounts are ignored.
    const subtotal = Math.round(
      cartItems.reduce((sum, item) => sum + (item.line_total || (item.unit_price || 0) * (item.quantity || 1)), 0) * 100
    ) / 100;
    const taxRate = 0.0725; // CA default — identical to /api/calculate-order-total
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const shipping = subtotal >= 99 ? 0 : 9.99;
    const total = Math.round((subtotal + tax + shipping) * 100) / 100;

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
      customerId: customerId,  // Link to customer
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      shipping_address: shippingAddress,
      billing_address: billingAddress || shippingAddress,
      subtotal,
      tax: tax || 0,
      shipping: shipping || 0,
      total,
      status: 'pending',
      // Payment information
      payment: {
        method: paymentMethod || 'invoice',
        status: paymentStatus || 'pending',
        details: paymentDetails || {},
        processedAt: paymentStatus === 'paid' ? new Date().toISOString() : null
      },
      items: cartItems.map(item => ({
        ...item,
        order_id: orderId
      })),
      // Add pricing object with manufacturer cost analysis
      pricing: {
        subtotal,
        tax: tax || 0,
        shipping: shipping || 0,
        total,
        manufacturer_cost_total: Math.round(totalMfrCost * 100) / 100,
        margin_total: Math.round(marginTotal * 100) / 100,
        margin_percent: Math.round(marginPercent * 100) / 100
      },
      created_at: new Date().toISOString()
    };

    db.orders.push(order);

    // Update customer stats if linked
    if (customerId && customer) {
      const custIndex = db.customers.findIndex(c => c.id === customerId);
      if (custIndex >= 0) {
        db.customers[custIndex].totalOrders = (db.customers[custIndex].totalOrders || 0) + 1;
        db.customers[custIndex].totalSpent = (db.customers[custIndex].totalSpent || 0) + total;
        db.customers[custIndex].lastOrderAt = new Date().toISOString();
      }
    }

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
    // BUG-F001: this public route previously returned the ENTIRE order object
    // (customer PII + internal manufacturer cost/margin) for any guessable
    // order number with no auth and no email — an order-enumeration / IDOR
    // hole that bypassed the email-gated /api/orders/lookup. Require the same
    // credential pair (order number + matching email) and return the same
    // reduced projection.
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Order number and email are required'
      });
    }

    const db = loadDatabase();
    const order = db.orders.find(o =>
      (o.order_number === req.params.orderNumber || o.id === req.params.orderNumber) &&
      o.customer_email &&
      o.customer_email.toLowerCase() === String(email).toLowerCase()
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found. Please check your order number and email address.'
      });
    }

    res.json({
      success: true,
      data: {
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        items: order.items ? order.items.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          width: item.width,
          height: item.height
        })) : [],
        pricing: {
          subtotal: order.subtotal,
          tax: order.tax,
          // order.shipping is the numeric shipping cost; guard against any
          // legacy order where it was corrupted into a tracking object.
          shipping: (typeof order.shipping === 'number')
            ? order.shipping
            : (order.pricing && typeof order.pricing.shipping === 'number' ? order.pricing.shipping : 0),
          total: order.total
        },
        shipping_address: order.shipping_address,
        // Canonical tracking lives on order.tracking; fall back to any legacy
        // tracking that older code wrote onto the order.shipping object.
        tracking: order.tracking
          || (order.shipping && typeof order.shipping === 'object' && order.shipping.trackingNumber ? order.shipping : null)
      }
    });
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
// BUG-G001: per-order ledger exposes internal manufacturer cost + margin
// (manufacturer_payable/paid amounts and margin metadata). It is pure internal
// accounting — every sibling ledger view is authMiddleware-gated and no
// front-end consumes this route — so require admin auth here too.
app.get('/api/orders/:orderId/ledger', authMiddleware, (req, res) => {
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
    const { productSlug: rawSlug, productType, width, height, quantity, fabricCode, options, manufacturerId } = req.body;
    const productSlug = normalizeSlug(rawSlug);

    // Find product by slug
    const db = getDatabase();
    const product = db.products.find(p => p.slug === productSlug);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const pType = productType || product.category_slug?.replace('-shades', '') || 'roller';

    // If manufacturerId provided, check if pricing is linked
    if (manufacturerId) {
      const manufacturer = db.manufacturers?.find(m => m.id === manufacturerId);

      if (!manufacturer) {
        return res.status(404).json({ success: false, error: 'Manufacturer not found' });
      }

      // Check if manufacturer has pricing linked for this product type
      if (!manufacturer.pricingLinked) {
        return res.json({
          success: true,
          comingSoon: true,
          manufacturer: {
            id: manufacturer.id,
            name: manufacturer.name
          },
          message: `${manufacturer.name} pricing coming soon for ${pType} shades`,
          product: { id: product.id, name: product.name, slug: productSlug, type: pType },
          pricing: null
        });
      }

      // Check if there are actual prices for this manufacturer and product type
      const hasActualPricing = db.manufacturerPrices?.some(p =>
        p.manufacturerId === manufacturerId &&
        p.productType === pType.toLowerCase()
      );

      if (!hasActualPricing) {
        return res.json({
          success: true,
          comingSoon: true,
          manufacturer: {
            id: manufacturer.id,
            name: manufacturer.name
          },
          message: `${manufacturer.name} pricing coming soon for ${pType} shades`,
          product: { id: product.id, name: product.name, slug: productSlug, type: pType },
          pricing: null
        });
      }
    }

    // Use extended pricing engine with fabric-based pricing
    const result = extendedPricingEngine.calculateCustomerPrice({
      productId: product.id,
      productSlug: productSlug,
      productType: pType,
      fabricCode: fabricCode || null,
      width: width || 24,
      height: height || 36,
      quantity: quantity || 1,
      options: options || {},
      manufacturerId: manufacturerId || null
    });

    // Add manufacturer info to response
    if (manufacturerId) {
      const manufacturer = db.manufacturers?.find(m => m.id === manufacturerId);
      if (manufacturer) {
        result.manufacturer = {
          id: manufacturer.id,
          name: manufacturer.name,
          leadTimeDays: manufacturer.leadTimeDays
        };
      }
    }

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

    // Calculate shipping by DESTINATION (location) and total QUANTITY/weight.
    // Free shipping removed by request: order value never waives shipping.
    const totalQty = items.reduce((sum, it) => sum + (parseInt(it.quantity) || 1), 0);
    const destState = shippingAddress?.state || null;
    const shippingResult = extendedPricingEngine.calculateShipping(
      subtotal, totalQty, destState, systemConfig.getShipping()
    );
    const shippingAmount = shippingResult.amount;

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
          method: shippingResult.method,
          amount: shippingAmount,
          description: shippingResult.description
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

// Database index stats endpoint (TICKET-011)
app.get('/api/admin/db-stats', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const indexStats = dbIndex.getStats();

    res.json({
      success: true,
      data: {
        collections: {
          orders: db.orders?.length || 0,
          invoices: db.invoices?.length || 0,
          customers: db.customers?.length || 0,
          products: db.products?.length || 0,
          cart: db.cart?.length || 0,
          quotes: db.quotes?.length || 0
        },
        indexes: indexStats,
        performance: {
          cacheEnabled: true,
          indexingEnabled: true
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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

    // Recent orders (last 5)
    const recentOrders = db.orders
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Recent quotes (last 5)
    const recentQuotes = db.quotes
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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
          pendingQuotes
        },
        recentOrders,
        recentQuotes
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

    const {
      name, slug, description, category_id, base_price, sale_price,
      is_featured, is_active, image_url, stock_status, is_discontinued,
      // New Product Content fields
      tagline, long_description, compare_price, promo_badge, video_url,
      specs, recommended_rooms, seo, light_control
    } = req.body;

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

    // Update basic fields
    if (name) db.products[productIndex].name = name;
    if (slug) db.products[productIndex].slug = slug;
    if (description !== undefined) db.products[productIndex].description = description;
    if (base_price !== undefined) db.products[productIndex].base_price = parseFloat(base_price);
    if (sale_price !== undefined) db.products[productIndex].sale_price = sale_price ? parseFloat(sale_price) : null;
    if (is_featured !== undefined) db.products[productIndex].is_featured = is_featured;
    if (is_active !== undefined) db.products[productIndex].is_active = is_active;
    if (image_url !== undefined) db.products[productIndex].image_url = image_url;
    if (req.body.gallery_images !== undefined) db.products[productIndex].gallery_images = req.body.gallery_images;

    // Stock and discontinued status
    if (stock_status !== undefined) {
      if (!['in_stock', 'out_of_stock'].includes(stock_status)) {
        return res.status(400).json({ success: false, error: 'Invalid stock_status. Must be in_stock or out_of_stock' });
      }
      db.products[productIndex].stock_status = stock_status;
    }
    if (is_discontinued !== undefined) db.products[productIndex].is_discontinued = Boolean(is_discontinued);

    // ============================================
    // NEW PRODUCT CONTENT FIELDS
    // ============================================

    // Tagline / Subtitle
    if (tagline !== undefined) db.products[productIndex].tagline = tagline;

    // Long description / Marketing copy
    if (long_description !== undefined) db.products[productIndex].long_description = long_description;

    // Compare at price (for showing savings)
    if (compare_price !== undefined) db.products[productIndex].compare_price = compare_price ? parseFloat(compare_price) : null;

    // Promo badge text (SALE, NEW, BEST SELLER)
    if (promo_badge !== undefined) db.products[productIndex].promo_badge = promo_badge;

    // Product video URL
    if (video_url !== undefined) db.products[productIndex].video_url = video_url;

    // Product specifications (width/height range, materials, mount options, etc.)
    if (specs !== undefined) {
      db.products[productIndex].specs = {
        ...(db.products[productIndex].specs || {}),
        ...specs
      };
    }

    // Recommended rooms (living-room, bedroom, kitchen, etc.)
    if (recommended_rooms !== undefined) db.products[productIndex].recommended_rooms = recommended_rooms;

    // SEO fields (title, description, keywords)
    if (seo !== undefined) {
      db.products[productIndex].seo = {
        ...(db.products[productIndex].seo || {}),
        ...seo
      };
    }

    // Light control options (lightFiltering, roomDarkening, blackout)
    if (light_control !== undefined) {
      db.products[productIndex].light_control = {
        ...(db.products[productIndex].light_control || {}),
        ...light_control
      };
    }

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
    const { status, search, page, limit, startDate, endDate, productType } = req.query;

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

    // Date range filtering
    if (startDate) {
      const start = new Date(startDate);
      orders = orders.filter(o => new Date(o.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      orders = orders.filter(o => new Date(o.created_at) <= end);
    }

    // Product type filtering
    if (productType) {
      orders = orders.filter(o => {
        if (!o.items || o.items.length === 0) return false;
        return o.items.some(item => {
          // Check explicit product_type field
          const type = (item.product_type || item.productType || '').toLowerCase();
          if (type === productType) return true;

          // Check product_slug
          const slug = (item.product_slug || '').toLowerCase();
          if (slug.includes(productType)) return true;

          // Check product_name
          const name = (item.product_name || '').toLowerCase();
          if (name.includes(productType)) return true;

          // Check fabric code in configuration
          try {
            const cfg = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : (item.configuration || {});
            if (cfg.productType && cfg.productType.toLowerCase() === productType) return true;
            if (cfg.fabricCode) {
              if (productType === 'zebra' && cfg.fabricCode.startsWith('83')) return true;
              if (productType === 'roller' && cfg.fabricCode.startsWith('82')) return true;
            }
          } catch (e) { /* ignore */ }

          return false;
        });
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

    // Pagination
    const total = normalizedOrders.length;
    const pageNum = parseInt(page) || 1;
    const pageSize = Math.min(parseInt(limit) || 25, 100); // Default 25, max 100
    const start = (pageNum - 1) * pageSize;
    const paginatedOrders = normalizedOrders.slice(start, start + pageSize);

    res.json({
      success: true,
      orders: paginatedOrders,
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize)
    });
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

    // BUG-F004: let the admin attach a fulfillment tracking number when
    // marking an order shipped. Stored on the canonical order.tracking field
    // the customer tracking page reads (order.shipping stays the numeric cost).
    const { carrier, trackingNumber, trackingUrl, estimatedDelivery } = req.body;
    if (trackingNumber && carrier) {
      const trackTs = new Date().toISOString();
      order.tracking = {
        carrier,
        trackingNumber,
        trackingUrl: trackingUrl || null,
        estimatedDelivery: estimatedDelivery || null,
        shippedAt: (order.tracking && order.tracking.shippedAt) || trackTs,
        updatedAt: trackTs,
        updatedBy: (req.admin && req.admin.id) || 'admin'
      };
    }

    // BUG-F004: queue a shipment-notification audit record when the order
    // first transitions to shipped (mirrors the Stage-3 emailLogs pattern;
    // no SMTP wired locally so it is queued, not sent).
    if (status === 'shipped' && previousStatus !== 'shipped') {
      if (!db.emailLogs) db.emailLogs = [];
      db.emailLogs.push({
        id: 'email-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        type: 'shipment_notification',
        to: order.customer_email || null,
        orderId: order.id,
        orderNumber: order.order_number,
        subject: `Your order ${order.order_number} has shipped`,
        carrier: (order.tracking && order.tracking.carrier) || null,
        trackingNumber: (order.tracking && order.tracking.trackingNumber) || null,
        status: 'queued',
        createdAt: new Date().toISOString(),
        source: 'admin_status_update'
      });
    }

    saveDatabase(db);

    // TICKET 014: Record profit when order ships
    let profitInfo = null;
    if (status === 'shipped' && previousStatus !== 'shipped') {
      try {
        // BUG-F005: server.js keeps its own DB cache while the ledger/profit
        // path reads through services/db-loader's SEPARATE cache. Without this
        // invalidation, recordShippedProfit() re-reads a stale pre-save copy
        // and its own save then clobbers the status/tracking/notification we
        // just persisted (a lost write). Force the shared cache to re-read the
        // fresh disk state first so both writes are coherent.
        require('./services/db-loader').invalidateCache();
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

// ============================================
// AUTO-DELIVERY UPDATE ENDPOINTS
// ============================================

// Get shipped orders pending delivery update
app.get('/api/admin/orders/shipped-pending', authMiddleware, (req, res) => {
  try {
    const orderService = require('./services/order-service');
    const daysThreshold = parseInt(req.query.days) || 7;
    const orders = orderService.getShippedOrdersPendingDelivery(daysThreshold);

    res.json({
      success: true,
      daysThreshold,
      orders,
      total: orders.length,
      readyForAutoDelivery: orders.filter(o => o.readyForAutoDelivery).length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run auto-delivery update
app.post('/api/admin/orders/auto-delivery', authMiddleware, (req, res) => {
  try {
    const orderService = require('./services/order-service');
    const { days = 7, dryRun = false } = req.body;

    const result = orderService.autoDeliveryUpdate(days, dryRun);

    res.json({
      success: true,
      message: dryRun
        ? `Dry run complete. ${result.count} orders would be updated.`
        : `Auto-delivery complete. ${result.updated.length} orders updated.`,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ORDER STATUS MANAGEMENT APIs
// ============================================

// Default order status configuration (derived from ORDER_STATES)
const DEFAULT_ORDER_STATUS_CONFIG = [
  { id: 'order_placed', name: 'Order Placed', color: '#F59E0B', type: 'pending', order: 1, triggers: ['email_customer'], description: 'Customer has placed the order' },
  { id: 'order_received', name: 'Order Received', color: '#3B82F6', type: 'processing', order: 2, triggers: ['email_customer', 'email_admin'], description: 'Payment confirmed, order received' },
  { id: 'manufacturing', name: 'Manufacturing', color: '#8B5CF6', type: 'processing', order: 3, triggers: [], description: 'Order is being manufactured' },
  { id: 'qa', name: 'Quality Check', color: '#EC4899', type: 'processing', order: 4, triggers: [], description: 'Quality assurance inspection' },
  { id: 'shipped', name: 'Shipped', color: '#10B981', type: 'processing', order: 5, triggers: ['email_customer', 'sms_customer'], description: 'Order has been shipped' },
  { id: 'delivered', name: 'Delivered', color: '#10B981', type: 'completed', order: 6, triggers: ['email_customer'], description: 'Order delivered to customer' },
  { id: 'issue_reported', name: 'Issue Reported', color: '#F97316', type: 'pending', order: 7, triggers: ['email_admin'], description: 'Customer reported an issue' },
  { id: 'refund_requested', name: 'Refund Requested', color: '#EF4444', type: 'pending', order: 8, triggers: ['email_admin'], description: 'Customer requested a refund' },
  { id: 'refunded', name: 'Refunded', color: '#EF4444', type: 'cancelled', order: 9, triggers: ['email_customer', 'email_admin'], description: 'Order has been refunded' },
  { id: 'cancelled', name: 'Cancelled', color: '#6B7280', type: 'cancelled', order: 10, triggers: ['email_customer', 'email_admin'], description: 'Order has been cancelled' }
];

// Get all order statuses
app.get('/api/admin/order-statuses', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();

    // Check if custom statuses are configured
    const customStatuses = db.systemConfig?.orderStatuses;
    let statuses = customStatuses && customStatuses.length > 0
      ? customStatuses
      : DEFAULT_ORDER_STATUS_CONFIG;

    // Get order counts for each status
    const orders = db.orders || [];
    statuses = statuses.map(status => ({
      ...status,
      count: orders.filter(o => o.status === status.id).length
    }));

    // Also return valid transitions from ORDER_STATES
    const orderService = require('./services/order-service');
    const validTransitions = orderService.VALID_TRANSITIONS || {};

    res.json({
      success: true,
      statuses,
      validTransitions,
      isCustomized: !!(customStatuses && customStatuses.length > 0)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get public order statuses (for dropdowns etc)
app.get('/api/order-statuses', (req, res) => {
  try {
    const db = loadDatabase();
    const customStatuses = db.systemConfig?.orderStatuses;
    const statuses = customStatuses && customStatuses.length > 0
      ? customStatuses
      : DEFAULT_ORDER_STATUS_CONFIG;

    // Return only essential fields for public use
    res.json({
      success: true,
      statuses: statuses.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        type: s.type
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order statuses configuration
app.put('/api/admin/order-statuses', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { statuses } = req.body;

    if (!Array.isArray(statuses)) {
      return res.status(400).json({ success: false, error: 'Statuses must be an array' });
    }

    // Validate required fields
    for (const status of statuses) {
      if (!status.id || !status.name || !status.color || !status.type) {
        return res.status(400).json({
          success: false,
          error: 'Each status must have id, name, color, and type'
        });
      }
    }

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.orderStatuses = statuses.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color,
      type: s.type,
      order: s.order || 0,
      triggers: s.triggers || [],
      description: s.description || ''
    }));

    saveDatabase(db);

    res.json({ success: true, message: 'Order statuses updated', statuses: db.systemConfig.orderStatuses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset order statuses to defaults
app.post('/api/admin/order-statuses/reset', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.orderStatuses = [...DEFAULT_ORDER_STATUS_CONFIG];

    saveDatabase(db);

    res.json({ success: true, message: 'Order statuses reset to defaults', statuses: db.systemConfig.orderStatuses });
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
        (q.quote_number || '').toLowerCase().includes(searchLower) ||
        (q.customer_name || '').toLowerCase().includes(searchLower) ||
        (q.customer_email || '').toLowerCase().includes(searchLower)
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
    // Return default settings if not exists
    const settings = db.settings || {
      storeName: 'Peekaboo Shades',
      storeEmail: '',
      storePhone: '',
      logoUrl: '/images/logo.png',
      taxRate: 0.08,
      currency: 'USD',
      shippingRate: 9.99,
      freeShippingThreshold: 99
    };
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update settings
app.put('/api/admin/settings', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { storeName, storeEmail, storePhone, logoUrl, taxRate, currency, shippingRate, freeShippingThreshold } = req.body;

    // Initialize settings if not exists
    if (!db.settings) {
      db.settings = {
        storeName: 'Peekaboo Shades',
        storeEmail: '',
        storePhone: '',
        logoUrl: '/images/logo.png',
        taxRate: 0.08,
        currency: 'USD',
        shippingRate: 9.99,
        freeShippingThreshold: 99
      };
    }

    if (storeName !== undefined) db.settings.storeName = storeName;
    if (storeEmail !== undefined) db.settings.storeEmail = storeEmail;
    if (storePhone !== undefined) db.settings.storePhone = storePhone;
    if (logoUrl !== undefined) db.settings.logoUrl = logoUrl;
    if (taxRate !== undefined) db.settings.taxRate = parseFloat(taxRate);
    if (currency !== undefined) db.settings.currency = currency;
    if (shippingRate !== undefined) db.settings.shippingRate = parseFloat(shippingRate);
    if (freeShippingThreshold !== undefined) db.settings.freeShippingThreshold = parseFloat(freeShippingThreshold);

    saveDatabase(db);

    res.json({ success: true, message: 'Settings updated', data: db.settings });
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
// ADMIN MANUFACTURERS MANAGEMENT
// ============================================

// Excel file upload configuration for pricing
const pricingUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../frontend/public/uploads/pricing');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `pricing-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const pricingUpload = multer({
  storage: pricingUploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /xlsx|xls/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const validMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (ext && validMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// Get all manufacturers (admin)
app.get('/api/admin/manufacturers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    let manufacturers = db.manufacturers || [];

    // Add pricing stats
    manufacturers = manufacturers.map(m => {
      const fabricCount = (db.manufacturerPrices || []).filter(p => p.manufacturerId === m.id).length;
      const hardwareCount = (db.manufacturerHardwarePrices || []).filter(p => p.manufacturerId === m.id).length;
      const motorCount = (db.manufacturerMotorPrices || []).filter(p => p.manufacturerId === m.id).length;
      const accessoryCount = (db.manufacturerAccessoryPrices || []).filter(p => p.manufacturerId === m.id).length;

      return {
        ...m,
        pricingStats: {
          totalFabrics: fabricCount,
          totalHardware: hardwareCount,
          totalMotors: motorCount,
          totalAccessories: accessoryCount,
          ...m.pricingStats
        }
      };
    });

    res.json({ success: true, manufacturers });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get manufacturer by ID (admin)
app.get('/api/admin/manufacturers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const manufacturer = (db.manufacturers || []).find(m => m.id === req.params.id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    // Add pricing details
    const pricingSummary = excelPricingService.getPricingSummary(manufacturer.id);

    res.json({
      success: true,
      manufacturer: {
        ...manufacturer,
        pricingSummary
      }
    });
  } catch (error) {
    console.error('Error fetching manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create manufacturer
app.post('/api/admin/manufacturers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { name, code, email, phone, contactName, address, productTypes, leadTimeDays, paymentTerms, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Manufacturer name is required' });
    }

    // Check for duplicate code
    const mfrCode = (code || name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const existing = (db.manufacturers || []).find(m => m.code === mfrCode);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Manufacturer code already exists' });
    }

    const now = new Date().toISOString();
    const newManufacturer = {
      id: `mfr-${uuidv4().substring(0, 8)}`,
      name: name.trim(),
      code: mfrCode,
      email: email || '',
      phone: phone || '',
      contactName: contactName || '',
      address: address || {},
      productTypes: productTypes || ['roller', 'zebra', 'honeycomb', 'roman'],
      leadTimeDays: parseInt(leadTimeDays) || 14,
      paymentTerms: paymentTerms || 'net30',
      shippingMethod: 'standard',
      status: 'active',
      notes: notes || '',
      assignmentPriority: (db.manufacturers || []).length + 1,
      pricingLinked: false,
      pricingStats: {
        totalFabrics: 0,
        totalHardware: 0,
        totalMotors: 0,
        totalAccessories: 0,
        lastUploadAt: null,
        lastUploadBy: null,
        lastUploadFile: null
      },
      createdAt: now,
      updatedAt: now,
      createdBy: req.admin.id
    };

    if (!db.manufacturers) db.manufacturers = [];
    db.manufacturers.push(newManufacturer);
    saveDatabase(db);

    res.status(201).json({ success: true, manufacturer: newManufacturer });
  } catch (error) {
    console.error('Error creating manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update manufacturer
app.put('/api/admin/manufacturers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const mfrIndex = (db.manufacturers || []).findIndex(m => m.id === req.params.id);

    if (mfrIndex === -1) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    const { name, email, phone, contactName, address, productTypes, leadTimeDays, paymentTerms, status, notes, assignmentPriority } = req.body;

    const now = new Date().toISOString();
    const updated = { ...db.manufacturers[mfrIndex] };

    if (name !== undefined) updated.name = name.trim();
    if (email !== undefined) updated.email = email;
    if (phone !== undefined) updated.phone = phone;
    if (contactName !== undefined) updated.contactName = contactName;
    if (address !== undefined) updated.address = address;
    if (productTypes !== undefined) updated.productTypes = productTypes;
    if (leadTimeDays !== undefined) updated.leadTimeDays = parseInt(leadTimeDays);
    if (paymentTerms !== undefined) updated.paymentTerms = paymentTerms;
    if (status !== undefined) updated.status = status;
    if (notes !== undefined) updated.notes = notes;
    if (assignmentPriority !== undefined) updated.assignmentPriority = parseInt(assignmentPriority);

    updated.updatedAt = now;
    updated.updatedBy = req.admin.id;

    db.manufacturers[mfrIndex] = updated;
    saveDatabase(db);

    res.json({ success: true, manufacturer: updated });
  } catch (error) {
    console.error('Error updating manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete manufacturer (soft delete)
app.delete('/api/admin/manufacturers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const mfrIndex = (db.manufacturers || []).findIndex(m => m.id === req.params.id);

    if (mfrIndex === -1) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    // Check if manufacturer has orders
    const hasOrders = (db.orders || []).some(o => o.manufacturerId === req.params.id);
    if (hasOrders) {
      // Soft delete - set status to inactive
      db.manufacturers[mfrIndex].status = 'deleted';
      db.manufacturers[mfrIndex].deletedAt = new Date().toISOString();
      db.manufacturers[mfrIndex].deletedBy = req.admin.id;
    } else {
      // Hard delete
      db.manufacturers.splice(mfrIndex, 1);
    }

    saveDatabase(db);

    res.json({ success: true, message: 'Manufacturer deleted' });
  } catch (error) {
    console.error('Error deleting manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download pricing template
app.get('/api/admin/manufacturers/:id/download-template', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const manufacturer = (db.manufacturers || []).find(m => m.id === req.params.id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    const includeExisting = req.query.includeExisting === 'true';
    const buffer = excelPricingService.generatePricingTemplate(manufacturer.id, includeExisting);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${manufacturer.code}-pricing-template.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload pricing Excel (admin)
app.post('/api/admin/manufacturers/:id/upload-pricing', authMiddleware, pricingUpload.single('file'), (req, res) => {
  try {
    const db = loadDatabase();
    const manufacturer = (db.manufacturers || []).find(m => m.id === req.params.id);

    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const uploadedBy = {
      id: req.admin.id,
      email: req.admin.email,
      role: 'admin'
    };

    // Read file buffer
    const fileBuffer = fs.readFileSync(req.file.path);

    // Import pricing
    const result = excelPricingService.importPricingFromExcel(fileBuffer, manufacturer.id, uploadedBy);

    // Record history
    excelPricingService.recordUploadHistory(manufacturer.id, req.file.originalname, uploadedBy, result);

    // Update manufacturer pricingLinked flag
    if (result.success && result.summary.fabricsCreated + result.summary.fabricsUpdated > 0) {
      const mfrIndex = (db.manufacturers || []).findIndex(m => m.id === manufacturer.id);
      if (mfrIndex !== -1) {
        const freshDb = loadDatabase();
        freshDb.manufacturers[mfrIndex].pricingLinked = true;
        freshDb.manufacturers[mfrIndex].pricingStats = {
          ...freshDb.manufacturers[mfrIndex].pricingStats,
          lastUploadFile: req.file.originalname
        };
        saveDatabase(freshDb);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: result.success,
      message: result.success ? 'Pricing uploaded successfully' : 'Upload failed',
      summary: result.summary,
      errors: result.errors.slice(0, 20),
      warnings: result.warnings.slice(0, 20)
    });
  } catch (error) {
    console.error('Error uploading pricing:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pricing summary for manufacturer
app.get('/api/admin/manufacturers/:id/pricing-summary', authMiddleware, (req, res) => {
  try {
    const summary = excelPricingService.getPricingSummary(req.params.id);
    if (!summary) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error getting pricing summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get upload history for manufacturer
app.get('/api/admin/manufacturers/:id/upload-history', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = excelPricingService.getUploadHistory(req.params.id, limit);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error getting upload history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ORDER MANUFACTURER ASSIGNMENT
// ============================================

// Get unassigned orders
app.get('/api/admin/orders/unassigned', authMiddleware, (req, res) => {
  try {
    const orders = manufacturerAssignmentService.getUnassignedOrders();
    res.json({ success: true, orders, total: orders.length });
  } catch (error) {
    console.error('Error getting unassigned orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get assignment statistics
app.get('/api/admin/orders/assignment-stats', authMiddleware, (req, res) => {
  try {
    const stats = manufacturerAssignmentService.getAssignmentStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting assignment stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manually assign manufacturer to order
app.post('/api/admin/orders/:id/assign-manufacturer', authMiddleware, (req, res) => {
  try {
    const { manufacturerId } = req.body;

    if (!manufacturerId) {
      return res.status(400).json({ success: false, error: 'Manufacturer ID is required' });
    }

    const result = manufacturerAssignmentService.manualAssignManufacturer(
      req.params.id,
      manufacturerId,
      req.admin.id
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error assigning manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unassign manufacturer from order
app.post('/api/admin/orders/:id/unassign-manufacturer', authMiddleware, (req, res) => {
  try {
    const result = manufacturerAssignmentService.unassignManufacturer(req.params.id, req.admin.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error unassigning manufacturer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auto-assign all unassigned orders
app.post('/api/admin/orders/auto-assign-all', authMiddleware, (req, res) => {
  try {
    const result = manufacturerAssignmentService.autoAssignAllUnassignedOrders();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error auto-assigning orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MANUFACTURER PORTAL - PRICING UPLOAD
// ============================================

// Download pricing template (manufacturer portal)
app.get('/api/manufacturer/pricing-template', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.manufacturerId) {
      return res.status(401).json({ success: false, error: 'Invalid manufacturer token' });
    }

    const db = loadDatabase();
    const manufacturer = (db.manufacturers || []).find(m => m.id === decoded.manufacturerId);
    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    const includeExisting = req.query.includeExisting === 'true';
    const buffer = excelPricingService.generatePricingTemplate(manufacturer.id, includeExisting);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${manufacturer.code}-pricing-template.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload pricing Excel (manufacturer portal)
app.post('/api/manufacturer/upload-pricing', pricingUpload.single('file'), (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.manufacturerId) {
      return res.status(401).json({ success: false, error: 'Invalid manufacturer token' });
    }

    const db = loadDatabase();
    const manufacturerUser = (db.manufacturerUsers || []).find(u => u.id === decoded.id);
    const manufacturer = (db.manufacturers || []).find(m => m.id === decoded.manufacturerId);

    if (!manufacturer) {
      return res.status(404).json({ success: false, error: 'Manufacturer not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const uploadedBy = {
      id: decoded.id,
      email: manufacturerUser?.email || decoded.email,
      role: 'manufacturer'
    };

    // Read file buffer
    const fileBuffer = fs.readFileSync(req.file.path);

    // Import pricing
    const result = excelPricingService.importPricingFromExcel(fileBuffer, manufacturer.id, uploadedBy);

    // Record history
    excelPricingService.recordUploadHistory(manufacturer.id, req.file.originalname, uploadedBy, result);

    // Update manufacturer pricingLinked flag
    if (result.success && result.summary.fabricsCreated + result.summary.fabricsUpdated > 0) {
      const mfrIndex = (db.manufacturers || []).findIndex(m => m.id === manufacturer.id);
      if (mfrIndex !== -1) {
        const freshDb = loadDatabase();
        freshDb.manufacturers[mfrIndex].pricingLinked = true;
        freshDb.manufacturers[mfrIndex].pricingStats = {
          ...freshDb.manufacturers[mfrIndex].pricingStats,
          lastUploadFile: req.file.originalname
        };
        saveDatabase(freshDb);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: result.success,
      message: result.success ? 'Pricing uploaded successfully' : 'Upload failed',
      summary: result.summary,
      errors: result.errors.slice(0, 20),
      warnings: result.warnings.slice(0, 20)
    });
  } catch (error) {
    console.error('Error uploading pricing:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pricing status (manufacturer portal)
app.get('/api/manufacturer/pricing-status', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.manufacturerId) {
      return res.status(401).json({ success: false, error: 'Invalid manufacturer token' });
    }

    const summary = excelPricingService.getPricingSummary(decoded.manufacturerId);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error getting pricing status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get upload history (manufacturer portal)
app.get('/api/manufacturer/upload-history', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.manufacturerId) {
      return res.status(401).json({ success: false, error: 'Invalid manufacturer token' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const history = excelPricingService.getUploadHistory(decoded.manufacturerId, limit);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error getting upload history:', error);
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

// ============================================
// ZEBRA SHADES API
// ============================================

// Get zebra hardware options (valance types, bottom rails)
app.get('/api/zebra/hardware', (req, res) => {
  try {
    const db = loadDatabase();
    const zebraHardware = db.productContent?.zebraHardwareOptions || {};
    res.json({
      success: true,
      data: {
        valanceType: zebraHardware.valanceType || [],
        bottomRail: zebraHardware.bottomRail || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get zebra hardware options by category (Admin)
app.get('/api/admin/zebra/hardware/:category', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { category } = req.params;
    const zebraHardware = db.productContent?.zebraHardwareOptions || {};
    const options = zebraHardware[category] || [];
    res.json({ success: true, data: options });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create zebra hardware option (Admin)
app.post('/api/admin/zebra/hardware/:category', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { category } = req.params;

    if (!db.productContent) db.productContent = {};
    if (!db.productContent.zebraHardwareOptions) db.productContent.zebraHardwareOptions = {};
    if (!db.productContent.zebraHardwareOptions[category]) db.productContent.zebraHardwareOptions[category] = [];

    const newOption = {
      id: `${category}-${Date.now()}`,
      ...req.body
    };

    db.productContent.zebraHardwareOptions[category].push(newOption);
    saveDatabase(db);

    res.json({ success: true, data: newOption });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update zebra hardware option (Admin)
app.put('/api/admin/zebra/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { category, id } = req.params;

    const options = db.productContent?.zebraHardwareOptions?.[category] || [];
    const index = options.findIndex(opt => opt.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Option not found' });
    }

    options[index] = { ...options[index], ...req.body };
    saveDatabase(db);

    res.json({ success: true, data: options[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete zebra hardware option (Admin)
app.delete('/api/admin/zebra/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { category, id } = req.params;

    const options = db.productContent?.zebraHardwareOptions?.[category] || [];
    const index = options.findIndex(opt => opt.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Option not found' });
    }

    options.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Option deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get zebra fabrics with customer pricing
app.get('/api/fabrics/zebra', (req, res) => {
  try {
    const db = loadDatabase();
    const fabrics = db.zebraFabrics || [];
    const margin = db.zebraMargin || 40;

    // Apply margin to fabric prices for customer display
    const fabricsWithPricing = fabrics.map(fabric => {
      const mfrPrice = fabric.pricePerSqMeter || 0;
      const cordlessMfrPrice = fabric.cordlessPricePerSqMeter || mfrPrice;

      // Apply margin: customerPrice = mfrPrice / (1 - margin/100)
      const marginMultiplier = 1 / (1 - margin / 100);

      return {
        ...fabric,
        pricePerSqMeterManual: parseFloat((mfrPrice * marginMultiplier).toFixed(2)),
        pricePerSqMeterCordless: parseFloat((cordlessMfrPrice * marginMultiplier).toFixed(2))
      };
    });

    res.json({ success: true, fabrics: fabricsWithPricing });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FABRIC SAMPLES API (Public)
// ============================================

// Get all fabrics for samples page
app.get('/api/fabrics', (req, res) => {
  try {
    const db = loadDatabase();

    // Default material specs for roller fabrics
    const defaultRollerSpecs = {
      composition: '100% Polyester',
      weight: '160g/m²',
      width: 280,
      thickness: '0.38mm',
      waterResistant: true,
      fireResistant: true,
      mildewProof: true
    };

    // Combine fabrics from different sources
    const rollerFabrics = (db.productContent?.fabrics || []).map(f => ({
      id: f.id,
      code: f.code,
      name: f.name || f.code,
      filterType: f.filterType || 'blackout',
      productType: 'roller',
      imageUrl: f.imageUrl || `/images/fabrics/swatches/${f.code}_${(f.filterType || 'blackout').replace('-', '_')}.jpg`,
      isActive: f.isActive !== false,
      // Material details
      composition: f.composition || defaultRollerSpecs.composition,
      weight: f.weight || defaultRollerSpecs.weight,
      width: f.width || defaultRollerSpecs.width,
      thickness: f.thickness || defaultRollerSpecs.thickness,
      waterResistant: f.waterResistant ?? defaultRollerSpecs.waterResistant,
      fireResistant: f.fireResistant ?? defaultRollerSpecs.fireResistant,
      mildewProof: f.mildewProof ?? defaultRollerSpecs.mildewProof,
      formaldehydeFree: f.formaldehydeFree ?? false,
      antiBacteria: f.antiBacteria ?? false
    }));

    const zebraFabrics = (db.zebraFabrics || []).map(f => ({
      id: f.id || `zebra-${f.code}`,
      code: f.code,
      name: f.name || f.code,
      filterType: f.category || f.filterType || 'semi-blackout',
      productType: 'zebra',
      imageUrl: f.image || f.imageUrl || `/images/fabrics/zebra/${f.code}.png`,
      isActive: f.enabled !== false && f.isActive !== false,
      // Material details from zebra fabrics
      composition: f.composition || '100% Polyester',
      weight: f.weight || '115g/m²',
      width: f.width || 300,
      thickness: f.thickness || '',
      repeat: f.repeat || '7.5*5cm',
      waterResistant: f.waterResistant ?? true,
      fireResistant: f.fireResistant ?? false,
      mildewProof: f.mildewProof ?? false,
      formaldehydeFree: f.formaldehydeFree ?? false,
      antiBacteria: f.antiBacteria ?? false
    }));

    // Combine and filter active fabrics
    const allFabrics = [...rollerFabrics, ...zebraFabrics].filter(f => f.isActive !== false);

    res.json({ success: true, data: allFabrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit sample request
app.post('/api/sample-requests', (req, res) => {
  try {
    const db = loadDatabase();
    const { name, email, phone, address, samples, consent } = req.body;

    if (!name || !email || !address || !samples || !Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Stage 3.2 — validate the contact email so the confirmation / follow-up can actually be delivered
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
    if (!emailOk) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    // Build the authoritative fabric-code index from the same sources as GET /api/fabrics
    const rollerFabrics = db.productContent?.fabrics || [];
    const zebraFabrics = db.zebraFabrics || [];
    const codeToInvId = {};
    rollerFabrics.forEach(f => { if (f.code) codeToInvId[String(f.code).toUpperCase()] = (f.id || f.code); });
    zebraFabrics.forEach(f => { if (f.code) codeToInvId[String(f.code).toUpperCase()] = f.code; });

    // Stage 3.1 — normalize + de-duplicate the requested fabric codes
    const requested = [...new Set(samples.map(s => String(s).trim()).filter(Boolean))];
    if (requested.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fabric codes provided' });
    }
    if (requested.length > 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 samples allowed' });
    }

    // Stage 3.1 — reject codes that are not in the fabric catalog (no junk/invalid samples)
    const unknown = requested.filter(c => !(c.toUpperCase() in codeToInvId));
    if (unknown.length > 0) {
      return res.status(400).json({ success: false, error: 'Unknown fabric code(s): ' + unknown.join(', ') });
    }

    if (!db.sampleRequests) db.sampleRequests = [];
    if (!db.sampleInventory) db.sampleInventory = {};
    if (!db.emailLogs) db.emailLogs = [];

    const now = new Date();

    // Stage 3.3 — create the sample fulfillment: reserve one swatch per requested code
    const fulfillment = requested.map(code => {
      const invId = codeToInvId[code.toUpperCase()];
      const inv = db.sampleInventory[invId] || { stock: 50, reserved: 0, reorderPoint: 20, lastRestock: now.toISOString() };
      const available = (inv.stock || 0) - (inv.reserved || 0);
      const reserved = available > 0;
      if (reserved) inv.reserved = (inv.reserved || 0) + 1;
      db.sampleInventory[invId] = inv;
      return { code, invId, status: reserved ? 'reserved' : 'backordered' };
    });

    // Stage 3.4 — schedule the "ready to order?" nudge (~2 weeks out), to be sent only if consent given
    const followUpDue = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const request = {
      id: 'SR-' + Date.now(),
      name,
      email: String(email).trim(),
      phone: phone || '',
      address,
      samples: requested,
      consent: consent === true,   // Stage 3.2 — marketing consent for the follow-up nudge
      status: 'pending',
      fulfillment,                 // Stage 3.3
      followUpDue,                 // Stage 3.4
      followUpSent: false,
      requestedAt: now.toISOString()
    };

    db.sampleRequests.push(request);

    // notification-send skill — log the confirmation notification for audit (UI promises a confirmation email)
    db.emailLogs.push({
      id: 'EL-' + Date.now(),
      type: 'sample_request_confirmation',
      to: request.email,
      template: 'sample-request-confirmation',
      relatedId: request.id,
      consent: request.consent,
      status: 'queued',
      createdAt: now.toISOString()
    });

    saveDatabase(db);

    res.json({ success: true, data: request, message: 'Sample request submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SAMPLE INVENTORY API (Admin)
// ============================================

// Get sample inventory - generates from fabrics with stock tracking
app.get('/api/admin/sample-inventory', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();

    // Initialize sampleInventory if not exists
    if (!db.sampleInventory) {
      db.sampleInventory = {};
    }

    // Get all fabrics from different sources
    const rollerFabrics = db.productContent?.fabrics || [];
    const zebraFabrics = db.zebraFabrics || [];
    const manufacturerPrices = db.manufacturerPrices || [];

    // Helper to determine shade type from fabric code
    const getShadeType = (fabricCode) => {
      // Check manufacturerPrices for product type
      const priceEntry = manufacturerPrices.find(mp => mp.fabricCode === fabricCode);
      if (priceEntry && priceEntry.productType) {
        return priceEntry.productType;
      }
      // Infer from fabric code patterns
      if (fabricCode.startsWith('83')) return 'zebra';
      if (fabricCode.startsWith('84')) return 'roman';
      if (fabricCode.startsWith('85')) return 'honeycomb';
      return 'roller'; // Default to roller (82xxx codes)
    };

    // Generate inventory from roller fabrics
    const rollerInventory = rollerFabrics.map(fabric => {
      const inv = db.sampleInventory[fabric.id || fabric.code] || {
        stock: 50,
        reserved: 0,
        reorderPoint: 20,
        lastRestock: new Date().toISOString()
      };

      return {
        id: fabric.id || fabric.code,
        name: fabric.name,
        sku: fabric.code,
        color: fabric.colorHex || '#8E6545',
        imageUrl: fabric.imageUrl,
        filterType: fabric.filterType,
        shadeType: 'roller',
        stock: inv.stock,
        reserved: inv.reserved,
        reorderPoint: inv.reorderPoint,
        lastRestock: inv.lastRestock
      };
    });

    // Generate inventory from zebra fabrics
    const zebraInventory = zebraFabrics.filter(f => f.enabled !== false).map(fabric => {
      const inv = db.sampleInventory[fabric.code] || {
        stock: 50,
        reserved: 0,
        reorderPoint: 20,
        lastRestock: new Date().toISOString()
      };

      return {
        id: fabric.code,
        name: fabric.name,
        sku: fabric.code,
        color: fabric.colorHex || '#6B8E23',
        imageUrl: fabric.image,
        filterType: fabric.category || fabric.shadingType,
        shadeType: 'zebra',
        stock: inv.stock,
        reserved: inv.reserved,
        reorderPoint: inv.reorderPoint,
        lastRestock: inv.lastRestock
      };
    });

    // Combine all inventories
    const inventory = [...rollerInventory, ...zebraInventory];

    res.json({ success: true, inventory });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update sample inventory stock
app.put('/api/admin/sample-inventory/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { id } = req.params;
    const { stock, reserved, reorderPoint, addQuantity } = req.body;

    if (!db.sampleInventory) {
      db.sampleInventory = {};
    }

    // Get current inventory or create new
    const current = db.sampleInventory[id] || {
      stock: 50,
      reserved: 0,
      reorderPoint: 20,
      lastRestock: new Date().toISOString()
    };

    // Update values
    if (addQuantity) {
      current.stock = (current.stock || 0) + addQuantity;
      current.lastRestock = new Date().toISOString();
    }
    if (stock !== undefined) current.stock = stock;
    if (reserved !== undefined) current.reserved = reserved;
    if (reorderPoint !== undefined) current.reorderPoint = reorderPoint;

    db.sampleInventory[id] = current;
    saveDatabase(db);

    res.json({ success: true, data: current });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk restock samples
app.post('/api/admin/sample-inventory/restock', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { items } = req.body; // Array of { id, addQuantity }

    if (!db.sampleInventory) {
      db.sampleInventory = {};
    }

    items.forEach(item => {
      const current = db.sampleInventory[item.id] || {
        stock: 0,
        reserved: 0,
        reorderPoint: 20,
        lastRestock: new Date().toISOString()
      };
      current.stock = (current.stock || 0) + item.addQuantity;
      current.lastRestock = new Date().toISOString();
      db.sampleInventory[item.id] = current;
    });

    saveDatabase(db);
    res.json({ success: true, message: 'Inventory restocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sample requests (admin)
app.get('/api/admin/sample-requests', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.sampleRequests || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update sample request status (admin)
app.put('/api/admin/sample-requests/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { id } = req.params;
    const { status } = req.body;

    if (!db.sampleRequests) db.sampleRequests = [];

    const index = db.sampleRequests.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    db.sampleRequests[index].status = status;
    db.sampleRequests[index].updatedAt = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, data: db.sampleRequests[index] });
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

// Bulk upload fabrics (roller)
app.post('/api/admin/fabrics/bulk-upload', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productContent) db.productContent = {};
    if (!db.productContent.fabrics) db.productContent.fabrics = [];

    const { fabrics } = req.body;
    if (!fabrics || !Array.isArray(fabrics)) {
      return res.status(400).json({ success: false, error: 'Invalid fabrics data' });
    }

    let imported = 0;
    let updated = 0;

    fabrics.forEach(fab => {
      if (!fab.code) return;

      const existingIndex = db.productContent.fabrics.findIndex(f => f.code === fab.code);
      const fabricData = {
        id: existingIndex >= 0 ? db.productContent.fabrics[existingIndex].id : `fab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        code: fab.code,
        name: fab.name || `${fab.code} ${fab.filterType || 'Fabric'}`,
        filterType: fab.filterType || 'blackout',
        imageUrl: fab.imageUrl || `/images/fabrics/${fab.code}.png`,
        isActive: fab.isActive !== false && fab.isActive !== 'false',
        composition: fab.composition || '100% Polyester',
        weight: fab.weight || '160g/m²',
        width: fab.width || 280,
        thickness: fab.thickness || '',
        waterResistant: fab.waterResistant === true || fab.waterResistant === 'true',
        fireResistant: fab.fireResistant === true || fab.fireResistant === 'true',
        mildewProof: fab.mildewProof === true || fab.mildewProof === 'true',
        formaldehydeFree: fab.formaldehydeFree === true || fab.formaldehydeFree === 'true',
        antiBacteria: fab.antiBacteria === true || fab.antiBacteria === 'true',
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        db.productContent.fabrics[existingIndex] = { ...db.productContent.fabrics[existingIndex], ...fabricData };
        updated++;
      } else {
        fabricData.createdAt = new Date().toISOString();
        db.productContent.fabrics.push(fabricData);
        imported++;
      }
    });

    saveDatabase(db);
    res.json({ success: true, imported, updated, total: db.productContent.fabrics.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all zebra fabrics (admin)
app.get('/api/admin/zebra/fabrics', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, fabrics: db.zebraFabrics || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a zebra fabric
app.put('/api/admin/zebra/fabrics/:code', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.zebraFabrics) db.zebraFabrics = [];

    const { code } = req.params;
    const fabricIndex = db.zebraFabrics.findIndex(f => f.code === code);

    if (fabricIndex === -1) {
      return res.status(404).json({ success: false, error: 'Fabric not found' });
    }

    db.zebraFabrics[fabricIndex] = {
      ...db.zebraFabrics[fabricIndex],
      ...req.body,
      code: code, // Ensure code doesn't change
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, fabric: db.zebraFabrics[fabricIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a zebra fabric
app.delete('/api/admin/zebra/fabrics/:code', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.zebraFabrics) db.zebraFabrics = [];

    const { code } = req.params;
    const fabricIndex = db.zebraFabrics.findIndex(f => f.code === code);

    if (fabricIndex === -1) {
      return res.status(404).json({ success: false, error: 'Fabric not found' });
    }

    db.zebraFabrics.splice(fabricIndex, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Fabric deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FABRIC IMAGE UPLOAD ENDPOINTS
// ============================================

// Multer storage for roller fabric images
const rollerFabricStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../frontend/public/images/fabrics/swatches');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fabricCode = req.body.fabricCode || `fabric-${Date.now()}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${fabricCode}${ext}`);
  }
});

const rollerFabricUpload = multer({
  storage: rollerFabricStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload roller fabric image
app.post('/api/admin/fabrics/upload-image', authMiddleware, rollerFabricUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const fabricCode = req.body.fabricCode;
    const imageUrl = `/images/fabrics/swatches/${req.file.filename}`;

    // Update fabric in database if fabricCode provided
    if (fabricCode) {
      const db = loadDatabase();
      if (db.productContent && db.productContent.fabrics) {
        const fabricIndex = db.productContent.fabrics.findIndex(f => f.code === fabricCode || f.id === fabricCode);
        if (fabricIndex >= 0) {
          db.productContent.fabrics[fabricIndex].imageUrl = imageUrl;
          saveDatabase(db);
        }
      }
    }

    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Multer storage for zebra fabric images
const zebraFabricStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../frontend/public/images/fabrics/zebra');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fabricCode = req.body.fabricCode || `zebra-${Date.now()}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${fabricCode}${ext}`);
  }
});

const zebraFabricUpload = multer({
  storage: zebraFabricStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload zebra fabric image
app.post('/api/admin/zebra/fabrics/upload-image', authMiddleware, zebraFabricUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const fabricCode = req.body.fabricCode;
    const imageUrl = `/images/fabrics/zebra/${req.file.filename}`;

    // Update fabric in database
    if (fabricCode) {
      const db = loadDatabase();
      if (db.zebraFabrics) {
        const fabricIndex = db.zebraFabrics.findIndex(f => f.code === fabricCode);
        if (fabricIndex >= 0) {
          db.zebraFabrics[fabricIndex].image = imageUrl;
          db.zebraFabrics[fabricIndex].hasImage = true;
          db.zebraFabrics[fabricIndex].updatedAt = new Date().toISOString();
          saveDatabase(db);
        }
      }
    }

    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk upload zebra fabrics
app.post('/api/admin/zebra/fabrics/bulk-upload', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.zebraFabrics) db.zebraFabrics = [];

    const { fabrics } = req.body;
    if (!fabrics || !Array.isArray(fabrics)) {
      return res.status(400).json({ success: false, error: 'Invalid fabrics data' });
    }

    let imported = 0;
    let updated = 0;

    fabrics.forEach(fab => {
      if (!fab.code) return;

      const existingIndex = db.zebraFabrics.findIndex(f => f.code === fab.code);
      const fabricData = {
        code: fab.code,
        name: fab.name || `Zebra ${fab.category || 'Semi-blackout'} ${fab.code}`,
        category: fab.category || 'semi-blackout',
        shadingType: fab.shadingType || fab.category || 'Semi blackout',
        composition: fab.composition || '100% Polyester',
        weight: fab.weight || '115g/m²',
        width: fab.width || 300,
        thickness: fab.thickness || '',
        repeat: fab.repeat || '7.5*5cm',
        waterResistant: fab.waterResistant === true || fab.waterResistant === 'true',
        fireResistant: fab.fireResistant === true || fab.fireResistant === 'true',
        mildewProof: fab.mildewProof === true || fab.mildewProof === 'true',
        formaldehydeFree: fab.formaldehydeFree === true || fab.formaldehydeFree === 'true',
        antiBacteria: fab.antiBacteria === true || fab.antiBacteria === 'true',
        image: fab.imageUrl || fab.image || `/images/fabrics/zebra/${fab.code}.png`,
        hasImage: true,
        enabled: fab.enabled !== false && fab.enabled !== 'false',
        status: 'active',
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        db.zebraFabrics[existingIndex] = { ...db.zebraFabrics[existingIndex], ...fabricData };
        updated++;
      } else {
        fabricData.createdAt = new Date().toISOString();
        db.zebraFabrics.push(fabricData);
        imported++;
      }
    });

    saveDatabase(db);
    res.json({ success: true, imported, updated, total: db.zebraFabrics.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PRODUCT SPECS API (Phase 3)
// Specs Library with source evidence tracking
// ============================================

// Helper function to load specs data
function loadSpecsData() {
  try {
    const specsPath = path.join(__dirname, 'data', 'product_specs.json');
    if (fs.existsSync(specsPath)) {
      return JSON.parse(fs.readFileSync(specsPath, 'utf-8'));
    }
    return { version: '1.0.0', products: {}, commonSpecs: {}, metadata: {} };
  } catch (error) {
    console.error('Error loading specs:', error);
    return { version: '1.0.0', products: {}, commonSpecs: {}, metadata: {} };
  }
}

// Helper function to save specs data
function saveSpecsData(data) {
  const specsPath = path.join(__dirname, 'data', 'product_specs.json');
  data.metadata = data.metadata || {};
  data.metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(specsPath, JSON.stringify(data, null, 2));
}

// Helper function to load sources data
function loadSourcesData() {
  try {
    const sourcesPath = path.join(__dirname, 'data', 'content_sources.json');
    if (fs.existsSync(sourcesPath)) {
      return JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
    }
    return { version: '1.0.0', primarySources: {}, webSources: {}, fieldSources: {}, metadata: {} };
  } catch (error) {
    console.error('Error loading sources:', error);
    return { version: '1.0.0', primarySources: {}, webSources: {}, fieldSources: {}, metadata: {} };
  }
}

// Helper function to save sources data
function saveSourcesData(data) {
  const sourcesPath = path.join(__dirname, 'data', 'content_sources.json');
  data.metadata = data.metadata || {};
  data.metadata.updatedAt = new Date().toISOString();
  fs.writeFileSync(sourcesPath, JSON.stringify(data, null, 2));
}

// PUBLIC: Get specs for a specific product type
app.get('/api/specs', (req, res) => {
  try {
    const { productType } = req.query;
    const specsData = loadSpecsData();

    if (productType) {
      const product = specsData.products[productType];
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product type not found' });
      }
      res.json({
        success: true,
        data: product,
        commonSpecs: specsData.commonSpecs
      });
    } else {
      // Return all product types (summary)
      const summary = Object.keys(specsData.products).map(key => ({
        id: key,
        name: specsData.products[key].name,
        slug: specsData.products[key].slug
      }));
      res.json({ success: true, data: summary });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Get all specs (full data)
app.get('/api/admin/specs', authMiddleware, (req, res) => {
  try {
    const specsData = loadSpecsData();
    res.json({ success: true, data: specsData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Update specs
app.put('/api/admin/specs', authMiddleware, (req, res) => {
  try {
    const { productType, specs } = req.body;

    if (!productType || !specs) {
      return res.status(400).json({ success: false, error: 'productType and specs required' });
    }

    const specsData = loadSpecsData();

    if (!specsData.products[productType]) {
      return res.status(404).json({ success: false, error: 'Product type not found' });
    }

    // Merge specs (deep merge for nested objects)
    specsData.products[productType] = {
      ...specsData.products[productType],
      ...specs,
      specifications: {
        ...specsData.products[productType].specifications,
        ...(specs.specifications || {})
      },
      materials: {
        ...specsData.products[productType].materials,
        ...(specs.materials || {})
      },
      installation: {
        ...specsData.products[productType].installation,
        ...(specs.installation || {})
      }
    };

    saveSpecsData(specsData);
    res.json({ success: true, data: specsData.products[productType] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Get all sources
app.get('/api/admin/specs/sources', authMiddleware, (req, res) => {
  try {
    const sourcesData = loadSourcesData();
    res.json({ success: true, data: sourcesData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Update sources for a specific field
app.put('/api/admin/specs/sources', authMiddleware, (req, res) => {
  try {
    const { productType, fieldPath, source } = req.body;

    if (!productType || !fieldPath || !source) {
      return res.status(400).json({ success: false, error: 'productType, fieldPath, and source required' });
    }

    const sourcesData = loadSourcesData();

    if (!sourcesData.fieldSources[productType]) {
      sourcesData.fieldSources[productType] = {};
    }

    // Add or update the source for this field
    sourcesData.fieldSources[productType][fieldPath] = {
      ...source,
      extractedAt: source.extractedAt || new Date().toISOString()
    };

    // If it's a web source, add to webSources registry
    if (source.type === 'web' && source.url) {
      const sourceId = `web-${Date.now()}`;
      sourcesData.webSources[sourceId] = {
        id: sourceId,
        type: 'web',
        url: source.url,
        title: source.title || 'Web Source',
        domain: new URL(source.url).hostname,
        retrievedDate: source.retrievedDate || new Date().toISOString()
      };
      sourcesData.fieldSources[productType][fieldPath].sourceId = sourceId;
    }

    saveSourcesData(sourcesData);
    res.json({ success: true, data: sourcesData.fieldSources[productType][fieldPath] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Add a new web source
app.post('/api/admin/specs/sources/web', authMiddleware, (req, res) => {
  try {
    const { url, title, domain } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL required' });
    }

    const sourcesData = loadSourcesData();
    const sourceId = `web-${Date.now()}`;

    sourcesData.webSources[sourceId] = {
      id: sourceId,
      type: 'web',
      url,
      title: title || 'Web Source',
      domain: domain || new URL(url).hostname,
      retrievedDate: new Date().toISOString()
    };

    saveSourcesData(sourcesData);
    res.json({ success: true, data: sourcesData.webSources[sourceId] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADMIN: Get sources for a specific product type
app.get('/api/admin/specs/sources/:productType', authMiddleware, (req, res) => {
  try {
    const { productType } = req.params;
    const sourcesData = loadSourcesData();

    const productSources = sourcesData.fieldSources[productType] || {};

    res.json({
      success: true,
      data: {
        productType,
        fieldSources: productSources,
        primarySources: sourcesData.primarySources,
        webSources: sourcesData.webSources
      }
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

// Get all hardware options (for orders page)
app.get('/api/admin/hardware', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const hardware = db.productContent?.hardwareOptions || db.hardwareOptions || {};
    res.json({ success: true, data: hardware });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MANUFACTURER FABRIC PRICES API
// Dynamic pricing per fabric code (manual/cordless per m²)
// ============================================

// Get all manufacturer fabric prices (single table for all product types)
app.get('/api/admin/manufacturer-prices', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { productType, fabricCode, search } = req.query;

    // All prices are now in a single manufacturerPrices table with productType field
    let prices = db.manufacturerPrices || [];

    // Filter by product type if specified
    if (productType) {
      prices = prices.filter(p => p.productType === productType);
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
    const { productType } = req.query;

    // All prices in single table, filter by productType if specified
    let prices = db.manufacturerPrices || [];
    if (productType) {
      prices = prices.filter(p => p.productType === productType);
    }

    const price = prices.find(p =>
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
    const { productType, pricePerSqMeter, pricePerSqMeterCordless, margin, manualMargin, cordlessMargin } = req.body;

    // All prices in single manufacturerPrices table
    if (!db.manufacturerPrices) db.manufacturerPrices = [];

    // Find by fabricCode and optionally productType for accuracy
    let index = -1;
    if (productType) {
      index = db.manufacturerPrices.findIndex(p =>
        (p.fabricCode === req.params.fabricCode || p.id === req.params.fabricCode) &&
        p.productType === productType
      );
    }
    // Fallback: find without productType filter
    if (index === -1) {
      index = db.manufacturerPrices.findIndex(p =>
        p.fabricCode === req.params.fabricCode || p.id === req.params.fabricCode
      );
    }

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Fabric price not found' });
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

// --- HARDWARE OPTIONS BY SHADE TYPE ---
// Unified hardware management for different shade types (roller, zebra, etc.)

// Helper function to get hardware options path based on shade type
function getHardwarePath(db, shadeType, category, createIfMissing = false) {
  if (!db.productContent) db.productContent = {};

  // For roller, use existing hardwareOptions for backward compatibility
  if (shadeType === 'roller') {
    if (createIfMissing) {
      if (!db.productContent.hardwareOptions) db.productContent.hardwareOptions = {};
      if (!db.productContent.hardwareOptions[category]) db.productContent.hardwareOptions[category] = [];
    }
    return db.productContent.hardwareOptions?.[category] || [];
  }

  // For other shade types (zebra, roman, etc.), use hardwareByType
  if (createIfMissing) {
    if (!db.productContent.hardwareByType) db.productContent.hardwareByType = {};
    if (!db.productContent.hardwareByType[shadeType]) db.productContent.hardwareByType[shadeType] = {};
    if (!db.productContent.hardwareByType[shadeType][category]) db.productContent.hardwareByType[shadeType][category] = [];
  }
  return db.productContent.hardwareByType?.[shadeType]?.[category] || [];
}

// GET hardware options by shade type and category
app.get('/api/admin/hardware/:shadeType/:category', authMiddleware, (req, res) => {
  try {
    const { shadeType, category } = req.params;
    const db = loadDatabase();
    const options = getHardwarePath(db, shadeType, category);
    res.json({ success: true, options, data: options });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create hardware option
app.post('/api/admin/hardware/:shadeType/:category', authMiddleware, (req, res) => {
  try {
    const { shadeType, category } = req.params;
    const db = loadDatabase();

    const newOption = {
      id: `${shadeType}-${category}-${Date.now()}`,
      ...req.body,
      isActive: req.body.isActive !== false
    };

    // For roller, use existing hardwareOptions
    if (shadeType === 'roller') {
      if (!db.productContent) db.productContent = {};
      if (!db.productContent.hardwareOptions) db.productContent.hardwareOptions = {};
      if (!db.productContent.hardwareOptions[category]) db.productContent.hardwareOptions[category] = [];
      db.productContent.hardwareOptions[category].push(newOption);
    } else {
      // For other shade types, use hardwareByType
      if (!db.productContent) db.productContent = {};
      if (!db.productContent.hardwareByType) db.productContent.hardwareByType = {};
      if (!db.productContent.hardwareByType[shadeType]) db.productContent.hardwareByType[shadeType] = {};
      if (!db.productContent.hardwareByType[shadeType][category]) db.productContent.hardwareByType[shadeType][category] = [];
      db.productContent.hardwareByType[shadeType][category].push(newOption);
    }

    saveDatabase(db);
    res.json({ success: true, option: newOption });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update hardware option
app.put('/api/admin/hardware/:shadeType/:category/:id', authMiddleware, (req, res) => {
  try {
    const { shadeType, category, id } = req.params;
    const db = loadDatabase();

    let options;
    if (shadeType === 'roller') {
      options = db.productContent?.hardwareOptions?.[category];
    } else {
      options = db.productContent?.hardwareByType?.[shadeType]?.[category];
    }

    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });

    const index = options.findIndex(o => o.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Option not found' });

    options[index] = { ...options[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, option: options[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE hardware option
app.delete('/api/admin/hardware/:shadeType/:category/:id', authMiddleware, (req, res) => {
  try {
    const { shadeType, category, id } = req.params;
    const db = loadDatabase();

    let options;
    if (shadeType === 'roller') {
      options = db.productContent?.hardwareOptions?.[category];
    } else {
      options = db.productContent?.hardwareByType?.[shadeType]?.[category];
    }

    if (!options) return res.status(404).json({ success: false, error: 'Category not found' });

    const index = options.findIndex(o => o.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Option not found' });

    options.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- LEGACY HARDWARE OPTIONS (backward compatibility) ---
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

// ============================================
// PRICING ENGINE APIs
// Quantity Discounts, Dealer Pricing, Promotions
// ============================================

// --- QUANTITY DISCOUNTS ---
app.get('/api/admin/pricing/quantity-discounts/:shadeType', authMiddleware, (req, res) => {
  try {
    const { shadeType } = req.params;
    const db = loadDatabase();
    if (!db.pricing) db.pricing = {};
    if (!db.pricing.quantityDiscounts) db.pricing.quantityDiscounts = {};
    const discounts = db.pricing.quantityDiscounts[shadeType] || [];
    res.json({ success: true, discounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/pricing/quantity-discounts/:shadeType', authMiddleware, (req, res) => {
  try {
    const { shadeType } = req.params;
    const db = loadDatabase();
    if (!db.pricing) db.pricing = {};
    if (!db.pricing.quantityDiscounts) db.pricing.quantityDiscounts = {};
    if (!db.pricing.quantityDiscounts[shadeType]) db.pricing.quantityDiscounts[shadeType] = [];

    const newDiscount = {
      id: `qd-${shadeType}-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    db.pricing.quantityDiscounts[shadeType].push(newDiscount);
    saveDatabase(db);
    res.json({ success: true, discount: newDiscount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/pricing/quantity-discounts/:shadeType/:id', authMiddleware, (req, res) => {
  try {
    const { shadeType, id } = req.params;
    const db = loadDatabase();
    const discounts = db.pricing?.quantityDiscounts?.[shadeType];
    if (!discounts) return res.status(404).json({ success: false, error: 'Not found' });

    const index = discounts.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Discount not found' });

    discounts[index] = { ...discounts[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, discount: discounts[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/pricing/quantity-discounts/:shadeType/:id', authMiddleware, (req, res) => {
  try {
    const { shadeType, id } = req.params;
    const db = loadDatabase();
    const discounts = db.pricing?.quantityDiscounts?.[shadeType];
    if (!discounts) return res.status(404).json({ success: false, error: 'Not found' });

    const index = discounts.findIndex(d => d.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Discount not found' });

    discounts.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- DEALER PRICING TIERS ---
app.get('/api/admin/pricing/dealer-tiers/:shadeType', authMiddleware, (req, res) => {
  try {
    const { shadeType } = req.params;
    const db = loadDatabase();
    if (!db.pricing) db.pricing = {};
    if (!db.pricing.dealerTiers) db.pricing.dealerTiers = {};
    const tiers = db.pricing.dealerTiers[shadeType] || [];
    res.json({ success: true, tiers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/pricing/dealer-tiers/:shadeType', authMiddleware, (req, res) => {
  try {
    const { shadeType } = req.params;
    const db = loadDatabase();
    if (!db.pricing) db.pricing = {};
    if (!db.pricing.dealerTiers) db.pricing.dealerTiers = {};
    if (!db.pricing.dealerTiers[shadeType]) db.pricing.dealerTiers[shadeType] = [];

    const newTier = {
      id: `dt-${shadeType}-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    db.pricing.dealerTiers[shadeType].push(newTier);
    saveDatabase(db);
    res.json({ success: true, tier: newTier });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/pricing/dealer-tiers/:shadeType/:id', authMiddleware, (req, res) => {
  try {
    const { shadeType, id } = req.params;
    const db = loadDatabase();
    const tiers = db.pricing?.dealerTiers?.[shadeType];
    if (!tiers) return res.status(404).json({ success: false, error: 'Not found' });

    const index = tiers.findIndex(t => t.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Tier not found' });

    tiers[index] = { ...tiers[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, tier: tiers[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/pricing/dealer-tiers/:shadeType/:id', authMiddleware, (req, res) => {
  try {
    const { shadeType, id } = req.params;
    const db = loadDatabase();
    const tiers = db.pricing?.dealerTiers?.[shadeType];
    if (!tiers) return res.status(404).json({ success: false, error: 'Not found' });

    const index = tiers.findIndex(t => t.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Tier not found' });

    tiers.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- PROMOTIONS ---
app.get('/api/admin/pricing/promotions', authMiddleware, (req, res) => {
  try {
    const { shadeType } = req.query;
    const db = loadDatabase();
    if (!db.pricing) db.pricing = {};
    let promotions = db.pricing.promotions || [];

    // Filter by shade type if specified
    if (shadeType && shadeType !== 'all') {
      promotions = promotions.filter(p => p.appliesTo === shadeType || p.appliesTo === 'all');
    }

    res.json({ success: true, promotions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/pricing/promotions', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.pricing) db.pricing = {};
    if (!db.pricing.promotions) db.pricing.promotions = [];

    // Check for duplicate code
    const existingCode = db.pricing.promotions.find(p => p.code.toUpperCase() === req.body.code.toUpperCase());
    if (existingCode) {
      return res.status(400).json({ success: false, error: 'Promo code already exists' });
    }

    const newPromo = {
      id: `promo-${Date.now()}`,
      ...req.body,
      code: req.body.code.toUpperCase(),
      usedCount: 0,
      createdAt: new Date().toISOString()
    };
    db.pricing.promotions.push(newPromo);
    saveDatabase(db);
    res.json({ success: true, promotion: newPromo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/pricing/promotions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const db = loadDatabase();
    const promotions = db.pricing?.promotions;
    if (!promotions) return res.status(404).json({ success: false, error: 'Not found' });

    const index = promotions.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Promotion not found' });

    // Check for duplicate code (excluding current promo)
    if (req.body.code) {
      const existingCode = promotions.find(p => p.id !== id && p.code.toUpperCase() === req.body.code.toUpperCase());
      if (existingCode) {
        return res.status(400).json({ success: false, error: 'Promo code already exists' });
      }
    }

    promotions[index] = {
      ...promotions[index],
      ...req.body,
      code: req.body.code ? req.body.code.toUpperCase() : promotions[index].code,
      updatedAt: new Date().toISOString()
    };
    saveDatabase(db);
    res.json({ success: true, promotion: promotions[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/pricing/promotions/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const db = loadDatabase();
    const promotions = db.pricing?.promotions;
    if (!promotions) return res.status(404).json({ success: false, error: 'Not found' });

    const index = promotions.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Promotion not found' });

    promotions.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public endpoint to validate promo code at checkout
app.post('/api/validate-promo', (req, res) => {
  try {
    const { code, shadeType, orderTotal } = req.body;
    const db = loadDatabase();
    const promotions = db.pricing?.promotions || [];

    const promo = promotions.find(p =>
      p.code.toUpperCase() === code.toUpperCase() &&
      p.isActive &&
      (p.appliesTo === 'all' || p.appliesTo === shadeType)
    );

    if (!promo) {
      return res.json({ success: false, error: 'Invalid promo code' });
    }

    // Check dates
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) {
      return res.json({ success: false, error: 'Promo code not yet active' });
    }
    if (promo.endDate && new Date(promo.endDate) < now) {
      return res.json({ success: false, error: 'Promo code has expired' });
    }

    // Check usage limit
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.json({ success: false, error: 'Promo code usage limit reached' });
    }

    // Check minimum order
    if (promo.minOrderValue && orderTotal < promo.minOrderValue) {
      return res.json({ success: false, error: `Minimum order of $${promo.minOrderValue} required` });
    }

    res.json({
      success: true,
      promotion: {
        name: promo.name,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        bogoBuy: promo.bogoBuy,
        bogoGet: promo.bogoGet
      }
    });
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
// SEO: SITEMAP & ROBOTS.TXT
// ============================================

// Sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const baseUrl = 'https://peekabooshades.com';
  const db = readDatabase();

  // Static pages
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/shop', priority: '0.9', changefreq: 'daily' },
    { url: '/shop.html', priority: '0.9', changefreq: 'daily' },
    { url: '/cart.html', priority: '0.5', changefreq: 'monthly' },
    { url: '/policies/shipping.html', priority: '0.6', changefreq: 'monthly' },
    { url: '/policies/returns.html', priority: '0.6', changefreq: 'monthly' },
    { url: '/policies/warranty.html', priority: '0.6', changefreq: 'monthly' },
    { url: '/policies/child-safety.html', priority: '0.6', changefreq: 'monthly' },
    { url: '/policies/contact.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/faqs.html', priority: '0.6', changefreq: 'weekly' }
  ];

  // Product pages
  const products = db.products || [];
  const productPages = products
    .filter(p => p.is_active && !p.is_discontinued)
    .map(p => ({
      url: `/product/${p.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: p.updated_at || new Date().toISOString()
    }));

  // Category pages
  const categories = db.categories || [];
  const categoryPages = categories.map(c => ({
    url: `/shop?category=${c.slug}`,
    priority: '0.7',
    changefreq: 'weekly'
  }));

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  [...staticPages, ...productPages, ...categoryPages].forEach(page => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
    if (page.lastmod) {
      xml += `    <lastmod>${page.lastmod.split('T')[0]}</lastmod>\n`;
    }
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  const baseUrl = 'https://peekabooshades.com';
  const robots = `# Peekaboo Shades Robots.txt
User-agent: *
Allow: /

# Disallow admin and API
Disallow: /admin/
Disallow: /api/
Disallow: /dealer/
Disallow: /manufacturer/

# Disallow cart with parameters
Disallow: /cart?*
Disallow: /checkout?*

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;

  res.set('Content-Type', 'text/plain');
  res.send(robots);
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

// Zebra product page (specific route before generic product route)
app.get('/product/affordable-custom-zebra-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/zebra-product.html'));
});

// Zebra product shortcut route
app.get('/zebra-product', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/zebra-product.html'));
});

// Product detail page
app.get('/product/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/product.html'));
});

// Cart page
app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/cart.html'));
});

// FAQs page
app.get('/faqs', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/faqs.html'));
});

// Warranty page
app.get('/warranty', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/policies/warranty.html'));
});

// Contact page
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/contact.html'));
});

// Account page
app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/account.html'));
});

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/login.html'));
});

// Signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/signup.html'));
});

// Warranty page
app.get('/warranty', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/warranty.html'));
});

// About page (uses CMS page system)
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/page.html'));
});

// FAQs page (uses CMS page system)
app.get('/faqs', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/page.html'));
});

// Measuring Guide page
app.get('/measuring-guide', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/how-to-measure-for-blinds.html'));
});

// Installation page
app.get('/installation', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/index.html'));
});

// Reviews page (uses CMS page system)
app.get('/reviews', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/page.html'));
});

// Blog page
app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/blog.html'));
});

// Saved quote page (share code)
app.get('/quote/:shareCode', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/quote.html'));
});

// Order lookup page
app.get('/order-lookup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/order-lookup.html'));
});

// Wholesale/Trade page
app.get('/wholesale', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/trade.html'));
});

// Terms of Service
app.get('/terms-of-service', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/policies/terms-of-service.html'));
});

// Privacy Policy
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/policies/privacy-policy.html'));
});

// Guides clean URLs
app.get('/guides/how-to-measure-for-blinds', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/how-to-measure-for-blinds.html'));
});

app.get('/guides/zebra-vs-roller-shades', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/zebra-vs-roller-shades.html'));
});

app.get('/guides/cordless-vs-motorized', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/cordless-vs-motorized.html'));
});

app.get('/guides/blackout-shades-what-to-know', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/guides/blackout-shades-what-to-know.html'));
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
// PRODUCT TAGS API
// ============================================

// Get all product tags
app.get('/api/admin/product-tags', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.productTags) {
      db.productTags = {
        roller: ['New', 'Best Seller', 'Sale', 'Premium', 'Eco-Friendly'],
        zebra: ['New', 'Best Seller', 'Sale', 'Premium', 'Popular'],
        common: ['Featured', 'Limited Edition', 'Clearance']
      };
      saveDatabase(db);
    }
    res.json({ success: true, data: db.productTags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a product tag
app.post('/api/admin/product-tags', authMiddleware, (req, res) => {
  try {
    const { category, tag } = req.body;
    if (!category || !tag) {
      return res.status(400).json({ success: false, error: 'Category and tag name required' });
    }

    const db = loadDatabase();
    if (!db.productTags) {
      db.productTags = { roller: [], zebra: [], common: [] };
    }
    if (!db.productTags[category]) {
      db.productTags[category] = [];
    }

    if (!db.productTags[category].includes(tag)) {
      db.productTags[category].push(tag);
      saveDatabase(db);
    }

    res.json({ success: true, data: db.productTags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a product tag
app.delete('/api/admin/product-tags/:category/:tag', authMiddleware, (req, res) => {
  try {
    const { category, tag } = req.params;
    const db = loadDatabase();

    if (db.productTags && db.productTags[category]) {
      db.productTags[category] = db.productTags[category].filter(t => t !== tag);
      saveDatabase(db);
    }

    res.json({ success: true, data: db.productTags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tags for a specific product
app.get('/api/admin/products/:id/tags', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const product = db.products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product.tags || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update tags for a specific product
app.put('/api/admin/products/:id/tags', authMiddleware, (req, res) => {
  try {
    const { tags } = req.body;
    const db = loadDatabase();
    const productIndex = db.products.findIndex(p => p.id === req.params.id);

    if (productIndex === -1) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    db.products[productIndex].tags = tags || [];
    saveDatabase(db);

    res.json({ success: true, data: db.products[productIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get product tags (for frontend display)
app.get('/api/product-tags', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, data: db.productTags || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FABRIC COLLECTIONS API
// ============================================

// Initialize default collections if not exist
function initializeFabricCollections(db) {
  if (!db.fabricCollections) {
    db.fabricCollections = {
      roller: [],
      zebra: []
    };
  }
  if (!db.fabricCollections.roller) db.fabricCollections.roller = [];
  if (!db.fabricCollections.zebra) db.fabricCollections.zebra = [];
  return db;
}

// Get all fabric collections (both roller and zebra)
app.get('/api/admin/fabric-collections', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initializeFabricCollections(db);
    saveDatabase(db);

    // Get fabric details for each collection
    const rollerFabrics = db.productContent?.fabrics || [];
    const zebraFabrics = db.zebraFabrics || [];

    const enrichCollection = (collection, fabrics) => ({
      ...collection,
      fabricDetails: (collection.fabricIds || []).map(id =>
        fabrics.find(f => f.id === id || f.code === id)
      ).filter(Boolean)
    });

    res.json({
      success: true,
      data: {
        roller: db.fabricCollections.roller.map(c => enrichCollection(c, rollerFabrics)),
        zebra: db.fabricCollections.zebra.map(c => enrichCollection(c, zebraFabrics))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get collections by type (roller or zebra)
app.get('/api/admin/fabric-collections/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params;
    if (!['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }

    let db = loadDatabase();
    db = initializeFabricCollections(db);

    const fabrics = type === 'roller'
      ? (db.productContent?.fabrics || [])
      : (db.zebraFabrics || []);

    const collections = (db.fabricCollections[type] || []).map(collection => ({
      ...collection,
      fabricDetails: (collection.fabricIds || []).map(id =>
        fabrics.find(f => f.id === id || f.code === id)
      ).filter(Boolean)
    }));

    res.json({ success: true, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new fabric collection
app.post('/api/admin/fabric-collections', authMiddleware, (req, res) => {
  try {
    const { type, name, description, fabricIds, status, image } = req.body;

    if (!type || !['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }
    if (!name) {
      return res.status(400).json({ success: false, error: 'Collection name is required' });
    }

    let db = loadDatabase();
    db = initializeFabricCollections(db);

    const newCollection = {
      id: `col-${Date.now()}`,
      name,
      description: description || '',
      fabricIds: fabricIds || [],
      status: status || 'active',
      image: image || '',
      order: db.fabricCollections[type].length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.fabricCollections[type].push(newCollection);
    saveDatabase(db);

    res.json({ success: true, data: newCollection });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a fabric collection
app.put('/api/admin/fabric-collections/:type/:id', authMiddleware, (req, res) => {
  try {
    const { type, id } = req.params;
    const { name, description, fabricIds, status, image, order } = req.body;

    if (!['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }

    let db = loadDatabase();
    db = initializeFabricCollections(db);

    const index = db.fabricCollections[type].findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const updated = {
      ...db.fabricCollections[type][index],
      name: name ?? db.fabricCollections[type][index].name,
      description: description ?? db.fabricCollections[type][index].description,
      fabricIds: fabricIds ?? db.fabricCollections[type][index].fabricIds,
      status: status ?? db.fabricCollections[type][index].status,
      image: image ?? db.fabricCollections[type][index].image,
      order: order ?? db.fabricCollections[type][index].order,
      updatedAt: new Date().toISOString()
    };

    db.fabricCollections[type][index] = updated;
    saveDatabase(db);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a fabric collection
app.delete('/api/admin/fabric-collections/:type/:id', authMiddleware, (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }

    let db = loadDatabase();
    db = initializeFabricCollections(db);

    const index = db.fabricCollections[type].findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    db.fabricCollections[type].splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Collection deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get fabric collections for frontend
app.get('/api/fabric-collections', (req, res) => {
  try {
    const db = loadDatabase();
    const collections = db.fabricCollections || { roller: [], zebra: [] };

    // Only return active collections with fabric details
    const rollerFabrics = db.productContent?.fabrics || [];
    const zebraFabrics = db.zebraFabrics || [];

    const filterActive = (colls, fabrics) =>
      colls.filter(c => c.status === 'active').map(c => ({
        ...c,
        fabricDetails: (c.fabricIds || []).map(id =>
          fabrics.find(f => f.id === id || f.code === id)
        ).filter(Boolean)
      }));

    res.json({
      success: true,
      data: {
        roller: filterActive(collections.roller || [], rollerFabrics),
        zebra: filterActive(collections.zebra || [], zebraFabrics)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fabrics available for collections (helper endpoint)
app.get('/api/admin/fabric-collections/available-fabrics/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params;
    const db = loadDatabase();

    let fabrics = [];
    if (type === 'roller') {
      fabrics = (db.productContent?.fabrics || []).map(f => ({
        id: f.id || f.code,
        code: f.code,
        name: f.name,
        color: f.color || '#cccccc',
        filterType: f.filterType,
        imageUrl: f.imageUrl || f.swatchImage,
        isActive: f.isActive !== false
      }));
    } else if (type === 'zebra') {
      fabrics = (db.zebraFabrics || []).map(f => ({
        id: f.id || f.code,
        code: f.code,
        name: f.name,
        color: f.color || '#cccccc',
        category: f.category,
        shadingType: f.shadingType,
        imageUrl: f.imageUrl,
        enabled: f.enabled !== false
      }));
    }

    res.json({ success: true, data: fabrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// FABRIC ATTRIBUTES API
// ============================================

// Initialize default fabric attributes
function initializeFabricAttributes(db) {
  if (!db.fabricAttributes) {
    db.fabricAttributes = {
      roller: {
        opacity: [
          { id: 'op-1', name: 'Blackout (100%)', value: 100 },
          { id: 'op-2', name: 'Room Darkening (85%)', value: 85 },
          { id: 'op-3', name: 'Light Filtering (50%)', value: 50 },
          { id: 'op-4', name: 'Sheer (15%)', value: 15 }
        ],
        material: [
          { id: 'mat-1', name: 'Polyester' },
          { id: 'mat-2', name: 'Linen Blend' },
          { id: 'mat-3', name: 'Cotton' },
          { id: 'mat-4', name: 'PVC/Vinyl' }
        ],
        color: [
          { id: 'col-1', name: 'Whites & Creams', color: '#FFFFFF' },
          { id: 'col-2', name: 'Grays', color: '#808080' },
          { id: 'col-3', name: 'Tans & Beiges', color: '#D2B48C' },
          { id: 'col-4', name: 'Blacks', color: '#000000' },
          { id: 'col-5', name: 'Blues', color: '#4169E1' },
          { id: 'col-6', name: 'Greens', color: '#228B22' }
        ],
        feature: [
          { id: 'feat-1', name: 'Fire Retardant' },
          { id: 'feat-2', name: 'UV Resistant' },
          { id: 'feat-3', name: 'Moisture Resistant' },
          { id: 'feat-4', name: 'Eco-Friendly' },
          { id: 'feat-5', name: 'Thermal Insulating' }
        ]
      },
      zebra: {
        opacity: [
          { id: 'zop-1', name: 'Blackout', value: 100 },
          { id: 'zop-2', name: 'Semi-Sheer', value: 50 },
          { id: 'zop-3', name: 'Sheer', value: 20 }
        ],
        material: [
          { id: 'zmat-1', name: 'Polyester' },
          { id: 'zmat-2', name: 'Polyester Blend' }
        ],
        color: [
          { id: 'zcol-1', name: 'Whites & Creams', color: '#FFFFFF' },
          { id: 'zcol-2', name: 'Grays', color: '#808080' },
          { id: 'zcol-3', name: 'Tans & Beiges', color: '#D2B48C' },
          { id: 'zcol-4', name: 'Blacks', color: '#000000' }
        ],
        feature: [
          { id: 'zfeat-1', name: 'Fire Retardant' },
          { id: 'zfeat-2', name: 'UV Resistant' },
          { id: 'zfeat-3', name: 'Moisture Resistant' }
        ],
        pattern: [
          { id: 'pat-1', name: 'Solid' },
          { id: 'pat-2', name: 'Textured' },
          { id: 'pat-3', name: 'Striped' }
        ]
      }
    };
    saveDatabase(db);
  }
  return db;
}

// Get all fabric attributes (both roller and zebra)
app.get('/api/admin/fabric-attributes', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initializeFabricAttributes(db);

    // Count fabrics for each attribute
    const rollerFabrics = db.productContent?.fabrics || [];
    const zebraFabrics = db.zebraFabrics || [];

    const countFabrics = (attrs, fabrics, field) => {
      return attrs.map(attr => ({
        ...attr,
        count: fabrics.filter(f => {
          const value = f[field];
          if (Array.isArray(value)) return value.includes(attr.name) || value.includes(attr.id);
          return value === attr.name || value === attr.id;
        }).length
      }));
    };

    res.json({
      success: true,
      data: {
        roller: db.fabricAttributes.roller,
        zebra: db.fabricAttributes.zebra
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fabric attributes by type (roller or zebra)
app.get('/api/admin/fabric-attributes/:type', authMiddleware, (req, res) => {
  try {
    const { type } = req.params;
    if (!['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }

    let db = loadDatabase();
    db = initializeFabricAttributes(db);

    res.json({ success: true, data: db.fabricAttributes[type] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a fabric attribute
app.post('/api/admin/fabric-attributes', authMiddleware, (req, res) => {
  try {
    const { type, category, name, color, value } = req.body;

    if (!type || !['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }
    if (!category || !name) {
      return res.status(400).json({ success: false, error: 'Category and name are required' });
    }

    let db = loadDatabase();
    db = initializeFabricAttributes(db);

    if (!db.fabricAttributes[type][category]) {
      db.fabricAttributes[type][category] = [];
    }

    const newAttr = {
      id: `${category.substring(0, 3)}-${Date.now()}`,
      name
    };
    if (color) newAttr.color = color;
    if (value !== undefined) newAttr.value = value;

    db.fabricAttributes[type][category].push(newAttr);
    saveDatabase(db);

    res.json({ success: true, data: newAttr });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a fabric attribute
app.put('/api/admin/fabric-attributes/:type/:category/:id', authMiddleware, (req, res) => {
  try {
    const { type, category, id } = req.params;
    const { name, color, value } = req.body;

    if (!['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }

    let db = loadDatabase();
    db = initializeFabricAttributes(db);

    const attrs = db.fabricAttributes[type]?.[category];
    if (!attrs) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const index = attrs.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Attribute not found' });
    }

    if (name) attrs[index].name = name;
    if (color !== undefined) attrs[index].color = color;
    if (value !== undefined) attrs[index].value = value;

    saveDatabase(db);

    res.json({ success: true, data: attrs[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a fabric attribute
app.delete('/api/admin/fabric-attributes/:type/:category/:id', authMiddleware, (req, res) => {
  try {
    const { type, category, id } = req.params;

    if (!['roller', 'zebra'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be roller or zebra' });
    }

    let db = loadDatabase();
    db = initializeFabricAttributes(db);

    const attrs = db.fabricAttributes[type]?.[category];
    if (!attrs) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const index = attrs.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Attribute not found' });
    }

    attrs.splice(index, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Attribute deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Get fabric attributes for frontend filtering
app.get('/api/fabric-attributes', (req, res) => {
  try {
    const db = loadDatabase();
    res.json({
      success: true,
      data: db.fabricAttributes || { roller: {}, zebra: {} }
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

// Helper function to determine product type from order item
function getItemProductType(item) {
  // Check explicit product_type field
  if (item.product_type) return item.product_type.toLowerCase();
  if (item.productType) return item.productType.toLowerCase();

  // Check product_slug
  const slug = (item.product_slug || '').toLowerCase();
  if (slug.includes('zebra')) return 'zebra';
  if (slug.includes('honeycomb') || slug.includes('cellular')) return 'honeycomb';
  if (slug.includes('roman')) return 'roman';
  if (slug.includes('roller')) return 'roller';

  // Check product_name
  const name = (item.product_name || '').toLowerCase();
  if (name.includes('zebra')) return 'zebra';
  if (name.includes('honeycomb') || name.includes('cellular')) return 'honeycomb';
  if (name.includes('roman')) return 'roman';
  if (name.includes('roller')) return 'roller';

  // Check fabric code in configuration
  try {
    const cfg = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : (item.configuration || {});
    if (cfg.productType) return cfg.productType.toLowerCase();
    if (cfg.fabricCode) {
      if (cfg.fabricCode.startsWith('83')) return 'zebra';
      if (cfg.fabricCode.startsWith('82')) return 'roller';
    }
  } catch (e) { /* ignore */ }

  // Check price_breakdown for fabricCode
  if (item.price_breakdown?.fabricCode) {
    if (item.price_breakdown.fabricCode.startsWith('83')) return 'zebra';
    if (item.price_breakdown.fabricCode.startsWith('82')) return 'roller';
  }

  return 'unknown';
}

// Product Analytics - Blinds Type, Control System, Measurements
app.get('/api/admin/analytics/product-insights', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = (db.orders || []).filter(o => o.created_at && !isNaN(new Date(o.created_at).getTime()));
    const products = db.products || [];
    const categories = db.categories || [];

    // Product Type Analytics (Roller, Zebra, Honeycomb, Roman)
    const productTypeStats = {
      roller: { type: 'roller', orders: 0, revenue: 0, items: 0 },
      zebra: { type: 'zebra', orders: 0, revenue: 0, items: 0 },
      honeycomb: { type: 'honeycomb', orders: 0, revenue: 0, items: 0 },
      roman: { type: 'roman', orders: 0, revenue: 0, items: 0 }
    };

    // Blinds Type Analytics (by category)
    const blindsTypeStats = {};
    categories.forEach(cat => {
      blindsTypeStats[cat.slug] = { name: cat.name, orders: 0, revenue: 0, items: 0 };
    });

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
        const revenue = item.line_total || item.lineTotal || item.price || 0;
        const qty = item.quantity || 1;

        // Get configuration
        let config = {};
        if (item.configuration) {
          try {
            config = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : item.configuration;
          } catch (e) {}
        }

        // Product Type Analytics (using helper function)
        const productType = getItemProductType(item);
        if (productTypeStats[productType]) {
          productTypeStats[productType].orders++;
          productTypeStats[productType].revenue += revenue;
          productTypeStats[productType].items += qty;
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
    const productTypesFormatted = Object.values(productTypeStats)
      .filter(pt => pt.orders > 0)
      .map(pt => ({
        ...pt,
        percentage: totalProductTypeOrders > 0 ? Math.round((pt.orders / totalProductTypeOrders) * 100) : 0
      }))
      .sort((a, b) => b.orders - a.orders);

    res.json({
      success: true,
      productTypes: productTypesFormatted,
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

    // Revenue by product type (Roller, Zebra, etc.)
    const productTypeRevenue = {
      roller: { type: 'roller', revenue: 0, orders: 0, mfrCost: 0, profit: 0 },
      zebra: { type: 'zebra', revenue: 0, orders: 0, mfrCost: 0, profit: 0 },
      honeycomb: { type: 'honeycomb', revenue: 0, orders: 0, mfrCost: 0, profit: 0 },
      roman: { type: 'roman', revenue: 0, orders: 0, mfrCost: 0, profit: 0 }
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
        const itemRevenue = item.line_total || item.lineTotal || item.price || 0;
        const itemMfrCost = item.price_breakdown?.manufacturer_total || item.manufacturer_cost || 0;

        // Product category
        const product = (db.products || []).find(p => p.id === (item.productId || item.product_id));
        const category = product?.category_slug || 'other';
        if (!revenueByCategory[category]) {
          revenueByCategory[category] = { name: category, revenue: 0, orders: 0 };
        }
        revenueByCategory[category].revenue += itemRevenue;
        revenueByCategory[category].orders++;

        // Product type (Roller, Zebra, etc.)
        const productType = getItemProductType(item);
        if (productTypeRevenue[productType]) {
          productTypeRevenue[productType].revenue += itemRevenue;
          productTypeRevenue[productType].orders++;
          productTypeRevenue[productType].mfrCost += itemMfrCost;
          productTypeRevenue[productType].profit += (itemRevenue - itemMfrCost);
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

    grossProfit = totalRevenue - totalMfrCost - totalTax;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    // Format product type revenue
    const productTypeRevenueFormatted = Object.values(productTypeRevenue)
      .filter(pt => pt.orders > 0)
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
      revenueByDate: Object.values(revenueByDate).sort((a, b) => a.date.localeCompare(b.date)),
      revenueByCategory: Object.values(revenueByCategory).sort((a, b) => b.revenue - a.revenue),
      productTypeRevenue: productTypeRevenueFormatted,
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

// Backfill missing ledger entries
app.post('/api/admin/ledger/backfill', authMiddleware, (req, res) => {
  try {
    const { backfillOrderPricingAndLedger } = require('./services/ledger-service');
    const results = backfillOrderPricingAndLedger();

    res.json({
      success: true,
      message: `Backfill complete. Updated ${results.ordersUpdated} orders, created ${results.ledgerEntriesCreated} ledger entries.`,
      ...results
    });
  } catch (error) {
    console.error('Error backfilling ledger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Profit report by date range
app.get('/api/admin/reports/profit', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { startDate, endDate, groupBy = 'day' } = req.query;

    let orders = (db.orders || []).filter(o => {
      if (!o.created_at) return false;
      const orderDate = new Date(o.created_at);
      if (startDate && orderDate < new Date(startDate)) return false;
      if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });

    // Calculate profit per order
    const { calculateItemManufacturerCost } = require('./services/ledger-service');
    const orderProfits = orders.map(order => {
      const revenue = order.pricing?.total || order.total || 0;
      const tax = order.pricing?.tax || 0;
      const manufacturerCost = order.items?.reduce((sum, item) => {
        return sum + calculateItemManufacturerCost(item);
      }, 0) || 0;
      const profit = revenue - tax - manufacturerCost;

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        date: order.created_at,
        revenue,
        tax,
        manufacturerCost,
        profit,
        marginPercent: (revenue - tax) > 0 ? (profit / (revenue - tax)) * 100 : 0
      };
    });

    // Group by period
    const grouped = {};
    orderProfits.forEach(op => {
      const date = new Date(op.date);
      let key;
      if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = { period: key, orders: 0, revenue: 0, tax: 0, manufacturerCost: 0, profit: 0 };
      }
      grouped[key].orders++;
      grouped[key].revenue += op.revenue;
      grouped[key].tax += op.tax;
      grouped[key].manufacturerCost += op.manufacturerCost;
      grouped[key].profit += op.profit;
    });

    // Sort by period
    const periods = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));

    // Calculate totals
    const totals = orderProfits.reduce((acc, op) => ({
      orders: acc.orders + 1,
      revenue: acc.revenue + op.revenue,
      tax: acc.tax + op.tax,
      manufacturerCost: acc.manufacturerCost + op.manufacturerCost,
      profit: acc.profit + op.profit
    }), { orders: 0, revenue: 0, tax: 0, manufacturerCost: 0, profit: 0 });

    totals.marginPercent = (totals.revenue - totals.tax) > 0
      ? (totals.profit / (totals.revenue - totals.tax)) * 100
      : 0;

    res.json({
      success: true,
      data: {
        periods,
        totals,
        orderCount: orders.length
      }
    });
  } catch (error) {
    console.error('Error generating profit report:', error);
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
    // BUG-G002: this route is public (print-by-link). Harden it three ways:
    // (1) look up ONLY by the opaque UUID `id` — never the enumerable
    //     invoiceNumber — to kill the IDOR-by-guessing vector (the admin
    //     print page always passes inv.id).
    // (2) serve customer invoices only — manufacturer invoices are payables
    //     full of internal cost data.
    // (3) return a customer-safe, currency-rounded projection that strips
    //     manufacturer cost, margin and internal notes (BUG-G002 leak +
    //     BUG-G003 fractional-cent rounding).
    const db = loadDatabase();
    const invoice = (db.invoices || []).find(i => i.id === req.params.id);
    if (!invoice || invoice.type === invoiceService.INVOICE_TYPE.MANUFACTURER) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const money = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

    const safeItem = (item) => {
      const { pricing, optionsPricing, accessoriesPricing, optionsBreakdown,
        accessoriesBreakdown, ...rest } = item;
      // Customer-safe pricing: drop manufacturerCost / margin* fields
      const safePricing = pricing ? {
        fabricBasePrice: money(pricing.fabricBasePrice),
        optionsTotal: money(pricing.optionsTotal),
        accessoriesTotal: money(pricing.accessoriesTotal),
        unitPrice: money(pricing.unitPrice),
        lineTotal: money(pricing.lineTotal)
      } : pricing;
      const stripMfr = (arr) => (Array.isArray(arr) ? arr.map(o => {
        const { manufacturerCost, ...orest } = o || {};
        return { ...orest, price: money(orest.price) };
      }) : arr);
      const safeOptionsPricing = optionsPricing ? Object.fromEntries(
        Object.entries(optionsPricing).map(([k, v]) => [k, v ? { name: v.name, price: money(v.price) } : v])
      ) : optionsPricing;
      return {
        ...rest,
        unitPrice: money(rest.unitPrice),
        lineTotal: money(rest.lineTotal),
        pricing: safePricing,
        optionsPricing: safeOptionsPricing,
        accessoriesPricing: stripMfr(accessoriesPricing),
        optionsBreakdown: stripMfr(optionsBreakdown),
        accessoriesBreakdown: stripMfr(accessoriesBreakdown)
      };
    };

    const { internalNotes, ...invRest } = invoice;
    const safeInvoice = {
      ...invRest,
      subtotal: money(invoice.subtotal),
      tax: money(invoice.tax),
      shipping: money(invoice.shipping),
      discount: money(invoice.discount),
      total: money(invoice.total),
      amountPaid: money(invoice.amountPaid),
      amountDue: money(invoice.amountDue),
      items: (invoice.items || []).map(safeItem)
    };

    // Return customer-safe invoice data for print view
    res.json({ success: true, data: safeInvoice });
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
    const { productSlug: rawSlug, width, height, quantity = 1, fabricCode, options = {} } = req.body;
    const productSlug = normalizeSlug(rawSlug);

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
    // BUG-F005: the write above went through db-loader; drop server's inline
    // cache so the customer tracking lookup reads the fresh tracking number.
    invalidateServerDbCache();
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

// Note: Admin manufacturers CRUD moved to ADMIN MANUFACTURERS MANAGEMENT section

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

    // Check for duplicate email
    const existingEmail = db.customers.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      return res.status(400).json({ success: false, error: 'Customer with this email already exists' });
    }

    // Check for duplicate phone number (if provided)
    if (phone && phone.trim()) {
      const normalizedPhone = phone.replace(/\D/g, ''); // Remove non-digits for comparison
      const existingPhone = db.customers.find(c => {
        if (!c.phone) return false;
        const custPhone = c.phone.replace(/\D/g, '');
        return custPhone && custPhone === normalizedPhone;
      });
      if (existingPhone) {
        return res.status(400).json({ success: false, error: 'Customer with this phone number already exists' });
      }
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

    // Check for duplicate email (excluding current customer)
    if (email && email.toLowerCase() !== (customer.email || '').toLowerCase()) {
      const existingEmail = db.customers.find(c => c.id !== req.params.id && c.email && c.email.toLowerCase() === email.toLowerCase());
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Another customer with this email already exists' });
      }
    }

    // Check for duplicate phone (excluding current customer)
    if (phone && phone.trim()) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const currentPhone = (customer.phone || '').replace(/\D/g, '');
      if (normalizedPhone !== currentPhone) {
        const existingPhone = db.customers.find(c => {
          if (c.id === req.params.id || !c.phone) return false;
          const custPhone = c.phone.replace(/\D/g, '');
          return custPhone && custPhone === normalizedPhone;
        });
        if (existingPhone) {
          return res.status(400).json({ success: false, error: 'Another customer with this phone number already exists' });
        }
      }
    }

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

// Admin: Get all draft orders
app.get('/api/admin/draft-orders', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const draftOrders = (db.draftOrders || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, draftOrders });
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

// Admin: Get abandoned checkouts
app.get('/api/admin/abandoned-checkouts', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const abandonedCheckouts = (db.abandonedCheckouts || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, abandonedCheckouts });
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

// Admin: Send recovery email for abandoned checkout
app.post('/api/admin/abandoned-checkouts/:id/send-recovery', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkoutIndex = (db.abandonedCheckouts || []).findIndex(c => c.id === req.params.id);
    if (checkoutIndex === -1) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    // Update checkout with recovery email sent status
    db.abandonedCheckouts[checkoutIndex].recoveryEmailSent = true;
    db.abandonedCheckouts[checkoutIndex].recoveryEmailSentAt = new Date().toISOString();
    db.abandonedCheckouts[checkoutIndex].status = 'recovery_sent';
    saveDatabase(db);

    // In production, this would trigger an actual email
    res.json({
      success: true,
      message: 'Recovery email queued for sending',
      checkout: db.abandonedCheckouts[checkoutIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Convert abandoned checkout to draft order
app.post('/api/admin/abandoned-checkouts/:id/convert-to-draft', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkoutIndex = (db.abandonedCheckouts || []).findIndex(c => c.id === req.params.id);
    if (checkoutIndex === -1) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    const checkout = db.abandonedCheckouts[checkoutIndex];

    // Create draft order from abandoned checkout
    const draftOrder = {
      id: 'draft-' + Date.now(),
      customerId: checkout.customerId || null,
      customerEmail: checkout.email,
      customerName: checkout.customerName || '',
      customerPhone: checkout.phone || '',
      items: checkout.items || [],
      subtotal: checkout.subtotal || 0,
      total: checkout.total || 0,
      status: 'draft',
      source: 'abandoned_checkout',
      sourceId: checkout.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!db.draftOrders) db.draftOrders = [];
    db.draftOrders.push(draftOrder);

    // Update checkout status
    db.abandonedCheckouts[checkoutIndex].status = 'converted';
    db.abandonedCheckouts[checkoutIndex].convertedToDraftId = draftOrder.id;
    db.abandonedCheckouts[checkoutIndex].convertedAt = new Date().toISOString();

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Converted to draft order',
      draftOrder: draftOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update abandoned checkout status
app.put('/api/admin/abandoned-checkouts/:id/status', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;
    const db = loadDatabase();
    const checkoutIndex = (db.abandonedCheckouts || []).findIndex(c => c.id === req.params.id);
    if (checkoutIndex === -1) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    db.abandonedCheckouts[checkoutIndex].status = status;
    db.abandonedCheckouts[checkoutIndex].updatedAt = new Date().toISOString();
    saveDatabase(db);

    res.json({
      success: true,
      checkout: db.abandonedCheckouts[checkoutIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Delete abandoned checkout
app.delete('/api/admin/abandoned-checkouts/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const checkoutIndex = (db.abandonedCheckouts || []).findIndex(c => c.id === req.params.id);
    if (checkoutIndex === -1) {
      return res.status(404).json({ success: false, error: 'Abandoned checkout not found' });
    }

    db.abandonedCheckouts.splice(checkoutIndex, 1);
    saveDatabase(db);

    res.json({ success: true, message: 'Abandoned checkout deleted' });
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
    // Display condition (Stage 5.3): motor options only when motorized
    showWhen: { controlType: "motorized" },
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
    // Display condition (Stage 5.3): remote only when motorized
    showWhen: { controlType: "motorized" },
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
    // Display condition (Stage 5.3): solar only when motorized
    showWhen: { controlType: "motorized" },
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
        colors: { primary: '#8E6545', secondary: '#F6F1EB' },
        fonts: { primary: { family: 'Montserrat' } },
        spacing: {},
        borderRadius: {},
        shadows: {}
      };
      saveDatabase(db);
    }
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
// INSTALLERS MANAGEMENT API
// ============================================================================

// Get all installers
app.get('/api/admin/installers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, installers: db.installers || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single installer
app.get('/api/admin/installers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const installer = (db.installers || []).find(i => i.id === req.params.id);
    if (!installer) {
      return res.status(404).json({ success: false, error: 'Installer not found' });
    }
    res.json({ success: true, installer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create installer
app.post('/api/admin/installers', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.installers) db.installers = [];

    const installer = {
      id: `inst-${Date.now()}`,
      companyName: req.body.companyName,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      serviceAreas: req.body.serviceAreas || [],
      zipCodes: req.body.zipCodes || [],
      status: req.body.status || 'active',
      certified: req.body.certified || false,
      rating: 0,
      completedJobs: 0,
      createdAt: new Date().toISOString()
    };

    db.installers.push(installer);
    saveDatabase(db);
    res.json({ success: true, installer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update installer
app.put('/api/admin/installers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.installers || []).findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Installer not found' });
    }

    db.installers[index] = {
      ...db.installers[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    saveDatabase(db);
    res.json({ success: true, installer: db.installers[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete installer
app.delete('/api/admin/installers/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.installers || []).findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Installer not found' });
    }

    db.installers.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Installer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// RETURNS & REFUNDS MANAGEMENT API
// ============================================================================

// Get all returns
app.get('/api/admin/returns', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, returns: db.returns || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single return
app.get('/api/admin/returns/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const returnItem = (db.returns || []).find(r => r.id === req.params.id);
    if (!returnItem) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }
    res.json({ success: true, return: returnItem });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create return request
app.post('/api/admin/returns', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.returns) db.returns = [];

    const returnItem = {
      id: `ret-${Date.now()}`,
      orderId: req.body.orderId,
      orderNumber: req.body.orderNumber,
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerEmail: req.body.customerEmail,
      reason: req.body.reason,
      reasonDetails: req.body.reasonDetails,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      items: req.body.items || [],
      refundAmount: req.body.refundAmount || 0,
      orderTotal: req.body.orderTotal || 0
    };

    db.returns.push(returnItem);
    saveDatabase(db);
    res.json({ success: true, return: returnItem });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update return status
app.put('/api/admin/returns/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.returns || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }

    const previousStatus = db.returns[index].status;
    db.returns[index] = {
      ...db.returns[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // Add status change timestamps
    if (req.body.status === 'approved' && previousStatus !== 'approved') {
      db.returns[index].approvedAt = new Date().toISOString();
    } else if (req.body.status === 'refunded' && previousStatus !== 'refunded') {
      db.returns[index].refundedAt = new Date().toISOString();
    }

    saveDatabase(db);
    res.json({ success: true, return: db.returns[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete return
app.delete('/api/admin/returns/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.returns || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }

    db.returns.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Return deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process refund for a return (with ledger entry and order status update)
app.post('/api/admin/returns/:id/refund', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.returns) db.returns = [];
    if (!db.ledgerEntries) db.ledgerEntries = [];

    const returnIndex = db.returns.findIndex(r => r.id === req.params.id);
    if (returnIndex === -1) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }

    const returnItem = db.returns[returnIndex];

    // Check if already refunded
    if (returnItem.status === 'refunded') {
      return res.status(400).json({ success: false, error: 'Return already refunded' });
    }

    // Check if approved
    if (returnItem.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Return must be approved before processing refund' });
    }

    const now = new Date().toISOString();
    const refundAmount = returnItem.refundAmount || 0;

    // 1. Update return status to refunded
    returnItem.status = 'refunded';
    returnItem.refundedAt = now;
    returnItem.updatedAt = now;

    // 2. Create ledger entry for the refund
    const ledgerEntry = {
      id: `ledger-return-refund-${Date.now()}`,
      type: 'refund_paid',
      orderId: returnItem.orderId,
      orderNumber: returnItem.orderNumber,
      returnId: returnItem.id,
      amount: -Math.abs(refundAmount),
      description: `Refund for return ${returnItem.id} - Order ${returnItem.orderNumber} - ${returnItem.reason || 'Customer return'}`,
      debit: Math.abs(refundAmount),
      credit: null,
      createdAt: now,
      metadata: {
        returnReason: returnItem.reason,
        customerName: returnItem.customerName,
        customerEmail: returnItem.customerEmail
      }
    };
    db.ledgerEntries.push(ledgerEntry);

    // 3. Update order status to 'refunded'
    if (returnItem.orderId) {
      const orderIndex = (db.orders || []).findIndex(o => o.id === returnItem.orderId);
      if (orderIndex !== -1) {
        db.orders[orderIndex].status = 'refunded';
        db.orders[orderIndex].refunded_at = now;
        db.orders[orderIndex].return_id = returnItem.id;
        db.orders[orderIndex].refund_amount = refundAmount;
      }
    }

    // 4. Store ledger entry ID in return record
    returnItem.ledgerEntryId = ledgerEntry.id;
    db.returns[returnIndex] = returnItem;

    saveDatabase(db);

    res.json({
      success: true,
      return: returnItem,
      ledgerEntry,
      message: 'Refund processed, order status updated, and ledger entry created'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// WARRANTY CLAIMS MANAGEMENT API
// ============================================================================

// Get all warranty claims
app.get('/api/admin/warranty-claims', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, warrantyClaims: db.warrantyClaims || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single warranty claim
app.get('/api/admin/warranty-claims/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const claim = (db.warrantyClaims || []).find(c => c.id === req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Warranty claim not found' });
    }
    res.json({ success: true, claim });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUBLIC: Submit warranty claim (customer-facing)
app.post('/api/warranty-claims', async (req, res) => {
  try {
    const { orderNumber, customerName, customerEmail, customerPhone, productDescription, issueDescription, purchaseDate, photos } = req.body;

    // Validate required fields
    if (!customerEmail || !orderNumber || !issueDescription) {
      return res.status(400).json({
        success: false,
        error: 'Email, order number, and issue description are required'
      });
    }

    const db = loadDatabase();
    if (!db.warrantyClaims) db.warrantyClaims = [];

    // Verify order exists (optional validation)
    const order = (db.orders || []).find(o =>
      o.orderNumber === orderNumber || o.order_number === orderNumber || o.id === orderNumber
    );

    const newClaim = {
      id: `WC-${Date.now()}`,
      orderNumber,
      orderId: order?.id || null,
      customerName: customerName || order?.customer_name || '',
      customerEmail,
      customerPhone: customerPhone || '',
      productDescription: productDescription || '',
      issueDescription,
      purchaseDate: purchaseDate || order?.created_at || '',
      photos: photos || [],
      source: 'customer-submission',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.warrantyClaims.push(newClaim);
    saveDatabase(db);

    // Send Slack notification
    notificationService.alertWarrantyClaim(newClaim).catch(err => {
      console.error('Failed to send warranty claim notification:', err.message);
    });

    // Send confirmation email to customer
    try {
      await emailService.send({
        to: customerEmail,
        subject: `Warranty Claim Received - ${newClaim.id}`,
        html: `
          <h2>Warranty Claim Received</h2>
          <p>Thank you for submitting your warranty claim. We've received your request and will review it within 2-3 business days.</p>
          <p><strong>Claim ID:</strong> ${newClaim.id}</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Issue:</strong> ${issueDescription}</p>
          <p>We'll contact you at ${customerEmail} with updates on your claim.</p>
          <p>If you have questions, please reply to this email or call us at (469) 758-8935.</p>
          <br>
          <p>Best regards,<br>Peekaboo Shades Warranty Team</p>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send warranty confirmation email:', emailErr.message);
    }

    res.json({
      success: true,
      claimId: newClaim.id,
      message: 'Warranty claim submitted successfully. You will receive a confirmation email shortly.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get warranty claim status (public - customer can check their claim)
app.get('/api/warranty-claims/:id/status', (req, res) => {
  try {
    const db = loadDatabase();
    const claim = (db.warrantyClaims || []).find(c => c.id === req.params.id);

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Warranty claim not found' });
    }

    // Return limited info for public access
    res.json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
        resolution: claim.resolution || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create warranty claim (admin)
app.post('/api/admin/warranty-claims', authMiddleware, async (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.warrantyClaims) db.warrantyClaims = [];

    const newClaim = {
      id: `WC-${Date.now()}`,
      ...req.body,
      status: req.body.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.warrantyClaims.push(newClaim);
    saveDatabase(db);

    // Send Slack notification for new warranty claim
    notificationService.alertWarrantyClaim(newClaim).catch(err => {
      console.error('Failed to send warranty claim notification:', err.message);
    });

    res.json({ success: true, claim: newClaim });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update warranty claim
app.put('/api/admin/warranty-claims/:id', authMiddleware, async (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.warrantyClaims) db.warrantyClaims = [];

    const index = db.warrantyClaims.findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Warranty claim not found' });
    }

    const previousStatus = db.warrantyClaims[index].status;
    const updatedClaim = {
      ...db.warrantyClaims[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // If status changed to resolved, add resolvedAt timestamp
    if (req.body.status === 'resolved' && db.warrantyClaims[index].status !== 'resolved') {
      updatedClaim.resolvedAt = new Date().toISOString();
    }

    db.warrantyClaims[index] = updatedClaim;
    saveDatabase(db);

    // Send email notification if status changed
    if (req.body.status && req.body.status !== previousStatus && updatedClaim.customerEmail) {
      try {
        await emailService.sendWarrantyUpdate(updatedClaim, {
          name: updatedClaim.customerName,
          email: updatedClaim.customerEmail
        });
        console.log(`Warranty status email sent to ${updatedClaim.customerEmail}`);
      } catch (emailError) {
        console.error('Failed to send warranty status email:', emailError.message);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, claim: updatedClaim });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete warranty claim
app.delete('/api/admin/warranty-claims/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.warrantyClaims || []).findIndex(c => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Warranty claim not found' });
    }

    db.warrantyClaims.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Warranty claim deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SERVICE AREAS MANAGEMENT API
// ============================================================================

// Get all service areas
app.get('/api/admin/service-areas', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, serviceAreas: db.serviceAreas || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create service area
app.post('/api/admin/service-areas', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.serviceAreas) db.serviceAreas = [];

    const newArea = {
      id: `SA-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };

    db.serviceAreas.push(newArea);
    saveDatabase(db);
    res.json({ success: true, serviceArea: newArea });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update service area
app.put('/api/admin/service-areas/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.serviceAreas) db.serviceAreas = [];

    const index = db.serviceAreas.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Service area not found' });
    }

    db.serviceAreas[index] = { ...db.serviceAreas[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, serviceArea: db.serviceAreas[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete service area
app.delete('/api/admin/service-areas/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.serviceAreas || []).findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Service area not found' });
    }

    db.serviceAreas.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Service area deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// REMAKES MANAGEMENT API
// ============================================================================

// Get all remakes
app.get('/api/admin/remakes', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, remakes: db.remakes || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create remake
app.post('/api/admin/remakes', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.remakes) db.remakes = [];

    const newRemake = {
      id: `RMK-${Date.now()}`,
      ...req.body,
      status: req.body.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.remakes.push(newRemake);
    saveDatabase(db);
    res.json({ success: true, remake: newRemake });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update remake
app.put('/api/admin/remakes/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.remakes) db.remakes = [];

    const index = db.remakes.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Remake not found' });
    }

    db.remakes[index] = {
      ...db.remakes[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    saveDatabase(db);
    res.json({ success: true, remake: db.remakes[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete remake
app.delete('/api/admin/remakes/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.remakes || []).findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Remake not found' });
    }

    db.remakes.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Remake deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// INSTALLATION SCHEDULING API
// ============================================================================

// Get all installations
app.get('/api/admin/installations', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, installations: db.installations || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create installation
app.post('/api/admin/installations', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.installations) db.installations = [];

    const newInstallation = {
      id: `INST-${Date.now()}`,
      ...req.body,
      status: req.body.status || 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.installations.push(newInstallation);
    saveDatabase(db);
    res.json({ success: true, installation: newInstallation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update installation
app.put('/api/admin/installations/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.installations) db.installations = [];

    const index = db.installations.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Installation not found' });
    }

    db.installations[index] = {
      ...db.installations[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    saveDatabase(db);
    res.json({ success: true, installation: db.installations[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete installation
app.delete('/api/admin/installations/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.installations || []).findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Installation not found' });
    }

    db.installations.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Installation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// EMAIL TEMPLATES API
// ============================================================================

// Get all email templates
app.get('/api/admin/email-templates', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, templates: db.emailTemplates || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create email template
app.post('/api/admin/email-templates', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.emailTemplates) db.emailTemplates = [];

    const newTemplate = {
      id: `ET-${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.emailTemplates.push(newTemplate);
    saveDatabase(db);
    res.json({ success: true, template: newTemplate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update email template
app.put('/api/admin/email-templates/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.emailTemplates) db.emailTemplates = [];

    const index = db.emailTemplates.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Email template not found' });
    }

    db.emailTemplates[index] = {
      ...db.emailTemplates[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    saveDatabase(db);
    res.json({ success: true, template: db.emailTemplates[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete email template
app.delete('/api/admin/email-templates/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const index = (db.emailTemplates || []).findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Email template not found' });
    }

    db.emailTemplates.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Email template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CUSTOMER REVIEWS API
// ============================================================================

app.get('/api/admin/reviews', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const reviews = db.reviews || [];
    const products = db.products || [];

    // Enrich reviews with product info
    const enrichedReviews = reviews.map(review => {
      const product = products.find(p => p.id === review.productId);
      return {
        ...review,
        productName: product ? product.name : review.product || 'Unknown Product'
      };
    });

    res.json({ success: true, reviews: enrichedReviews });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin can create a review
app.post('/api/admin/reviews', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.reviews) db.reviews = [];

    const { customerName, customerEmail, rating, productId, product, content, status } = req.body;

    if (!customerName || !rating || !content) {
      return res.status(400).json({ success: false, error: 'Customer name, rating, and content are required' });
    }

    const newReview = {
      id: `rev-${Date.now()}`,
      customerName,
      customerEmail: customerEmail || '',
      rating: parseInt(rating),
      productId: productId || null,
      product: product || 'Custom Blinds',
      content,
      status: status || 'approved',
      createdAt: new Date().toISOString()
    };

    db.reviews.push(newReview);
    saveDatabase(db);
    res.json({ success: true, review: newReview });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/reviews/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.reviews) db.reviews = [];
    const index = db.reviews.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    db.reviews[index] = { ...db.reviews[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, review: db.reviews[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/reviews/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.reviews) db.reviews = [];
    const index = db.reviews.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    db.reviews.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public endpoint - get approved/featured reviews for a product (no auth required)
app.get('/api/reviews', (req, res) => {
  try {
    const db = loadDatabase();
    const { productId } = req.query;
    let reviews = (db.reviews || []).filter(r => r.status === 'approved' || r.status === 'featured');

    if (productId) {
      reviews = reviews.filter(r => r.productId === productId);
    }

    // Sort by featured first, then by date
    reviews.sort((a, b) => {
      if (a.status === 'featured' && b.status !== 'featured') return -1;
      if (b.status === 'featured' && a.status !== 'featured') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public endpoint - submit a review (requires verification before approval)
app.post('/api/reviews', (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.reviews) db.reviews = [];

    const { customerName, customerEmail, rating, productId, product, content, orderId } = req.body;

    if (!customerName || !rating || !content) {
      return res.status(400).json({ success: false, error: 'Name, rating, and review content are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    // Verify customer has ordered this product (optional - if orderId provided)
    let verified = false;
    if (orderId) {
      const order = (db.orders || []).find(o =>
        o.id === orderId || o.order_number === orderId
      );
      if (order && order.customer_email && customerEmail &&
          order.customer_email.toLowerCase() === customerEmail.toLowerCase()) {
        verified = true;
      }
    }

    const newReview = {
      id: `rev-${Date.now()}`,
      customerName,
      customerEmail: customerEmail || '',
      rating: parseInt(rating),
      productId: productId || null,
      product: product || 'Custom Blinds',
      content,
      orderId: orderId || null,
      verified,
      status: 'pending', // All public reviews start as pending
      createdAt: new Date().toISOString()
    };

    db.reviews.push(newReview);
    saveDatabase(db);
    res.json({ success: true, review: newReview, message: 'Thank you for your review! It will be visible after approval.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MEASUREMENT REQUESTS API
// ============================================================================

app.get('/api/admin/measurement-requests', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, measurementRequests: db.measurementRequests || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/measurement-requests', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.measurementRequests) db.measurementRequests = [];
    const newRequest = {
      id: `MR-${Date.now()}`,
      ...req.body,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.measurementRequests.push(newRequest);
    saveDatabase(db);
    res.json({ success: true, request: newRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/measurement-requests/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.measurementRequests) db.measurementRequests = [];
    const index = db.measurementRequests.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    db.measurementRequests[index] = { ...db.measurementRequests[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, request: db.measurementRequests[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// REFUNDS API
// ============================================================================

app.get('/api/admin/refunds', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, refunds: db.refunds || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/refunds', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.refunds) db.refunds = [];
    const newRefund = {
      id: `REF-${Date.now()}`,
      ...req.body,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.refunds.push(newRefund);
    saveDatabase(db);
    res.json({ success: true, refund: newRefund });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/refunds/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.refunds) db.refunds = [];
    const index = db.refunds.findIndex(r => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Refund not found' });
    }
    db.refunds[index] = { ...db.refunds[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, refund: db.refunds[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete refund with ledger entry and order status update
app.post('/api/admin/refunds/:id/complete', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.refunds) db.refunds = [];
    if (!db.ledgerEntries) db.ledgerEntries = [];

    const refundIndex = db.refunds.findIndex(r => r.id === req.params.id);
    if (refundIndex === -1) {
      return res.status(404).json({ success: false, error: 'Refund not found' });
    }

    const refund = db.refunds[refundIndex];

    // Check if already completed
    if (refund.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Refund already completed' });
    }

    const now = new Date().toISOString();

    // 1. Update refund status to completed
    refund.status = 'completed';
    refund.completedAt = now;
    refund.updatedAt = now;

    // 2. Create ledger entry for the refund
    const ledgerEntry = {
      id: `ledger-refund-${Date.now()}`,
      type: 'refund_paid',
      orderId: refund.orderId,
      orderNumber: refund.orderNumber,
      refundId: refund.id,
      amount: -Math.abs(refund.amount),
      description: `Refund for order ${refund.orderNumber} - ${refund.reason || 'Customer refund'}`,
      debit: Math.abs(refund.amount),
      credit: null,
      createdAt: now,
      metadata: {
        refundMethod: refund.method,
        reason: refund.reason,
        customerName: refund.customerName,
        customerEmail: refund.customerEmail
      }
    };
    db.ledgerEntries.push(ledgerEntry);

    // 3. Update order status to 'refunded'
    if (refund.orderId) {
      const orderIndex = (db.orders || []).findIndex(o => o.id === refund.orderId);
      if (orderIndex !== -1) {
        db.orders[orderIndex].status = 'refunded';
        db.orders[orderIndex].refunded_at = now;
        db.orders[orderIndex].refund_id = refund.id;
        db.orders[orderIndex].refund_amount = refund.amount;
      }
    }

    // 4. Store ledger entry ID in refund record
    refund.ledgerEntryId = ledgerEntry.id;
    db.refunds[refundIndex] = refund;

    saveDatabase(db);

    res.json({
      success: true,
      refund,
      ledgerEntry,
      message: 'Refund completed, order status updated, and ledger entry created'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CUSTOMER GROUPS API
// ============================================================================

app.get('/api/admin/customer-groups', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const groups = db.customerGroups || [];
    const customers = db.customers || [];
    const orders = db.orders || [];

    // Calculate members and totalSpent for each group based on customer groupId or type
    const enrichedGroups = groups.map(group => {
      // Find customers that belong to this group (by groupId or by type match)
      const groupMembers = customers.filter(c =>
        c.groupId === group.id ||
        (c.type && c.type.toLowerCase() === group.type.toLowerCase())
      );

      // Calculate total spent from orders by these customers
      const memberIds = groupMembers.map(c => c.id);
      const memberOrders = orders.filter(o => memberIds.includes(o.customerId));
      const totalSpent = memberOrders.reduce((sum, o) => {
        const orderTotal = o.total || (o.pricing ? o.pricing.total : 0) || 0;
        return sum + orderTotal;
      }, 0);

      return {
        ...group,
        members: groupMembers.length,
        totalSpent: Math.round(totalSpent * 100) / 100
      };
    });

    res.json({ success: true, customerGroups: enrichedGroups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/customer-groups', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.customerGroups) db.customerGroups = [];
    const newGroup = {
      id: `grp-${Date.now()}`,
      ...req.body,
      members: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString()
    };
    db.customerGroups.push(newGroup);
    saveDatabase(db);
    res.json({ success: true, group: newGroup });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/customer-groups/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.customerGroups) db.customerGroups = [];
    const index = db.customerGroups.findIndex(g => g.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    db.customerGroups[index] = { ...db.customerGroups[index], ...req.body, updatedAt: new Date().toISOString() };
    saveDatabase(db);
    res.json({ success: true, group: db.customerGroups[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/customer-groups/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.customerGroups) db.customerGroups = [];
    const index = db.customerGroups.findIndex(g => g.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    // Remove groupId from customers that were in this group
    const groupId = db.customerGroups[index].id;
    (db.customers || []).forEach(c => {
      if (c.groupId === groupId) {
        delete c.groupId;
      }
    });

    db.customerGroups.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get members of a customer group
app.get('/api/admin/customer-groups/:id/members', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const groups = db.customerGroups || [];
    const group = groups.find(g => g.id === req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const customers = db.customers || [];
    const orders = db.orders || [];

    // Find customers that belong to this group (by groupId or by type match)
    const groupMembers = customers.filter(c =>
      c.groupId === group.id ||
      (c.type && c.type.toLowerCase() === group.type.toLowerCase())
    );

    // Enrich with order data
    const membersWithStats = groupMembers.map(member => {
      const memberOrders = orders.filter(o => o.customerId === member.id);
      const totalSpent = memberOrders.reduce((sum, o) => sum + (o.total || (o.pricing ? o.pricing.total : 0) || 0), 0);
      return {
        ...member,
        totalOrders: memberOrders.length,
        totalSpent: Math.round(totalSpent * 100) / 100
      };
    });

    res.json({ success: true, group, members: membersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// TRACKING API
// ============================================================================

app.get('/api/admin/tracking', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    res.json({ success: true, shipments: db.shipments || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/tracking', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.shipments) db.shipments = [];
    const newShipment = {
      id: `ship-${Date.now()}`,
      ...req.body,
      timeline: [{ date: new Date().toISOString(), status: 'Label Created', location: 'Warehouse' }],
      createdAt: new Date().toISOString()
    };
    db.shipments.push(newShipment);
    saveDatabase(db);
    res.json({ success: true, shipment: newShipment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/tracking/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    if (!db.shipments) db.shipments = [];
    const index = db.shipments.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Shipment not found' });
    }
    db.shipments[index] = { ...db.shipments[index], ...req.body };
    saveDatabase(db);
    res.json({ success: true, shipment: db.shipments[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
 * Update payment configuration
 */
app.put('/api/admin/system-config/payment', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const previousConfig = db.systemConfig?.payment;

    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.payment = { ...db.systemConfig.payment, ...req.body };

    saveDatabase(db);
    systemConfig.invalidateCache();

    // Log but mask sensitive keys
    const sanitizedConfig = JSON.parse(JSON.stringify(db.systemConfig.payment));
    if (sanitizedConfig.providers) {
      sanitizedConfig.providers = sanitizedConfig.providers.map(p => ({
        ...p,
        apiKey: p.apiKey ? '***' + p.apiKey.slice(-4) : '',
        secretKey: p.secretKey ? '***' + p.secretKey.slice(-4) : ''
      }));
    }
    auditLogger.logConfigChange('payment', previousConfig ? '(previous config)' : null, sanitizedConfig, req.admin, req);

    res.json({ success: true, message: 'Payment configuration updated', data: db.systemConfig.payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EMAIL SERVICE ENDPOINTS
// ============================================

/**
 * Get email service status
 */
app.get('/api/admin/email/status', authMiddleware, (req, res) => {
  try {
    const status = emailService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Send test email
 */
app.post('/api/admin/email/test', authMiddleware, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Email address required' });
    }

    const result = await emailService.send({
      to,
      subject: 'Test Email from Peekaboo Shades',
      html: `
        <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #8E6545; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Test Email</h1>
          </div>
          <div style="padding: 30px; background: #f8f6f3;">
            <p>This is a test email from Peekaboo Shades.</p>
            <p>If you received this email, your email configuration is working correctly!</p>
            <p style="margin-top: 20px; color: #666; font-size: 12px;">
              Sent at: ${new Date().toISOString()}<br>
              Provider: ${emailService.getStatus().provider}
            </p>
          </div>
        </div>
      `
    });

    res.json({ success: result.success, message: result.success ? 'Test email sent' : result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NOTIFICATION SERVICE ENDPOINTS (Slack/Webhooks)
// ============================================

/**
 * Get notification service status
 */
app.get('/api/admin/notifications/status', authMiddleware, (req, res) => {
  try {
    const status = notificationService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Send test Slack notification
 */
app.post('/api/admin/notifications/test-slack', authMiddleware, async (req, res) => {
  try {
    const result = await notificationService.sendSlack({
      text: 'Test notification from Peekaboo Shades Admin',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔔 Test Notification', emoji: true }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'This is a test notification from Peekaboo Shades. If you see this, Slack integration is working!' }
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Sent by: ${req.admin?.email || 'Admin'} at ${new Date().toLocaleString()}` }
          ]
        }
      ]
    });

    res.json({
      success: result.success,
      message: result.success ? 'Test notification sent to Slack' : (result.reason || result.error)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get notification logs
 */
app.get('/api/admin/notifications/logs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const logs = db.notificationLogs || [];
    const limit = parseInt(req.query.limit) || 50;
    res.json({
      success: true,
      data: logs.slice(-limit).reverse(),
      total: logs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SMS SERVICE ENDPOINTS (Twilio)
// ============================================

/**
 * Get SMS service status
 */
app.get('/api/admin/sms/status', authMiddleware, (req, res) => {
  try {
    const status = smsService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Send test SMS
 */
app.post('/api/admin/sms/test', authMiddleware, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    const result = await smsService.send(
      to,
      `Test SMS from Peekaboo Shades Admin. Sent at ${new Date().toLocaleString()}`
    );

    res.json({
      success: result.success,
      message: result.success ? 'Test SMS sent' : result.error
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get SMS logs
 */
app.get('/api/admin/sms/logs', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const logs = db.smsLogs || [];
    const limit = parseInt(req.query.limit) || 50;
    res.json({
      success: true,
      data: logs.slice(-limit).reverse(),
      total: logs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SHIPPING SERVICE ENDPOINTS
// ============================================

/**
 * Get shipping service status
 */
app.get('/api/admin/shipping/status', authMiddleware, (req, res) => {
  try {
    const status = shippingService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all carriers
 */
app.get('/api/admin/shipping/carriers', authMiddleware, (req, res) => {
  try {
    const carriers = shippingService.getCarriers();
    res.json({ success: true, data: carriers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Detect carrier from tracking number
 */
app.post('/api/admin/shipping/detect-carrier', authMiddleware, (req, res) => {
  try {
    const { trackingNumber } = req.body;
    const carrier = shippingService.detectCarrier(trackingNumber);
    const trackingUrl = shippingService.getTrackingUrl(trackingNumber, carrier);
    res.json({
      success: true,
      data: {
        carrier,
        carrierName: carrier ? shippingService.carriers[carrier]?.name : null,
        trackingUrl
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create shipment
 */
app.post('/api/admin/shipping/shipments', authMiddleware, (req, res) => {
  try {
    const shipment = shippingService.createShipment(req.body);
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get shipment by ID
 */
app.get('/api/admin/shipping/shipments/:id', authMiddleware, (req, res) => {
  try {
    const shipment = shippingService.getShipment(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, error: 'Shipment not found' });
    }
    const events = shippingService.getTrackingEvents(req.params.id);
    res.json({ success: true, data: { ...shipment, events } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update shipment
 */
app.put('/api/admin/shipping/shipments/:id', authMiddleware, (req, res) => {
  try {
    const shipment = shippingService.updateShipment(req.params.id, req.body);
    if (!shipment) {
      return res.status(404).json({ success: false, error: 'Shipment not found' });
    }
    res.json({ success: true, data: shipment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get shipments for an order
 */
app.get('/api/admin/shipping/orders/:orderId/shipments', authMiddleware, (req, res) => {
  try {
    const shipments = shippingService.getOrderShipments(req.params.orderId);
    res.json({ success: true, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add tracking event
 */
app.post('/api/admin/shipping/shipments/:id/events', authMiddleware, (req, res) => {
  try {
    const event = shippingService.addTrackingEvent(req.params.id, req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Simulate tracking update (for demo)
 */
app.post('/api/admin/shipping/shipments/:id/simulate', authMiddleware, (req, res) => {
  try {
    const event = shippingService.simulateTrackingUpdate(req.params.id);
    if (!event) {
      return res.status(400).json({ success: false, error: 'No more updates available or shipment not found' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Estimate shipping cost
 */
app.post('/api/admin/shipping/estimate', authMiddleware, (req, res) => {
  try {
    const { weight, dimensions, destination } = req.body;
    const estimate = shippingService.estimateShippingCost(weight, dimensions, destination);
    res.json({ success: true, data: estimate });
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
 * Export audit logs as JSON or CSV
 * GET /api/admin/audit-logs/export
 */
app.get('/api/admin/audit-logs/export', authMiddleware, (req, res) => {
  try {
    const { format = 'json', startDate, endDate, action, severity } = req.query;

    const logs = auditLogger.query({
      action,
      startDate,
      endDate,
      severity,
      limit: 10000 // Max export limit
    });

    if (format === 'csv') {
      // Generate CSV
      const headers = ['timestamp', 'action', 'severity', 'userId', 'userName', 'resourceType', 'resourceId', 'ipAddress', 'details'];
      const csvRows = [headers.join(',')];

      for (const log of logs) {
        const row = [
          log.timestamp,
          log.action,
          log.severity,
          log.userId || '',
          (log.userName || '').replace(/,/g, ';'),
          log.resourceType || '',
          log.resourceId || '',
          log.ipAddress || '',
          JSON.stringify(log.details || {}).replace(/,/g, ';').replace(/"/g, "'")
        ];
        csvRows.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({
        exportDate: new Date().toISOString(),
        totalRecords: logs.length,
        filters: { startDate, endDate, action, severity },
        logs
      });
    }

    // Log the export action
    auditLogger.log({
      action: 'AUDIT_LOG_EXPORT',
      severity: 'info',
      userId: req.admin?.id,
      userName: req.admin?.name,
      details: { format, recordCount: logs.length, filters: { startDate, endDate, action, severity } }
    }, req);

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

// ============================================
// SAVED QUOTES - SAVE FOR LATER FEATURE
// ============================================

// Stage 8.2 (BUG-AC001): saved quotes are per-customer *account* data and MUST be
// owner-scoped. These helpers are function declarations (hoisted) because the
// canonical `customerAuthMiddleware` const is defined later in the file (~17197),
// after these routes register. Verify a customer JWT and, per quote, confirm the
// authenticated customer owns it before any read/mutation by id or email.
function requireCustomerAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    if (decoded.type !== 'customer') {
      return res.status(403).json({ success: false, error: 'Invalid token type' });
    }
    req.customer = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// True only when the saved quote belongs to the authenticated customer
// (match by customerId or, failing that, case-insensitive customerEmail).
function customerOwnsQuote(quote, customer) {
  if (!quote || !customer) return false;
  if (quote.customerId && customer.id && quote.customerId === customer.id) return true;
  if (quote.customerEmail && customer.email &&
      quote.customerEmail.toLowerCase() === customer.email.toLowerCase()) return true;
  return false;
}

/**
 * Save a quote for later (public - no auth required)
 */
app.post('/api/quotes/save', async (req, res) => {
  try {
    const savedQuote = savedQuotesService.saveQuote(req.body);

    // Send email if customer email provided
    if (savedQuote.customerEmail) {
      const shareUrl = `${req.protocol}://${req.get('host')}/quote/${savedQuote.shareCode}`;
      try {
        await emailService.send({
          to: savedQuote.customerEmail,
          subject: 'Your Saved Quote from Peekaboo Shades',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8E6545;">Your Quote Has Been Saved!</h2>
              <p>Hi ${savedQuote.customerName || 'there'},</p>
              <p>Your quote "${savedQuote.name}" has been saved. You can access it anytime using the link below:</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${shareUrl}" style="background: #8E6545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Quote</a>
              </p>
              <p><strong>Share Code:</strong> ${savedQuote.shareCode}</p>
              <p><strong>Expires:</strong> ${new Date(savedQuote.expiresAt).toLocaleDateString()}</p>
              <p>Have questions? Reply to this email or call us at +1 929-465-9549.</p>
              <p style="color: #666; margin-top: 30px;">Best regards,<br>Peekaboo Shades Team</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send quote email:', emailError.message);
      }
    }

    res.json({
      success: true,
      quote: savedQuote,
      shareUrl: `/quote/${savedQuote.shareCode}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get quote by share code (public)
 */
app.get('/api/quotes/share/:shareCode', (req, res) => {
  try {
    const quote = savedQuotesService.getQuoteByShareCode(req.params.shareCode);

    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found or has expired'
      });
    }

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get quotes by email (customer can retrieve their quotes)
 */
app.get('/api/quotes/my-quotes', requireCustomerAuth, (req, res) => {
  try {
    // Owner-scoped: use the authenticated customer's email from the token, never
    // a client-supplied ?email= (which allowed reading anyone's saved quotes).
    const quotes = savedQuotesService.getQuotesByEmail(req.customer.email);
    res.json({ success: true, quotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update saved quote (add/remove items)
 */
app.put('/api/quotes/:id', requireCustomerAuth, (req, res) => {
  try {
    const existing = savedQuotesService.getQuoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    if (!customerOwnsQuote(existing, req.customer)) {
      return res.status(403).json({ success: false, error: 'Forbidden: not your quote' });
    }
    // Strip identity/capability/status fields so an update cannot reassign
    // ownership, forge the shareCode, or flip status (BUG-AC001 hardening).
    const { id, customerId, customerEmail, shareCode, status, createdAt, ...safe } = req.body;
    const quote = savedQuotesService.updateQuote(req.params.id, safe);

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Extend quote expiration
 */
app.post('/api/quotes/:id/extend', requireCustomerAuth, (req, res) => {
  try {
    const existing = savedQuotesService.getQuoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    if (!customerOwnsQuote(existing, req.customer)) {
      return res.status(403).json({ success: false, error: 'Forbidden: not your quote' });
    }
    const { additionalDays = 30 } = req.body;
    const quote = savedQuotesService.extendExpiration(req.params.id, additionalDays);

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Convert quote to cart/order
 */
app.post('/api/quotes/:id/convert', requireCustomerAuth, (req, res) => {
  try {
    const quote = savedQuotesService.getQuoteById(req.params.id);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    if (!customerOwnsQuote(quote, req.customer)) {
      return res.status(403).json({ success: false, error: 'Forbidden: not your quote' });
    }

    // Return quote items for adding to cart
    res.json({
      success: true,
      items: quote.items,
      subtotal: quote.subtotal,
      quoteId: quote.id,
      message: 'Quote items ready to add to cart'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete saved quote
 */
app.delete('/api/quotes/:id', requireCustomerAuth, (req, res) => {
  try {
    const existing = savedQuotesService.getQuoteById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }
    if (!customerOwnsQuote(existing, req.customer)) {
      return res.status(403).json({ success: false, error: 'Forbidden: not your quote' });
    }
    const quote = savedQuotesService.deleteQuote(req.params.id);

    res.json({ success: true, message: 'Quote deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SAVED QUOTES - ADMIN ENDPOINTS
// ============================================

/**
 * Get all saved quotes (admin)
 */
app.get('/api/admin/saved-quotes', authMiddleware, (req, res) => {
  try {
    const result = savedQuotesService.getAllQuotes(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get saved quotes statistics (admin)
 */
app.get('/api/admin/saved-quotes/stats', authMiddleware, (req, res) => {
  try {
    const stats = savedQuotesService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cleanup expired quotes (admin)
 */
app.post('/api/admin/saved-quotes/cleanup', authMiddleware, (req, res) => {
  try {
    const result = savedQuotesService.cleanupExpired();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get single quote details (admin)
 */
app.get('/api/admin/saved-quotes/:id', authMiddleware, (req, res) => {
  try {
    const quote = savedQuotesService.getQuoteById(req.params.id);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update quote (admin)
 */
app.put('/api/admin/saved-quotes/:id', authMiddleware, (req, res) => {
  try {
    const quote = savedQuotesService.updateQuote(req.params.id, req.body);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mark quote as converted (admin)
 */
app.post('/api/admin/saved-quotes/:id/convert', authMiddleware, (req, res) => {
  try {
    const { orderId } = req.body;
    const quote = savedQuotesService.convertToOrder(req.params.id, orderId);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    res.json({ success: true, quote });
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
// AI ASSISTANT (ADMIN COPILOT)
// ============================================
const aiConversations = new Map(); // Store conversation history

// Demo responses for AI Assistant when no API key
const DEMO_RESPONSES = {
  orders: `**Orders Overview**

You can manage orders at /admin/orders.html

Order statuses flow:
ORDER_PLACED → ORDER_RECEIVED → MANUFACTURING → QA → SHIPPED → DELIVERED

Click any order to view full details including items, pricing, and customer info.`,

  invoices: `**Invoices Overview**

Invoices are auto-generated when orders are placed.

Go to /admin/invoices.html to:
- Filter by status (Pending, Sent, Paid)
- Filter by shade type (Roller/Zebra)
- View and print invoice details`,

  pricing: `**Pricing Management**

Fabric pricing pages:
- **Roller**: /admin/product-pricing.html (161 fabrics)
- **Zebra**: /admin/zebra-pricing.html (208 fabrics)

Pricing formula:
- Base = Fabric $/m² × Area (min 1.5 m²)
- Roller margin: ~40%
- Zebra margin: ~45%`,

  customers: `**Customer Management**

View customers at /admin/customers.html

Each profile shows:
- Contact info
- Order history
- Total spend`,

  help: `**Admin Copilot Help**

I can help with:
- **Orders**: Status, details, pipeline
- **Invoices**: Payments, generating
- **Pricing**: Fabric costs, margins
- **Customers**: Info, history
- **Products**: Setup, configuration

Ask me anything!`
};

function getDemoResponse(message, dbContext) {
  const msg = message.toLowerCase();

  if (msg.includes('order') && (msg.includes('today') || msg.includes('statistic') || msg.includes('status') || msg.includes('how many') || msg.includes('show'))) {
    return `**Current Order Statistics**

- Total Orders: **${dbContext.totalOrders}**
- Pending Orders: **${dbContext.pendingOrders}**
- Recent: ${dbContext.recentOrders.map(o => o.id).join(', ') || 'None'}

View all at /admin/orders.html`;
  }

  if (msg.includes('invoice') && (msg.includes('pending') || msg.includes('unpaid') || msg.includes('show'))) {
    return `**Invoice Status**

- Total Invoices: **${dbContext.totalInvoices}**
- Unpaid: **${dbContext.unpaidInvoices}**

Manage at /admin/invoices.html`;
  }

  if (msg.includes('order')) return DEMO_RESPONSES.orders;
  if (msg.includes('invoice')) return DEMO_RESPONSES.invoices;
  if (msg.includes('price') || msg.includes('pricing') || msg.includes('cost') || msg.includes('margin')) return DEMO_RESPONSES.pricing;
  if (msg.includes('customer')) return DEMO_RESPONSES.customers;
  if (msg.includes('help') || msg.includes('what can') || msg.includes('hi') || msg.includes('hello')) return DEMO_RESPONSES.help;

  return `I can help you with the admin portal!

**Quick Stats:**
- Orders: ${dbContext.totalOrders}
- Invoices: ${dbContext.totalInvoices}
- Customers: ${dbContext.totalCustomers}
- Roller Fabrics: ${dbContext.rollerFabrics}
- Zebra Fabrics: ${dbContext.zebraFabrics}

Ask about orders, invoices, pricing, or customers!`;
}

// System prompt for Admin Copilot
const ADMIN_COPILOT_SYSTEM_PROMPT = `You are PeekabooShades Admin Copilot — an evidence-based SME assistant for the PeekabooShades admin dashboard.

## CORE RULES

1) **Evidence-only**: Every answer must be grounded in real data from tools. Use get_orders, get_invoices, get_customers, get_analytics, get_fabric_price, get_dashboard_stats to fetch real data before answering.

2) **No breaking changes**: Do NOT propose renaming APIs, changing data structures, or modifying business logic without explicit approval.

3) **Permission gate**: For any changes (update_order_status, update_fabric_price, create_promotion), explain what will happen and ask for confirmation before executing.

4) **SME scope**: Explain admin pages, buttons, endpoints, and data flows clearly.

5) **QA mode**: When asked about bugs, provide reproduction steps, expected vs actual, and likely failure points.

## DATABASE (JSON file - database.json)
- orders: Customer orders with items, pricing, status
- invoices: Auto-generated from orders
- customers: Customer profiles
- products: 5 products (Roller, Zebra shades)
- manufacturerPrices: 161 roller fabric prices
- zebraManufacturerPrices: 208 zebra fabric prices
- motorBrands: AOK, Dooya motors
- faqs, pages, blogPosts, settings, security, audit_logs

## PRODUCT TYPES
- Roller Shades: fabric codes 82xxx, ~40% margin
- Zebra Shades: fabric codes 83xxx, ~45% margin

## ORDER FLOW
ORDER_PLACED → ORDER_RECEIVED → MANUFACTURING → QA → SHIPPED → DELIVERED

## ALL ADMIN PAGES

### Core Business
- /admin/ - Dashboard with order pipeline DAG, stats
- /admin/orders.html - Order list, status updates, Order Details modal
- /admin/invoices.html - Invoice tracking, payments, print
- /admin/quotes.html - Quote requests
- /admin/customers.html - Customer list & profiles
- /admin/draft-orders.html - Incomplete orders
- /admin/abandoned-checkouts.html - Recovery opportunities

### Products & Pricing
- /admin/products.html - Product catalog
- /admin/product-pricing.html - Roller fabric pricing (161 fabrics)
- /admin/zebra-pricing.html - Zebra fabric pricing (208 fabrics)
- /admin/fabrics.html - Fabric categories
- /admin/hardware-options.html - Roller motors/hardware
- /admin/zebra-hardware.html - Zebra motors/hardware
- /admin/accessories.html - Smart Hub, USB Charger, etc
- /admin/categories.html - Product categories

### Content Management
- /admin/pages.html - Static pages (About, Contact, etc)
- /admin/faqs.html - FAQ management
- /admin/blog/posts.html - Blog posts
- /admin/media-library.html - Images & files

### Online Store
- /admin/online-store/homepage.html - Homepage settings
- /admin/online-store/banners.html - Promotional banners
- /admin/online-store/navigation.html - Menu structure
- /admin/online-store/themes.html - Theme selection
- /admin/theme-settings.html - Colors & fonts

### Marketing
- /admin/marketing/campaigns.html - Email campaigns
- /admin/marketing/promotions.html - Discount codes
- /admin/marketing/subscribers.html - Email list
- /admin/marketing/social.html - Social posts

### Security
- /admin/security/users.html - Admin users
- /admin/security/permissions.html - Role-based access
- /admin/security/audit-logs.html - Activity tracking
- /admin/security/sessions.html - Active sessions
- /admin/security/firewall.html - IP blocking
- /admin/security/api-security.html - API keys

### System
- /admin/analytics.html - Sales analytics
- /admin/settings.html - General settings
- /admin/system-config.html - System configuration

## RESPONSE FORMAT
1. **What you asked**: Restate the question
2. **Evidence found**: Use tools to get real data
3. **Explanation**: Clear answer with business context
4. **Where to change it**: Exact pages/endpoints if applicable
5. **How to test it**: QA steps if relevant

## CAPABILITIES
You can:
- Fetch real data (orders, invoices, customers, analytics, prices)
- Update order statuses (with permission)
- Update fabric prices (with permission)
- Create promotions (with permission)
- Explain any admin page or feature
- Help debug issues with step-by-step guidance

Always fetch real data using tools before answering questions about counts, statuses, or specific records.`;

// AI Copilot Tools for performing actions
const AI_TOOLS = [
  {
    name: 'get_orders',
    description: 'Get orders from database with optional filters',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: ORDER_PLACED, ORDER_RECEIVED, MANUFACTURING, QA, SHIPPED, DELIVERED' },
        limit: { type: 'number', description: 'Max number of orders to return (default 10)' }
      }
    }
  },
  {
    name: 'get_order_details',
    description: 'Get full details of a specific order',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID or order number' }
      },
      required: ['order_id']
    }
  },
  {
    name: 'update_order_status',
    description: 'Update the status of an order',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Order ID or order number' },
        new_status: { type: 'string', description: 'New status: ORDER_RECEIVED, MANUFACTURING, QA, SHIPPED, DELIVERED' }
      },
      required: ['order_id', 'new_status']
    }
  },
  {
    name: 'get_invoices',
    description: 'Get invoices with optional filters',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, sent, paid' },
        limit: { type: 'number', description: 'Max number of invoices to return' }
      }
    }
  },
  {
    name: 'get_customers',
    description: 'Get customer list',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max customers to return' }
      }
    }
  },
  {
    name: 'get_fabric_price',
    description: 'Get price for a specific fabric code',
    input_schema: {
      type: 'object',
      properties: {
        fabric_code: { type: 'string', description: 'Fabric code like 82032B or 83001A' }
      },
      required: ['fabric_code']
    }
  },
  {
    name: 'update_fabric_price',
    description: 'Update the price of a fabric',
    input_schema: {
      type: 'object',
      properties: {
        fabric_code: { type: 'string', description: 'Fabric code' },
        new_price: { type: 'number', description: 'New price per square meter' }
      },
      required: ['fabric_code', 'new_price']
    }
  },
  {
    name: 'get_analytics',
    description: 'Get analytics summary (sales, revenue, etc)',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Time period: today, week, month, all' }
      }
    }
  },
  {
    name: 'create_promotion',
    description: 'Create a new promotion/discount code',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Promotion code' },
        discount_percent: { type: 'number', description: 'Discount percentage (e.g. 10 for 10%)' },
        description: { type: 'string', description: 'Description of the promotion' }
      },
      required: ['code', 'discount_percent']
    }
  },
  {
    name: 'get_dashboard_stats',
    description: 'Get overall dashboard statistics',
    input_schema: {
      type: 'object',
      properties: {}
    }
  }
];

// Execute AI tool calls
function executeAITool(toolName, toolInput) {
  const db = loadDatabase();

  switch (toolName) {
    case 'get_orders': {
      let orders = db.orders || [];
      if (toolInput.status) {
        orders = orders.filter(o => o.status === toolInput.status);
      }
      orders = orders.slice(-(toolInput.limit || 10));
      return orders.map(o => ({
        order_number: o.order_number || o.id,
        status: o.status,
        total: o.order_total || o.total,
        customer: o.customer?.name || o.customer?.email,
        date: o.created_at,
        items: o.items?.length || 0
      }));
    }

    case 'get_order_details': {
      const order = db.orders?.find(o => o.order_number === toolInput.order_id || o.id === toolInput.order_id);
      if (!order) return { error: 'Order not found' };
      return order;
    }

    case 'update_order_status': {
      const orderIndex = db.orders?.findIndex(o => o.order_number === toolInput.order_id || o.id === toolInput.order_id);
      if (orderIndex === -1) return { error: 'Order not found' };

      const validStatuses = ['ORDER_RECEIVED', 'MANUFACTURING', 'QA', 'SHIPPED', 'DELIVERED'];
      if (!validStatuses.includes(toolInput.new_status)) {
        return { error: 'Invalid status. Use: ' + validStatuses.join(', ') };
      }

      db.orders[orderIndex].status = toolInput.new_status;
      db.orders[orderIndex].updated_at = new Date().toISOString();
      saveDatabase(db);
      return { success: true, message: `Order ${toolInput.order_id} updated to ${toolInput.new_status}` };
    }

    case 'get_invoices': {
      let invoices = db.invoices || [];
      if (toolInput.status) {
        invoices = invoices.filter(i => i.status === toolInput.status);
      }
      invoices = invoices.slice(-(toolInput.limit || 10));
      return invoices.map(i => ({
        invoice_number: i.invoiceNumber,
        order: i.orderId,
        status: i.status,
        total: i.totals?.grandTotal || i.total,
        date: i.createdAt
      }));
    }

    case 'get_customers': {
      const customers = (db.customers || []).slice(-(toolInput.limit || 20));
      return customers.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        orders: c.orderCount || 0,
        totalSpent: c.totalSpent || 0
      }));
    }

    case 'get_fabric_price': {
      const code = toolInput.fabric_code;
      const allPrices = db.manufacturerPrices || [];
      const fabric = allPrices.find(f => f.fabricCode === code);
      if (!fabric) return { error: 'Fabric not found' };
      return { fabricCode: code, pricePerSqMeter: fabric.pricePerSqMeter, type: fabric.productType || 'roller' };
    }

    case 'update_fabric_price': {
      const code = toolInput.fabric_code;
      const fabricIndex = (db.manufacturerPrices || []).findIndex(f => f.fabricCode === code);
      if (fabricIndex === -1) return { error: 'Fabric not found' };

      db.manufacturerPrices[fabricIndex].pricePerSqMeter = toolInput.new_price;
      saveDatabase(db);
      return { success: true, message: `Fabric ${code} price updated to $${toolInput.new_price}/m²` };
    }

    case 'get_analytics': {
      const orders = db.orders || [];
      const totalRevenue = orders.reduce((sum, o) => sum + (o.order_total || o.total || 0), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalOrders,
        totalRevenue: totalRevenue.toFixed(2),
        avgOrderValue: avgOrderValue.toFixed(2),
        byStatus: {
          placed: orders.filter(o => o.status === 'ORDER_PLACED').length,
          manufacturing: orders.filter(o => o.status === 'MANUFACTURING').length,
          shipped: orders.filter(o => o.status === 'SHIPPED').length,
          delivered: orders.filter(o => o.status === 'DELIVERED').length
        }
      };
    }

    case 'create_promotion': {
      if (!db.promotions) db.promotions = [];
      const promo = {
        id: uuidv4(),
        code: toolInput.code.toUpperCase(),
        discountPercent: toolInput.discount_percent,
        description: toolInput.description || '',
        active: true,
        createdAt: new Date().toISOString()
      };
      db.promotions.push(promo);
      saveDatabase(db);
      return { success: true, message: `Promotion ${promo.code} created with ${promo.discountPercent}% discount` };
    }

    case 'get_dashboard_stats': {
      return {
        orders: db.orders?.length || 0,
        pendingOrders: db.orders?.filter(o => ['ORDER_PLACED', 'ORDER_RECEIVED'].includes(o.status)).length || 0,
        invoices: db.invoices?.length || 0,
        unpaidInvoices: db.invoices?.filter(i => i.status !== 'paid').length || 0,
        customers: db.customers?.length || 0,
        totalFabrics: db.manufacturerPrices?.length || 0,
        rollerFabrics: db.manufacturerPrices?.filter(p => p.productType === 'roller').length || 0,
        zebraFabrics: db.manufacturerPrices?.filter(p => p.productType === 'zebra').length || 0,
        products: db.products?.length || 0
      };
    }

    default:
      return { error: 'Unknown tool' };
  }
}

app.post('/api/admin/ai-chat', authMiddleware, async (req, res) => {
  try {
    const { message, conversationId, currentPage, context } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Get database stats for context
    const db = loadDatabase();
    const dbContext = {
      totalOrders: db.orders?.length || 0,
      pendingOrders: db.orders?.filter(o => o.status === 'ORDER_PLACED' || o.status === 'ORDER_RECEIVED').length || 0,
      totalInvoices: db.invoices?.length || 0,
      unpaidInvoices: db.invoices?.filter(i => i.status === 'pending' || i.status === 'sent').length || 0,
      totalCustomers: db.customers?.length || 0,
      totalFabrics: db.manufacturerPrices?.length || 0,
      rollerFabrics: db.manufacturerPrices?.filter(p => p.productType === 'roller').length || 0,
      zebraFabrics: db.manufacturerPrices?.filter(p => p.productType === 'zebra').length || 0,
      recentOrders: (db.orders || []).slice(-5).map(o => ({
        id: o.order_number || o.id,
        status: o.status,
        total: o.order_total || o.total
      }))
    };

    // Check for API key - use demo mode if not set
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const demoResponse = getDemoResponse(message, dbContext);
      return res.json({
        success: true,
        response: demoResponse,
        conversationId: conversationId || uuidv4(),
        demo: true
      });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({ apiKey });

    // Get or create conversation
    let convId = conversationId || uuidv4();
    let conversation = aiConversations.get(convId) || [];

    // Build context message
    const contextMessage = `
Current page: ${currentPage || 'Unknown'}
Database stats: ${JSON.stringify(dbContext, null, 2)}
`;

    // Add user message to conversation
    conversation.push({
      role: 'user',
      content: message
    });

    // Keep conversation history reasonable
    if (conversation.length > 20) {
      conversation = conversation.slice(-20);
    }

    // Call Claude API with tools
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: ADMIN_COPILOT_SYSTEM_PROMPT + '\n\n## Current Context\n' + contextMessage + '\n\nYou have tools to get real data and perform actions. Use them when the user asks for specific data or wants to make changes.',
      tools: AI_TOOLS,
      messages: conversation
    });

    // Process tool calls if any
    let finalResponse = '';
    let toolResults = [];

    while (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(c => c.type === 'tool_use');
      if (toolUseBlock) {
        const toolResult = executeAITool(toolUseBlock.name, toolUseBlock.input);
        toolResults.push({ tool: toolUseBlock.name, result: toolResult });

        // Add assistant message with tool use
        conversation.push({
          role: 'assistant',
          content: response.content
        });

        // Add tool result
        conversation.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult)
          }]
        });

        // Continue conversation
        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: ADMIN_COPILOT_SYSTEM_PROMPT + '\n\n## Current Context\n' + contextMessage,
          tools: AI_TOOLS,
          messages: conversation
        });
      } else {
        break;
      }
    }

    // Extract final text response
    const textBlock = response.content.find(c => c.type === 'text');
    finalResponse = textBlock ? textBlock.text : 'Action completed.';

    // Add assistant response to conversation
    conversation.push({
      role: 'assistant',
      content: finalResponse
    });

    // Store updated conversation
    aiConversations.set(convId, conversation);

    // Clean up old conversations (keep for 1 hour)
    setTimeout(() => {
      if (aiConversations.has(convId)) {
        aiConversations.delete(convId);
      }
    }, 3600000);

    res.json({
      success: true,
      response: finalResponse,
      conversationId: convId,
      actions: toolResults.length > 0 ? toolResults : undefined
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process AI request'
    });
  }
});

// ============================================
// CUSTOMER AUTHENTICATION APIs
// ============================================

// Customer Registration
app.post('/api/customer/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, newsletter, source } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'First name, last name, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address'
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    const db = loadDatabase();

    // Check if email already exists in customers
    const existingCustomer = db.customers?.find(c => c.email?.toLowerCase() === email.toLowerCase());
    if (existingCustomer && existingCustomer.password) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email already exists. Please log in instead.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or update customer
    const customerId = existingCustomer?.id || `cust-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const customerData = {
      id: customerId,
      email: email.toLowerCase(),
      firstName,
      lastName,
      phone: phone || '',
      password: hashedPassword,
      type: 'retail',
      companyName: '',
      addresses: [],
      tags: ['website-signup'],
      notes: source ? `Signed up via ${source}` : 'Signed up via website',
      totalOrders: existingCustomer?.totalOrders || 0,
      totalSpent: existingCustomer?.totalSpent || 0,
      totalSavings: 0,
      rewardPoints: 100, // Welcome bonus
      newsletter: newsletter !== false,
      createdAt: existingCustomer?.createdAt || now,
      lastLoginAt: now,
      updatedAt: now
    };

    // Update or add customer
    if (existingCustomer) {
      const index = db.customers.findIndex(c => c.id === customerId);
      db.customers[index] = { ...existingCustomer, ...customerData };
    } else {
      if (!db.customers) db.customers = [];
      db.customers.push(customerData);
    }

    saveDatabase(db);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: customerId,
        email: customerData.email,
        firstName: customerData.firstName,
        type: 'customer'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return customer data (without password)
    const { password: _, ...safeCustomerData } = customerData;

    res.json({
      success: true,
      token,
      customer: safeCustomerData,
      message: 'Account created successfully! Welcome to Peekaboo Shades.'
    });

  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account. Please try again.'
    });
  }
});

// Customer Login
app.post('/api/customer/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const db = loadDatabase();

    // Find customer by email
    const customer = db.customers?.find(c => c.email?.toLowerCase() === email.toLowerCase());

    // Uniform response to avoid account enumeration (BUG-AC002): unknown email
    // and wrong password return the same message; a dummy bcrypt compare keeps
    // response timing even when the account is absent (kills the timing oracle).
    const DUMMY_HASH = '$2b$10$/knOS6J/5jh3sQvXl/hoOexlhtSLt08Ic3AYyuvSQJY4.v6wA8rgK';
    if (!customer) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!customer.password) {
      return res.status(401).json({
        success: false,
        error: 'This account was created through checkout. Please click "Forgot Password" to set a password.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, customer.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    customer.lastLoginAt = new Date().toISOString();
    saveDatabase(db);

    // Generate JWT token
    const tokenExpiry = remember ? '30d' : '24h';
    const token = jwt.sign(
      {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        type: 'customer'
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    // Return customer data (without password)
    const { password: _, ...safeCustomerData } = customer;

    res.json({
      success: true,
      token,
      customer: safeCustomerData
    });

  } catch (error) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

// Customer Auth Middleware
const customerAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'customer') {
      return res.status(403).json({ success: false, error: 'Invalid token type' });
    }

    req.customer = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

// Verify Customer Token
app.get('/api/customer/verify', customerAuthMiddleware, (req, res) => {
  res.json({ success: true, customer: req.customer });
});

// Get Customer Account
app.get('/api/customer/account', customerAuthMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customer = db.customers?.find(c => c.id === req.customer.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get customer orders
    const orders = (db.orders || []).filter(o =>
      o.customer_email?.toLowerCase() === customer.email?.toLowerCase()
    );

    // Calculate stats
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Update customer stats
    customer.totalOrders = totalOrders;
    customer.totalSpent = totalSpent;

    // Return customer data (without password)
    const { password: _, ...safeCustomerData } = customer;

    res.json({
      success: true,
      customer: safeCustomerData
    });
  } catch (error) {
    console.error('Get customer account error:', error);
    res.status(500).json({ success: false, error: 'Failed to load account' });
  }
});

// BUG-H003 (stage-15): strip internal economics (manufacturer cost + margin +
// internal notes) from any object before it is returned on a customer-facing
// surface. Deep, key-name based so nested item price_snapshots are covered
// regardless of shape (blueprint §15.1 "margin is internal … customers never see it").
const INTERNAL_ECON_KEY = /^margin|manufacturer.?cost|manufacturer_price|internalNotes/i;
function stripInternalEconomics(value) {
  if (Array.isArray(value)) return value.map(stripInternalEconomics);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (INTERNAL_ECON_KEY.test(k)) continue;
      out[k] = stripInternalEconomics(v);
    }
    return out;
  }
  return value;
}

// Get Customer Orders
app.get('/api/customer/orders', customerAuthMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customer = db.customers?.find(c => c.id === req.customer.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Get customer orders — projected to strip internal cost/margin (BUG-H003)
    const orders = (db.orders || [])
      .filter(o => o.customer_email?.toLowerCase() === customer.email?.toLowerCase())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(stripInternalEconomics);

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to load orders' });
  }
});

// Update Customer Profile
app.put('/api/customer/profile', customerAuthMiddleware, (req, res) => {
  try {
    const { firstName, lastName, email, phone, newsletter } = req.body;
    const db = loadDatabase();

    const customerIndex = db.customers?.findIndex(c => c.id === req.customer.id);
    if (customerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Check if email is being changed to one that already exists
    if (email && email.toLowerCase() !== db.customers[customerIndex].email?.toLowerCase()) {
      const emailExists = db.customers.some(c =>
        c.id !== req.customer.id && c.email?.toLowerCase() === email.toLowerCase()
      );
      if (emailExists) {
        return res.status(400).json({ success: false, error: 'Email already in use' });
      }
    }

    // Update customer
    db.customers[customerIndex] = {
      ...db.customers[customerIndex],
      firstName: firstName || db.customers[customerIndex].firstName,
      lastName: lastName || db.customers[customerIndex].lastName,
      email: email?.toLowerCase() || db.customers[customerIndex].email,
      phone: phone !== undefined ? phone : db.customers[customerIndex].phone,
      newsletter: newsletter !== undefined ? newsletter : db.customers[customerIndex].newsletter,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);

    const { password: _, ...safeCustomerData } = db.customers[customerIndex];

    res.json({
      success: true,
      customer: safeCustomerData,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// Change Customer Password
app.post('/api/customer/change-password', customerAuthMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long'
      });
    }

    const db = loadDatabase();
    const customerIndex = db.customers?.findIndex(c => c.id === req.customer.id);

    if (customerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const customer = db.customers[customerIndex];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, customer.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.customers[customerIndex].password = hashedPassword;
    db.customers[customerIndex].updatedAt = new Date().toISOString();

    saveDatabase(db);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// Customer Addresses
app.get('/api/customer/addresses', customerAuthMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const customer = db.customers?.find(c => c.id === req.customer.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({
      success: true,
      addresses: customer.addresses || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load addresses' });
  }
});

app.post('/api/customer/addresses', customerAuthMiddleware, (req, res) => {
  try {
    const { type, firstName, lastName, address1, address2, city, state, zip, country, phone, isDefault } = req.body;
    const db = loadDatabase();

    const customerIndex = db.customers?.findIndex(c => c.id === req.customer.id);
    if (customerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    if (!db.customers[customerIndex].addresses) {
      db.customers[customerIndex].addresses = [];
    }

    // If this is default, remove default from others
    if (isDefault) {
      db.customers[customerIndex].addresses.forEach(a => a.default = false);
    }

    const newAddress = {
      id: `addr-${uuidv4().slice(0, 8)}`,
      type: type || 'shipping',
      default: isDefault || db.customers[customerIndex].addresses.length === 0,
      firstName,
      lastName,
      address1,
      address2: address2 || '',
      city,
      state,
      zip,
      country: country || 'US',
      phone: phone || ''
    };

    db.customers[customerIndex].addresses.push(newAddress);
    saveDatabase(db);

    res.json({
      success: true,
      address: newAddress,
      message: 'Address added successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add address' });
  }
});

// ============================================
// TECHNICIAN PORTAL API
// ============================================

// Initialize technicians in database
function initTechnicians(db) {
  if (!db.technicians) db.technicians = [];
  if (!db.appointments) db.appointments = [];
  if (!db.installationPayments) db.installationPayments = [];
  return db;
}

// Technician Authentication Middleware
const technicianAuthMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Technician authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'technician') {
      return res.status(403).json({ success: false, error: 'Technician access required' });
    }
    // BUG-I004: re-validate the technician still exists and is active on every
    // request. JWTs live 7 days; without this a deactivated or deleted technician
    // keeps full portal access (assigned jobs incl. customer PII) until expiry.
    const db = loadDatabase();
    const technician = (db.technicians || []).find(t => t.id === decoded.id);
    if (!technician) {
      return res.status(401).json({ success: false, error: 'Technician account no longer exists' });
    }
    if (technician.status && technician.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Technician account is not active' });
    }
    req.technician = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

// ---- ADMIN: Technician Management ----

// Get all technicians (Admin)
app.get('/api/admin/technicians', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);

    const techniciansWithStats = db.technicians.map(tech => {
      const completedAppointments = db.appointments.filter(a =>
        a.technicianId === tech.id && a.status === 'completed'
      );
      const totalRevenue = completedAppointments.reduce((sum, a) => sum + (a.installationFee || 0), 0);
      const pendingAppointments = db.appointments.filter(a =>
        a.technicianId === tech.id && ['scheduled', 'confirmed'].includes(a.status)
      ).length;

      return {
        ...tech,
        password: undefined,
        completedJobs: completedAppointments.length,
        totalRevenue,
        pendingJobs: pendingAppointments
      };
    });

    res.json({ success: true, technicians: techniciansWithStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single technician (Admin)
app.get('/api/admin/technicians/:id', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const technician = db.technicians.find(t => t.id === req.params.id);
    if (!technician) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }
    res.json({ success: true, technician: { ...technician, password: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create technician (Admin)
app.post('/api/admin/technicians', authMiddleware, async (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { name, email, phone, specialties, serviceAreas, status, notes } = req.body;

    if (db.technicians.some(t => t.email === email)) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const tempPassword = `Tech${Date.now().toString().slice(-6)}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newTechnician = {
      id: `tech-${uuidv4().slice(0, 8)}`,
      name,
      email,
      phone: phone || '',
      password: hashedPassword,
      specialties: specialties || [],
      serviceAreas: serviceAreas || [],
      status: status || 'pending',
      notes: notes || '',
      availability: [],
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.technicians.push(newTechnician);
    saveDatabase(db);

    res.json({
      success: true,
      technician: { ...newTechnician, password: undefined },
      tempPassword
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update technician (Admin)
app.put('/api/admin/technicians/:id', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const index = db.technicians.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }

    const { name, email, phone, specialties, serviceAreas, status, notes } = req.body;
    db.technicians[index] = {
      ...db.technicians[index],
      name: name || db.technicians[index].name,
      email: email || db.technicians[index].email,
      phone: phone !== undefined ? phone : db.technicians[index].phone,
      specialties: specialties || db.technicians[index].specialties,
      serviceAreas: serviceAreas || db.technicians[index].serviceAreas,
      status: status || db.technicians[index].status,
      notes: notes !== undefined ? notes : db.technicians[index].notes,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, technician: { ...db.technicians[index], password: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete technician (Admin)
app.delete('/api/admin/technicians/:id', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const index = db.technicians.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }
    db.technicians.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Technician deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- ADMIN: Appointments Management ----

// Get all appointments (Admin)
app.get('/api/admin/appointments', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { status, technicianId, startDate, endDate } = req.query;
    let appointments = db.appointments || [];

    if (status) appointments = appointments.filter(a => a.status === status);
    if (technicianId) appointments = appointments.filter(a => a.technicianId === technicianId);
    if (startDate) appointments = appointments.filter(a => new Date(a.scheduledDate) >= new Date(startDate));
    if (endDate) appointments = appointments.filter(a => new Date(a.scheduledDate) <= new Date(endDate));

    const enriched = appointments.map(apt => {
      const order = db.orders?.find(o => o.id === apt.orderId);
      const technician = db.technicians?.find(t => t.id === apt.technicianId);
      const customer = db.customers?.find(c => c.id === apt.customerId);
      return {
        ...apt,
        order: order ? { id: order.id, total: order.totals?.total, status: order.status } : null,
        technician: technician ? { id: technician.id, name: technician.name, phone: technician.phone } : null,
        customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}`, phone: customer.phone, email: customer.email } : null
      };
    });

    res.json({ success: true, appointments: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create appointment (Admin)
app.post('/api/admin/appointments', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { orderId, technicianId, customerId, scheduledDate, scheduledTime, installationAddress, notes, installationFee, appointmentType, customerName, customerPhone, customerEmail, issueDescription } = req.body;

    // For repairs without order, orderId can be null
    let order = null;
    if (orderId) {
      order = db.orders?.find(o => o.id === orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
    }

    // Validate appointment type
    const validTypes = ['new-installation', 'repair', 'maintenance', 'consultation', 'other'];
    const type = validTypes.includes(appointmentType) ? appointmentType : 'new-installation';

    const newAppointment = {
      id: `apt-${uuidv4().slice(0, 8)}`,
      appointmentType: type,
      orderId: orderId || null,
      technicianId,
      customerId: customerId || order?.customer_id || null,
      customerName: customerName || (order?.customer ? `${order.customer.firstName} ${order.customer.lastName}` : ''),
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      scheduledDate,
      scheduledTime,
      installationAddress: installationAddress || order?.shipping || {},
      issueDescription: issueDescription || '',
      notes: notes || '',
      installationFee: parseFloat(installationFee) || 0,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.appointments.push(newAppointment);

    // Link to order if exists
    if (orderId) {
      const orderIndex = db.orders.findIndex(o => o.id === orderId);
      if (orderIndex >= 0) {
        db.orders[orderIndex].appointmentId = newAppointment.id;
        db.orders[orderIndex].installationScheduled = true;
      }
    }

    // BUG-I003: queue a scheduling notification (notification-send). Previously
    // assigning/scheduling an installer emitted nothing to the customer.
    const scheduleTo = newAppointment.customerEmail || order?.customer_email || null;
    if (scheduleTo) {
      if (!db.emailLogs) db.emailLogs = [];
      db.emailLogs.push({
        id: 'email-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        type: 'appointment_scheduled_notification',
        to: scheduleTo,
        appointmentId: newAppointment.id,
        orderId: newAppointment.orderId,
        subject: `Your installation is scheduled for ${scheduledDate} ${scheduledTime}`,
        status: 'queued',
        createdAt: new Date().toISOString(),
        source: 'admin_appointment_create'
      });
    }

    saveDatabase(db);
    res.json({ success: true, appointment: newAppointment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update appointment (Admin)
app.put('/api/admin/appointments/:id', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const index = db.appointments.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const { status, scheduledDate, scheduledTime, technicianId, notes, installationFee, appointmentType, issueDescription, customerName, customerPhone, customerEmail, installationAddress } = req.body;
    db.appointments[index] = {
      ...db.appointments[index],
      status: status || db.appointments[index].status,
      appointmentType: appointmentType || db.appointments[index].appointmentType,
      scheduledDate: scheduledDate || db.appointments[index].scheduledDate,
      scheduledTime: scheduledTime || db.appointments[index].scheduledTime,
      technicianId: technicianId || db.appointments[index].technicianId,
      customerName: customerName !== undefined ? customerName : db.appointments[index].customerName,
      customerPhone: customerPhone !== undefined ? customerPhone : db.appointments[index].customerPhone,
      customerEmail: customerEmail !== undefined ? customerEmail : db.appointments[index].customerEmail,
      installationAddress: installationAddress || db.appointments[index].installationAddress,
      issueDescription: issueDescription !== undefined ? issueDescription : db.appointments[index].issueDescription,
      notes: notes !== undefined ? notes : db.appointments[index].notes,
      installationFee: installationFee !== undefined ? parseFloat(installationFee) : db.appointments[index].installationFee,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, appointment: db.appointments[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete appointment (Admin)
app.delete('/api/admin/appointments/:id', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const index = db.appointments.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const appointment = db.appointments[index];
    const orderIndex = db.orders?.findIndex(o => o.id === appointment.orderId);
    if (orderIndex >= 0) {
      delete db.orders[orderIndex].appointmentId;
      db.orders[orderIndex].installationScheduled = false;
    }

    db.appointments.splice(index, 1);
    saveDatabase(db);
    res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- ADMIN: Installation Payments ----

app.get('/api/admin/installation-payments', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const payments = db.installationPayments || [];

    const enriched = payments.map(p => {
      const order = db.orders?.find(o => o.id === p.orderId);
      const technician = db.technicians?.find(t => t.id === p.technicianId);
      return {
        ...p,
        order: order ? { id: order.id, total: order.totals?.total } : null,
        technician: technician ? { id: technician.id, name: technician.name } : null
      };
    });

    res.json({ success: true, payments: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/installation-payments', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { orderId, appointmentId, technicianId, amount, paymentMethod, notes } = req.body;

    const newPayment = {
      id: `ipay-${uuidv4().slice(0, 8)}`,
      orderId,
      appointmentId,
      technicianId,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'cash',
      notes: notes || '',
      recordedAt: new Date().toISOString()
    };

    db.installationPayments.push(newPayment);

    const orderIndex = db.orders?.findIndex(o => o.id === orderId);
    if (orderIndex >= 0) {
      if (!db.orders[orderIndex].extraExpenses) {
        db.orders[orderIndex].extraExpenses = [];
      }
      db.orders[orderIndex].extraExpenses.push({
        type: 'installation_payment',
        description: `Installation fee (${paymentMethod})`,
        amount: parseFloat(amount),
        paymentId: newPayment.id,
        date: newPayment.recordedAt
      });

      const totalExtras = db.orders[orderIndex].extraExpenses.reduce((sum, e) => sum + e.amount, 0);
      db.orders[orderIndex].totals = {
        ...db.orders[orderIndex].totals,
        extraExpenses: totalExtras,
        grandTotal: (db.orders[orderIndex].totals?.total || 0) + totalExtras
      };
    }

    saveDatabase(db);
    res.json({ success: true, payment: newPayment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- TECHNICIAN PORTAL APIs ----

// Technician Signup
app.post('/api/technician/signup', async (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { name, email, password, phone, specialties, serviceAreas } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    if (db.technicians.some(t => t.email === email)) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newTechnician = {
      id: `tech-${uuidv4().slice(0, 8)}`,
      name,
      email,
      phone: phone || '',
      password: hashedPassword,
      specialties: specialties || [],
      serviceAreas: serviceAreas || [],
      status: 'pending',
      availability: [],
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.technicians.push(newTechnician);
    saveDatabase(db);

    res.json({
      success: true,
      message: 'Registration successful. Please wait for admin approval.',
      technician: { ...newTechnician, password: undefined }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Technician Login
app.post('/api/technician/login', async (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { email, password } = req.body;

    const technician = db.technicians.find(t => t.email === email);
    if (!technician) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, technician.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (technician.status === 'pending') {
      return res.status(403).json({ success: false, error: 'Your account is pending approval' });
    }
    if (technician.status === 'inactive') {
      return res.status(403).json({ success: false, error: 'Your account has been deactivated' });
    }

    const token = jwt.sign(
      { id: technician.id, email: technician.email, role: 'technician' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      technician: { ...technician, password: undefined }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify technician token
app.get('/api/technician/verify', technicianAuthMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const technician = db.technicians?.find(t => t.id === req.technician.id);
    if (!technician) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }
    res.json({ success: true, technician: { ...technician, password: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Technician Dashboard
app.get('/api/technician/dashboard', technicianAuthMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);

    const techId = req.technician.id;
    const today = new Date().toISOString().split('T')[0];

    const myAppointments = db.appointments.filter(a => a.technicianId === techId);
    const todayAppointments = myAppointments.filter(a => a.scheduledDate === today);
    const upcomingAppointments = myAppointments.filter(a =>
      new Date(a.scheduledDate) >= new Date(today) && ['scheduled', 'confirmed'].includes(a.status)
    ).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    const completedJobs = myAppointments.filter(a => a.status === 'completed');
    const totalEarnings = completedJobs.reduce((sum, a) => sum + (a.installationFee || 0), 0);

    const technician = db.technicians.find(t => t.id === techId);

    res.json({
      success: true,
      stats: {
        todayAppointments: todayAppointments.length,
        upcomingAppointments: upcomingAppointments.length,
        completedJobs: completedJobs.length,
        totalEarnings,
        rating: technician?.rating || 0,
        reviewCount: technician?.reviewCount || 0
      },
      todaySchedule: todayAppointments,
      upcoming: upcomingAppointments.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get technician's appointments
app.get('/api/technician/appointments', technicianAuthMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { status, startDate, endDate } = req.query;
    let appointments = db.appointments.filter(a => a.technicianId === req.technician.id);

    if (status) appointments = appointments.filter(a => a.status === status);
    if (startDate) appointments = appointments.filter(a => new Date(a.scheduledDate) >= new Date(startDate));
    if (endDate) appointments = appointments.filter(a => new Date(a.scheduledDate) <= new Date(endDate));

    const enriched = appointments.map(apt => {
      const order = db.orders?.find(o => o.id === apt.orderId);
      const customer = db.customers?.find(c => c.id === apt.customerId);
      return {
        ...apt,
        order: order ? {
          id: order.id,
          items: order.items,
          total: order.totals?.total,
          trackingNumber: order.trackingNumber
        } : null,
        customer: customer ? {
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone,
          email: customer.email
        } : null
      };
    }).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    res.json({ success: true, appointments: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update appointment status (Technician)
app.put('/api/technician/appointments/:id/status', technicianAuthMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);

    const appointment = db.appointments.find(a => a.id === req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }
    if (appointment.technicianId !== req.technician.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { status, completionNotes, photos, afterPhotos, beforePhotos, signature, checklist } = req.body;

    // BUG-I005: validate the appointment status against the allowed state set
    // (order-status-sync requires transition validation; previously any string —
    // e.g. "banana" — was accepted and persisted, corrupting dashboard buckets).
    const ALLOWED_APPT_STATUS = ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'];
    if (!status || !ALLOWED_APPT_STATUS.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status', allowedStatuses: ALLOWED_APPT_STATUS });
    }

    const index = db.appointments.findIndex(a => a.id === req.params.id);
    const existing = db.appointments[index];
    const isCompleting = status === 'completed';
    const completedAt = isCompleting ? new Date().toISOString() : existing.completedAt;

    // BUG-I002: persist the full installation record (before/after photos,
    // signature, completion checklist) instead of silently dropping them.
    db.appointments[index] = {
      ...existing,
      status,
      completionNotes: completionNotes !== undefined ? completionNotes : existing.completionNotes,
      completionPhotos: (afterPhotos || photos) || existing.completionPhotos,
      beforePhotos: beforePhotos || existing.beforePhotos,
      signature: signature !== undefined ? signature : existing.signature,
      checklist: checklist || existing.checklist,
      completedAt,
      updatedAt: new Date().toISOString()
    };

    // BUG-I001: on first transition to completed, propagate to the linked order
    // (order-status-sync): record installation completion + customer acceptance
    // and queue an installation-complete notification (notification-send).
    if (isCompleting && existing.status !== 'completed' && existing.orderId) {
      const orderIndex = db.orders?.findIndex(o => o.id === existing.orderId);
      if (orderIndex >= 0) {
        const order = db.orders[orderIndex];
        order.installationStatus = 'completed';
        order.installationComplete = true;
        order.installationCompletedAt = completedAt;
        order.customerAcceptance = {
          accepted: !!signature,
          signature: signature || null,
          acceptedAt: completedAt,
          appointmentId: existing.id,
          technicianId: req.technician.id
        };
        if (!order.status_history) order.status_history = [];
        order.status_history.push({
          status: 'installation_completed',
          note: `Installation completed by technician ${req.technician.id}`,
          timestamp: completedAt,
          source: 'technician_portal'
        });
        order.updated_at = new Date().toISOString();

        if (!db.emailLogs) db.emailLogs = [];
        db.emailLogs.push({
          id: 'email-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          type: 'installation_complete_notification',
          to: order.customer_email || existing.customerEmail || null,
          orderId: order.id,
          orderNumber: order.order_number,
          appointmentId: existing.id,
          subject: `Your installation for order ${order.order_number || order.id} is complete`,
          status: 'queued',
          createdAt: new Date().toISOString(),
          source: 'technician_status_update'
        });
      }
    }

    saveDatabase(db);
    res.json({ success: true, appointment: db.appointments[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Technician Availability
app.get('/api/technician/availability', technicianAuthMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const technician = db.technicians?.find(t => t.id === req.technician.id);
    if (!technician) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }
    res.json({ success: true, availability: technician.availability || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/technician/availability', technicianAuthMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { availability } = req.body;

    const index = db.technicians.findIndex(t => t.id === req.technician.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }

    db.technicians[index].availability = availability;
    db.technicians[index].updatedAt = new Date().toISOString();

    saveDatabase(db);
    res.json({ success: true, availability: db.technicians[index].availability });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record payment (Technician)
app.post('/api/technician/record-payment', technicianAuthMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { appointmentId, amount, paymentMethod, notes } = req.body;

    const appointment = db.appointments.find(a => a.id === appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }
    if (appointment.technicianId !== req.technician.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const newPayment = {
      id: `ipay-${uuidv4().slice(0, 8)}`,
      orderId: appointment.orderId,
      appointmentId,
      technicianId: req.technician.id,
      amount: parseFloat(amount),
      paymentMethod: paymentMethod || 'cash',
      notes: notes || '',
      recordedAt: new Date().toISOString()
    };

    db.installationPayments.push(newPayment);

    const orderIndex = db.orders?.findIndex(o => o.id === appointment.orderId);
    if (orderIndex >= 0) {
      if (!db.orders[orderIndex].extraExpenses) {
        db.orders[orderIndex].extraExpenses = [];
      }
      db.orders[orderIndex].extraExpenses.push({
        type: 'installation_payment',
        description: `Installation fee (${paymentMethod}) - Collected by technician`,
        amount: parseFloat(amount),
        paymentId: newPayment.id,
        date: newPayment.recordedAt
      });
    }

    saveDatabase(db);
    res.json({ success: true, payment: newPayment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update technician profile
app.put('/api/technician/profile', technicianAuthMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const index = db.technicians.findIndex(t => t.id === req.technician.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }

    const { name, phone, specialties, serviceAreas } = req.body;
    db.technicians[index] = {
      ...db.technicians[index],
      name: name || db.technicians[index].name,
      phone: phone !== undefined ? phone : db.technicians[index].phone,
      specialties: specialties || db.technicians[index].specialties,
      serviceAreas: serviceAreas || db.technicians[index].serviceAreas,
      updatedAt: new Date().toISOString()
    };

    saveDatabase(db);
    res.json({ success: true, technician: { ...db.technicians[index], password: undefined } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change technician password
app.put('/api/technician/password', technicianAuthMiddleware, async (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { currentPassword, newPassword } = req.body;

    const index = db.technicians.findIndex(t => t.id === req.technician.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Technician not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, db.technicians[index].password);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }

    db.technicians[index].password = await bcrypt.hash(newPassword, 10);
    db.technicians[index].updatedAt = new Date().toISOString();

    saveDatabase(db);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Orders ready for installation
app.get('/api/admin/orders/ready-for-installation', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const orders = db.orders?.filter(o =>
      ['shipped', 'delivered'].includes(o.status) && !o.installationScheduled
    ) || [];

    const enriched = orders.map(order => {
      const customer = db.customers?.find(c => c.id === order.customer_id);
      return {
        ...order,
        customer: customer ? {
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone,
          email: customer.email
        } : null
      };
    });

    res.json({ success: true, orders: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Available technicians for a date
app.get('/api/admin/technicians/available', authMiddleware, (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);
    const { date, timeSlot } = req.query;

    const availableTechnicians = db.technicians.filter(t => {
      if (t.status !== 'active') return false;
      const dateAvail = t.availability?.find(a => a.date === date);
      if (!dateAvail) return true;
      if (timeSlot && dateAvail.slots) {
        return dateAvail.slots.includes(timeSlot);
      }
      return dateAvail.slots?.length > 0;
    });

    res.json({ success: true, technicians: availableTechnicians.map(t => ({ ...t, password: undefined })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CUSTOMER APPOINTMENT BOOKING (PUBLIC)
// ============================================

// Get available technicians for customer booking (Public - no auth required)
app.get('/api/technicians/available', (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);

    // Only return active technicians with their availability
    const availableTechnicians = db.technicians.filter(t => t.status === 'active');

    // Return minimal info for customers
    const technicianData = availableTechnicians.map(t => ({
      id: t.id,
      name: t.name,
      specialties: t.specialties || [],
      serviceAreas: t.serviceAreas || [],
      availability: t.availability || []
    }));

    res.json({ success: true, technicians: technicianData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Customer appointment booking (Public)
app.post('/api/appointments/book', (req, res) => {
  try {
    let db = loadDatabase();
    db = initTechnicians(db);

    const {
      appointmentType,
      scheduledDate,
      scheduledTime,
      customerName,
      customerEmail,
      customerPhone,
      installationAddress,
      orderId,
      notes,
      source
    } = req.body;

    // Validate required fields
    if (!appointmentType || !scheduledDate || !scheduledTime || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appointmentType, scheduledDate, scheduledTime, customerName, customerEmail, customerPhone'
      });
    }

    // Validate appointment type
    const validTypes = ['new-installation', 'repair', 'maintenance', 'consultation', 'other'];
    if (!validTypes.includes(appointmentType)) {
      return res.status(400).json({ success: false, error: 'Invalid appointment type' });
    }

    // Find an available technician for the requested time slot
    const availableTechnicians = db.technicians.filter(t => {
      if (t.status !== 'active') return false;
      const dateAvail = t.availability?.find(a => a.date === scheduledDate);
      if (!dateAvail) return false;
      return dateAvail.slots?.includes(scheduledTime);
    });

    // Auto-assign first available technician (or leave unassigned for admin to assign)
    const assignedTechnician = availableTechnicians.length > 0 ? availableTechnicians[0] : null;

    // If order ID provided, validate it exists
    let order = null;
    if (orderId) {
      order = db.orders?.find(o => o.id === orderId || o.orderNumber === orderId);
    }

    const newAppointment = {
      id: `apt-${uuidv4().slice(0, 8)}`,
      appointmentType,
      orderId: order?.id || null,
      technicianId: assignedTechnician?.id || null,
      technicianName: assignedTechnician?.name || 'Pending Assignment',
      customerId: order?.customer_id || null,
      customerName,
      customerEmail,
      customerPhone,
      scheduledDate,
      scheduledTime,
      installationAddress: installationAddress || {},
      notes: notes || '',
      source: source || 'customer-booking',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.appointments.push(newAppointment);

    // BUG-I003: queue a scheduling notification for the public booking path too.
    if (newAppointment.customerEmail) {
      if (!db.emailLogs) db.emailLogs = [];
      db.emailLogs.push({
        id: 'email-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        type: 'appointment_scheduled_notification',
        to: newAppointment.customerEmail,
        appointmentId: newAppointment.id,
        orderId: newAppointment.orderId,
        subject: `Your appointment is scheduled for ${scheduledDate} ${scheduledTime}`,
        status: 'queued',
        createdAt: new Date().toISOString(),
        source: 'customer_booking'
      });
    }

    saveDatabase(db);

    res.json({
      success: true,
      appointment: newAppointment,
      message: assignedTechnician
        ? `Appointment booked with ${assignedTechnician.name}`
        : 'Appointment request submitted. A technician will be assigned shortly.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get appointment status (Public - customer can check their appointment)
app.get('/api/appointments/:id/status', (req, res) => {
  try {
    const db = loadDatabase();
    const appointment = db.appointments?.find(a => a.id === req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // Return limited info for public access
    res.json({
      success: true,
      appointment: {
        id: appointment.id,
        status: appointment.status,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        appointmentType: appointment.appointmentType,
        technicianName: appointment.technicianName || 'Pending Assignment'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TAX SERVICE ENDPOINTS
// ============================================

// Get tax rate for a state
app.get('/api/tax/rate/:state', (req, res) => {
  try {
    const rate = taxService.getTaxRate(req.params.state);
    res.json({ success: true, state: req.params.state.toUpperCase(), rate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate tax for order
app.post('/api/tax/calculate', (req, res) => {
  try {
    const { subtotal, shippingAddress, customerId } = req.body;
    const result = taxService.calculateOrderTotal(subtotal, 0, shippingAddress, customerId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all tax rates
app.get('/api/admin/tax/rates', authMiddleware, (req, res) => {
  try {
    const rates = taxService.getAllRates();
    res.json({ success: true, rates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update tax rate for state
app.put('/api/admin/tax/rates/:state', authMiddleware, (req, res) => {
  try {
    const { rate } = req.body;
    const result = taxService.updateRate(req.params.state, rate);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Tax report
app.get('/api/admin/tax/report', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = taxService.getTaxReport(startDate, endDate);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Add tax exemption
app.post('/api/admin/tax/exemptions', authMiddleware, (req, res) => {
  try {
    const { customerId, ...exemptionData } = req.body;
    const exemption = taxService.addExemption(customerId, exemptionData);
    res.json({ success: true, exemption });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PURCHASE ORDER SERVICE ENDPOINTS
// ============================================

// Admin: Get orders ready for PO
app.get('/api/admin/po/pending', authMiddleware, (req, res) => {
  try {
    const { manufacturerId } = req.query;
    const orders = poService.getOrdersForPO(manufacturerId);
    res.json({ success: true, orders, count: orders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Generate PO data preview
app.post('/api/admin/po/preview', authMiddleware, (req, res) => {
  try {
    const { orderIds, manufacturerId, manufacturerName } = req.body;
    const poData = poService.generatePOData(orderIds, manufacturerId, manufacturerName);
    if (!poData) {
      return res.status(400).json({ success: false, error: 'No orders found' });
    }
    res.json({ success: true, po: poData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Create and save PO
app.post('/api/admin/po/create', authMiddleware, (req, res) => {
  try {
    const { orderIds, manufacturerId, manufacturerName } = req.body;
    const poData = poService.generatePOData(orderIds, manufacturerId, manufacturerName);
    if (!poData) {
      return res.status(400).json({ success: false, error: 'No orders found' });
    }
    const savedPO = poService.savePO(poData, orderIds);
    res.json({ success: true, po: savedPO });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all POs
app.get('/api/admin/po', authMiddleware, (req, res) => {
  try {
    const { manufacturerId, status } = req.query;
    const pos = poService.getAllPOs({ manufacturerId, status });
    res.json({ success: true, purchaseOrders: pos, count: pos.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update PO status
app.put('/api/admin/po/:id/status', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;
    const po = poService.updatePOStatus(req.params.id, status);
    if (!po) {
      return res.status(404).json({ success: false, error: 'PO not found' });
    }
    res.json({ success: true, po });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Export PO as CSV
app.get('/api/admin/po/:id/csv', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const po = (db.purchaseOrders || []).find(p => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, error: 'PO not found' });
    }
    const csv = poService.generatePOCSV(po);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${po.poNumber}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Export PO as HTML (for printing/PDF)
app.get('/api/admin/po/:id/html', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const po = (db.purchaseOrders || []).find(p => p.id === req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, error: 'PO not found' });
    }
    const html = poService.generatePOHTML(po);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CART RECOVERY SERVICE ENDPOINTS
// ============================================

// Public: Save cart for recovery (called when email entered at checkout)
app.post('/api/cart/save-for-recovery', (req, res) => {
  try {
    const cart = cartRecoveryService.saveAbandonedCart(req.body);
    res.json({ success: true, cartId: cart.id, recoveryCode: cart.recoveryCode });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Public: Recover cart by code
app.get('/api/cart/recover/:code', (req, res) => {
  try {
    const cart = cartRecoveryService.getCartByRecoveryCode(req.params.code);
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found or expired' });
    }
    if (cart.convertedToOrder) {
      return res.status(400).json({ success: false, error: 'Cart has already been converted to an order' });
    }
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get abandoned carts
app.get('/api/admin/abandoned-carts', authMiddleware, (req, res) => {
  try {
    const carts = cartRecoveryService.getAbandonedCarts();
    res.json({ success: true, carts, count: carts.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get carts needing recovery email
app.get('/api/admin/abandoned-carts/pending-emails', authMiddleware, (req, res) => {
  try {
    const carts = cartRecoveryService.getCartsNeedingRecoveryEmail();
    res.json({ success: true, carts, count: carts.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Trigger recovery emails (call this via cron or manually)
app.post('/api/admin/abandoned-carts/send-emails', authMiddleware, async (req, res) => {
  try {
    const carts = cartRecoveryService.getCartsNeedingRecoveryEmail();
    const results = [];

    for (const cart of carts) {
      const emailNumber = (cart.recoveryEmailsSent || 0) + 1;
      const emailContent = cartRecoveryService.generateRecoveryEmailHTML(cart, emailNumber);

      try {
        await emailService.send({
          to: cart.customerEmail,
          subject: emailContent.subject,
          html: emailContent.html
        });

        cartRecoveryService.markEmailSent(cart.id);
        results.push({ cartId: cart.id, status: 'sent', emailNumber });
      } catch (emailErr) {
        results.push({ cartId: cart.id, status: 'failed', error: emailErr.message });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get cart recovery stats
app.get('/api/admin/abandoned-carts/stats', authMiddleware, (req, res) => {
  try {
    const stats = cartRecoveryService.getStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Update cart recovery settings
app.put('/api/admin/abandoned-carts/settings', authMiddleware, (req, res) => {
  try {
    const settings = cartRecoveryService.updateSettings(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Mark cart as converted
app.post('/api/admin/abandoned-carts/:id/convert', authMiddleware, (req, res) => {
  try {
    const { orderId } = req.body;
    const cart = cartRecoveryService.markAsConverted(req.params.id, orderId);
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }
    res.json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ACCOUNTING EXPORT ENDPOINTS
// ============================================

// Get financial summary
app.get('/api/admin/accounting/summary', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = accountingExportService.getFinancialSummary(startDate, endDate);
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export sales journal
app.get('/api/admin/accounting/export/journal', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const journal = accountingExportService.exportSalesJournal(startDate, endDate);
    res.json({ success: true, entries: journal, count: journal.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export QuickBooks IIF format
app.get('/api/admin/accounting/export/quickbooks', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const iif = accountingExportService.exportQuickBooksIIF(startDate, endDate);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="quickbooks-export-${Date.now()}.iif"`);
    res.send(iif);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export Xero CSV format
app.get('/api/admin/accounting/export/xero', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const csv = accountingExportService.exportXeroCSV(startDate, endDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="xero-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export generic CSV
app.get('/api/admin/accounting/export/csv', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const csv = accountingExportService.exportGenericCSV(startDate, endDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sales-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export tax report
app.get('/api/admin/accounting/export/tax-report', authMiddleware, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const csv = accountingExportService.exportTaxReport(startDate, endDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tax-report-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SCHEDULED REPORTS ENDPOINTS
// ============================================

// Get available report types and frequencies
app.get('/api/admin/reports/types', authMiddleware, (req, res) => {
  res.json({
    success: true,
    reportTypes: REPORT_TYPES,
    frequencies: FREQUENCIES
  });
});

// Get all scheduled reports
app.get('/api/admin/reports/scheduled', authMiddleware, (req, res) => {
  try {
    const reports = scheduledReportsService.getAllReports();
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create scheduled report
app.post('/api/admin/reports/scheduled', authMiddleware, (req, res) => {
  try {
    const report = scheduledReportsService.createReport(req.body);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update scheduled report
app.put('/api/admin/reports/scheduled/:id', authMiddleware, (req, res) => {
  try {
    const report = scheduledReportsService.updateReport(req.params.id, req.body);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete scheduled report
app.delete('/api/admin/reports/scheduled/:id', authMiddleware, (req, res) => {
  try {
    const success = scheduledReportsService.deleteReport(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run report now (generate and return data)
app.post('/api/admin/reports/scheduled/:id/run', authMiddleware, async (req, res) => {
  try {
    const reports = scheduledReportsService.getAllReports();
    const report = reports.find(r => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const data = scheduledReportsService.generateReportData(report);
    scheduledReportsService.markReportRun(report.id);

    res.json({ success: true, report, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get report preview (generate data without marking as run)
app.get('/api/admin/reports/scheduled/:id/preview', authMiddleware, (req, res) => {
  try {
    const reports = scheduledReportsService.getAllReports();
    const report = reports.find(r => r.id === req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const data = scheduledReportsService.generateReportData(report);
    const html = scheduledReportsService.generateReportHTML(report, data);

    res.json({ success: true, report, data, html });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger due reports (call via cron)
app.post('/api/admin/reports/trigger-due', authMiddleware, async (req, res) => {
  try {
    const dueReports = scheduledReportsService.getDueReports();
    const results = [];

    for (const report of dueReports) {
      const data = scheduledReportsService.generateReportData(report);
      const html = scheduledReportsService.generateReportHTML(report, data);

      // Send to recipients
      for (const email of (report.recipients || [])) {
        try {
          await emailService.send({
            to: email,
            subject: `Peekaboo Shades: ${report.name}`,
            html: html
          });
          results.push({ reportId: report.id, email, status: 'sent' });
        } catch (err) {
          results.push({ reportId: report.id, email, status: 'failed', error: err.message });
        }
      }

      scheduledReportsService.markReportRun(report.id);
    }

    res.json({
      success: true,
      processed: dueReports.length,
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SENTRY ERROR HANDLER (must be last)
// ============================================
if (Sentry && process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     PEEKABOO SHADES - E-commerce Platform                 ║
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
║     • Tech:     http://localhost:${PORT}/technician          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Build database indexes on startup for fast queries
  try {
    const db = loadDatabase();
    dbIndex.rebuildAll(db);
  } catch (error) {
    console.error('Failed to build database indexes:', error.message);
  }
});
