-- ──────────────────────────────────────────────────────
-- Subscription Database Infrastructure
-- ──────────────────────────────────────────────────────
-- Adds tenant subscription columns, usage tracking,
-- and event logging tables.
--
-- Run: psql -d hris_saas -f migrations/20260716_add_subscription_infrastructure.sql
-- ──────────────────────────────────────────────────────

-- 1. Extend tenants table with subscription metadata
ALTER TABLE hris_saas.tenants
  ADD COLUMN IF NOT EXISTS tenant_name VARCHAR(255) DEFAULT NULL;

ALTER TABLE hris_saas.tenants
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20)
    DEFAULT 'active'
    CHECK (subscription_status IN ('active','trialing','cancelled','expired','past_due'));

ALTER TABLE hris_saas.tenants
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP DEFAULT NULL;

ALTER TABLE hris_saas.tenants
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP DEFAULT NULL;


-- 2. Tenant monthly usage tracking
CREATE TABLE IF NOT EXISTS hris_saas.tenant_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  usage_month       DATE NOT NULL,
  entity_count      INTEGER NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  cashbook_entry_count INTEGER NOT NULL DEFAULT 0,
  staff_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique: one usage row per tenant per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_usage_month
  ON hris_saas.tenant_usage (tenant_id, usage_month);

-- Fast lookup by tenant
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant
  ON hris_saas.tenant_usage (tenant_id);


-- 3. Subscription change event log
CREATE TABLE IF NOT EXISTS hris_saas.subscription_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  old_plan          VARCHAR(50) NOT NULL,
  new_plan          VARCHAR(50) NOT NULL,
  event_type        VARCHAR(30) NOT NULL
                      CHECK (event_type IN ('upgrade','downgrade','renewal','trial_start','trial_expired','cancellation','payment_failure','admin_change')),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for tenant event history (most recent first)
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant
  ON hris_saas.subscription_events (tenant_id, created_at DESC);

-- Index for plan change analytics
CREATE INDEX IF NOT EXISTS idx_subscription_events_type
  ON hris_saas.subscription_events (event_type, created_at DESC);


-- 4. Backfill: copy existing company_name → tenant_name, status → subscription_status
UPDATE hris_saas.tenants
SET tenant_name = company_name,
    subscription_status = CASE
      WHEN status IS NOT NULL THEN status
      ELSE 'active'
    END
WHERE tenant_name IS NULL;

-- 5. Backfill start_date from subscriptions table where available
UPDATE hris_saas.tenants t
SET start_date = s.created_at
FROM hris_saas.subscriptions s
WHERE s.tenant_id = t.id
  AND s.status = 'active'
  AND t.start_date IS NULL;
