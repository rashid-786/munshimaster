CREATE TABLE IF NOT EXISTS hris_saas.tds_masters (
  id VARCHAR(50) PRIMARY KEY,
  section VARCHAR(10) NOT NULL,
  nature_of_payment VARCHAR(255) NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  threshold NUMERIC(12,2) DEFAULT 0,
  applicable_to TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hris_saas.tds_deductions (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  entity_type VARCHAR(20) NOT NULL DEFAULT 'supplier',
  entity_id VARCHAR(50) DEFAULT NULL,
  entity_name VARCHAR(255) DEFAULT NULL,
  entity_gstin VARCHAR(20) DEFAULT NULL,
  entity_pan VARCHAR(20) DEFAULT NULL,
  section VARCHAR(10) NOT NULL,
  invoice_number VARCHAR(100) DEFAULT NULL,
  invoice_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  deduction_date DATE NOT NULL,
  tds_period VARCHAR(6) DEFAULT NULL,
  challan_id VARCHAR(50) DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'deducted',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hris_saas.tds_challans (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id VARCHAR(50) NOT NULL,
  challan_number VARCHAR(100) NOT NULL,
  bsr_code VARCHAR(20) DEFAULT NULL,
  deposit_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds_period VARCHAR(6) DEFAULT NULL,
  major_head VARCHAR(10) DEFAULT '0020',
  status VARCHAR(20) DEFAULT 'deposited',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tds_deductions_tenant ON hris_saas.tds_deductions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tds_deductions_period ON hris_saas.tds_deductions (tds_period);
CREATE INDEX IF NOT EXISTS idx_tds_deductions_status ON hris_saas.tds_deductions (status);
CREATE INDEX IF NOT EXISTS idx_tds_challans_tenant ON hris_saas.tds_challans (tenant_id);

INSERT INTO hris_saas.tds_masters (id, section, nature_of_payment, rate, threshold, applicable_to) VALUES
  ('tds_194c_single', '194C', 'Contract - Single', 1.0, 30000, 'individual'),
  ('tds_194c_aggregate', '194C', 'Contract - Aggregate', 1.0, 100000, 'individual'),
  ('tds_194c_huf', '194C', 'Contract - HUF/Others', 2.0, 30000, 'other'),
  ('tds_194j', '194J', 'Professional / Technical Fees', 10.0, 30000, 'all'),
  ('tds_194h', '194H', 'Commission / Brokerage', 5.0, 15000, 'all'),
  ('tds_194i', '194I', 'Rent', 10.0, 240000, 'all'),
  ('tds_194ia', '194IA', 'Rent - Plant & Machinery', 2.0, 240000, 'all'),
  ('tds_194d', '194D', 'Insurance Commission', 5.0, 15000, 'all'),
  ('tds_194m', '194M', 'Commission to Individual/HUF', 5.0, 5000000, 'individual'),
  ('tds_194o', '194O', 'E-commerce Participant', 1.0, 0, 'individual'),
  ('tds_other', 'Other', 'Other TDS', 10.0, 0, 'all')
ON CONFLICT (id) DO NOTHING;
