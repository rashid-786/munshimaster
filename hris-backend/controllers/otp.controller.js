const db = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpSms(phone, otp) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    console.log(`\n========================================`);
    console.log(`📱 [DEV] OTP for ${phone}: ${otp}`);
    console.log(`========================================\n`);
  }

  if (accountSid && authToken && fromPhone) {
    try {
      const client = require('twilio')(accountSid, authToken);
      const message = await client.messages.create({
        body: `${otp} is the OTP to verify your account on Munshi Master.`,
        from: '+18604316626',
        to: phone
      });
      console.log(`📱 Twilio SMS sent: ${message.sid}`);
    } catch (err) {
      console.error(`❌ Twilio SMS failed for ${phone}:`, err.message);
    }
  } else {
    console.log(`📱 [FALLBACK] SMS not configured — OTP would be sent via SMS in production.`);
  }
}

exports.sendOtp = async (req, res) => {
  let { phone, purpose = 'registration' } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const parsed = validateE164(phone);
  if (!parsed) {
    const countryCode = await getDefaultCountryCode();
    phone = normalizePhone(phone, countryCode);
    if (!validateE164(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }
  } else {
    phone = parsed.phone_e164;
  }

  if (purpose === 'registration') {
    const [existing] = await db.execute(
      'SELECT id FROM tenants WHERE phone = ?',
      [phone]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'This phone number is already registered. Please sign in.' });
    }
  }

  try {
    // Remove old unverified OTPs for this phone+purpose
    await db.execute(
      'DELETE FROM otp_verifications WHERE phone = ? AND purpose = ? AND verified = false AND expires_at > NOW()',
      [phone, purpose]
    );

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    await db.execute(
      'INSERT INTO otp_verifications (phone, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [phone, otp, purpose, expiresAt]
    );

    await sendOtpSms(phone, otp);

    const isDev = process.env.NODE_ENV !== 'production';
    res.json({ message: 'OTP sent successfully.', retryAfter: 30, ...(isDev && { otp }) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
};

exports.verifyOtp = async (req, res) => {
  let { phone, otp, purpose = 'registration' } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required.' });
  }

  const parsed = validateE164(phone);
  if (!parsed) {
    const countryCode = await getDefaultCountryCode();
    phone = normalizePhone(phone, countryCode);
  } else {
    phone = parsed.phone_e164;
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM otp_verifications WHERE phone = ? AND purpose = ? AND otp = ? AND verified = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [phone, purpose, otp]
    );

    if (rows.length === 0) {
      // Check if expired
      const [expired] = await db.execute(
        'SELECT id FROM otp_verifications WHERE phone = ? AND purpose = ? AND otp = ? AND verified = false AND expires_at <= NOW() LIMIT 1',
        [phone, purpose, otp]
      );
      if (expired.length > 0) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // Mark OTP as verified
    await db.execute(
      'UPDATE otp_verifications SET verified = true WHERE id = ?',
      [rows[0].id]
    );

    // If this phone belongs to an existing account, issue a token so the OTP
    // acts as a proper login (mirrors the /auth/login response shape).
    const [tenants] = await db.execute(
      'SELECT id, company_name, subdomain, subscription_plan, subscription_status, start_date, expiry_date, phone, settings FROM tenants WHERE phone = ?',
      [phone]
    );

    if (tenants.length > 0) {
      const tenant = tenants[0];
      const [users] = await db.execute(
        'SELECT * FROM employees WHERE phone = ? AND tenant_id = ? LIMIT 1',
        [phone, tenant.id]
      );
      if (users.length > 0) {
        const user = users[0];
        if (user.status !== 'deactivated') {
          const userName = `${user.first_name} ${user.last_name}`.trim() || 'User';
          const token = jwt.sign(
            { id: user.id, tenantId: user.tenant_id, role: user.role, name: userName },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
          );
          const parsedSettings = typeof tenant.settings === 'string'
            ? JSON.parse(tenant.settings)
            : (tenant.settings || {});
          const defaultCountryCode = await getDefaultCountryCode();

          return res.json({
            message: 'OTP verified successfully.',
            verified: true,
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
              subdomain: tenant.subdomain || null,
              subscriptionPlan: tenant.subscription_plan || 'free',
              subscriptionStatus: tenant.subscription_status || 'active',
              startDate: tenant.start_date || null,
              expiryDate: tenant.expiry_date || null,
              phone: tenant.phone || null,
              settings: parsedSettings || { primaryColor: '#0052cc' },
            },
            defaultCountryCode,
          });
        }
      }
    }

    res.json({ message: 'OTP verified successfully.', verified: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
};
