-- Enhance tenant_feature_overrides with override type, temporary flags, reason tracking

-- Add new columns
ALTER TABLE hris_saas.tenant_feature_overrides
  ADD COLUMN IF NOT EXISTS override_type VARCHAR(30) NOT NULL DEFAULT 'INCREASE_LIMIT',
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add CHECK constraint for override_type
ALTER TABLE hris_saas.tenant_feature_overrides
  DROP CONSTRAINT IF EXISTS chk_override_type;
ALTER TABLE hris_saas.tenant_feature_overrides
  ADD CONSTRAINT chk_override_type CHECK (
    override_type IN ('ENABLE_FEATURE','DISABLE_FEATURE','INCREASE_LIMIT','REDUCE_LIMIT','READ_ONLY','FULL_ACCESS','REVOKE_OVERRIDE')
  );

-- Add index for fast feature resolution queries
CREATE INDEX IF NOT EXISTS idx_tfo_lookup
  ON hris_saas.tenant_feature_overrides(tenant_id, feature_key, override_type, expires_at);
