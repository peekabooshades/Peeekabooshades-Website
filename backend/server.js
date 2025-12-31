const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Database file path
const DB_PATH = path.join(__dirname, 'database.json');

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

// Load database
function loadDatabase() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    initDatabase();
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  }
}

// Save database
function saveDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

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
