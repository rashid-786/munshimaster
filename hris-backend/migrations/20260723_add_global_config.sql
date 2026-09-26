ALTER TABLE hris_saas.system_settings ADD COLUMN IF NOT EXISTS global_config jsonb DEFAULT '{}'::jsonb;
