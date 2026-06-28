const db = require('../config/db');
const { getGstr1Data, buildGstr1Json, getGstr3bSummary } = require('../utils/gstReturns');

exports.getGstr1 = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD).' });

  try {
    const [tenant] = await db.query(
      `SELECT company_name, settings FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const settings = typeof tenant[0].settings === 'string' ? JSON.parse(tenant[0].settings) : (tenant[0].settings || {});
    const sellerGstin = settings.sellerGstin || '';
    const sellerLegalName = settings.sellerLegalName || tenant[0].company_name || '';

    const period = from.replace(/-/g, '') + to.replace(/-/g, '');
    const data = await getGstr1Data(tenantId, from, to);
    const gstr1 = buildGstr1Json(data, sellerGstin, sellerLegalName, period);

    res.json({
      period: { from, to },
      summary: {
        b2bCount: data.b2b.length,
        b2cCount: data.b2c.length,
        creditNoteCount: data.cnB2b.length,
        totalInvoices: data.b2b.length + data.b2c.length,
      },
      gstr1,
      seller: { gstin: sellerGstin, legalName: sellerLegalName },
    });
  } catch (error) {
    console.error('GSTR-1 error:', error);
    res.status(500).json({ error: 'Failed to generate GSTR-1 data.' });
  }
};

exports.downloadGstr1Json = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from and to dates required.' });

  try {
    const [tenant] = await db.query(
      `SELECT company_name, settings FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const settings = typeof tenant[0].settings === 'string' ? JSON.parse(tenant[0].settings) : (tenant[0].settings || {});
    const sellerGstin = settings.sellerGstin || '';
    const sellerLegalName = settings.sellerLegalName || tenant[0].company_name || '';
    const period = from.replace(/-/g, '') + to.replace(/-/g, '');

    const data = await getGstr1Data(tenantId, from, to);
    const gstr1 = buildGstr1Json(data, sellerGstin, sellerLegalName, period);

    const filename = `GSTR1_${sellerGstin}_${from}_${to}.json`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/json');
    res.json(gstr1);
  } catch (error) {
    console.error('GSTR-1 download error:', error);
    res.status(500).json({ error: 'Failed to generate GSTR-1 file.' });
  }
};

exports.getGstr3b = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;

  if (!from || !to) return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD).' });

  try {
    const summary = await getGstr3bSummary(tenantId, from, to);
    res.json(summary);
  } catch (error) {
    console.error('GSTR-3B error:', error);
    res.status(500).json({ error: 'Failed to generate GSTR-3B summary.' });
  }
};
