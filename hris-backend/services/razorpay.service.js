const db = require('../config/db');
const Razorpay = require('razorpay');

/**
 * Read the centrally-managed Razorpay credentials (Super Admin → Razorpay Settings)
 * from system_settings.global_config, falling back to environment variables.
 *
 * Stored shape under global_config:
 * {
 *   razorpay: {
 *     environment: 'test' | 'production',
 *     test:       { mid, apiKey, secret },
 *     production: { mid, apiKey, secret }
 *   }
 * }
 */
async function getRazorpayCredentials() {
  let gc = {};
  try {
    const [rows] = await db.execute('SELECT global_config FROM system_settings WHERE id = 1');
    gc = rows[0]?.global_config
      ? (typeof rows[0].global_config === 'string' ? JSON.parse(rows[0].global_config) : rows[0].global_config)
      : {};
  } catch {
    gc = {};
  }
  const rp = (gc.razorpay) || {};
  const env = rp.environment === 'production' ? 'production' : 'test';
  const creds = rp[env] || {};
  return {
    environment: env,
    mid: creds.mid || '',
    keyId: creds.apiKey || process.env.RAZORPAY_KEY_ID || '',
    keySecret: creds.secret || process.env.RAZORPAY_KEY_SECRET || '',
  };
}

async function getRazorpay() {
  const { keyId, keySecret } = await getRazorpayCredentials();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

module.exports = { getRazorpay, getRazorpayCredentials };
