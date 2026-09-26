-- ============================================================
-- Migration: Tenant account deletion requests
-- ============================================================
-- Tenants can request deletion of their account from the app.
-- The request is reviewed by a Super Admin, who approves (which
-- permanently deletes the tenant + all data) or rejects it,
-- per the Account Deletion Policy.
--
-- Run: psql -d hris_saas -f migrations/20260828_add_tenant_deletion_requests.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS hris_saas.tenant_deletion_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36),
  reason        VARCHAR(500),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by   VARCHAR(80),
  reviewed_at   TIMESTAMP,
  review_note   VARCHAR(500),
  deleted_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_deletion_requests_tenant
  ON hris_saas.tenant_deletion_requests (tenant_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_deletion_requests_status
  ON hris_saas.tenant_deletion_requests (status, requested_at DESC);