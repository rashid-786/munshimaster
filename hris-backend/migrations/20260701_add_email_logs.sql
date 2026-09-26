CREATE TABLE IF NOT EXISTS hris_saas.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant ON hris_saas.email_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON hris_saas.email_logs(tenant_id, status);
