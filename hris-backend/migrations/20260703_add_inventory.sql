-- Inventory Management
-- Run: psql -f 20260703_add_inventory.sql

SET search_path TO hris_saas, public;

-- 1. Products master
CREATE TABLE IF NOT EXISTS products (
    id                  VARCHAR(36) PRIMARY KEY,
    tenant_id           VARCHAR(36) NOT NULL,
    name                VARCHAR(255) NOT NULL,
    sku                 VARCHAR(100),
    description         TEXT,
    unit                VARCHAR(20) NOT NULL DEFAULT 'pcs',
    opening_stock       INT NOT NULL DEFAULT 0,
    current_stock       INT NOT NULL DEFAULT 0,
    low_stock_threshold INT DEFAULT 0,
    selling_price       INT NOT NULL DEFAULT 0,
    purchase_price      INT DEFAULT 0,
    hsn_code            VARCHAR(20),
    tax_rate            DECIMAL(5,2) DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);

-- 2. Stock movements ledger
CREATE TABLE IF NOT EXISTS stock_movements (
    id              VARCHAR(36) PRIMARY KEY,
    tenant_id       VARCHAR(36) NOT NULL,
    product_id      VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('in','out','opening','adjustment')),
    quantity        INT NOT NULL,
    reference_type  VARCHAR(20) CHECK (reference_type IN ('purchase_order','invoice','manual','opening')),
    reference_id    VARCHAR(36),
    notes           TEXT,
    created_by      VARCHAR(36),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sm_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sm_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sm_reference ON stock_movements(reference_type, reference_id);

-- 3. Link existing line items to products (nullable for backward compat)
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS product_id VARCHAR(36) REFERENCES products(id);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS product_id VARCHAR(36) REFERENCES products(id);
