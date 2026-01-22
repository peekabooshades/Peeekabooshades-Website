/**
 * Payment Routes - Stripe & PayPal Integration
 * Handles payment processing for checkout
 */

const express = require('express');
const router = express.Router();

// Stripe setup (lazy initialization)
// Priority: Environment variables > Database config
let stripe = null;
function getStripe() {
  if (!stripe) {
    const Stripe = require('stripe');
    // First check environment variables
    const envSecretKey = process.env.STRIPE_SECRET_KEY;
    if (envSecretKey && envSecretKey.startsWith('sk_')) {
      stripe = new Stripe(envSecretKey);
      console.log('Stripe initialized from environment variables');
    } else {
      // Fallback to database config
      const config = getPaymentConfig();
      const stripeProvider = config.providers?.find(p => p.id === 'stripe');
      if (stripeProvider?.secretKey && stripeProvider.secretKey.startsWith('sk_')) {
        stripe = new Stripe(stripeProvider.secretKey);
        console.log('Stripe initialized from database config');
      }
    }
  }
  return stripe;
}

// PayPal setup (lazy initialization)
// Priority: Environment variables > Database config
let paypalClient = null;
function getPayPalClient() {
  if (!paypalClient) {
    try {
      const paypal = require('@paypal/checkout-server-sdk');

      // First check environment variables
      const envClientId = process.env.PAYPAL_CLIENT_ID;
      const envClientSecret = process.env.PAYPAL_CLIENT_SECRET;
      const envMode = process.env.PAYPAL_MODE || 'sandbox';

      if (envClientId && envClientSecret) {
        const environment = envMode === 'production'
          ? new paypal.core.LiveEnvironment(envClientId, envClientSecret)
          : new paypal.core.SandboxEnvironment(envClientId, envClientSecret);
        paypalClient = new paypal.core.PayPalHttpClient(environment);
        console.log('PayPal initialized from environment variables');
      } else {
        // Fallback to database config
        const config = getPaymentConfig();
        const paypalProvider = config.providers?.find(p => p.id === 'paypal');

        if (paypalProvider?.apiKey && paypalProvider?.secretKey) {
          const environment = paypalProvider.environment === 'production'
            ? new paypal.core.LiveEnvironment(paypalProvider.apiKey, paypalProvider.secretKey)
            : new paypal.core.SandboxEnvironment(paypalProvider.apiKey, paypalProvider.secretKey);
          paypalClient = new paypal.core.PayPalHttpClient(environment);
          console.log('PayPal initialized from database config');
        }
      }
    } catch (err) {
      console.error('PayPal SDK not available:', err.message);
    }
  }
  return paypalClient;
}

// Get payment config from database
function getPaymentConfig() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../database.json');

    if (fs.existsSync(dbPath)) {
      const dbData = fs.readFileSync(dbPath, 'utf8');
      const db = JSON.parse(dbData);
      return db.systemConfig?.payment || {};
    }
  } catch (err) {
    console.error('Error loading payment config:', err);
  }
  return {};
}

// ============================================
// IDEMPOTENCY KEY MANAGEMENT
// ============================================
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate idempotency key for an order
 */
function generateIdempotencyKey(orderId, action) {
  return `${orderId}_${action}_${Date.now()}`;
}

/**
 * Check if request is duplicate using idempotency key
 */
function checkIdempotency(key) {
  const cached = idempotencyCache.get(key);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
    return cached.response;
  }
  return null;
}

/**
 * Store idempotency response
 */
function storeIdempotency(key, response) {
  idempotencyCache.set(key, {
    response,
    timestamp: Date.now()
  });
  // Clean old entries periodically
  if (idempotencyCache.size > 1000) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL;
    for (const [k, v] of idempotencyCache.entries()) {
      if (v.timestamp < cutoff) idempotencyCache.delete(k);
    }
  }
}

// ============================================
// STRIPE ROUTES
// ============================================

