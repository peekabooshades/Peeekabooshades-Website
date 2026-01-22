/**
 * PEEKABOO SHADES - PURCHASE ORDER SERVICE
 * =========================================
 * Generates manufacturer purchase orders from production orders
 */

const { loadDB, saveDB } = require('./db-loader');

class POService {
  constructor() {
    this.companyInfo = {
      name: 'Peekaboo Shades',
      address: '123 Shade Lane',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      phone: '+1 929-465-9549',
      email: 'purchasing@peekabooshades.com'
    };
  }

  /**
   * Generate PO number
   */
  generatePONumber(manufacturerId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PO-${manufacturerId.substring(0, 3).toUpperCase()}-${dateStr}-${seq}`;
  }

  /**
   * Get orders ready for PO generation
   */
  getOrdersForPO(manufacturerId = null) {
    const db = loadDB();
    const orders = db.orders || [];

    // Filter orders in production-ready status that haven't been sent to manufacturer
    let eligibleOrders = orders.filter(o =>
      ['confirmed', 'processing', 'in_production'].includes(o.status) &&
      o.paymentStatus === 'paid' &&
      !o.poGenerated
    );

    if (manufacturerId) {
      eligibleOrders = eligibleOrders.filter(o =>
        o.items?.some(item => item.manufacturerId === manufacturerId)
      );
    }

    return eligibleOrders;
  }

  /**
   * Generate PO data for manufacturer
   */
  generatePOData(orderIds, manufacturerId, manufacturerName) {
    const db = loadDB();
    const orders = db.orders?.filter(o => orderIds.includes(o.id)) || [];

    if (orders.length === 0) {
      return null;
    }

    const poNumber = this.generatePONumber(manufacturerId);
    const poDate = new Date().toISOString();

    // Aggregate line items from all orders
    const lineItems = [];
    let lineNumber = 0;

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        lineNumber++;
        lineItems.push({
          lineNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerRef: order.customerName || order.customerEmail,
          productType: item.productType || item.category || 'Roller Shade',
          fabricCode: item.fabricCode || item.fabric,
          width: item.width,
          height: item.height,
          quantity: item.quantity || 1,
          mountType: item.mountType || item.mount || 'inside',
          controlType: item.controlType || 'chain',
          controlSide: item.controlSide || item.chainSide || 'right',
          valanceType: item.valanceType || 'standard',
          bottomRail: item.bottomRail || 'standard',
          motorBrand: item.motorBrand || null,
          roomLabel: item.roomLabel || '',
          specialInstructions: item.notes || order.notes || ''
        });
      });
    });

    return {
      poNumber,
      poDate,
      expectedDelivery: this.calculateExpectedDelivery(),
      manufacturer: {
        id: manufacturerId,
        name: manufacturerName || 'Manufacturer'
      },
      buyer: this.companyInfo,
      orderCount: orders.length,
      lineItems,
      totalUnits: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      notes: '',
      status: 'draft'
    };
  }

  /**
   * Calculate expected delivery date (default 10 business days)
   */
  calculateExpectedDelivery(businessDays = 10) {
    const date = new Date();
    let daysAdded = 0;
    while (daysAdded < businessDays) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }
    return date.toISOString();
  }

  /**
   * Generate PO as CSV
   */
  generatePOCSV(poData) {
    const headers = [
      'Line#', 'Order#', 'Customer', 'Product', 'Fabric',
      'Width', 'Height', 'Qty', 'Mount', 'Control',
      'Control Side', 'Valance', 'Bottom Rail', 'Motor', 'Room', 'Notes'
    ];

    const rows = poData.lineItems.map(item => [
      item.lineNumber,
      item.orderNumber,
      item.customerRef,
      item.productType,
      item.fabricCode,
      item.width,
      item.height,
      item.quantity,
      item.mountType,
      item.controlType,
      item.controlSide,
      item.valanceType,
      item.bottomRail,
      item.motorBrand || 'N/A',
      item.roomLabel,
      item.specialInstructions
    ]);

    const csvContent = [
      `PO Number: ${poData.poNumber}`,
      `Date: ${new Date(poData.poDate).toLocaleDateString()}`,
      `Expected Delivery: ${new Date(poData.expectedDelivery).toLocaleDateString()}`,
      `Manufacturer: ${poData.manufacturer.name}`,
      `Total Orders: ${poData.orderCount}`,
      `Total Units: ${poData.totalUnits}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate PO as HTML for printing/PDF
   */
  generatePOHTML(poData) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Order ${poData.poNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
    .po { max-width: 1000px; margin: 0 auto; padding: 30px; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #8E6545; padding-bottom: 15px; margin-bottom: 20px; }
    .logo { font-size: 20px; font-weight: bold; color: #8E6545; }
    h1 { font-size: 22px; color: #8E6545; }
    .meta { display: flex; gap: 40px; margin-bottom: 20px; background: #f8f6f3; padding: 15px; border-radius: 6px; }
    .meta-item label { font-size: 10px; text-transform: uppercase; color: #888; display: block; }
    .meta-item span { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
    th { background: #8E6545; color: white; padding: 8px 6px; text-align: left; }
    td { padding: 8px 6px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 10px; color: #666; }
    .totals { text-align: right; margin-top: 20px; }
    .totals strong { font-size: 14px; }
    @media print { .po { padding: 10px; } }
  </style>
</head>
<body>
  <div class="po">
    <div class="header">
      <div class="logo">${poData.buyer.name}</div>
      <h1>PURCHASE ORDER</h1>
    </div>

    <div class="meta">
      <div class="meta-item">
        <label>PO Number</label>
        <span>${poData.poNumber}</span>
      </div>
      <div class="meta-item">
        <label>Date</label>
        <span>${new Date(poData.poDate).toLocaleDateString()}</span>
      </div>
      <div class="meta-item">
        <label>Expected Delivery</label>
        <span>${new Date(poData.expectedDelivery).toLocaleDateString()}</span>
      </div>
      <div class="meta-item">
        <label>Manufacturer</label>
        <span>${poData.manufacturer.name}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Order#</th>
          <th>Customer</th>
          <th>Product</th>
          <th>Fabric</th>
          <th>W x H</th>
          <th>Qty</th>
          <th>Mount</th>
          <th>Control</th>
          <th>Valance</th>
          <th>Room</th>
        </tr>
      </thead>
      <tbody>
        ${poData.lineItems.map(item => `
        <tr>
          <td>${item.lineNumber}</td>
          <td>${item.orderNumber}</td>
          <td>${item.customerRef}</td>
          <td>${item.productType}</td>
          <td>${item.fabricCode}</td>
          <td>${item.width}" x ${item.height}"</td>
          <td>${item.quantity}</td>
          <td>${item.mountType}</td>
          <td>${item.controlType}${item.motorBrand ? ` (${item.motorBrand})` : ''}</td>
          <td>${item.valanceType}</td>
          <td>${item.roomLabel || '-'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <p>Total Orders: <strong>${poData.orderCount}</strong></p>
      <p>Total Units: <strong>${poData.totalUnits}</strong></p>
    </div>

    <div class="footer">
      <p><strong>Ship To:</strong> ${poData.buyer.name}, ${poData.buyer.address}, ${poData.buyer.city}, ${poData.buyer.state} ${poData.buyer.zip}</p>
      <p><strong>Contact:</strong> ${poData.buyer.phone} | ${poData.buyer.email}</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Save PO record
   */
  savePO(poData, orderIds) {
    const db = loadDB();
    if (!db.purchaseOrders) db.purchaseOrders = [];

    const po = {
      ...poData,
      id: `po-${Date.now()}`,
      orderIds,
      createdAt: new Date().toISOString()
    };

    db.purchaseOrders.push(po);

    // Mark orders as PO generated
    orderIds.forEach(orderId => {
      const orderIndex = db.orders?.findIndex(o => o.id === orderId);
      if (orderIndex > -1) {
        db.orders[orderIndex].poGenerated = true;
        db.orders[orderIndex].poNumber = poData.poNumber;
        db.orders[orderIndex].poDate = poData.poDate;
      }
    });

    saveDB(db);
    return po;
  }

  /**
   * Get all POs
   */
  getAllPOs(filters = {}) {
    const db = loadDB();
    let pos = db.purchaseOrders || [];

    if (filters.manufacturerId) {
      pos = pos.filter(po => po.manufacturer?.id === filters.manufacturerId);
    }

    if (filters.status) {
      pos = pos.filter(po => po.status === filters.status);
    }

    return pos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Update PO status
   */
  updatePOStatus(poId, status) {
    const db = loadDB();
    const poIndex = (db.purchaseOrders || []).findIndex(po => po.id === poId);

    if (poIndex === -1) return null;

    db.purchaseOrders[poIndex].status = status;
    db.purchaseOrders[poIndex].updatedAt = new Date().toISOString();

    saveDB(db);
    return db.purchaseOrders[poIndex];
  }
}

const poService = new POService();

module.exports = {
  poService,
  POService
};
