-- ============================================
-- Phase 5: Retention — Referrals, Campaigns,
--           Trial expiry tracking, Analytics
-- ============================================

-- 1. Referral codes (one per tenant)
CREATE TABLE IF NOT EXISTS hris_saas.referral_codes (
  id          VARCHAR(36) PRIMARY KEY,
  tenant_id   VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  code        VARCHAR(20) NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Referral redemptions
CREATE TABLE IF NOT EXISTS hris_saas.referral_redemptions (
  id              VARCHAR(36) PRIMARY KEY,
  referrer_id     VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  referred_id     VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  reward_months   INT NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / credited / expired
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  credited_at     TIMESTAMP
);

-- 3. Campaigns / promo offers
CREATE TABLE IF NOT EXISTS hris_saas.campaigns (
  id              VARCHAR(36) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  discount_pct    INT,                         -- percentage off (e.g. 20 = 20%)
  discount_months INT,                         -- free months (e.g. 2 = 2 months free)
  code            VARCHAR(30) UNIQUE,           -- promo code (optional)
  applies_to      VARCHAR(20) NOT NULL DEFAULT 'all', -- 'all' / 'new' / 'existing'
  max_redemptions INT DEFAULT 0,               -- 0 = unlimited
  redemptions     INT DEFAULT 0,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Campaign redemptions (track usage)
CREATE TABLE IF NOT EXISTS hris_saas.campaign_redemptions (
  id            VARCHAR(36) PRIMARY KEY,
  campaign_id   VARCHAR(36) NOT NULL REFERENCES hris_saas.campaigns(id) ON DELETE CASCADE,
  tenant_id     VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  applied_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Conversion tracking events
CREATE TABLE IF NOT EXISTS hris_saas.conversion_events (
  id            VARCHAR(36) PRIMARY KEY,
  tenant_id     VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id) ON DELETE CASCADE,
  event         VARCHAR(50) NOT NULL,  -- 'trial_started', 'trial_expired', 'trial_converted',
                                       -- 'subscribed', 'downgraded', 'cancelled', 'reactivated'
  plan_from     VARCHAR(20),
  plan_to       VARCHAR(20),
  source        VARCHAR(50),           -- 'referral', 'campaign', 'direct', 'organic'
  metadata      JSONB,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
