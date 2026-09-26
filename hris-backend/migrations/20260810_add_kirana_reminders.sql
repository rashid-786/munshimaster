-- WhatsApp reminders for buyers
CREATE TABLE IF NOT EXISTS hris_saas.kirana_reminders (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  party_id VARCHAR(36) NOT NULL,
  party_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  amount BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kirana_reminders_tenant ON hris_saas.kirana_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kirana_reminders_party ON hris_saas.kirana_reminders(party_id);
