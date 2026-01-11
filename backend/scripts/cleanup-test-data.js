#!/usr/bin/env node
/**
 * QA Testing Data Cleanup Script
 * Removes all test data to prepare for fresh end-to-end testing
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');

console.log('========================================');
console.log('QA Testing Data Cleanup Script');
console.log('========================================\n');

// Load database
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Track cleanup stats
const stats = {
  orders: db.orders?.length || 0,
  invoices: db.invoices?.length || 0,
  cart: db.cart?.length || 0,
  quotes: db.quotes?.length || 0,
  orderStatusHistory: db.orderStatusHistory?.length || 0,
  ledgerEntries: db.ledgerEntries?.length || 0,
  adminUsersRemoved: 0,
  manufacturerUsersRemoved: 0,
  dealerUsersRemoved: 0
};

console.log('Current Data Counts:');
console.log(`  Orders: ${stats.orders}`);
console.log(`  Invoices: ${stats.invoices}`);
console.log(`  Cart Items: ${stats.cart}`);
console.log(`  Quotes: ${stats.quotes}`);
console.log(`  Order Status History: ${stats.orderStatusHistory}`);
console.log(`  Ledger Entries: ${stats.ledgerEntries}`);
console.log('');

// Clean orders
db.orders = [];
console.log('Cleared all orders');

// Clean invoices
db.invoices = [];
console.log('Cleared all invoices');

// Clean cart
db.cart = [];
console.log('Cleared all cart items');

// Clean quotes
db.quotes = [];
console.log('Cleared all quotes');

// Clean order status history
db.orderStatusHistory = [];
console.log('Cleared order status history');

// Clean ledger entries
db.ledgerEntries = [];
console.log('Cleared ledger entries');

// Remove test admin users (keep admin@peekabooshades.com)
if (db.adminUsers) {
  const originalCount = db.adminUsers.length;
  db.adminUsers = db.adminUsers.filter(u => u.email === 'admin@peekabooshades.com');
  stats.adminUsersRemoved = originalCount - db.adminUsers.length;
  console.log(`Removed ${stats.adminUsersRemoved} admin user(s), kept: admin@peekabooshades.com`);
}

// Remove test manufacturer users (keep factory@zstarr.com)
if (db.manufacturerUsers) {
  const originalCount = db.manufacturerUsers.length;
  db.manufacturerUsers = db.manufacturerUsers.filter(u => u.email === 'factory@zstarr.com');
  stats.manufacturerUsersRemoved = originalCount - db.manufacturerUsers.length;
  console.log(`Removed ${stats.manufacturerUsersRemoved} manufacturer user(s), kept: factory@zstarr.com`);
}

// Remove test dealer users (keep john@abcwindows.com and sarah@premiumblinds.com)
if (db.dealerUsers) {
  const originalCount = db.dealerUsers.length;
  const keepEmails = ['john@abcwindows.com', 'sarah@premiumblinds.com'];
  db.dealerUsers = db.dealerUsers.filter(u => keepEmails.includes(u.email));
  stats.dealerUsersRemoved = originalCount - db.dealerUsers.length;
  console.log(`Removed ${stats.dealerUsersRemoved} dealer user(s), kept: ${keepEmails.join(', ')}`);
}

// Remove test dealers (keep ABC Window Coverings and Premium Blinds Pro)
if (db.dealers) {
  const originalCount = db.dealers.length;
  const keepNames = ['ABC Window Coverings', 'Premium Blinds Pro'];
  db.dealers = db.dealers.filter(d => keepNames.includes(d.name));
  console.log(`Removed ${originalCount - db.dealers.length} dealer(s), kept: ${keepNames.join(', ')}`);
}

// Clean dealer orders and customers associated with removed dealers
if (db.dealerOrders) {
  db.dealerOrders = [];
  console.log('Cleared dealer orders');
}

if (db.dealerCustomers) {
  db.dealerCustomers = [];
  console.log('Cleared dealer customers');
}

// Reset customer order counts (keep customer records but reset stats)
if (db.customers) {
  db.customers.forEach(c => {
    c.ordersCount = 0;
    c.totalSpent = 0;
    c.orders = [];
  });
  console.log(`Reset ${db.customers.length} customer(s) order counts`);
}

// Save cleaned database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('\n========================================');
console.log('Cleanup Complete!');
console.log('========================================');
console.log('\nData Removed:');
console.log(`  Orders: ${stats.orders}`);
console.log(`  Invoices: ${stats.invoices}`);
console.log(`  Cart Items: ${stats.cart}`);
console.log(`  Quotes: ${stats.quotes}`);
console.log(`  Order Status History: ${stats.orderStatusHistory}`);
console.log(`  Ledger Entries: ${stats.ledgerEntries}`);
console.log(`  Admin Users: ${stats.adminUsersRemoved}`);
console.log(`  Manufacturer Users: ${stats.manufacturerUsersRemoved}`);
console.log(`  Dealer Users: ${stats.dealerUsersRemoved}`);

console.log('\nRemaining Users:');
console.log('  Admin: admin@peekabooshades.com');
console.log('  Manufacturer: factory@zstarr.com');
console.log('  Dealer: john@abcwindows.com, sarah@premiumblinds.com');
console.log('\nDatabase is now ready for fresh QA testing!');
