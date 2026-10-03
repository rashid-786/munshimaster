-- Email-based OTP authentication
-- otp_verifications can be keyed by either phone or email.
ALTER TABLE hris_saas.otp_verifications ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;
ALTER TABLE hris_saas.otp_verifications ALTER COLUMN phone DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON hris_saas.otp_verifications (email, purpose);

-- tenants carries the account email for email-mode registration/login.
ALTER TABLE hris_saas.tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_email ON hris_saas.tenants (email);