const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'branding');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const DEFAULT_BRANDING = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#4f46e5',
  secondaryColor: '#0B3C5D',
  customDomain: null,
  customDomainVerified: false,
  companyTagline: null,
  emailFromName: null,
  emailFromEmail: null,
  emailLogoUrl: null,
  emailAccentColor: '#4f46e5',
  emailFooterText: null,
  sidebarLogoUrl: null,
  loginPageBgColor: '#ffffff',
  loginPageLogoUrl: null,
  customCss: null,
};

/**
 * Get branding settings for a tenant.
 */
async function getBranding(tenantId) {
  const [rows] = await db.execute(
    `SELECT * FROM hris_saas.tenant_branding WHERE tenant_id = ?`,
    [tenantId]
  );
  if (rows.length === 0) return { ...DEFAULT_BRANDING, tenantId };
  const r = rows[0];
  return {
    tenantId: r.tenant_id,
    logoUrl: r.logo_url,
    faviconUrl: r.favicon_url,
    primaryColor: r.primary_color,
    secondaryColor: r.secondary_color,
    customDomain: r.custom_domain,
    customDomainVerified: r.custom_domain_verified,
    companyTagline: r.company_tagline,
    emailFromName: r.email_from_name,
    emailFromEmail: r.email_from_email,
    emailLogoUrl: r.email_logo_url,
    emailAccentColor: r.email_accent_color,
    emailFooterText: r.email_footer_text,
    sidebarLogoUrl: r.sidebar_logo_url,
    loginPageBgColor: r.login_page_bg_color,
    loginPageLogoUrl: r.login_page_logo_url,
    customCss: r.custom_css,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Upsert branding settings for a tenant.
 * Only provided fields are updated; omitted fields keep existing values.
 */
async function upsertBranding(tenantId, updates) {
  const existing = await getBranding(tenantId);
  const hasExisting = existing.createdAt !== undefined;

  const merged = {
    logo_url: updates.logoUrl ?? existing.logoUrl,
    favicon_url: updates.faviconUrl ?? existing.faviconUrl,
    primary_color: updates.primaryColor ?? existing.primaryColor,
    secondary_color: updates.secondaryColor ?? existing.secondaryColor,
    custom_domain: updates.customDomain ?? existing.customDomain,
    custom_domain_verified: updates.customDomainVerified ?? existing.customDomainVerified ?? false,
    company_tagline: updates.companyTagline ?? existing.companyTagline,
    email_from_name: updates.emailFromName ?? existing.emailFromName,
    email_from_email: updates.emailFromEmail ?? existing.emailFromEmail,
    email_logo_url: updates.emailLogoUrl ?? existing.emailLogoUrl,
    email_accent_color: updates.emailAccentColor ?? existing.emailAccentColor,
    email_footer_text: updates.emailFooterText ?? existing.emailFooterText,
    sidebar_logo_url: updates.sidebarLogoUrl ?? existing.sidebarLogoUrl,
    login_page_bg_color: updates.loginPageBgColor ?? existing.loginPageBgColor,
    login_page_logo_url: updates.loginPageLogoUrl ?? existing.loginPageLogoUrl,
    custom_css: updates.customCss ?? existing.customCss,
  };

  if (hasExisting) {
    const sets = Object.entries(merged)
      .filter(([key]) => key !== 'tenant_id')
      .map(([key]) => `${key} = ?`);
    const values = Object.entries(merged)
      .filter(([key]) => key !== 'tenant_id')
      .map(([, val]) => val);

    await db.execute(
      `UPDATE hris_saas.tenant_branding SET ${sets.join(', ')}, updated_at = NOW()
       WHERE tenant_id = ?`,
      [...values, tenantId]
    );
  } else {
    await db.execute(
      `INSERT INTO hris_saas.tenant_branding
         (id, tenant_id, logo_url, favicon_url, primary_color, secondary_color,
          custom_domain, custom_domain_verified, company_tagline,
          email_from_name, email_from_email, email_logo_url,
          email_accent_color, email_footer_text, sidebar_logo_url,
          login_page_bg_color, login_page_logo_url, custom_css,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        uuidv4(), tenantId,
        merged.logo_url, merged.favicon_url, merged.primary_color, merged.secondary_color,
        merged.custom_domain, merged.custom_domain_verified, merged.company_tagline,
        merged.email_from_name, merged.email_from_email, merged.email_logo_url,
        merged.email_accent_color, merged.email_footer_text, merged.sidebar_logo_url,
        merged.login_page_bg_color, merged.login_page_logo_url, merged.custom_css,
      ]
    );
  }

  return getBranding(tenantId);
}

/**
 * Save an uploaded branding image file and return the URL path.
 */
async function saveBrandingImage(tenantId, file, imageType) {
  // Generate unique filename
  const ext = path.extname(file.originalname) || '.png';
  const filename = `${tenantId}_${imageType}_${Date.now()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  // Save file
  fs.writeFileSync(filepath, file.buffer);

  // URL path for serving
  const url = `/uploads/branding/${filename}`;

  // Update branding record with the new URL
  const updateKey = imageType === 'logo' ? 'logoUrl'
    : imageType === 'favicon' ? 'faviconUrl'
    : imageType === 'email_logo' ? 'emailLogoUrl'
    : imageType === 'sidebar_logo' ? 'sidebarLogoUrl'
    : imageType === 'login_logo' ? 'loginPageLogoUrl'
    : null;

  if (updateKey) {
    await upsertBranding(tenantId, { [updateKey]: url });
  }

  return { url, filename };
}

/**
 * Generate email-specific branding context for templates.
 */
async function getEmailBranding(tenantId) {
  const branding = await getBranding(tenantId);

  // Get company name from tenant
  const [tenant] = await db.execute(
    `SELECT company_name FROM hris_saas.tenants WHERE id = ?`,
    [tenantId]
  );

  return {
    companyName: tenant[0]?.company_name || 'Your Company',
    fromName: branding.emailFromName || branding.companyTagline || tenant[0]?.company_name || 'Bahi360',
    fromEmail: branding.emailFromEmail || process.env.SMTP_FROM || 'noreply@bahi360.com',
    logoUrl: branding.emailLogoUrl || branding.logoUrl,
    accentColor: branding.emailAccentColor || branding.primaryColor || '#4f46e5',
    footerText: branding.emailFooterText || `Powered by Bahi360`,
  };
}

/**
 * Verify a custom domain (placeholder — integrate with DNS verification).
 */
async function verifyDomain(tenantId) {
  await db.execute(
    `UPDATE hris_saas.tenant_branding
     SET custom_domain_verified = true, updated_at = NOW()
     WHERE tenant_id = ?`,
    [tenantId]
  );
  return getBranding(tenantId);
}

module.exports = {
  getBranding,
  upsertBranding,
  saveBrandingImage,
  getEmailBranding,
  verifyDomain,
  DEFAULT_BRANDING,
};
