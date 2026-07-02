const { getCustomerByToken, getCustomerPortalInvoices } = require('../utils/khata');

exports.verifyToken = async (req, res) => {
  const { token } = req.params;
  try {
    const customer = await getCustomerByToken(token);
    if (!customer) return res.status(404).json({ error: 'Invalid or expired portal link.' });

    const invoices = await getCustomerPortalInvoices(customer.tenant_id, customer.id);
    res.json({ customer, invoices });
  } catch (error) {
    console.error('Portal verify error:', error);
    res.status(500).json({ error: 'Failed to load portal data.' });
  }
};

exports.downloadInvoice = async (req, res) => {
  const { token, invoiceId } = req.params;
  try {
    const customer = await getCustomerByToken(token);
    if (!customer) return res.status(404).json({ error: 'Invalid portal link.' });

    // Set tenant context and proxy to invoice download
    const db = require('../config/db');
    const [inv] = await db.query(
      `SELECT i.* FROM hris_saas.invoices i WHERE i.id = $1 AND i.tenant_id = $2 AND i.customer_id = $3`,
      [invoiceId, customer.tenant_id, customer.id]
    );
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    req.tenantId = customer.tenant_id;
    req.params.id = invoiceId;
    const invoiceController = require('./invoice.controller');
    await invoiceController.downloadPDF(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download invoice.' });
  }
};
