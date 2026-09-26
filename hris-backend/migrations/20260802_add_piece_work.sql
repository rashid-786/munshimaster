ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'fixed';
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS piece_work_type VARCHAR(100) DEFAULT NULL;
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS piece_unit_label VARCHAR(50) DEFAULT NULL;
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS piece_rate INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS hris_saas.piece_work_entries (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
  employee_id VARCHAR(36) NOT NULL REFERENCES hris_saas.employees(id),
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  rate_per_piece INT NOT NULL DEFAULT 0,
  calculated_amount INT NOT NULL DEFAULT 0,
  payroll_id VARCHAR(36) DEFAULT NULL,
  is_paid SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pwe_tenant_employee ON hris_saas.piece_work_entries(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_pwe_date ON hris_saas.piece_work_entries(date);
CREATE INDEX IF NOT EXISTS idx_pwe_payroll ON hris_saas.piece_work_entries(payroll_id);
