-- ===================================================================
-- Migration: Enhance sa_action_log table with missing columns
-- ===================================================================
-- Adds: actor_role, old_value, new_value, reason, user_agent
-- Creates table if not exists with all required columns
-- ===================================================================

-- Ensure the schema exists
CREATE SCHEMA IF NOT EXISTS hris_saas;

-- Create the table with all required fields (safe IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS hris_saas.sa_action_log (
    id              VARCHAR(36) PRIMARY KEY,
    admin_id        VARCHAR(36),
    admin_name      VARCHAR(255),
    actor_role      VARCHAR(50) DEFAULT 'super_admin',
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100),
    entity_id       VARCHAR(255),
    tenant_id       VARCHAR(36),
    old_value       JSONB,
    new_value       JSONB,
    reason          TEXT,
    details         JSONB,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to existing table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'hris_saas'
                     AND table_name = 'sa_action_log'
                     AND column_name = 'actor_role') THEN
        ALTER TABLE hris_saas.sa_action_log ADD COLUMN actor_role VARCHAR(50) DEFAULT 'super_admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'hris_saas'
                     AND table_name = 'sa_action_log'
                     AND column_name = 'old_value') THEN
        ALTER TABLE hris_saas.sa_action_log ADD COLUMN old_value JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'hris_saas'
                     AND table_name = 'sa_action_log'
                     AND column_name = 'new_value') THEN
        ALTER TABLE hris_saas.sa_action_log ADD COLUMN new_value JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'hris_saas'
                     AND table_name = 'sa_action_log'
                     AND column_name = 'reason') THEN
        ALTER TABLE hris_saas.sa_action_log ADD COLUMN reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'hris_saas'
                     AND table_name = 'sa_action_log'
                     AND column_name = 'user_agent') THEN
        ALTER TABLE hris_saas.sa_action_log ADD COLUMN user_agent VARCHAR(500);
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_sa_action_log_action ON hris_saas.sa_action_log (action);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_entity_type ON hris_saas.sa_action_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_tenant_id ON hris_saas.sa_action_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_admin_id ON hris_saas.sa_action_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_created_at ON hris_saas.sa_action_log (created_at);
CREATE INDEX IF NOT EXISTS idx_sa_action_log_action_created ON hris_saas.sa_action_log (action, created_at);
