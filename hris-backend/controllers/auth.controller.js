const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { validateE164 } = require('../utils/phone');

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

function generateSubdomain() {
  return 't' + crypto.randomBytes(4).toString('hex');
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// 1. REGISTER (phone-only, after OTP verification)
exports.registerTenant = async (req, res) => {
  let { phone, referralCode } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  let countryCode;

  const parsed = validateE164(phone);
  if (!parsed) {
    countryCode = await getDefaultCountryCode();
    phone = normalizePhone(phone, countryCode);
  } else {
    countryCode = parsed.calling_code;
    phone = parsed.phone_e164;
  }

  if (!validateE164(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format.' });
  }

  // Ensure OTP was verified before registration
  const [otpCheck] = await db.execute(
    'SELECT id FROM otp_verifications WHERE phone = ? AND purpose = ? AND verified = true AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [phone, 'registration']
  );
  if (otpCheck.length === 0) {
    return res.status(400).json({ error: 'Please verify your phone number first via OTP.' });
  }

  const [existing] = await db.execute('SELECT id FROM tenants WHERE phone = ?', [phone]);
  if (existing.length > 0) {
    return res.status(400).json({ error: 'This phone is already registered. Please sign in.' });
  }

  const tenantId = uuidv4();
  const employeeId = uuidv4();
  const subdomain = generateSubdomain();
  const rawPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  try {
    await db.query('START TRANSACTION');

    await db.execute(
      'INSERT INTO tenants (id, company_name, subdomain, subscription_plan, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [tenantId, '', subdomain, 'free', phone]
    );

    await db.execute(
      'INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, tenantId, 'User', '', `${phone}@placeholder.local`, phone, hashedPassword, 'tenant_admin', 0]
    );

    await db.query('COMMIT');

    // Apply referral code if provided (non-blocking)
    if (referralCode) {
      try {
        const { logConversionEvent } = require('./retention.controller');
        const [refRows] = await db.execute(
          'SELECT id, tenant_id FROM referral_codes WHERE code = ?', [referralCode]
        );
        if (refRows.length > 0 && refRows[0].tenant_id !== tenantId) {
          const redemptionId = uuidv4();
          await db.execute(
            `INSERT INTO referral_redemptions (id, referrer_id, referred_id, reward_months, status)
             VALUES (?, ?, ?, 1, 'pending')`,
            [redemptionId, refRows[0].tenant_id, tenantId]
          );
          logConversionEvent({
            tenantId,
            event: 'subscribed',
            planTo: 'free',
            source: 'referral',
            metadata: { referrerId: refRows[0].tenant_id },
          });
        }
      } catch (refErr) {
        console.error('[Referral] Failed to apply referral code:', refErr.message);
      }
    }

    res.status(201).json({
      message: 'Account created successfully!',
      tenant: { id: tenantId, subdomain },
      credentials: { phone, password: rawPassword },
      defaultCountryCode: countryCode,
      referralApplied: !!referralCode,
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Registration failed.' });
  }
};

// 2. LOGIN (phone + password, subdomain optional)
exports.loginEmployee = async (req, res) => {
  const { email, password, subdomain } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    let tenantId;
    let tenant;
    const countryCode = await getDefaultCountryCode();

    if (subdomain) {
      const [rows] = await db.execute(
        'SELECT id, company_name, subdomain, subscription_plan, phone, settings FROM tenants WHERE subdomain = ?',
        [subdomain]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });
      tenant = rows[0];
      tenantId = tenant.id;
    } else {
      const isEmail = email.includes('@');
      if (isEmail) return res.status(400).json({ error: 'Please provide your Company ID (Business ID).' });
      const normalizedPhone = normalizePhone(email, countryCode);
      const [rows] = await db.execute(
        'SELECT id, company_name, subdomain, subscription_plan, phone, settings FROM tenants WHERE phone = ?',
        [normalizedPhone]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'No account found with this phone number.' });
      tenant = rows[0];
      tenantId = tenant.id;
    }

    const isEmail = email.includes('@');
    const [users] = await db.execute(
      isEmail
        ? 'SELECT * FROM employees WHERE email = ? AND tenant_id = ?'
        : 'SELECT * FROM employees WHERE phone = ? AND tenant_id = ?',
      [isEmail ? email : normalizePhone(email, countryCode), tenantId]
    );

    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials.' });

    const user = users[0];

    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });

    const defaultCountryCode = await getDefaultCountryCode();

    const parsedSettings = typeof tenant.settings === 'string'
      ? JSON.parse(tenant.settings)
      : (tenant.settings || {});

    const userName = `${user.first_name} ${user.last_name}`.trim() || 'User';
    const token = jwt.sign(
      { id: user.id, tenantId: user.tenant_id, role: user.role, name: userName },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        name: `${user.first_name} ${user.last_name}`.trim() || 'User',
        firstName: user.first_name,
        lastName: user.last_name,
      },
      tenant: {
        id: user.tenant_id,
        name: tenant.company_name,
        subdomain: tenant.subdomain || subdomain,
        subscriptionPlan: tenant.subscription_plan || 'free',
        phone: tenant.phone || null,
        settings: parsedSettings || { primaryColor: '#0052cc' }
      },
      defaultCountryCode
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};

