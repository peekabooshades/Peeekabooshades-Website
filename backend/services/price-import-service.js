/**
 * PEEKABOO SHADES - PRICE IMPORT SERVICE
 * =======================================
 *
 * Handles importing manufacturer prices from:
 * - PDF files (price tables)
 * - CSV files (fallback/manual correction)
 *
 * Features:
 * - PDF table extraction
 * - CSV parsing and validation
 * - Price matrix generation
 * - Import logging and error handling
 * - Diff detection for re-imports
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * PriceImportService Class
 */
class PriceImportService {
  constructor() {
    this.supportedPdfTypes = ['pdf'];
    this.supportedCsvTypes = ['csv', 'xlsx'];
  }

  /**
   * Load database
   */
  loadDatabase() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading database:', error);
      return null;
    }
  }

  /**
   * Save database
   */
  saveDatabase(db) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving database:', error);
      return false;
    }
  }

  /**
   * Scan directory for price files
   */
  scanDirectory(dirPath) {
    const files = [];

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().slice(1);
          const fullPath = path.join(dirPath, entry.name);
          const stats = fs.statSync(fullPath);

          // Check if it's a price-related file
          const isPriceFile = this.isPriceFile(entry.name);

          files.push({
            name: entry.name,
            path: fullPath,
            extension: ext,
            size: stats.size,
            modifiedAt: stats.mtime,
            isPriceFile,
            isSupported: [...this.supportedPdfTypes, ...this.supportedCsvTypes].includes(ext)
          });
        }
      }
    } catch (error) {
      console.error('Error scanning directory:', error);
    }

    return files.filter(f => f.isPriceFile && f.isSupported);
  }

  /**
   * Check if file is likely a price file based on name
   */
  isPriceFile(fileName) {
    const lowerName = fileName.toLowerCase();
    const priceKeywords = [
      'price', 'pricing', 'quotation', 'quote', 'wholesale',
      'cost', 'pi ', 'invoice', 'blind', 'roller', 'zebra',
      'honeycomb', 'roman', 'shade', 'fabric'
    ];

    return priceKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Import prices from PDF file
   * Uses basic text extraction - for complex tables, CSV fallback is recommended
   */
  async importFromPDF(filePath, options = {}) {
    const {
      manufacturerId = 'mfr-default',
      productType = 'roller',
      userId = 'system'
    } = options;

    const fileName = path.basename(filePath);
    const importLogId = uuidv4();
    const startedAt = new Date().toISOString();

    const importLog = {
      id: importLogId,
      importType: 'pdf',
      fileName,
      filePath,
      status: 'processing',
      recordsFound: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      errors: [],
      warnings: [],
      manufacturerId,
      processedBy: userId,
      startedAt,
      completedAt: null,
      createdAt: startedAt
    };

    try {
      // Try to dynamically load pdf-parse
      let pdfParse;
      try {
        pdfParse = require('pdf-parse');
      } catch (e) {
        // pdf-parse not installed, use fallback
        importLog.status = 'failed';
        importLog.errors.push('PDF parsing library not installed. Please use CSV import instead or install pdf-parse: npm install pdf-parse');
        importLog.completedAt = new Date().toISOString();

        this.saveImportLog(importLog);
        return {
          success: false,
          error: 'PDF parsing not available. Use CSV import instead.',
          importLog
        };
      }

      // Read and parse PDF
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      const text = pdfData.text;

      // Extract price data from text
      const extractedPrices = this.extractPricesFromText(text, productType);

      importLog.recordsFound = extractedPrices.length;

      if (extractedPrices.length === 0) {
        importLog.status = 'completed';
        importLog.warnings.push('No price data found in PDF. Consider using CSV import for better results.');
        importLog.completedAt = new Date().toISOString();

        this.saveImportLog(importLog);
        return {
          success: true,
          message: 'PDF processed but no price data extracted. Use CSV for complex tables.',
          importLog,
          extractedPrices: []
        };
      }

      // Save extracted prices to database
      const db = this.loadDatabase();
      if (!db) {
        throw new Error('Database unavailable');
      }

      const savedPrices = [];
      for (const priceData of extractedPrices) {
        try {
          const priceRecord = {
            id: uuidv4(),
            manufacturerId,
            productType,
            fabricCode: priceData.fabricCode || 'UNKNOWN',
            fabricName: priceData.fabricName || '',
            fabricCategory: priceData.fabricCategory || 'light_filtering',
            widthMin: priceData.widthMin || 12,
            widthMax: priceData.widthMax || 144,
            heightMin: priceData.heightMin || 12,
            heightMax: priceData.heightMax || 120,
            priceMatrix: priceData.priceMatrix || [],
            basePrice: priceData.basePrice || 0,
            pricePerSqFt: priceData.pricePerSqFt || null,
            importSource: 'pdf',
            importFile: fileName,
            importDate: startedAt,
            effectiveDate: new Date().toISOString().split('T')[0],
            expirationDate: null,
            status: 'active',
            notes: `Imported from PDF: ${fileName}`,
            createdAt: startedAt,
            updatedAt: startedAt,
            createdBy: userId
          };

          db.manufacturerPrices.push(priceRecord);
          savedPrices.push(priceRecord);
          importLog.recordsImported++;
        } catch (err) {
          importLog.recordsFailed++;
          importLog.errors.push(`Failed to save price record: ${err.message}`);
        }
      }

      this.saveDatabase(db);

      importLog.status = 'completed';
      importLog.completedAt = new Date().toISOString();
      this.saveImportLog(importLog);

      return {
        success: true,
        message: `Imported ${savedPrices.length} price records from PDF`,
        importLog,
        extractedPrices: savedPrices
      };

    } catch (error) {
      importLog.status = 'failed';
      importLog.errors.push(error.message);
      importLog.completedAt = new Date().toISOString();

      this.saveImportLog(importLog);

      return {
        success: false,
        error: error.message,
        importLog
      };
    }
  }

  /**
   * Extract prices from PDF text
   * Basic pattern matching - works for simple price tables
   */
  extractPricesFromText(text, productType) {
    const prices = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Pattern to match fabric codes (like 82032A, ZM-0404)
    const fabricCodePattern = /\b([A-Z]{0,3}\d{4,6}[A-Z]?|[A-Z]{2}-\d{4})\b/gi;

    // Pattern to match prices ($XX.XX or XX.XX)
    const pricePattern = /\$?\d+\.?\d{0,2}/g;

    // Pattern to match dimensions (WxH format or separate W/H)
    const dimensionPattern = /(\d+)\s*[xX×]\s*(\d+)/;

    let currentFabricCode = null;
    let currentPrices = [];

    for (const line of lines) {
      // Look for fabric codes
      const fabricMatch = line.match(fabricCodePattern);
      if (fabricMatch) {
        // Save previous fabric's prices
        if (currentFabricCode && currentPrices.length > 0) {
          prices.push({
            fabricCode: currentFabricCode,
            fabricName: '',
            fabricCategory: this.guessFabricCategory(line),
            basePrice: currentPrices[0],
            priceMatrix: this.buildPriceMatrix(currentPrices)
          });
        }

        currentFabricCode = fabricMatch[0];
        currentPrices = [];
      }

      // Look for prices on the line
      const priceMatches = line.match(pricePattern);
      if (priceMatches) {
        const numericPrices = priceMatches
          .map(p => parseFloat(p.replace('$', '')))
          .filter(p => p > 0 && p < 10000); // reasonable price range

        currentPrices.push(...numericPrices);
      }
    }

    // Don't forget the last fabric
    if (currentFabricCode && currentPrices.length > 0) {
      prices.push({
        fabricCode: currentFabricCode,
        fabricName: '',
        fabricCategory: 'light_filtering',
        basePrice: currentPrices[0],
        priceMatrix: this.buildPriceMatrix(currentPrices)
      });
    }

    return prices;
  }

  /**
   * Build price matrix from extracted prices
   */
  buildPriceMatrix(prices) {
    if (prices.length === 0) return [];
    if (prices.length === 1) {
      return [{ widthRange: [12, 144], heightRange: [12, 120], price: prices[0] }];
    }

    // Create a simple matrix based on price count
    // Assumes prices are in width increments
    const matrix = [];
    const widthIncrements = [24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144];

    for (let i = 0; i < Math.min(prices.length, widthIncrements.length); i++) {
      matrix.push({
        widthRange: [i === 0 ? 12 : widthIncrements[i - 1], widthIncrements[i]],
        heightRange: [12, 120],
        price: prices[i]
      });
    }

    return matrix;
  }

  /**
   * Guess fabric category from text
   */
  guessFabricCategory(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('blackout') || lowerText.includes('100%')) {
      return 'blackout';
    }
    if (lowerText.includes('super') && lowerText.includes('blackout')) {
      return 'super_blackout';
    }
    if (lowerText.includes('semi') || lowerText.includes('room dark')) {
      return 'semi_blackout';
    }
    if (lowerText.includes('transparent') || lowerText.includes('sheer')) {
      return 'transparent';
    }

    return 'light_filtering';
  }

  /**
   * Import prices from CSV file
   * Recommended for accurate price imports
   */
  async importFromCSV(filePath, options = {}) {
    const {
      manufacturerId = 'mfr-default',
      productType = 'roller',
      userId = 'system',
      delimiter = ',',
      hasHeader = true
    } = options;

    const fileName = path.basename(filePath);
    const importLogId = uuidv4();
    const startedAt = new Date().toISOString();

    const importLog = {
      id: importLogId,
      importType: 'csv',
      fileName,
      filePath,
      status: 'processing',
      recordsFound: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      errors: [],
      warnings: [],
      manufacturerId,
      processedBy: userId,
      startedAt,
      completedAt: null,
      createdAt: startedAt
    };

    try {
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse header
      const headerLine = hasHeader ? lines[0] : null;
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const headers = headerLine
        ? headerLine.split(delimiter).map(h => h.trim().toLowerCase())
        : ['fabric_code', 'fabric_name', 'category', 'base_price', 'width_min', 'width_max', 'height_min', 'height_max'];

      importLog.recordsFound = dataLines.length;

      const db = this.loadDatabase();
      if (!db) {
        throw new Error('Database unavailable');
      }

      const savedPrices = [];

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) {
          importLog.recordsSkipped++;
          continue;
        }

        try {
          const values = this.parseCSVLine(line, delimiter);
          const record = this.mapCSVToPrice(headers, values, {
            manufacturerId,
            productType,
            fileName,
            userId,
            startedAt
          });

          if (!record.fabricCode || record.basePrice <= 0) {
            importLog.recordsSkipped++;
            importLog.warnings.push(`Row ${i + 2}: Invalid data - missing fabric code or price`);
            continue;
          }

          // Check for duplicates
          const existingIndex = db.manufacturerPrices.findIndex(
            p => p.fabricCode === record.fabricCode &&
                 p.manufacturerId === manufacturerId &&
                 p.productType === productType
          );

          if (existingIndex >= 0) {
            // Update existing record
            record.id = db.manufacturerPrices[existingIndex].id;
            record.updatedAt = startedAt;
            db.manufacturerPrices[existingIndex] = record;
            importLog.warnings.push(`Row ${i + 2}: Updated existing price for ${record.fabricCode}`);
          } else {
            db.manufacturerPrices.push(record);
          }

          savedPrices.push(record);
          importLog.recordsImported++;
        } catch (err) {
          importLog.recordsFailed++;
          importLog.errors.push(`Row ${i + 2}: ${err.message}`);
        }
      }

      this.saveDatabase(db);

      importLog.status = 'completed';
      importLog.completedAt = new Date().toISOString();
      this.saveImportLog(importLog);

      return {
        success: true,
        message: `Imported ${savedPrices.length} price records from CSV`,
        importLog,
        extractedPrices: savedPrices
      };

    } catch (error) {
      importLog.status = 'failed';
      importLog.errors.push(error.message);
      importLog.completedAt = new Date().toISOString();

      this.saveImportLog(importLog);

      return {
        success: false,
        error: error.message,
        importLog
      };
    }
  }

  /**
   * Parse CSV line handling quoted values
   */
  parseCSVLine(line, delimiter = ',') {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Map CSV values to price record
   */
  mapCSVToPrice(headers, values, options) {
    const getValue = (key) => {
      const index = headers.indexOf(key);
      return index >= 0 && index < values.length ? values[index] : null;
    };

    const parseNumber = (val) => {
      if (!val) return 0;
      const num = parseFloat(val.replace(/[$,]/g, ''));
      return isNaN(num) ? 0 : num;
    };

    return {
      id: uuidv4(),
      manufacturerId: options.manufacturerId,
      productType: options.productType,
      fabricCode: getValue('fabric_code') || getValue('fabriccode') || getValue('code') || '',
      fabricName: getValue('fabric_name') || getValue('fabricname') || getValue('name') || '',
      fabricCategory: getValue('category') || getValue('type') || 'light_filtering',
      widthMin: parseNumber(getValue('width_min') || getValue('widthmin')) || 12,
      widthMax: parseNumber(getValue('width_max') || getValue('widthmax')) || 144,
      heightMin: parseNumber(getValue('height_min') || getValue('heightmin')) || 12,
      heightMax: parseNumber(getValue('height_max') || getValue('heightmax')) || 120,
      priceMatrix: [],
      basePrice: parseNumber(getValue('base_price') || getValue('baseprice') || getValue('price') || getValue('cost')),
      pricePerSqFt: parseNumber(getValue('price_per_sqft') || getValue('sqft_price')),
      importSource: 'csv',
      importFile: options.fileName,
      importDate: options.startedAt,
      effectiveDate: getValue('effective_date') || new Date().toISOString().split('T')[0],
      expirationDate: getValue('expiration_date') || null,
      status: 'active',
      notes: getValue('notes') || `Imported from CSV: ${options.fileName}`,
      createdAt: options.startedAt,
      updatedAt: options.startedAt,
      createdBy: options.userId
    };
  }

  /**
   * Save import log to database
   */
  saveImportLog(importLog) {
    const db = this.loadDatabase();
    if (!db) return false;

    if (!db.priceImportLogs) {
      db.priceImportLogs = [];
    }

    const existingIndex = db.priceImportLogs.findIndex(l => l.id === importLog.id);
    if (existingIndex >= 0) {
      db.priceImportLogs[existingIndex] = importLog;
    } else {
      db.priceImportLogs.push(importLog);
    }

    return this.saveDatabase(db);
  }

  /**
   * Get import history
   */
  getImportHistory(options = {}) {
    const { limit = 50, status = null, manufacturerId = null } = options;

    const db = this.loadDatabase();
    if (!db || !db.priceImportLogs) return [];

    let logs = [...db.priceImportLogs];

    if (status) {
      logs = logs.filter(l => l.status === status);
    }

    if (manufacturerId) {
      logs = logs.filter(l => l.manufacturerId === manufacturerId);
    }

    // Sort by date descending
    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return logs.slice(0, limit);
  }

  /**
   * Get manufacturer prices
   */
  getManufacturerPrices(options = {}) {
    const { manufacturerId = null, productType = null, fabricCode = null, status = 'active' } = options;

    const db = this.loadDatabase();
    if (!db || !db.manufacturerPrices) return [];

    let prices = [...db.manufacturerPrices];

    if (manufacturerId) {
      prices = prices.filter(p => p.manufacturerId === manufacturerId);
    }

    if (productType) {
      prices = prices.filter(p => p.productType === productType);
    }

    if (fabricCode) {
      prices = prices.filter(p => p.fabricCode === fabricCode);
    }

    if (status) {
      prices = prices.filter(p => p.status === status);
    }

    return prices;
  }

  /**
   * Generate CSV template for manual import
   */
  generateCSVTemplate(productType = 'roller') {
    const headers = [
      'fabric_code',
      'fabric_name',
      'category',
      'base_price',
      'width_min',
      'width_max',
      'height_min',
      'height_max',
      'price_per_sqft',
      'effective_date',
      'notes'
    ];

    const exampleRows = [
      ['82032A', 'Light Filtering White', 'light_filtering', '25.00', '12', '144', '12', '120', '', '2025-01-01', 'Example row'],
      ['82033B', 'Blackout Gray', 'blackout', '35.00', '12', '144', '12', '120', '', '2025-01-01', ''],
      ['ZM-0404', 'Zebra Premium', 'light_filtering', '45.00', '12', '120', '12', '96', '', '2025-01-01', '']
    ];

    let csv = headers.join(',') + '\n';
    for (const row of exampleRows) {
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Compare two imports and show differences
   */
  compareImports(importId1, importId2) {
    const db = this.loadDatabase();
    if (!db || !db.manufacturerPrices) return null;

    const prices1 = db.manufacturerPrices.filter(p => p.importFile === importId1);
    const prices2 = db.manufacturerPrices.filter(p => p.importFile === importId2);

    const changes = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    // Create maps for comparison
    const map1 = new Map(prices1.map(p => [p.fabricCode, p]));
    const map2 = new Map(prices2.map(p => [p.fabricCode, p]));

    // Find added and modified
    for (const [code, price2] of map2) {
      const price1 = map1.get(code);
      if (!price1) {
        changes.added.push(price2);
      } else if (price1.basePrice !== price2.basePrice) {
        changes.modified.push({
          fabricCode: code,
          oldPrice: price1.basePrice,
          newPrice: price2.basePrice,
          difference: price2.basePrice - price1.basePrice,
          percentChange: ((price2.basePrice - price1.basePrice) / price1.basePrice * 100).toFixed(2)
        });
      } else {
        changes.unchanged.push(code);
      }
    }

    // Find removed
    for (const [code] of map1) {
      if (!map2.has(code)) {
        changes.removed.push(map1.get(code));
      }
    }

    return changes;
  }
}

// Singleton instance
const priceImportService = new PriceImportService();

module.exports = { priceImportService, PriceImportService };
