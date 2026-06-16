ALTER TABLE employees ADD COLUMN status ENUM('active', 'deactivated') NOT NULL DEFAULT 'active' AFTER base_salary;
ALTER TABLE employees ADD INDEX idx_status (status);
