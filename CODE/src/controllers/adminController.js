// Admin Backend – Lăng Minh Đức
const { pool } = require('../config/db');

const VALID_STATUS = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

// Helper trả JSON theo chuẩn { success, message, data }.
// (Có thể thay bằng utils/response.js nếu hàm của nhóm tương thích.)
const ok = (res, message, data = null, status = 200) =>
  res.status(status).json({ success: true, message, data });
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message, data: null });

function handleError(res, err) {
  console.error(err);
  if (err.code === '23505') return fail(res, 400, 'Duplicate value');
  if (err.code === '23503') return fail(res, 400, 'Invalid reference (foreign key)');
  if (err.code === '23514') return fail(res, 400, 'Value violates a constraint');
  if (err.code === '22P02') return fail(res, 400, 'Invalid input format');
  return fail(res, 500, 'Internal server error');
}

// Chạy fn(client) trong 1 transaction; rollback nếu có lỗi.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================== PRODUCTS ==============================
exports.getProducts = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.description, p.image_url, p.is_active, p.category_id,
             c.name AS category_name, p.created_at,
             COALESCE(json_agg(json_build_object(
               'id', v.id, 'size', v.size, 'color', v.color,
               'price', v.price, 'stock_quantity', v.stock_quantity
             ) ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_variants v ON v.product_id = p.id
      GROUP BY p.id, c.name
      ORDER BY p.id`);
    return ok(res, 'Products retrieved successfully', rows);
  } catch (err) { return handleError(res, err); }
};

exports.createProduct = async (req, res) => {
  const { name, description, image_url, category_id, variants = [] } = req.body;
  if (!name || !category_id) return fail(res, 400, 'name and category_id are required');
  try {
    const product = await withTransaction(async (client) => {
      const { rows: [p] } = await client.query(
        `INSERT INTO products (name, description, image_url, category_id)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [name, description || null, image_url || null, category_id]);
      for (const v of variants) {
        await client.query(
          `INSERT INTO product_variants (product_id, size, color, price, stock_quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [p.id, v.size, v.color, v.price, v.stock_quantity ?? 0]);
      }
      return p;
    });
    return ok(res, 'Product created successfully', product, 201);
  } catch (err) { return handleError(res, err); }
};

// Biến thể có "id" -> cập nhật, không có "id" -> thêm mới.
exports.updateProduct = async (req, res) => {
  const { name, description, image_url, category_id, is_active, variants } = req.body;
  try {
    const product = await withTransaction(async (client) => {
      const { rows: [p] } = await client.query(
        `UPDATE products SET
           name = COALESCE($1,name), description = COALESCE($2,description),
           image_url = COALESCE($3,image_url), category_id = COALESCE($4,category_id),
           is_active = COALESCE($5,is_active), updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [name, description, image_url, category_id, is_active, req.params.id]);
      if (!p) return null;
      if (Array.isArray(variants)) {
        for (const v of variants) {
          if (v.id) {
            await client.query(
              `UPDATE product_variants SET
                 size = COALESCE($1,size), color = COALESCE($2,color),
                 price = COALESCE($3,price), stock_quantity = COALESCE($4,stock_quantity)
               WHERE id = $5 AND product_id = $6`,
              [v.size, v.color, v.price, v.stock_quantity, v.id, p.id]);
          } else {
            await client.query(
              `INSERT INTO product_variants (product_id, size, color, price, stock_quantity)
               VALUES ($1,$2,$3,$4,$5)`,
              [p.id, v.size, v.color, v.price, v.stock_quantity ?? 0]);
          }
        }
      }
      return p;
    });
    if (!product) return fail(res, 404, 'Product not found');
    return ok(res, 'Product updated successfully', product);
  } catch (err) { return handleError(res, err); }
};

// Chưa có đơn -> xóa hẳn; đã có đơn -> ẩn (is_active=false) để giữ lịch sử.
exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const { rows: [exists] } = await pool.query('SELECT id FROM products WHERE id=$1', [id]);
    if (!exists) return fail(res, 404, 'Product not found');

    const { rows: [used] } = await pool.query(
      `SELECT 1 FROM order_items oi JOIN product_variants v ON v.id = oi.variant_id
       WHERE v.product_id = $1 LIMIT 1`, [id]);
    if (used) {
      await pool.query('UPDATE products SET is_active=FALSE, updated_at=NOW() WHERE id=$1', [id]);
      return ok(res, 'Product has existing orders and was hidden (soft deleted)');
    }
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    return ok(res, 'Product deleted successfully');
  } catch (err) { return handleError(res, err); }
};

// ============================= CATEGORIES =============================
exports.createCategory = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return fail(res, 400, 'name is required');
  try {
    const { rows: [c] } = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING *',
      [name, description || null]);
    return ok(res, 'Category created successfully', c, 201);
  } catch (err) { return handleError(res, err); }
};

exports.updateCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows: [c] } = await pool.query(
      `UPDATE categories SET name = COALESCE($1,name), description = COALESCE($2,description)
       WHERE id=$3 RETURNING *`, [name, description, req.params.id]);
    if (!c) return fail(res, 404, 'Category not found');
    return ok(res, 'Category updated successfully', c);
  } catch (err) { return handleError(res, err); }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { rows: [c] } = await pool.query('SELECT id FROM categories WHERE id=$1', [req.params.id]);
    if (!c) return fail(res, 404, 'Category not found');
    const { rows: [used] } = await pool.query(
      'SELECT 1 FROM products WHERE category_id=$1 LIMIT 1', [req.params.id]);
    if (used) return fail(res, 400, 'Cannot delete a category that still has products');
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    return ok(res, 'Category deleted successfully');
  } catch (err) { return handleError(res, err); }
};

// ============================== ORDERS ================================
exports.getOrders = async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.query.status) { params.push(req.query.status); where = 'WHERE o.status = $1'; }
    const { rows } = await pool.query(`
      SELECT o.*, u.email AS user_email,
             COALESCE(json_agg(json_build_object(
               'variant_id', oi.variant_id, 'product_name', oi.product_name,
               'size', oi.size, 'color', oi.color, 'unit_price', oi.unit_price,
               'quantity', oi.quantity, 'line_total', oi.line_total
             ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${where}
      GROUP BY o.id, u.email
      ORDER BY o.created_at DESC`, params);
    return ok(res, 'Orders retrieved successfully', rows);
  } catch (err) { return handleError(res, err); }
};

// Hủy đơn -> hoàn lại tồn kho, trong cùng 1 transaction.
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUS.includes(status))
    return fail(res, 400, `status must be one of: ${VALID_STATUS.join(', ')}`);
  try {
    const result = await withTransaction(async (client) => {
      const { rows: [order] } = await client.query(
        'SELECT id, status FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!order) return { error: [404, 'Order not found'] };
      if (['cancelled', 'completed'].includes(order.status))
        return { error: [400, `Order is already ${order.status} and cannot be changed`] };

      if (status === 'cancelled') {
        await client.query(
          `UPDATE product_variants v SET stock_quantity = v.stock_quantity + oi.quantity
           FROM order_items oi WHERE oi.order_id = $1 AND oi.variant_id = v.id`, [order.id]);
      }
      const { rows: [updated] } = await client.query(
        'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
        [status, order.id]);
      return { updated };
    });
    if (result.error) return fail(res, result.error[0], result.error[1]);
    return ok(res, 'Order status updated successfully', result.updated);
  } catch (err) { return handleError(res, err); }
};