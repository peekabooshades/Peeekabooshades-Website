const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('/Users/surya/Downloads/Zebra_Fabric_Master_FULL.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

const excelCodes = data.map(r => r['Fabric Code']);
const imageDir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/fabrics/zebra';
const images = fs.readdirSync(imageDir);
const imageCodes = images.map(f => f.split('.')[0]);

const matched = excelCodes.filter(c => imageCodes.includes(c));
const missing = excelCodes.filter(c => !imageCodes.includes(c));

console.log('Excel codes:', excelCodes.length);
console.log('Image codes:', imageCodes.length);
console.log('Matched:', matched.length);
console.log('Missing images:', missing.length);
if (missing.length > 0) {
  console.log('Missing codes:', missing.join(', '));
}
