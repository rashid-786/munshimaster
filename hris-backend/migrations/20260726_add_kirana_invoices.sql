CREATE TABLE IF NOT EXISTS hris_saas.kirana_invoices (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    party_id VARCHAR(36) NOT NULL,
    party_type VARCHAR(10) NOT NULL,
    party_name VARCHAR(255),
    invoice_date DATE NOT NULL,
    due_date DATE,
    items JSONB,
    subtotal BIGINT NOT NULL DEFAULT 0,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    tax_amount BIGINT NOT NULL DEFAULT 0,
    total_amount BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_kirana_invoices_tenant ON hris_saas.kirana_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kirana_invoices_party ON hris_saas.kirana_invoices(tenant_id, party_id);
CREATE INDEX IF NOT EXISTS idx_kirana_invoices_status ON hris_saas.kirana_invoices(tenant_id, status);
