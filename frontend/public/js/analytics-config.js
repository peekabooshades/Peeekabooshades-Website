/**
 * PEEKABOO SHADES - ANALYTICS CONFIGURATION
 * ==========================================
 * Central configuration for Google Analytics (GA4) and Facebook Pixel
 *
 * SETUP INSTRUCTIONS:
 * 1. Replace 'G-XXXXXXXXXX' with your actual GA4 Measurement ID
 * 2. Replace 'FACEBOOK_PIXEL_ID' with your actual Facebook Pixel ID
 * 3. The scripts will automatically initialize if IDs are configured
 */

(function() {
  // ============================================
  // CONFIGURATION - UPDATE THESE VALUES
  // ============================================

  const ANALYTICS_CONFIG = {
    // Google Analytics 4
    ga4: {
      measurementId: 'G-XXXXXXXXXX', // Replace with your GA4 Measurement ID
      enabled: true
    },
    // Facebook Pixel
    facebook: {
      pixelId: 'FACEBOOK_PIXEL_ID', // Replace with your Facebook Pixel ID from env
      enabled: true // Enable when pixelId is configured
    }
  };

  // ============================================
  // GOOGLE ANALYTICS 4 INITIALIZATION
  // ============================================

  function initGA4() {
    const { measurementId, enabled } = ANALYTICS_CONFIG.ga4;

    if (!enabled || !measurementId || measurementId === 'G-XXXXXXXXXX') {
      console.log('GA4 not configured. Add your Measurement ID to analytics-config.js');
      return;
    }

    // Load gtag.js
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', measurementId);

    console.log('GA4 initialized:', measurementId);
  }

  // ============================================
  // FACEBOOK PIXEL INITIALIZATION
  // ============================================

  function initFacebookPixel() {
    const { pixelId, enabled } = ANALYTICS_CONFIG.facebook;

    if (!enabled || !pixelId) {
      return;
    }

    // Facebook Pixel base code
    !function(f,b,e,v,n,t,s) {
      if(f.fbq)return;
      n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];
      t=b.createElement(e);t.async=!0;
      t.src=v;
      s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', pixelId);
    fbq('track', 'PageView');

    console.log('Facebook Pixel initialized:', pixelId);
  }

  // ============================================
  // E-COMMERCE TRACKING HELPERS
  // ============================================

  window.PeekabooAnalytics = {
    // Track product view
    viewProduct: function(product) {
      if (window.gtag && ANALYTICS_CONFIG.ga4.measurementId !== 'G-XXXXXXXXXX') {
        gtag('event', 'view_item', {
          currency: 'USD',
          value: product.price || 0,
          items: [{
            item_id: product.id,
            item_name: product.name,
            item_category: product.category || 'Blinds',
            price: product.price || 0
          }]
        });
      }
      if (window.fbq) {
        fbq('track', 'ViewContent', {
          content_name: product.name,
          content_ids: [product.id],
          content_type: 'product',
          value: product.price || 0,
          currency: 'USD'
        });
      }
    },

    // Track add to cart
    addToCart: function(product, quantity) {
      if (window.gtag && ANALYTICS_CONFIG.ga4.measurementId !== 'G-XXXXXXXXXX') {
        gtag('event', 'add_to_cart', {
          currency: 'USD',
          value: (product.price || 0) * (quantity || 1),
          items: [{
            item_id: product.id,
            item_name: product.name,
            item_category: product.category || 'Blinds',
            price: product.price || 0,
            quantity: quantity || 1
          }]
        });
      }
      if (window.fbq) {
        fbq('track', 'AddToCart', {
          content_name: product.name,
          content_ids: [product.id],
          content_type: 'product',
          value: (product.price || 0) * (quantity || 1),
          currency: 'USD'
        });
      }
    },

    // Track checkout start
    beginCheckout: function(cart) {
      const value = cart.total || cart.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;

      if (window.gtag && ANALYTICS_CONFIG.ga4.measurementId !== 'G-XXXXXXXXXX') {
        gtag('event', 'begin_checkout', {
          currency: 'USD',
          value: value,
          items: (cart.items || []).map(item => ({
            item_id: item.id,
            item_name: item.name,
            price: item.price,
            quantity: item.quantity
          }))
        });
      }
      if (window.fbq) {
        fbq('track', 'InitiateCheckout', {
          value: value,
          currency: 'USD',
          num_items: cart.items?.length || 0
        });
      }
    },

    // Track purchase
    purchase: function(order) {
      if (window.gtag && ANALYTICS_CONFIG.ga4.measurementId !== 'G-XXXXXXXXXX') {
        gtag('event', 'purchase', {
          transaction_id: order.id || order.orderNumber,
          value: order.total || 0,
          tax: order.tax || 0,
          shipping: order.shipping || 0,
          currency: 'USD',
          items: (order.items || []).map(item => ({
            item_id: item.id,
            item_name: item.name,
            price: item.price,
            quantity: item.quantity
          }))
        });
      }
      if (window.fbq) {
        fbq('track', 'Purchase', {
          value: order.total || 0,
          currency: 'USD',
          content_ids: (order.items || []).map(item => item.id),
          content_type: 'product',
          num_items: order.items?.length || 0
        });
      }
    },

    // Track custom event
    trackEvent: function(eventName, params) {
      if (window.gtag && ANALYTICS_CONFIG.ga4.measurementId !== 'G-XXXXXXXXXX') {
        gtag('event', eventName, params);
      }
    }
  };

  // ============================================
  // INITIALIZE ON DOM READY
  // ============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initGA4();
      initFacebookPixel();
    });
  } else {
    initGA4();
    initFacebookPixel();
  }

})();
