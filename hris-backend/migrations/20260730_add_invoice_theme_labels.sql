-- Phase 3: Theme builder, spacing controls, custom labels
UPDATE hris_saas.tenants
SET invoice_settings = invoice_settings || jsonb_build_object(
  'headerBackground', COALESCE(invoice_settings->>'headerBackground', '#FFFFFF'),
  'footerBackground', COALESCE(invoice_settings->>'footerBackground', '#F8FAFC'),
  'fontFamily', COALESCE(invoice_settings->>'fontFamily', 'Helvetica'),
  'fontSize', COALESCE(invoice_settings->>'fontSize', 'small'),
  'headerHeight', COALESCE((invoice_settings->>'headerHeight')::int, 120),
  'logoSize', COALESCE((invoice_settings->>'logoSize')::int, 80),
  'pageMargin', COALESCE((invoice_settings->>'pageMargin')::int, 50),
  'sectionPadding', COALESCE((invoice_settings->>'sectionPadding')::int, 16),
  'sectionSpacing', COALESCE((invoice_settings->>'sectionSpacing')::int, 12),
  'customLabels', COALESCE(invoice_settings->'customLabels', jsonb_build_object(
    'invoice', 'INVOICE',
    'invoiceNumber', 'Invoice #',
    'invoiceDate', 'Date',
    'dueDate', 'Due Date',
    'paymentTerms', 'Payment Terms',
    'salesPerson', 'Sales Person',
    'billTo', 'Bill To',
    'placeOfSupply', 'Place of Supply',
    'subtotal', 'Subtotal',
    'discountTotal', 'Discount',
    'tax', 'Tax',
    'roundOff', 'Round Off',
    'grandTotal', 'Grand Total',
    'amountInWords', 'Amount in Words',
    'notes', 'Notes',
    'authorizedSignatory', 'Authorized Signatory',
    'status', 'Status'
  ))
)
WHERE invoice_settings IS NOT NULL;
