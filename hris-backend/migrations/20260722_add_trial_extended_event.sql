-- Add trial_extended event type to subscription_events CHECK constraint

ALTER TABLE hris_saas.subscription_events
DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE hris_saas.subscription_events
ADD CONSTRAINT subscription_events_event_type_check
CHECK (event_type IN (
  'upgrade', 'downgrade', 'renewal', 'trial_start',
  'trial_expired', 'trial_extended', 'cancellation', 'payment_failure',
  'admin_change', 'suspended', 'reactivated', 'expired',
  'grace_period_start', 'grace_period_expired',
  'renewal_reminder', 'expiry_warning'
));
