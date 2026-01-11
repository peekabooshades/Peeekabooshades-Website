const fs = require('fs');
const path = require('path');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../database.json'), 'utf8'));
console.log('=== Invoice Data Structure Check ===');

if (!db.invoices || db.invoices.length === 0) {
  console.log('ERROR: No invoices in database');
  process.exit(1);
}

// Check first 3 invoices
db.invoices.slice(0, 3).forEach((inv, i) => {
  console.log(`\nInvoice ${i + 1}:`);
  console.log('  id:', inv.id ? 'OK' : 'MISSING');
  console.log('  invoiceNumber:', inv.invoiceNumber || 'MISSING');
  console.log('  type:', inv.type || 'MISSING');
  console.log('  status:', inv.status || 'MISSING');
  console.log('  total:', inv.total !== undefined ? inv.total : 'MISSING');
  console.log('  amountDue:', inv.amountDue !== undefined ? inv.amountDue : 'MISSING');
  console.log('  orderId:', inv.orderId ? 'OK' : 'MISSING');
  console.log('  customer:', inv.customer ? 'OK' : 'MISSING');
  console.log('  items:', inv.items ? inv.items.length + ' items' : 'MISSING');
});

// Check if total is consistently 0
const zeroTotals = db.invoices.filter(i => i.total === 0 || i.total === undefined);
const nonZeroTotals = db.invoices.filter(i => i.total > 0);

console.log("\n=== Summary ===");
console.log('Total invoices:', db.invoices.length);
console.log('Invoices with zero/undefined total:', zeroTotals.length);
console.log('Invoices with non-zero total:', nonZeroTotals.length);

if (nonZeroTotals.length > 0) {
  console.log('\nSample non-zero invoice:', nonZeroTotals[0].invoiceNumber, '- $' + nonZeroTotals[0].total);
}
