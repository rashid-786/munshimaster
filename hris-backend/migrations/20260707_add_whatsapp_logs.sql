CREATE TABLE IF NOT EXISTS hris_saas.whatsapp_logs (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id CHAR(36) DEFAULT NULL,
  recipient VARCHAR(20) NOT NULL,
  message TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT DEFAULT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_tenant ON hris_saas.whatsapp_logs (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_recipient ON hris_saas.whatsapp_logs (tenant_id, recipient);
