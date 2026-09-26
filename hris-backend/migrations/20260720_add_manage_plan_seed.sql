-- =============================================
-- Seed Manage Plan (yearly + monthly)
-- Manage sits between Free and Business
-- =============================================

INSERT INTO hris_saas.subscription_plans (id, name, price_inr, period, trial_days, features) VALUES
('manage',         'Manage',         499,  'year', 14,
 '{"ledger_customers":250,"staff_members":10,"monthly_txns":3000,"reports":"advanced","invoices":true,"purchase_orders":true,"payroll":true,"inventory":false,"branches":2,"export":true,"whatsapp":false,"api":false,"branding":false,"support":"email"}'),
('manage_monthly', 'Manage Monthly',  49,  'month', 14,
 '{"ledger_customers":250,"staff_members":10,"monthly_txns":3000,"reports":"advanced","invoices":true,"purchase_orders":true,"payroll":true,"inventory":false,"branches":2,"export":true,"whatsapp":false,"api":false,"branding":false,"support":"email"}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_inr = EXCLUDED.price_inr,
  features = EXCLUDED.features,
  trial_days = EXCLUDED.trial_days,
  period = EXCLUDED.period;

-- Backfill any existing subscriptions that reference 'manage' plan
UPDATE hris_saas.subscriptions SET plan_id = 'manage' WHERE plan_id = 'manage' AND plan_id NOT IN (SELECT id FROM hris_saas.subscription_plans);
