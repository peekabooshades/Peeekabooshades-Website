const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../frontend/public/images/fabrics/zebra');

// Correct fabric codes from PDF
const correctCodes = ['83003A', '83003B', '83003C', '83003D', '83003E', '83003F', '83003K', '83003L', '83009A', '83009B', '83009J', '83009K', '83009L', '83009M', '83012A', '83012B', '83012C', '83012F', '83012G', '83013A', '83013B', '83013C', '83013F', '83013G', '83013H', '83014F', '83014G', '83014H', '83015F', '83015G', '83015H', '83019F', '83019G', '83019H', '83020E', '83020F', '83020G', '83020H', '83032A', '83032B', '83032C', '83032D', '83032E', '83032F', '83037A', '83037B', '83037C', '83037D', '83038G', '83038H', '83038J', '83039A', '83039B', '83039E', '83039F', '83039G', '83051A', '83051B', '83051C', '83051D', '83051E', '83060A', '83060B', '83060C', '83060D', '83060E', '83060F'];

console.log('Correct fabric codes:', correctCodes.length);

// Get all files in images directory
const files = fs.readdirSync(IMAGES_DIR);
console.log('Total files in zebra images folder:', files.length);

// Identify files to remove
const filesToRemove = [];
const filesToKeep = [];

files.forEach(file => {
  // Extract code from filename (e.g., 83003A.jpeg -> 83003A)
  const match = file.match(/^(\d+[A-Z]+)\.(jpeg|jpg|png)$/i);
  if (match) {
    const code = match[1];
    if (correctCodes.includes(code)) {
      filesToKeep.push(file);
    } else {
      filesToRemove.push(file);
    }
  } else {
    // Unknown file format
    console.log('Unknown file format:', file);
  }
});

console.log('Files to keep:', filesToKeep.length);
console.log('Files to remove:', filesToRemove.length);

// Remove incorrect files
let removed = 0;
filesToRemove.forEach(file => {
  const filePath = path.join(IMAGES_DIR, file);
  try {
    fs.unlinkSync(filePath);
    removed++;
  } catch (err) {
    console.error('Failed to remove:', file, err.message);
  }
});

console.log('Removed', removed, 'incorrect image files');

// Check final count
const remainingFiles = fs.readdirSync(IMAGES_DIR);
console.log('Remaining files:', remainingFiles.length);

// Check for missing codes
const remainingCodes = remainingFiles.map(f => {
  const match = f.match(/^(\d+[A-Z]+)\./i);
  return match ? match[1] : null;
}).filter(Boolean);

const missingCodes = correctCodes.filter(code => !remainingCodes.includes(code));
if (missingCodes.length > 0) {
  console.log('Missing image files for codes:', missingCodes.join(', '));
}

// Check for duplicates (same code with different extensions)
const codeCount = {};
remainingFiles.forEach(f => {
  const match = f.match(/^(\d+[A-Z]+)\./i);
  if (match) {
    const code = match[1];
    codeCount[code] = (codeCount[code] || 0) + 1;
  }
});

const duplicates = Object.entries(codeCount).filter(([code, count]) => count > 1);
if (duplicates.length > 0) {
  console.log('Duplicate images (same code, different extensions):');
  duplicates.forEach(([code, count]) => {
    console.log(`  ${code}: ${count} files`);
  });
}
