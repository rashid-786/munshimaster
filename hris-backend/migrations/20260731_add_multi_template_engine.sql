-- Phase 4: Multi-template engine, marketplace, document types

-- Document types (seed data for all supported documents)
CREATE TABLE IF NOT EXISTS hris_saas.document_types (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'file-text',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO hris_saas.document_types (code, name, description, icon, sort_order) VALUES
    ('invoice', 'Sales Invoice', 'Standard sales invoice for goods/services', 'file-invoice', 1),
    ('purchase_invoice', 'Purchase Invoice', 'Invoice received from suppliers', 'file-invoice', 2),
    ('quotation', 'Quotation', 'Price quotation for potential sale', 'file-alt', 3),
    ('estimate', 'Estimate', 'Cost estimate for customer', 'file-alt', 4),
    ('delivery_challan', 'Delivery Challan', 'Goods delivery note', 'truck', 5),
    ('credit_note', 'Credit Note', 'Credit note for returns/adjustments', 'file-invoice', 6),
    ('debit_note', 'Debit Note', 'Debit note for additional charges', 'file-invoice', 7),
    ('purchase_order', 'Purchase Order', 'Order placed with supplier', 'shopping-cart', 8)
ON CONFLICT (code) DO NOTHING;

-- Template categories for marketplace
CREATE TABLE IF NOT EXISTS hris_saas.template_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'store',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO hris_saas.template_categories (name, icon, sort_order) VALUES
    ('General Business', 'briefcase', 1),
    ('Restaurant', 'utensils', 2),
    ('Pharmacy', 'pill', 3),
    ('Garments', 'tshirt', 4),
    ('Electronics', 'monitor', 5),
    ('Wholesale', 'warehouse', 6),
    ('Service Business', 'concierge-bell', 7),
    ('Retail', 'store', 8)
ON CONFLICT DO NOTHING;

-- Marketplace templates (published by super admin)
CREATE TABLE IF NOT EXISTS hris_saas.marketplace_templates (
    id UUID PRIMARY KEY,
    category_id INT REFERENCES hris_saas.template_categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    document_types TEXT[] DEFAULT '{invoice}',
    config JSONB NOT NULL DEFAULT '{}',
    thumbnail_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant custom templates (the main multi-template store)
CREATE TABLE IF NOT EXISTS hris_saas.tenant_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    document_types TEXT[] DEFAULT '{invoice}',
    config JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    source VARCHAR(20) DEFAULT 'custom',
    source_template_id UUID,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_templates_tenant ON hris_saas.tenant_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_templates_default ON hris_saas.tenant_templates(tenant_id, is_default);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories ON hris_saas.marketplace_templates(category_id);
