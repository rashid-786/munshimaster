const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.getSections = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM hris_saas.tds_masters WHERE is_active = true ORDER BY section`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch TDS sections.' });
  }
};

exports.getDeductions = async (req, res) => {
  const tenantId = req.tenantId;
  const { page = 1, limit = 50, status, period, section } = req.query;

  try {
    let where = 'WHERE d.tenant_id = $1';
    const params = [tenantId];
    let idx = 2;

    if (status) { where += ` AND d.status = $${idx++}`; params.push(status); }
    if (period) { where += ` AND d.tds_period = $${idx++}`; params.push(period); }
    if (section) { where += ` AND d.section = $${idx++}`; params.push(section); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    where += ` ORDER BY d.deduction_date DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(`SELECT d.* FROM hris_saas.tds_deductions d ${where}`, params);
    const [total] = await db.query(
      `SELECT COUNT(*) as count FROM hris_saas.tds_deductions WHERE tenant_id = $1`, [tenantId]
    );

    res.json({ data: rows, total: parseInt(total[0]?.count || 0), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('TDS deductions error:', error);
    res.status(500).json({ error: 'Failed to fetch deductions.' });
  }
};

exports.createDeduction = async (req, res) => {
  const tenantId = req.tenantId;
  const { entityType, entityId, entityName, entityGstin, entityPan,
    section, invoiceNumber, invoiceAmount, tdsRate, deductionDate, notes } = req.body;

  if (!section || !invoiceAmount || !deductionDate) {
    return res.status(400).json({ error: 'section, invoiceAmount, and deductionDate are required.' });
  }

  const { computeTds, getTdsPeriod } = require('../utils/tdsCalculator');
  const result = computeTds(parseFloat(invoiceAmount), section, parseFloat(tdsRate || 0));

  try {
    const id = uuidv4();
    const period = getTdsPeriod(deductionDate);

    await db.query(
      `INSERT INTO hris_saas.tds_deductions (id, tenant_id, entity_type, entity_id, entity_name, entity_gstin, entity_pan,
        section, invoice_number, invoice_amount, tds_amount, tds_rate, deduction_date, tds_period, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, tenantId, entityType || 'supplier', entityId || null, entityName || null,
       entityGstin || null, entityPan || null, section, invoiceNumber || null,
       parseFloat(invoiceAmount), result.tdsAmount, result.tdsRate,
       deductionDate, period, notes || null]
    );

    res.json({ message: 'TDS deduction recorded.', id, tdsAmount: result.tdsAmount, tdsRate: result.tdsRate });
  } catch (error) {
    console.error('TDS create error:', error);
    res.status(500).json({ error: 'Failed to create deduction.' });
  }
};

exports.updateDeduction = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { invoiceAmount, tdsRate, deductionDate, notes, status } = req.body;

  try {
    const [existing] = await db.query(
      `SELECT * FROM hris_saas.tds_deductions WHERE id = $1 AND tenant_id = $2`, [id, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Deduction not found.' });

    const { computeTds, getTdsPeriod } = require('../utils/tdsCalculator');
    const amount = parseFloat(invoiceAmount ?? existing[0].invoice_amount);
    const rate = parseFloat(tdsRate ?? existing[0].tds_rate);
    const section = existing[0].section;
    const result = computeTds(amount, section, rate);
    const period = deductionDate ? getTdsPeriod(deductionDate) : existing[0].tds_period;

    await db.query(
      `UPDATE hris_saas.tds_deductions SET invoice_amount = $1, tds_amount = $2, tds_rate = $3,
        deduction_date = $4, tds_period = $5, notes = $6, status = $7, updated_at = NOW()
       WHERE id = $8`,
      [amount, result.tdsAmount, result.tdsRate, deductionDate || existing[0].deduction_date,
       period, notes ?? existing[0].notes, status || existing[0].status, id]
    );

    res.json({ message: 'Deduction updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update deduction.' });
  }
};

exports.deleteDeduction = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM hris_saas.tds_deductions WHERE id = $1 AND tenant_id = $2`, [id, tenantId]
    );
    res.json({ message: 'Deduction deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete deduction.' });
  }
};

