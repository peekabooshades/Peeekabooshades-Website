/**
 * PEEKABOO SHADES - SCHEDULED REPORTS SERVICE
 * ============================================
 * Manages automated report generation and distribution
 */

const { loadDB, saveDB } = require('./db-loader');

// Report types available
const REPORT_TYPES = {
  DAILY_SALES: 'daily_sales',
  WEEKLY_SALES: 'weekly_sales',
  MONTHLY_SALES: 'monthly_sales',
  INVENTORY_STATUS: 'inventory_status',
  LOW_STOCK_ALERT: 'low_stock_alert',
  ORDER_STATUS: 'order_status',
  CUSTOMER_ACTIVITY: 'customer_activity',
  TAX_SUMMARY: 'tax_summary'
};

// Report frequencies
const FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

class ScheduledReportsService {
  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    try {
      const db = loadDB();
      this.reports = db.scheduledReports || [];
    } catch (err) {
      this.reports = [];
    }
  }

  /**
   * Get all scheduled reports
   */
  getAllReports() {
    this.loadConfig();
    return this.reports;
  }

  /**
   * Get reports due to run
   */
  getDueReports() {
    this.loadConfig();
    const now = new Date();

    return this.reports.filter(report => {
      if (!report.enabled) return false;
      if (!report.lastRun) return true;

      const lastRun = new Date(report.lastRun);
      const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);

      switch (report.frequency) {
        case FREQUENCIES.DAILY:
          return hoursSinceLastRun >= 24;
        case FREQUENCIES.WEEKLY:
          return hoursSinceLastRun >= 168;
        case FREQUENCIES.MONTHLY:
          return hoursSinceLastRun >= 720;
        default:
          return false;
      }
    });
  }

  /**
   * Create a new scheduled report
   */
  createReport(reportData) {
    const db = loadDB();
    if (!db.scheduledReports) db.scheduledReports = [];

    const report = {
      id: `rpt-${Date.now()}`,
      name: reportData.name,
      type: reportData.type,
      frequency: reportData.frequency || FREQUENCIES.DAILY,
      recipients: reportData.recipients || [],
      enabled: reportData.enabled !== false,
      filters: reportData.filters || {},
      lastRun: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.scheduledReports.push(report);
    saveDB(db);

    this.loadConfig();
    return report;
  }

  /**
   * Update a scheduled report
   */
  updateReport(reportId, updates) {
    const db = loadDB();
    const index = (db.scheduledReports || []).findIndex(r => r.id === reportId);

    if (index === -1) return null;

    db.scheduledReports[index] = {
      ...db.scheduledReports[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    saveDB(db);
    this.loadConfig();

    return db.scheduledReports[index];
  }

  /**
   * Delete a scheduled report
   */
  deleteReport(reportId) {
    const db = loadDB();
    const index = (db.scheduledReports || []).findIndex(r => r.id === reportId);

    if (index === -1) return false;

    db.scheduledReports.splice(index, 1);
    saveDB(db);
    this.loadConfig();

    return true;
  }

  /**
   * Generate report data
   */
  generateReportData(report) {
    const db = loadDB();
    const now = new Date();
    let startDate, endDate = now;

    // Calculate date range based on frequency
    switch (report.frequency) {
      case FREQUENCIES.DAILY:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case FREQUENCIES.WEEKLY:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case FREQUENCIES.MONTHLY:
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
    }

    switch (report.type) {
      case REPORT_TYPES.DAILY_SALES:
      case REPORT_TYPES.WEEKLY_SALES:
      case REPORT_TYPES.MONTHLY_SALES:
        return this.generateSalesReport(db, startDate, endDate);

      case REPORT_TYPES.INVENTORY_STATUS:
        return this.generateInventoryReport(db);

      case REPORT_TYPES.LOW_STOCK_ALERT:
        return this.generateLowStockReport(db);

      case REPORT_TYPES.ORDER_STATUS:
        return this.generateOrderStatusReport(db, startDate, endDate);

      case REPORT_TYPES.CUSTOMER_ACTIVITY:
        return this.generateCustomerReport(db, startDate, endDate);

      case REPORT_TYPES.TAX_SUMMARY:
        return this.generateTaxReport(db, startDate, endDate);

      default:
        return { error: 'Unknown report type' };
    }
  }

  /**
   * Generate sales report
   */
  generateSalesReport(db, startDate, endDate) {
    const orders = (db.orders || []).filter(o => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const paidOrders = orders.filter(o =>
      o.payment?.status === 'completed' || o.paymentStatus === 'paid'
    );

    const totalRevenue = paidOrders.reduce((sum, o) =>
      sum + (o.pricing?.total || o.total || 0), 0
    );

    return {
      title: 'Sales Report',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalRevenue: totalRevenue.toFixed(2),
        averageOrderValue: paidOrders.length > 0
          ? (totalRevenue / paidOrders.length).toFixed(2)
          : '0.00'
      },
      topProducts: this.getTopProducts(paidOrders, 5)
    };
  }

  /**
   * Generate inventory report
   */
  generateInventoryReport(db) {
    const fabrics = db.fabrics || [];
    const lowStockThreshold = db.systemConfig?.lowStockThreshold || 10;

    return {
      title: 'Inventory Status Report',
      totalProducts: fabrics.length,
      inStock: fabrics.filter(f => (f.stock || 0) > lowStockThreshold).length,
      lowStock: fabrics.filter(f => (f.stock || 0) <= lowStockThreshold && (f.stock || 0) > 0).length,
      outOfStock: fabrics.filter(f => (f.stock || 0) === 0).length,
      items: fabrics.map(f => ({
        code: f.code || f.name,
        name: f.name,
        stock: f.stock || 0,
        status: (f.stock || 0) === 0 ? 'out_of_stock' :
          (f.stock || 0) <= lowStockThreshold ? 'low_stock' : 'in_stock'
      }))
    };
  }

  /**
   * Generate low stock alert report
   */
  generateLowStockReport(db) {
    const fabrics = db.fabrics || [];
    const lowStockThreshold = db.systemConfig?.lowStockThreshold || 10;

    const lowStockItems = fabrics.filter(f =>
      (f.stock || 0) <= lowStockThreshold
    );

    return {
      title: 'Low Stock Alert',
      alertCount: lowStockItems.length,
      threshold: lowStockThreshold,
      items: lowStockItems.map(f => ({
        code: f.code || f.name,
        name: f.name,
        currentStock: f.stock || 0,
        category: f.category || 'General'
      }))
    };
  }

  /**
   * Generate order status report
   */
  generateOrderStatusReport(db, startDate, endDate) {
    const orders = (db.orders || []).filter(o => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const byStatus = {};
    orders.forEach(o => {
      const status = o.status || 'unknown';
      if (!byStatus[status]) byStatus[status] = 0;
      byStatus[status]++;
    });

    return {
      title: 'Order Status Report',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      totalOrders: orders.length,
      byStatus,
      recentOrders: orders.slice(0, 10).map(o => ({
        orderNumber: o.order_number || o.orderNumber,
        customer: o.customer_name || o.customer?.name,
        status: o.status,
        total: o.pricing?.total || o.total,
        date: o.created_at || o.createdAt
      }))
    };
  }

  /**
   * Generate customer activity report
   */
  generateCustomerReport(db, startDate, endDate) {
    const orders = (db.orders || []).filter(o => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const newCustomers = new Set();
    const returningCustomers = new Set();

    orders.forEach(o => {
      const email = o.customer_email || o.customer?.email;
      if (!email) return;

      // Check if first order from this customer
      const previousOrders = (db.orders || []).filter(ord =>
        (ord.customer_email || ord.customer?.email) === email &&
        new Date(ord.created_at || ord.createdAt) < startDate
      );

      if (previousOrders.length === 0) {
        newCustomers.add(email);
      } else {
        returningCustomers.add(email);
      }
    });

    return {
      title: 'Customer Activity Report',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      newCustomers: newCustomers.size,
      returningCustomers: returningCustomers.size,
      totalActiveCustomers: newCustomers.size + returningCustomers.size
    };
  }

  /**
   * Generate tax report
   */
  generateTaxReport(db, startDate, endDate) {
    const orders = (db.orders || []).filter(o => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return orderDate >= startDate && orderDate <= endDate &&
        (o.payment?.status === 'completed' || o.paymentStatus === 'paid');
    });

    const byState = {};
    orders.forEach(o => {
      const state = o.shipping_address?.state || o.shippingAddress?.state || 'Unknown';
      const tax = o.pricing?.tax || o.tax || 0;
      const subtotal = o.pricing?.subtotal || o.subtotal || 0;

      if (!byState[state]) {
        byState[state] = { taxableSales: 0, taxCollected: 0, orderCount: 0 };
      }
      byState[state].taxableSales += subtotal;
      byState[state].taxCollected += tax;
      byState[state].orderCount++;
    });

    return {
      title: 'Tax Summary Report',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      totalTaxCollected: Object.values(byState).reduce((sum, s) => sum + s.taxCollected, 0).toFixed(2),
      byState: Object.entries(byState).map(([state, data]) => ({
        state,
        ...data,
        taxableSales: data.taxableSales.toFixed(2),
        taxCollected: data.taxCollected.toFixed(2)
      }))
    };
  }

  /**
   * Get top products from orders
   */
  getTopProducts(orders, limit = 5) {
    const productCounts = {};

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const name = item.product_name || item.name || 'Unknown';
        if (!productCounts[name]) {
          productCounts[name] = { name, quantity: 0, revenue: 0 };
        }
        productCounts[name].quantity += item.quantity || 1;
        productCounts[name].revenue += (item.unit_price || item.price || 0) * (item.quantity || 1);
      });
    });

    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  /**
   * Mark report as run
   */
  markReportRun(reportId) {
    return this.updateReport(reportId, { lastRun: new Date().toISOString() });
  }

  /**
   * Generate email-friendly HTML for report
   */
  generateReportHTML(report, data) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #8E6545; border-bottom: 2px solid #8E6545; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    .summary-box { background: #f8f6f3; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-item { display: inline-block; margin-right: 30px; }
    .summary-label { font-size: 12px; color: #888; text-transform: uppercase; }
    .summary-value { font-size: 24px; font-weight: bold; color: #8E6545; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f6f3; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>${data.title || report.name}</h1>
  ${data.period ? `<p>Period: ${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()}</p>` : ''}

  ${data.summary ? `
  <div class="summary-box">
    ${Object.entries(data.summary).map(([key, value]) => `
      <div class="summary-item">
        <div class="summary-label">${key.replace(/([A-Z])/g, ' $1').trim()}</div>
        <div class="summary-value">${typeof value === 'number' ? value.toLocaleString() : value}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${data.items && data.items.length > 0 ? `
  <h2>Details</h2>
  <table>
    <thead>
      <tr>${Object.keys(data.items[0]).map(k => `<th>${k}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${data.items.slice(0, 20).map(item => `
        <tr>${Object.values(item).map(v => `<td>${v}</td>`).join('')}</tr>
      `).join('')}
    </tbody>
  </table>
  ${data.items.length > 20 ? `<p><em>Showing 20 of ${data.items.length} items</em></p>` : ''}
  ` : ''}

  <div class="footer">
    <p>This is an automated report from Peekaboo Shades</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;
  }
}

const scheduledReportsService = new ScheduledReportsService();

module.exports = {
  scheduledReportsService,
  ScheduledReportsService,
  REPORT_TYPES,
  FREQUENCIES
};
