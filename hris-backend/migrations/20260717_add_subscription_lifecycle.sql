-- ============================================================
-- Migration: Add subscription lifecycle states & event types
-- ============================================================
-- Adds: suspended, grace_period to tenant checks
-- Adds: new event types to subscription_events CHECK constraint
-- Adds: notification_sent_at, grace_period_ends_at to subscriptions
-- ============================================================

-- 1. Alter tenants table: add suspended and grace_period to the check
ALTER TABLE hris_saas.tenants
DROP CONSTRAINT IF EXISTS tenants_subscription_status_check;

ALTER TABLE hris_saas.tenants
ADD CONSTRAINT tenants_subscription_status_check
CHECK (subscription_status IN (
  'active', 'trialing', 'cancelled', 'expired',
  'past_due', 'suspended', 'grace_period'
));

-- 2. Alter subscription_events table: add new event types
ALTER TABLE hris_saas.subscription_events
DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE hris_saas.subscription_events
ADD CONSTRAINT subscription_events_event_type_check
CHECK (event_type IN (
  'upgrade', 'downgrade', 'renewal', 'trial_start',
  'trial_expired', 'cancellation', 'payment_failure',
  'admin_change', 'suspended', 'reactivated', 'expired',
  'grace_period_start', 'grace_period_expired',
  'renewal_reminder', 'expiry_warning'
));

-- 3. Add lifecycle tracking columns to subscriptions
ALTER TABLE hris_saas.subscriptions
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notification_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(255);

-- 4. Add index for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_sub_lifecycle ON hris_saas.subscriptions
  (status, current_period_end, grace_period_ends_at);

-- 5. Update existing tenants: set past_due → grace_period for clarity
UPDATE hris_saas.tenants
SET subscription_status = 'grace_period'
WHERE subscription_status = 'past_due';
