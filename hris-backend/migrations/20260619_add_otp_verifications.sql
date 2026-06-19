CREATE TABLE IF NOT EXISTS otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  purpose VARCHAR(20) DEFAULT 'registration',
  expires_at DATETIME NOT NULL,
  verified TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_purpose (phone, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
