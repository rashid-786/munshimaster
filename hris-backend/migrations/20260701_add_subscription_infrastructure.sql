-- =============================================
-- Subscription Infrastructure
-- Renames: free→free, pro→business, enterprise→pro
-- =============================================

-- 1. Migrate existing plan names
UPDATE hris_saas.tenants SET subscription_plan = 'business' WHERE subscription_plan = 'pro';
UPDATE hris_saas.tenants SET subscription_plan = 'pro' WHERE subscription_plan = 'enterprise';
UPDATE hris_saas.tenants SET subscription_plan = 'free' WHERE subscription_plan IS NULL OR subscription_plan = '';

-- 2. Plans definition
CREATE TABLE IF NOT EXISTS hris_saas.subscription_plans (
  id          VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  price_inr   DECIMAL(10,2) NOT NULL DEFAULT 0,
  period      VARCHAR(20) NOT NULL DEFAULT 'year',
  trial_days  INT NOT NULL DEFAULT 0,
  features    JSONB NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hris_saas.subscription_plans (id, name, price_inr, period, trial_days, features) VALUES
('free',     'Free',     0,     'year', 0,
  '{"ledger_customers":50,"staff_members":2,"monthly_txns":500,"reports":"basic","invoices":false,"purchase_orders":false,"payroll":false,"inventory":false,"branches":0,"export":false,"whatsapp":false,"api":false,"branding":false,"support":"community"}'),
('business', 'Business', 999,   'year', 14,
  '{"ledger_customers":-1,"staff_members":-1,"monthly_txns":-1,"reports":"advanced","invoices":true,"purchase_orders":true,"payroll":true,"inventory":false,"branches":1,"export":true,"whatsapp":false,"api":false,"branding":false,"support":"email"}'),
('pro',      'Pro',      2499,  'year', 14,
  '{"ledger_customers":-1,"staff_members":-1,"monthly_txns":-1,"reports":"advanced","invoices":true,"purchase_orders":true,"payroll":true,"inventory":true,"branches":5,"export":true,"whatsapp":true,"api":true,"branding":true,"support":"phone"}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_inr = EXCLUDED.price_inr,
  features = EXCLUDED.features,
  trial_days = EXCLUDED.trial_days;

-- 3. Subscriptions (one active per tenant)
-- NOTE: tenant_id is VARCHAR(36) to match tenants.id type
CREATE TABLE IF NOT EXISTS hris_saas.subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  plan_id                   VARCHAR(50) NOT NULL REFERENCES hris_saas.subscription_plans(id),
  status                    VARCHAR(20) NOT NULL DEFAULT 'active',
  trial_ends_at             TIMESTAMP,
  current_period_start      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end        TIMESTAMP NOT NULL,
  cancelled_at              TIMESTAMP,
  ended_at                  TIMESTAMP,
  razorpay_subscription_id  VARCHAR(100),
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_tenant ON hris_saas.subscriptions(tenant_id, status);

-- 4. Payments
CREATE TABLE IF NOT EXISTS hris_saas.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
  subscription_id UUID REFERENCES hris_saas.subscriptions(id),
  order_id        VARCHAR(100),
  payment_id      VARCHAR(100),
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'INR',
  status          VARCHAR(20) NOT NULL,
  plan_id         VARCHAR(50) NOT NULL,
  period_start    TIMESTAMP,
  period_end      TIMESTAMP,
  receipt         VARCHAR(200),
  error_details   JSONB,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pay_tenant ON hris_saas.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pay_order ON hris_saas.payments(order_id);

-- 5. Feature overrides (promos, discounts, early adopters)
CREATE TABLE IF NOT EXISTS hris_saas.tenant_feature_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  max_value   INT,
  expires_at  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, feature_key)
);

-- 6. Backfill subscriptions for existing tenants
INSERT INTO hris_saas.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
  SELECT id, subscription_plan, 'active', NOW(), '2099-12-31'
  FROM hris_saas.tenants
  WHERE id NOT IN (SELECT tenant_id FROM hris_saas.subscriptions);
