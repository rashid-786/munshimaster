const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // Fallback to build from individual env vars for backward compat
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('DATABASE_URL or DB_HOST/DB_USER/DB_NAME must be set');
  }
  var url = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}`;
} else {
  var url = DATABASE_URL;
}

const pool = new Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Set schema search path so unqualified table names resolve to hris_saas
pool.query('SET search_path TO hris_saas, public').catch(() => {});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

// Convert ?-style placeholders to $N style
function convertParams(sql, params) {
  if (!params || params.length === 0) return { text: sql, values: params || [] };
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  return { text, values: params };
}

const db = {
  execute: async (sql, params) => {
    const { text, values } = convertParams(sql, params);
    try {
      const result = await pool.query(text, values);
      return [result.rows, result.fields];
    } catch (error) {
      // Map PG error codes to something similar to mysql2 for backward compat
      if (error.code === '23505') {
        error.code = 'ER_DUP_ENTRY';
      }
      throw error;
    }
  },
  query: async (sql, params) => {
    const { text, values } = convertParams(sql, params);
    const result = await pool.query(text, values);
    return [result.rows, result.fields];
  },
  // For pool.query raw access
  pool,
};

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL connection pool verified successfully.');
}).catch(err => {
  console.error('PostgreSQL connection failed:', err.message);
});

module.exports = db;
