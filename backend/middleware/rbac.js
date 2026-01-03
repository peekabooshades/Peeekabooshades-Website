/**
 * PEEKABOO SHADES - ROLE-BASED ACCESS CONTROL (RBAC)
 * ===================================================
 *
 * Enforces permissions based on user roles.
 * Integrates with auth middleware.
 */

const { auditLogger, AUDIT_ACTIONS, SEVERITY } = require('../services/audit-logger');

/**
 * Define available roles
 */
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  EDITOR: 'editor',
  VIEWER: 'viewer'
};

/**
 * Role hierarchy (higher number = more permissions)
 */
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MANAGER]: 60,
  [ROLES.EDITOR]: 40,
  [ROLES.VIEWER]: 20
};

/**
 * Permission definitions by resource and action
 */
const PERMISSIONS = {
  // Product permissions
  'products.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'products.create': [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'products.update': [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'products.delete': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'products.publish': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Order permissions
  'orders.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'orders.update': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'orders.cancel': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'orders.refund': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Customer permissions
  'customers.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'customers.update': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'customers.delete': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Content permissions
  'content.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'content.create': [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'content.update': [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'content.delete': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'content.publish': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Theme/Design permissions
  'theme.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'theme.update': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Media permissions
  'media.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'media.upload': [ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'media.delete': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Pricing permissions
  'pricing.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'pricing.update': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Promotions/Discounts
  'promotions.view': [ROLES.VIEWER, ROLES.EDITOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'promotions.create': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'promotions.update': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'promotions.delete': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Analytics permissions
  'analytics.view': [ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'analytics.export': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // Settings permissions
  'settings.view': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'settings.update': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // User management permissions
  'users.view': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'users.create': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'users.update': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'users.delete': [ROLES.SUPER_ADMIN],
  'users.roles': [ROLES.SUPER_ADMIN],

  // Security permissions
  'security.view': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'security.update': [ROLES.SUPER_ADMIN],
  'security.audit': [ROLES.ADMIN, ROLES.SUPER_ADMIN],

  // System config permissions
  'config.view': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'config.update': [ROLES.SUPER_ADMIN],

  // API keys permissions
  'apikeys.view': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'apikeys.create': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'apikeys.revoke': [ROLES.SUPER_ADMIN],

  // Webhooks permissions
  'webhooks.view': [ROLES.ADMIN, ROLES.SUPER_ADMIN],
  'webhooks.manage': [ROLES.SUPER_ADMIN]
};

/**
 * Check if a role has a specific permission
 */
function hasPermission(role, permission) {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    // Permission not defined - deny by default
    console.warn(`RBAC: Unknown permission "${permission}"`);
    return false;
  }
  return allowedRoles.includes(role);
}

/**
 * Check if role1 is equal or higher than role2
 */
function isRoleAtLeast(role1, role2) {
  const level1 = ROLE_HIERARCHY[role1] || 0;
  const level2 = ROLE_HIERARCHY[role2] || 0;
  return level1 >= level2;
}

/**
 * RBAC Middleware Factory
 * Creates middleware that checks for specific permission
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.admin.role || ROLES.VIEWER;

    // Check permission
    if (!hasPermission(userRole, permission)) {
      // Log unauthorized access attempt
      auditLogger.log({
        action: 'security.unauthorized_access',
        userId: req.admin.id,
        userEmail: req.admin.email,
        userRole: userRole,
        resourceType: 'permission',
        resourceId: permission,
        severity: SEVERITY.WARNING,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          attemptedPermission: permission,
          endpoint: req.originalUrl,
          method: req.method
        }
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permission
      });
    }

    next();
  };
}

/**
 * Require minimum role level
 * @param {string} minimumRole - Minimum required role
 * @returns {Function} Express middleware
 */
function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.admin.role || ROLES.VIEWER;

    if (!isRoleAtLeast(userRole, minimumRole)) {
      auditLogger.log({
        action: 'security.unauthorized_access',
        userId: req.admin.id,
        userEmail: req.admin.email,
        userRole: userRole,
        resourceType: 'role',
        resourceId: minimumRole,
        severity: SEVERITY.WARNING,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          requiredRole: minimumRole,
          endpoint: req.originalUrl,
          method: req.method
        }
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient role level',
        required: minimumRole
      });
    }

    next();
  };
}

/**
 * Check multiple permissions (any)
 * @param {string[]} permissions - Array of permissions (any required)
 * @returns {Function} Express middleware
 */
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.admin.role || ROLES.VIEWER;
    const hasAny = permissions.some(perm => hasPermission(userRole, perm));

    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: `One of: ${permissions.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Check multiple permissions (all required)
 * @param {string[]} permissions - Array of permissions (all required)
 * @returns {Function} Express middleware
 */
function requireAllPermissions(permissions) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.admin.role || ROLES.VIEWER;
    const missing = permissions.filter(perm => !hasPermission(userRole, perm));

    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        missing
      });
    }

    next();
  };
}

/**
 * Get all permissions for a role
 */
function getRolePermissions(role) {
  const permissions = [];
  for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (allowedRoles.includes(role)) {
      permissions.push(permission);
    }
  }
  return permissions;
}

/**
 * Validate role string
 */
function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  hasPermission,
  isRoleAtLeast,
  requirePermission,
  requireRole,
  requireAnyPermission,
  requireAllPermissions,
  getRolePermissions,
  isValidRole
};
