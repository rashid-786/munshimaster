const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { parseGstr2b, autoMatchItems } = require('../utils/gstr2bParser');

exports.upload = async (req, res) => {
  const tenantId = req.tenantId;
  const { period, jsonData } = req.body;

  if (!period || !jsonData) {
    return res.status(400).json({ error: 'period (MMYYYY) and jsonData are required.' });
  }

  try {
    const importId = uuidv4();
    const rawJson = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
    const parsed = JSON.parse(rawJson);

    const { items, sectionSummary } = parseGstr2b(parsed, tenantId, importId);

    if (items.length === 0) {
      return res.status(400).json({ error: 'No recognizable GSTR-2B entries found in the JSON.' });
    }

    const [pos] = await db.query(
      `SELECT po.id, po.po_number, po.total_amount, s.gstin as supplier_gstin
       FROM hris_saas.purchase_orders po
       JOIN hris_saas.suppliers s ON po.supplier_id = s.id
       WHERE po.tenant_id = $1 AND po.status NOT IN ('draft', 'cancelled')`,
      [tenantId]
    );

    const { items: matchedItems, matched, unmatched, ambiguous } = autoMatchItems(items, pos);

    await db.query(
      `INSERT INTO hris_saas.gstr2b_imports (id, tenant_id, period, filename, file_size, section_summary, stats, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [importId, tenantId, period, req.body.filename || 'GSTR-2B.json', rawJson.length,
       JSON.stringify(sectionSummary),
       JSON.stringify({ total: items.length, matched, unmatched, ambiguous })]
    );

    for (const item of matchedItems) {
      await db.query(
        `INSERT INTO hris_saas.gstr2b_items (id, import_id, tenant_id, section_type, supplier_gstin, supplier_name,
         invoice_number, invoice_date, total_value, taxable_value, igst, cgst, sgst, cess,
         match_status, matched_po_id, matched_po_number, matched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [item.id, item.import_id, item.tenant_id, item.section_type, item.supplier_gstin, item.supplier_name,
         item.invoice_number, item.invoice_date, item.total_value, item.taxable_value,
         item.igst, item.cgst, item.sgst, item.cess,
         item.match_status, item.matched_po_id, item.matched_po_number, item.matched_at]
      );
    }

    res.json({
      message: `GSTR-2B imported. ${items.length} entries processed.`,
      importId,
      stats: { total: items.length, matched, unmatched, ambiguous },
      sectionSummary,
    });
  } catch (error) {
    console.error('GSTR-2B upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to process GSTR-2B data.' });
  }
};

exports.getImports = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const [rows] = await db.query(
      `SELECT id, period, filename, stats, section_summary, uploaded_at
       FROM hris_saas.gstr2b_imports
       WHERE tenant_id = $1
       ORDER BY uploaded_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch GSTR-2B imports.' });
  }
};

exports.getItems = async (req, res) => {
  const tenantId = req.tenantId;
  const { importId, matchStatus, section, page = 1, limit = 50 } = req.query;

  try {
    let where = 'WHERE i.tenant_id = $1';
    const params = [tenantId];
    let paramIdx = 2;

    if (importId) {
      where += ` AND i.import_id = $${paramIdx++}`;
      params.push(importId);
    }
    if (matchStatus) {
      where += ` AND i.match_status = $${paramIdx++}`;
      params.push(matchStatus);
    }
    if (section) {
      where += ` AND i.section_type = $${paramIdx++}`;
      params.push(section);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    where += ` ORDER BY i.invoice_date DESC NULLS LAST LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit), offset);

    const [rows] = await db.query(
      `SELECT i.* FROM hris_saas.gstr2b_items i ${where}`, params
    );

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM hris_saas.gstr2b_items i WHERE i.tenant_id = $1`, [tenantId]
    );

    res.json({ data: rows, total: parseInt(countResult[0]?.total || 0), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('GSTR-2B items error:', error);
    res.status(500).json({ error: 'Failed to fetch GSTR-2B items.' });
  }
};

exports.matchItem = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { poId } = req.body;

  if (!poId) return res.status(400).json({ error: 'poId is required.' });

  try {
    const [items] = await db.query(
      `SELECT * FROM hris_saas.gstr2b_items WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (items.length === 0) return res.status(404).json({ error: 'Item not found.' });

    const [pos] = await db.query(
      `SELECT po.po_number FROM hris_saas.purchase_orders po WHERE po.id = $1 AND po.tenant_id = $2`,
      [poId, tenantId]
    );
    if (pos.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });

    await db.query(
      `UPDATE hris_saas.gstr2b_items
       SET match_status = 'matched', matched_po_id = $1, matched_po_number = $2, matched_at = NOW()
       WHERE id = $3`,
      [poId, pos[0].po_number, id]
    );

    res.json({ message: 'Item matched successfully.', matchStatus: 'matched', poNumber: pos[0].po_number });
  } catch (error) {
    res.status(500).json({ error: 'Failed to match item.' });
  }
};

exports.unmatchItem = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    await db.query(
      `UPDATE hris_saas.gstr2b_items
       SET match_status = 'unmatched', matched_po_id = NULL, matched_po_number = NULL, matched_at = NULL
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    res.json({ message: 'Item unmatched.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unmatch item.' });
  }
};

exports.deleteImport = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM hris_saas.gstr2b_imports WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    res.json({ message: 'Import deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete import.' });
  }
};

exports.stats = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const [totals] = await db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE match_status = 'matched') as matched,
        COUNT(*) FILTER (WHERE match_status = 'unmatched') as unmatched,
        COUNT(*) FILTER (WHERE match_status = 'ambiguous') as ambiguous
       FROM hris_saas.gstr2b_items WHERE tenant_id = $1`,
      [tenantId]
    );

    const [availablePos] = await db.query(
      `SELECT COUNT(*) as total FROM hris_saas.purchase_orders
       WHERE tenant_id = $1 AND status NOT IN ('draft', 'cancelled')`,
      [tenantId]
    );

    res.json({
      items: totals[0] || { total: 0, matched: 0, unmatched: 0, ambiguous: 0 },
      purchaseOrders: parseInt(availablePos[0]?.total || 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};
