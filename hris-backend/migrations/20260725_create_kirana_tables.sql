-- Create kirana tables for BahiBook module
CREATE TABLE IF NOT EXISTS hris_saas.kirana_parties (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('buyer', 'seller')),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kirana_parties_tenant ON hris_saas.kirana_parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kirana_parties_type ON hris_saas.kirana_parties(type);

CREATE TABLE IF NOT EXISTS hris_saas.kirana_transactions (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  party_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('received', 'given')),
  amount BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  entry_date DATE NOT NULL,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kirana_transactions_party ON hris_saas.kirana_transactions(party_id);
CREATE INDEX IF NOT EXISTS idx_kirana_transactions_tenant ON hris_saas.kirana_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kirana_transactions_entry_date ON hris_saas.kirana_transactions(entry_date);

CREATE TABLE IF NOT EXISTS hris_saas.kirana_cashbook (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT')),
  category VARCHAR(100),
  amount BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  entry_date DATE NOT NULL,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kirana_cashbook_tenant ON hris_saas.kirana_cashbook(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kirana_cashbook_entry_date ON hris_saas.kirana_cashbook(entry_date);

CREATE TABLE IF NOT EXISTS hris_saas.kirana_staff (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kirana_staff_tenant ON hris_saas.kirana_staff(tenant_id);
