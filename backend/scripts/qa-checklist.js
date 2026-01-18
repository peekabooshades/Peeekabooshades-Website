#!/usr/bin/env node

/**
 * QA Checklist Script for Peekaboo Shades
 * Validates specs library, API endpoints, and data integrity
 *
 * Usage: node scripts/qa-checklist.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const DATA_DIR = path.join(__dirname, '../data');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  pass: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.blue}━━━ ${msg} ━━━${colors.reset}`)
};

let results = { passed: 0, failed: 0, warnings: 0 };

// Helper to make HTTP requests
function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    http.get(url.href, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    }).on('error', reject);
  });
}

// Check if file exists and is valid JSON
function checkJsonFile(filePath, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    log.pass(`${description} exists and is valid JSON`);
    results.passed++;
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      log.fail(`${description} does not exist`);
    } else {
      log.fail(`${description} is not valid JSON: ${err.message}`);
    }
    results.failed++;
    return false;
  }
}

// Validate product_specs.json structure
function validateProductSpecs() {
  log.section('Product Specs Validation');

  const specsPath = path.join(DATA_DIR, 'product_specs.json');
  if (!checkJsonFile(specsPath, 'product_specs.json')) return;

  const specs = JSON.parse(fs.readFileSync(specsPath, 'utf8'));

  // Check required top-level fields
  const requiredFields = ['version', 'products', 'commonSpecs'];
  requiredFields.forEach(field => {
    if (specs[field]) {
      log.pass(`Has required field: ${field}`);
      results.passed++;
    } else {
      log.fail(`Missing required field: ${field}`);
      results.failed++;
    }
  });

  // Check all 4 product types exist
  const productTypes = ['roller', 'zebra', 'roman', 'honeycomb'];
  productTypes.forEach(type => {
    if (specs.products?.[type]) {
      log.pass(`Product type exists: ${type}`);
      results.passed++;

      // Check required product fields
      const product = specs.products[type];
      const reqProductFields = ['id', 'name', 'description', 'specifications'];
      reqProductFields.forEach(f => {
        if (product[f]) {
          log.pass(`  ${type}.${f} exists`);
          results.passed++;
        } else {
          log.fail(`  ${type}.${f} missing`);
          results.failed++;
        }
      });

      // Check dimensions exist
      if (product.specifications?.dimensions) {
        const dims = product.specifications.dimensions;
        if (dims.minWidth && dims.maxWidth && dims.minHeight && dims.maxHeight) {
          log.pass(`  ${type} has complete dimensions`);
          results.passed++;
        } else {
          log.warn(`  ${type} has incomplete dimensions`);
          results.warnings++;
        }
      }
    } else {
      log.fail(`Product type missing: ${type}`);
      results.failed++;
    }
  });
}

// Validate content_sources.json structure
function validateContentSources() {
  log.section('Content Sources Validation');

  const sourcesPath = path.join(DATA_DIR, 'content_sources.json');
  if (!checkJsonFile(sourcesPath, 'content_sources.json')) return;

  const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));

  // Check required sections
  const requiredSections = ['primarySources', 'fieldSources', 'missingFields'];
  requiredSections.forEach(section => {
    if (sources[section]) {
      log.pass(`Has required section: ${section}`);
      results.passed++;
    } else {
      log.fail(`Missing required section: ${section}`);
      results.failed++;
    }
  });

  // Check PDF source exists
  if (sources.primarySources?.['pdf-001']) {
    log.pass('Primary PDF source (pdf-001) exists');
    results.passed++;
  } else {
    log.warn('Primary PDF source not configured');
    results.warnings++;
  }

  // Count field sources per product
  const productTypes = ['roller', 'zebra', 'roman', 'honeycomb'];
  productTypes.forEach(type => {
    const fieldCount = Object.keys(sources.fieldSources?.[type] || {}).length;
    if (fieldCount > 0) {
      log.pass(`${type} has ${fieldCount} field sources`);
      results.passed++;
    } else {
      log.warn(`${type} has no field sources configured`);
      results.warnings++;
    }
  });

  // Check missing fields
  const missingCount = sources.missingFields?.length || 0;
  if (missingCount > 0) {
    log.warn(`${missingCount} fields marked as missing/TODO`);
    results.warnings++;
  } else {
    log.pass('No missing fields');
    results.passed++;
  }
}

// Test API endpoints
async function testApiEndpoints() {
  log.section('API Endpoint Tests');

  // Test public specs endpoint (no auth required)
  try {
    const specsResponse = await httpGet('/api/specs');
    if (specsResponse.status === 200 && specsResponse.data?.success) {
      log.pass('GET /api/specs returns 200');
      results.passed++;
    } else {
      log.fail(`GET /api/specs returned ${specsResponse.status}`);
      results.failed++;
    }
  } catch (err) {
    log.fail(`GET /api/specs failed: ${err.message}`);
    results.failed++;
  }

  // Test with productType parameter
  const productTypes = ['roller', 'zebra', 'roman', 'honeycomb'];
  for (const type of productTypes) {
    try {
      const response = await httpGet(`/api/specs?productType=${type}`);
      if (response.status === 200 && response.data?.success && response.data?.data?.id === type) {
        log.pass(`GET /api/specs?productType=${type} returns correct data`);
        results.passed++;
      } else {
        log.fail(`GET /api/specs?productType=${type} failed validation`);
        results.failed++;
      }
    } catch (err) {
      log.fail(`GET /api/specs?productType=${type} failed: ${err.message}`);
      results.failed++;
    }
  }

  // Test invalid product type
  try {
    const invalidResponse = await httpGet('/api/specs?productType=invalid');
    if (invalidResponse.status === 404) {
      log.pass('GET /api/specs?productType=invalid returns 404');
      results.passed++;
    } else {
      log.warn(`GET /api/specs?productType=invalid returned ${invalidResponse.status} (expected 404)`);
      results.warnings++;
    }
  } catch (err) {
    log.warn(`Invalid product type test failed: ${err.message}`);
    results.warnings++;
  }
}

// Check frontend integration points
function checkFrontendIntegration() {
  log.section('Frontend Integration');

  const frontendDir = path.join(__dirname, '../../frontend/public');

  // Check product.html has loadProductSpecs
  const productHtmlPath = path.join(frontendDir, 'product.html');
  if (fs.existsSync(productHtmlPath)) {
    const content = fs.readFileSync(productHtmlPath, 'utf8');
    if (content.includes('loadProductSpecs')) {
      log.pass('product.html has loadProductSpecs function');
      results.passed++;
    } else {
      log.fail('product.html missing loadProductSpecs function');
      results.failed++;
    }

    if (content.includes('/api/specs')) {
      log.pass('product.html calls /api/specs endpoint');
      results.passed++;
    } else {
      log.fail('product.html does not call /api/specs');
      results.failed++;
    }
  } else {
    log.fail('product.html not found');
    results.failed++;
  }

  // Check zebra-product.html
  const zebraHtmlPath = path.join(frontendDir, 'zebra-product.html');
  if (fs.existsSync(zebraHtmlPath)) {
    const content = fs.readFileSync(zebraHtmlPath, 'utf8');
    if (content.includes('loadZebraSpecs') || content.includes('/api/specs')) {
      log.pass('zebra-product.html has specs integration');
      results.passed++;
    } else {
      log.warn('zebra-product.html may need specs integration');
      results.warnings++;
    }
  }

  // Check admin specs-library.html exists
  const specsLibraryPath = path.join(frontendDir, 'admin/specs-library.html');
  if (fs.existsSync(specsLibraryPath)) {
    log.pass('Admin specs-library.html exists');
    results.passed++;
  } else {
    log.fail('Admin specs-library.html not found');
    results.failed++;
  }
}

// Check database schema
function checkDatabaseSchema() {
  log.section('Database Schema');

  const dbPath = path.join(__dirname, '../database.json');
  if (!fs.existsSync(dbPath)) {
    log.fail('database.json not found');
    results.failed++;
    return;
  }

  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // Check essential collections
    const collections = ['products', 'categories', 'orders', 'invoices', 'customers'];
    collections.forEach(col => {
      if (Array.isArray(db[col])) {
        log.pass(`${col} collection exists (${db[col].length} items)`);
        results.passed++;
      } else {
        log.fail(`${col} collection missing or invalid`);
        results.failed++;
      }
    });

    // Check manufacturer prices
    if (Array.isArray(db.manufacturerPrices) && db.manufacturerPrices.length > 0) {
      log.pass(`manufacturerPrices has ${db.manufacturerPrices.length} entries`);
      results.passed++;
    } else {
      log.warn('manufacturerPrices may need configuration');
      results.warnings++;
    }

  } catch (err) {
    log.fail(`database.json parse error: ${err.message}`);
    results.failed++;
  }
}

// Main execution
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     PEEKABOO SHADES - QA CHECKLIST               ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // Run all checks
  validateProductSpecs();
  validateContentSources();
  await testApiEndpoints();
  checkFrontendIntegration();
  checkDatabaseSchema();

  // Summary
  log.section('Summary');
  console.log(`\nTotal Checks: ${results.passed + results.failed + results.warnings}`);
  log.pass(`Passed: ${results.passed}`);
  if (results.warnings > 0) log.warn(`Warnings: ${results.warnings}`);
  if (results.failed > 0) log.fail(`Failed: ${results.failed}`);

  // Exit code
  if (results.failed > 0) {
    console.log(`\n${colors.red}QA Check FAILED - Please fix the issues above${colors.reset}`);
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log(`\n${colors.yellow}QA Check PASSED with warnings${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.green}QA Check PASSED - All checks successful!${colors.reset}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('QA Script error:', err);
  process.exit(1);
});
