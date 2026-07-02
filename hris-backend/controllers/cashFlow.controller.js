const db = require('../config/db');
const { getCashFlow } = require('../utils/cashFlow');

exports.get = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD).' });

  try {
    const [tenant] = await db.query(
      `SELECT company_name FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    const companyName = tenant[0]?.company_name || 'My Business';

    const data = await getCashFlow(tenantId, from, to);
    res.json({ companyName, ...data });
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({ error: 'Failed to generate cash flow statement.' });
  }
};
