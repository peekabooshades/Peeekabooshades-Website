#!/usr/bin/env node
/**
 * Update existing invoices with zebra fabric data
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let updated = 0;

db.orders.forEach(order => {
  if (!order.items || order.items.length === 0) return;

  const item = order.items[0];
  let cfg = {};
  try {
    cfg = typeof item.configuration === 'string' ? JSON.parse(item.configuration) : (item.configuration || {});
  } catch(e) { return; }

  // Find zebra orders (fabric code starts with 83)
  if (!cfg.fabricCode || !cfg.fabricCode.startsWith('83')) return;

  // Find invoice for this order
  const invoice = db.invoices.find(i => i.orderId === order.id || i.orderNumber === order.order_number);
  if (!invoice) return;

  // Update invoice items with fabric code and product type
  invoice.items.forEach((invItem, idx) => {
    const orderItem = order.items[idx];
    if (!orderItem) return;

    let itemCfg = {};
    try {
      itemCfg = typeof orderItem.configuration === 'string'
        ? JSON.parse(orderItem.configuration)
        : (orderItem.configuration || {});
    } catch(e) {}

    // Update with zebra data
    invItem.fabricCode = itemCfg.fabricCode || invItem.fabricCode || '';
    invItem.fabricName = itemCfg.fabricName || invItem.fabricName || '';
    invItem.product_type = orderItem.product_type || 'zebra';
    invItem.product_slug = orderItem.product_slug || '';
    invItem.controlType = itemCfg.controlType || invItem.controlType || '';
    invItem.motorBrand = itemCfg.motorBrand || invItem.motorBrand || '';
    invItem.remoteType = itemCfg.remoteType || invItem.remoteType || '';
    invItem.valanceType = itemCfg.valanceType || invItem.valanceType || '';
    invItem.bottomRail = itemCfg.bottomRail || invItem.bottomRail || '';
    invItem.smartHubQty = itemCfg.smartHubQty || invItem.smartHubQty || 0;
    invItem.usbChargerQty = itemCfg.usbChargerQty || invItem.usbChargerQty || 0;

    // Add manufacturer pricing from order
    if (orderItem.price_snapshot || orderItem.price_snapshots) {
      const ps = orderItem.price_snapshots || orderItem.price_snapshot || {};
      const mfrPrice = ps.manufacturer_price || {};
      invItem.pricing = invItem.pricing || {};
      invItem.pricing.manufacturerCost = mfrPrice.total_cost || mfrPrice.unit_cost || 0;
      invItem.pricing.fabricCode = mfrPrice.fabric_code || itemCfg.fabricCode || '';
    }

    updated++;
  });
});

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('Updated', updated, 'invoice items with zebra data');
