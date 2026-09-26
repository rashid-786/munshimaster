-- Convert existing opening_balance amounts into advance entries
INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status, approved_by, approved_at, created_at)
SELECT
    UUID(),
    e.tenant_id,
    e.id,
    e.opening_balance,
    e.opening_balance,
    'Opening Balance',
    'approved',
    NULL,
    NOW(),
    NOW()
FROM employees e
WHERE e.opening_balance IS NOT NULL AND e.opening_balance > 0;

-- Remove opening_balance column from employees (now tracked exclusively in employee_advances)
ALTER TABLE hris_saas.employees DROP COLUMN IF EXISTS opening_balance;