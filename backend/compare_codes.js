const fs = require('fs');
const path = require('path');

// Codes extracted from PDF
const pdfCodes = ['83003A', '83003B', '83003C', '83003D', '83003E', '83003F', '83003K', '83003L', '83009A', '83009B', '83009J', '83009K', '83009L', '83009M', '83012A', '83012B', '83012C', '83012F', '83012G', '83013A', '83013B', '83013C', '83013F', '83013G', '83013H', '83014F', '83014G', '83014H', '83015F', '83015G', '83015H', '83019F', '83019G', '83019H', '83020E', '83020F', '83020G', '83020H', '83032A', '83032B', '83032C', '83032D', '83032E', '83032F', '83037A', '83037B', '83037C', '83037D', '83038G', '83038H', '83038J', '83039A', '83039B', '83039E', '83039F', '83039G', '83051A', '83051B', '83051C', '83051D', '83051E', '83060A', '83060B', '83060C', '83060D', '83060E', '83060F'];

const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
const dbCodes = (db.zebraFabrics || []).map(f => f.code);

const inDbNotPdf = dbCodes.filter(c => !pdfCodes.includes(c));
const inPdfNotDb = pdfCodes.filter(c => !dbCodes.includes(c));

console.log('PDF fabric count:', pdfCodes.length);
console.log('Database fabric count:', dbCodes.length);
console.log('');
console.log('In Database but NOT in PDF (' + inDbNotPdf.length + '):');
console.log(inDbNotPdf.sort().join(', '));
console.log('');
console.log('In PDF but NOT in Database (' + inPdfNotDb.length + '):');
console.log(inPdfNotDb.sort().join(', '));
