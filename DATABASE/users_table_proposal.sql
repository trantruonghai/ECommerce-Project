-- Proposal for the users table, so that the auth code and Đức's schema match.
-- Đức: please confirm or change the column names, then tell Huy.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,   -- stored in lowercase
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash, never the plain password
  phone         VARCHAR(20),
  address       TEXT,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'   CHECK (status IN ('active', 'blocked')),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
