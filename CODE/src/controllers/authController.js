const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+84|0)\d{9,10}$/; // Vietnamese phone numbers
const SALT_ROUNDS = 10;

// Never send password_hash to the client.
function toPublicUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    role: row.role,
  };
}

function validateRegister({ full_name, email, password, phone }) {
  if (!full_name || !full_name.trim()) return 'Full name is required';
  if (!email || !EMAIL_RE.test(email)) return 'A valid email is required';
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  if (phone && !PHONE_RE.test(phone)) return 'Phone number is not valid';
  return null;
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const body = req.body || {};
    const problem = validateRegister(body);
    if (problem) return sendError(res, 400, problem);

    const email = body.email.trim().toLowerCase();
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return sendError(res, 400, 'Email is already registered');

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    const inserted = await db.query(
      `INSERT INTO users (full_name, email, password_hash, phone, address, role)
       VALUES ($1, $2, $3, $4, $5, 'customer')
       RETURNING id, full_name, email, phone, address, role`,
      [body.full_name.trim(), email, passwordHash, body.phone || null, body.address || null]
    );

    const user = inserted.rows[0];
    return sendSuccess(res, 201, 'Registration successful', { user: toPublicUser(user), token: signToken(user) });
  } catch (err) {
    console.error('register error:', err.message);
    return sendError(res, 500, 'Server error');
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return sendError(res, 400, 'Email and password are required');

    const result = await db.query(
      `SELECT id, full_name, email, password_hash, phone, address, role, status
       FROM users WHERE email = $1`,
      [String(email).trim().toLowerCase()]
    );
    const user = result.rows[0];

    // Same message for "no such email" and "wrong password" (do not reveal which emails exist).
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) return sendError(res, 401, 'Invalid email or password');

    if (user.status && user.status !== 'active') {
      return sendError(res, 403, 'This account is not active');
    }

    return sendSuccess(res, 200, 'Login successful', { user: toPublicUser(user), token: signToken(user) });
  } catch (err) {
    console.error('login error:', err.message);
    return sendError(res, 500, 'Server error');
  }
}

// GET /api/auth/me  (needs authenticate middleware)
async function me(req, res) {
  try {
    const result = await db.query(
      'SELECT id, full_name, email, phone, address, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return sendError(res, 404, 'User not found');
    return sendSuccess(res, 200, 'User retrieved successfully', toPublicUser(result.rows[0]));
  } catch (err) {
    console.error('me error:', err.message);
    return sendError(res, 500, 'Server error');
  }
}

module.exports = { register, login, me };
