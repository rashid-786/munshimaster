-- Invoice Payments for Payment Reconciliation

-- Track individual payments received against invoices
CREATE TABLE IF NOT EXISTS hris_saas.invoice_payments (
    id          VARCHAR(36) PRIMARY KEY,
    tenant_id   VARCHAR(36) NOT NULL,
    invoice_id  VARCHAR(36) NOT NULL,
    amount      INT NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
    payment_date DATE NOT NULL,
    reference   VARCHAR(200),
    notes       TEXT,
    created_by  VARCHAR(36),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_tenant ON hris_saas.invoice_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ip_invoice ON hris_saas.invoice_payments(invoice_id);

-- Add amount_paid column to invoices
ALTER TABLE hris_saas.invoices ADD COLUMN IF NOT EXISTS amount_paid INT NOT NULL DEFAULT 0;
