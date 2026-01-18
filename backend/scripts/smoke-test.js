#!/usr/bin/env node
/**
 * Smoke Test Runner for Peekaboo Shades Admin System
 *
 * Tests:
 * 1. All admin pages load without 500 errors
 * 2. Critical API endpoints return expected response shapes
 * 3. Authentication flow works
 *
 * Usage:
 *   node backend/scripts/smoke-test.js
 *   npm run smoke-test
 *
 * Requirements:
 *   - Server must be running on localhost:3001
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = 'http://localhost:3001';
const ADMIN_CREDENTIALS = {
  email: 'admin@peekabooshades.com',
  password: 'admin123'
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logPass(test) {
  results.passed++;
  log(`  ✓ ${test}`, 'green');
}

function logFail(test, error) {
  results.failed++;
  results.errors.push({ test, error });
  log(`  ✗ ${test}: ${error}`, 'red');
}

// HTTP request helper
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => {
            try {
              return JSON.parse(data);
            } catch {
              return null;
            }
          }
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// ============================================
// ADMIN PAGE TESTS
// ============================================

const ADMIN_PAGES = [
  { path: '/admin/', name: 'Dashboard' },
  { path: '/admin/orders.html', name: 'Orders' },
  { path: '/admin/quotes.html', name: 'Quotes' },
  { path: '/admin/invoices.html', name: 'Invoices' },
  { path: '/admin/accounts.html', name: 'Accounts & Profit' },
  { path: '/admin/products.html', name: 'Products' },
  { path: '/admin/product-launch.html', name: 'Launch Product' },
  { path: '/admin/categories.html', name: 'Categories' },
  { path: '/admin/fabrics.html', name: 'Fabrics' },
  { path: '/admin/zebra-pricing.html', name: 'Zebra Pricing' },
  { path: '/admin/zebra-page-editor.html', name: 'Zebra Page Editor' },
  { path: '/admin/hardware-options.html', name: 'Hardware Options' },
  { path: '/admin/accessories.html', name: 'Accessories' },
  { path: '/admin/product-pricing.html', name: 'Customer Pricing' },
  { path: '/admin/customers.html', name: 'All Customers' },
  { path: '/admin/product-content.html', name: 'Product Content' },
  { path: '/admin/product-page-editor.html', name: 'Page Editor' },
  { path: '/admin/pages.html', name: 'Pages' },
  { path: '/admin/blog/posts.html', name: 'Blog Posts' },
  { path: '/admin/media-library.html', name: 'Media Library' },
  { path: '/admin/faqs.html', name: 'FAQs' },
  { path: '/admin/theme-settings.html', name: 'Theme & Colors' },
  { path: '/admin/image-manager.html', name: 'Image Manager' },
  { path: '/admin/analytics.html', name: 'Reports' },
  { path: '/admin/system-config.html', name: 'System Config' },
  { path: '/admin/settings.html', name: 'Settings' },
  { path: '/admin/security/', name: 'Security' },
  { path: '/admin/login.html', name: 'Login' },
  { path: '/admin/draft-orders.html', name: 'Draft Orders' },
  { path: '/admin/abandoned-checkouts.html', name: 'Abandoned Checkouts' }
];

async function testAdminPages() {
  log('\n📄 Testing Admin Pages...', 'cyan');

  for (const page of ADMIN_PAGES) {
    try {
      const res = await request(`${BASE_URL}${page.path}`);

      if (res.status === 200) {
        logPass(`${page.name} (${page.path})`);
      } else if (res.status === 404) {
        logFail(`${page.name} (${page.path})`, `404 Not Found`);
      } else if (res.status >= 500) {
        logFail(`${page.name} (${page.path})`, `Server Error ${res.status}`);
      } else {
        logPass(`${page.name} (${page.path}) - Status ${res.status}`);
      }
    } catch (error) {
      logFail(`${page.name} (${page.path})`, error.message);
    }
  }
}

// ============================================
// PUBLIC API TESTS
// ============================================

const PUBLIC_API_TESTS = [
  {
    name: 'GET /api/categories',
    method: 'GET',
    path: '/api/categories',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      if (!Array.isArray(json.data)) return 'data is not an array';
      return null;
    }
  },
  {
    name: 'GET /api/products',
    method: 'GET',
    path: '/api/products',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      if (!Array.isArray(json.data)) return 'data is not an array';
      return null;
    }
  },
  {
    name: 'GET /api/faqs',
    method: 'GET',
    path: '/api/faqs',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/room-labels',
    method: 'GET',
    path: '/api/room-labels',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/site-content',
    method: 'GET',
    path: '/api/site-content',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/pricing-config',
    method: 'GET',
    path: '/api/pricing-config',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/v1/health',
    method: 'GET',
    path: '/api/v1/health',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (json.status !== 'healthy') return 'status !== healthy';
      return null;
    }
  }
];

async function testPublicAPIs() {
  log('\n🌐 Testing Public API Endpoints...', 'cyan');

  for (const test of PUBLIC_API_TESTS) {
    try {
      const res = await request(`${BASE_URL}${test.path}`, {
        method: test.method,
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.status >= 500) {
        logFail(test.name, `Server Error ${res.status}`);
        continue;
      }

      const error = test.validate(res);
      if (error) {
        logFail(test.name, error);
      } else {
        logPass(test.name);
      }
    } catch (error) {
      logFail(test.name, error.message);
    }
  }
}

// ============================================
// ADMIN API TESTS (Requires Auth)
// ============================================

async function getAuthToken() {
  try {
    const res = await request(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_CREDENTIALS)
    });

    const json = res.json();
    if (json && json.success && json.token) {
      return json.token;
    }
    return null;
  } catch {
    return null;
  }
}

const ADMIN_API_TESTS = [
  {
    name: 'GET /api/admin/dashboard',
    path: '/api/admin/dashboard',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/products',
    path: '/api/admin/products',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/orders',
    path: '/api/admin/orders',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/customers',
    path: '/api/admin/customers',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/invoices',
    path: '/api/admin/invoices',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/ledger',
    path: '/api/admin/ledger',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/fabrics',
    path: '/api/admin/fabrics',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/categories',
    path: '/api/admin/categories',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/manufacturer-prices',
    path: '/api/admin/manufacturer-prices',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  },
  {
    name: 'GET /api/admin/analytics/dashboard',
    path: '/api/admin/analytics/dashboard',
    validate: (res) => {
      const json = res.json();
      if (!json) return 'Invalid JSON response';
      if (!json.success) return 'success !== true';
      return null;
    }
  }
];

async function testAdminAPIs(token) {
  log('\n🔐 Testing Admin API Endpoints...', 'cyan');

  if (!token) {
    log('  ⚠ Skipping admin API tests - could not authenticate', 'yellow');
    return;
  }

  for (const test of ADMIN_API_TESTS) {
    try {
      const res = await request(`${BASE_URL}${test.path}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        logFail(test.name, 'Unauthorized (401)');
        continue;
      }

      if (res.status >= 500) {
        logFail(test.name, `Server Error ${res.status}`);
        continue;
      }

      const error = test.validate(res);
      if (error) {
        logFail(test.name, error);
      } else {
        logPass(test.name);
      }
    } catch (error) {
      logFail(test.name, error.message);
    }
  }
}

// ============================================
// STOREFRONT PAGE TESTS
// ============================================

const STOREFRONT_PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/shop.html', name: 'Shop' },
  { path: '/product.html', name: 'Product Page' },
  { path: '/cart.html', name: 'Cart' }
];

async function testStorefrontPages() {
  log('\n🏪 Testing Storefront Pages...', 'cyan');

  for (const page of STOREFRONT_PAGES) {
    try {
      const res = await request(`${BASE_URL}${page.path}`);

      if (res.status === 200) {
        logPass(`${page.name} (${page.path})`);
      } else if (res.status === 404) {
        logFail(`${page.name} (${page.path})`, `404 Not Found`);
      } else if (res.status >= 500) {
        logFail(`${page.name} (${page.path})`, `Server Error ${res.status}`);
      } else {
        logPass(`${page.name} (${page.path}) - Status ${res.status}`);
      }
    } catch (error) {
      logFail(`${page.name} (${page.path})`, error.message);
    }
  }
}

// ============================================
// PORTAL TESTS
// ============================================

const PORTAL_PAGES = [
  { path: '/manufacturer/', name: 'Manufacturer Portal' },
  { path: '/manufacturer/login.html', name: 'Manufacturer Login' },
  { path: '/dealer/', name: 'Dealer Portal' },
  { path: '/dealer/login.html', name: 'Dealer Login' }
];

async function testPortalPages() {
  log('\n🏢 Testing External Portals...', 'cyan');

  for (const page of PORTAL_PAGES) {
    try {
      const res = await request(`${BASE_URL}${page.path}`);

      if (res.status === 200) {
        logPass(`${page.name} (${page.path})`);
      } else if (res.status === 404) {
        logFail(`${page.name} (${page.path})`, `404 Not Found`);
      } else if (res.status >= 500) {
        logFail(`${page.name} (${page.path})`, `Server Error ${res.status}`);
      } else {
        logPass(`${page.name} (${page.path}) - Status ${res.status}`);
      }
    } catch (error) {
      logFail(`${page.name} (${page.path})`, error.message);
    }
  }
}

// ============================================
// PRICING CALCULATION TEST
// ============================================

async function testPricingCalculation() {
  log('\n💰 Testing Pricing Calculation...', 'cyan');

  try {
    const res = await request(`${BASE_URL}/api/v1/pricing/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productSlug: 'affordable-custom-zebra-shades',
        productType: 'zebra',
        width: 48,
        height: 72,
        quantity: 1,
        fabricCode: '83003A',
        options: {
          controlType: 'chain',
          chainSide: 'right'
        }
      })
    });

    const json = res.json();

    if (!json) {
      logFail('Price calculation', 'Invalid JSON response');
      return;
    }

    if (!json.success) {
      logFail('Price calculation', json.error || 'success !== true');
      return;
    }

    if (!json.pricing || typeof json.pricing.unitPrice !== 'number') {
      logFail('Price calculation', 'Missing pricing.unitPrice');
      return;
    }

    logPass(`Price calculation - Unit price: $${json.pricing.unitPrice.toFixed(2)}`);
  } catch (error) {
    logFail('Price calculation', error.message);
  }
}

// ============================================
// MAIN RUNNER
// ============================================

async function runSmokeTests() {
  log('╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║       PEEKABOO SHADES SMOKE TEST RUNNER                    ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  const startTime = Date.now();

  // Check if server is running
  log('\n⏳ Checking server connection...', 'cyan');
  try {
    await request(`${BASE_URL}/api/v1/health`);
    logPass('Server is running');
  } catch (error) {
    log('\n❌ Server is not running! Please start the server first:', 'red');
    log('   cd backend && npm start', 'yellow');
    process.exit(1);
  }

  // Run all test suites
  await testStorefrontPages();
  await testAdminPages();
  await testPortalPages();
  await testPublicAPIs();

  // Get auth token and test admin APIs
  log('\n🔑 Authenticating...', 'cyan');
  const token = await getAuthToken();
  if (token) {
    logPass('Admin authentication');
    await testAdminAPIs(token);
  } else {
    logFail('Admin authentication', 'Could not get token');
  }

  await testPricingCalculation();

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║                      TEST SUMMARY                          ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  log(`\n  Total Tests: ${results.passed + results.failed}`);
  log(`  Passed: ${results.passed}`, 'green');
  log(`  Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`  Duration: ${duration}s\n`);

  if (results.failed > 0) {
    log('  Failed Tests:', 'red');
    results.errors.forEach(({ test, error }) => {
      log(`    • ${test}: ${error}`, 'red');
    });
    log('');
    process.exit(1);
  } else {
    log('  ✅ All tests passed!\n', 'green');
    process.exit(0);
  }
}

// Run tests
runSmokeTests().catch(error => {
  log(`\n❌ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});
