/**
 * PEEKABOO SHADES - ACCOUNTING EXPORT SERVICE
 * ============================================
 * Exports financial data for accounting software integration
 * Supports QuickBooks, Xero, and generic CSV formats
 */

const { loadDB } = require('./db-loader');

class AccountingExportService {
  constructor() {
    this.companyInfo = {
      name: 'Peekaboo Shades LLC',
      ein: '', // Employer Identification Number
      address: '123 Shade Lane, New York, NY 10001'
    };
  }

  /**
   * Get orders for export within date range
   */
  getOrdersForExport(startDate, endDate, status = null) {
    const db = loadDB();
    let orders = db.orders || [];

    // Filter by date range
    if (startDate) {
      orders = orders.filter(o => new Date(o.created_at || o.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      orders = orders.filter(o => new Date(o.created_at || o.createdAt) <= new Date(endDate));
    }

    // Filter by status
    if (status) {
      orders = orders.filter(o => o.status === status || o.payment?.status === status);
    }

    return orders;
  }

  /**
   * Export sales journal entries
   */
  exportSalesJournal(startDate, endDate) {
    const orders = this.getOrdersForExport(startDate, endDate);

    return orders.map(order => {
      const orderTotal = order.pricing?.total || order.total || 0;
      const tax = order.pricing?.tax || order.tax || 0;
      const shipping = typeof order.shipping === 'number' ? order.shipping : 0;
      const subtotal = order.pricing?.subtotal || order.subtotal || (orderTotal - tax - shipping);

      return {
        date: this.formatDate(order.created_at || order.createdAt),
        transactionId: order.order_number || order.orderNumber || order.id,
        customerName: order.customer_name || order.customer?.name || '',
        customerEmail: order.customer_email || order.customer?.email || '',
        description: `Sale - Order ${order.order_number || order.orderNumber}`,

        // Debit entries
        accountsReceivable: orderTotal, // Debit AR

        // Credit entries
        salesRevenue: subtotal, // Credit Sales Revenue
        salesTaxPayable: tax, // Credit Sales Tax Payable
        shippingRevenue: shipping, // Credit Shipping Revenue

        paymentMethod: order.payment?.method || 'N/A',
        paymentStatus: order.payment?.status || order.paymentStatus || 'pending'
      };
    });
  }

  /**
   * Export for QuickBooks IIF format
   */
  exportQuickBooksIIF(startDate, endDate) {
    const orders = this.getOrdersForExport(startDate, endDate);

    const lines = [];

    // Header for sales receipts
    lines.push('!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO');
    lines.push('!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO');
    lines.push('!ENDTRNS');

    orders.forEach(order => {
      const orderTotal = order.pricing?.total || order.total || 0;
      const tax = order.pricing?.tax || order.tax || 0;
      const shipping = typeof order.shipping === 'number' ? order.shipping : 0;
      const subtotal = orderTotal - tax - shipping;
      const date = this.formatDateUS(order.created_at || order.createdAt);
      const orderNum = order.order_number || order.orderNumber || order.id;
      const customer = order.customer_name || order.customer?.name || 'Customer';

      // Main transaction line (Accounts Receivable debit)
      lines.push(`TRNS\tSALES RECEIPT\t${date}\tAccounts Receivable\t${customer}\t${orderTotal.toFixed(2)}\t${orderNum}\tOnline Sale`);

      // Split lines (credits)
      lines.push(`SPL\tSALES RECEIPT\t${date}\tSales Revenue\t${customer}\t${(-subtotal).toFixed(2)}\t${orderNum}\tProduct Sales`);

      if (tax > 0) {
        lines.push(`SPL\tSALES RECEIPT\t${date}\tSales Tax Payable\t${customer}\t${(-tax).toFixed(2)}\t${orderNum}\tSales Tax`);
      }

      if (shipping > 0) {
        lines.push(`SPL\tSALES RECEIPT\t${date}\tShipping Revenue\t${customer}\t${(-shipping).toFixed(2)}\t${orderNum}\tShipping`);
      }

      lines.push('ENDTRNS');
    });

    return lines.join('\n');
  }

  /**
   * Export for Xero CSV format
   */
  exportXeroCSV(startDate, endDate) {
    const orders = this.getOrdersForExport(startDate, endDate);

    const headers = [
      'ContactName', 'EmailAddress', 'InvoiceNumber', 'Reference',
      'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount',
      'AccountCode', 'TaxType', 'TaxAmount', 'Total', 'Currency'
    ];

    const rows = [];
    rows.push(headers.join(','));

    orders.forEach(order => {
      const date = this.formatDateISO(order.created_at || order.createdAt);
      const dueDate = date; // Same as invoice date for paid orders
      const orderNum = order.order_number || order.orderNumber || order.id;
      const customer = order.customer_name || order.customer?.name || 'Customer';
      const email = order.customer_email || order.customer?.email || '';

      // Line items
      (order.items || []).forEach((item, idx) => {
        const unitPrice = item.unit_price || item.unitPrice || item.price || 0;
        const qty = item.quantity || 1;
        const total = unitPrice * qty;

        rows.push([
          `"${customer}"`,
          `"${email}"`,
          `"${orderNum}"`,
          `"${orderNum}-${idx + 1}"`,
          date,
          dueDate,
          `"${item.product_name || item.name || 'Custom Shade'}"`,
          qty,
          unitPrice.toFixed(2),
          '4000', // Sales account code
          'OUTPUT2', // Standard tax
          '0.00',
          total.toFixed(2),
          'USD'
        ].join(','));
      });

      // Tax line (if applicable)
      const tax = order.pricing?.tax || order.tax || 0;
      if (tax > 0) {
        rows.push([
          `"${customer}"`,
          `"${email}"`,
          `"${orderNum}"`,
          `"${orderNum}-TAX"`,
          date,
          dueDate,
          '"Sales Tax"',
          1,
          tax.toFixed(2),
          '2200', // Tax payable account
          'NONE',
          '0.00',
          tax.toFixed(2),
          'USD'
        ].join(','));
      }

      // Shipping line (if applicable)
      const shipping = typeof order.shipping === 'number' ? order.shipping : 0;
      if (shipping > 0) {
        rows.push([
          `"${customer}"`,
          `"${email}"`,
          `"${orderNum}"`,
          `"${orderNum}-SHIP"`,
          date,
          dueDate,
          '"Shipping & Handling"',
          1,
          shipping.toFixed(2),
          '4100', // Shipping revenue account
          'NONE',
          '0.00',
          shipping.toFixed(2),
          'USD'
        ].join(','));
      }
    });

    return rows.join('\n');
  }

  /**
   * Export generic CSV for any accounting software
   */
  exportGenericCSV(startDate, endDate) {
    const orders = this.getOrdersForExport(startDate, endDate);

    const headers = [
      'Date', 'Order Number', 'Customer Name', 'Customer Email',
      'Subtotal', 'Tax', 'Shipping', 'Discount', 'Total',
      'Payment Method', 'Payment Status', 'Items Count'
    ];

    const rows = [];
    rows.push(headers.join(','));

    orders.forEach(order => {
      const orderTotal = order.pricing?.total || order.total || 0;
      const tax = order.pricing?.tax || order.tax || 0;
      const shipping = typeof order.shipping === 'number' ? order.shipping : 0;
      const discount = order.pricing?.discount || order.discount || 0;
      const subtotal = order.pricing?.subtotal || order.subtotal || (orderTotal - tax - shipping + discount);

      rows.push([
        this.formatDateISO(order.created_at || order.createdAt),
        `"${order.order_number || order.orderNumber || order.id}"`,
        `"${order.customer_name || order.customer?.name || ''}"`,
        `"${order.customer_email || order.customer?.email || ''}"`,
        subtotal.toFixed(2),
        tax.toFixed(2),
        shipping.toFixed(2),
        discount.toFixed(2),
        orderTotal.toFixed(2),
        `"${order.payment?.method || 'N/A'}"`,
        `"${order.payment?.status || order.paymentStatus || 'pending'}"`,
        (order.items || []).length
      ].join(','));
    });

    return rows.join('\n');
  }

  /**
   * Get financial summary for period
   */
  getFinancialSummary(startDate, endDate) {
    const orders = this.getOrdersForExport(startDate, endDate);

    const summary = {
      period: { startDate, endDate },
      totalOrders: orders.length,
      paidOrders: 0,
      pendingOrders: 0,
      refundedOrders: 0,
      grossRevenue: 0,
      netRevenue: 0,
      totalTax: 0,
      totalShipping: 0,
      totalDiscounts: 0,
      averageOrderValue: 0,
      byPaymentMethod: {},
      byState: {}
    };

    orders.forEach(order => {
      const orderTotal = order.pricing?.total || order.total || 0;
      const tax = order.pricing?.tax || order.tax || 0;
      const shipping = typeof order.shipping === 'number' ? order.shipping : 0;
      const discount = order.pricing?.discount || order.discount || 0;
      const paymentStatus = order.payment?.status || order.paymentStatus || 'pending';
      const paymentMethod = order.payment?.method || 'unknown';
      const state = order.shipping_address?.state || order.shippingAddress?.state || 'Unknown';

      // Count by status
      if (paymentStatus === 'completed' || paymentStatus === 'paid') {
        summary.paidOrders++;
        summary.grossRevenue += orderTotal;
        summary.netRevenue += (orderTotal - tax - shipping);
      } else if (paymentStatus === 'refunded') {
        summary.refundedOrders++;
      } else {
        summary.pendingOrders++;
      }

      summary.totalTax += tax;
      summary.totalShipping += shipping;
      summary.totalDiscounts += discount;

      // By payment method
      if (!summary.byPaymentMethod[paymentMethod]) {
        summary.byPaymentMethod[paymentMethod] = { count: 0, total: 0 };
      }
      summary.byPaymentMethod[paymentMethod].count++;
      summary.byPaymentMethod[paymentMethod].total += orderTotal;

      // By state
      if (!summary.byState[state]) {
        summary.byState[state] = { count: 0, total: 0, tax: 0 };
      }
      summary.byState[state].count++;
      summary.byState[state].total += orderTotal;
      summary.byState[state].tax += tax;
    });

    summary.averageOrderValue = summary.paidOrders > 0
      ? summary.grossRevenue / summary.paidOrders
      : 0;

    return summary;
  }

  /**
   * Export tax report by state
   */
  exportTaxReport(startDate, endDate) {
    const orders = this.getOrdersForExport(startDate, endDate);
    const taxByState = {};

    orders.forEach(order => {
      if (order.payment?.status !== 'completed' && order.paymentStatus !== 'paid') return;

      const state = order.shipping_address?.state || order.shippingAddress?.state || 'Unknown';
      const tax = order.pricing?.tax || order.tax || 0;
      const subtotal = order.pricing?.subtotal || order.subtotal || 0;

      if (!taxByState[state]) {
        taxByState[state] = {
          state,
          orderCount: 0,
          taxableSales: 0,
          taxCollected: 0
        };
      }

      taxByState[state].orderCount++;
      taxByState[state].taxableSales += subtotal;
      taxByState[state].taxCollected += tax;
    });

    // Convert to sorted array
    const report = Object.values(taxByState)
      .sort((a, b) => b.taxCollected - a.taxCollected);

    const headers = ['State', 'Order Count', 'Taxable Sales', 'Tax Collected', 'Effective Rate'];
    const rows = [headers.join(',')];

    report.forEach(row => {
      const effectiveRate = row.taxableSales > 0
        ? ((row.taxCollected / row.taxableSales) * 100).toFixed(2) + '%'
        : '0.00%';

      rows.push([
        row.state,
        row.orderCount,
        row.taxableSales.toFixed(2),
        row.taxCollected.toFixed(2),
        effectiveRate
      ].join(','));
    });

    // Add totals row
    const totals = report.reduce((acc, row) => ({
      orderCount: acc.orderCount + row.orderCount,
      taxableSales: acc.taxableSales + row.taxableSales,
      taxCollected: acc.taxCollected + row.taxCollected
    }), { orderCount: 0, taxableSales: 0, taxCollected: 0 });

    rows.push([
      'TOTAL',
      totals.orderCount,
      totals.taxableSales.toFixed(2),
      totals.taxCollected.toFixed(2),
      totals.taxableSales > 0
        ? ((totals.taxCollected / totals.taxableSales) * 100).toFixed(2) + '%'
        : '0.00%'
    ].join(','));

    return rows.join('\n');
  }

  // Helper methods
  formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US');
  }

  formatDateUS(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  formatDateISO(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().split('T')[0];
  }
}

const accountingExportService = new AccountingExportService();

module.exports = {
  accountingExportService,
  AccountingExportService
};
