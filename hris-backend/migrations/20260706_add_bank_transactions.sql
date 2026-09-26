CREATE TABLE IF NOT EXISTS hris_saas.bank_transactions (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  import_batch_id CHAR(36) DEFAULT NULL,
  entry_date DATE NOT NULL,
  description TEXT DEFAULT NULL,
  debit_amount INTEGER DEFAULT 0,
  credit_amount INTEGER DEFAULT 0,
  running_balance INTEGER DEFAULT NULL,
  category VARCHAR(50) DEFAULT 'uncategorized',
  matched_invoice_id CHAR(36) DEFAULT NULL,
  confidence DECIMAL(5,2) DEFAULT NULL,
  original_row JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_txn_tenant_date ON hris_saas.bank_transactions (tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_bank_txn_category ON hris_saas.bank_transactions (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_bank_txn_matched ON hris_saas.bank_transactions (tenant_id, matched_invoice_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_batch ON hris_saas.bank_transactions (tenant_id, import_batch_id);
