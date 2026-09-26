-- ============================================================
-- Migration: CMS site-level settings (logo, footer content,
-- support email, WhatsApp contact)
-- ============================================================

ALTER TABLE hris_saas.cms_settings
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS footer_description TEXT,
  ADD COLUMN IF NOT EXISTS support_email VARCHAR(200),
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);

UPDATE hris_saas.cms_settings
SET logo_url            = '/logo.png',
    footer_description  = 'All-in-one business management platform for growing organizations. Streamline payroll, attendance, accounting, and workforce operations.',
    support_email       = 'support@bahi360.com',
    whatsapp_number     = '971500000000'
WHERE id = 1;