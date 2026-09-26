CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  template_name VARCHAR(255) DEFAULT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
  interval_count INT DEFAULT 1,
  next_generation_date DATE NOT NULL,
  last_generated_date DATE DEFAULT NULL,
  day_of_week INT DEFAULT NULL,
  day_of_month INT DEFAULT NULL,
  due_date_offset INT DEFAULT 15,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT DEFAULT NULL,
  gst_type VARCHAR(10) DEFAULT 'intra',
  place_of_supply VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_tenant_active ON recurring_invoice_templates (tenant_id, next_generation_date, is_active);

CREATE TABLE IF NOT EXISTS recurring_invoice_items (
  id CHAR(36) PRIMARY KEY,
  template_id CHAR(36) NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(12,2) DEFAULT 1,
  unit_price INTEGER NOT NULL,
  hsn_code VARCHAR(8) DEFAULT NULL,
  sort_order INT DEFAULT 0
);
