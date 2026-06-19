CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  default_country_code VARCHAR(10) NOT NULL DEFAULT '+965',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO system_settings (id, default_country_code) VALUES (1, '+965')
ON DUPLICATE KEY UPDATE default_country_code = default_country_code;
