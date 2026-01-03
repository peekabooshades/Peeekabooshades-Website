/**
 * ANALYTICS SERVICE - Event Tracking + Dashboard Widgets
 * Ticket 003: Analytics Events + Dashboard Widgets
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

// Event Types
const EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  PRODUCT_VIEW: 'product_view',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_COMPLETED: 'checkout_completed',
  PURCHASE: 'purchase',
  SEARCH: 'search',
  FILTER_APPLIED: 'filter_applied',
  QUOTE_REQUESTED: 'quote_requested'
};

// Traffic Sources
const TRAFFIC_SOURCES = {
  DIRECT: 'direct',
  ORGANIC: 'organic',
  PAID: 'paid',
  SOCIAL: 'social',
  REFERRAL: 'referral',
  EMAIL: 'email'
};

function loadDatabase() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * Track an analytics event
 */
function trackEvent(eventData) {
  const db = loadDatabase();

  if (!db.analyticsEvents) db.analyticsEvents = [];

  const event = {
    id: `evt-${uuidv4().slice(0, 8)}`,
    type: eventData.type || EVENT_TYPES.PAGE_VIEW,
    sessionId: eventData.sessionId || 'anonymous',
    userId: eventData.userId || null,
    productId: eventData.productId || null,
    productName: eventData.productName || null,
    fabricCode: eventData.fabricCode || null,
    orderId: eventData.orderId || null,
    orderNumber: eventData.orderNumber || null,
    value: eventData.value || 0,
    quantity: eventData.quantity || 1,
    source: eventData.source || TRAFFIC_SOURCES.DIRECT,
    page: eventData.page || '',
    referrer: eventData.referrer || null,
    metadata: eventData.metadata || {},
    createdAt: new Date().toISOString()
  };

  db.analyticsEvents.push(event);

  // Trim old events (keep last 50000)
  if (db.analyticsEvents.length > 50000) {
    db.analyticsEvents = db.analyticsEvents.slice(-50000);
  }

  saveDatabase(db);
  return event;
}

/**
 * Track order completion (called from order-service)
 */
function trackOrderCompletion(order) {
  return trackEvent({
    type: EVENT_TYPES.CHECKOUT_COMPLETED,
    sessionId: order.items[0]?.session_id,
    orderId: order.id,
    orderNumber: order.order_number,
    value: order.pricing.total,
    quantity: order.items.length,
    metadata: {
      subtotal: order.pricing.subtotal,
      tax: order.pricing.tax,
      shipping: order.pricing.shipping,
      itemCount: order.items.length
    }
  });
}

/**
 * Get conversion funnel data
 */