exports.getChallans = async (req, res) => {
  const tenantId = req.tenantId;
  const { page = 1, limit = 50 } = req.query;

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [rows] = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM hris_saas.tds_deductions WHERE challan_id = c.id AND tenant_id = $1) as linked_deductions
       FROM hris_saas.tds_challans c WHERE c.tenant_id = $1
       ORDER BY c.deposit_date DESC LIMIT $2 OFFSET $3`,
      [tenantId, parseInt(limit), offset]
    );

    const [total] = await db.query(
      `SELECT COUNT(*) as count FROM hris_saas.tds_challans WHERE tenant_id = $1`, [tenantId]
    );

    res.json({ data: rows, total: parseInt(total[0]?.count || 0), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch challans.' });
  }
};

exports.createChallan = async (req, res) => {
  const tenantId = req.tenantId;
  const { challanNumber, bsrCode, depositDate, amount, tdsPeriod, notes } = req.body;

  if (!challanNumber || !depositDate || !amount) {
    return res.status(400).json({ error: 'challanNumber, depositDate, and amount are required.' });
  }

  try {
    const id = uuidv4();
    const period = tdsPeriod || (() => { const d = new Date(depositDate); const q = Math.ceil((d.getMonth()+1)/3); return `Q${q}${String(d.getFullYear()).slice(-2)}`; })();

    await db.query(
      `INSERT INTO hris_saas.tds_challans (id, tenant_id, challan_number, bsr_code, deposit_date, amount, tds_period, major_head, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, tenantId, challanNumber, bsrCode || null, depositDate, parseFloat(amount), period, '0020', notes || null]
    );

    res.json({ message: 'Challan recorded.', id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create challan.' });
  }
};

exports.linkChallan = async (req, res) => {
  const tenantId = req.tenantId;
  const { deductionId, challanId } = req.body;

  if (!deductionId || !challanId) return res.status(400).json({ error: 'deductionId and challanId required.' });

  try {
    await db.query(
      `UPDATE hris_saas.tds_deductions SET challan_id = $1, status = 'deposited', updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [challanId, deductionId, tenantId]
    );
    res.json({ message: 'Deduction linked to challan.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to link challan.' });
  }
};

exports.summary = async (req, res) => {
  const tenantId = req.tenantId;
  const { period } = req.query;

  try {
    let where = 'WHERE d.tenant_id = $1';
    const params = [tenantId];

    if (period) { where += ` AND d.tds_period = $2`; params.push(period); }

    const [bySection] = await db.query(
      `SELECT d.section, COUNT(*) as count, SUM(d.invoice_amount) as total_invoice,
              SUM(d.tds_amount) as total_tds
       FROM hris_saas.tds_deductions d ${where}
       GROUP BY d.section ORDER BY d.section`, params
    );

    const [totals] = await db.query(
      `SELECT COUNT(*) as total_deductions, SUM(tds_amount) as total_tds
       FROM hris_saas.tds_deductions d ${where}`, params
    );

    const [challanTotal] = await db.query(
      `SELECT SUM(amount) as total_deposited
       FROM hris_saas.tds_challans WHERE tenant_id = $1
       ${period ? 'AND tds_period = $2' : ''}`,
      period ? [tenantId, period] : [tenantId]
    );

    const [totalPending] = await db.query(
      `SELECT SUM(tds_amount) as pending
       FROM hris_saas.tds_deductions WHERE tenant_id = $1 AND status = 'deducted'
       ${period ? 'AND tds_period = $2' : ''}`,
      period ? [tenantId, period] : [tenantId]
    );

    res.json({
      summary: {
        totalDeductions: parseInt(totals[0]?.total_deductions || 0),
        totalTds: parseFloat(totals[0]?.total_tds || 0),
        totalDeposited: parseFloat(challanTotal[0]?.total_deposited || 0),
        pendingDeposit: parseFloat(totalPending[0]?.pending || 0),
      },
      bySection: bySection || [],
    });
  } catch (error) {
    console.error('TDS summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary.' });
  }
};
