/**
 * PEEKABOO SHADES - EMAIL SERVICE
 * ================================
 * Handles all transactional emails using SendGrid
 * Falls back to dev_log mode if not configured
 */

const { v4: uuidv4 } = require('uuid');
const { loadDB, saveDB } = require('./db-loader');

/**
 * Email Service Class
 */
class EmailService {
  constructor() {
    this.provider = null;
    this.sgMail = null;
    this.fromEmail = process.env.EMAIL_FROM_ADDRESS || 'orders@peekabooshades.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Peekaboo Shades';
    this.initialized = false;
  }

  /**
   * Initialize the email service
   */
  initialize() {
    if (this.initialized) return;

    const apiKey = process.env.SENDGRID_API_KEY;

    if (apiKey && apiKey.startsWith('SG.')) {
      try {
        this.sgMail = require('@sendgrid/mail');
        this.sgMail.setApiKey(apiKey);
        this.provider = 'sendgrid';
        console.log('Email service initialized with SendGrid');
      } catch (err) {
        console.error('SendGrid package not installed. Run: npm install @sendgrid/mail');
        this.provider = 'dev_log';
      }
    } else {
      this.provider = 'dev_log';
      console.log('Email service running in dev_log mode (no SENDGRID_API_KEY configured)');
    }

    this.initialized = true;
  }

