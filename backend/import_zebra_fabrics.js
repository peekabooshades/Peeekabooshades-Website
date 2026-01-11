const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');
const EXCEL_PATH = '/Users/surya/Downloads/Zebra_Fabric_Master_FULL.xlsx';
const IMAGE_DIR = path.join(__dirname, '../frontend/public/images/fabrics/zebra');

// Load Excel
const wb = XLSX.readFile(EXCEL_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(sheet);

// Load database
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Get existing images
const images = fs.readdirSync(IMAGE_DIR);
const imageCodes = {};
images.forEach(f => {
  const code = f.split('.')[0];
  imageCodes[code] = f;
});

// Initialize zebraFabrics if not exists
if (!db.zebraFabrics) db.zebraFabrics = [];
if (!db.zebraManufacturerPrices) db.zebraManufacturerPrices = [];

// Clear existing zebra data
db.zebraFabrics = [];
db.zebraManufacturerPrices = [];

// Import fabrics
excelData.forEach((row, index) => {
  const fabricCode = row['Fabric Code'];
  const shadingType = row['Shading Type'] || 'Semi-Blackout';
  const imageFile = imageCodes[fabricCode];

  // Determine category based on shading type
  let category = 'semi-blackout';
  if (shadingType.toLowerCase().includes('blackout') && !shadingType.toLowerCase().includes('semi')) {
    category = 'blackout';
  } else if (shadingType.toLowerCase().includes('super')) {
    category = 'super-blackout';
  }

  // Create fabric entry
  const fabric = {
    id: `zebra-${fabricCode}`,
    code: fabricCode,
    name: `Zebra ${fabricCode}`,
    category: category,
    shadingType: shadingType,
    composition: row['Composition'] || '100% Polyester',
    width: row['Width (cm)'] || 300,
    weight: row['Weight (g/m²)'] || '',
    repeat: row['Repeat (cm)'] || '',
    thickness: row['Thickness (mm)'] || '',
    waterResistant: row['Water Resistant'] === 'YES',
    fireResistant: row['Fire Resistant'] === 'YES',
    mildewProof: row['Mildew Proof'] === 'YES',
    formaldehydeFree: row['Formaldehyde Free'] === 'YES',
    image: imageFile ? `/images/fabrics/zebra/${imageFile}` : null,
    hasImage: !!imageFile,
    productType: 'zebra-shades',
    enabled: true,
    createdAt: new Date().toISOString()
  };

  db.zebraFabrics.push(fabric);

  // Create manufacturer price entry
  const priceEntry = {
    fabricCode: fabricCode,
    productType: 'zebra-shades',
    pricePerSqMeterManual: row['Price per Sqm (Manual)'] || 0,
    pricePerSqMeterCordless: row['Price per Sqm (Cordless)'] || 0,
    pricePerSqMeter: row['Price per Sqm (Manual)'] || 0,
    minAreaSqMeter: 1.2,
    manualMargin: 40,
    calculatedCustomerPrice: null,
    notes: `${shadingType} - ${row['Composition'] || '100% Polyester'}`,
    updatedAt: new Date().toISOString()
  };

  db.zebraManufacturerPrices.push(priceEntry);
});

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('Imported', db.zebraFabrics.length, 'zebra fabrics');
console.log('With images:', db.zebraFabrics.filter(f => f.hasImage).length);
console.log('Without images:', db.zebraFabrics.filter(f => !f.hasImage).length);
console.log('Price entries:', db.zebraManufacturerPrices.length);

// Show sample
console.log('\nSample fabric:', JSON.stringify(db.zebraFabrics[0], null, 2));
console.log('\nSample price:', JSON.stringify(db.zebraManufacturerPrices[0], null, 2));
