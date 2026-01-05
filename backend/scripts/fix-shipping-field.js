/**
 * Fix invoices where shipping is an object instead of a number
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let fixed = 0;

db.invoices.forEach((inv, idx) => {
  // Check if shipping is an object
  if (typeof inv.shipping === 'object' && inv.shipping !== null) {
    console.log(`Fixing ${inv.invoiceNumber}: shipping is an object`);

    // Preserve shipping info as shippingInfo
    db.invoices[idx].shippingInfo = inv.shipping;

    // Set shipping to 0 (numeric)
    db.invoices[idx].shipping = 0;
    fixed++;
  }

  // Recalculate total if it's NaN or null
  if (inv.total === null || isNaN(inv.total)) {
    const subtotal = inv.subtotal || 0;
    const tax = inv.tax || 0;
    const shipping = typeof db.invoices[idx].shipping === 'number' ? db.invoices[idx].shipping : 0;
    const discount = inv.discount || 0;
    const newTotal = Math.round((subtotal + tax + shipping - discount) * 100) / 100;

    db.invoices[idx].total = newTotal;
    db.invoices[idx].amountDue = newTotal - (inv.amountPaid || 0);

    console.log(`  -> Recalculated total: $${newTotal}`);
  }
});

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`\nFixed ${fixed} invoices with object shipping fields`);
