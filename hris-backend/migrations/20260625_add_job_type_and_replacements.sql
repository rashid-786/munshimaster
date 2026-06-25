ALTER TABLE employees ADD COLUMN job_type ENUM('permanent','adhoc') NOT NULL DEFAULT 'permanent' AFTER role;

CREATE TABLE IF NOT EXISTS staff_replacements (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  permanent_employee_id VARCHAR(36) NOT NULL,
  adhoc_employee_id VARCHAR(36) NOT NULL,
  leave_id VARCHAR(36) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active','completed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY tenant_id (tenant_id),
  KEY permanent_employee_id (permanent_employee_id),
  KEY adhoc_employee_id (adhoc_employee_id),
  CONSTRAINT staff_replacements_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE,
  CONSTRAINT staff_replacements_ibfk_2 FOREIGN KEY (permanent_employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT staff_replacements_ibfk_3 FOREIGN KEY (adhoc_employee_id) REFERENCES employees (id) ON DELETE CASCADE
);