function getConversionFunnel(startDate = null, endDate = null) {
  const db = loadDatabase();
  let events = db.analyticsEvents || [];

  // Filter by date range
  if (startDate) {
    const start = new Date(startDate);
    events = events.filter(e => new Date(e.createdAt) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    events = events.filter(e => new Date(e.createdAt) <= end);
  }

  const funnel = {
    pageViews: events.filter(e => e.type === EVENT_TYPES.PAGE_VIEW).length,
    productViews: events.filter(e => e.type === EVENT_TYPES.PRODUCT_VIEW).length,
    addToCarts: events.filter(e => e.type === EVENT_TYPES.ADD_TO_CART).length,
    checkoutStarted: events.filter(e => e.type === EVENT_TYPES.CHECKOUT_STARTED).length,
    checkoutCompleted: events.filter(e => e.type === EVENT_TYPES.CHECKOUT_COMPLETED).length,
    purchases: events.filter(e => e.type === EVENT_TYPES.PURCHASE).length
  };

  // Calculate conversion rates
  funnel.productViewRate = funnel.pageViews > 0
    ? ((funnel.productViews / funnel.pageViews) * 100).toFixed(2)
    : 0;
  funnel.addToCartRate = funnel.productViews > 0
    ? ((funnel.addToCarts / funnel.productViews) * 100).toFixed(2)
    : 0;
  funnel.checkoutRate = funnel.addToCarts > 0
    ? ((funnel.checkoutStarted / funnel.addToCarts) * 100).toFixed(2)
    : 0;
  funnel.conversionRate = funnel.checkoutStarted > 0
    ? ((funnel.checkoutCompleted / funnel.checkoutStarted) * 100).toFixed(2)
    : 0;
  funnel.overallConversionRate = funnel.pageViews > 0
    ? ((funnel.checkoutCompleted / funnel.pageViews) * 100).toFixed(2)
    : 0;

  return funnel;
}

/**
 * Get dashboard widget data
 */
function getDashboardWidgets(startDate = null, endDate = null) {
  const db = loadDatabase();
  let events = db.analyticsEvents || [];
  let orders = db.orders || [];

  // Filter by date range
  if (startDate) {
    const start = new Date(startDate);
    events = events.filter(e => new Date(e.createdAt) >= start);
    orders = orders.filter(o => new Date(o.created_at) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    events = events.filter(e => new Date(e.createdAt) <= end);
    orders = orders.filter(o => new Date(o.created_at) <= end);
  }

  // Revenue widget
  const totalRevenue = orders.reduce((sum, o) => sum + (o.pricing?.total || o.total || 0), 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  // Orders widget
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o =>
    o.status === 'order_placed' || o.status === 'payment_received'
  ).length;
  const completedOrders = orders.filter(o =>
    o.status === 'delivered' || o.status === 'closed'
  ).length;

  // Traffic widget
  const trafficSources = {};
  events.forEach(e => {
    const source = e.source || 'direct';
    trafficSources[source] = (trafficSources[source] || 0) + 1;
  });

  // Top products widget
  const productViews = {};
  events.filter(e => e.productId && e.type === EVENT_TYPES.PRODUCT_VIEW).forEach(e => {
    const key = e.productId;
    if (!productViews[key]) {
      productViews[key] = { id: key, name: e.productName || 'Unknown', views: 0, addToCarts: 0 };
    }
    productViews[key].views++;
  });
  events.filter(e => e.productId && e.type === EVENT_TYPES.ADD_TO_CART).forEach(e => {
    const key = e.productId;
    if (productViews[key]) {
      productViews[key].addToCarts++;
    }
  });
  const topProducts = Object.values(productViews)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  // Top fabrics widget
  const fabricViews = {};
  events.filter(e => e.fabricCode).forEach(e => {
    const key = e.fabricCode;
    fabricViews[key] = (fabricViews[key] || 0) + 1;
  });
  const topFabrics = Object.entries(fabricViews)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  // Conversion funnel (mini)
  const funnel = getConversionFunnel(startDate, endDate);

  return {
    revenue: {
      total: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      currency: 'USD'
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      completed: completedOrders
    },
    traffic: {
      total: events.length,
      sources: trafficSources
    },
    topProducts,
    topFabrics,
    funnel: {
      pageViews: funnel.pageViews,
      addToCarts: funnel.addToCarts,
      checkouts: funnel.checkoutCompleted,
      conversionRate: funnel.overallConversionRate
    }
  };
}

/**
 * Get revenue by period (daily/weekly/monthly)
 */
function getRevenueByPeriod(period = 'daily', startDate = null, endDate = null) {
  const db = loadDatabase();
  let orders = db.orders || [];

  // Default to last 30 days
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start = startDate ? new Date(startDate) : defaultStart;
  const end = endDate ? new Date(endDate) : now;

  orders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    return orderDate >= start && orderDate <= end;
  });

  // Group by period
  const grouped = {};
  orders.forEach(o => {
    const date = new Date(o.created_at);
    let key;
    if (period === 'daily') {
      key = date.toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!grouped[key]) {
      grouped[key] = { period: key, revenue: 0, orders: 0 };
    }
    grouped[key].revenue += o.pricing?.total || o.total || 0;
    grouped[key].orders++;
  });

  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get real-time stats (last 24 hours)
 */
function getRealTimeStats() {
  const db = loadDatabase();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const events = (db.analyticsEvents || []).filter(e =>
    new Date(e.createdAt) >= yesterday
  );
  const orders = (db.orders || []).filter(o =>
    new Date(o.created_at) >= yesterday
  );

  // Active sessions (unique sessionIds in last hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentEvents = events.filter(e => new Date(e.createdAt) >= oneHourAgo);
  const activeSessions = new Set(recentEvents.map(e => e.sessionId)).size;

  return {
    last24Hours: {
      pageViews: events.filter(e => e.type === EVENT_TYPES.PAGE_VIEW).length,
      productViews: events.filter(e => e.type === EVENT_TYPES.PRODUCT_VIEW).length,
      addToCarts: events.filter(e => e.type === EVENT_TYPES.ADD_TO_CART).length,
      orders: orders.length,
      revenue: orders.reduce((sum, o) => sum + (o.pricing?.total || o.total || 0), 0)
    },
    activeSessions,
    timestamp: now.toISOString()
  };
}

/**
 * Get sales by category (from actual orders and categories)
 */
function getSalesByCategory(startDate = null, endDate = null) {
  const db = loadDatabase();
  let orders = db.orders || [];
  const categories = db.categories || [];
  const products = db.products || [];

  // Filter by date range
  if (startDate) {
    const start = new Date(startDate);
    orders = orders.filter(o => new Date(o.created_at) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    orders = orders.filter(o => new Date(o.created_at) <= end);
  }

  // Build category sales map
  const categorySales = {};

  // Initialize with actual categories from database
  categories.forEach(cat => {
    categorySales[cat.id] = {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      orderCount: 0,
      itemCount: 0,
      revenue: 0
    };
  });

  // Aggregate sales from orders
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.category_id && categorySales[product.category_id]) {
        categorySales[product.category_id].itemCount += item.quantity || 1;
        categorySales[product.category_id].revenue += item.line_total || item.calculated_price || 0;
      }
    });
  });

  // Count unique orders per category
  orders.forEach(order => {
    const categoryIds = new Set();
    (order.items || []).forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (product && product.category_id) {
        categoryIds.add(product.category_id);
      }
    });
    categoryIds.forEach(catId => {
      if (categorySales[catId]) {
        categorySales[catId].orderCount++;
      }
    });
  });

  // Convert to array and sort by revenue
  return Object.values(categorySales)
    .filter(cat => cat.revenue > 0 || cat.itemCount > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

module.exports = {
  EVENT_TYPES,
  TRAFFIC_SOURCES,
  trackEvent,
  trackOrderCompletion,
  getConversionFunnel,
  getDashboardWidgets,
  getRevenueByPeriod,
  getRealTimeStats,
  getSalesByCategory
};
