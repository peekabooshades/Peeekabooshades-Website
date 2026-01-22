/**
 * PEEKABOO SHADES - CART RECOVERY SERVICE
 * ========================================
 * Detects abandoned carts and triggers recovery emails
 */

const { loadDB, saveDB } = require('./db-loader');

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  abandonmentThresholdMinutes: 60, // Consider cart abandoned after 60 minutes
  maxEmailsPerCart: 3,
  emailDelayMinutes: [60, 1440, 4320], // 1 hour, 24 hours, 3 days
  excludeGuestCarts: false,
  minimumCartValue: 0
};

class CartRecoveryService {
  constructor() {
    this.loadSettings();
  }

  loadSettings() {
    try {
      const db = loadDB();
      this.settings = { ...DEFAULT_SETTINGS, ...(db.systemConfig?.cartRecovery || {}) };
    } catch (err) {
      this.settings = DEFAULT_SETTINGS;
    }
  }

  /**
   * Get all abandoned carts
   */
  getAbandonedCarts() {
    const db = loadDB();
    const now = Date.now();
    const thresholdMs = this.settings.abandonmentThresholdMinutes * 60 * 1000;

    // Get carts that haven't been converted to orders
    const carts = db.abandonedCarts || [];

    return carts.filter(cart => {
      // Must have items
      if (!cart.items || cart.items.length === 0) return false;

      // Must have email
      if (!cart.customerEmail) return false;

      // Must be older than threshold
      const cartAge = now - new Date(cart.updatedAt || cart.createdAt).getTime();
      if (cartAge < thresholdMs) return false;

      // Check minimum cart value
      const cartValue = cart.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      if (cartValue < this.settings.minimumCartValue) return false;

      // Check if already converted to order
      if (cart.convertedToOrder) return false;

      return true;
    });
  }

  /**
   * Get carts that need recovery emails
   */
  getCartsNeedingRecoveryEmail() {
    const abandonedCarts = this.getAbandonedCarts();
    const now = Date.now();

    return abandonedCarts.filter(cart => {
      const emailsSent = cart.recoveryEmailsSent || 0;

      // Already sent max emails
      if (emailsSent >= this.settings.maxEmailsPerCart) return false;

      // Check if enough time has passed for next email
      const lastEmailTime = cart.lastRecoveryEmailAt ? new Date(cart.lastRecoveryEmailAt).getTime() : 0;
      const cartCreatedTime = new Date(cart.createdAt).getTime();

      const delayMinutes = this.settings.emailDelayMinutes[emailsSent] || this.settings.emailDelayMinutes[0];
      const delayMs = delayMinutes * 60 * 1000;

      // For first email, check time since cart creation
      // For subsequent emails, check time since last email
      const referenceTime = emailsSent === 0 ? cartCreatedTime : lastEmailTime;
      const timeSinceReference = now - referenceTime;

      return timeSinceReference >= delayMs;
    });
  }

