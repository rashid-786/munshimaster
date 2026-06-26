CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  actor_id UUID DEFAULT NULL,
  actor_name VARCHAR(255) DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT DEFAULT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  entity_type VARCHAR(50) DEFAULT NULL,
  entity_id VARCHAR(100) DEFAULT NULL,
  is_read SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_tenant_recipient ON notifications(tenant_id, recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_tenant_created ON notifications(tenant_id, created_at);
