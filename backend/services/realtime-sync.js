/**
 * PEEKABOO SHADES - REAL-TIME SYNC SERVICE
 * ==========================================
 *
 * WebSocket-based real-time synchronization between Admin and Frontend.
 * When content is updated in admin, all connected frontends receive instant updates.
 *
 * Events:
 * - content:update - CMS content changed
 * - product:update - Product data changed
 * - pricing:update - Pricing configuration changed
 * - theme:update - Theme settings changed
 * - inventory:update - Stock levels changed
 */

const WebSocket = require('ws');

class RealtimeSyncService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // clientId -> { ws, type, subscriptions }
    this.channels = new Map(); // channelName -> Set of clientIds
    this.heartbeatInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    if (this.isInitialized) return;

    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientType = this.getClientType(req);

      console.log(`[WS] Client connected: ${clientId} (${clientType})`);

      // Store client
      this.clients.set(clientId, {
        ws,
        type: clientType,
        subscriptions: new Set(),
        connectedAt: new Date().toISOString()
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('[WS] Invalid message:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        console.log(`[WS] Client disconnected: ${clientId}`);
        this.handleDisconnect(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WS] Client error ${clientId}:`, error.message);
      });
    });

    // Start heartbeat
    this.startHeartbeat();
    this.isInitialized = true;

    console.log('[WS] Real-time sync service initialized');
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine client type from request
   */
  getClientType(req) {
    const url = req.url || '';
    if (url.includes('admin')) return 'admin';
    return 'frontend';
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        this.subscribeToChannel(clientId, message.channel);
        break;

      case 'unsubscribe':
        this.unsubscribeFromChannel(clientId, message.channel);
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      case 'broadcast':
        // Only admin clients can broadcast
        if (client.type === 'admin') {
          this.broadcast(message.channel, message.data, clientId);
        }
        break;

      default:
        console.log(`[WS] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Subscribe client to channel
   */
  subscribeToChannel(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Add to client's subscriptions
    client.subscriptions.add(channel);

    // Add to channel's clients
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(clientId);

    console.log(`[WS] Client ${clientId} subscribed to ${channel}`);

    this.sendToClient(clientId, {
      type: 'subscribed',
      channel,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unsubscribe client from channel
   */
  unsubscribeFromChannel(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);

    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      if (channelClients.size === 0) {
        this.channels.delete(channel);
      }
    }

    console.log(`[WS] Client ${clientId} unsubscribed from ${channel}`);
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all channels
    for (const channel of client.subscriptions) {
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        channelClients.delete(clientId);
        if (channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error(`[WS] Error sending to ${clientId}:`, error.message);
    }
  }

  /**
   * Broadcast to all clients in a channel
   */
  broadcast(channel, data, excludeClientId = null) {
    const channelClients = this.channels.get(channel);
    if (!channelClients) return;

    const message = {
      type: 'update',
      channel,
      data,
      timestamp: new Date().toISOString()
    };

    for (const clientId of channelClients) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }

    console.log(`[WS] Broadcast to ${channel}: ${channelClients.size} clients`);
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastAll(eventType, data) {
    const message = {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    };

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
      }
    }

    console.log(`[WS] Broadcast all (${eventType}): ${this.clients.size} clients`);
  }

  /**
   * Notify about content update
   */
  notifyContentUpdate(contentType, contentId, data) {
    this.broadcast('content', {
      contentType,
      contentId,
      ...data
    });

    // Also broadcast to specific content type channel
    this.broadcast(`content:${contentType}`, {
      contentId,
      ...data
    });
  }

  /**
   * Notify about product update
   */
  notifyProductUpdate(productId, data) {
    this.broadcast('products', {
      productId,
      ...data
    });

    // Broadcast to specific product channel
    this.broadcast(`product:${productId}`, data);
  }

  /**
   * Notify about pricing update
   */
  notifyPricingUpdate(data) {
    this.broadcast('pricing', data);
  }

  /**
   * Notify about theme update
   */
  notifyThemeUpdate(data) {
    this.broadcast('theme', data);
  }

  /**
   * Notify about inventory update
   */
  notifyInventoryUpdate(productId, data) {
    this.broadcast('inventory', {
      productId,
      ...data
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(clientId, { type: 'heartbeat', timestamp: new Date().toISOString() });
        } else {
          this.handleDisconnect(clientId);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection stats
   */
  getStats() {
    const stats = {
      totalClients: this.clients.size,
      adminClients: 0,
      frontendClients: 0,
      channels: {},
      uptime: process.uptime()
    };

    for (const [, client] of this.clients) {
      if (client.type === 'admin') {
        stats.adminClients++;
      } else {
        stats.frontendClients++;
      }
    }

    for (const [channel, clients] of this.channels) {
      stats.channels[channel] = clients.size;
    }

    return stats;
  }

  /**
   * Shutdown service
   */
  shutdown() {
    this.stopHeartbeat();

    // Close all connections
    for (const [clientId, client] of this.clients) {
      try {
        client.ws.close(1000, 'Server shutting down');
      } catch (error) {
        // Ignore close errors
      }
    }

    this.clients.clear();
    this.channels.clear();

    if (this.wss) {
      this.wss.close();
    }

    console.log('[WS] Real-time sync service shutdown');
  }
}

// Singleton instance
const realtimeSync = new RealtimeSyncService();

module.exports = {
  realtimeSync
};
