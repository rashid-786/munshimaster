-- ============================================
-- Super Admin Revamp: Tables & Seed Data
-- ============================================
-- Adds normalized plan_features, tenant_section_visibility,
-- and seeds comprehensive feature-to-plan mappings.

BEGIN;

-- ─── 1. Plan Features (normalized feature-to-plan mapping) ──────────

CREATE TABLE IF NOT EXISTS hris_saas.plan_features (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       VARCHAR(50) NOT NULL REFERENCES hris_saas.subscription_plans(id) ON DELETE CASCADE,
  feature_key   VARCHAR(100) NOT NULL,
  feature_type  VARCHAR(20) NOT NULL DEFAULT 'boolean'
                CHECK (feature_type IN ('boolean', 'limit', 'config', 'section')),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  max_value     INT,           -- NULL means unlimited (for 'limit' type)
  config        JSONB,         -- Extra configuration for this feature
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_key)
);

-- Index for faster feature lookups
CREATE INDEX IF NOT EXISTS idx_plan_features_plan ON hris_saas.plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_key ON hris_saas.plan_features(feature_key);

-- ─── 2. Tenant Section Visibility ─────────────────────────────────

CREATE TABLE IF NOT EXISTS hris_saas.tenant_section_visibility (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  section_key   VARCHAR(100) NOT NULL,
  visible       BOOLEAN NOT NULL DEFAULT true,
  reason        TEXT,
  set_by        VARCHAR(36),          -- super admin ID
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_section_vis_tenant ON hris_saas.tenant_section_visibility(tenant_id);

-- ─── 3. Super Admin Action Log ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS hris_saas.sa_action_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      VARCHAR(36) NOT NULL,
  admin_name    VARCHAR(255),
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50),
  entity_id     VARCHAR(100),
  tenant_id     VARCHAR(36),           -- affected tenant (if any)
  details       JSONB,
  ip_address    VARCHAR(45),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sa_action_log_admin ON hris_saas.sa_action_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_action ON hris_saas.sa_action_log(action);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_created ON hris_saas.sa_action_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_tenant ON hris_saas.sa_action_log(tenant_id);

-- ─── 4. Seed Plan Features ─────────────────────────────────────────

