-- ============================================================
-- Migration: CMS (Content Management System)
-- ============================================================
-- Dynamic management of website static pages, header menus, footer
-- menus/categories, social media links, and footer settings.
--
-- Run: psql -d hris_saas -f migrations/20260829_add_cms.sql
-- ============================================================

-- 1. CMS static pages
CREATE TABLE IF NOT EXISTS hris_saas.cms_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              VARCHAR(120) NOT NULL UNIQUE,
  title             VARCHAR(200) NOT NULL,
  seo_title         VARCHAR(200),
  seo_description   TEXT,
  content           TEXT,
  featured_image    VARCHAR(500),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  created_by        VARCHAR(80),
  updated_by        VARCHAR(80),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Header menus
CREATE TABLE IF NOT EXISTS hris_saas.cms_header_menus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         VARCHAR(120) NOT NULL,
  link_type     VARCHAR(20) NOT NULL DEFAULT 'page'
                  CHECK (link_type IN ('page', 'external')),
  page_slug     VARCHAR(120),
  external_url  VARCHAR(500),
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Footer categories + links
CREATE TABLE IF NOT EXISTS hris_saas.cms_footer_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(120) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hris_saas.cms_footer_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES hris_saas.cms_footer_categories(id) ON DELETE CASCADE,
  label         VARCHAR(120) NOT NULL,
  link_type     VARCHAR(20) NOT NULL DEFAULT 'page'
                  CHECK (link_type IN ('page', 'external')),
  page_slug     VARCHAR(120),
  external_url  VARCHAR(500),
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cms_footer_links_cat
  ON hris_saas.cms_footer_links (category_id, sort_order);

