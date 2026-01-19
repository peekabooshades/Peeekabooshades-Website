/**
 * PEEKABOO SHADES - SHIPPING SERVICE
 * ====================================
 * Handles carrier tracking API integrations
 * Supports UPS, FedEx, USPS tracking
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * Carrier configurations
 */
const CARRIERS = {
  ups: {
    name: 'UPS',
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={trackingNumber}',
    pattern: /^1Z[A-Z0-9]{16}$/i,
    logo: '/images/carriers/ups.png'
  },
  fedex: {
    name: 'FedEx',
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
    pattern: /^[0-9]{12,22}$/,
    logo: '/images/carriers/fedex.png'
  },
  usps: {
    name: 'USPS',
    trackingUrlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}',
    pattern: /^(94|93|92|94|95)[0-9]{20,22}$/,
    logo: '/images/carriers/usps.png'
  },
  dhl: {
    name: 'DHL',
    trackingUrlTemplate: 'https://www.dhl.com/us-en/home/tracking.html?tracking-id={trackingNumber}',
    pattern: /^[0-9]{10,11}$/,
    logo: '/images/carriers/dhl.png'
  }
};

/**
 * Shipping Service Class
 */
class ShippingService {
  constructor() {
    this.carriers = CARRIERS;
  }

  /**
   * Detect carrier from tracking number
   */
  detectCarrier(trackingNumber) {
    if (!trackingNumber) return null;
    const clean = trackingNumber.replace(/\s/g, '').toUpperCase();

    for (const [carrierId, config] of Object.entries(this.carriers)) {
      if (config.pattern.test(clean)) {
        return carrierId;
      }
    }

    // Default heuristics
    if (clean.startsWith('1Z')) return 'ups';
    if (clean.length === 12 || clean.length === 15) return 'fedex';
    if (clean.length >= 20 && clean.length <= 22) return 'usps';

    return null;
  }

  /**
   * Get tracking URL for a shipment
   */
  getTrackingUrl(trackingNumber, carrier = null) {
    const detectedCarrier = carrier || this.detectCarrier(trackingNumber);
    if (!detectedCarrier || !this.carriers[detectedCarrier]) {
      return null;
    }

    return this.carriers[detectedCarrier].trackingUrlTemplate
      .replace('{trackingNumber}', trackingNumber);
  }

