-- Backfill NULL created_at with pay_period_end (or NOW() if also null)
UPDATE payroll SET created_at = COALESCE(pay_period_end::timestamp, NOW()) WHERE created_at IS NULL;

-- Set default to CURRENT_TIMESTAMP for future inserts via raw SQL
ALTER TABLE payroll ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
