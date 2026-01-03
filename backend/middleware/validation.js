/**
 * PEEKABOO SHADES - INPUT VALIDATION MIDDLEWARE
 * ==============================================
 *
 * Validates ALL input before processing.
 * Prevents:
 * - Invalid data
 * - Injection attacks
 * - Business rule violations
 */

/**
 * Sanitize string input
 */
function sanitizeString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
}

/**
 * Sanitize HTML (basic - remove script tags)
 */
function sanitizeHtml(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (basic)
 */
function isValidPhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate positive number
 */
function isPositiveNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate integer in range
 */
function isIntegerInRange(value, min, max) {
  const num = parseInt(value);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate slug format
 */
function isValidSlug(slug) {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validation rules for different entities
 */
const validationRules = {
  product: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 200 },
    slug: { required: true, type: 'string', validator: isValidSlug },
    description: { required: false, type: 'string', maxLength: 5000 },
    base_price: { required: true, type: 'number', min: 0.01, max: 100000 },
    sale_price: { required: false, type: 'number', min: 0, max: 100000 },
    category_id: { required: true, type: 'string', validator: isValidUUID },
    is_active: { required: false, type: 'boolean' },
    is_featured: { required: false, type: 'boolean' }
  },

  order: {
    customerName: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    customerEmail: { required: true, type: 'string', validator: isValidEmail },
    customerPhone: { required: false, type: 'string', validator: isValidPhone },
    shippingAddress: { required: true, type: 'string', minLength: 10, maxLength: 500 }
  },

  cartItem: {
    productId: { required: true, type: 'string', validator: isValidUUID },
    width: { required: true, type: 'number', min: 12, max: 144 },
    height: { required: true, type: 'number', min: 12, max: 120 },
    quantity: { required: true, type: 'integer', min: 1, max: 100 },
    roomLabel: { required: false, type: 'string', maxLength: 50 }
  },

  customer: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email: { required: true, type: 'string', validator: isValidEmail },
    phone: { required: false, type: 'string', validator: isValidPhone }
  },

  quote: {
    customerName: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    customerEmail: { required: true, type: 'string', validator: isValidEmail },
    customerPhone: { required: false, type: 'string', validator: isValidPhone },
    message: { required: false, type: 'string', maxLength: 2000 }
  },

  adminUser: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email: { required: true, type: 'string', validator: isValidEmail },
    password: { required: true, type: 'string', minLength: 8, maxLength: 100 },
    role: { required: true, type: 'string', enum: ['super_admin', 'admin', 'manager', 'editor', 'viewer'] }
  },

  category: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    slug: { required: true, type: 'string', validator: isValidSlug },
    description: { required: false, type: 'string', maxLength: 500 }
  },

  promotion: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    code: { required: true, type: 'string', minLength: 3, maxLength: 30 },
    discountType: { required: true, type: 'string', enum: ['percentage', 'fixed'] },
    discountValue: { required: true, type: 'number', min: 0 }
  }
};

/**
 * Validate a single field
 */
function validateField(value, rules, fieldName) {
  const errors = [];

  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  // Skip further validation if optional and empty
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type validation
  switch (rules.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
      } else {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${fieldName} must be no more than ${rules.maxLength} characters`);
        }
      }
      break;

    case 'number':
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.push(`${fieldName} must be a number`);
      } else {
        if (rules.min !== undefined && numValue < rules.min) {
          errors.push(`${fieldName} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && numValue > rules.max) {
          errors.push(`${fieldName} must be no more than ${rules.max}`);
        }
      }
      break;

    case 'integer':
      const intValue = parseInt(value);
      if (isNaN(intValue) || intValue !== parseFloat(value)) {
        errors.push(`${fieldName} must be an integer`);
      } else {
        if (rules.min !== undefined && intValue < rules.min) {
          errors.push(`${fieldName} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && intValue > rules.max) {
          errors.push(`${fieldName} must be no more than ${rules.max}`);
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        errors.push(`${fieldName} must be a boolean`);
      }
      break;
  }

  // Enum validation
  if (rules.enum && !rules.enum.includes(value)) {
    errors.push(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
  }

  // Custom validator
  if (rules.validator && !rules.validator(value)) {
    errors.push(`${fieldName} has invalid format`);
  }

  return errors;
}

/**
 * Validate object against rules
 */
function validateObject(data, entityType, partial = false) {
  const rules = validationRules[entityType];
  if (!rules) {
    return { valid: false, errors: [`Unknown entity type: ${entityType}`] };
  }

  const allErrors = [];

  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    // For partial updates, skip missing fields
    if (partial && data[fieldName] === undefined) {
      continue;
    }

    const errors = validateField(data[fieldName], fieldRules, fieldName);
    allErrors.push(...errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Validation middleware factory
 */
function validate(entityType, partial = false) {
  return (req, res, next) => {
    const result = validateObject(req.body, entityType, partial);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
    }

    next();
  };
}

/**
 * Validate request parameters
 */
function validateParams(rules) {
  return (req, res, next) => {
    const allErrors = [];

    for (const [paramName, fieldRules] of Object.entries(rules)) {
      const value = req.params[paramName];
      const errors = validateField(value, fieldRules, paramName);
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: allErrors
      });
    }

    next();
  };
}

/**
 * Validate query parameters
 */
function validateQuery(rules) {
  return (req, res, next) => {
    const allErrors = [];

    for (const [paramName, fieldRules] of Object.entries(rules)) {
      const value = req.query[paramName];
      // Query params are optional by default unless specified
      const adjustedRules = { ...fieldRules, required: fieldRules.required || false };
      const errors = validateField(value, adjustedRules, paramName);
      allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: allErrors
      });
    }

    next();
  };
}

/**
 * Sanitize request body
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitizeString(value);
      }
    }
  }
  next();
}

module.exports = {
  validate,
  validateParams,
  validateQuery,
  validateObject,
  validateField,
  sanitizeBody,
  sanitizeString,
  sanitizeHtml,
  isValidEmail,
  isValidPhone,
  isPositiveNumber,
  isIntegerInRange,
  isValidSlug,
  isValidUUID,
  validationRules
};
