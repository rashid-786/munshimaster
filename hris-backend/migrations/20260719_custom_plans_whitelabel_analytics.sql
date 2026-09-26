-- ================================================================
-- Migration: Custom Plans + White-Label + Analytics Infrastructure
-- ================================================================
-- 1. custom_plans — per-tenant custom plan overrides
-- 2. tenant_branding — white-label (logo, domain, email branding)
-- 3. materialized view for subscription analytics
-- ================================================================

-- 1. CUSTOM PLANS — Extend tenant_feature_overrides with plan-level overrides
-- A custom_plan is a named set of limit+feature overrides that can be
-- assigned to one or more tenants, like a virtual plan tier.
CREATE TABLE IF NOT EXISTS hris_saas.custom_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_plan VARCHAR(20) NOT NULL DEFAULT 'FREE',
  limits JSONB NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '{}',
  monthly_price DECIMAL(10,2) DEFAULT 0,
  yearly_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_plans_active ON hris_saas.custom_plans (is_active);

-- Junction table: tenant ↔ custom_plan
CREATE TABLE IF NOT EXISTS hris_saas.tenant_custom_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(36) NOT NULL UNIQUE REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  custom_plan_id UUID NOT NULL REFERENCES hris_saas.custom_plans(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by VARCHAR(36)
);

CREATE INDEX IF NOT EXISTS idx_tcp_tenant ON hris_saas.tenant_custom_plans (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tcp_plan ON hris_saas.tenant_custom_plans (custom_plan_id);

-- 2. TENANT BRANDING — White-label settings per tenant
CREATE TABLE IF NOT EXISTS hris_saas.tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(36) NOT NULL UNIQUE REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  primary_color VARCHAR(7) DEFAULT '#4f46e5',
  secondary_color VARCHAR(7) DEFAULT '#0B3C5D',
  custom_domain VARCHAR(255),
  custom_domain_verified BOOLEAN DEFAULT false,
  company_tagline VARCHAR(255),
  email_from_name VARCHAR(255),
  email_from_email VARCHAR(255),
  email_logo_url VARCHAR(500),
  email_accent_color VARCHAR(7) DEFAULT '#4f46e5',
  email_footer_text TEXT,
  sidebar_logo_url VARCHAR(500),
  login_page_bg_color VARCHAR(7) DEFAULT '#ffffff',
  login_page_logo_url VARCHAR(500),
  custom_css TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Analytics materialized view: daily subscription snapshots
CREATE MATERIALIZED VIEW IF NOT EXISTS hris_saas.mv_subscription_daily AS
SELECT
  DATE(s.created_at) as date,
  s.plan_id,
  COUNT(*) as active_count,
  COUNT(*) FILTER (WHERE s.status = 'trialing') as trial_count,
  COUNT(*) FILTER (WHERE s.status = 'active') as paid_count
FROM hris_saas.subscriptions s
WHERE s.status IN ('active', 'trialing')
GROUP BY DATE(s.created_at), s.plan_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sub_daily
  ON hris_saas.mv_subscription_daily (date, plan_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION hris_saas.refresh_subscription_daily()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY hris_saas.mv_subscription_daily;
END;
$$ LANGUAGE plpgsql;
