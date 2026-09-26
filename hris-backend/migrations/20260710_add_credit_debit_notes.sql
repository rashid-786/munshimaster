CREATE TABLE IF NOT EXISTS credit_notes (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  invoice_id CHAR(36) DEFAULT NULL,
  credit_note_number VARCHAR(50) NOT NULL,
  cn_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  subtotal INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  reason TEXT DEFAULT NULL,
  gst_type VARCHAR(10) DEFAULT NULL,
  place_of_supply VARCHAR(50) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id CHAR(36) PRIMARY KEY,
  credit_note_id CHAR(36) NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price INTEGER DEFAULT 0,
  total_price INTEGER DEFAULT 0,
  product_id CHAR(36) DEFAULT NULL,
  hsn_code VARCHAR(20) DEFAULT NULL,
  cgst_rate NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS debit_notes (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  invoice_id CHAR(36) DEFAULT NULL,
  debit_note_number VARCHAR(50) NOT NULL,
  dn_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  subtotal INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0,
  reason TEXT DEFAULT NULL,
  gst_type VARCHAR(10) DEFAULT NULL,
  place_of_supply VARCHAR(50) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debit_note_items (
  id CHAR(36) PRIMARY KEY,
  debit_note_id CHAR(36) NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price INTEGER DEFAULT 0,
  total_price INTEGER DEFAULT 0,
  product_id CHAR(36) DEFAULT NULL,
  hsn_code VARCHAR(20) DEFAULT NULL,
  cgst_rate NUMERIC DEFAULT 0,
  sgst_rate NUMERIC DEFAULT 0,
  igst_rate NUMERIC DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cn_tenant ON credit_notes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cn_invoice ON credit_notes (tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_dn_tenant ON debit_notes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_dn_invoice ON debit_notes (tenant_id, invoice_id);
