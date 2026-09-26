ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS payment_link_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS payment_link_url TEXT DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS payment_link_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS payment_link_created_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_link ON hris_saas.invoices (payment_link_id);
