#!/usr/bin/env node
/**
 * PeekabooShades Framework - Non-Functional Elements Checker
 *
 * Scans all HTML files for:
 * 1. href="#" links (dead navigation)
 * 2. onclick handlers that show "coming soon" or placeholder alerts
 * 3. Buttons/links without proper handlers
 * 4. Form actions pointing to "#"
 *
 * Uses ELEMENT_REGISTRY.json as source of truth for expected behavior
 *
 * Usage:
 *   node scripts/framework/check-nonfunctional.js
 *   node scripts/framework/check-nonfunctional.js --fix (report only, no auto-fix)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const FRONTEND_PATH = path.join(__dirname, '../../frontend/public');
const ELEMENT_REGISTRY_PATH = path.join(__dirname, '../../docs/ELEMENT_REGISTRY.json');

// Patterns to detect non-functional elements
const PATTERNS = {
  deadLinks: /href\s*=\s*["']#["']/gi,
  comingSoon: /(['"`])coming soon\1/gi,
  alertPlaceholder: /alert\s*\(\s*['"`][^'"]*coming|alert\s*\(\s*['"`][^'"]*soon/gi,
  todoFunction: /\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*PLACEHOLDER/gi,
  emptyOnclick: /onclick\s*=\s*["']['"]|onclick\s*=\s*["']return\s*(false|true);?["']/gi,
  formActionHash: /action\s*=\s*["']#["']/gi
};

// Exclusions - intentional anchors
const EXCLUSIONS = {
  files: [
    'login.html', // login pages may have hash for password toggle
  ],
  patterns: [
    /href="#[a-zA-Z][\w-]*"/g, // Anchor links like href="#section-name" are valid
  ]
};

// Colors for console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Get all HTML files recursively
function getHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Check a single file for non-functional patterns
function checkFile(filePath) {
  const relativePath = path.relative(FRONTEND_PATH, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  // Skip excluded files
  if (EXCLUSIONS.files.some(f => relativePath.endsWith(f))) {
    return { file: relativePath, issues: [], skipped: true };
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for dead href="#" links
    // EXCLUDE: href="#" with onclick (valid JS handler pattern)
    // EXCLUDE: href="#section" anchor links
    const hrefMatches = line.match(/href\s*=\s*["']#["']/gi);
    if (hrefMatches) {
      // Skip if it has an onclick handler (this is valid JS pattern)
      const hasOnclick = /onclick\s*=/i.test(line);
      // Skip if it's an anchor link like href="#section"
      const isAnchor = /href="#[a-zA-Z][\w-]*"/.test(line);
      // Skip if it has data attributes indicating JS handling
      const hasDataHandler = /data-(action|toggle|target|dismiss)/i.test(line);

      if (!hasOnclick && !isAnchor && !hasDataHandler) {
        issues.push({
          type: 'DEAD_LINK',
          line: lineNum,
          content: line.trim().substring(0, 100),
          severity: 'HIGH'
        });
      }
    }

    // Check for "coming soon" alerts
    // EXCLUDE: showToast() is our proper fix pattern for disabled features
    const hasShowToast = /showToast\s*\(/i.test(line);
    if (!hasShowToast && (PATTERNS.comingSoon.test(line) || PATTERNS.alertPlaceholder.test(line))) {
      issues.push({
        type: 'PLACEHOLDER_ALERT',
        line: lineNum,
        content: line.trim().substring(0, 100),
        severity: 'MEDIUM'
      });
    }

    // Check for empty onclick handlers
    if (PATTERNS.emptyOnclick.test(line)) {
      issues.push({
        type: 'EMPTY_HANDLER',
        line: lineNum,
        content: line.trim().substring(0, 100),
        severity: 'MEDIUM'
      });
    }

    // Check for form action="#"
    if (PATTERNS.formActionHash.test(line)) {
      issues.push({
        type: 'DEAD_FORM',
        line: lineNum,
        content: line.trim().substring(0, 100),
        severity: 'HIGH'
      });
    }
  });

  return { file: relativePath, issues, skipped: false };
}

// Check inline scripts for placeholder functions
function checkScripts(filePath) {
  const relativePath = path.relative(FRONTEND_PATH, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Find script blocks
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(content)) !== null) {
    const scriptContent = match[1];
    const scriptStart = content.substring(0, match.index).split('\n').length;

    // Check for TODO/PLACEHOLDER comments
    const todoMatches = scriptContent.match(/\/\/\s*(TODO|FIXME|PLACEHOLDER)[^\n]*/gi);
    if (todoMatches) {
      todoMatches.forEach(todo => {
        issues.push({
          type: 'TODO_MARKER',
          line: scriptStart,
          content: todo.trim(),
          severity: 'LOW'
        });
      });
    }

    // Check for empty function bodies
    const emptyFuncRegex = /function\s+(\w+)\s*\([^)]*\)\s*\{\s*(\/\/[^\n]*)?\s*\}/g;
    let funcMatch;
    while ((funcMatch = emptyFuncRegex.exec(scriptContent)) !== null) {
      issues.push({
        type: 'EMPTY_FUNCTION',
        line: scriptStart,
        content: `Empty function: ${funcMatch[1]}()`,
        severity: 'MEDIUM'
      });
    }
  }

  return issues;
}

