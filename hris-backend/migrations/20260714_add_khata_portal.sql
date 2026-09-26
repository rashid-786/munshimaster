ALTER TABLE hris_saas.customers ADD COLUMN IF NOT EXISTS portal_token VARCHAR(100) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_portal_token ON hris_saas.customers (portal_token);