/**
 * Create Stripe Payment Intent
 * POST /api/payments/stripe/create-intent
 * Supports idempotency to prevent duplicate charges
 */
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      return res.status(400).json({
        success: false,
        error: 'Stripe is not configured. Please add API keys in Admin > Settings > Payments.'
      });
    }

    const { amount, currency = 'usd', metadata = {}, orderId, idempotencyKey } = req.body;

    // Check for duplicate request using idempotency key
    const idemKey = idempotencyKey || (orderId ? `stripe_intent_${orderId}` : null);
    if (idemKey) {
      const cached = checkIdempotency(idemKey);
      if (cached) {
        console.log('Returning cached payment intent for idempotency key:', idemKey);
        return res.json(cached);
      }
    }

    if (!amount || amount < 50) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least $0.50'
      });
    }

    // Create payment intent with Stripe's built-in idempotency
    const createOptions = {
      amount: Math.round(amount), // Amount in cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        orderId: orderId || '',
        source: 'peekabooshades_checkout'
      }
    };

    // Use Stripe's idempotency key if provided
    const stripeOptions = idemKey ? { idempotencyKey: idemKey } : {};
    const paymentIntent = await stripeInstance.paymentIntents.create(createOptions, stripeOptions);

    const response = {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };

    // Cache response for idempotency
    if (idemKey) {
      storeIdempotency(idemKey, response);
    }

    res.json(response);

  } catch (error) {
    console.error('Stripe create intent error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Confirm Stripe Payment
 * POST /api/payments/stripe/confirm
 */
router.post('/stripe/confirm', async (req, res) => {
  try {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const { paymentIntentId } = req.body;

    const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);

    res.json({
      success: true,
      status: paymentIntent.status,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
        created: paymentIntent.created
      }
    });

  } catch (error) {
    console.error('Stripe confirm error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get Stripe publishable key
 * GET /api/payments/stripe/config
 */
router.get('/stripe/config', (req, res) => {
  // First check environment variables
  const envPublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envPublishableKey && envPublishableKey.startsWith('pk_')) {
    return res.json({
      success: true,
      enabled: true,
      publishableKey: envPublishableKey
    });
  }

  // Fallback to database config
  const config = getPaymentConfig();
  const stripeProvider = config.providers?.find(p => p.id === 'stripe');

  if (!stripeProvider?.enabled || !stripeProvider?.apiKey) {
    return res.json({
      success: false,
      enabled: false,
      error: 'Stripe not configured. Add STRIPE_PUBLISHABLE_KEY to .env file.'
    });
  }

  res.json({
    success: true,
    enabled: true,
    publishableKey: stripeProvider.apiKey
  });
});

// ============================================
// PAYPAL ROUTES
// ============================================

/**
 * Create PayPal Order
 * POST /api/payments/paypal/create-order
 */
router.post('/paypal/create-order', async (req, res) => {
  try {
    const paypal = require('@paypal/checkout-server-sdk');
    const client = getPayPalClient();

    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'PayPal is not configured. Please add API keys in Admin > Settings > Payments.'
      });
    }

    const { amount, currency = 'USD', description = 'Peekaboo Shades Order' } = req.body;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency.toUpperCase(),
          value: (amount / 100).toFixed(2) // Convert cents to dollars
        },
        description
      }]
    });

    const order = await client.execute(request);

    res.json({
      success: true,
      orderId: order.result.id,
      status: order.result.status
    });

  } catch (error) {
    console.error('PayPal create order error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Capture PayPal Order
 * POST /api/payments/paypal/capture-order
 */
router.post('/paypal/capture-order', async (req, res) => {
  try {
    const paypal = require('@paypal/checkout-server-sdk');
    const client = getPayPalClient();

    if (!client) {
      return res.status(400).json({ success: false, error: 'PayPal not configured' });
    }

    const { orderId } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client.execute(request);

    res.json({
      success: true,
      status: capture.result.status,
      captureId: capture.result.purchase_units[0]?.payments?.captures[0]?.id,
      paypalOrder: {
        id: capture.result.id,
        status: capture.result.status,
        payer: capture.result.payer
      }
    });

  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get PayPal client ID
 * GET /api/payments/paypal/config
 */
router.get('/paypal/config', (req, res) => {
  // First check environment variables
  const envClientId = process.env.PAYPAL_CLIENT_ID;
  const envMode = process.env.PAYPAL_MODE || 'sandbox';

  if (envClientId) {
    return res.json({
      success: true,
      enabled: true,
      clientId: envClientId,
      environment: envMode
    });
  }

  // Fallback to database config
  const config = getPaymentConfig();
  const paypalProvider = config.providers?.find(p => p.id === 'paypal');

  if (!paypalProvider?.enabled || !paypalProvider?.apiKey) {
    return res.json({
      success: false,
      enabled: false,
      error: 'PayPal not configured. Add PAYPAL_CLIENT_ID to .env file.'
    });
  }

  res.json({
    success: true,
    enabled: true,
    clientId: paypalProvider.apiKey,
    environment: paypalProvider.environment || 'sandbox'
  });
});

// ============================================
// GENERAL PAYMENT ROUTES
// ============================================

/**
 * Get available payment methods
 * GET /api/payments/methods
 */
router.get('/methods', (req, res) => {
  const config = getPaymentConfig();
  const methods = [];

  // Check if Stripe is configured (either via env or database)
  const envStripeKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const stripeProvider = config.providers?.find(p => p.id === 'stripe');
  const stripeConfigured = (envStripeKey && envStripeKey.startsWith('pk_')) ||
    (stripeProvider?.enabled && stripeProvider.apiKey && stripeProvider.secretKey);

  // Always show demo card payment (no real processor needed)
  methods.push({
    id: 'demo_card',
    name: 'Credit/Debit Card',
    description: 'Pay with Visa, Mastercard, Amex',
    icon: 'credit-card',
    configured: true,
    isDemo: true
  });

  if (stripeConfigured) {
    methods.push({
      id: 'stripe',
      name: 'Credit Card (Stripe)',
      description: 'Secure payment via Stripe',
      icon: 'credit-card',
      configured: true
    });

    // Apple Pay (requires Stripe + Safari/iOS)
    methods.push({
      id: 'apple_pay',
      name: 'Apple Pay',
      description: 'Pay with Apple Pay',
      icon: 'apple',
      configured: true,
      requiresStripe: true,
      browserCheck: 'safari'
    });

    // Google Pay (requires Stripe + Chrome/Android)
    methods.push({
      id: 'google_pay',
      name: 'Google Pay',
      description: 'Pay with Google Pay',
      icon: 'google',
      configured: true,
      requiresStripe: true,
      browserCheck: 'chrome'
    });
  }

  // Check PayPal
  const envPayPalId = process.env.PAYPAL_CLIENT_ID;
  const paypalProvider = config.providers?.find(p => p.id === 'paypal');
  const paypalConfigured = envPayPalId ||
    (paypalProvider?.enabled && paypalProvider.apiKey && paypalProvider.secretKey);

  if (paypalConfigured) {
    methods.push({
      id: 'paypal',
      name: 'PayPal',
      description: 'Pay with your PayPal account',
      icon: 'paypal',
      configured: true
    });
  }

  // Always show manual/invoice option
  methods.push({
    id: 'invoice',
    name: 'Pay by Invoice',
    description: 'Request invoice for payment',
    icon: 'file-invoice',
    configured: true
  });

  res.json({
    success: true,
    methods,
    defaultCurrency: config.defaultCurrency || 'USD',
    stripeConfigured,
    paypalConfigured
  });
});

/**
 * Process demo card payment (no real processor)
 * POST /api/payments/demo/process
 */
router.post('/demo/process', (req, res) => {
  const { cardNumber, expiry, cvc, amount, cardholderName } = req.body;

  // Basic validation
  if (!cardNumber || !expiry || !cvc) {
    return res.status(400).json({
      success: false,
      error: 'Please fill in all card details'
    });
  }

  // Clean card number
  const cleanCard = cardNumber.replace(/\s/g, '');

  // Validate card number length
  if (cleanCard.length < 13 || cleanCard.length > 19) {
    return res.status(400).json({
      success: false,
      error: 'Invalid card number'
    });
  }

  // Simulate declined cards for testing
  if (cleanCard === '4000000000000002') {
    return res.status(400).json({
      success: false,
      error: 'Card declined. Please try another card.'
    });
  }

  // Simulate processing delay
  setTimeout(() => {
    // Generate fake transaction ID
    const transactionId = 'DEMO_' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();

    res.json({
      success: true,
      transactionId,
      status: 'completed',
      message: 'Payment processed successfully (Demo Mode)',
      isDemo: true
    });
  }, 1000);
});

// ============================================
// STRIPE WEBHOOK HANDLER
// ============================================

/**
 * Stripe Webhook Handler
 * POST /api/payments/stripe/webhook
 * Handles payment events from Stripe
 */
router.post('/stripe/webhook', require('express').raw({ type: 'application/json' }), async (req, res) => {
  const stripeInstance = getStripe();
  if (!stripeInstance) {
    return res.status(400).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For testing without webhook secret
      event = JSON.parse(req.body.toString());
      console.warn('Webhook signature verification skipped - no secret configured');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../database.json');

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);

        // Update order status if orderId in metadata
        if (paymentIntent.metadata?.orderId) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const orderIndex = db.orders?.findIndex(o => o.id === paymentIntent.metadata.orderId);
          if (orderIndex > -1) {
            db.orders[orderIndex].paymentStatus = 'paid';
            db.orders[orderIndex].stripePaymentIntentId = paymentIntent.id;
            db.orders[orderIndex].paidAt = new Date().toISOString();
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          }
        }

        // Log webhook event
        logWebhookEvent('stripe', 'payment_intent.succeeded', paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);

        if (paymentIntent.metadata?.orderId) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const orderIndex = db.orders?.findIndex(o => o.id === paymentIntent.metadata.orderId);
          if (orderIndex > -1) {
            db.orders[orderIndex].paymentStatus = 'failed';
            db.orders[orderIndex].paymentError = paymentIntent.last_payment_error?.message;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          }
        }

        logWebhookEvent('stripe', 'payment_intent.payment_failed', paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log('Charge refunded:', charge.id);

        // Find and update order
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const orderIndex = db.orders?.findIndex(o => o.stripePaymentIntentId === charge.payment_intent);
        if (orderIndex > -1) {
          const refundAmount = charge.amount_refunded / 100;
          db.orders[orderIndex].refundedAmount = (db.orders[orderIndex].refundedAmount || 0) + refundAmount;
          db.orders[orderIndex].paymentStatus = charge.refunded ? 'refunded' : 'partially_refunded';
          db.orders[orderIndex].refundedAt = new Date().toISOString();
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        }

        logWebhookEvent('stripe', 'charge.refunded', charge);
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object;
        console.log('Dispute created:', dispute.id);
        logWebhookEvent('stripe', 'charge.dispute.created', dispute);
        // Alert admin
        try {
          const { notificationService } = require('../services/notification-service');
          notificationService.sendSlack({
            text: `⚠️ CHARGEBACK ALERT: Dispute created for charge ${dispute.charge}. Amount: $${dispute.amount / 100}. Reason: ${dispute.reason}`
          });
        } catch (e) { /* ignore if service not available */ }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// PAYPAL WEBHOOK HANDLER
// ============================================

/**
 * PayPal Webhook Handler
 * POST /api/payments/paypal/webhook
 */
router.post('/paypal/webhook', async (req, res) => {
  try {
    const event = req.body;
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../database.json');

    console.log('PayPal webhook event:', event.event_type);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = event.resource;
        console.log('PayPal payment completed:', capture.id);

        // Update order if custom_id contains orderId
        if (capture.custom_id) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const orderIndex = db.orders?.findIndex(o => o.id === capture.custom_id);
          if (orderIndex > -1) {
            db.orders[orderIndex].paymentStatus = 'paid';
            db.orders[orderIndex].paypalCaptureId = capture.id;
            db.orders[orderIndex].paidAt = new Date().toISOString();
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          }
        }

        logWebhookEvent('paypal', 'PAYMENT.CAPTURE.COMPLETED', capture);
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const capture = event.resource;
        console.log('PayPal payment failed:', capture.id);

        if (capture.custom_id) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          const orderIndex = db.orders?.findIndex(o => o.id === capture.custom_id);
          if (orderIndex > -1) {
            db.orders[orderIndex].paymentStatus = 'failed';
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          }
        }

        logWebhookEvent('paypal', event.event_type, capture);
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const refund = event.resource;
        console.log('PayPal refund:', refund.id);
        logWebhookEvent('paypal', 'PAYMENT.CAPTURE.REFUNDED', refund);
        break;
      }

      default:
        console.log(`Unhandled PayPal event: ${event.event_type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// REFUND PROCESSING
// ============================================

/**
 * Process refund via Stripe
 * POST /api/payments/stripe/refund
 */
router.post('/stripe/refund', async (req, res) => {
  try {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      return res.status(400).json({ success: false, error: 'Stripe not configured' });
    }

    const { paymentIntentId, amount, reason, orderId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, error: 'Payment intent ID required' });
    }

    const refundParams = {
      payment_intent: paymentIntentId,
      reason: reason || 'requested_by_customer'
    };

    // If amount specified, do partial refund (amount in cents)
    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }

    const refund = await stripeInstance.refunds.create(refundParams);

    // Update order record
    if (orderId) {
      const fs = require('fs');
      const path = require('path');
      const dbPath = path.join(__dirname, '../database.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

      const orderIndex = db.orders?.findIndex(o => o.id === orderId);
      if (orderIndex > -1) {
        const refundAmount = refund.amount / 100;
        db.orders[orderIndex].refundedAmount = (db.orders[orderIndex].refundedAmount || 0) + refundAmount;
        db.orders[orderIndex].paymentStatus = refund.amount === db.orders[orderIndex].total * 100 ? 'refunded' : 'partially_refunded';
        db.orders[orderIndex].refundedAt = new Date().toISOString();

        // Add to refunds collection
        if (!db.refunds) db.refunds = [];
        db.refunds.push({
          id: `ref-${Date.now()}`,
          orderId,
          stripeRefundId: refund.id,
          amount: refundAmount,
          reason,
          status: refund.status,
          createdAt: new Date().toISOString()
        });

        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      }
    }

    res.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason
      }
    });

  } catch (error) {
    console.error('Stripe refund error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Process refund via PayPal
 * POST /api/payments/paypal/refund
 */
router.post('/paypal/refund', async (req, res) => {
  try {
    const paypal = require('@paypal/checkout-server-sdk');
    const client = getPayPalClient();

    if (!client) {
      return res.status(400).json({ success: false, error: 'PayPal not configured' });
    }

    const { captureId, amount, currency = 'USD', orderId } = req.body;

    if (!captureId) {
      return res.status(400).json({ success: false, error: 'Capture ID required' });
    }

    const request = new paypal.payments.CapturesRefundRequest(captureId);
    request.requestBody({
      amount: amount ? {
        value: amount.toFixed(2),
        currency_code: currency
      } : undefined
    });

    const refund = await client.execute(request);

    // Update order record
    if (orderId) {
      const fs = require('fs');
      const path = require('path');
      const dbPath = path.join(__dirname, '../database.json');
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

      const orderIndex = db.orders?.findIndex(o => o.id === orderId);
      if (orderIndex > -1) {
        const refundAmount = amount || db.orders[orderIndex].total;
        db.orders[orderIndex].refundedAmount = (db.orders[orderIndex].refundedAmount || 0) + refundAmount;
        db.orders[orderIndex].paymentStatus = 'refunded';
        db.orders[orderIndex].refundedAt = new Date().toISOString();
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      }
    }

    res.json({
      success: true,
      refund: {
        id: refund.result.id,
        status: refund.result.status
      }
    });

  } catch (error) {
    console.error('PayPal refund error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Log webhook event to database
 */
function logWebhookEvent(provider, eventType, data) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.join(__dirname, '../database.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    if (!db.webhookLogs) db.webhookLogs = [];

    db.webhookLogs.push({
      id: `wh-${Date.now()}`,
      provider,
      eventType,
      data: JSON.stringify(data).substring(0, 5000), // Limit size
      receivedAt: new Date().toISOString()
    });

    // Keep last 1000 logs
    if (db.webhookLogs.length > 1000) {
      db.webhookLogs = db.webhookLogs.slice(-1000);
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed to log webhook event:', err);
  }
}

module.exports = router;
