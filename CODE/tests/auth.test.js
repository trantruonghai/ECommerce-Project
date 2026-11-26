process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/config/db', () => ({ query: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const app = require('../src/app');
const { requireAdmin } = require('../src/middleware/auth');

const validUser = {
  full_name: 'Nguyen Van A',
  email: 'A@Example.com',
  password: 'Passw0rd123',
  phone: '0912345678',
  address: 'HCMC',
};

beforeEach(() => db.query.mockReset());

describe('POST /api/auth/register', () => {
  test('creates a customer, stores a bcrypt hash, lowercases the email', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // email not used
      .mockImplementationOnce(async (sql, params) => ({
        rows: [{ id: 1, full_name: params[0], email: params[1], phone: params[3], address: params[4], role: 'customer' }],
      }));

    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('a@example.com');
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.password_hash).toBeUndefined();

    const insertParams = db.query.mock.calls[1][1];
    expect(insertParams[2]).not.toBe(validUser.password);
    expect(await bcrypt.compare(validUser.password, insertParams[2])).toBe(true);
  });

  test.each([
    ['missing full name', { full_name: '' }, 'Full name is required'],
    ['invalid email', { email: 'not-an-email' }, 'A valid email is required'],
    ['short password', { password: 'a1' }, 'Password must be at least 8 characters'],
    ['password without number', { password: 'abcdefghij' }, 'Password must contain at least one letter and one number'],
    ['password without letter', { password: '1234567890' }, 'Password must contain at least one letter and one number'],
    ['invalid phone', { phone: '123' }, 'Phone number is not valid'],
  ])('rejects %s with 400', async (_name, change, message) => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, ...change });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message, data: null });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rejects a duplicate email with 400', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email is already registered');
  });

  test('returns 500 when the database fails', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  let hash;
  beforeAll(async () => { hash = await bcrypt.hash('Passw0rd123', 10); });

  const row = (extra = {}) => ({
    id: 7, full_name: 'Nguyen Van A', email: 'a@example.com', password_hash: hash,
    phone: null, address: null, role: 'customer', status: 'active', ...extra,
  });

  test('logs in with correct credentials and returns a JWT with id and role', async () => {
    db.query.mockResolvedValueOnce({ rows: [row()] });
    const res = await request(app).post('/api/auth/login').send({ email: 'A@Example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.data.token, 'test-secret');
    expect(payload.id).toBe(7);
    expect(payload.role).toBe('customer');
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  test('wrong password -> 401', async () => {
    db.query.mockResolvedValueOnce({ rows: [row()] });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('unknown email -> 401 with the same message', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('missing fields -> 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com' });
    expect(res.status).toBe(400);
  });

  test('blocked account -> 403', async () => {
    db.query.mockResolvedValueOnce({ rows: [row({ status: 'blocked' })] });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  const token = (extra = {}, secret = 'test-secret', opts = { expiresIn: '1h' }) =>
    jwt.sign({ id: 7, role: 'customer', ...extra }, secret, opts);

  test('returns the current user with a valid token', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, full_name: 'A', email: 'a@example.com', phone: null, address: null, role: 'customer' }] });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(7);
  });

  test('no token -> 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('token signed with another secret -> 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token({}, 'other-secret')}`);
    expect(res.status).toBe(401);
  });

  test('expired token -> 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token({}, 'test-secret', { expiresIn: -10 })}`);
    expect(res.status).toBe(401);
  });

  test('user deleted after login -> 404', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(404);
  });
});

describe('role middleware', () => {
  const run = (user) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireAdmin({ user }, res, next);
    return { res, next };
  };

  test('administrator may continue', () => {
    const { next } = run({ id: 1, role: 'admin' });
    expect(next).toHaveBeenCalled();
  });

  test('customer gets 403', () => {
    const { res, next } = run({ id: 2, role: 'customer' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('no user gets 401', () => {
    const { res } = run(undefined);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
