const db = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  getDefaultCountryCode,
  resolveAuthIdentifier,
  findTenantAdminByEmail,
} = require('../utils/authConfig');
const { sendEmail, otpEmailHtml } = require('../utils/email');

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
        from: fromPhone,
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

async function sendOtpEmail(email, otp) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    console.log(`\n========================================`);
    console.log(`✉️  [DEV] OTP for ${email}: ${otp}`);
    console.log(`========================================\n`);
  }

  const result = await sendEmail({
    to: email,
    subject: 'Your OTP for bahi360 sign-in',
    html: otpEmailHtml({ otp }),
  });

  if (result && result.sent) {
    console.log(`✉️  OTP email sent to ${email}`);
  } else {
    console.error(`✉️  OTP email failed for ${email}:`, result && result.error);
  }
}

/** Build the login response for an OTP-verified account. */
function buildLoginResponse(user) {
  const parsedSettings = typeof user.settings === 'string'
    ? JSON.parse(user.settings)
    : (user.settings || {});
  const userName = `${user.first_name} ${user.last_name}`.trim() || 'User';
  const token = jwt.sign(
    { id: user.employee_id || user.id, tenantId: user.tenant_id, role: user.role, name: userName },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    message: 'OTP verified successfully.',
    verified: true,
    token,
    user: {
      id: user.employee_id || user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      name: userName,
      firstName: user.first_name,
      lastName: user.last_name,
    },
    tenant: {
      id: user.tenant_id,
      name: user.company_name,
      subdomain: user.subdomain || null,
      subscriptionPlan: user.subscription_plan || 'free',
      subscriptionStatus: user.subscription_status || 'active',
      startDate: user.start_date || null,
      expiryDate: user.expiry_date || null,
      phone: user.tenant_phone || null,
      settings: parsedSettings || { primaryColor: '#0052cc' },
    },
  };
}

