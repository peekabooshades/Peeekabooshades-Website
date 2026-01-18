/**
 * Payment Routes - Stripe & PayPal Integration
 * Handles payment processing for checkout
 */

const express = require('express');
const router = express.Router();

// Stripe setup (lazy initialization)
let stripe = null;
function getStripe() {
  if (!stripe) {
    const Stripe = require('stripe');
    const config = getPaymentConfig();
    const stripeProvider = config.providers?.find(p => p.id === 'stripe');
    if (stripeProvider?.secretKey) {
      stripe = new Stripe(stripeProvider.secretKey);
    }
  }
  return stripe;
}

// PayPal setup (lazy initialization)
let paypalClient = null;
function getPayPalClient() {
  if (!paypalClient) {
    try {
      const paypal = require('@paypal/checkout-server-sdk');
      const config = getPaymentConfig();
      const paypalProvider = config.providers?.find(p => p.id === 'paypal');

      if (paypalProvider?.apiKey && paypalProvider?.secretKey) {
        const environment = paypalProvider.environment === 'production'
          ? new paypal.core.LiveEnvironment(paypalProvider.apiKey, paypalProvider.secretKey)
          : new paypal.core.SandboxEnvironment(paypalProvider.apiKey, paypalProvider.secretKey);
        paypalClient = new paypal.core.PayPalHttpClient(environment);
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
// STRIPE ROUTES
// ============================================

/**
 * Create Stripe Payment Intent
 * POST /api/payments/stripe/create-intent
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

    const { amount, currency = 'usd', metadata = {} } = req.body;

    if (!amount || amount < 50) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least $0.50'
      });
    }

    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: Math.round(amount), // Amount in cents
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...metadata,
        source: 'peekabooshades_checkout'
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

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
  const config = getPaymentConfig();
  const stripeProvider = config.providers?.find(p => p.id === 'stripe');

  if (!stripeProvider?.enabled || !stripeProvider?.apiKey) {
    return res.json({
      success: false,
      enabled: false,
      error: 'Stripe not configured'
    });
  }

  res.json({
    success: true,
    enabled: true,
    publishableKey: stripeProvider.apiKey // This should be the publishable key (pk_...)
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
  const config = getPaymentConfig();
  const paypalProvider = config.providers?.find(p => p.id === 'paypal');

  if (!paypalProvider?.enabled || !paypalProvider?.apiKey) {
    return res.json({
      success: false,
      enabled: false,
      error: 'PayPal not configured'
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

  // Always show demo card payment (no real processor needed)
  methods.push({
    id: 'demo_card',
    name: 'Credit/Debit Card',
    description: 'Pay with Visa, Mastercard, Amex',
    icon: 'credit-card',
    configured: true,
    isDemo: true
  });

  const stripeProvider = config.providers?.find(p => p.id === 'stripe');
  if (stripeProvider?.enabled && stripeProvider.apiKey && stripeProvider.secretKey) {
    methods.push({
      id: 'stripe',
      name: 'Credit Card (Stripe)',
      description: 'Secure payment via Stripe',
      icon: 'credit-card',
      configured: true
    });
  }

  const paypalProvider = config.providers?.find(p => p.id === 'paypal');
  if (paypalProvider?.enabled && paypalProvider.apiKey && paypalProvider.secretKey) {
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
    defaultCurrency: config.defaultCurrency || 'USD'
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

module.exports = router;
