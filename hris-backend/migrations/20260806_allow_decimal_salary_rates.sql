-- Allow fractional rupee amounts for salary / hourly / piece rates.
-- Previously INT columns rejected values like ₹77.78/hr (invalid input
-- syntax for type integer). DOUBLE PRECISION is used instead of NUMERIC so
-- node-postgres keeps returning JS numbers to the API/mobile consumers.
ALTER TABLE hris_saas.employees ALTER COLUMN base_salary TYPE DOUBLE PRECISION;
ALTER TABLE hris_saas.employees ALTER COLUMN pay_per_hour TYPE DOUBLE PRECISION;
ALTER TABLE hris_saas.employees ALTER COLUMN piece_rate TYPE DOUBLE PRECISION;
ALTER TABLE hris_saas.employee_piece_rates ALTER COLUMN rate_per_piece TYPE DOUBLE PRECISION;
ALTER TABLE hris_saas.piece_work_entries ALTER COLUMN rate_per_piece TYPE DOUBLE PRECISION;
