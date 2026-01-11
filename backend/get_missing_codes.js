const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
const missing = (db.zebraFabrics || []).filter(f => !f.hasImage).map(f => f.code);
console.log('Missing codes:', missing.length);
missing.forEach(code => console.log(code));
