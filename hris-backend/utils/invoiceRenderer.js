const db = require('../config/db');
const path = require('path');

async function resolveInvoiceSettings(tenantId, documentType = 'invoice') {
  const [tenant] = await db.query(
    `SELECT invoice_settings FROM hris_saas.tenants WHERE id = $1`,
    [tenantId]
  );
  const raw = tenant[0]?.invoice_settings;
  const base = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};

  const [assigned] = await db.query(
    `SELECT * FROM hris_saas.tenant_templates
     WHERE tenant_id = $1 AND $2 = ANY(document_types) AND is_active = true
     ORDER BY is_default DESC, created_at DESC LIMIT 1`,
    [tenantId, documentType]
  );
  if (assigned.length > 0) {
    const config = typeof assigned[0].config === 'string' ? JSON.parse(assigned[0].config) : (assigned[0].config || {});
    return { ...base, ...config };
  }

  const [def] = await db.query(
    `SELECT * FROM hris_saas.tenant_templates
     WHERE tenant_id = $1 AND is_default = true AND is_active = true LIMIT 1`,
    [tenantId]
  );
  if (def.length > 0) {
    const config = typeof def[0].config === 'string' ? JSON.parse(def[0].config) : (def[0].config || {});
    return { ...base, ...config };
  }

  return base;
}

function resolveLogoUrl(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  return path.join(__dirname, '..', logoUrl.replace(/^\/api\/v1\/uploads\//, 'uploads/').replace(/^\//, ''));
}

module.exports = { resolveInvoiceSettings, resolveLogoUrl };