-- Only seed if plan_features is empty (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM hris_saas.plan_features LIMIT 1) THEN

    -- FREE plan features
    INSERT INTO hris_saas.plan_features (plan_id, feature_key, feature_type, enabled, max_value) VALUES
      ('free', 'entities',           'section', true, NULL),
      ('free', 'my_bahi_book',       'section', true, NULL),
      ('free', 'customers',          'boolean', true, NULL),
      ('free', 'suppliers',          'boolean', true, NULL),
      ('free', 'invoices',           'boolean', true, NULL),
      ('free', 'balance_sheet',      'boolean', true, NULL),
      ('free', 'reports_basic',      'boolean', true, NULL),
      ('free', 'kirana',             'boolean', true, NULL),
      ('free', 'pl_statement',       'boolean', true, NULL),
      ('free', 'cash_flow',          'boolean', true, NULL),
      ('free', 'settings',           'section', true, NULL),
      ('free', 'max_customers',      'limit',   true, 50),
      ('free', 'max_suppliers',      'limit',   true, 10),
      ('free', 'max_staff',          'limit',   true, 0),
      ('free', 'max_branches',       'limit',   true, 2),
      ('free', 'max_monthly_txns',   'limit',   true, 500),
      ('free', 'max_products',       'limit',   true, 0);

    -- MANAGE plan features
    INSERT INTO hris_saas.plan_features (plan_id, feature_key, feature_type, enabled, max_value) VALUES
      ('manage', 'entities',         'section', true, NULL),
      ('manage', 'my_bahi_book',     'section', true, NULL),
      ('manage', 'customers',        'boolean', true, NULL),
      ('manage', 'suppliers',        'boolean', true, NULL),
      ('manage', 'invoices',         'boolean', true, NULL),
      ('manage', 'balance_sheet',    'boolean', true, NULL),
      ('manage', 'reports_basic',    'boolean', true, NULL),
      ('manage', 'kirana',           'boolean', true, NULL),
      ('manage', 'pl_statement',     'boolean', true, NULL),
      ('manage', 'cash_flow',        'boolean', true, NULL),
      ('manage', 'settings',         'section', true, NULL),
      ('manage', 'my_staff',         'section', true, NULL),
      ('manage', 'staff_directory',  'boolean', true, NULL),
      ('manage', 'attendance',       'boolean', true, NULL),
      ('manage', 'leaves',           'boolean', true, NULL),
      ('manage', 'advances',         'boolean', true, NULL),
      ('manage', 'replacements',     'boolean', true, NULL),
      ('manage', 'payroll',          'boolean', true, NULL),
      ('manage', 'products',         'boolean', true, NULL),
      ('manage', 'max_customers',    'limit',   true, 250),
      ('manage', 'max_suppliers',    'limit',   true, 50),
      ('manage', 'max_staff',        'limit',   true, 10),
      ('manage', 'max_branches',     'limit',   true, 2),
      ('manage', 'max_monthly_txns', 'limit',   true, 3000),
      ('manage', 'max_products',     'limit',   true, 100);

    -- BUSINESS plan features
    INSERT INTO hris_saas.plan_features (plan_id, feature_key, feature_type, enabled, max_value) VALUES
      ('business', 'entities',         'section', true, NULL),
      ('business', 'my_bahi_book',     'section', true, NULL),
      ('business', 'my_business',      'section', true, NULL),
      ('business', 'customers',        'boolean', true, NULL),
      ('business', 'suppliers',        'boolean', true, NULL),
      ('business', 'invoices',         'boolean', true, NULL),
      ('business', 'purchase_orders',  'boolean', true, NULL),
      ('business', 'balance_sheet',    'boolean', true, NULL),
      ('business', 'reports_basic',    'boolean', true, NULL),
      ('business', 'advanced_reports', 'boolean', true, NULL),
      ('business', 'kirana',           'boolean', true, NULL),
      ('business', 'pl_statement',     'boolean', true, NULL),
      ('business', 'cash_flow',        'boolean', true, NULL),
      ('business', 'settings',         'section', true, NULL),
      ('business', 'products',         'boolean', true, NULL),
      ('business', 'inventory',        'boolean', true, NULL),
      ('business', 'recurring_invoices','boolean', true, NULL),
      ('business', 'credit_debit_notes','boolean', true, NULL),
      ('business', 'multi_branch',     'boolean', true, NULL),
      ('business', 'bulk_import',      'boolean', true, NULL),
      ('business', 'my_staff',         'section', true, NULL),
      ('business', 'staff_directory',  'boolean', true, NULL),
      ('business', 'attendance',       'boolean', true, NULL),
      ('business', 'leaves',           'boolean', true, NULL),
      ('business', 'advances',         'boolean', true, NULL),
      ('business', 'replacements',     'boolean', true, NULL),
      ('business', 'payroll',          'boolean', true, NULL),
      ('business', 'max_customers',    'limit',   true, -1),   -- unlimited
      ('business', 'max_suppliers',    'limit',   true, -1),
      ('business', 'max_staff',        'limit',   true, 25),
      ('business', 'max_branches',     'limit',   true, 3),
      ('business', 'max_monthly_txns', 'limit',   true, 10000),
      ('business', 'max_products',     'limit',   true, -1);

    -- BUSINESS_PRO (pro) plan features
    INSERT INTO hris_saas.plan_features (plan_id, feature_key, feature_type, enabled, max_value) VALUES
      ('pro', 'entities',              'section', true, NULL),
      ('pro', 'my_bahi_book',          'section', true, NULL),
      ('pro', 'my_business',           'section', true, NULL),
      ('pro', 'customers',             'boolean', true, NULL),
      ('pro', 'suppliers',             'boolean', true, NULL),
      ('pro', 'invoices',              'boolean', true, NULL),
      ('pro', 'purchase_orders',       'boolean', true, NULL),
      ('pro', 'balance_sheet',         'boolean', true, NULL),
      ('pro', 'reports_basic',         'boolean', true, NULL),
      ('pro', 'advanced_reports',      'boolean', true, NULL),
      ('pro', 'kirana',                'boolean', true, NULL),
      ('pro', 'pl_statement',          'boolean', true, NULL),
      ('pro', 'cash_flow',             'boolean', true, NULL),
      ('pro', 'settings',              'section', true, NULL),
      ('pro', 'products',              'boolean', true, NULL),
      ('pro', 'inventory',             'boolean', true, NULL),
      ('pro', 'recurring_invoices',    'boolean', true, NULL),
      ('pro', 'credit_debit_notes',    'boolean', true, NULL),
      ('pro', 'multi_branch',          'boolean', true, NULL),
      ('pro', 'bulk_import',           'boolean', true, NULL),
      ('pro', 'my_staff',              'section', true, NULL),
      ('pro', 'staff_directory',       'boolean', true, NULL),
      ('pro', 'attendance',            'boolean', true, NULL),
      ('pro', 'leaves',                'boolean', true, NULL),
      ('pro', 'advances',              'boolean', true, NULL),
      ('pro', 'replacements',          'boolean', true, NULL),
      ('pro', 'payroll',               'boolean', true, NULL),
      ('pro', 'whatsapp',              'boolean', true, NULL),
      ('pro', 'api_access',            'boolean', true, NULL),
      ('pro', 'white_label',           'boolean', true, NULL),
      ('pro', 'priority_support',      'boolean', true, NULL),
      ('pro', 'bank_import',           'boolean', true, NULL),
      ('pro', 'gst_returns',           'boolean', true, NULL),
      ('pro', 'e_invoicing',           'boolean', true, NULL),
      ('pro', 'gstr2b_reco',           'boolean', true, NULL),
      ('pro', 'tds_management',        'boolean', true, NULL),
      ('pro', 'tally_export',          'boolean', true, NULL),
      ('pro', 'audit_logs',            'boolean', true, NULL),
      ('pro', 'sidepanel_customization','boolean', true, NULL),
      ('pro', 'reports_pnl',           'boolean', true, NULL),
      ('pro', 'max_customers',         'limit',   true, -1),
      ('pro', 'max_suppliers',         'limit',   true, -1),
      ('pro', 'max_staff',             'limit',   true, 50),
      ('pro', 'max_branches',          'limit',   true, 5),
      ('pro', 'max_monthly_txns',      'limit',   true, 20000),
      ('pro', 'max_products',          'limit',   true, -1);

  END IF;
