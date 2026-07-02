const { getKhataSummary, getKhataCustomers, getKhataCustomerDetail, getOrCreatePortalToken } = require('../utils/khata');
const { generatePortalToken } = require('../utils/khata');

exports.summary = async (req, res) => {
  try {
    const summary = await getKhataSummary(req.tenantId);
    res.json(summary);
  } catch (error) {
    console.error('Khata summary error:', error);
    res.status(500).json({ error: 'Failed to fetch khata summary.' });
  }
};

exports.customers = async (req, res) => {
  const { search } = req.query;
  try {
    const customers = await getKhataCustomers(req.tenantId, search);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch khata customers.' });
  }
};

exports.customerDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const detail = await getKhataCustomerDetail(req.tenantId, id);
    if (!detail) return res.status(404).json({ error: 'Customer not found.' });
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer detail.' });
  }
};

exports.generateToken = async (req, res) => {
  const { id } = req.params;
  try {
    const token = await getOrCreatePortalToken(req.tenantId, id);
    if (!token) return res.status(404).json({ error: 'Customer not found.' });
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    res.json({ token, portalUrl: `${baseUrl}/portal/${token}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate portal link.' });
  }
};

exports.sendReminder = async (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'whatsapp' or 'email'

  try {
    const detail = await getKhataCustomerDetail(req.tenantId, id);
    if (!detail) return res.status(404).json({ error: 'Customer not found.' });

    const outstanding = detail.invoices.reduce((s, i) => s + i.outstanding, 0);
    const message = `Dear ${detail.customer.name}, your outstanding balance is ₹${(outstanding / 100).toFixed(2)}. Please clear at your earliest. - ${req.tenant?.companyName || 'Your Business Partner'}`;

    if (type === 'whatsapp') {
      const whatsapp = require('../utils/whatsapp');
      await whatsapp.sendMessage(detail.customer.phone, message);
    }

    const emailLogger = require('../utils/emailLogger');
    await emailLogger.log({
      tenantId: req.tenantId, recipient: detail.customer.email,
      subject: 'Payment Reminder', body: message, status: 'sent',
      entityType: 'customer', entityId: id,
    });

    res.json({ message: 'Reminder sent.', outstanding: outstanding / 100 });
  } catch (error) {
    console.error('Khata reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder.' });
  }
};