// 3. FORGOT PASSWORD: Reset password via OTP
exports.resetPassword = async (req, res) => {
  const { phone, otp, new_password } = req.body;
  const countryCode = await getDefaultCountryCode();
  const normalizedPhone = normalizePhone(phone, countryCode);

  if (!normalizedPhone || !otp || !new_password) {
    return res.status(400).json({ error: 'Phone, OTP, and new password are required.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const [otpRows] = await db.execute(
      'SELECT id FROM otp_verifications WHERE phone = ? AND purpose = ? AND otp = ? AND verified = true AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [normalizedPhone, 'password_reset', otp]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
    }

    const [tenantRows] = await db.execute('SELECT id FROM tenants WHERE phone = ?', [normalizedPhone]);
    if (tenantRows.length === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const tenantId = tenantRows[0].id;
    const hashedPassword = await bcrypt.hash(new_password, 10);

    await db.execute(
      'UPDATE employees SET password_hash = ? WHERE tenant_id = ? AND phone = ? AND role = ?',
      [hashedPassword, tenantId, normalizedPhone, 'tenant_admin']
    );

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};

// 4. CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const employeeId = req.user.id;
  const tenantId = req.user.tenantId;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const [users] = await db.execute(
      'SELECT password_hash FROM employees WHERE id = ? AND tenant_id = ?',
      [employeeId, tenantId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.execute(
      'UPDATE employees SET password_hash = ? WHERE id = ?',
      [hashedPassword, employeeId]
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
};

// 4. UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  const { first_name, last_name, email, phone } = req.body;
  const employeeId = req.user.id;
  const tenantId = req.user.tenantId;

  if (!first_name || !email) {
    return res.status(400).json({ error: 'First name and email are required.' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE email = ? AND tenant_id = ? AND id != ?',
      [email, tenantId, employeeId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already in use by another employee.' });
    }

    if (phone) {
      const [phoneExists] = await db.execute(
        'SELECT id FROM employees WHERE phone = ? AND tenant_id = ? AND id != ?',
        [phone, tenantId, employeeId]
      );
      if (phoneExists.length > 0) {
        return res.status(400).json({ error: 'Phone already in use by another employee.' });
      }
    }

    await db.execute(
      'UPDATE employees SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ? AND tenant_id = ?',
      [first_name, last_name || '', email, phone || null, employeeId, tenantId]
    );

    res.json({
      message: 'Profile updated.',
      user: { firstName: first_name, lastName: last_name, email, phone, name: `${first_name} ${last_name}` },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};
