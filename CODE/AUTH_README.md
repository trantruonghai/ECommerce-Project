# StylishFashion – Authentication, Member Discount, Tests (Huy)

Checkpoint 02 part of Nguyễn Nhật Huy. Stack: Node.js + Express, PostgreSQL, JWT, bcrypt.

## Contents
- `src/controllers/authController.js` – register, login, me
- `src/routes/authRoutes.js` – `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `src/middleware/auth.js` – `authenticate`, `optionalAuth`, `requireAdmin`, `signToken`
- `src/services/pricing.js` – `calculateTotals()` with the 5% member discount
- `tests/` – automated tests (`npm test`, 35 tests)
- `DATABASE/users_table_proposal.sql` – users table that this code expects
- `DOCUMENTATION/TEST_CASES.xlsx` – 35 manual and API test cases

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and set `JWT_SECRET` (long random text) and the database values.
3. Run `DATABASE/users_table_proposal.sql` (or Đức's final schema) in PostgreSQL.
4. `npm test`

## How to use it in the main server (for Hải)
```js
app.use(express.json());
app.use('/api/auth', require('./routes/authRoutes'));
```

Checkout must work for guests and members, so use `optionalAuth` and never trust prices from the browser:
```js
const { optionalAuth, authenticate, requireAdmin } = require('./middleware/auth');
const { calculateTotals } = require('./services/pricing');

router.post('/orders/checkout', optionalAuth, async (req, res) => {
  const isMember = Boolean(req.user);            // no token = guest
  // load unit_price and stock from product_variants (database), not from the request
  const totals = calculateTotals({ items: dbItems, isMember, couponDiscount, deliveryFee });
  // ... create orders + order_items + update stock inside one PostgreSQL transaction
});

router.get('/orders/my-orders', authenticate, handler);
router.use('/admin', authenticate, requireAdmin);   // protects every /api/admin route
```

## Rules implemented
- Passwords are hashed with bcrypt before saving; `password_hash` is never sent to the client.
- Password: at least 8 characters with a letter and a number. Phone: Vietnamese format. Email is saved in lowercase.
- Same error for wrong email and wrong password (401).
- Token: JWT with `id` and `role`, valid for 1 day (`JWT_EXPIRES_IN`). Logout = the frontend deletes the token.
- Member discount: 5% of the eligible product subtotal, rounded to whole VND; guests get none. A bad or expired token at checkout returns 401 (the member is not silently charged the guest price).
- Status codes follow the plan: 200, 201, 400, 401, 403, 404, 500 (duplicate email uses 400).

## Questions for the team
1. Đức: are the `users` column names the same as in the proposal (`full_name`, `password_hash`, `role`, `status`)?
2. Order of discounts: this code takes the member discount first, then the coupon amount, then adds the delivery fee. Please confirm.
3. Nhân: store the token in `localStorage` and send it as `Authorization: Bearer <token>` in every Fetch request.
