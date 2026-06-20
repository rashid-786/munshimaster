const db = require('../config/db');

const PLAN_FEATURES = {
  free: ['ledger'],
  pro: ['ledger', 'business'],
  enterprise: ['ledger', 'business', 'staff'],
};

exports.getPlans = (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        features: ['My Ledger Book (Buyers, Sellers, Cashbook, Reports)'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 0,
        features: ['Everything in Free', 'Business (Suppliers, Customers, Purchase Orders, Invoices, Balance Sheet, Reports)'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 0,
        features: ['Everything in Pro', 'Staff Management (Directory, Attendance, Leaves, Payroll, Advances)'],
      },
    ],
  });
};

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

exports.selectPlan = async (req, res) => {
  const tenantId = req.tenantId;
  const { plan, phone } = req.body;
  const countryCode = await getDefaultCountryCode();
  const normalizedPhone = phone ? normalizePhone(phone, countryCode) : '';

  if (!plan || !PLAN_FEATURES[plan]) {
    return res.status(400).json({ error: 'Invalid plan selected.' });
  }

  if (!normalizedPhone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    await db.execute(
      'UPDATE tenants SET subscription_plan = ?, phone = ? WHERE id = ?',
      [plan, normalizedPhone, tenantId]
    );
    res.json({ message: `Plan updated to ${plan}.`, plan, phone: normalizedPhone });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update plan.' });
  }
};

exports.getSubscription = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const [rows] = await db.execute(
      'SELECT subscription_plan, company_name, phone FROM tenants WHERE id = ?',
      [tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const tenant = rows[0];
    res.json({
      plan: tenant.subscription_plan || 'free',
      features: PLAN_FEATURES[tenant.subscription_plan || 'free'],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch subscription.' });
  }
};

exports.getProfileCompletion = async (req, res) => {
  const tenantId = req.tenantId;
  const employeeId = req.user.id;

  try {
    const [tenantRows] = await db.execute(
      'SELECT company_name, phone FROM tenants WHERE id = ?',
      [tenantId]
    );
    const [empRows] = await db.execute(
      'SELECT first_name, last_name, email FROM employees WHERE id = ? AND tenant_id = ?',
      [employeeId, tenantId]
    );

    if (tenantRows.length === 0 || empRows.length === 0) {
      return res.status(404).json({ error: 'Not found.' });
    }

    const tenant = tenantRows[0];
    const emp = empRows[0];

    const checks = [
      { field: 'company_name', label: 'Company Name', filled: !!tenant.company_name },
      { field: 'first_name', label: 'First Name', filled: !!emp.first_name },
      { field: 'last_name', label: 'Last Name', filled: !!emp.last_name },
      { field: 'email', label: 'Email', filled: !!emp.email },
      { field: 'phone', label: 'Phone Number', filled: !!tenant.phone },
    ];

    const filled = checks.filter(c => c.filled).length;
    const total = checks.length;
    const percent = Math.round((filled / total) * 100);

    res.json({ percent, filled, total, checks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate profile completion.' });
  }
};
