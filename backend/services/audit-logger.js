/**
 * PEEKABOO SHADES - AUDIT LOGGING SERVICE
 * ========================================
 *
 * Tracks ALL changes made to the system:
 * - Who made the change
 * - What was changed (before/after state)
 * - When it happened
 * - Why (action context)
 *
 * CRITICAL for:
 * - Security compliance
 * - Debugging
 * - Rollback capability
 * - Accountability
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../database.json');

/**
 * Audit Action Types
 */
const AUDIT_ACTIONS = {
  // Product actions
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_ACTIVATE: 'product.activate',
  PRODUCT_DEACTIVATE: 'product.deactivate',

  // Pricing actions
  PRICE_UPDATE: 'price.update',
  DISCOUNT_CREATE: 'discount.create',
  DISCOUNT_UPDATE: 'discount.update',
  DISCOUNT_DELETE: 'discount.delete',

  // Order actions
  ORDER_CREATE: 'order.create',
  ORDER_UPDATE: 'order.update',
  ORDER_STATUS_CHANGE: 'order.status_change',
  ORDER_CANCEL: 'order.cancel',
  ORDER_REFUND: 'order.refund',

  // Customer actions
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',

  // Content actions
  CONTENT_UPDATE: 'content.update',
  PAGE_CREATE: 'page.create',
  PAGE_UPDATE: 'page.update',
  PAGE_DELETE: 'page.delete',
  PAGE_PUBLISH: 'page.publish',
  PAGE_UNPUBLISH: 'page.unpublish',

  // Media actions
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',
  MEDIA_ASSIGN: 'media.assign',

  // Theme actions
  THEME_UPDATE: 'theme.update',
  COLOR_UPDATE: 'color.update',
  FONT_UPDATE: 'font.update',

  // System config actions
  CONFIG_UPDATE: 'config.update',
  TAX_UPDATE: 'tax.update',
  SHIPPING_UPDATE: 'shipping.update',

  // User/Auth actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_ROLE_CHANGE: 'user.role_change',
  PASSWORD_CHANGE: 'user.password_change',
  PASSWORD_RESET: 'user.password_reset',

  // Security actions
  PERMISSION_CHANGE: 'security.permission_change',
  API_KEY_CREATE: 'security.api_key_create',
  API_KEY_REVOKE: 'security.api_key_revoke',
  FIREWALL_UPDATE: 'security.firewall_update',
  TWO_FACTOR_ENABLE: 'security.2fa_enable',
  TWO_FACTOR_DISABLE: 'security.2fa_disable',

  // Category actions
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_DELETE: 'category.delete',

  // Fabric/Hardware actions
  FABRIC_CREATE: 'fabric.create',
  FABRIC_UPDATE: 'fabric.update',
  FABRIC_DELETE: 'fabric.delete',
  HARDWARE_CREATE: 'hardware.create',
  HARDWARE_UPDATE: 'hardware.update',
  HARDWARE_DELETE: 'hardware.delete'
};

/**
 * Audit Severity Levels
 */
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  ERROR: 'error'
};

/**
 * AuditLogger Class
 */
class AuditLogger {
  constructor() {
    this.buffer = [];
    this.flushInterval = 5000; // 5 seconds
    this.maxBufferSize = 100;

    // Start periodic flush
    setInterval(() => this.flush(), this.flushInterval);
  }