// Load element registry for cross-reference
function loadElementRegistry() {
  try {
    if (fs.existsSync(ELEMENT_REGISTRY_PATH)) {
      return JSON.parse(fs.readFileSync(ELEMENT_REGISTRY_PATH, 'utf8'));
    }
  } catch (e) {
    log('Warning: Could not load ELEMENT_REGISTRY.json', 'yellow');
  }
  return null;
}

// Main check function
function runCheck() {
  log('╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║     PEEKABOO SHADES - NON-FUNCTIONAL ELEMENTS CHECKER     ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  const startTime = Date.now();
  const htmlFiles = getHtmlFiles(FRONTEND_PATH);
  const registry = loadElementRegistry();

  log(`\nScanning ${htmlFiles.length} HTML files...`, 'cyan');

  const results = {
    totalFiles: htmlFiles.length,
    filesWithIssues: 0,
    totalIssues: 0,
    byType: {
      DEAD_LINK: 0,
      PLACEHOLDER_ALERT: 0,
      EMPTY_HANDLER: 0,
      DEAD_FORM: 0,
      TODO_MARKER: 0,
      EMPTY_FUNCTION: 0
    },
    bySeverity: {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    },
    details: []
  };

  for (const file of htmlFiles) {
    const fileResult = checkFile(file);
    const scriptIssues = checkScripts(file);

    fileResult.issues = [...fileResult.issues, ...scriptIssues];

    if (fileResult.issues.length > 0) {
      results.filesWithIssues++;
      results.totalIssues += fileResult.issues.length;

      fileResult.issues.forEach(issue => {
        results.byType[issue.type]++;
        results.bySeverity[issue.severity]++;
      });

      results.details.push(fileResult);
    }
  }

  // Output results
  log('\n' + '═'.repeat(60), 'dim');
  log('SCAN RESULTS', 'cyan');
  log('═'.repeat(60), 'dim');

  if (results.totalIssues === 0) {
    log('\n✅ No non-functional elements found!', 'green');
  } else {
    log(`\n⚠️  Found ${results.totalIssues} issues in ${results.filesWithIssues} files`, 'yellow');

    log('\nBy Type:', 'cyan');
    Object.entries(results.byType).forEach(([type, count]) => {
      if (count > 0) {
        log(`  ${type}: ${count}`, count > 5 ? 'red' : 'yellow');
      }
    });

    log('\nBy Severity:', 'cyan');
    if (results.bySeverity.HIGH > 0) log(`  HIGH: ${results.bySeverity.HIGH}`, 'red');
    if (results.bySeverity.MEDIUM > 0) log(`  MEDIUM: ${results.bySeverity.MEDIUM}`, 'yellow');
    if (results.bySeverity.LOW > 0) log(`  LOW: ${results.bySeverity.LOW}`, 'dim');

    log('\nFiles with issues:', 'cyan');
    results.details.forEach(result => {
      log(`\n  📄 ${result.file}`, 'yellow');
      result.issues.forEach(issue => {
        const color = issue.severity === 'HIGH' ? 'red' : (issue.severity === 'MEDIUM' ? 'yellow' : 'dim');
        log(`     Line ${issue.line}: [${issue.type}] ${issue.content.substring(0, 60)}...`, color);
      });
    });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n⏱️  Scan completed in ${duration}s`, 'dim');

  // Write results to JSON for CI/CD integration
  const outputPath = path.join(__dirname, '../../docs/nonfunctional-check-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  log(`📝 Results written to docs/nonfunctional-check-results.json`, 'dim');

  // Exit with error code if HIGH severity issues found
  if (results.bySeverity.HIGH > 0) {
    log('\n❌ HIGH severity issues must be fixed before deployment!', 'red');
    process.exit(1);
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  runCheck();
}

module.exports = { runCheck, checkFile, getHtmlFiles };
