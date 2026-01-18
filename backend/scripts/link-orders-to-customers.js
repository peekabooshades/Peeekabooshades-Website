/**
 * Link existing orders to customers
 * - Find or create customers by email from orders
 * - Update customerId on orders
 * - Recalculate customer totalOrders and totalSpent
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

if (!db.customers) db.customers = [];

console.log('=== Linking Orders to Customers ===\n');

let ordersLinked = 0;
let customersCreated = 0;

// Process each order
(db.orders || []).forEach(order => {
  const email = order.customer_email;
  if (!email) return;

  // Find existing customer by email
  let customer = db.customers.find(c =>
    c.email && c.email.toLowerCase() === email.toLowerCase()
  );

  // Create customer if not found
  if (!customer) {
    const nameParts = (order.customer_name || '').trim().split(' ');
    customer = {
      id: 'cust-' + uuidv4().slice(0, 8),
      email: email,
      firstName: nameParts[0] || 'Customer',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: order.customer_phone || '',
      type: 'retail',
      companyName: '',
      addresses: order.shipping_address ? [{ type: 'shipping', address: order.shipping_address }] : [],
      tags: [],
      notes: 'Auto-created from order linking',
      totalOrders: 0,
      totalSpent: 0,
      createdAt: order.created_at || new Date().toISOString(),
      lastOrderAt: null
    };
    db.customers.push(customer);
    customersCreated++;
    console.log('Created customer: ' + customer.firstName + ' ' + customer.lastName + ' (' + email + ')');
  }

  // Link order to customer
  if (!order.customerId) {
    order.customerId = customer.id;
    ordersLinked++;
    console.log('Linked order ' + order.order_number + ' to customer ' + customer.id);
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

  console.log(customer.firstName + ' ' + customer.lastName + ': ' + customer.totalOrders + ' orders, $' + customer.totalSpent.toFixed(2) + ' spent');
});

// Save database
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log('\n=== Summary ===');
console.log('Orders linked: ' + ordersLinked);
console.log('Customers created: ' + customersCreated);
console.log('Database saved!');
