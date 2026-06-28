const db = require('../config/db');
const { sendWhatsApp, buildInvoiceMessage, buildPOMessage, buildPaymentReminder } = require('../utils/whatsapp');
const { logWhatsApp } = require('../utils/whatsappLogger');

exports.sendInvoice = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT i.*, c.name as customer_name, c.phone as customer_phone,
              t.company_name as tenant_name
       FROM hris_saas.invoices i
       JOIN hris_saas.customers c ON i.customer_id = c.id
       JOIN hris_saas.tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = inv[0];
    if (!invoice.customer_phone) {
      return res.status(400).json({ error: 'Customer has no phone number.' });
    }

    const message = buildInvoiceMessage(invoice, invoice.customer_name, invoice.tenant_name);
    const result = await sendWhatsApp({ to: invoice.customer_phone, body: message });

    await logWhatsApp({
      tenantId,
      entityType: 'invoice',
      entityId: id,
      recipient: invoice.customer_phone,
      message,
      status: result.sent ? 'sent' : 'failed',
      errorMessage: result.error,
    });

    if (result.sent) {
      res.json({ message: 'WhatsApp sent successfully.', status: 'sent' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send WhatsApp.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send WhatsApp.' });
  }
};

exports.sendPurchaseOrder = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [po] = await db.query(
      `SELECT po.*, s.name as supplier_name, s.phone as supplier_phone,
              t.company_name as tenant_name
       FROM hris_saas.purchase_orders po
       JOIN hris_saas.suppliers s ON po.supplier_id = s.id
       JOIN hris_saas.tenants t ON t.id = po.tenant_id
       WHERE po.id = $1 AND po.tenant_id = $2`,
      [id, tenantId]
    );
    if (po.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });

    const purchase = po[0];
    if (!purchase.supplier_phone) {
      return res.status(400).json({ error: 'Supplier has no phone number.' });
    }

    const message = buildPOMessage(purchase, purchase.supplier_name, purchase.tenant_name);
    const result = await sendWhatsApp({ to: purchase.supplier_phone, body: message });

    await logWhatsApp({
      tenantId,
      entityType: 'purchase_order',
      entityId: id,
      recipient: purchase.supplier_phone,
      message,
      status: result.sent ? 'sent' : 'failed',
      errorMessage: result.error,
    });

    if (result.sent) {
      res.json({ message: 'WhatsApp sent successfully.', status: 'sent' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send WhatsApp.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send WhatsApp.' });
  }
};

exports.sendPaymentReminder = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [inv] = await db.query(
      `SELECT i.*, c.name as customer_name, c.phone as customer_phone,
              t.company_name as tenant_name
       FROM hris_saas.invoices i
       JOIN hris_saas.customers c ON i.customer_id = c.id
       JOIN hris_saas.tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [id, tenantId]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const invoice = inv[0];
    if (!invoice.customer_phone) {
      return res.status(400).json({ error: 'Customer has no phone number.' });
    }

    const message = buildPaymentReminder(invoice, invoice.customer_name, invoice.tenant_name);
    const result = await sendWhatsApp({ to: invoice.customer_phone, body: message });

    await logWhatsApp({
      tenantId,
      entityType: 'payment_reminder',
      entityId: id,
      recipient: invoice.customer_phone,
      message,
      status: result.sent ? 'sent' : 'failed',
      errorMessage: result.error,
    });

    if (result.sent) {
      res.json({ message: 'Payment reminder sent via WhatsApp.', status: 'sent' });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send WhatsApp.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send payment reminder.' });
  }
};

exports.getLogs = async (req, res) => {
  const tenantId = req.tenantId;
  const { entityType, entityId } = req.query;

  try {
    let where = 'WHERE tenant_id = $1';
    const params = [tenantId];
    if (entityType) { params.push(entityType); where += ` AND entity_type = $${params.length}`; }
    if (entityId) { params.push(entityId); where += ` AND entity_id = $${params.length}`; }

    const [rows] = await db.query(
      `SELECT id, entity_type, entity_id, recipient, message, status, error_message, sent_at
       FROM hris_saas.whatsapp_logs ${where}
       ORDER BY sent_at DESC LIMIT 100`,
      params
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WhatsApp logs.' });
  }
};

exports.getSettings = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [rows] = await db.query(
      `SELECT settings FROM hris_saas.tenants WHERE id = $1`,
      [tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const settings = typeof rows[0].settings === 'string'
      ? JSON.parse(rows[0].settings) : (rows[0].settings || {});
    res.json({
      whatsappEnabled: settings.whatsappEnabled ?? false,
      whatsappPhone: settings.whatsappPhone || '',
      autoSendInvoice: settings.autoSendInvoice ?? false,
      autoSendPO: settings.autoSendPO ?? false,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WhatsApp settings.' });
  }
};
