CREATE TABLE IF NOT EXISTS hris_saas.gstr2b_imports (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  period VARCHAR(10) NOT NULL,
  filename VARCHAR(255) DEFAULT NULL,
  file_size INTEGER DEFAULT 0,
  section_summary JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{"total": 0, "matched": 0, "unmatched": 0, "ambiguous": 0}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gstr2b_imports_tenant ON hris_saas.gstr2b_imports (tenant_id);

CREATE TABLE IF NOT EXISTS hris_saas.gstr2b_items (
  id VARCHAR(50) PRIMARY KEY,
  import_id VARCHAR(50) NOT NULL REFERENCES hris_saas.gstr2b_imports(id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,
  section_type VARCHAR(10) NOT NULL,
  supplier_gstin VARCHAR(20) DEFAULT NULL,
  supplier_name VARCHAR(255) DEFAULT NULL,
  invoice_number VARCHAR(100) DEFAULT NULL,
  invoice_date DATE DEFAULT NULL,
  total_value NUMERIC(12,2) DEFAULT 0,
  taxable_value NUMERIC(12,2) DEFAULT 0,
  igst NUMERIC(12,2) DEFAULT 0,
  cgst NUMERIC(12,2) DEFAULT 0,
  sgst NUMERIC(12,2) DEFAULT 0,
  cess NUMERIC(12,2) DEFAULT 0,
  match_status VARCHAR(20) DEFAULT 'unmatched',
  matched_po_id VARCHAR(50) DEFAULT NULL,
  matched_po_number VARCHAR(100) DEFAULT NULL,
  matched_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gstr2b_items_import ON hris_saas.gstr2b_items (import_id);
CREATE INDEX IF NOT EXISTS idx_gstr2b_items_tenant ON hris_saas.gstr2b_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_gstr2b_items_supplier ON hris_saas.gstr2b_items (supplier_gstin);
CREATE INDEX IF NOT EXISTS idx_gstr2b_items_match ON hris_saas.gstr2b_items (match_status);
