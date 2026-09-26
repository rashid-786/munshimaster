-- Fix salary values: previously stored with double multiplication (frontend *100 + backend *100), now store raw
UPDATE hris_saas.employees SET base_salary = base_salary / 100 WHERE base_salary IS NOT NULL;
UPDATE hris_saas.employees SET pay_per_hour = pay_per_hour / 100 WHERE pay_per_hour IS NOT NULL;
UPDATE hris_saas.employees SET piece_rate = piece_rate / 100 WHERE piece_rate IS NOT NULL;
UPDATE hris_saas.employee_piece_rates SET rate_per_piece = rate_per_piece / 100 WHERE rate_per_piece IS NOT NULL;
-- Some records still had residual x100 after first pass; fix those too
UPDATE hris_saas.employees SET base_salary = base_salary / 100 WHERE base_salary > 100000;

-- Add missing columns for employee data
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS opening_balance BIGINT DEFAULT NULL;
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL;
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE hris_saas.employees ADD COLUMN IF NOT EXISTS joining_date VARCHAR(10) DEFAULT NULL;
