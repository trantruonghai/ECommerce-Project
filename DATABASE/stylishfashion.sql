-- =====================================================================
-- StylishFashion | Checkpoint 02 | PostgreSQL schema + sample data
-- Owner: Lăng Minh Đức
-- Run:   psql -U postgres -c "CREATE DATABASE stylishfashion;"
--        psql -U postgres -d stylishfashion -f stylishfashion.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- bcrypt-compatible hashing for sample users

DROP TABLE IF EXISTS order_items, orders, coupons, product_variants, products, categories, users CASCADE;

-- 1. users ------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone         VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'admin')),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 2. categories -------------------------------------------------------
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. products ---------------------------------------------------------
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    image_url   VARCHAR(500),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,   -- soft delete when product already has orders
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_category ON products(category_id);

-- 4. product_variants -------------------------------------------------
CREATE TABLE product_variants (
    id             SERIAL PRIMARY KEY,
    product_id     INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size           VARCHAR(10) NOT NULL,
    color          VARCHAR(30) NOT NULL,
    price          NUMERIC(12,0) NOT NULL CHECK (price >= 0),          -- VND
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    UNIQUE (product_id, size, color)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

-- 5. coupons ----------------------------------------------------------
CREATE TABLE coupons (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,
    description     TEXT,
    discount_type   VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value  NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    min_order_value NUMERIC(12,0) NOT NULL DEFAULT 0,
    max_uses        INT,
    used_count      INT NOT NULL DEFAULT 0,
    starts_at       TIMESTAMP,
    expires_at      TIMESTAMP,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. orders -----------------------------------------------------------
CREATE TABLE orders (
    id               SERIAL PRIMARY KEY,
    user_id          INT REFERENCES users(id) ON DELETE SET NULL,   -- NULL = guest checkout
    coupon_id        INT REFERENCES coupons(id) ON DELETE SET NULL,
    customer_name    VARCHAR(100) NOT NULL,
    customer_phone   VARCHAR(20)  NOT NULL,
    shipping_address TEXT         NOT NULL,
    subtotal         NUMERIC(12,0) NOT NULL CHECK (subtotal >= 0),
    member_discount  NUMERIC(12,0) NOT NULL DEFAULT 0,              -- 5% for members, 0 for guests
    coupon_discount  NUMERIC(12,0) NOT NULL DEFAULT 0,
    total_amount     NUMERIC(12,0) NOT NULL CHECK (total_amount >= 0),
    status           VARCHAR(15) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','shipping','completed','cancelled')),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user   ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- 7. order_items ------------------------------------------------------
CREATE TABLE order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id   INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    product_name VARCHAR(200) NOT NULL,      -- snapshot at purchase time
    size         VARCHAR(10)  NOT NULL,
    color        VARCHAR(30)  NOT NULL,
    unit_price   NUMERIC(12,0) NOT NULL,
    quantity     INT NOT NULL CHECK (quantity > 0),
    line_total   NUMERIC(12,0) NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =====================================================================
-- SAMPLE DATA
-- =====================================================================

-- Users (admin: admin@stylishfashion.vn / Admin@123 ; customer: Customer@123)
INSERT INTO users (full_name, email, phone, password_hash, role) VALUES
 ('Administrator',  'admin@stylishfashion.vn',    '0900000001', crypt('Admin@123',    gen_salt('bf', 10)), 'admin'),
 ('Nguyễn Văn An',  'an.nguyen@example.com',      '0900000002', crypt('Customer@123', gen_salt('bf', 10)), 'customer'),
 ('Trần Thị Bình',  'binh.tran@example.com',      '0900000003', crypt('Customer@123', gen_salt('bf', 10)), 'customer');

INSERT INTO categories (name, description) VALUES
 ('T-Shirts',    'Áo thun cổ tròn thoải mái hằng ngày'),
 ('Polo Shirts', 'Áo polo lịch sự, phù hợp đi làm và đi chơi'),
 ('Hoodies',     'Áo hoodie giữ ấm, phong cách streetwear');

INSERT INTO products (category_id, name, description, image_url) VALUES
 (1, 'Basic Cotton T-Shirt',   'Áo thun cotton 100%, form regular.',        '/images/tshirt-basic.jpg'),
 (1, 'Oversize Graphic Tee',   'Áo thun oversize in hình graphic.',         '/images/tshirt-graphic.jpg'),
 (2, 'Classic Pique Polo',     'Áo polo vải pique thoáng mát.',             '/images/polo-classic.jpg'),
 (2, 'Slim Fit Polo',          'Áo polo slim fit trẻ trung.',               '/images/polo-slim.jpg'),
 (3, 'Essential Pullover Hoodie','Hoodie nỉ bông dày dặn, có mũ.',          '/images/hoodie-essential.jpg'),
 (3, 'Zip-Up Hoodie',          'Hoodie khoá kéo, 2 túi hông.',              '/images/hoodie-zip.jpg');

-- Variants: sizes x colors with different price / stock
INSERT INTO product_variants (product_id, size, color, price, stock_quantity) VALUES
 (1,'S','White',150000,40),(1,'M','White',150000,50),(1,'L','White',150000,35),
 (1,'M','Black',150000,45),(1,'L','Black',150000,30),(1,'XL','Black',160000,20),
 (2,'M','Black',220000,25),(2,'L','Black',220000,25),(2,'L','Beige',220000,15),(2,'XL','Beige',230000,10),
 (3,'S','Navy',280000,20),(3,'M','Navy',280000,30),(3,'L','Navy',280000,25),
 (3,'M','White',280000,22),(3,'L','White',280000,18),
 (4,'M','Black',300000,20),(4,'L','Black',300000,20),(4,'M','Green',300000,12),(4,'L','Green',300000,0),
 (5,'M','Gray',450000,30),(5,'L','Gray',450000,28),(5,'XL','Gray',470000,15),
 (5,'M','Black',450000,25),(5,'L','Black',450000,25),
 (6,'M','Black',520000,15),(6,'L','Black',520000,15),(6,'L','Navy',520000,10),(6,'XL','Navy',540000,8);

INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_uses, expires_at) VALUES
 ('WELCOME10', 'Giảm 10% cho đơn từ 300.000đ',  'percent', 10,     300000, 100, NOW() + INTERVAL '90 days'),
 ('FREESHIP30','Giảm 30.000đ cho đơn từ 500.000đ','fixed',  30000,  500000, 200, NOW() + INTERVAL '60 days');

-- Sample orders: one guest, one member (5% discount)
INSERT INTO orders (user_id, customer_name, customer_phone, shipping_address, subtotal, member_discount, total_amount, status)
VALUES (NULL, 'Khách vãng lai', '0911111111', '12 Nguyễn Huệ, Q1, TP.HCM', 370000, 0, 370000, 'pending');
INSERT INTO order_items (order_id, variant_id, product_name, size, color, unit_price, quantity, line_total) VALUES
 (1, 2,  'Basic Cotton T-Shirt', 'M', 'White', 150000, 1, 150000),
 (1, 7,  'Oversize Graphic Tee', 'M', 'Black', 220000, 1, 220000);

INSERT INTO orders (user_id, customer_name, customer_phone, shipping_address, subtotal, member_discount, total_amount, status)
VALUES (2, 'Nguyễn Văn An', '0900000002', '45 Lê Lợi, Q1, TP.HCM', 450000, 22500, 427500, 'confirmed');
INSERT INTO order_items (order_id, variant_id, product_name, size, color, unit_price, quantity, line_total) VALUES
 (2, 20, 'Essential Pullover Hoodie', 'M', 'Gray', 450000, 1, 450000);