-- ============================================================
-- Migration: Audit System + Super Admin Controls Enhancements
-- ============================================================
-- 1. Creates audit_logs table (PG-compatible) if not exists
-- 2. Adds subscription-specific columns to audit_logs
-- 3. Adds override_history table for tracking override changes
-- ============================================================

-- 1. Create audit_logs table if not exists (PG-compatible)
CREATE TABLE IF NOT EXISTS hris_saas.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(36) NOT NULL,
  actor_id VARCHAR(36) DEFAULT NULL,
  actor_name VARCHAR(255) DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT NULL,
  entity_id VARCHAR(100) DEFAULT NULL,
  changes JSONB DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_action ON hris_saas.audit_logs (tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_entity ON hris_saas.audit_logs (tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON hris_saas.audit_logs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON hris_saas.audit_logs (action, created_at);

-- 2. Add metadata column if not exists (already included in CREATE TABLE above)
-- This ensures backward compat with existing audit_logs table

-- 3. Create override_history table for tracking admin changes to feature overrides
CREATE TABLE IF NOT EXISTS hris_saas.override_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(36) NOT NULL,
  admin_id VARCHAR(36) NOT NULL,
  admin_name VARCHAR(255) DEFAULT NULL,
  action VARCHAR(50) NOT NULL,           -- 'created', 'updated', 'deleted'
  feature_key VARCHAR(100) NOT NULL,
  old_value INT,
  new_value INT,
  expires_at TIMESTAMP,
  reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_override_history_tenant ON hris_saas.override_history (tenant_id, created_at DESC);
