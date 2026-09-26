-- Add Phase 2 invoice layout fields to existing tenants
-- New tenants get defaults from the JSONB column definition in 20260728 migration,
-- but existing tenants' invoice_settings need to be merged with new defaults.

UPDATE hris_saas.tenants
SET invoice_settings = invoice_settings || jsonb_build_object(
  'logoAlignment', COALESCE(invoice_settings->>'logoAlignment', 'left'),
  'companyInfoPosition', COALESCE(invoice_settings->>'companyInfoPosition', 'left'),
  'customerLayout', COALESCE(invoice_settings->>'customerLayout', 'left'),
  'showInvoiceNo', COALESCE((invoice_settings->>'showInvoiceNo')::boolean, true),
  'showInvoiceDate', COALESCE((invoice_settings->>'showInvoiceDate')::boolean, true),
  'showDueDate', COALESCE((invoice_settings->>'showDueDate')::boolean, true),
  'showPaymentTerms', COALESCE((invoice_settings->>'showPaymentTerms')::boolean, true),
  'showSalesPerson', COALESCE((invoice_settings->>'showSalesPerson')::boolean, true),
  'itemColumns', COALESCE(invoice_settings->'itemColumns', jsonb_build_array(
    jsonb_build_object('key', 'sku', 'label', 'SKU', 'visible', false),
    jsonb_build_object('key', 'itemCode', 'label', 'Item Code', 'visible', false),
    jsonb_build_object('key', 'hsn', 'label', 'HSN/SAC', 'visible', true),
    jsonb_build_object('key', 'description', 'label', 'Description', 'visible', true),
    jsonb_build_object('key', 'unit', 'label', 'Unit', 'visible', false),
    jsonb_build_object('key', 'quantity', 'label', 'Quantity', 'visible', true),
    jsonb_build_object('key', 'rate', 'label', 'Rate', 'visible', true),
    jsonb_build_object('key', 'discount', 'label', 'Discount', 'visible', false),
    jsonb_build_object('key', 'gst', 'label', 'GST', 'visible', true),
    jsonb_build_object('key', 'total', 'label', 'Total', 'visible', true)
  )),
  'showDiscountTotal', COALESCE((invoice_settings->>'showDiscountTotal')::boolean, true),
  'showGstBreakdown', COALESCE((invoice_settings->>'showGstBreakdown')::boolean, true),
  'showRoundOff', COALESCE((invoice_settings->>'showRoundOff')::boolean, true),
  'showAmountInWords', COALESCE((invoice_settings->>'showAmountInWords')::boolean, true)
)
WHERE invoice_settings IS NOT NULL;
