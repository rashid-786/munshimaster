ALTER TABLE employees ADD COLUMN phone VARCHAR(20) NULL AFTER email;
ALTER TABLE employees ADD UNIQUE INDEX idx_phone_tenant (phone, tenant_id);
