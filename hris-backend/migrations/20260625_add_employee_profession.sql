ALTER TABLE employees ADD COLUMN profession VARCHAR(100) DEFAULT NULL AFTER base_salary;
ALTER TABLE employees ADD COLUMN other_profession VARCHAR(100) DEFAULT NULL AFTER profession;