  /**
   * Load database
   */
  loadDatabase() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('AuditLogger: Error loading database:', error);
      return null;
    }
  }

  /**
   * Save database
   */
  saveDatabase(db) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('AuditLogger: Error saving database:', error);
    }
  }

  /**
   * Log an audit event
   * @param {Object} params - Audit parameters
   */
  log(params) {
    const {
      action,
      userId,
      userEmail,
      userRole,
      resourceType,
      resourceId,
      resourceName,
      previousState,
      newState,
      changes,
      ipAddress,
      userAgent,
      severity = SEVERITY.INFO,
      metadata = {}
    } = params;

    const auditEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action,
      severity,
      actor: {
        userId,
        email: userEmail,
        role: userRole,
        ipAddress: this.maskIp(ipAddress),
        userAgent: this.truncateUserAgent(userAgent)
      },
      resource: {
        type: resourceType,
        id: resourceId,
        name: resourceName
      },
      changes: this.buildChangeDiff(previousState, newState, changes),
      metadata
    };

    // Add to buffer
    this.buffer.push(auditEntry);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }

    // Log critical events immediately
    if (severity === SEVERITY.CRITICAL) {
      this.flush();
      console.warn('[AUDIT:CRITICAL]', JSON.stringify(auditEntry, null, 2));
    }

    return auditEntry;
  }

  /**
   * Build change diff from previous and new state
   */
  buildChangeDiff(previousState, newState, explicitChanges) {
    if (explicitChanges) {
      return explicitChanges;
    }

    if (!previousState && !newState) {
      return null;
    }

    if (!previousState) {
      return { type: 'create', data: this.sanitizeState(newState) };
    }

    if (!newState) {
      return { type: 'delete', data: this.sanitizeState(previousState) };
    }

    // Build field-by-field diff
    const diff = {};
    const allKeys = new Set([
      ...Object.keys(previousState),
      ...Object.keys(newState)
    ]);

    for (const key of allKeys) {
      // Skip internal fields
      if (key.startsWith('_') || key === 'password') continue;

      const prev = previousState[key];
      const next = newState[key];

      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        diff[key] = {
          from: this.sanitizeValue(prev),
          to: this.sanitizeValue(next)
        };
      }
    }

    return Object.keys(diff).length > 0 ? diff : null;
  }

  /**
   * Sanitize state for logging (remove sensitive data)
   */
  sanitizeState(state) {
    if (!state || typeof state !== 'object') return state;

    const sanitized = { ...state };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize individual value
   */
  sanitizeValue(value) {
    if (typeof value === 'string' && value.length > 500) {
      return value.substring(0, 500) + '...[truncated]';
    }
    return value;
  }

  /**
   * Mask IP address for privacy
   */
  maskIp(ip) {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip.substring(0, ip.length / 2) + '***';
  }

  /**
   * Truncate user agent
   */
  truncateUserAgent(ua) {
    if (!ua) return null;
    return ua.length > 100 ? ua.substring(0, 100) + '...' : ua;
  }

  /**
   * Flush buffer to database
   */
  flush() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const db = this.loadDatabase();
    if (!db) {
      console.error('AuditLogger: Cannot flush - database unavailable');
      // Put entries back
      this.buffer = [...entries, ...this.buffer];
      return;
    }

    // Ensure audit_logs array exists
    if (!db.audit_logs) {
      db.audit_logs = [];
    }

    // Add entries
    db.audit_logs.push(...entries);

    // Trim old logs (keep last 10000)
    const maxLogs = 10000;
    if (db.audit_logs.length > maxLogs) {
      db.audit_logs = db.audit_logs.slice(-maxLogs);
    }

    this.saveDatabase(db);
  }

  /**
   * Query audit logs
   * @param {Object} filters - Query filters
   * @returns {Array} - Matching audit entries
   */
  query(filters = {}) {
    const db = this.loadDatabase();
    if (!db || !db.audit_logs) return [];

    let results = db.audit_logs;

    // Filter by action
    if (filters.action) {
      results = results.filter(e => e.action === filters.action);
    }

    // Filter by action prefix (e.g., 'product.*')
    if (filters.actionPrefix) {
      results = results.filter(e => e.action.startsWith(filters.actionPrefix));
    }

    // Filter by user
    if (filters.userId) {
      results = results.filter(e => e.actor.userId === filters.userId);
    }

    // Filter by resource
    if (filters.resourceType) {
      results = results.filter(e => e.resource.type === filters.resourceType);
    }
    if (filters.resourceId) {
      results = results.filter(e => e.resource.id === filters.resourceId);
    }

    // Filter by date range
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      results = results.filter(e => new Date(e.timestamp) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      results = results.filter(e => new Date(e.timestamp) <= end);
    }

    // Filter by severity
    if (filters.severity) {
      results = results.filter(e => e.severity === filters.severity);
    }

    // Sort (newest first by default)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get audit history for a specific resource
   */
  getResourceHistory(resourceType, resourceId) {
    return this.query({ resourceType, resourceId });
  }

  /**
   * Get user activity
   */
  getUserActivity(userId, limit = 50) {
    return this.query({ userId, limit });
  }

  /**
   * Get recent critical events
   */
  getCriticalEvents(limit = 50) {
    return this.query({ severity: SEVERITY.CRITICAL, limit });
  }

  /**
   * Helper: Log product action
   */
  logProductAction(action, product, previousProduct, admin, req) {
    return this.log({
      action,
      userId: admin.id,
      userEmail: admin.email,
      userRole: admin.role,
      resourceType: 'product',
      resourceId: product.id,
      resourceName: product.name,
      previousState: previousProduct,
      newState: product,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }

  /**
   * Helper: Log order action
   */
  logOrderAction(action, order, previousOrder, admin, req) {
    return this.log({
      action,
      userId: admin?.id || 'system',
      userEmail: admin?.email || 'system',
      userRole: admin?.role || 'system',
      resourceType: 'order',
      resourceId: order.id || order.order_number,
      resourceName: order.order_number,
      previousState: previousOrder,
      newState: order,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }

  /**
   * Helper: Log auth action
   */
  logAuthAction(action, user, success, req, metadata = {}) {
    return this.log({
      action,
      userId: user?.id || 'unknown',
      userEmail: user?.email || metadata.attemptedEmail,
      userRole: user?.role,
      resourceType: 'auth',
      resourceId: user?.id,
      resourceName: user?.email || metadata.attemptedEmail,
      severity: success ? SEVERITY.INFO : SEVERITY.WARNING,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent'),
      metadata: {
        success,
        ...metadata
      }
    });
  }

  /**
   * Helper: Log config change
   */
  logConfigChange(configType, previousConfig, newConfig, admin, req) {
    return this.log({
      action: AUDIT_ACTIONS.CONFIG_UPDATE,
      userId: admin.id,
      userEmail: admin.email,
      userRole: admin.role,
      resourceType: 'config',
      resourceId: configType,
      resourceName: configType,
      previousState: previousConfig,
      newState: newConfig,
      severity: SEVERITY.WARNING,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent')
    });
  }
}

// Singleton instance
const auditLogger = new AuditLogger();

module.exports = {
  auditLogger,
  AuditLogger,
  AUDIT_ACTIONS,
  SEVERITY
};
