const db = require('../config/db');
const { log } = require('../utils/audit');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern Professional',
    description: 'Clean, contemporary layout with accent colors and minimal design',
    preview: null,
    features: ['Color accents', 'Clean typography', 'GST summary', 'Signature space'],
  },
  {
    id: 'classic',
    name: 'Classic Business',
    description: 'Traditional formal layout suitable for all business types',
    preview: null,
    features: ['Formal layout', 'Company letterhead', 'Full border', 'Watermark support'],
  },
  {
    id: 'gst_detailed',
    name: 'GST Detailed',
    description: 'Comprehensive GST breakdown with HSN/SAC and tax rate columns',
    preview: null,
    features: ['HSN/SAC column', 'GST rate per item', 'Tax rate per item', 'GST summary table'],
  },
  {
    id: 'retail_pos',
    name: 'Retail POS',
    description: 'Simple receipt-style layout optimized for retail counters',
    preview: null,
    features: ['Compact layout', 'Receipt style', 'Quick print', 'Minimal fields'],
  },
];

const DEFAULT_SETTINGS = {
  defaultTemplate: 'modern',
  logoUrl: '',
  companyName: '',
  gstNumber: '',
  primaryColor: '#0F172A',
  secondaryColor: '#16A34A',
  showCustomerAddress: true,
  showShippingAddress: true,
  showCustomerGst: true,
  showTerms: true,
  showSignature: true,
  signatureUrl: '',
  signatoryName: '',
  signatoryDesignation: '',
  // Phase 2 — Layout Configuration
  logoAlignment: 'left',
  companyInfoPosition: 'left',
  customerLayout: 'left',
  showInvoiceNo: true,
  showInvoiceDate: true,
  showDueDate: true,
  showPaymentTerms: true,
  showSalesPerson: true,
  itemColumns: [
    { key: 'sku', label: 'SKU', visible: false },
    { key: 'itemCode', label: 'Item Code', visible: false },
    { key: 'hsn', label: 'HSN/SAC', visible: true },
    { key: 'description', label: 'Description', visible: true },
    { key: 'unit', label: 'Unit', visible: false },
    { key: 'quantity', label: 'Quantity', visible: true },
    { key: 'rate', label: 'Rate', visible: true },
    { key: 'discount', label: 'Discount', visible: false },
    { key: 'gst', label: 'GST', visible: true },
    { key: 'total', label: 'Total', visible: true },
  ],
  showDiscountTotal: true,
  showGstBreakdown: true,
  showRoundOff: true,
  showAmountInWords: true,
  // Phase 3 — Theme
  headerBackground: '#FFFFFF',
  footerBackground: '#F8FAFC',
  fontFamily: 'Helvetica',
  fontSize: 'small',
  // Phase 3 — Spacing
  headerHeight: 120,
  logoSize: 80,
  pageMargin: 50,
  sectionPadding: 16,
  sectionSpacing: 12,
  // Phase 3 — Custom Labels
  customLabels: {
    invoice: 'INVOICE',
    invoiceNumber: 'Invoice #',
    invoiceDate: 'Date',
    dueDate: 'Due Date',
    paymentTerms: 'Payment Terms',
    salesPerson: 'Sales Person',
    billTo: 'Bill To',
    placeOfSupply: 'Place of Supply',
    subtotal: 'Subtotal',
    discountTotal: 'Discount',
    tax: 'Tax',
    roundOff: 'Round Off',
    grandTotal: 'Grand Total',
    amountInWords: 'Amount in Words',
    notes: 'Notes',
    authorizedSignatory: 'Authorized Signatory',
    status: 'Status',
  },
};

exports.getTemplates = async (req, res) => {
  res.json({ templates: TEMPLATES });
};

