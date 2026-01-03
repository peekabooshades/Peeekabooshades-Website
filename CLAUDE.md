# CLAUDE.md - Peekaboo Shades Development Guide

## Project Overview
**Peekaboo Shades** is a custom blinds e-commerce website with a Node.js/Express backend and HTML/CSS/JavaScript frontend. It includes a Python-based fabric swatch extraction tool.

## Project Structure
```
peekabooshades-new/
├── backend/                    # Node.js Express server
│   ├── server.js              # Main server file (~238KB, comprehensive API)
│   ├── database.json          # JSON-based data storage
│   ├── package.json           # Node dependencies
│   ├── config/                # System configuration
│   ├── middleware/            # Auth, RBAC, validation
│   ├── routes/                # CRM and other routes
│   ├── services/              # Business logic services
│   │   ├── extended-pricing-engine.js  # Pricing calculations
│   │   ├── pricing-engine.js           # Core pricing logic
│   │   ├── audit-logger.js             # Audit logging
│   │   ├── content-manager.js          # CMS functionality
│   │   ├── media-manager.js            # Image/file management
│   │   ├── database-schema.js          # Schema definitions
│   │   └── realtime-sync.js            # WebSocket sync
│   └── scripts/               # Utility scripts
├── frontend/
│   └── public/
│       ├── index.html         # Homepage
│       ├── shop.html          # Product listing
│       ├── product.html       # Product detail/configurator (~297KB)
│       ├── cart.html          # Shopping cart
│       ├── css/               # Stylesheets
│       ├── js/                # Client-side JavaScript
│       ├── images/            # Product and UI images
│       └── admin/             # Admin panel (35+ pages)
├── fabric-extractor/          # Python PDF extraction tool
│   ├── app.py                 # Flask application
│   ├── requirements.txt       # Python dependencies
│   └── templates/             # Flask templates
└── docs/                      # Project documentation
    ├── API_DOCUMENTATION.md
    ├── ARCHITECTURE.md
    └── KNOWLEDGE_TRANSFER.md
```

## Starting the Servers

### Node.js Backend Server
```bash
cd backend
npm install          # Install dependencies (first time only)
npm start            # Start server on port 3001
# OR for development with auto-reload:
npm run dev          # Uses nodemon
```
The backend runs at: `http://localhost:3001`

### Python Fabric Extractor
```bash
cd fabric-extractor
pip3 install -r requirements.txt   # Install dependencies
python3 app.py                      # Start Flask server on port 5050
```
The fabric extractor runs at: `http://localhost:5050`

### Database Initialization
```bash
cd backend
npm run init-db      # Initialize/reset database
```

## Key URLs
- **Frontend**: http://localhost:3001 (served by Express static files)
- **Admin Panel**: http://localhost:3001/admin/
- **API Base**: http://localhost:3001/api/
- **Fabric Extractor**: http://localhost:5050

## Coding Style Guidelines

### JavaScript/Node.js
- **Indentation**: 2 spaces
- **Semicolons**: Required at end of statements
- **Quotes**: Single quotes for strings
- **Comments**: Use `// ============` section headers for major code blocks
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for classes
  - UPPER_SNAKE_CASE for constants
- **Async/Await**: Preferred over callbacks
- **Error Handling**: Try-catch blocks with proper error responses

Example:
```javascript
// ============================================
// SECTION NAME
// ============================================
const someFunction = async (req, res) => {
  try {
    const result = await someAsyncOperation();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### Python
- **Indentation**: 4 spaces
- **Docstrings**: Triple quotes for class and function documentation
- **Naming**:
  - snake_case for functions and variables
  - PascalCase for classes
  - UPPER_SNAKE_CASE for constants
- **Type hints**: Not used in current codebase
- **Class structure**: Use methods with clear prefixes (validate_, fix_, process_)

Example:
```python
class FabricSwatchExtractor:
    """
    Class description with purpose
    """

    def __init__(self, pdf_path, output_dir):
        self.pdf_path = pdf_path
        self.output_dir = output_dir

    def process_page(self, page_num):
        """Process a single page"""
        pass
```

### HTML/CSS
- **Indentation**: 2 spaces
- **CSS Variables**: Use `:root` CSS custom properties
- **Color Scheme**: Primary brown `#8E6545`
- **Font**: Montserrat (Google Fonts)
- **Inline Styles**: Used extensively in product.html for dynamic components
- **BEM-like naming**: Not strictly followed, use descriptive class names

### API Response Format
```javascript
// Success response
{ success: true, data: {...} }

// Error response
{ success: false, error: "Error message" }

// List response
{ success: true, data: [...], total: 100, page: 1 }
```

## Important Files

### Pricing Engine
`backend/services/extended-pricing-engine.js` - Handles all pricing calculations:
- Fabric pricing per square meter
- Hardware options (valance, bottom rail)
- Motor pricing (AOK, Dooya brands)
- Accessories (Smart Hub, USB Charger)
- Remote type pricing

### Product Configurator
`frontend/public/product.html` - Main product page with:
- Fabric selection
- Dimension inputs
- Hardware options
- Real-time price calculation
- Add to cart/quote functionality

### Database
`backend/database.json` - JSON file database containing:
- categories, products, fabrics
- orders, quotes, customers
- hardwareOptions, manufacturerPrices
- users, settings, content

## Dependencies

### Node.js (backend/package.json)
- express: Web framework
- cors: Cross-origin requests
- bcryptjs: Password hashing
- jsonwebtoken: JWT authentication
- multer: File uploads
- uuid: Unique ID generation
- ws: WebSocket support
- compression: Response compression

### Python (fabric-extractor/requirements.txt)
- flask: Web framework
- flask-cors: CORS support
- PyMuPDF (fitz): PDF processing
- Pillow: Image manipulation

## Admin Panel Features
Located in `frontend/public/admin/`:
- Product management and editor
- Fabric and hardware options
- Order and quote management
- Customer management
- Analytics dashboard
- Content management (pages, FAQs)
- Theme and system settings
- Media library
- API tester

## Notes
- The backend uses a JSON file as database (no MongoDB/SQL)
- Pricing uses per-square-meter calculations for fabrics
- Hardware pricing can be flat or per-square-meter
- WebSocket support for real-time updates
- JWT-based authentication for admin access
