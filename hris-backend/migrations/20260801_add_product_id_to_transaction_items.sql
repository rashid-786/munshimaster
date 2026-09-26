ALTER TABLE hris_saas.transaction_items ADD COLUMN IF NOT EXISTS product_id VARCHAR(36) REFERENCES hris_saas.products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON hris_saas.transaction_items(product_id);

ALTER TABLE hris_saas.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reference_type_check;
ALTER TABLE hris_saas.stock_movements ADD CONSTRAINT stock_movements_reference_type_check CHECK (reference_type IN ('purchase_order', 'invoice', 'manual', 'opening', 'transaction'));
