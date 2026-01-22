/**
 * PEEKABOO SHADES - SAVED QUOTES SERVICE
 * =======================================
 * Allows customers to save product configurations for later
 * Supports email sharing and expiration
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { loadDB, saveDB } = require('./db-loader');

// Quote expiration (30 days by default)
const DEFAULT_EXPIRY_DAYS = 30;

/**
 * Saved Quotes Service Class
 */
class SavedQuotesService {
  constructor() {
    this.ensureCollection();
  }

  /**
   * Ensure savedQuotes collection exists
   */
  ensureCollection() {
    try {
      const db = loadDB();
      if (!db.savedQuotes) {
        db.savedQuotes = [];
        saveDB(db);
      }
    } catch (err) {
      console.error('Error ensuring savedQuotes collection:', err);
    }
  }

  /**
   * Generate a unique share code
   */
  generateShareCode() {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }

  /**
   * Save a quote for later
   */
  saveQuote(data) {
    const db = loadDB();
    if (!db.savedQuotes) db.savedQuotes = [];

    const expiryDays = data.expiryDays || DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const savedQuote = {
      id: `sq-${uuidv4()}`,
      shareCode: this.generateShareCode(),

      // Customer info (optional for anonymous saves)
      customerId: data.customerId || null,
      customerEmail: data.customerEmail || null,
      customerName: data.customerName || null,
      customerPhone: data.customerPhone || null,

      // Quote details
      name: data.name || 'My Saved Quote',
      items: data.items || [],
      subtotal: data.subtotal || 0,

      // Shipping info if provided
      shippingAddress: data.shippingAddress || null,

      // Metadata
      source: data.source || 'website', // website, email, admin
      notes: data.notes || '',
      tags: data.tags || [],

      // Status
      status: 'active', // active, expired, converted, deleted
      convertedToOrderId: null,

      // Timestamps
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastViewedAt: null,
      viewCount: 0
    };

    db.savedQuotes.push(savedQuote);
    saveDB(db);

    return savedQuote;
  }

  /**
   * Get quote by ID
   */
  getQuoteById(quoteId) {
    const db = loadDB();
    return (db.savedQuotes || []).find(q => q.id === quoteId);
  }

  /**
   * Get quote by share code (public access)
   */
  getQuoteByShareCode(shareCode) {
    const db = loadDB();
    const quote = (db.savedQuotes || []).find(
      q => q.shareCode === shareCode && q.status === 'active'
    );

    if (quote) {
      // Check if expired
      if (new Date(quote.expiresAt) < new Date()) {
        this.updateQuote(quote.id, { status: 'expired' });
        return null;
      }

      // Track view
      this.updateQuote(quote.id, {
        lastViewedAt: new Date().toISOString(),
        viewCount: (quote.viewCount || 0) + 1
      });
    }

    return quote;
  }

