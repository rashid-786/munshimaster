-- Enhance tenant_section_visibility with read-only support, hierarchy, and audit history

-- 1. Add read_only and parent_section_key columns
ALTER TABLE hris_saas.tenant_section_visibility
  ADD COLUMN IF NOT EXISTS read_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_section_key VARCHAR(100);

-- 2. Section visibility audit history
CREATE TABLE IF NOT EXISTS hris_saas.tenant_section_visibility_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL,
  section_key     VARCHAR(100) NOT NULL,
  action          VARCHAR(30) NOT NULL CHECK (action IN ('visible','hidden','read_only','editable','reset')),
  old_visible     BOOLEAN,
  new_visible     BOOLEAN,
  old_read_only   BOOLEAN,
  new_read_only   BOOLEAN,
  reason          TEXT,
  changed_by      VARCHAR(36),
  changed_by_name VARCHAR(200),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tsvh_tenant ON hris_saas.tenant_section_visibility_history(tenant_id, section_key);
CREATE INDEX IF NOT EXISTS idx_tsvh_created ON hris_saas.tenant_section_visibility_history(created_at DESC);

-- 3. Add index for parent lookups
CREATE INDEX IF NOT EXISTS idx_tsv_parent ON hris_saas.tenant_section_visibility(parent_section_key);