exports.getDefaultSettings = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT invoice_settings FROM hris_saas.tenants WHERE id = ?`,
      [req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
    const raw = rows[0].invoice_settings;
    const legacy = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    // Merge with default tenant template config (multi-template system)
    let tplConfig = {};
    try {
      const [tplRows] = await db.query(
        `SELECT config FROM hris_saas.tenant_templates WHERE tenant_id = ? AND is_default = true AND is_active = true LIMIT 1`,
        [req.tenantId]
      );
      if (tplRows.length > 0 && tplRows[0].config) {
        tplConfig = typeof tplRows[0].config === 'string' ? JSON.parse(tplRows[0].config) : tplRows[0].config;
      }
    } catch {}
    res.json({ settings: { ...DEFAULT_SETTINGS, ...legacy, ...tplConfig } });
  } catch (error) {
    console.error('getDefaultSettings error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice settings.' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const ALLOWED_KEYS = [
      'defaultTemplate', 'logoUrl', 'companyName', 'gstNumber',
      'primaryColor', 'secondaryColor',
      'showCustomerAddress', 'showShippingAddress', 'showCustomerGst', 'showTerms', 'showSignature',
      'logoAlignment', 'companyInfoPosition', 'customerLayout',
      'showInvoiceNo', 'showInvoiceDate', 'showDueDate', 'showPaymentTerms', 'showSalesPerson',
      'itemColumns',
      'showDiscountTotal', 'showGstBreakdown', 'showRoundOff', 'showAmountInWords',
      'signatureUrl', 'signatoryName', 'signatoryDesignation',
      'headerBackground', 'footerBackground', 'fontFamily', 'fontSize',
      'headerHeight', 'logoSize', 'pageMargin', 'sectionPadding', 'sectionSpacing',
      'customLabels',
    ];
    const validTemplates = TEMPLATES.map(t => t.id);
    if (req.body.defaultTemplate && !validTemplates.includes(req.body.defaultTemplate)) {
      return res.status(400).json({ error: 'Invalid template selection.' });
    }
    const [existing] = await db.query(
      `SELECT invoice_settings FROM hris_saas.tenants WHERE id = ?`,
      [req.tenantId]
    );
    const current = existing[0]?.invoice_settings
      ? (typeof existing[0].invoice_settings === 'string' ? JSON.parse(existing[0].invoice_settings) : existing[0].invoice_settings)
      : {};
    const updated = { ...DEFAULT_SETTINGS, ...current };
    for (const key of ALLOWED_KEYS) {
      if (req.body[key] !== undefined) {
        updated[key] = req.body[key];
      }
    }
    await db.query(
      `UPDATE hris_saas.tenants SET invoice_settings = ? WHERE id = ?`,
      [JSON.stringify(updated), req.tenantId]
    );
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'invoice_template.settings_updated', entityType: 'tenant', entityId: req.tenantId, req });
    res.json({ message: 'Invoice settings updated.', settings: updated });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ error: 'Failed to update invoice settings.' });
  }
};

exports.uploadLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  try {
    const filename = req.file.filename;
    const url = `/uploads/${filename}`;
    // Store the URL in the tenant's invoice_settings
    const [existing] = await db.query(
      `SELECT invoice_settings FROM hris_saas.tenants WHERE id = ?`,
      [req.tenantId]
    );
    const current = existing[0]?.invoice_settings
      ? (typeof existing[0].invoice_settings === 'string' ? JSON.parse(existing[0].invoice_settings) : existing[0].invoice_settings)
      : {};
    const updated = { ...DEFAULT_SETTINGS, ...current, logoUrl: url };
    await db.query(
      `UPDATE hris_saas.tenants SET invoice_settings = ? WHERE id = ?`,
      [JSON.stringify(updated), req.tenantId]
    );
    res.json({ url, message: 'Logo uploaded successfully.' });
  } catch (error) {
    console.error('uploadLogo error:', error);
    res.status(500).json({ error: 'Failed to upload logo.' });
  }
};

exports.uploadSignature = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  try {
    const filename = req.file.filename;
    const url = `/uploads/${filename}`;
    const [existing] = await db.query(
      `SELECT invoice_settings FROM hris_saas.tenants WHERE id = ?`,
      [req.tenantId]
    );
    const current = existing[0]?.invoice_settings
      ? (typeof existing[0].invoice_settings === 'string' ? JSON.parse(existing[0].invoice_settings) : existing[0].invoice_settings)
      : {};
    const updated = { ...DEFAULT_SETTINGS, ...current, signatureUrl: url };
    await db.query(
      `UPDATE hris_saas.tenants SET invoice_settings = ? WHERE id = ?`,
      [JSON.stringify(updated), req.tenantId]
    );
    res.json({ url, message: 'Signature uploaded successfully.' });
  } catch (error) {
    console.error('uploadSignature error:', error);
    res.status(500).json({ error: 'Failed to upload signature.' });
  }
};

exports.removeSignature = async (req, res) => {
  try {
    const [existing] = await db.query(
      `SELECT invoice_settings FROM hris_saas.tenants WHERE id = ?`,
      [req.tenantId]
    );
    const current = existing[0]?.invoice_settings
      ? (typeof existing[0].invoice_settings === 'string' ? JSON.parse(existing[0].invoice_settings) : existing[0].invoice_settings)
      : {};
    const updated = { ...DEFAULT_SETTINGS, ...current, signatureUrl: '' };
    await db.query(
      `UPDATE hris_saas.tenants SET invoice_settings = ? WHERE id = ?`,
      [JSON.stringify(updated), req.tenantId]
    );
    res.json({ message: 'Signature removed.' });
  } catch (error) {
    console.error('removeSignature error:', error);
    res.status(500).json({ error: 'Failed to remove signature.' });
  }
};
