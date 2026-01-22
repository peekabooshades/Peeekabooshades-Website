/**
 * PEEKABOO SHADES - NOTIFICATION SERVICE
 * =======================================
 * Handles Slack webhooks and other alert notifications
 * for critical business events like low stock, failed payments, etc.
 */

const https = require('https');
const http = require('http');
const { loadDB, saveDB } = require('./db-loader');

/**
 * Notification Service Class
 */
class NotificationService {
  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    this.customWebhookUrl = process.env.CUSTOM_WEBHOOK_URL || null;
    this.lowStockThreshold = parseInt(process.env.LOW_STOCK_THRESHOLD) || 10;
  }

  /**
   * Send a Slack notification
   */
  async sendSlack(message) {
    if (!this.slackWebhookUrl) {
      console.log('[NOTIFICATION] Slack not configured, logging locally:', message.text || message);
      this.logNotification('slack', message, 'not_configured');
      return { success: false, reason: 'Slack webhook not configured' };
    }

    try {
      const payload = typeof message === 'string'
        ? { text: message }
        : message;

      await this.postToWebhook(this.slackWebhookUrl, payload);
      this.logNotification('slack', payload, 'sent');
      return { success: true };
    } catch (error) {
      console.error('[NOTIFICATION] Slack error:', error.message);
      this.logNotification('slack', message, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send to custom webhook
   */
  async sendWebhook(url, payload) {
    const webhookUrl = url || this.customWebhookUrl;
    if (!webhookUrl) {
      return { success: false, reason: 'No webhook URL provided' };
    }

    try {
      await this.postToWebhook(webhookUrl, payload);
      this.logNotification('webhook', payload, 'sent');
      return { success: true };
    } catch (error) {
      this.logNotification('webhook', payload, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * POST to webhook URL
   */
  postToWebhook(url, payload) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const data = JSON.stringify(payload);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Log notification to database
   */
  logNotification(type, payload, status, errorMessage = null) {
    try {
      const db = loadDB();
      if (!db.notificationLogs) db.notificationLogs = [];

      db.notificationLogs.push({
        id: `notif-${Date.now()}`,
        type,
        payload: typeof payload === 'string' ? { text: payload } : payload,
        status,
        errorMessage,
        createdAt: new Date().toISOString()
      });

      // Keep only last 500 logs
      if (db.notificationLogs.length > 500) {
        db.notificationLogs = db.notificationLogs.slice(-500);
      }

      saveDB(db);
    } catch (err) {
      console.error('Failed to log notification:', err.message);
    }
  }

  // ============================================
  // ALERT TEMPLATES
  // ============================================

  /**
   * Alert: Low Stock Warning
   */
  async alertLowStock(product) {
    const message = {
      text: `Low Stock Alert: ${product.name}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📦 Low Stock Alert', emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Product:*\n${product.name}` },
            { type: 'mrkdwn', text: `*SKU:*\n${product.sku || 'N/A'}` },
            { type: 'mrkdwn', text: `*Current Stock:*\n${product.stock || 0}` },
            { type: 'mrkdwn', text: `*Threshold:*\n${this.lowStockThreshold}` }
          ]
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Sent at ${new Date().toLocaleString()}` }
          ]
        }
      ]
    };

    return this.sendSlack(message);
  }

  /**
   * Alert: Failed Payment
   */
  async alertFailedPayment(order, error) {
    const message = {
      text: `Payment Failed: Order ${order.orderNumber || order.id}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '💳 Payment Failed', emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Order:*\n${order.orderNumber || order.id}` },
            { type: 'mrkdwn', text: `*Amount:*\n$${(order.total || 0).toFixed(2)}` },
            { type: 'mrkdwn', text: `*Customer:*\n${order.customerEmail || 'Unknown'}` },
            { type: 'mrkdwn', text: `*Error:*\n${error || 'Unknown error'}` }
          ]
        }
      ]
    };

    return this.sendSlack(message);
  }

  /**
   * Alert: High Value Order
   */
  async alertHighValueOrder(order, threshold = 500) {
    if ((order.total || 0) < threshold) return { success: false, reason: 'Below threshold' };

    const message = {
      text: `High Value Order: $${order.total.toFixed(2)}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '💰 High Value Order', emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Order:*\n${order.orderNumber || order.id}` },
            { type: 'mrkdwn', text: `*Total:*\n$${(order.total || 0).toFixed(2)}` },
            { type: 'mrkdwn', text: `*Customer:*\n${order.customerName || 'Guest'}` },
            { type: 'mrkdwn', text: `*Items:*\n${order.items?.length || 0}` }
          ]
        }
      ]
    };

    return this.sendSlack(message);
  }

  /**
   * Alert: New Warranty Claim
   */
  async alertWarrantyClaim(claim) {
    const message = {
      text: `New Warranty Claim: ${claim.id}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔧 New Warranty Claim', emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Claim ID:*\n${claim.id}` },
            { type: 'mrkdwn', text: `*Order:*\n${claim.orderNumber || 'N/A'}` },
            { type: 'mrkdwn', text: `*Customer:*\n${claim.customerName || 'Unknown'}` },
            { type: 'mrkdwn', text: `*Issue:*\n${claim.issueType || claim.description?.substring(0, 50) || 'N/A'}` }
          ]
        }
      ]
    };

    return this.sendSlack(message);
  }

  /**
   * Alert: System Error
   */
  async alertSystemError(error, context = {}) {
    const message = {
      text: `System Error: ${error.message || error}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚨 System Error', emoji: true }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Error:* ${error.message || error}` }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Context:*\n${context.action || 'Unknown'}` },
            { type: 'mrkdwn', text: `*Time:*\n${new Date().toISOString()}` }
          ]
        }
      ]
    };

    return this.sendSlack(message);
  }

  /**
   * Check product stock and alert if low
   */
  checkAndAlertLowStock(product) {
    const stock = product.stock || product.quantity || 0;
    if (stock <= this.lowStockThreshold && stock > 0) {
      this.alertLowStock(product);
    }
  }

  /**
   * Get notification service status
   */
  getStatus() {
    return {
      slackConfigured: !!this.slackWebhookUrl,
      customWebhookConfigured: !!this.customWebhookUrl,
      lowStockThreshold: this.lowStockThreshold
    };
  }
}

// Export singleton instance
const notificationService = new NotificationService();

module.exports = {
  notificationService,
  NotificationService
};
