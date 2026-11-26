// PostgreSQL connection pool. Connection settings come from environment variables
// (see .env.example). Only one query helper is exported so tests can mock it easily.
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stylishfashion',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
