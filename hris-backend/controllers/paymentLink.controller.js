const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { createPaymentLink, cancelPaymentLink, fetchPaymentLink, verifyWebhookSignature, buildPaymentLinkEmailHtml } = require('../utils/paymentLink');
const { log } = require('../utils/audit');

exports.generate = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
              t.company_name, t.settings
       FROM hris_saas.invoices i
       JOIN hris_saas.customers c ON i.customer_id = c.id
       JOIN hris_saas.tenants t ON i.tenant_id = t.id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = inv[0];
    if (invoice.payment_link_id && invoice.payment_link_status !== 'cancelled') {
      return res.json({
        message: 'Payment link already exists.',
        paymentLinkId: invoice.payment_link_id,
        paymentLinkUrl: invoice.payment_link_url,
        paymentLinkStatus: invoice.payment_link_status,
      });
    }

    const amount = invoice.total_amount / 100;
    const result = await createPaymentLink({
      amount,
      description: `Invoice ${invoice.invoice_number}`,
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email || '',
      customerPhone: invoice.customer_phone || '',
      invoiceId: id,
      invoiceNumber: invoice.invoice_number,
      tenantId,
      callbackUrl: `${process.env.APP_URL || 'http://localhost:5173'}/admin/invoices`,
    });

    await db.query(
      `UPDATE hris_saas.invoices
       SET payment_link_id = $1, payment_link_url = $2, payment_link_status = $3, payment_link_created_at = $4
       WHERE id = $5`,
      [result.id, result.short_url, result.status, new Date(result.created_at).toISOString(), id]
    );

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: 'payment_link.generated', entityType: 'invoice', entityId: id,
      changes: { paymentLinkId: result.id }, req,
    });

    res.json({
      message: 'Payment link generated.',
      paymentLinkId: result.id,
      paymentLinkUrl: result.short_url,
      paymentLinkStatus: result.status,
    });
  } catch (error) {
    console.error('Payment link generate error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate payment link.' });
  }
};

exports.cancel = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT payment_link_id FROM hris_saas.invoices WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    if (!inv[0].payment_link_id) return res.status(400).json({ error: 'No payment link to cancel.' });

    await cancelPaymentLink(inv[0].payment_link_id);

    await db.query(
      `UPDATE hris_saas.invoices SET payment_link_status = 'cancelled' WHERE id = $1`,
      [id]
    );

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: 'payment_link.cancelled', entityType: 'invoice', entityId: id, req,
    });

    res.json({ message: 'Payment link cancelled.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to cancel payment link.' });
  }
};

exports.webhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = payload.event;

  if (event === 'payment_link.paid') {
    const paymentLink = payload.payload?.payment_link?.entity;
    const payment = payload.payload?.payment?.entity;

    if (!paymentLink || !payment) {
      return res.status(200).json({ status: 'ignored' });
    }

    const invoiceId = paymentLink.notes?.invoice_id;
    const tenantId = paymentLink.notes?.tenant_id;

    if (!invoiceId || !tenantId) {
      console.log('[PaymentLink Webhook] Missing invoice_id or tenant_id in notes');
      return res.status(200).json({ status: 'ignored' });
    }

    try {
      const [inv] = await db.query(
        `SELECT id, status, total_amount, amount_paid FROM hris_saas.invoices WHERE id = $1 AND tenant_id = $2`,
        [invoiceId, tenantId]
      );
      if (inv.length === 0) {
        console.log(`[PaymentLink Webhook] Invoice ${invoiceId} not found`);
        return res.status(200).json({ status: 'ignored' });
      }

      const invoice = inv[0];
      const paymentAmount = (payment.amount || 0) / 100;
      const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
      const newStatus = newAmountPaid >= invoice.total_amount ? 'paid' : 'partial';

      await db.query('BEGIN');

      await db.query(
        `UPDATE hris_saas.invoices
         SET amount_paid = $1, status = $2, payment_link_status = 'paid'
         WHERE id = $3`,
        [newAmountPaid, newStatus, invoiceId]
      );

      const paymentId = uuidv4();
      await db.query(
        `INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, reference, notes)
         VALUES ($1, $2, $3, $4, 'razorpay', $5, $6, $7)`,
        [paymentId, tenantId, invoiceId, payment.amount,
         new Date(payment.created_at * 1000).toISOString().split('T')[0],
         payment.id || paymentLink.id,
         `Paid via Razorpay payment link ${paymentLink.id}`]
      );

      await db.query(
        `INSERT INTO hris_saas.balance_sheet (id, tenant_id, type, payment_method, amount, description, entry_date)
         VALUES ($1, $2, 'IN', 'razorpay', $3, $4, $5)`,
        [uuidv4(), tenantId, payment.amount,
         `Payment received for invoice ${paymentLink.notes?.invoice_number || invoiceId}`,
         new Date().toISOString().split('T')[0]]
      );

      await db.query('COMMIT');

      console.log(`[PaymentLink Webhook] Invoice ${invoiceId} paid (₹${paymentAmount}). Status: ${newStatus}`);
      res.json({ status: 'ok' });
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {});
      console.error('[PaymentLink Webhook] Error:', error.message);
      res.status(200).json({ status: 'error' });
    }
  } else {
    res.status(200).json({ status: 'ignored' });
  }
};