  /**
   * Send an email
   */
  async send(options) {
    this.initialize();

    const { to, subject, html, text, templateId, dynamicData, orderId } = options;

    const emailLog = {
      id: `email-${uuidv4()}`,
      templateId: templateId || 'custom',
      to,
      subject,
      body: html,
      textBody: text,
      orderId: orderId || null,
      provider: this.provider,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      if (this.provider === 'sendgrid') {
        const msg = {
          to,
          from: {
            email: this.fromEmail,
            name: this.fromName
          },
          subject,
          html,
          text: text || this.stripHtml(html)
        };

        // Use dynamic template if provided
        if (templateId && dynamicData) {
          msg.templateId = templateId;
          msg.dynamicTemplateData = dynamicData;
          delete msg.html;
          delete msg.text;
        }

        await this.sgMail.send(msg);
        emailLog.status = 'sent';
        emailLog.sentAt = new Date().toISOString();
        console.log(`Email sent to ${to}: ${subject}`);
      } else {
        // Dev log mode - just log to database
        emailLog.status = 'logged';
        emailLog.sentAt = new Date().toISOString();
        console.log(`[DEV_LOG] Email would be sent to ${to}: ${subject}`);
      }

      this.logEmail(emailLog);
      return { success: true, emailId: emailLog.id };

    } catch (error) {
      emailLog.status = 'failed';
      emailLog.errorMessage = error.message;
      this.logEmail(emailLog);
      console.error('Email send error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log email to database
   */
  logEmail(emailLog) {
    try {
      const db = loadDB();
      if (!db.emailLogs) db.emailLogs = [];
      db.emailLogs.push(emailLog);
      // Keep only last 1000 logs
      if (db.emailLogs.length > 1000) {
        db.emailLogs = db.emailLogs.slice(-1000);
      }
      saveDB(db);
    } catch (err) {
      console.error('Failed to log email:', err.message);
    }
  }

  /**
   * Strip HTML tags for plain text version
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(order) {
    const html = `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8E6545; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Order Confirmed!</h1>
        </div>
        <div style="padding: 30px; background: #f8f6f3;">
          <p>Hi ${order.customerName || 'Valued Customer'},</p>
          <p>Thank you for your order! We're excited to get started on your custom window treatments.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #8E6545; margin-top: 0;">Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber || order.id}</p>
            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
            <p><strong>Total:</strong> $${(order.total || 0).toFixed(2)}</p>
          </div>

          <p>You can track your order status anytime at:</p>
          <p><a href="https://peekabooshades.com/order-lookup.html?order=${order.orderNumber}" style="color: #8E6545;">Track Your Order</a></p>

          <p style="margin-top: 30px;">Questions? Reply to this email or call us at 1-800-SHADES.</p>

          <p>Best regards,<br>The Peekaboo Shades Team</p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>Peekaboo Shades | Dallas, TX</p>
          <p>info@peekabooshades.com | 1-800-SHADES</p>
        </div>
      </div>
    `;

    return this.send({
      to: order.customerEmail || order.email,
      subject: `Order Confirmed - ${order.orderNumber || order.id}`,
      html,
      orderId: order.id
    });
  }

  /**
   * Send shipping notification email
   */
  async sendShippingNotification(order, shipment) {
    const html = `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8E6545; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Your Order Has Shipped!</h1>
        </div>
        <div style="padding: 30px; background: #f8f6f3;">
          <p>Hi ${order.customerName || 'Valued Customer'},</p>
          <p>Great news! Your order is on its way.</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #8E6545; margin-top: 0;">Shipping Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber || order.id}</p>
            <p><strong>Carrier:</strong> ${(shipment.carrier || 'Standard Shipping').toUpperCase()}</p>
            <p><strong>Tracking Number:</strong> ${shipment.trackingNumber || 'N/A'}</p>
            ${shipment.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${shipment.estimatedDelivery}</p>` : ''}
          </div>

          ${shipment.trackingUrl ? `<p><a href="${shipment.trackingUrl}" style="display: inline-block; background: #8E6545; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none;">Track Your Package</a></p>` : ''}

          <p style="margin-top: 30px;">Questions? Reply to this email or call us at 1-800-SHADES.</p>

          <p>Best regards,<br>The Peekaboo Shades Team</p>
        </div>
      </div>
    `;

    return this.send({
      to: order.customerEmail || order.email,
      subject: `Your Order Has Shipped - ${order.orderNumber || order.id}`,
      html,
      orderId: order.id
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, resetToken, userName) {
    const resetUrl = `https://peekabooshades.com/reset-password.html?token=${resetToken}`;

    const html = `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8E6545; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset</h1>
        </div>
        <div style="padding: 30px; background: #f8f6f3;">
          <p>Hi ${userName || 'there'},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #8E6545; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">Reset Password</a>
          </p>

          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.</p>

          <p>Best regards,<br>The Peekaboo Shades Team</p>
        </div>
      </div>
    `;

    return this.send({
      to: email,
      subject: 'Reset Your Password - Peekaboo Shades',
      html
    });
  }

  /**
   * Send warranty claim update email
   */
  async sendWarrantyUpdate(claim, customer) {
    const statusMessages = {
      'submitted': 'Your warranty claim has been received and is being reviewed.',
      'under_review': 'Your warranty claim is currently under review by our team.',
      'approved': 'Great news! Your warranty claim has been approved.',
      'denied': 'We regret to inform you that your warranty claim has been denied.',
      'resolved': 'Your warranty claim has been resolved.'
    };

    const html = `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8E6545; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Warranty Claim Update</h1>
        </div>
        <div style="padding: 30px; background: #f8f6f3;">
          <p>Hi ${customer.name || 'Valued Customer'},</p>
          <p>${statusMessages[claim.status] || 'Your warranty claim status has been updated.'}</p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #8E6545; margin-top: 0;">Claim Details</h3>
            <p><strong>Claim ID:</strong> ${claim.id}</p>
            <p><strong>Status:</strong> ${claim.status.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Order Number:</strong> ${claim.orderNumber || 'N/A'}</p>
            ${claim.resolution ? `<p><strong>Resolution:</strong> ${claim.resolution}</p>` : ''}
          </div>

          <p>Questions? Reply to this email or call us at 1-800-SHADES.</p>

          <p>Best regards,<br>The Peekaboo Shades Team</p>
        </div>
      </div>
    `;

    return this.send({
      to: customer.email,
      subject: `Warranty Claim Update - ${claim.id}`,
      html
    });
  }

  /**
   * Get email service status
   */
  getStatus() {
    this.initialize();
    return {
      provider: this.provider,
      configured: this.provider === 'sendgrid',
      fromEmail: this.fromEmail,
      fromName: this.fromName
    };
  }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = {
  emailService,
  EmailService
};
