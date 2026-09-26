ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS ewaybill_number VARCHAR(50) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS ewaybill_generated_at TIMESTAMP DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS ewaybill_valid_upto TIMESTAMP DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS transporter_gstin VARCHAR(20) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS transporter_vehicle_number VARCHAR(20) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS transporter_doc_number VARCHAR(50) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS transporter_doc_date DATE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_ewaybill ON hris_saas.invoices (ewaybill_number);
