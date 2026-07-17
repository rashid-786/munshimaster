const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

const MERGE_TAGS = [
  { tag: '{{company_name}}', label: 'Company Name', category: 'business' },
  { tag: '{{company_logo}}', label: 'Company Logo', category: 'business' },
  { tag: '{{company_gst}}', label: 'Company GST', category: 'business' },
  { tag: '{{customer_name}}', label: 'Customer Name', category: 'customer' },
  { tag: '{{customer_address}}', label: 'Customer Address', category: 'customer' },
  { tag: '{{customer_gst}}', label: 'Customer GST', category: 'customer' },
  { tag: '{{customer_email}}', label: 'Customer Email', category: 'customer' },
  { tag: '{{customer_phone}}', label: 'Customer Phone', category: 'customer' },
  { tag: '{{invoice_number}}', label: 'Invoice Number', category: 'document' },
  { tag: '{{invoice_date}}', label: 'Invoice Date', category: 'document' },
  { tag: '{{due_date}}', label: 'Due Date', category: 'document' },
  { tag: '{{po_number}}', label: 'PO Number', category: 'document' },
  { tag: '{{place_of_supply}}', label: 'Place of Supply', category: 'document' },
  { tag: '{{invoice_items}}', label: 'Items Table', category: 'items' },
  { tag: '{{subtotal}}', label: 'Subtotal', category: 'summary' },
  { tag: '{{discount}}', label: 'Discount', category: 'summary' },
  { tag: '{{tax}}', label: 'Tax Amount', category: 'summary' },
  { tag: '{{grand_total}}', label: 'Grand Total', category: 'summary' },
  { tag: '{{amount_words}}', label: 'Amount in Words', category: 'summary' },
  { tag: '{{balance_due}}', label: 'Balance Due', category: 'summary' },
  { tag: '{{notes}}', label: 'Notes', category: 'document' },
  { tag: '{{terms}}', label: 'Terms & Conditions', category: 'document' },
];

// ==================== TENANT TEMPLATE CRUD ====================

exports.listTemplates = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, description, document_types, is_default, is_active, source, source_template_id, created_at, updated_at
       FROM hris_saas.tenant_templates WHERE tenant_id = ? ORDER BY is_default DESC, created_at DESC`,
      [req.tenantId]
    );
    res.json({ templates: rows });
  } catch (error) {
    console.error('listTemplates error:', error);
    res.status(500).json({ error: 'Failed to list templates.' });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM hris_saas.tenant_templates WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found.' });
    res.json({ template: rows[0] });
  } catch (error) {
    console.error('getTemplate error:', error);
    res.status(500).json({ error: 'Failed to fetch template.' });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, description, document_types, config } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Template name is required.' });

    const id = uuidv4();
    const docTypes = Array.isArray(document_types) && document_types.length ? document_types : ['invoice'];

    await db.query(
      `INSERT INTO hris_saas.tenant_templates (id, tenant_id, name, description, document_types, config, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.tenantId, name.trim(), description || '', docTypes, JSON.stringify(config || {}), req.user?.id]
    );

    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'template.created', entityType: 'tenant_template', entityId: id, req });
    res.json({ message: 'Template created.', template: { id, name: name.trim(), description: description || '', document_types: docTypes, config: config || {}, is_default: false, is_active: true, source: 'custom' } });
  } catch (error) {
    console.error('createTemplate error:', error);
    res.status(500).json({ error: 'Failed to create template.' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { name, description, document_types, config, is_default, is_active } = req.body;
    const [existing] = await db.query(
      `SELECT id FROM hris_saas.tenant_templates WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Template not found.' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (document_types !== undefined) { updates.push('document_types = ?'); params.push(document_types); }
    if (config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(config)); }
    if (is_default !== undefined) {
      // Unset previous default first
      if (is_default) {
        await db.query(`UPDATE hris_saas.tenant_templates SET is_default = false WHERE tenant_id = ?`, [req.tenantId]);
      }
      updates.push('is_default = ?');
      params.push(is_default);
    }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) return res.json({ message: 'No changes.' });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id, req.tenantId);
    await db.query(
      `UPDATE hris_saas.tenant_templates SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'template.updated', entityType: 'tenant_template', entityId: req.params.id, req });
    res.json({ message: 'Template updated.' });
  } catch (error) {
    console.error('updateTemplate error:', error);
    res.status(500).json({ error: 'Failed to update template.' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const [existing] = await db.query(
      `SELECT id FROM hris_saas.tenant_templates WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Template not found.' });

    await db.query(`DELETE FROM hris_saas.tenant_templates WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);

    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'template.deleted', entityType: 'tenant_template', entityId: req.params.id, req });
    res.json({ message: 'Template deleted.' });
  } catch (error) {
    console.error('deleteTemplate error:', error);
    res.status(500).json({ error: 'Failed to delete template.' });
  }
};