-- 4. Social media links
CREATE TABLE IF NOT EXISTS hris_saas.cms_social_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      VARCHAR(50) NOT NULL UNIQUE,
  url           VARCHAR(500),
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Footer / global settings (single row, id = 1)
CREATE TABLE IF NOT EXISTS hris_saas.cms_settings (
  id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  footer_copyright   TEXT,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Seed data
-- ============================================================

-- Pages
INSERT INTO hris_saas.cms_pages (slug, title, seo_title, seo_description, content, status)
VALUES
  ('home', 'Home', 'Bahi360 - All-in-one Business Management', 'Manage your Bahi Khata, staff, attendance, payroll and grow your business - all in one app.', '<h1>Welcome to Bahi360</h1><p>Manage your business finances, staff, attendance, payroll and more in one place.</p>', 'published'),
  ('pricing', 'Pricing', 'Pricing - Bahi360', 'Simple, transparent pricing plans for your business.', '<h1>Pricing</h1><p>Choose a plan that fits your business. Upgrade anytime as you grow.</p>', 'published'),
  ('services', 'Services', 'Services - Bahi360', 'Explore what Bahi360 can do for your business.', '<h1>Our Services</h1><p>Payroll, attendance, staff management, invoicing, inventory and more.</p>', 'published'),
  ('about', 'About', 'About Us - Bahi360', 'Learn more about Bahi360 and our mission.', '<h1>About Bahi360</h1><p>We build one dependable operating layer for your business across finance, people and growth.</p>', 'published'),
  ('blog', 'Blog', 'Blog - Bahi360', 'Insights, tips and updates from the Bahi360 team.', '<h1>Blog</h1><p>Latest news and articles from Bahi360.</p>', 'published'),
  ('faq', 'FAQ', 'FAQ - Bahi360', 'Frequently asked questions about Bahi360.', '<h1>Frequently Asked Questions</h1><p>Find answers to common questions about Bahi360.</p>', 'published'),
  ('privacy-policy', 'Privacy Policy', 'Privacy Policy - Bahi360', 'How Bahi360 collects, uses and protects your data.', '<h1>Privacy Policy</h1><p>Your privacy matters to us. This page explains how we handle your data.</p>', 'published'),
  ('terms-of-service', 'Terms of Service', 'Terms of Service - Bahi360', 'The terms that govern your use of Bahi360.', '<h1>Terms of Service</h1><p>The terms governing your use of the Bahi360 platform.</p>', 'published'),
  ('contact-us', 'Contact Us', 'Contact Us - Bahi360', 'Get in touch with the Bahi360 team.', '<h1>Contact Us</h1><p>Reach out to us at support@bahi360.com or via WhatsApp.</p>', 'published'),
  ('help-center', 'Help Center', 'Help Center - Bahi360', 'Get help with using Bahi360.', '<h1>Help Center</h1><p>Guides and support articles to help you get the most from Bahi360.</p>', 'published'),
  ('onboarding-guide', 'Onboarding Guide', 'Onboarding Guide - Bahi360', 'Get started with Bahi360 in a few simple steps.', '<h1>Onboarding Guide</h1><p>Follow these steps to get your business set up on Bahi360.</p>', 'published')
ON CONFLICT (slug) DO NOTHING;

-- Header menus
INSERT INTO hris_saas.cms_header_menus (label, link_type, page_slug, sort_order, is_visible)
VALUES
  ('Home', 'page', 'home', 1, true),
  ('Pricing', 'page', 'pricing', 2, true),
  ('Services', 'page', 'services', 3, true),
  ('About', 'page', 'about', 4, true),
  ('Blog', 'page', 'blog', 5, true),
  ('FAQ', 'page', 'faq', 6, true);

-- Footer categories + links
INSERT INTO hris_saas.cms_footer_categories (id, title, sort_order, is_visible)
VALUES
  (gen_random_uuid(), 'Product', 1, true),
  (gen_random_uuid(), 'Company', 2, true),
  (gen_random_uuid(), 'Support', 3, true);

INSERT INTO hris_saas.cms_footer_links (category_id, label, link_type, page_slug, sort_order, is_visible)
SELECT c.id, l.label, 'page', l.slug, l.ord, true
FROM hris_saas.cms_footer_categories c
CROSS JOIN LATERAL (
  VALUES
    (CASE WHEN c.title = 'Product' THEN 1 ELSE 0 END, 'BahiKhata', 'services'),
    (CASE WHEN c.title = 'Product' THEN 2 ELSE 0 END, 'Manage Staff', 'services'),
    (CASE WHEN c.title = 'Product' THEN 3 ELSE 0 END, 'Attendance', 'services'),
    (CASE WHEN c.title = 'Product' THEN 4 ELSE 0 END, 'Payroll', 'services'),
    (CASE WHEN c.title = 'Company' THEN 1 ELSE 0 END, 'About', 'about'),
    (CASE WHEN c.title = 'Company' THEN 2 ELSE 0 END, 'Pricing', 'pricing'),
    (CASE WHEN c.title = 'Company' THEN 3 ELSE 0 END, 'Privacy Policy', 'privacy-policy'),
    (CASE WHEN c.title = 'Company' THEN 4 ELSE 0 END, 'Terms of Service', 'terms-of-service'),
    (CASE WHEN c.title = 'Company' THEN 5 ELSE 0 END, 'Contact Us', 'contact-us'),
    (CASE WHEN c.title = 'Support' THEN 1 ELSE 0 END, 'Help Center', 'help-center'),
    (CASE WHEN c.title = 'Support' THEN 2 ELSE 0 END, 'FAQ', 'faq'),
    (CASE WHEN c.title = 'Support' THEN 3 ELSE 0 END, 'Onboarding Guide', 'onboarding-guide')
) AS l(ord, label, slug)
WHERE c.title IN ('Product', 'Company', 'Support') AND l.ord > 0;

-- Social links
INSERT INTO hris_saas.cms_social_links (platform, url, is_visible)
VALUES ('linkedin', '', true), ('x', '', true), ('instagram', '', true)
ON CONFLICT (platform) DO NOTHING;

-- Footer settings
INSERT INTO hris_saas.cms_settings (id, footer_copyright)
VALUES (1, '© 2026 Bahi360. All rights reserved.')
ON CONFLICT (id) DO NOTHING;