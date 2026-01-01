const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { authMiddleware, generateToken, verifyToken } = require('./middleware/auth');

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
    // Shorter cache for CSS/JS
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
}));

// Initialize database on startup
initDatabase();

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

    const subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

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

// Add to cart
app.post('/api/cart', (req, res) => {
  try {
    const db = loadDatabase();
    const {
      sessionId, productId, quantity, width, height,
      roomLabel, configuration, unitPrice, extendedWarranty
    } = req.body;

    // Get product name
    const product = db.products.find(p => p.id === productId);
    const productName = product ? product.name : 'Custom Blinds';

    const cartItem = {
      id: uuidv4(),
      session_id: sessionId,
      product_id: productId,
      product_name: productName,
      quantity: quantity || 1,
      width,
      height,
      room_label: roomLabel,
      configuration: typeof configuration === 'string' ? configuration : JSON.stringify(configuration),
      unit_price: unitPrice,
      extended_warranty: extendedWarranty ? 1 : 0,
      created_at: new Date().toISOString()
    };

    db.cart.push(cartItem);
    saveDatabase(db);

    res.json({ success: true, message: 'Item added to cart', cartItemId: cartItem.id });
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
    const {
      sessionId, customerName, customerEmail, customerPhone,
      shippingAddress, subtotal, tax, shipping
    } = req.body;

    const orderId = uuidv4();
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
    const total = subtotal + (tax || 0) + (shipping || 0);

    // Get cart items
    const cartItems = db.cart.filter(item => item.session_id === sessionId);

    const order = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      shipping_address: shippingAddress,
      subtotal,
      tax: tax || 0,
      shipping: shipping || 0,
      total,
      status: 'pending',
      items: cartItems.map(item => ({
        ...item,
        order_id: orderId
      })),
      created_at: new Date().toISOString()
    };

    db.orders.push(order);

    // Clear cart
    db.cart = db.cart.filter(item => item.session_id !== sessionId);
    saveDatabase(db);

    res.json({
      success: true,
      message: 'Order created successfully',
      orderId,
      orderNumber
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
// PRICE CALCULATOR
// ============================================

app.post('/api/calculate-price', (req, res) => {
  try {
    const db = loadDatabase();
    const { productId, width, height, options, quantity, extendedWarranty } = req.body;

    const product = db.products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Base price calculation
    const sqInches = (width || 24) * (height || 36);
    const baseMultiplier = sqInches / 864;
    let price = product.base_price * Math.max(1, baseMultiplier);

    // Extended warranty
    if (extendedWarranty) {
      price += 15.00;
    }

    // Quantity
    const totalPrice = price * (quantity || 1);

    res.json({
      success: true,
      unitPrice: Math.round(price * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100
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

    const { name, slug, description, category_id, base_price, sale_price, is_featured, is_active, image_url } = req.body;

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

    let orders = [...db.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter(o =>
        o.order_number.toLowerCase().includes(searchLower) ||
        o.customer_name.toLowerCase().includes(searchLower) ||
        o.customer_email.toLowerCase().includes(searchLower)
      );
    }

    res.json({ success: true, data: orders, total: orders.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single order
app.get('/api/admin/orders/:id', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const order = db.orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order status
app.put('/api/admin/orders/:id/status', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const order = db.orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    order.status = status;
    order.updated_at = new Date().toISOString();
    saveDatabase(db);

    res.json({ success: true, message: 'Order status updated', data: order });
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

// --- HARDWARE OPTIONS ---
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

app.put('/api/admin/hardware/:category/:id', authMiddleware, (req, res) => {
  try {
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

// Product detail page
app.get('/product/:slug', (req, res) => {
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
    let orders = db.orders || [];

    // Filter by date range if provided
    if (startDate) {
      const start = new Date(startDate);
      analytics = analytics.filter(e => new Date(e.createdAt) >= start);
      orders = orders.filter(o => new Date(o.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      analytics = analytics.filter(e => new Date(e.createdAt) <= end);
      orders = orders.filter(o => new Date(o.created_at) <= end);
    }

    // Calculate metrics
    const purchases = analytics.filter(e => e.type === 'purchase');
    const totalRevenue = purchases.reduce((sum, e) => sum + (e.value || 0), 0) +
                        orders.reduce((sum, o) => sum + (o.total || 0), 0);
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
    let orders = db.orders || [];

    if (startDate) {
      const start = new Date(startDate);
      analytics = analytics.filter(e => new Date(e.createdAt) >= start);
      orders = orders.filter(o => new Date(o.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      analytics = analytics.filter(e => new Date(e.createdAt) <= end);
      orders = orders.filter(o => new Date(o.created_at) <= end);
    }

    // Group by day/week/month
    const salesByDate = {};
    const addToGroup = (date, value) => {
      let key;
      const d = new Date(date);
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
    };

    analytics.forEach(e => addToGroup(e.createdAt, e.value || 0));
    orders.forEach(o => addToGroup(o.created_at, o.total || 0));

    const salesData = Object.entries(salesByDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));

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
    const products = db.products || [];

    const productStats = {};
    analytics.filter(e => e.productId).forEach(e => {
      if (!productStats[e.productId]) {
        productStats[e.productId] = { views: 0, carts: 0, purchases: 0, revenue: 0 };
      }
      if (e.type === 'page_view') productStats[e.productId].views++;
      if (e.type === 'add_to_cart') productStats[e.productId].carts++;
      if (e.type === 'purchase') {
        productStats[e.productId].purchases++;
        productStats[e.productId].revenue += e.value || 0;
      }
    });

    const topProducts = Object.entries(productStats)
      .map(([id, stats]) => {
        const product = products.find(p => p.id === id);
        return {
          id,
          name: product?.name || 'Unknown',
          slug: product?.slug || '',
          ...stats
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({ success: true, topProducts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get top fabrics analytics
app.get('/api/admin/analytics/fabrics', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const cart = db.cart || [];
    const fabrics = db.productContent?.fabrics || [];

    const fabricCounts = {};
    cart.forEach(item => {
      try {
        const config = JSON.parse(item.configuration || '{}');
        const fabricCode = config.fabricCode;
        if (fabricCode) {
          fabricCounts[fabricCode] = (fabricCounts[fabricCode] || 0) + item.quantity;
        }
      } catch (e) {}
    });

    const topFabrics = Object.entries(fabricCounts)
      .map(([code, count]) => {
        const fabric = fabrics.find(f => f.code === code);
        return {
          code,
          name: fabric?.name || code,
          filterType: fabric?.filterType || 'unknown',
          count
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ success: true, topFabrics });
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

    res.json({ success: true, order, draftOrder });
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

    const sections = db.productPageSections[slug] || [];
    res.json({ success: true, sections, slug });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save page sections for a product
app.put('/api/admin/product-page-sections/:slug', authMiddleware, (req, res) => {
  try {
    const db = loadDatabase();
    const { slug } = req.params;
    const { sections } = req.body;

    if (!db.productPageSections) db.productPageSections = {};

    db.productPageSections[slug] = sections;
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

    // Only return visible sections
    const sections = (db.productPageSections[slug] || []).filter(s => s.isVisible !== false);
    res.json({ success: true, sections, slug });
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

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🏠 PEEKABOO SHADES - E-commerce Platform              ║
║                                                            ║
║     Server running on: http://localhost:${PORT}              ║
║                                                            ║
║     Pages:                                                 ║
║     • Home:     http://localhost:${PORT}/                    ║
║     • Shop:     http://localhost:${PORT}/shop                ║
║     • Product:  http://localhost:${PORT}/product/[slug]      ║
║     • Cart:     http://localhost:${PORT}/cart                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
