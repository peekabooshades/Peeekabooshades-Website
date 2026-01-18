const jwt = require('jsonwebtoken');

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'peekaboo-shades-admin-secret-key-2024';

// Token expiration
const TOKEN_EXPIRY = '24h';

/**
 * Authentication middleware for admin routes
 * Verifies JWT token from Authorization header
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('Auth header received:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please login.'
    });
  }

  const token = authHeader.split(' ')[1];

  // Check if token is the literal string "null" or "undefined"
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({
      success: false,
      error: 'No valid token provided. Please login again.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error.name, error.message);
    console.error('Token (first 50 chars):', token?.substring(0, 50));
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please login again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid token. Please login again.'
    });
  }
}

/**
 * Generate JWT token for admin or dealer user
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };

  // Add dealer-specific fields if present
  if (user.dealerId) {
    payload.dealerId = user.dealerId;
  }
  if (user.dealerName) {
    payload.dealerName = user.dealerName;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify JWT token (for client-side checks)
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  authMiddleware,
  generateToken,
  verifyToken,
  JWT_SECRET,
  TOKEN_EXPIRY
};
