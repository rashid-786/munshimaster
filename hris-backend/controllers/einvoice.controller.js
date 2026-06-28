const db = require('../config/db');
const { buildEinvoicePayload, generateIRN, cancelIRN, getIRNStatus, getSellerCredentials } = require('../utils/einvoice');
const { log } = require('../utils/audit');

exports.generate = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT i.* FROM hris_saas.invoices i WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = inv[0];
    if (invoice.irn) {
      return res.status(400).json({ error: 'E-Invoice already generated.', irn: invoice.irn });
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

    const payload = buildEinvoicePayload(invoice, items, seller, cust[0]);

    const credentials = {
      gstin: seller.irpGstin || seller.sellerGstin,
      username: seller.irpUsername || '',
      password: '',
      clientId: seller.irpClientId || '',
      clientSecret: seller.irpClientSecret || '',
    };

    const result = await generateIRN(payload, credentials);

    await db.query(
      `UPDATE hris_saas.invoices
       SET irn = $1, irn_generated_at = $2, ack_no = $3, ack_date = $4,
           signed_invoice = $5, signed_qr_code = $6
       WHERE id = $7`,
      [result.irn, new Date().toISOString(), result.ackNo || null,
       result.ackDt ? new Date(result.ackDt).toISOString() : null,
       result.signedInvoice || null, result.signedQRCode || null, id]
    );

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: 'einvoice.generated', entityType: 'invoice', entityId: id,
      changes: { irn: result.irn }, req,
    });

    res.json({
      message: 'E-Invoice generated successfully.',
      irn: result.irn,
      ackNo: result.ackNo,
      ackDate: result.ackDt,
      signedQrCode: result.signedQRCode,
    });
  } catch (error) {
    console.error('Einvoice generate error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate e-invoice.' });
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
    if (!invoice.irn) return res.status(400).json({ error: 'No e-invoice to cancel.' });
    if (invoice.irn_cancel_date) return res.status(400).json({ error: 'E-Invoice already cancelled.' });

    const seller = await getSellerCredentials(tenantId);
    const credentials = {
      gstin: seller.irpGstin || seller.sellerGstin,
      username: seller.irpUsername || '',
      password: '',
      clientId: seller.irpClientId || '',
      clientSecret: seller.irpClientSecret || '',
    };

    await cancelIRN(invoice.irn, reason, credentials);

    await db.query(
      `UPDATE hris_saas.invoices SET irn_cancel_date = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: 'einvoice.cancelled', entityType: 'invoice', entityId: id,
      changes: { irn: invoice.irn, reason }, req,
    });

    res.json({ message: 'E-Invoice cancelled successfully.' });
  } catch (error) {
    console.error('Einvoice cancel error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel e-invoice.' });
  }
};

exports.status = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT irn, irn_generated_at, ack_no, ack_date, irn_cancel_date FROM hris_saas.invoices WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    res.json(inv[0].irn
      ? {
          irn: inv[0].irn,
          generatedAt: inv[0].irn_generated_at,
          ackNo: inv[0].ack_no,
          ackDate: inv[0].ack_date,
          cancelled: !!inv[0].irn_cancel_date,
          cancelDate: inv[0].irn_cancel_date,
        }
      : { irn: null, message: 'No e-invoice generated yet.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch e-invoice status.' });
  }
};

exports.getQrCode = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT signed_qr_code FROM hris_saas.invoices WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    if (!inv[0].signed_qr_code) return res.status(404).json({ error: 'No QR code available.' });

    res.json({ qrCode: inv[0].signed_qr_code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QR code.' });
  }
};