  /**
   * Get quotes by customer ID
   */
  getQuotesByCustomer(customerId) {
    const db = loadDB();
    return (db.savedQuotes || [])
      .filter(q => q.customerId === customerId && q.status === 'active')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Get quotes by customer email
   */
  getQuotesByEmail(email) {
    const db = loadDB();
    return (db.savedQuotes || [])
      .filter(q => q.customerEmail?.toLowerCase() === email.toLowerCase() && q.status === 'active')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Update a saved quote
   */
  updateQuote(quoteId, updates) {
    const db = loadDB();
    if (!db.savedQuotes) db.savedQuotes = [];

    const index = db.savedQuotes.findIndex(q => q.id === quoteId);
    if (index === -1) return null;

    db.savedQuotes[index] = {
      ...db.savedQuotes[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    saveDB(db);
    return db.savedQuotes[index];
  }

  /**
   * Delete a saved quote (soft delete)
   */
  deleteQuote(quoteId) {
    return this.updateQuote(quoteId, { status: 'deleted' });
  }

  /**
   * Mark quote as converted to order
   */
  convertToOrder(quoteId, orderId) {
    return this.updateQuote(quoteId, {
      status: 'converted',
      convertedToOrderId: orderId
    });
  }

  /**
   * Extend quote expiration
   */
  extendExpiration(quoteId, additionalDays = 30) {
    const quote = this.getQuoteById(quoteId);
    if (!quote) return null;

    const currentExpiry = new Date(quote.expiresAt);
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;

    baseDate.setDate(baseDate.getDate() + additionalDays);

    return this.updateQuote(quoteId, {
      expiresAt: baseDate.toISOString(),
      status: 'active' // Reactivate if expired
    });
  }

  /**
   * Add item to saved quote
   */
  addItem(quoteId, item) {
    const quote = this.getQuoteById(quoteId);
    if (!quote) return null;

    const items = [...(quote.items || [])];
    items.push({
      id: `item-${uuidv4()}`,
      ...item,
      addedAt: new Date().toISOString()
    });

    const subtotal = this.calculateSubtotal(items);
    return this.updateQuote(quoteId, { items, subtotal });
  }

  /**
   * Remove item from saved quote
   */
  removeItem(quoteId, itemId) {
    const quote = this.getQuoteById(quoteId);
    if (!quote) return null;

    const items = (quote.items || []).filter(item => item.id !== itemId);
    const subtotal = this.calculateSubtotal(items);

    return this.updateQuote(quoteId, { items, subtotal });
  }

  /**
   * Update item in saved quote
   */
  updateItem(quoteId, itemId, updates) {
    const quote = this.getQuoteById(quoteId);
    if (!quote) return null;

    const items = (quote.items || []).map(item => {
      if (item.id === itemId) {
        return { ...item, ...updates, updatedAt: new Date().toISOString() };
      }
      return item;
    });

    const subtotal = this.calculateSubtotal(items);
    return this.updateQuote(quoteId, { items, subtotal });
  }

  /**
   * Calculate subtotal for items
   */
  calculateSubtotal(items) {
    return items.reduce((sum, item) => {
      const price = item.price || item.unitPrice || 0;
      const quantity = item.quantity || 1;
      return sum + (price * quantity);
    }, 0);
  }

  /**
   * Clean up expired quotes
   */
  cleanupExpired() {
    const db = loadDB();
    if (!db.savedQuotes) return { updated: 0 };

    let updated = 0;
    const now = new Date();

    db.savedQuotes.forEach((quote, index) => {
      if (quote.status === 'active' && new Date(quote.expiresAt) < now) {
        db.savedQuotes[index].status = 'expired';
        db.savedQuotes[index].updatedAt = now.toISOString();
        updated++;
      }
    });

    if (updated > 0) {
      saveDB(db);
    }

    return { updated };
  }

  /**
   * Get all saved quotes (admin)
   */
  getAllQuotes(filters = {}) {
    const db = loadDB();
    let quotes = db.savedQuotes || [];

    // Apply filters
    if (filters.status) {
      quotes = quotes.filter(q => q.status === filters.status);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      quotes = quotes.filter(q =>
        q.name?.toLowerCase().includes(search) ||
        q.customerEmail?.toLowerCase().includes(search) ||
        q.customerName?.toLowerCase().includes(search) ||
        q.shareCode?.toLowerCase().includes(search)
      );
    }

    // Sort
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
    quotes.sort((a, b) => {
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        return sortOrder * (new Date(b[sortBy]) - new Date(a[sortBy]));
      }
      return sortOrder * (a[sortBy] > b[sortBy] ? 1 : -1);
    });

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const startIndex = (page - 1) * limit;

    return {
      quotes: quotes.slice(startIndex, startIndex + limit),
      total: quotes.length,
      page,
      totalPages: Math.ceil(quotes.length / limit)
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    const db = loadDB();
    const quotes = db.savedQuotes || [];

    const stats = {
      total: quotes.length,
      active: quotes.filter(q => q.status === 'active').length,
      expired: quotes.filter(q => q.status === 'expired').length,
      converted: quotes.filter(q => q.status === 'converted').length,
      totalValue: quotes
        .filter(q => q.status === 'active')
        .reduce((sum, q) => sum + (q.subtotal || 0), 0)
    };

    // Recent activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    stats.createdLast30Days = quotes.filter(
      q => new Date(q.createdAt) >= thirtyDaysAgo
    ).length;

    stats.convertedLast30Days = quotes.filter(
      q => q.status === 'converted' && new Date(q.updatedAt) >= thirtyDaysAgo
    ).length;

    return stats;
  }
}

// Export singleton instance
const savedQuotesService = new SavedQuotesService();

module.exports = {
  savedQuotesService,
  SavedQuotesService
};