exports.cloneTemplate = async (req, res) => {
  try {
    const [source] = await db.query(
      `SELECT * FROM hris_saas.tenant_templates WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (source.length === 0) return res.status(404).json({ error: 'Template not found.' });

    const src = source[0];
    const id = uuidv4();
    const newName = `${src.name} (Copy)`;

    await db.query(
      `INSERT INTO hris_saas.tenant_templates (id, tenant_id, name, description, document_types, config, source, source_template_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'cloned', ?, ?)`,
      [id, req.tenantId, newName, src.description, src.document_types, JSON.stringify(typeof src.config === 'string' ? JSON.parse(src.config) : src.config), req.params.id, req.user?.id]
    );

    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'template.cloned', entityType: 'tenant_template', entityId: id, req });
    res.json({ message: 'Template cloned.', template: { id, name: newName, description: src.description, document_types: src.document_types, is_default: false, is_active: true, source: 'cloned' } });
  } catch (error) {
    console.error('cloneTemplate error:', error);
    res.status(500).json({ error: 'Failed to clone template.' });
  }
};

exports.setDefaultTemplate = async (req, res) => {
  try {
    const [existing] = await db.query(
      `SELECT id FROM hris_saas.tenant_templates WHERE id = ? AND tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Template not found.' });

    // Unset all defaults for this tenant, then set the new one
    await db.query(`UPDATE hris_saas.tenant_templates SET is_default = false WHERE tenant_id = ?`, [req.tenantId]);
    await db.query(`UPDATE hris_saas.tenant_templates SET is_default = true WHERE id = ? AND tenant_id = ?`, [req.params.id, req.tenantId]);

    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'template.activated', entityType: 'tenant_template', entityId: req.params.id, req });
    res.json({ message: 'Default template updated.' });
  } catch (error) {
    console.error('setDefaultTemplate error:', error);
    res.status(500).json({ error: 'Failed to set default template.' });
  }
};

// ==================== MARKETPLACE ====================

exports.listMarketplaceTemplates = async (req, res) => {
  try {
    const [categories] = await db.query(
      `SELECT id, name, icon FROM hris_saas.template_categories WHERE is_active = true ORDER BY sort_order`
    );
    const [templates] = await db.query(
      `SELECT mt.*, tc.name as category_name
       FROM hris_saas.marketplace_templates mt
       LEFT JOIN hris_saas.template_categories tc ON mt.category_id = tc.id
       WHERE mt.is_active = true ORDER BY tc.sort_order, mt.name`
    );
    res.json({ categories, templates });
  } catch (error) {
    console.error('listMarketplaceTemplates error:', error);
    res.status(500).json({ error: 'Failed to list marketplace templates.' });
  }
};

