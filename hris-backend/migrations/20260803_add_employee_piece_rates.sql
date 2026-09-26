CREATE TABLE IF NOT EXISTS hris_saas.employee_piece_rates (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
  employee_id VARCHAR(36) NOT NULL REFERENCES hris_saas.employees(id),
  work_type VARCHAR(100) NOT NULL,
  unit_label VARCHAR(50) NOT NULL DEFAULT '',
  rate_per_piece INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_epr_tenant_employee ON hris_saas.employee_piece_rates(tenant_id, employee_id);

ALTER TABLE hris_saas.piece_work_entries ADD COLUMN IF NOT EXISTS work_type VARCHAR(100) DEFAULT NULL;

-- Backfill employee_piece_rates from existing single-column piece data
INSERT INTO hris_saas.employee_piece_rates (id, tenant_id, employee_id, work_type, unit_label, rate_per_piece)
SELECT gen_random_uuid()::varchar, tenant_id, id, COALESCE(piece_work_type, 'General'), COALESCE(piece_unit_label, 'pcs'), COALESCE(piece_rate, 0)
FROM hris_saas.employees
WHERE salary_type = 'piece' AND (piece_work_type IS NOT NULL OR piece_rate IS NOT NULL)
ON CONFLICT DO NOTHING;
