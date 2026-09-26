-- Upgrade campaigns table with discount_type, applicable_plan_ids, status
-- Add revenue tracking to referral_redemptions

-- 1. Campaign table enhancements
ALTER TABLE hris_saas.campaigns
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage','fixed_amount','free_trial','custom')),
  ADD COLUMN IF NOT EXISTS discount_value INT,
  ADD COLUMN IF NOT EXISTS applicable_plan_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','inactive','expired')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing discount_pct → discount_type='percentage', discount_value=discount_pct
UPDATE hris_saas.campaigns SET discount_type = 'percentage', discount_value = discount_pct WHERE discount_pct IS NOT NULL AND discount_type = 'percentage';
UPDATE hris_saas.campaigns SET discount_type = 'free_trial', discount_value = discount_months WHERE discount_months IS NOT NULL AND discount_type = 'percentage';
UPDATE hris_saas.campaigns SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status = 'active';

-- 2. Referral redemptions: add revenue tracking
ALTER TABLE hris_saas.referral_redemptions
  ADD COLUMN IF NOT EXISTS revenue_generated INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS referrer_rewarded BOOLEAN DEFAULT false;

-- 3. Add campaign_redemptions reference to payments
ALTER TABLE hris_saas.campaign_redemptions
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS discount_amount INT DEFAULT 0;
