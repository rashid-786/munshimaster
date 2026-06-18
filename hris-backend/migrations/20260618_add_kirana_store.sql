CREATE TABLE IF NOT EXISTS kirana_parties (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    type ENUM('buyer', 'seller') NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_type (type)
);

CREATE TABLE IF NOT EXISTS kirana_transactions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    party_id VARCHAR(36) NOT NULL,
    type ENUM('given', 'received') NOT NULL,
    amount INT NOT NULL COMMENT 'in cents',
    note TEXT,
    entry_date DATE NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES kirana_parties(id) ON DELETE CASCADE,
    INDEX idx_tenant (tenant_id),
    INDEX idx_party (party_id)
);

CREATE TABLE IF NOT EXISTS kirana_staff (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(100),
    salary INT COMMENT 'in cents',
    joined_at DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS kirana_cashbook (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    type ENUM('IN', 'OUT') NOT NULL,
    category VARCHAR(100),
    amount INT NOT NULL COMMENT 'in cents',
    note TEXT,
    entry_date DATE NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_date (entry_date)
);