  /**
   * Create a new shipment record
   */
  createShipment(data) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.shipments) db.shipments = [];

    const carrier = data.carrier || this.detectCarrier(data.trackingNumber);
    const trackingUrl = this.getTrackingUrl(data.trackingNumber, carrier);

    const shipment = {
      id: `ship-${uuidv4()}`,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      carrier: carrier,
      carrierName: this.carriers[carrier]?.name || data.carrierName || 'Unknown',
      trackingNumber: data.trackingNumber,
      trackingUrl: trackingUrl,
      status: data.status || 'pending',
      estimatedDelivery: data.estimatedDelivery || null,
      actualDelivery: null,
      shippingCost: data.shippingCost || 0,
      weight: data.weight || null,
      dimensions: data.dimensions || null,
      fromAddress: data.fromAddress || null,
      toAddress: data.toAddress || null,
      items: data.items || [],
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.shipments.push(shipment);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

    return shipment;
  }

  /**
   * Update shipment status
   */
  updateShipment(shipmentId, updates) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.shipments) db.shipments = [];

    const index = db.shipments.findIndex(s => s.id === shipmentId);
    if (index === -1) {
      return null;
    }

    // If tracking number changed, update carrier and URL
    if (updates.trackingNumber && updates.trackingNumber !== db.shipments[index].trackingNumber) {
      const carrier = updates.carrier || this.detectCarrier(updates.trackingNumber);
      updates.carrier = carrier;
      updates.carrierName = this.carriers[carrier]?.name || 'Unknown';
      updates.trackingUrl = this.getTrackingUrl(updates.trackingNumber, carrier);
    }

    db.shipments[index] = {
      ...db.shipments[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // If status is delivered, set actualDelivery
    if (updates.status === 'delivered' && !db.shipments[index].actualDelivery) {
      db.shipments[index].actualDelivery = new Date().toISOString();
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return db.shipments[index];
  }

  /**
   * Get shipment by ID
   */
  getShipment(shipmentId) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return (db.shipments || []).find(s => s.id === shipmentId);
  }

  /**
   * Get shipments for an order
   */
  getOrderShipments(orderId) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return (db.shipments || []).filter(s => s.orderId === orderId);
  }

  /**
   * Add tracking event
   */
  addTrackingEvent(shipmentId, event) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!db.trackingEvents) db.trackingEvents = [];

    const trackingEvent = {
      id: `te-${uuidv4()}`,
      shipmentId,
      status: event.status,
      statusDescription: event.description || event.statusDescription,
      location: event.location || null,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source || 'manual',
      createdAt: new Date().toISOString()
    };

    db.trackingEvents.push(trackingEvent);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

    // Update shipment status
    this.updateShipment(shipmentId, { status: event.status });

    return trackingEvent;
  }

  /**
   * Get tracking events for a shipment
   */
  getTrackingEvents(shipmentId) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return (db.trackingEvents || [])
      .filter(e => e.shipmentId === shipmentId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Simulate tracking update (for demo/testing)
   */
  simulateTrackingUpdate(shipmentId) {
    const shipment = this.getShipment(shipmentId);
    if (!shipment) return null;

    const statusFlow = [
      { status: 'label_created', description: 'Shipping label created' },
      { status: 'picked_up', description: 'Package picked up by carrier' },
      { status: 'in_transit', description: 'Package in transit' },
      { status: 'out_for_delivery', description: 'Package out for delivery' },
      { status: 'delivered', description: 'Package delivered' }
    ];

    const currentIndex = statusFlow.findIndex(s => s.status === shipment.status);
    const nextIndex = currentIndex + 1;

    if (nextIndex < statusFlow.length) {
      const nextStatus = statusFlow[nextIndex];
      return this.addTrackingEvent(shipmentId, {
        status: nextStatus.status,
        description: nextStatus.description,
        source: 'simulation'
      });
    }

    return null;
  }

  /**
   * Get all carriers
   */
  getCarriers() {
    return Object.entries(this.carriers).map(([id, config]) => ({
      id,
      name: config.name,
      logo: config.logo
    }));
  }

  /**
   * Calculate shipping cost estimate
   */
  estimateShippingCost(weight, dimensions, destination) {
    // Simple weight-based calculation
    // In production, this would call carrier APIs
    const baseRate = 9.99;
    const perPoundRate = 0.50;
    const weightCost = (weight || 0) * perPoundRate;

    // Add dimensional weight surcharge for large items
    let dimSurcharge = 0;
    if (dimensions) {
      const dimWeight = (dimensions.length * dimensions.width * dimensions.height) / 139;
      if (dimWeight > (weight || 0)) {
        dimSurcharge = (dimWeight - (weight || 0)) * perPoundRate;
      }
    }

    return {
      baseRate,
      weightCost,
      dimSurcharge,
      total: baseRate + weightCost + dimSurcharge,
      estimatedDays: 5
    };
  }

  /**
   * Get shipping service status
   */
  getStatus() {
    return {
      carriers: this.getCarriers(),
      totalShipments: this.getTotalShipments(),
      pendingShipments: this.getPendingShipments()
    };
  }

  getTotalShipments() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return (db.shipments || []).length;
  }

  getPendingShipments() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return (db.shipments || []).filter(s =>
      !['delivered', 'cancelled'].includes(s.status)
    ).length;
  }
}

// Export singleton instance
const shippingService = new ShippingService();

module.exports = {
  shippingService,
  ShippingService,
  CARRIERS
};
