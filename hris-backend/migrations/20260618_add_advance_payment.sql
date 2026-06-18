CREATE TABLE IF NOT EXISTS employee_advances (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36) NOT NULL,
    amount INT NOT NULL COMMENT 'in cents',
    remaining_balance INT NOT NULL COMMENT 'in cents',
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected', 'fully_paid') NOT NULL DEFAULT 'pending',
    approved_by VARCHAR(36) NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_tenant (tenant_id),
    INDEX idx_employee (employee_id),
    INDEX idx_status (status)
);

ALTER TABLE payroll ADD COLUMN advance_deduction INT NOT NULL DEFAULT 0 COMMENT 'in cents' AFTER deductions;
