ALTER TABLE hris_saas.tenants ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT jsonb_build_object(
  'defaultTemplate', 'modern',
  'logoUrl', '',
  'companyName', '',
  'gstNumber', '',
  'primaryColor', '#0F172A',
  'secondaryColor', '#16A34A',
  'showCustomerAddress', true,
  'showShippingAddress', true,
  'showCustomerGst', true,
  'showTerms', true,
  'showSignature', true
);
