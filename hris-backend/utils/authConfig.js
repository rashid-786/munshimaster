const db = require('../config/db');

/**
 * Global authentication mode, controlled from the Super Admin panel
 * (system_settings.global_config.authMode). Applied app-wide without a redeploy.
 *
 * Values:
 *  - 'mobile_otp' (default): users sign in with a mobile number + SMS OTP.
 *  - 'email_otp':           users sign in with an email address + OTP sent by email.
 */

let cached = null;
let cachedAt = 0;
const TTL_MS = 30 * 1000;

async function getAuthMode() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  try {
    const [rows] = await db.execute('SELECT global_config FROM system_settings WHERE id = 1');
    const gc = rows.length > 0 ? rows[0].global_config : {};
    const config = typeof gc === 'string' ? JSON.parse(gc) : (gc || {});
    cached = config.authMode === 'email_otp' ? 'email_otp' : 'mobile_otp';
    cachedAt = Date.now();
  } catch {
    cached = 'mobile_otp';
    cachedAt = Date.now();
  }
  return cached;
}

function refreshAuthModeCache() {
  cached = null;
  cachedAt = 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + lowercase an email; returns '' when not a valid email. */
function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  const value = email.trim().toLowerCase();
  return EMAIL_RE.test(value) ? value : '';
}

function isValidEmail(email) {
  return normalizeEmail(email) !== '';
}

async function getDefaultCountryCode() {
  try {
    const [rows] = await db.execute('SELECT default_country_code FROM system_settings WHERE id = 1');
    return rows.length > 0 ? rows[0].default_country_code : '+965';
  } catch {
    return '+965';
  }
}

function normalizePhone(phone, countryCode) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return phone;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  return countryCode + digits;
}

/**
 * Resolve the active login identifier from a { phone, email } body based on the
 * globally-configured auth mode. Returns { type, value, authMode } or
 * { error } when the identifier is missing/invalid for the active mode.
 */
async function resolveAuthIdentifier({ phone, email }) {
  const authMode = await getAuthMode();

  if (authMode === 'email_otp') {
    const value = normalizeEmail(email);
    if (!value) return { error: 'A valid email address is required.' };
    return { type: 'email', value, authMode };
  }

  if (!phone) return { error: 'Phone number is required.' };
  const { validateE164 } = require('../utils/phone');
  let value = phone;
  const parsed = validateE164(value);
  if (!parsed) {
    const countryCode = await getDefaultCountryCode();
    value = normalizePhone(value, countryCode);
    if (!validateE164(value)) return { error: 'Invalid phone number format.' };
  } else {
    value = parsed.phone_e164;
  }
  return { type: 'phone', value, authMode };
}

/** Look up an existing tenant-admin account by email (email-mode login). */
async function findTenantAdminByEmail(email) {
  const [rows] = await db.execute(
    `SELECT e.id AS employee_id, e.email, e.phone, e.role, e.status,
            e.first_name, e.last_name, e.password_hash, e.tenant_id,
            t.company_name, t.subdomain, t.subscription_plan, t.subscription_status,
            t.start_date, t.expiry_date, t.settings, t.organization_id, t.phone AS tenant_phone
     FROM employees e
     JOIN tenants t ON t.id = e.tenant_id
     WHERE lower(e.email) = lower(?) AND e.role = 'tenant_admin'
     ORDER BY (t.organization_id IS NULL) DESC, t.created_at ASC
     LIMIT 1`,
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  getAuthMode,
  refreshAuthModeCache,
  normalizeEmail,
  isValidEmail,
  getDefaultCountryCode,
  normalizePhone,
  resolveAuthIdentifier,
  findTenantAdminByEmail,
};