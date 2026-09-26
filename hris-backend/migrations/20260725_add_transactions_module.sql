-- Transactions Master Module
-- Supports: sales_invoice, payment_in, sales_return, credit_note,
--           delivery_challan, quotation, proforma_invoice,
--           purchase_invoice, payment_out, purchase_return, debit_note, purchase_order

CREATE TABLE IF NOT EXISTS hris_saas.transactions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
    transaction_type VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('sales','purchase')),

    document_number VARCHAR(100) NOT NULL,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Party
    party_id VARCHAR(36),
    party_type VARCHAR(10) CHECK (party_type IN ('customer','supplier')),
    party_name VARCHAR(255),
    party_gstin VARCHAR(20),
    party_pan VARCHAR(15),
    party_address TEXT,
    party_city VARCHAR(100),
    party_state VARCHAR(100),
    party_country VARCHAR(100),
    party_postal_code VARCHAR(20),

    -- Addresses
    billing_address TEXT,
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_country VARCHAR(100),
    billing_postal_code VARCHAR(20),
    shipping_address TEXT,
    shipping_address_line2 VARCHAR(255),
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_country VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    same_as_billing BOOLEAN DEFAULT false,

    -- Reference
    reference_number VARCHAR(100),  -- PO number, original invoice ref, etc.
    reference_type VARCHAR(50),     -- what the reference_number refers to

    -- Financial (in cents/paise)
    subtotal BIGINT DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    taxable_amount BIGINT DEFAULT 0,
    cgst_amount BIGINT DEFAULT 0,
    sgst_amount BIGINT DEFAULT 0,
    igst_amount BIGINT DEFAULT 0,
    round_off BIGINT DEFAULT 0,
    grand_total BIGINT DEFAULT 0,
    amount_paid BIGINT DEFAULT 0,
    balance_due BIGINT DEFAULT 0,

    -- Payment fields (for payment_in / payment_out)
    payment_date DATE,
    payment_mode VARCHAR(30),
    payment_reference VARCHAR(200),

    -- Dates
    due_date DATE,
    valid_until DATE,
    expected_delivery_date DATE,

    -- GST
    gst_type VARCHAR(10) CHECK (gst_type IN ('intra','inter')),
    place_of_supply VARCHAR(100),

    -- Terms & notes
    payment_terms TEXT,
    terms_conditions TEXT,
    reason TEXT,
    notes TEXT,

    -- Delivery Challan specific
    vehicle_number VARCHAR(50),
    transporter VARCHAR(200),
    challan_type VARCHAR(50),

    -- Signatory
    authorized_signatory VARCHAR(200),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Audit
    created_by VARCHAR(36),
    updated_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by VARCHAR(36),
    cancel_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON hris_saas.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_party ON hris_saas.transactions(party_id, party_type);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON hris_saas.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_direction ON hris_saas.transactions(direction);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON hris_saas.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON hris_saas.transactions(document_date);

-- Line Items
CREATE TABLE IF NOT EXISTS hris_saas.transaction_items (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL REFERENCES hris_saas.transactions(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    hsn_sac VARCHAR(20),
    quantity NUMERIC DEFAULT 1,
    unit VARCHAR(20),
    rate BIGINT DEFAULT 0,
    discount_percent NUMERIC DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    taxable_value BIGINT DEFAULT 0,
    gst_rate NUMERIC DEFAULT 0,
    cgst_amount BIGINT DEFAULT 0,
    sgst_amount BIGINT DEFAULT 0,
    igst_amount BIGINT DEFAULT 0,
    total_amount BIGINT DEFAULT 0,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_txn ON hris_saas.transaction_items(transaction_id);

-- Payment Allocations
CREATE TABLE IF NOT EXISTS hris_saas.transaction_payments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
    payment_transaction_id VARCHAR(36) NOT NULL REFERENCES hris_saas.transactions(id) ON DELETE CASCADE,
    allocated_to_id VARCHAR(36) NOT NULL,
    allocated_to_type VARCHAR(50) NOT NULL,
    amount_allocated BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_txn_payments_payment ON hris_saas.transaction_payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_txn_payments_allocated ON hris_saas.transaction_payments(allocated_to_id);

-- Document Conversions / References
CREATE TABLE IF NOT EXISTS hris_saas.transaction_references (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
    source_id VARCHAR(36) NOT NULL REFERENCES hris_saas.transactions(id) ON DELETE CASCADE,
    target_id VARCHAR(36) NOT NULL REFERENCES hris_saas.transactions(id) ON DELETE CASCADE,
    conversion_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_txn_refs_source ON hris_saas.transaction_references(source_id);
CREATE INDEX IF NOT EXISTS idx_txn_refs_target ON hris_saas.transaction_references(target_id);

-- Auto-numbering Sequences
CREATE TABLE IF NOT EXISTS hris_saas.document_sequences (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL REFERENCES hris_saas.tenants(id),
    transaction_type VARCHAR(50) NOT NULL,
    prefix VARCHAR(20) NOT NULL,
    last_number INT DEFAULT 0,
    year VARCHAR(4),
    UNIQUE(tenant_id, transaction_type, year)
);

CREATE INDEX IF NOT EXISTS idx_doc_sequences_tenant ON hris_saas.document_sequences(tenant_id, transaction_type);