END $$;

-- ─── 5. Seed default section visibility for all existing tenants ────
-- Each tenant gets default visibility rows for known sections.
-- This is a one-time backfill; new tenants are handled via triggers/app.

DO $$
DECLARE
  t RECORD;
  sections TEXT[] := ARRAY['entities','my_bahi_book','my_staff','my_business','settings'];
  s TEXT;
BEGIN
  FOR t IN SELECT id, subscription_plan FROM hris_saas.tenants LOOP
    FOREACH s IN ARRAY sections LOOP
      IF NOT EXISTS (
        SELECT 1 FROM hris_saas.tenant_section_visibility
        WHERE tenant_id = t.id AND section_key = s
      ) THEN
        INSERT INTO hris_saas.tenant_section_visibility (tenant_id, section_key, visible)
        VALUES (t.id, s,
          CASE
            WHEN s = 'my_staff' AND t.subscription_plan IN ('MANAGE','BUSINESS','BUSINESS_PRO') THEN true
            WHEN s = 'my_business' AND t.subscription_plan IN ('BUSINESS','BUSINESS_PRO') THEN true
            WHEN s = 'my_bahi_book' AND t.subscription_plan IN ('FREE','MANAGE') THEN true
            WHEN s = 'my_bahi_book' AND t.subscription_plan IN ('BUSINESS','BUSINESS_PRO') THEN false
            ELSE true
          END
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ─── 6. Add super_admin tracking columns to tenants ─────────────────

ALTER TABLE hris_saas.tenants
  ADD COLUMN IF NOT EXISTS created_by_super_admin VARCHAR(36),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- ─── 7. Index for subscription analytics ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status ON hris_saas.subscriptions(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON hris_saas.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON hris_saas.payments(created_at);

COMMIT;
