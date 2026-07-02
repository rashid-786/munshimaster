const tally = require('../utils/tallyExport');

exports.masters = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const xml = await tally.exportAllMasters(tenantId);
    if (!xml) return res.status(404).json({ error: 'No master data found to export.' });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=Tally_Masters.xml');
    res.send(xml);
  } catch (error) {
    console.error('Tally export error:', error);
    res.status(500).json({ error: 'Failed to export Tally masters.' });
  }
};

exports.customers = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const xml = await tally.exportCustomers(tenantId);
    if (!xml) return res.status(404).json({ error: 'No customers to export.' });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=Tally_Customers.xml');
    res.send(xml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export customers.' });
  }
};

exports.suppliers = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const xml = await tally.exportSuppliers(tenantId);
    if (!xml) return res.status(404).json({ error: 'No suppliers to export.' });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=Tally_Suppliers.xml');
    res.send(xml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export suppliers.' });
  }
};

exports.products = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const xml = await tally.exportProducts(tenantId);
    if (!xml) return res.status(404).json({ error: 'No products to export.' });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=Tally_Products.xml');
    res.send(xml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export products.' });
  }
};

exports.invoices = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;
  try {
    const xml = await tally.exportInvoices(tenantId, from, to);
    if (!xml) return res.status(404).json({ error: 'No invoices to export in the period.' });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=Tally_Invoices.xml');
    res.send(xml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export invoices.' });
  }
};

exports.purchaseOrders = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;
  try {
    const xml = await tally.exportPurchaseOrders(tenantId, from, to);
    if (!xml) return res.status(404).json({ error: 'No purchase orders to export.' });
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=Tally_PurchaseOrders.xml');
    res.send(xml);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export purchase orders.' });
  }
};
