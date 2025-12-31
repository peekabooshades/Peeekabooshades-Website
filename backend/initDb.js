const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, 'peekabooshades.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Categories table
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Products table
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    sale_price REAL,
    image_url TEXT,
    is_featured INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  -- Product images table
  CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Product options (for configurator)
  CREATE TABLE IF NOT EXISTS product_options (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    option_name TEXT NOT NULL,
    option_type TEXT NOT NULL, -- dropdown, color_swatch, text, number
    is_required INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Option values
  CREATE TABLE IF NOT EXISTS option_values (
    id TEXT PRIMARY KEY,
    option_id TEXT NOT NULL,
    value TEXT NOT NULL,
    display_name TEXT,
    color_code TEXT,
    image_url TEXT,
    price_modifier REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (option_id) REFERENCES product_options(id)
  );

  -- Room labels
  CREATE TABLE IF NOT EXISTS room_labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  -- Cart table
  CREATE TABLE IF NOT EXISTS cart (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    width REAL,
    height REAL,
    room_label TEXT,
    configuration TEXT, -- JSON string of selected options
    unit_price REAL NOT NULL,
    extended_warranty INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Orders table
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    shipping_address TEXT,
    subtotal REAL NOT NULL,
    tax REAL DEFAULT 0,
    shipping REAL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Order items table
  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    width REAL,
    height REAL,
    room_label TEXT,
    configuration TEXT,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    extended_warranty INTEGER DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Quote requests table
  CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    quote_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    product_id TEXT,
    product_name TEXT,
    configuration TEXT,
    width REAL,
    height REAL,
    quantity INTEGER DEFAULT 1,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- FAQ table
  CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  -- Contact messages
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed data
console.log('Seeding database...');

// Categories
const categories = [
  { id: uuidv4(), name: 'Roller Shades', slug: 'roller-shades', description: 'Affordable custom roller blinds & shades' },
  { id: uuidv4(), name: 'Roman Shades', slug: 'roman-shades', description: 'Energy efficient roman shades' },
  { id: uuidv4(), name: 'Natural Woven Shades', slug: 'natural-woven-shades', description: 'Natural woven window blinds' },
  { id: uuidv4(), name: 'Honeycomb/Cellular Shades', slug: 'honeycomb-shades', description: 'Honeycomb cellular shades' },
  { id: uuidv4(), name: 'Drapes', slug: 'drapes', description: 'Custom drapes and curtains' }
];

const insertCategory = db.prepare(`
  INSERT OR REPLACE INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)
`);

categories.forEach(cat => {
  insertCategory.run(cat.id, cat.name, cat.slug, cat.description);
});

// Get category IDs
const getCategoryId = db.prepare('SELECT id FROM categories WHERE slug = ?');

// Products
const products = [
  {
    id: uuidv4(),
    category_slug: 'roller-shades',
    name: 'Affordable Custom Roller Blinds & shades',
    slug: 'affordable-custom-roller-blinds',
    description: 'Discover our selection! Roller blinds offer a clean and sleek line that complements any home style. A great value that is sure to work great for your space. Coming in a variety of patterns and colors to help bring out the best in your space.',
    base_price: 40.00,
    sale_price: 75.99,
    is_featured: 1
  },
  {
    id: uuidv4(),
    category_slug: 'roman-shades',
    name: 'Energy Efficient Roman Shades',
    slug: 'energy-efficient-roman-shades',
    description: 'Premium roman shades with energy efficient design. Perfect for any room.',
    base_price: 89.79,
    sale_price: null,
    is_featured: 1
  },
  {
    id: uuidv4(),
    category_slug: 'natural-woven-shades',
    name: 'Affordable Custom Zebra Window Blinds',
    slug: 'affordable-zebra-window-blinds',
    description: 'Natural woven shades - Timeless Elegance with Organic Appeal',
    base_price: 50.00,
    sale_price: null,
    is_featured: 1
  },
  {
    id: uuidv4(),
    category_slug: 'honeycomb-shades',
    name: 'Natural Woven Shades - Timeless Elegance',
    slug: 'natural-woven-timeless',
    description: 'Honeycomb cellular shades for energy efficiency',
    base_price: 65.00,
    sale_price: null,
    is_featured: 1
  },
  {
    id: uuidv4(),
    category_slug: 'roller-shades',
    name: 'Blackout Roller Blinds',
    slug: 'blackout-roller-blinds',
    description: 'Complete blackout roller blinds for bedrooms',
    base_price: 45.00,
    sale_price: null,
    is_featured: 0
  },
  {
    id: uuidv4(),
    category_slug: 'roman-shades',
    name: 'Premium Roman Window Shades',
    slug: 'premium-roman-window-shades',
    description: 'Luxurious roman shades with premium fabric',
    base_price: 95.00,
    sale_price: null,
    is_featured: 0
  },
  {
    id: uuidv4(),
    category_slug: 'drapes',
    name: 'Custom Blackout Drapes',
    slug: 'custom-blackout-drapes',
    description: 'Custom made blackout drapes',
    base_price: 120.00,
    sale_price: null,
    is_featured: 0
  },
  {
    id: uuidv4(),
    category_slug: 'honeycomb-shades',
    name: 'Cellular Honeycomb Blinds',
    slug: 'cellular-honeycomb-blinds',
    description: 'Energy efficient cellular blinds',
    base_price: 70.00,
    sale_price: null,
    is_featured: 0
  }
];

const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products (id, category_id, name, slug, description, base_price, sale_price, is_featured)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

products.forEach(prod => {
  const category = getCategoryId.get(prod.category_slug);
  if (category) {
    insertProduct.run(prod.id, category.id, prod.name, prod.slug, prod.description, prod.base_price, prod.sale_price, prod.is_featured);
  }
});

// Room labels
const roomLabels = [
  'Master Bedroom', 'Guest Bedroom', 'Living Room', 'Dining Room',
  'Kitchen', 'Bathroom', 'Office', 'Kids Room', 'Nursery', 'Basement',
  'Sunroom', 'Garage', 'Other'
];

const insertRoomLabel = db.prepare('INSERT OR REPLACE INTO room_labels (id, name) VALUES (?, ?)');
roomLabels.forEach(label => {
  insertRoomLabel.run(uuidv4(), label);
});

// Product options for roller shades (first product)
const rollerProduct = db.prepare('SELECT id FROM products WHERE slug = ?').get('affordable-custom-roller-blinds');

if (rollerProduct) {
  const productOptions = [
    { name: 'Shade Blackout', type: 'dropdown', values: ['Blackout', 'Semi-Blackout', 'Light Filtering'] },
    { name: 'Shade Style', type: 'dropdown', values: ['Standard Roll', 'Reverse Roll', 'Cassette'] },
    { name: 'Light Filtering', type: 'dropdown', values: ['0% (Blackout)', '1-5% (Very Low)', '5-10% (Low)', '10-15% (Medium)', '15%+ (High)'] },
    { name: 'Fabric Color', type: 'color_swatch', values: [
      { value: 'white', display: 'White', color: '#FFFFFF' },
      { value: 'cream', display: 'Cream', color: '#FFFDD0' },
      { value: 'beige', display: 'Beige', color: '#F5F5DC' },
      { value: 'gray', display: 'Gray', color: '#808080' },
      { value: 'charcoal', display: 'Charcoal', color: '#36454F' },
      { value: 'navy', display: 'Navy', color: '#000080' },
      { value: 'brown', display: 'Brown', color: '#8B4513' }
    ]},
    { name: 'Hardware Type', type: 'dropdown', values: ['Standard', 'Premium', 'Motorized'] },
    { name: 'Cassette Color', type: 'color_swatch', values: [
      { value: 'white', display: 'White', color: '#FFFFFF' },
      { value: 'cream', display: 'Cream', color: '#F5F5DC' },
      { value: 'brown', display: 'Brown', color: '#8B4513' }
    ]},
    { name: 'Mount Type', type: 'dropdown', values: ['Inside Mount', 'Outside Mount'] },
    { name: 'Control Side', type: 'dropdown', values: ['Left', 'Right'] },
    { name: 'Motor Type', type: 'dropdown', values: ['None (Manual)', 'Wired Motor', 'Rechargeable Battery Motor', 'Smart Motor (WiFi)'] }
  ];

  const insertOption = db.prepare(`
    INSERT OR REPLACE INTO product_options (id, product_id, option_name, option_type, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertOptionValue = db.prepare(`
    INSERT OR REPLACE INTO option_values (id, option_id, value, display_name, color_code, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  productOptions.forEach((opt, optIndex) => {
    const optionId = uuidv4();
    const optType = opt.type;
    insertOption.run(optionId, rollerProduct.id, opt.name, optType, optIndex);

    opt.values.forEach((val, valIndex) => {
      if (typeof val === 'object') {
        insertOptionValue.run(uuidv4(), optionId, val.value, val.display, val.color, valIndex);
      } else {
        insertOptionValue.run(uuidv4(), optionId, val, val, null, valIndex);
      }
    });
  });
}

// FAQs
const faqs = [
  {
    question: 'How do I measure my window for the right fit?',
    answer: 'Measure the width and height of your window opening in inches. For inside mount, measure the exact opening. For outside mount, add 2-3 inches on each side for optimal coverage and light blockage. We recommend measuring at three points and using the smallest measurement for inside mount.',
    category: 'general'
  },
  {
    question: 'Are the blinds easy to install?',
    answer: 'Yes! All our blinds come with easy-to-follow installation instructions and mounting hardware. Most customers complete installation in 15-30 minutes per window. We also offer professional installation services in select areas.',
    category: 'general'
  },
  {
    question: 'What is your return policy?',
    answer: 'We offer a 30-day satisfaction guarantee on all products. If you\'re not completely satisfied, you can return unused items in original packaging for a full refund. Custom-made products can be exchanged if there are manufacturing defects.',
    category: 'general'
  }
];

const insertFaq = db.prepare(`
  INSERT OR REPLACE INTO faqs (id, question, answer, category, sort_order)
  VALUES (?, ?, ?, ?, ?)
`);

faqs.forEach((faq, index) => {
  insertFaq.run(uuidv4(), faq.question, faq.answer, faq.category, index);
});

console.log('Database initialized successfully!');
db.close();
