/**
 * Clean up duplicate customers
 * - Merge duplicates by email and phone
 * - Keep the customer with more orders
 * - Transfer orders from duplicates to main customer
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

console.log('=== Cleaning Up Duplicate Customers ===\n');

let duplicatesRemoved = 0;
let ordersTransferred = 0;

// Helper to normalize phone numbers
function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Group customers by email
const emailGroups = {};
db.customers.forEach(c => {
  const email = (c.email || '').toLowerCase();
  if (email) {
    if (!emailGroups[email]) emailGroups[email] = [];
    emailGroups[email].push(c);
  }
});

// Merge email duplicates
Object.entries(emailGroups).forEach(([email, customers]) => {
  if (customers.length > 1) {
    console.log('Found duplicate email: ' + email);

    // Sort by totalOrders desc, then by createdAt asc (keep older)
    customers.sort((a, b) => {
      if ((b.totalOrders || 0) !== (a.totalOrders || 0)) {
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const keep = customers[0];
    const remove = customers.slice(1);

    console.log('  Keeping: ' + keep.id + ' (' + keep.firstName + ' ' + keep.lastName + ')');

    remove.forEach(dup => {
      console.log('  Removing: ' + dup.id + ' (' + dup.firstName + ' ' + dup.lastName + ')');

      // Transfer orders from duplicate to main customer
      (db.orders || []).forEach(order => {
        if (order.customerId === dup.id) {
          order.customerId = keep.id;
          ordersTransferred++;
          console.log('    Transferred order: ' + order.order_number);
        }
      });

      // Remove duplicate
      const idx = db.customers.findIndex(c => c.id === dup.id);
      if (idx >= 0) {
        db.customers.splice(idx, 1);
        duplicatesRemoved++;
      }
    });
  }
});

// Group customers by phone (after email dedup)
const phoneGroups = {};
db.customers.forEach(c => {
  const phone = normalizePhone(c.phone);
  if (phone) {
    if (!phoneGroups[phone]) phoneGroups[phone] = [];
    phoneGroups[phone].push(c);
  }
});

// Merge phone duplicates
Object.entries(phoneGroups).forEach(([phone, customers]) => {
  if (customers.length > 1) {
    console.log('\nFound duplicate phone: ' + phone);

    // Sort by totalOrders desc, then by whether has email, then by createdAt
    customers.sort((a, b) => {
      if ((b.totalOrders || 0) !== (a.totalOrders || 0)) {
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      }
      if (!!a.email !== !!b.email) {
        return a.email ? -1 : 1; // Prefer ones with email
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const keep = customers[0];
    const remove = customers.slice(1);

    console.log('  Keeping: ' + keep.id + ' (' + keep.firstName + ' ' + keep.lastName + ', ' + keep.email + ')');

    remove.forEach(dup => {
      console.log('  Removing: ' + dup.id + ' (' + dup.firstName + ' ' + dup.lastName + ', ' + dup.email + ')');

      // Transfer orders from duplicate to main customer
      (db.orders || []).forEach(order => {
        if (order.customerId === dup.id) {
          order.customerId = keep.id;
          ordersTransferred++;
          console.log('    Transferred order: ' + order.order_number);
        }
      });

      // Remove duplicate
      const idx = db.customers.findIndex(c => c.id === dup.id);
      if (idx >= 0) {
        db.customers.splice(idx, 1);
        duplicatesRemoved++;
      }
    });
  }
});

// Recalculate customer stats
console.log('\n=== Recalculating Customer Stats ===\n');
db.customers.forEach(customer => {
  const customerOrders = (db.orders || []).filter(o => o.customerId === customer.id);
  customer.totalOrders = customerOrders.length;
  customer.totalSpent = customerOrders.reduce((sum, o) => sum + (o.total || (o.pricing ? o.pricing.total : 0) || 0), 0);

  if (customerOrders.length > 0) {
    const dates = customerOrders.map(o => new Date(o.created_at || o.createdAt)).filter(d => !isNaN(d));
    if (dates.length > 0) {
      customer.lastOrderAt = new Date(Math.max.apply(null, dates)).toISOString();
    }
  }

  if (customer.totalOrders > 0) {
    console.log(customer.firstName + ' ' + customer.lastName + ': ' + customer.totalOrders + ' orders, $' + customer.totalSpent.toFixed(2) + ' spent');
  }
});

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('\n=== Summary ===');
console.log('Duplicates removed: ' + duplicatesRemoved);
console.log('Orders transferred: ' + ordersTransferred);
console.log('Total customers now: ' + db.customers.length);
console.log('Database saved!');