exports.activateMarketplaceTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const [source] = await db.query(
      `SELECT * FROM hris_saas.marketplace_templates WHERE id = ? AND is_active = true`,
      [id]
    );
    if (source.length === 0) return res.status(404).json({ error: 'Marketplace template not found.' });

    const tpl = source[0];
    const config = typeof tpl.config === 'string' ? JSON.parse(tpl.config) : (tpl.config || {});
    const docTypes = tpl.document_types || ['invoice'];
    const templateId = uuidv4();

    await db.query(
      `INSERT INTO hris_saas.tenant_templates (id, tenant_id, name, description, document_types, config, is_default, source, source_template_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'marketplace', ?, ?)`,
      [templateId, req.tenantId, tpl.name, tpl.description || '', docTypes, JSON.stringify(config), false, id, req.user?.id]
    );

    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'template.marketplace_activated', entityType: 'tenant_template', entityId: templateId, req });
    res.json({ message: 'Marketplace template activated.', template: { id: templateId, name: tpl.name, document_types: docTypes, source: 'marketplace', source_template_id: id } });
  } catch (error) {
    console.error('activateMarketplaceTemplate error:', error);
    res.status(500).json({ error: 'Failed to activate marketplace template.' });
  }
};

exports.getMarketplaceTemplateDetail = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mt.*, tc.name as category_name FROM hris_saas.marketplace_templates mt
       LEFT JOIN hris_saas.template_categories tc ON mt.category_id = tc.id
       WHERE mt.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Marketplace template not found.' });
    res.json({ template: rows[0] });
  } catch (error) {
    console.error('getMarketplaceTemplateDetail error:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace template.' });
  }
};

// ==================== DOCUMENT TYPES ====================

exports.getDocumentTypes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT code, name, description, icon FROM hris_saas.document_types WHERE is_active = true ORDER BY sort_order`
    );
    res.json({ documentTypes: rows });
  } catch (error) {
    console.error('getDocumentTypes error:', error);
    res.status(500).json({ error: 'Failed to fetch document types.' });
  }
};

exports.getMergeTags = async (req, res) => {
  res.json({ mergeTags: MERGE_TAGS });
};

// ==================== RESOLVE TEMPLATE FOR DOCUMENT ====================

exports.resolveTemplateForDocument = async (req, res) => {
  try {
    const { document_type } = req.params;
    if (!document_type) return res.status(400).json({ error: 'Document type is required.' });

    // Base: fetch legacy invoice_settings for personalization fallback (logoUrl, companyName, etc.)
    const [tenantRow] = await db.query(
      `SELECT invoice_settings FROM hris_saas.tenants WHERE id = ?`,
      [req.tenantId]
    );
    const rawSettings = tenantRow[0]?.invoice_settings;
    const base = rawSettings ? (typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings) : {};

    // 1. Find template assigned to this document type
    const [assigned] = await db.query(
      `SELECT * FROM hris_saas.tenant_templates
       WHERE tenant_id = ? AND ? = ANY(document_types) AND is_active = true
       ORDER BY is_default DESC, created_at DESC LIMIT 1`,
      [req.tenantId, document_type]
    );

    if (assigned.length > 0) {
      const tpl = assigned[0];
      const config = typeof tpl.config === 'string' ? JSON.parse(tpl.config) : (tpl.config || {});
      return res.json({ template: tpl, config: { ...base, ...config } });
    }

    // 2. Fall back to default template
    const [def] = await db.query(
      `SELECT * FROM hris_saas.tenant_templates
       WHERE tenant_id = ? AND is_default = true AND is_active = true LIMIT 1`,
      [req.tenantId]
    );

    if (def.length > 0) {
      const config = typeof def[0].config === 'string' ? JSON.parse(def[0].config) : (def[0].config || {});
      return res.json({ template: def[0], config: { ...base, ...config } });
    }

    // 3. Fall back to tenant invoice_settings only
    res.json({ template: null, config: base });
  } catch (error) {
    console.error('resolveTemplateForDocument error:', error);
    res.status(500).json({ error: 'Failed to resolve template.' });
  }
};
