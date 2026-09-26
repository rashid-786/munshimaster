-- Composite indexes for core business tables

CREATE INDEX IF NOT EXISTS idx_customers_tenant_created ON hris_saas.customers(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_created ON hris_saas.suppliers(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON hris_saas.invoices(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_created ON hris_saas.purchase_orders(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_created ON hris_saas.employees(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kirana_transactions_tenant_created ON hris_saas.kirana_transactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kirana_parties_tenant_created ON hris_saas.kirana_parties(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_tenant_created ON hris_saas.balance_sheet(tenant_id, created_at);
