-- ============================================================
-- Migration: Legal Documents content management
-- ============================================================
-- Adds tables for versioned, admin-managed legal documents
-- (Privacy Policy, Terms & Conditions, Refund & Cancellation,
-- Subscription Policy, and future documents), plus user
-- acceptance tracking for compliance.
--
-- Run: psql -d hris_saas -f migrations/20260828_add_legal_documents.sql
-- ============================================================

-- 1. Document registry (one row per legal document)
CREATE TABLE IF NOT EXISTS hris_saas.legal_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  VARCHAR(80) NOT NULL UNIQUE,
  title                 VARCHAR(200) NOT NULL,
  category              VARCHAR(50) NOT NULL DEFAULT 'other',
  description           TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  requires_acceptance   BOOLEAN NOT NULL DEFAULT true,
  current_version_id    UUID,
  created_by            VARCHAR(80),
  updated_by            VARCHAR(80),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Versioned content (rich-text HTML body per version)
CREATE TABLE IF NOT EXISTS hris_saas.legal_document_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL REFERENCES hris_saas.legal_documents(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  title             VARCHAR(200) NOT NULL,
  body              TEXT NOT NULL,
  effective_date    DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  change_note       TEXT,
  published_at      TIMESTAMP,
  published_by      VARCHAR(80),
  created_by        VARCHAR(80),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_legal_versions_doc
  ON hris_saas.legal_document_versions (document_id, version DESC);

-- 3. User acceptance records (compliance)
CREATE TABLE IF NOT EXISTS hris_saas.legal_document_acceptances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID NOT NULL REFERENCES hris_saas.legal_documents(id) ON DELETE CASCADE,
  document_version_id   UUID NOT NULL REFERENCES hris_saas.legal_document_versions(id) ON DELETE CASCADE,
  tenant_id             VARCHAR(36),
  user_id               VARCHAR(36),
  accepted_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  platform              VARCHAR(50),
  device_info           VARCHAR(255),
  app_version           VARCHAR(50),
  ip_address            VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_legal_accept_doc
  ON hris_saas.legal_document_acceptances (document_id, document_version_id);

CREATE INDEX IF NOT EXISTS idx_legal_accept_user
  ON hris_saas.legal_document_acceptances (tenant_id, user_id, document_id);

-- 4. Seed the four standard documents with an empty draft version each.
-- The body is intentionally empty; admins fill it in from the portal.
INSERT INTO hris_saas.legal_documents (id, slug, title, category, status, requires_acceptance, description)
VALUES
  (gen_random_uuid(), 'privacy-policy', 'Privacy Policy', 'privacy', 'draft', true,
   'How Bahi360 collects, uses, stores and protects your personal data.'),
  (gen_random_uuid(), 'terms-conditions', 'Terms & Conditions', 'terms', 'draft', true,
   'The terms governing your use of the Bahi360 application and services.'),
  (gen_random_uuid(), 'refund-cancellation-policy', 'Refund & Cancellation Policy', 'refund', 'draft', true,
   'Refund and cancellation terms for paid subscriptions.'),
  (gen_random_uuid(), 'subscription-policy', 'Subscription Policy', 'subscription', 'draft', true,
   'Details about subscription plans, billing cycles, trials and renewals.')
ON CONFLICT (slug) DO NOTHING;

-- Backfill an empty draft v1 for any seeded doc that has no versions yet.
INSERT INTO hris_saas.legal_document_versions (document_id, version, title, body, status, change_note, created_at)
SELECT d.id, 1, d.title, '', 'draft', 'Initial draft', NOW()
FROM hris_saas.legal_documents d
WHERE d.id IN (SELECT id FROM hris_saas.legal_documents)
  AND NOT EXISTS (SELECT 1 FROM hris_saas.legal_document_versions v WHERE v.document_id = d.id);