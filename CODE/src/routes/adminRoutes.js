const express = require('express');
const admin = require('../controllers/adminController');
const adminOnly = require('../middleware/adminOnly');

const authModule = require('../middleware/auth');
const authenticate =
  typeof authModule === 'function'
    ? authModule
    : authModule.authenticate || authModule.verifyToken || authModule.authMiddleware ||
      authModule.requireAuth || authModule.protect;

if (typeof authenticate !== 'function') {
  throw new Error('adminRoutes: không tìm thấy middleware xác thực trong middleware/auth.js');
}

const router = express.Router();
router.use(authenticate, adminOnly);

// Products
router.get('/products', admin.getProducts);
router.post('/products', admin.createProduct);
router.put('/products/:id', admin.updateProduct);
router.delete('/products/:id', admin.deleteProduct);

// Categories
router.post('/categories', admin.createCategory);
router.put('/categories/:id', admin.updateCategory);
router.delete('/categories/:id', admin.deleteCategory);

// Orders
router.get('/orders', admin.getOrders);
router.put('/orders/:id/status', admin.updateOrderStatus);

module.exports = router;