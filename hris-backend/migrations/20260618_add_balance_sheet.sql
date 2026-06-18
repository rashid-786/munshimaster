CREATE TABLE IF NOT EXISTS balance_sheet (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    type ENUM('IN', 'OUT') NOT NULL,
    payment_method ENUM('cash', 'online') NOT NULL,
    amount INT NOT NULL COMMENT 'in cents',
    description TEXT,
    entry_date DATE NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_date (entry_date),
    INDEX idx_type (type)
);