exports.sendOtp = async (req, res) => {
  let { purpose = 'registration' } = req.body;

  const resolved = await resolveAuthIdentifier(req.body);
  if (resolved.error) {
    return res.status(400).json({ error: resolved.error });
  }

  const { type, value } = resolved;

  try {
    if (purpose === 'registration') {
      let alreadyRegistered = false;
      if (type === 'email') {
        const existing = await findTenantAdminByEmail(value);
        alreadyRegistered = !!existing;
      } else {
        const [existing] = await db.execute(
          'SELECT id FROM tenants WHERE phone = ?',
          [value]
        );
        alreadyRegistered = existing.length > 0;
      }
      if (alreadyRegistered) {
        return res.status(400).json({
          error: type === 'email'
            ? 'This email is already registered. Please sign in.'
            : 'This phone number is already registered. Please sign in.',
        });
      }
    }

    // Remove old unverified OTPs for this identifier+purpose
    if (type === 'email') {
      await db.execute(
        'DELETE FROM otp_verifications WHERE email = ? AND purpose = ? AND verified = false AND expires_at > NOW()',
        [value, purpose]
      );
    } else {
      await db.execute(
        'DELETE FROM otp_verifications WHERE phone = ? AND purpose = ? AND verified = false AND expires_at > NOW()',
        [value, purpose]
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    if (type === 'email') {
      await db.execute(
        'INSERT INTO otp_verifications (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
        [value, otp, purpose, expiresAt]
      );
      await sendOtpEmail(value, otp);
    } else {
      await db.execute(
        'INSERT INTO otp_verifications (phone, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
        [value, otp, purpose, expiresAt]
      );
      await sendOtpSms(value, otp);
    }

    const isDev = process.env.NODE_ENV !== 'production';
    // Internal testing: return a fixed test OTP when explicitly enabled.
    const testOtp = process.env.ENABLE_TEST_OTP === 'true' ? (process.env.OTP_TEST_CODE || null) : null;
    res.json({
      message: 'OTP sent successfully.',
      retryAfter: 30,
      ...(isDev && { otp }),
      ...(testOtp && { testOtp }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
};

exports.verifyOtp = async (req, res) => {
  let { otp, purpose = 'registration' } = req.body;

  const resolved = await resolveAuthIdentifier(req.body);
  if (resolved.error) {
    return res.status(400).json({ error: resolved.error });
  }

  const { type, value } = resolved;

  if (!otp) {
    return res.status(400).json({ error: 'Phone/email and OTP are required.' });
  }

  try {
    // Internal testing: a fixed OTP (from env) lets testers sign in without
    // real SMS/email. Only active when ENABLE_TEST_OTP=true AND OTP_TEST_CODE is set,
    // so a plain production deploy is unaffected.
    const testOtp = process.env.ENABLE_TEST_OTP === 'true' ? (process.env.OTP_TEST_CODE || null) : null;
    const isTestOtp = !!testOtp && otp === testOtp;

    if (!isTestOtp) {
      const query = type === 'email'
        ? 'SELECT * FROM otp_verifications WHERE email = ? AND purpose = ? AND otp = ? AND verified = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1'
        : 'SELECT * FROM otp_verifications WHERE phone = ? AND purpose = ? AND otp = ? AND verified = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1';
      const [rows] = await db.execute(query, [value, purpose, otp]);

      if (rows.length === 0) {
        // Check if expired
        const expiredQuery = type === 'email'
          ? 'SELECT id FROM otp_verifications WHERE email = ? AND purpose = ? AND otp = ? AND verified = false AND expires_at <= NOW() LIMIT 1'
          : 'SELECT id FROM otp_verifications WHERE phone = ? AND purpose = ? AND otp = ? AND verified = false AND expires_at <= NOW() LIMIT 1';
        const [expired] = await db.execute(expiredQuery, [value, purpose, otp]);
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
    } else {
      // Record a verified OTP row so the registration flow's verified check passes.
      if (type === 'email') {
        await db.execute(
          `INSERT INTO otp_verifications (email, otp, purpose, verified, expires_at)
           VALUES (?, ?, ?, true, NOW() + INTERVAL '10 minutes')
           ON CONFLICT DO NOTHING`,
          [value, testOtp, purpose]
        );
      } else {
        await db.execute(
          `INSERT INTO otp_verifications (phone, otp, purpose, verified, expires_at)
           VALUES (?, ?, ?, true, NOW() + INTERVAL '10 minutes')
           ON CONFLICT DO NOTHING`,
          [value, testOtp, purpose]
        );
      }
    }

    // If this identifier belongs to an existing account, issue a token so the OTP
    // acts as a proper login (mirrors the /auth/login response shape).
    if (type === 'email') {
      const account = await findTenantAdminByEmail(value);
      if (account && account.status !== 'deactivated') {
        const defaultCountryCode = await getDefaultCountryCode();
        const login = buildLoginResponse(account);
        return res.json({ ...login, defaultCountryCode });
      }
    } else {
      const [tenants] = await db.execute(
        'SELECT id, company_name, subdomain, subscription_plan, subscription_status, start_date, expiry_date, phone, settings FROM tenants WHERE phone = ?',
        [value]
      );

      if (tenants.length > 0) {
        const tenant = tenants[0];
        const [users] = await db.execute(
          'SELECT * FROM employees WHERE phone = ? AND tenant_id = ? LIMIT 1',
          [value, tenant.id]
        );
        if (users.length > 0) {
          const user = users[0];
          if (user.status !== 'deactivated') {
            const defaultCountryCode = await getDefaultCountryCode();
            const login = buildLoginResponse({
              employee_id: user.id,
              email: user.email,
              phone: user.phone,
              role: user.role,
              first_name: user.first_name,
              last_name: user.last_name,
              tenant_id: user.tenant_id,
              company_name: tenant.company_name,
              subdomain: tenant.subdomain,
              subscription_plan: tenant.subscription_plan,
              subscription_status: tenant.subscription_status,
              start_date: tenant.start_date,
              expiry_date: tenant.expiry_date,
              settings: tenant.settings,
              tenant_phone: tenant.phone,
            });
            return res.json({ ...login, defaultCountryCode });
          }
        }
      }
    }

    res.json({ message: 'OTP verified successfully.', verified: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
};