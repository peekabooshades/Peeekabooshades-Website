/**
 * PEEKABOO SHADES - EXCEL PRICING SERVICE
 * ========================================
 *
 * Handles Excel template generation and parsing for manufacturer pricing.
 * Supports 4 sheets: Fabrics, Hardware, Motors, Accessories
 *
 * Used by both Admin Panel and Manufacturer Portal
 */

const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { loadDB, saveDB } = require('./db-loader');

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

const TEMPLATE_SHEETS = {
  fabrics: {
    name: 'Fabric Pricing',
    headers: [
      { key: 'fabricCode', label: 'Fabric Code', required: true, example: '82032A' },
      { key: 'fabricName', label: 'Fabric Name', required: true, example: 'Light Filtering White' },
      { key: 'productType', label: 'Product Type', required: true, example: 'roller', values: ['roller', 'zebra', 'honeycomb', 'roman'] },
      { key: 'fabricCategory', label: 'Fabric Category', required: false, example: 'light_filtering', values: ['light_filtering', 'blackout', 'semi_blackout', 'super_blackout'] },
      { key: 'pricePerSqMeterManual', label: 'Price/SqM (Manual)', required: true, example: '15.50' },
      { key: 'pricePerSqMeterCordless', label: 'Price/SqM (Cordless)', required: false, example: '18.00' },
      { key: 'pricePerSqMeterMotorized', label: 'Price/SqM (Motorized)', required: false, example: '22.00' },
      { key: 'minAreaSqMeter', label: 'Min Area (SqM)', required: false, example: '1.2' },
      { key: 'widthMin', label: 'Width Min (inches)', required: false, example: '12' },
      { key: 'widthMax', label: 'Width Max (inches)', required: false, example: '144' },
      { key: 'heightMin', label: 'Height Min (inches)', required: false, example: '12' },
      { key: 'heightMax', label: 'Height Max (inches)', required: false, example: '120' },
      { key: 'manualMargin', label: 'Manual Margin %', required: false, example: '40' },
      { key: 'cordlessMargin', label: 'Cordless Margin %', required: false, example: '45' },
      { key: 'motorizedMargin', label: 'Motorized Margin %', required: false, example: '50' },
      { key: 'status', label: 'Status', required: false, example: 'active', values: ['active', 'inactive'] },
      { key: 'effectiveDate', label: 'Effective Date', required: false, example: '2025-01-01' },
      { key: 'notes', label: 'Notes', required: false, example: '' }
    ]
  },
  hardware: {
    name: 'Hardware Pricing',
    headers: [
      { key: 'productType', label: 'Product Type', required: true, example: 'roller', values: ['roller', 'zebra', 'honeycomb', 'roman', 'all'] },
      { key: 'category', label: 'Category', required: true, example: 'valanceType', values: ['valanceType', 'bottomRail', 'mountType', 'chainType', 'bracketType'] },
      { key: 'optionCode', label: 'Option Code', required: true, example: 'fabric-wrapped' },
      { key: 'optionName', label: 'Option Name', required: true, example: 'Fabric Wrapped Valance' },
      { key: 'manufacturerCost', label: 'Manufacturer Cost', required: true, example: '8.50' },
      { key: 'priceType', label: 'Price Type', required: false, example: 'flat', values: ['flat', 'sqm'] },
      { key: 'status', label: 'Status', required: false, example: 'active', values: ['active', 'inactive'] },
      { key: 'effectiveDate', label: 'Effective Date', required: false, example: '2025-01-01' },
      { key: 'notes', label: 'Notes', required: false, example: '' }
    ]
  },
  motors: {
    name: 'Motor Pricing',
    headers: [
      { key: 'brandCode', label: 'Brand Code', required: true, example: 'aok', values: ['aok', 'dooya', 'plugin-wire'] },
      { key: 'brandName', label: 'Brand Name', required: true, example: 'AOK' },
      { key: 'motorType', label: 'Motor Type', required: false, example: 'standard' },
      { key: 'manufacturerCost', label: 'Manufacturer Cost', required: true, example: '45.00' },
      { key: 'status', label: 'Status', required: false, example: 'active', values: ['active', 'inactive'] },
      { key: 'effectiveDate', label: 'Effective Date', required: false, example: '2025-01-01' },
      { key: 'notes', label: 'Notes', required: false, example: '' }
    ]
  },
  accessories: {
    name: 'Accessories Pricing',
    headers: [
      { key: 'itemType', label: 'Item Type', required: true, example: 'remote', values: ['remote', 'solar', 'accessory', 'hub', 'charger'] },
      { key: 'itemCode', label: 'Item Code', required: true, example: '15-channel' },
      { key: 'itemName', label: 'Item Name', required: true, example: '15 Channel Remote' },
      { key: 'manufacturerCost', label: 'Manufacturer Cost', required: true, example: '25.00' },
      { key: 'status', label: 'Status', required: false, example: 'active', values: ['active', 'inactive'] },
      { key: 'effectiveDate', label: 'Effective Date', required: false, example: '2025-01-01' },
      { key: 'notes', label: 'Notes', required: false, example: '' }
    ]
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Load database
 */
function loadDatabase() {
  try {
    return loadDB();
  } catch (error) {
    console.error('Error loading database:', error);
    return null;
  }
}

/**
 * Save database
 */
function saveDatabase(db) {
  try {
    saveDB(db);
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    return false;
  }
}

/**
 * Parse a value to float, return null if invalid
 */
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse date string
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

// ============================================
// TEMPLATE GENERATION
// ============================================

/**
 * Generate Excel template for manufacturer pricing
 * @param {string} manufacturerId - Manufacturer ID
 * @param {boolean} includeExistingData - Whether to include existing pricing data
 * @returns {Buffer} Excel file buffer
 */
function generatePricingTemplate(manufacturerId, includeExistingData = false) {
  const workbook = XLSX.utils.book_new();
  const db = loadDatabase();

  // Generate each sheet
  for (const [sheetKey, sheetConfig] of Object.entries(TEMPLATE_SHEETS)) {
    const sheetData = [];

    // Add header row
    const headerRow = sheetConfig.headers.map(h => h.label);
    sheetData.push(headerRow);

    // Add instruction row
    const instructionRow = sheetConfig.headers.map(h => {
      let instruction = h.required ? '(Required)' : '(Optional)';
      if (h.values) {
        instruction += ` Values: ${h.values.join(', ')}`;
      }
      return instruction;
    });
    sheetData.push(instructionRow);

    // Add example row
    const exampleRow = sheetConfig.headers.map(h => h.example);
    sheetData.push(exampleRow);

    // Add existing data if requested
    if (includeExistingData && db && manufacturerId) {
      const existingData = getExistingPricingData(db, manufacturerId, sheetKey);
      existingData.forEach(record => {
        const row = sheetConfig.headers.map(h => record[h.key] || '');
        sheetData.push(row);
      });
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    const colWidths = sheetConfig.headers.map(h => ({ wch: Math.max(h.label.length, 15) }));
    worksheet['!cols'] = colWidths;

    // Style header row (note: XLSX community edition has limited styling)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetConfig.name);
  }

  // Add Instructions sheet
  const instructionsData = [
    ['PEEKABOO SHADES - PRICING TEMPLATE INSTRUCTIONS'],
    [''],
    ['GENERAL GUIDELINES:'],
    ['- Row 1 contains column headers - DO NOT MODIFY'],
    ['- Row 2 contains field instructions and valid values'],
    ['- Row 3 contains example data - you can delete or modify this row'],
    ['- Start adding your data from Row 4'],
    ['- Required fields must be filled in for the record to be imported'],
    ['- Leave optional fields blank if not applicable'],
    [''],
    ['SHEET DESCRIPTIONS:'],
    [''],
    ['1. Fabric Pricing:'],
    ['   - Main pricing for fabric by product type and control method'],
    ['   - Prices are per square meter'],
    ['   - Specify different prices for Manual, Cordless, and Motorized'],
    [''],
    ['2. Hardware Pricing:'],
    ['   - Valance types, bottom rails, mount types, etc.'],
    ['   - Can be flat price or per square meter'],
    [''],
    ['3. Motor Pricing:'],
    ['   - Motor brands (AOK, Dooya, Plug-in Wire)'],
    ['   - Cost per motor unit'],
    [''],
    ['4. Accessories Pricing:'],
    ['   - Remotes, solar panels, smart hubs, chargers, etc.'],
    ['   - Cost per accessory item'],
    [''],
    ['PRODUCT TYPES:'],
    ['- roller: Roller Blinds'],
    ['- zebra: Zebra/Dual Shades'],
    ['- honeycomb: Honeycomb/Cellular Shades'],
    ['- roman: Roman Shades'],
    ['- all: Applies to all product types'],
    [''],
    ['NOTES:'],
    ['- Existing prices with same fabric/option code will be updated'],
    ['- New fabric/option codes will be added'],
    ['- Status "inactive" will hide the option from customers'],
    ['- Effective Date determines when pricing takes effect']
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Get existing pricing data for a manufacturer
 */
function getExistingPricingData(db, manufacturerId, sheetKey) {
  switch (sheetKey) {
    case 'fabrics':
      return (db.manufacturerPrices || []).filter(p => p.manufacturerId === manufacturerId);
    case 'hardware':
      return (db.manufacturerHardwarePrices || []).filter(p => p.manufacturerId === manufacturerId);
    case 'motors':
      return (db.manufacturerMotorPrices || []).filter(p => p.manufacturerId === manufacturerId);
    case 'accessories':
      return (db.manufacturerAccessoryPrices || []).filter(p => p.manufacturerId === manufacturerId);
    default:
      return [];
  }
}

// ============================================
// EXCEL PARSING & IMPORT
// ============================================

/**
 * Parse uploaded Excel file and import pricing data
 * @param {Buffer|string} fileBuffer - Excel file buffer or path
 * @param {string} manufacturerId - Manufacturer ID
 * @param {Object} uploadedBy - User info { id, email, role }
 * @returns {Object} Import result with summary, errors, warnings
 */
function importPricingFromExcel(fileBuffer, manufacturerId, uploadedBy) {
  const db = loadDatabase();
  if (!db) {
    return { success: false, error: 'Failed to load database' };
  }

  // Verify manufacturer exists
  const manufacturer = (db.manufacturers || []).find(m => m.id === manufacturerId);
  if (!manufacturer) {
    return { success: false, error: 'Manufacturer not found' };
  }

  // Initialize collections if they don't exist
  if (!db.manufacturerPrices) db.manufacturerPrices = [];
  if (!db.manufacturerHardwarePrices) db.manufacturerHardwarePrices = [];
  if (!db.manufacturerMotorPrices) db.manufacturerMotorPrices = [];
  if (!db.manufacturerAccessoryPrices) db.manufacturerAccessoryPrices = [];
  if (!db.pricingUploadHistory) db.pricingUploadHistory = [];

  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (error) {
    return { success: false, error: `Failed to parse Excel file: ${error.message}` };
  }

  const result = {
    success: true,
    summary: {
      fabricsProcessed: 0,
      fabricsCreated: 0,
      fabricsUpdated: 0,
      hardwareProcessed: 0,
      hardwareCreated: 0,
      hardwareUpdated: 0,
      motorsProcessed: 0,
      motorsCreated: 0,
      motorsUpdated: 0,
      accessoriesProcessed: 0,
      accessoriesCreated: 0,
      accessoriesUpdated: 0,
      errors: 0,
      warnings: 0
    },
    errors: [],
    warnings: []
  };

  const now = new Date().toISOString();

  // Process each sheet
  for (const [sheetKey, sheetConfig] of Object.entries(TEMPLATE_SHEETS)) {
    const worksheet = workbook.Sheets[sheetConfig.name];
    if (!worksheet) continue;

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Skip header (row 0), instructions (row 1), and example (row 2)
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every(cell => !cell)) continue;

      const rowNum = i + 1;
      const record = {};
      let hasRequiredFields = true;

      // Parse each column
      sheetConfig.headers.forEach((header, colIndex) => {
        const value = row[colIndex];

        if (header.required && (value === null || value === undefined || value === '')) {
          result.errors.push({
            row: rowNum,
            sheet: sheetConfig.name,
            message: `Missing required field: ${header.label}`
          });
          hasRequiredFields = false;
        }

        // Validate enum values
        if (value && header.values && !header.values.includes(String(value).toLowerCase())) {
          result.warnings.push({
            row: rowNum,
            sheet: sheetConfig.name,
            message: `Invalid value for ${header.label}: "${value}". Expected: ${header.values.join(', ')}`
          });
        }

        // Parse value based on field type
        if (header.key.includes('Price') || header.key.includes('Cost') || header.key.includes('Margin')) {
          record[header.key] = parseNumber(value);
        } else if (header.key.includes('Min') || header.key.includes('Max') || header.key === 'minAreaSqMeter') {
          record[header.key] = parseNumber(value);
        } else if (header.key === 'effectiveDate') {
          record[header.key] = parseDate(value);
        } else {
          record[header.key] = value ? String(value).trim() : null;
        }
      });

      if (!hasRequiredFields) {
        result.summary.errors++;
        continue;
      }

      // Import record based on sheet type
      try {
        switch (sheetKey) {
          case 'fabrics':
            importFabricRecord(db, manufacturerId, record, result, now, uploadedBy);
            break;
          case 'hardware':
            importHardwareRecord(db, manufacturerId, record, result, now, uploadedBy);
            break;
          case 'motors':
            importMotorRecord(db, manufacturerId, record, result, now, uploadedBy);
            break;
          case 'accessories':
            importAccessoryRecord(db, manufacturerId, record, result, now, uploadedBy);
            break;
        }
      } catch (error) {
        result.errors.push({
          row: rowNum,
          sheet: sheetConfig.name,
          message: `Import error: ${error.message}`
        });
        result.summary.errors++;
      }
    }
  }

  // Update manufacturer pricing stats
  const mfrIndex = db.manufacturers.findIndex(m => m.id === manufacturerId);
  if (mfrIndex !== -1) {
    db.manufacturers[mfrIndex].pricingStats = {
      totalFabrics: (db.manufacturerPrices || []).filter(p => p.manufacturerId === manufacturerId).length,
      totalHardware: (db.manufacturerHardwarePrices || []).filter(p => p.manufacturerId === manufacturerId).length,
      totalMotors: (db.manufacturerMotorPrices || []).filter(p => p.manufacturerId === manufacturerId).length,
      totalAccessories: (db.manufacturerAccessoryPrices || []).filter(p => p.manufacturerId === manufacturerId).length,
      lastUploadAt: now,
      lastUploadBy: uploadedBy.email,
      lastUploadFile: null // Will be set by caller
    };
    db.manufacturers[mfrIndex].updatedAt = now;
  }

  // Save database
  if (!saveDatabase(db)) {
    return { success: false, error: 'Failed to save database' };
  }

  result.summary.warnings = result.warnings.length;
  return result;
}

/**
 * Import a fabric pricing record
 */
function importFabricRecord(db, manufacturerId, record, result, now, uploadedBy) {
  const fabricCode = record.fabricCode;
  const productType = (record.productType || '').toLowerCase();

  if (!fabricCode || !productType) return;

  // Find existing record
  const existingIndex = db.manufacturerPrices.findIndex(
    p => p.manufacturerId === manufacturerId &&
         p.fabricCode === fabricCode &&
         p.productType === productType
  );

  const priceRecord = {
    manufacturerId,
    productType,
    fabricCode,
    fabricName: record.fabricName || fabricCode,
    fabricCategory: record.fabricCategory || 'light_filtering',
    pricePerSqMeterManual: record.pricePerSqMeterManual,
    pricePerSqMeterCordless: record.pricePerSqMeterCordless || record.pricePerSqMeterManual,
    pricePerSqMeterMotorized: record.pricePerSqMeterMotorized || record.pricePerSqMeterManual,
    minAreaSqMeter: record.minAreaSqMeter || 1.2,
    widthMin: record.widthMin || 12,
    widthMax: record.widthMax || 144,
    heightMin: record.heightMin || 12,
    heightMax: record.heightMax || 120,
    manualMargin: record.manualMargin || 40,
    cordlessMargin: record.cordlessMargin || 45,
    motorizedMargin: record.motorizedMargin || 50,
    status: record.status || 'active',
    effectiveDate: record.effectiveDate || now.split('T')[0],
    notes: record.notes || '',
    updatedAt: now,
    updatedBy: uploadedBy.id
  };

  if (existingIndex !== -1) {
    // Update existing
    priceRecord.id = db.manufacturerPrices[existingIndex].id;
    priceRecord.createdAt = db.manufacturerPrices[existingIndex].createdAt;
    priceRecord.createdBy = db.manufacturerPrices[existingIndex].createdBy;
    db.manufacturerPrices[existingIndex] = priceRecord;
    result.summary.fabricsUpdated++;
  } else {
    // Create new
    priceRecord.id = `mp-${uuidv4().substring(0, 8)}`;
    priceRecord.createdAt = now;
    priceRecord.createdBy = uploadedBy.id;
    db.manufacturerPrices.push(priceRecord);
    result.summary.fabricsCreated++;
  }

  result.summary.fabricsProcessed++;
}

/**
 * Import a hardware pricing record
 */
function importHardwareRecord(db, manufacturerId, record, result, now, uploadedBy) {
  const optionCode = record.optionCode;
  const productType = (record.productType || '').toLowerCase();
  const category = record.category;

  if (!optionCode || !productType || !category) return;

  // Find existing record
  const existingIndex = db.manufacturerHardwarePrices.findIndex(
    p => p.manufacturerId === manufacturerId &&
         p.optionCode === optionCode &&
         p.productType === productType &&
         p.category === category
  );

  const priceRecord = {
    manufacturerId,
    productType,
    category,
    optionCode,
    optionName: record.optionName || optionCode,
    manufacturerCost: record.manufacturerCost,
    priceType: record.priceType || 'flat',
    status: record.status || 'active',
    effectiveDate: record.effectiveDate || now.split('T')[0],
    notes: record.notes || '',
    updatedAt: now,
    updatedBy: uploadedBy.id
  };

  if (existingIndex !== -1) {
    // Update existing
    priceRecord.id = db.manufacturerHardwarePrices[existingIndex].id;
    priceRecord.createdAt = db.manufacturerHardwarePrices[existingIndex].createdAt;
    priceRecord.createdBy = db.manufacturerHardwarePrices[existingIndex].createdBy;
    db.manufacturerHardwarePrices[existingIndex] = priceRecord;
    result.summary.hardwareUpdated++;
  } else {
    // Create new
    priceRecord.id = `mhp-${uuidv4().substring(0, 8)}`;
    priceRecord.createdAt = now;
    priceRecord.createdBy = uploadedBy.id;
    db.manufacturerHardwarePrices.push(priceRecord);
    result.summary.hardwareCreated++;
  }

  result.summary.hardwareProcessed++;
}

/**
 * Import a motor pricing record
 */
function importMotorRecord(db, manufacturerId, record, result, now, uploadedBy) {
  const brandCode = (record.brandCode || '').toLowerCase();

  if (!brandCode) return;

  // Find existing record
  const existingIndex = db.manufacturerMotorPrices.findIndex(
    p => p.manufacturerId === manufacturerId &&
         p.brandCode === brandCode
  );

  const priceRecord = {
    manufacturerId,
    brandCode,
    brandName: record.brandName || brandCode.toUpperCase(),
    motorType: record.motorType || 'standard',
    manufacturerCost: record.manufacturerCost,
    status: record.status || 'active',
    effectiveDate: record.effectiveDate || now.split('T')[0],
    notes: record.notes || '',
    updatedAt: now,
    updatedBy: uploadedBy.id
  };

  if (existingIndex !== -1) {
    // Update existing
    priceRecord.id = db.manufacturerMotorPrices[existingIndex].id;
    priceRecord.createdAt = db.manufacturerMotorPrices[existingIndex].createdAt;
    priceRecord.createdBy = db.manufacturerMotorPrices[existingIndex].createdBy;
    db.manufacturerMotorPrices[existingIndex] = priceRecord;
    result.summary.motorsUpdated++;
  } else {
    // Create new
    priceRecord.id = `mmp-${uuidv4().substring(0, 8)}`;
    priceRecord.createdAt = now;
    priceRecord.createdBy = uploadedBy.id;
    db.manufacturerMotorPrices.push(priceRecord);
    result.summary.motorsCreated++;
  }

  result.summary.motorsProcessed++;
}

/**
 * Import an accessory pricing record
 */
function importAccessoryRecord(db, manufacturerId, record, result, now, uploadedBy) {
  const itemCode = record.itemCode;
  const itemType = (record.itemType || '').toLowerCase();

  if (!itemCode || !itemType) return;

  // Find existing record
  const existingIndex = db.manufacturerAccessoryPrices.findIndex(
    p => p.manufacturerId === manufacturerId &&
         p.itemCode === itemCode &&
         p.itemType === itemType
  );

  const priceRecord = {
    manufacturerId,
    itemType,
    itemCode,
    itemName: record.itemName || itemCode,
    manufacturerCost: record.manufacturerCost,
    status: record.status || 'active',
    effectiveDate: record.effectiveDate || now.split('T')[0],
    notes: record.notes || '',
    updatedAt: now,
    updatedBy: uploadedBy.id
  };

  if (existingIndex !== -1) {
    // Update existing
    priceRecord.id = db.manufacturerAccessoryPrices[existingIndex].id;
    priceRecord.createdAt = db.manufacturerAccessoryPrices[existingIndex].createdAt;
    priceRecord.createdBy = db.manufacturerAccessoryPrices[existingIndex].createdBy;
    db.manufacturerAccessoryPrices[existingIndex] = priceRecord;
    result.summary.accessoriesUpdated++;
  } else {
    // Create new
    priceRecord.id = `map-${uuidv4().substring(0, 8)}`;
    priceRecord.createdAt = now;
    priceRecord.createdBy = uploadedBy.id;
    db.manufacturerAccessoryPrices.push(priceRecord);
    result.summary.accessoriesCreated++;
  }

  result.summary.accessoriesProcessed++;
}

/**
 * Record upload to history
 */
function recordUploadHistory(manufacturerId, fileName, uploadedBy, result) {
  const db = loadDatabase();
  if (!db) return false;

  if (!db.pricingUploadHistory) db.pricingUploadHistory = [];

  const historyRecord = {
    id: `puh-${uuidv4().substring(0, 8)}`,
    manufacturerId,
    uploadType: 'excel',
    fileName,
    filePath: null,
    uploadedBy: uploadedBy.id,
    uploadedByEmail: uploadedBy.email,
    uploadedByRole: uploadedBy.role,
    status: result.success ? (result.summary.errors > 0 ? 'partial' : 'completed') : 'failed',
    summary: result.summary,
    errors: result.errors.slice(0, 100), // Limit stored errors
    warnings: result.warnings.slice(0, 100), // Limit stored warnings
    startedAt: null,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  db.pricingUploadHistory.unshift(historyRecord); // Add to beginning

  // Keep only last 100 uploads per manufacturer
  db.pricingUploadHistory = db.pricingUploadHistory.filter(h => h.manufacturerId === manufacturerId).slice(0, 100);

  return saveDatabase(db);
}

/**
 * Get pricing summary for a manufacturer
 */
function getPricingSummary(manufacturerId) {
  const db = loadDatabase();
  if (!db) return null;

  const fabrics = (db.manufacturerPrices || []).filter(p => p.manufacturerId === manufacturerId);
  const hardware = (db.manufacturerHardwarePrices || []).filter(p => p.manufacturerId === manufacturerId);
  const motors = (db.manufacturerMotorPrices || []).filter(p => p.manufacturerId === manufacturerId);
  const accessories = (db.manufacturerAccessoryPrices || []).filter(p => p.manufacturerId === manufacturerId);
  const uploads = (db.pricingUploadHistory || []).filter(h => h.manufacturerId === manufacturerId);

  // Group fabrics by product type
  const fabricsByType = {};
  fabrics.forEach(f => {
    if (!fabricsByType[f.productType]) fabricsByType[f.productType] = 0;
    fabricsByType[f.productType]++;
  });

  return {
    totalFabrics: fabrics.length,
    fabricsByType,
    totalHardware: hardware.length,
    totalMotors: motors.length,
    totalAccessories: accessories.length,
    recentUploads: uploads.slice(0, 10),
    lastUpload: uploads[0] || null
  };
}

/**
 * Get upload history for a manufacturer
 */
function getUploadHistory(manufacturerId, limit = 20) {
  const db = loadDatabase();
  if (!db) return [];

  return (db.pricingUploadHistory || [])
    .filter(h => h.manufacturerId === manufacturerId)
    .slice(0, limit);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  generatePricingTemplate,
  importPricingFromExcel,
  recordUploadHistory,
  getPricingSummary,
  getUploadHistory,
  TEMPLATE_SHEETS
};
