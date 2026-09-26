ALTER TABLE hris_saas.tenants
  ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN NOT NULL DEFAULT false;