  /**
   * Save or update abandoned cart
   */
  saveAbandonedCart(cartData) {
    const db = loadDB();
    if (!db.abandonedCarts) db.abandonedCarts = [];

    // Find existing cart by session/email
    const existingIndex = db.abandonedCarts.findIndex(c =>
      c.sessionId === cartData.sessionId || c.customerEmail === cartData.customerEmail
    );

    const cart = {
      id: existingIndex > -1 ? db.abandonedCarts[existingIndex].id : `cart-${Date.now()}`,
      sessionId: cartData.sessionId,
      customerEmail: cartData.customerEmail,
      customerName: cartData.customerName || '',
      items: cartData.items || [],
      subtotal: cartData.subtotal || 0,
      createdAt: existingIndex > -1 ? db.abandonedCarts[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recoveryEmailsSent: existingIndex > -1 ? db.abandonedCarts[existingIndex].recoveryEmailsSent : 0,
      lastRecoveryEmailAt: existingIndex > -1 ? db.abandonedCarts[existingIndex].lastRecoveryEmailAt : null,
      convertedToOrder: false,
      recoveryCode: this.generateRecoveryCode()
    };

    if (existingIndex > -1) {
      db.abandonedCarts[existingIndex] = { ...db.abandonedCarts[existingIndex], ...cart };
    } else {
      db.abandonedCarts.push(cart);
    }

    saveDB(db);
    return cart;
  }

  /**
   * Generate unique recovery code for cart
   */
  generateRecoveryCode() {
    return `RCV-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  /**
   * Mark cart as email sent
   */
  markEmailSent(cartId) {
    const db = loadDB();
    const index = (db.abandonedCarts || []).findIndex(c => c.id === cartId);

    if (index === -1) return null;

    db.abandonedCarts[index].recoveryEmailsSent = (db.abandonedCarts[index].recoveryEmailsSent || 0) + 1;
    db.abandonedCarts[index].lastRecoveryEmailAt = new Date().toISOString();

    saveDB(db);
    return db.abandonedCarts[index];
  }

  /**
   * Mark cart as converted to order
   */
  markAsConverted(cartId, orderId) {
    const db = loadDB();
    const index = (db.abandonedCarts || []).findIndex(c => c.id === cartId);

    if (index === -1) return null;

    db.abandonedCarts[index].convertedToOrder = true;
    db.abandonedCarts[index].convertedOrderId = orderId;
    db.abandonedCarts[index].convertedAt = new Date().toISOString();

    saveDB(db);
    return db.abandonedCarts[index];
  }

  /**
   * Get cart by recovery code
   */
  getCartByRecoveryCode(code) {
    const db = loadDB();
    return (db.abandonedCarts || []).find(c => c.recoveryCode === code);
  }

  /**
   * Generate recovery email HTML
   */
  generateRecoveryEmailHTML(cart, emailNumber = 1) {
    const recoveryUrl = `https://peekabooshades.com/cart?recover=${cart.recoveryCode}`;
    const itemsList = cart.items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.name || item.productName || 'Custom Shade'}
          ${item.width && item.height ? `<br><small style="color: #888;">${item.width}" x ${item.height}"</small>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    const subjects = [
      'You left something behind!',
      'Your custom shades are still waiting',
      'Last chance to complete your order'
    ];

    const intros = [
      'We noticed you started configuring some beautiful custom shades but didn\'t complete your order.',
      'Your custom window treatments are still saved in your cart. Don\'t miss out on the perfect shades for your home!',
      'This is your last reminder - your custom-configured shades are waiting for you!'
    ];

    return {
      subject: subjects[emailNumber - 1] || subjects[0],
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #8E6545; margin-bottom: 10px;">Peekaboo Shades</h1>
  </div>

  <h2 style="color: #333;">Hi ${cart.customerName || 'there'},</h2>

  <p>${intros[emailNumber - 1] || intros[0]}</p>

  <h3 style="margin-top: 30px;">Your Cart:</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr style="background: #f8f6f3;">
        <th style="padding: 10px; text-align: left;">Item</th>
        <th style="padding: 10px; text-align: center;">Qty</th>
        <th style="padding: 10px; text-align: right;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemsList}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
        <td style="padding: 10px; text-align: right; font-weight: bold;">$${(cart.subtotal || 0).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${recoveryUrl}" style="display: inline-block; background: #8E6545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">
      Complete Your Order
    </a>
  </div>

  <p style="color: #666; font-size: 14px;">
    If you have any questions about your order, feel free to reply to this email or call us at (469) 758-8935.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #888; font-size: 12px; text-align: center;">
    Peekaboo Shades | Custom Window Treatments<br>
    <a href="https://peekabooshades.com" style="color: #8E6545;">www.peekabooshades.com</a>
  </p>
</body>
</html>
      `
    };
  }

  /**
   * Get recovery stats
   */
  getStats() {
    const db = loadDB();
    const carts = db.abandonedCarts || [];

    const totalAbandoned = carts.filter(c => !c.convertedToOrder).length;
    const totalRecovered = carts.filter(c => c.convertedToOrder).length;
    const totalValue = carts.filter(c => !c.convertedToOrder).reduce((sum, c) => sum + (c.subtotal || 0), 0);
    const recoveredValue = carts.filter(c => c.convertedToOrder).reduce((sum, c) => sum + (c.subtotal || 0), 0);
    const emailsSent = carts.reduce((sum, c) => sum + (c.recoveryEmailsSent || 0), 0);

    return {
      totalAbandoned,
      totalRecovered,
      recoveryRate: totalAbandoned + totalRecovered > 0
        ? ((totalRecovered / (totalAbandoned + totalRecovered)) * 100).toFixed(1)
        : 0,
      totalAbandonedValue: totalValue,
      totalRecoveredValue: recoveredValue,
      emailsSent
    };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    const db = loadDB();
    if (!db.systemConfig) db.systemConfig = {};
    db.systemConfig.cartRecovery = { ...this.settings, ...newSettings };
    saveDB(db);
    this.loadSettings();
    return this.settings;
  }
}

const cartRecoveryService = new CartRecoveryService();

module.exports = {
  cartRecoveryService,
  CartRecoveryService
};
