-- GST compliance: add HSN, CGST/SGST/IGST columns to invoice_items and purchase_order_items
ALTER TABLE hris_saas.invoice_items
  ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0;

ALTER TABLE hris_saas.purchase_order_items
  ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0;

-- Add GST type and place of supply to invoices and POs
ALTER TABLE hris_saas.invoices
  ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20) DEFAULT 'intra',
  ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);

ALTER TABLE hris_saas.purchase_orders
  ADD COLUMN IF NOT EXISTS gst_type VARCHAR(20) DEFAULT 'intra',
  ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100);
