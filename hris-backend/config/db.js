const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('DATABASE_URL or DB_HOST/DB_USER/DB_NAME must be set');
  }
  var url = `postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}`;
} else {
  var url = DATABASE_URL;
}

// Set schema search_path via connection options (avoids deprecated client.query() in connect handler)
const sep = url.includes('?') ? '&' : '?';
const searchPathOpt = 'options=-c%20search_path%3Dhris_saas%2Cpublic';
const connectionString = url + sep + searchPathOpt;

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('PG Pool error (non-fatal):', err?.message || err);
});

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
      if (error.code === '23505') error.code = 'ER_DUP_ENTRY';
      throw error;
    }
  },
  query: async (sql, params) => {
    const { text, values } = convertParams(sql, params);
    const result = await pool.query(text, values);
    return [result.rows, result.fields];
  },
  pool,
};

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connection pool verified successfully.');
  } catch (err) {
    console.error('PostgreSQL connection failed:', err.message);
  }
})();

module.exports = db;
