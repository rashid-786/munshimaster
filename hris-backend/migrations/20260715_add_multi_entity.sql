ALTER TABLE hris_saas.tenants ADD COLUMN IF NOT EXISTS organization_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE hris_saas.tenants ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE hris_saas.tenants ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'primary';
CREATE INDEX IF NOT EXISTS idx_tenants_organization ON hris_saas.tenants (organization_id);
