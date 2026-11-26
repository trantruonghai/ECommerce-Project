const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Add it to your .env file.');
  }
  return process.env.JWT_SECRET;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

// Reads "Authorization: Bearer <token>". Returns null if the header is missing.
function readToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// For routes that need a logged-in user (profile, my-orders, ...).
function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) return sendError(res, 401, 'Authentication required');
  try {
    const payload = jwt.verify(token, getSecret());
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired token');
  }
}

// For routes open to guests AND members (checkout).
// No token  -> guest (req.user stays undefined).
// Bad token -> 401, so a member never silently loses the member discount.
function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  return authenticate(req, res, next);
}

// Use after authenticate. Only administrators may continue.
function requireAdmin(req, res, next) {
  if (!req.user) return sendError(res, 401, 'Authentication required');
  if (req.user.role !== 'admin') return sendError(res, 403, 'Administrator access required');
  return next();
}

module.exports = { signToken, authenticate, optionalAuth, requireAdmin };
