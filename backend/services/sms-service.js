/**
 * PEEKABOO SHADES - SMS SERVICE
 * ==============================
 * Handles SMS notifications using Twilio
 * Falls back to dev_log mode if not configured
 */

const { v4: uuidv4 } = require('uuid');
const { loadDB, saveDB } = require('./db-loader');

/**
 * SMS Service Class
 */
class SMSService {
  constructor() {
    this.provider = null;
    this.twilioClient = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || null;
    this.initialized = false;
  }

  /**
   * Initialize the SMS service
   */
  initialize() {
    if (this.initialized) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken && this.fromNumber) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(accountSid, authToken);
        this.provider = 'twilio';
        console.log('SMS service initialized with Twilio');
      } catch (err) {
        console.error('Twilio package not installed. Run: npm install twilio');
        this.provider = 'dev_log';
      }
    } else {
      this.provider = 'dev_log';
      console.log('SMS service running in dev_log mode (Twilio not configured)');
    }

    this.initialized = true;
  }

  /**
   * Send an SMS message
   */
  async send(to, message, options = {}) {
    this.initialize();

    // Normalize phone number
    const phoneNumber = this.normalizePhoneNumber(to);
    if (!phoneNumber) {
      return { success: false, error: 'Invalid phone number' };
    }

    const smsLog = {
      id: `sms-${uuidv4()}`,
      to: phoneNumber,
      message,
      orderId: options.orderId || null,
      provider: this.provider,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      if (this.provider === 'twilio') {
        const result = await this.twilioClient.messages.create({
          body: message,
          from: this.fromNumber,
          to: phoneNumber
        });

        smsLog.status = 'sent';
        smsLog.providerId = result.sid;
        smsLog.sentAt = new Date().toISOString();
        console.log(`SMS sent to ${phoneNumber}: ${message.substring(0, 50)}...`);
      } else {
        // Dev log mode
        smsLog.status = 'logged';
        smsLog.sentAt = new Date().toISOString();
        console.log(`[DEV_LOG] SMS would be sent to ${phoneNumber}: ${message}`);
      }

      this.logSMS(smsLog);
      return { success: true, smsId: smsLog.id };

    } catch (error) {
      smsLog.status = 'failed';
      smsLog.errorMessage = error.message;
      this.logSMS(smsLog);
      console.error('SMS send error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  normalizePhoneNumber(phone) {
    if (!phone) return null;

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Handle US numbers
    if (digits.length === 10) {
      digits = '1' + digits;
    }

    // Add + prefix
    if (digits.length >= 10 && digits.length <= 15) {
      return '+' + digits;
    }

    return null;
  }

  /**
   * Log SMS to database
   */
  logSMS(smsLog) {
    try {
      const db = loadDB();
      if (!db.smsLogs) db.smsLogs = [];
      db.smsLogs.push(smsLog);
      // Keep only last 500 logs
      if (db.smsLogs.length > 500) {
        db.smsLogs = db.smsLogs.slice(-500);
      }
      saveDB(db);
    } catch (err) {
      console.error('Failed to log SMS:', err.message);
    }
  }

  // ============================================
  // SMS TEMPLATES
  // ============================================

  /**
   * Send order confirmation SMS
   */
  async sendOrderConfirmation(order, phone) {
    const message = `Peekaboo Shades: Your order ${order.orderNumber || order.id} has been confirmed! Total: $${(order.total || 0).toFixed(2)}. Track: peekabooshades.com/order-lookup`;
    return this.send(phone, message, { orderId: order.id });
  }

  /**
   * Send shipping notification SMS
   */
  async sendShippingNotification(order, shipment, phone) {
    const message = `Peekaboo Shades: Your order ${order.orderNumber || order.id} has shipped! Tracking: ${shipment.trackingNumber || 'See email for details'}`;
    return this.send(phone, message, { orderId: order.id });
  }

  /**
   * Send delivery notification SMS
   */
  async sendDeliveryNotification(order, phone) {
    const message = `Peekaboo Shades: Your order ${order.orderNumber || order.id} has been delivered! Thank you for shopping with us.`;
    return this.send(phone, message, { orderId: order.id });
  }

  /**
   * Send appointment reminder SMS
   */
  async sendAppointmentReminder(appointment, phone) {
    const date = new Date(appointment.date).toLocaleDateString();
    const time = appointment.time || '';
    const message = `Peekaboo Shades: Reminder - Your appointment is scheduled for ${date} ${time}. Reply CONFIRM to confirm or call us to reschedule.`;
    return this.send(phone, message);
  }

  /**
   * Send quote ready SMS
   */
  async sendQuoteReady(quote, phone) {
    const message = `Peekaboo Shades: Your custom quote #${quote.id} is ready! Total: $${(quote.total || 0).toFixed(2)}. View: peekabooshades.com/quote/${quote.id}`;
    return this.send(phone, message);
  }

  /**
   * Get SMS service status
   */
  getStatus() {
    this.initialize();
    return {
      provider: this.provider,
      configured: this.provider === 'twilio',
      fromNumber: this.fromNumber ? this.fromNumber.replace(/\d(?=\d{4})/g, '*') : null
    };
  }
}

// Export singleton instance
const smsService = new SMSService();

module.exports = {
  smsService,
  SMSService
};
