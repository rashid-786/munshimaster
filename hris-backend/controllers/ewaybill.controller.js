const db = require('../config/db');
const { buildEwaybillPayload, generateEwaybill, cancelEwaybill, getEwaybillStatus } = require('../utils/ewaybill');
const { getSellerCredentials } = require('../utils/einvoice');
const { log } = require('../utils/audit');

exports.generate = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const transport = req.body || {};

  try {
    const [inv] = await db.query(
      `SELECT i.* FROM hris_saas.invoices i WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = inv[0];
    if (invoice.ewaybill_number) {
      return res.status(400).json({ error: 'E-Way Bill already generated.', ewbNo: invoice.ewaybill_number });
    }

    const seller = await getSellerCredentials(tenantId);
    if (!seller || !seller.sellerGstin) {
      return res.status(400).json({ error: 'Seller GSTIN not configured. Update your business settings first.' });
    }

    const [cust] = await db.query(
      `SELECT * FROM hris_saas.customers WHERE id = $1 AND tenant_id = $2`,
      [invoice.customer_id, tenantId]
    );
    if (cust.length === 0) return res.status(400).json({ error: 'Customer not found.' });

    const [items] = await db.query(
      `SELECT * FROM hris_saas.invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [id]
    );
    if (items.length === 0) return res.status(400).json({ error: 'Invoice has no items.' });

    const payload = buildEwaybillPayload(invoice, items, seller, cust[0], transport);

    const credentials = {
      gstin: seller.irpGstin || seller.sellerGstin,
      username: seller.irpUsername || '',
      clientId: seller.irpClientId || '',
      clientSecret: seller.irpClientSecret || '',
    };

    const result = await generateEwaybill(payload, transport, credentials);

    await db.query(
      `UPDATE hris_saas.invoices
       SET ewaybill_number = $1, ewaybill_generated_at = $2, ewaybill_valid_upto = $3,
           transporter_name = $4, transporter_gstin = $5, transporter_vehicle_number = $6,
           transporter_doc_number = $7, transporter_doc_date = $8
       WHERE id = $9`,
      [result.ewbNo, new Date().toISOString(), result.ewbValidTill || null,
       transport.transporterName || null, transport.transporterGstin || null,
       transport.vehicleNumber || null, transport.transportDocNumber || null,
       transport.transportDocDate || null, id]
    );

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: 'ewaybill.generated', entityType: 'invoice', entityId: id,
      changes: { ewbNo: result.ewbNo }, req,
    });

    res.json({
      message: 'E-Way Bill generated successfully.',
      ewbNo: result.ewbNo,
      ewbGeneratedAt: result.ewbDt,
      ewbValidTill: result.ewbValidTill,
    });
  } catch (error) {
    console.error('E-Way Bill generate error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate e-way bill.' });
  }
};

exports.cancel = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.length < 3) {
    return res.status(400).json({ error: 'Cancel reason is required (min 3 chars).' });
  }

  try {
    const [inv] = await db.query(
      `SELECT i.* FROM hris_saas.invoices i WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = inv[0];
    if (!invoice.ewaybill_number) return res.status(400).json({ error: 'No e-way bill to cancel.' });

    const seller = await getSellerCredentials(tenantId);
    const credentials = {
      gstin: seller.irpGstin || seller.sellerGstin,
      username: seller.irpUsername || '',
      clientId: seller.irpClientId || '',
      clientSecret: seller.irpClientSecret || '',
    };

    await cancelEwaybill(invoice.ewaybill_number, reason, credentials);

    await db.query(
      `UPDATE hris_saas.invoices SET ewaybill_number = NULL, ewaybill_generated_at = NULL, ewaybill_valid_upto = NULL WHERE id = $1`,
      [id]
    );

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: 'ewaybill.cancelled', entityType: 'invoice', entityId: id,
      changes: { ewbNo: invoice.ewaybill_number, reason }, req,
    });

    res.json({ message: 'E-Way Bill cancelled successfully.' });
  } catch (error) {
    console.error('E-Way Bill cancel error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel e-way bill.' });
  }
};

exports.status = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT ewaybill_number, ewaybill_generated_at, ewaybill_valid_upto,
              transporter_name, transporter_vehicle_number
       FROM hris_saas.invoices WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const data = inv[0];
    if (!data.ewaybill_number) {
      return res.json({ ewbNo: null, message: 'No e-way bill generated yet.' });
    }

    res.json({
      ewbNo: data.ewaybill_number,
      generatedAt: data.ewaybill_generated_at,
      validTill: data.ewaybill_valid_upto,
      transporterName: data.transporter_name,
      vehicleNumber: data.transporter_vehicle_number,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch e-way bill status.' });
  }
};
