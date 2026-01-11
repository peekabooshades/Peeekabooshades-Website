const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');
const IMAGES_DIR = path.join(__dirname, '../frontend/public/images/fabrics/zebra');

// Get list of all images in the zebra folder
const imageFiles = fs.readdirSync(IMAGES_DIR);
const imageCodes = new Set();

imageFiles.forEach(file => {
  // Extract code from filename (e.g., 83003A.jpeg or 83003A.png)
  const match = file.match(/^(\d+[A-Z])\.(jpeg|jpg|png)$/i);
  if (match) {
    imageCodes.add(match[1]);
  }
});

console.log('Found', imageCodes.size, 'fabric images in folder');

// Load database
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Update zebraFabrics
let updatedZebra = 0;
if (db.zebraFabrics) {
  db.zebraFabrics.forEach(fabric => {
    if (imageCodes.has(fabric.code)) {
      // Check if there's a png or jpeg
      let imagePath = null;
      if (imageFiles.includes(fabric.code + '.png')) {
        imagePath = `/images/fabrics/zebra/${fabric.code}.png`;
      } else if (imageFiles.includes(fabric.code + '.jpeg')) {
        imagePath = `/images/fabrics/zebra/${fabric.code}.jpeg`;
      } else if (imageFiles.includes(fabric.code + '.jpg')) {
        imagePath = `/images/fabrics/zebra/${fabric.code}.jpg`;
      }

      if (imagePath) {
        fabric.image = imagePath;
        fabric.hasImage = true;
        updatedZebra++;
      }
    }
  });
}
console.log('Updated', updatedZebra, 'zebraFabrics entries');

// Update manufacturerPrices for zebra
let updatedMain = 0;
if (db.manufacturerPrices) {
  db.manufacturerPrices.forEach(price => {
    if (price.productType === 'zebra' && imageCodes.has(price.fabricCode)) {
      // Check if there's a png or jpeg
      let imagePath = null;
      if (imageFiles.includes(price.fabricCode + '.png')) {
        imagePath = `/images/fabrics/zebra/${price.fabricCode}.png`;
      } else if (imageFiles.includes(price.fabricCode + '.jpeg')) {
        imagePath = `/images/fabrics/zebra/${price.fabricCode}.jpeg`;
      } else if (imageFiles.includes(price.fabricCode + '.jpg')) {
        imagePath = `/images/fabrics/zebra/${price.fabricCode}.jpg`;
      }

      if (imagePath) {
        price.image = imagePath;
        price.thumbnail = imagePath;
        price.hasImage = true;
        updatedMain++;
      }
    }
  });
}
console.log('Updated', updatedMain, 'manufacturerPrices zebra entries');

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('Database saved');

// Count missing
const stillMissing = (db.zebraFabrics || []).filter(f => !f.hasImage).map(f => f.code);
console.log('\nStill missing images:', stillMissing.length);
if (stillMissing.length > 0 && stillMissing.length <= 20) {
  console.log('Missing codes:', stillMissing.join(', '));
} else if (stillMissing.length > 20) {
  console.log('First 20 missing:', stillMissing.slice(0, 20).join(', '));
}
