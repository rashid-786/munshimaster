-- New columns for products table
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS reorder_level DECIMAL(12,2) DEFAULT 0;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS opening_stock_as_of DATE;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS stock_tracking_enabled BOOLEAN DEFAULT true;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS sale_price_type VARCHAR(20) DEFAULT 'exclusive';
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS purchase_price_type VARCHAR(20) DEFAULT 'exclusive';
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS effective_sale_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS effective_purchase_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS product_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE hris_saas.products ADD COLUMN IF NOT EXISTS gst_rate_id VARCHAR(36);

-- Party-specific pricing table
CREATE TABLE IF NOT EXISTS hris_saas.product_party_prices (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    product_id VARCHAR(36) NOT NULL REFERENCES hris_saas.products(id) ON DELETE CASCADE,
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('customer', 'supplier')),
    party_id VARCHAR(36) NOT NULL,
    custom_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    effective_price DECIMAL(12,2) DEFAULT 0,
    effective_from DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_party_prices_product ON hris_saas.product_party_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_party_prices_party ON hris_saas.product_party_prices(party_type, party_id);
