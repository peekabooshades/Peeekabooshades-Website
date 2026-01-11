const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../frontend/public/images/fabrics/zebra');
const DB_PATH = path.join(__dirname, 'database.json');

// Get all files
const files = fs.readdirSync(IMAGES_DIR);

// Group files by code
const filesByCode = {};
files.forEach(file => {
  const match = file.match(/^(\d+[A-Z]+)\.(jpeg|jpg|png)$/i);
  if (match) {
    const code = match[1];
    const ext = match[2].toLowerCase();
    if (!filesByCode[code]) {
      filesByCode[code] = [];
    }
    filesByCode[code].push({ file, ext });
  }
});

// For each code with duplicates, keep only .png (preferred) or .jpeg
let removed = 0;
Object.entries(filesByCode).forEach(([code, fileList]) => {
  if (fileList.length > 1) {
    // Prefer .png, then .jpeg, then .jpg
    const preferredOrder = ['png', 'jpeg', 'jpg'];
    fileList.sort((a, b) => {
      return preferredOrder.indexOf(a.ext) - preferredOrder.indexOf(b.ext);
    });

    // Keep first (preferred), remove rest
    const toKeep = fileList[0];
    const toRemove = fileList.slice(1);

    toRemove.forEach(item => {
      const filePath = path.join(IMAGES_DIR, item.file);
      try {
        fs.unlinkSync(filePath);
        removed++;
        console.log('Removed duplicate:', item.file, '(kept:', toKeep.file + ')');
      } catch (err) {
        console.error('Failed to remove:', item.file);
      }
    });
  }
});

console.log('');
console.log('Removed', removed, 'duplicate files');

// Count remaining files
const remainingFiles = fs.readdirSync(IMAGES_DIR);
console.log('Remaining files:', remainingFiles.length);

// Update database to use correct image paths
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Build map of code -> image file
const imageMap = {};
remainingFiles.forEach(file => {
  const match = file.match(/^(\d+[A-Z]+)\.(jpeg|jpg|png)$/i);
  if (match) {
    imageMap[match[1]] = file;
  }
});

// Update zebraFabrics
let updatedFabrics = 0;
if (db.zebraFabrics) {
  db.zebraFabrics.forEach(fabric => {
    const imageFile = imageMap[fabric.code];
    if (imageFile) {
      fabric.image = `/images/fabrics/zebra/${imageFile}`;
      fabric.hasImage = true;
      updatedFabrics++;
    }
  });
}

// Update manufacturerPrices
let updatedPrices = 0;
if (db.manufacturerPrices) {
  db.manufacturerPrices.forEach(price => {
    if (price.productType === 'zebra') {
      const imageFile = imageMap[price.fabricCode];
      if (imageFile) {
        price.image = `/images/fabrics/zebra/${imageFile}`;
        price.thumbnail = `/images/fabrics/zebra/${imageFile}`;
        price.hasImage = true;
        updatedPrices++;
      }
    }
  });
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('');
console.log('Updated', updatedFabrics, 'zebraFabrics image paths');
console.log('Updated', updatedPrices, 'manufacturerPrices image paths');
console.log('Database saved');
