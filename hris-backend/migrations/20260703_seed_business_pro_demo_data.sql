-- Seed demo data for Business Pro Demo Store (+917838087844)
-- Tenant ID: 27554327-8970-4804-bfb9-f0068fab64f8

BEGIN;

-- Clean existing stale data
DELETE FROM hris_saas.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM hris_saas.purchase_orders WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8');
DELETE FROM hris_saas.invoice_items WHERE invoice_id IN (SELECT id FROM hris_saas.invoices WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8');
DELETE FROM hris_saas.invoice_payments WHERE invoice_id IN (SELECT id FROM hris_saas.invoices WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8');
DELETE FROM hris_saas.purchase_orders WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.invoices WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.balance_sheet WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.products WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.suppliers WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.customers WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.kirana_parties WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';
DELETE FROM hris_saas.kirana_transactions WHERE tenant_id = '27554327-8970-4804-bfb9-f0068fab64f8';

-- ─── Products ─────────────────────────────────────────

INSERT INTO hris_saas.products (id, tenant_id, name, sku, unit, current_stock, selling_price, purchase_price, hsn_code, tax_rate) VALUES
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Premium Basmati Rice', 'RICE-001', 'kg', 500, 85.00, 60.00, '10063090', 5.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Fortune Sunflower Oil', 'OIL-001', 'ltr', 200, 185.00, 155.00, '15121930', 5.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Tata Salt Pack', 'SALT-001', 'pcs', 1000, 18.00, 12.00, '25010010', 5.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Aashirvaad Atta', 'ATTA-001', 'kg', 400, 32.00, 24.00, '11010000', 5.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'MTR Biryani Masala', 'MAS-001', 'pcs', 300, 45.00, 32.00, '21039010', 5.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Ponds Face Powder', 'POND-001', 'pcs', 150, 95.00, 72.00, '33049110', 18.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Colgate Toothpaste', 'COL-001', 'pcs', 600, 85.00, 60.00, '33061010', 18.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Surf Excel Detergent', 'SRF-001', 'kg', 250, 240.00, 185.00, '34022000', 18.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Britannia Biscuits', 'BRI-001', 'pcs', 800, 30.00, 22.00, '19053100', 5.00),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Dairy Milk Chocolate', 'DM-001', 'pcs', 400, 80.00, 62.00, '18069010', 18.00);

-- ─── Customers ────────────────────────────────────────

INSERT INTO hris_saas.customers (id, tenant_id, name, contact_person, email, phone, address, city, state, pincode, gstin, credit_limit, payment_terms, status, created_at) VALUES
  ('c0010001-0000-0000-0000-000000000001', '27554327-8970-4804-bfb9-f0068fab64f8', 'Sharma General Store', 'Rajesh Sharma', 'rajesh@sharma.in', '+919876543201', '12, Sadar Bazaar', 'Delhi', 'Delhi', '110006', '07ABCDE1234F1Z5', 500000, '30 days', 'active', '2026-01-01 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000002', '27554327-8970-4804-bfb9-f0068fab64f8', 'Patel Kirana', 'Amit Patel', 'amit@patel.in', '+919876543202', '45, MG Road', 'Mumbai', 'Maharashtra', '400001', '27ABCDE5678F1Z5', 300000, '15 days', 'active', '2025-06-10 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000003', '27554327-8970-4804-bfb9-f0068fab64f8', 'Singh Enterprises', 'Gurpreet Singh', 'gurpreet@singh.in', '+919876543203', '78, Civil Lines', 'Ludhiana', 'Punjab', '141001', '03ABCDE9012F1Z5', 200000, '30 days', 'active', '2025-07-01 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000004', '27554327-8970-4804-bfb9-f0068fab64f8', 'Verma Traders', 'Suresh Verma', 'suresh@verma.in', '+919876543204', '34, Sector 17', 'Chandigarh', 'Chandigarh', '160017', '04ABCDE3456F1Z5', 400000, '45 days', 'active', '2025-07-15 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000005', '27554327-8970-4804-bfb9-f0068fab64f8', 'Gupta Wholesale', 'Ravi Gupta', 'ravi@gupta.in', '+919876543205', '56, Industrial Area', 'Jaipur', 'Rajasthan', '302001', '08ABCDE7890F1Z5', 600000, '60 days', 'active', '2025-08-01 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000006', '27554327-8970-4804-bfb9-f0068fab64f8', 'Khan Mart', 'Imran Khan', 'imran@khan.in', '+919876543206', '89, Station Road', 'Hyderabad', 'Telangana', '500001', '36ABCDE1234F1Z5', 250000, '30 days', 'active', '2025-08-15 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000007', '27554327-8970-4804-bfb9-f0068fab64f8', 'Desai Agencies', 'Mehul Desai', 'mehul@desai.in', '+919876543207', '23, Commerce House', 'Ahmedabad', 'Gujarat', '380001', '24ABCDE5678F1Z5', 350000, '30 days', 'active', '2025-09-01 00:00:00+00'),
  ('c0010001-0000-0000-0000-000000000008', '27554327-8970-4804-bfb9-f0068fab64f8', 'Joshi Supermarket', 'Anil Joshi', 'anil@joshi.in', '+919876543208', '67, Link Road', 'Pune', 'Maharashtra', '411001', '27ABCDE9012F1Z5', 450000, '45 days', 'active', '2025-09-10 00:00:00+00');

-- ─── Suppliers ────────────────────────────────────────

INSERT INTO hris_saas.suppliers (id, tenant_id, name, contact_person, email, phone, address, city, state, pincode, gstin, payment_terms, status, created_at) VALUES
  ('s0010001-0000-0000-0000-000000000001', '27554327-8970-4804-bfb9-f0068fab64f8', 'ITC Limited', 'Sanjay Kumar', 'sanjay@itc.in', '+919876543101', '37, J L Nehru Road', 'Kolkata', 'West Bengal', '700071', '19ABCDE1234F1Z5', '30 days', 'active', '2025-01-01 00:00:00+00'),
  ('s0010001-0000-0000-0000-000000000002', '27554327-8970-4804-bfb9-f0068fab64f8', 'Hindustan Unilever', 'Priya Mehta', 'priya@hul.in', '+919876543102', '45, BKC', 'Mumbai', 'Maharashtra', '400051', '27ABCDE5678F1Z5', '45 days', 'active', '2025-01-01 00:00:00+00'),
  ('s0010001-0000-0000-0000-000000000003', '27554327-8970-4804-bfb9-f0068fab64f8', 'Nestle India', 'Rohan Das', 'rohan@nestle.in', '+919876543103', '55, MG Road', 'Gurgaon', 'Haryana', '122002', '06ABCDE9012F1Z5', '30 days', 'active', '2025-01-15 00:00:00+00'),
  ('s0010001-0000-0000-0000-000000000004', '27554327-8970-4804-bfb9-f0068fab64f8', 'Parle Products', 'Deepak Shah', 'deepak@parle.in', '+919876543104', '22, MIDC', 'Mumbai', 'Maharashtra', '400093', '27ABCDE3456F1Z5', '15 days', 'active', '2025-02-01 00:00:00+00'),
  ('s0010001-0000-0000-0000-000000000005', '27554327-8970-4804-bfb9-f0068fab64f8', 'Amul Dairy', 'Kiran Patel', 'kiran@amul.in', '+919876543105', '1, Dairy Road', 'Anand', 'Gujarat', '388001', '24ABCDE7890F1Z5', '30 days', 'active', '2025-02-01 00:00:00+00');

-- ─── Invoices ─────────────────────────────────────────

-- Helper: product prices per unit (in paise, stored as integer)
-- Rice: 8500, Oil: 18500, Salt: 1800, Atta: 3200, Masala: 4500
-- Pond: 9500, Colgate: 8500, Surf: 24000, Brit: 3000, DM: 8000

-- Invoice 1 — paid (Jun 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000001', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0001', 'c0010001-0000-0000-0000-000000000001', '2025-06-05', '2025-07-05', 'paid', 102000, 5100, 107100, 107100, '2025-06-05 10:00:00+00', '2025-06-20 10:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000001', 'Premium Basmati Rice', 50, 8500, 425000, '10063090', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000001', 'Fortune Sunflower Oil', 20, 18500, 370000, '15121930', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000001', 'Aashirvaad Atta', 100, 3200, 320000, '11010000', 2.5, 2.5);
INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, created_by, created_at)
VALUES (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'inv-0001-0000-0000-0000-000000000001', 107100, 'online', '2025-06-20', 'a678a567-b375-44c7-aaac-398560d44536', '2025-06-20 10:00:00+00');

-- Invoice 2 — paid (Jul 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000002', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0002', 'c0010001-0000-0000-0000-000000000002', '2025-07-10', '2025-07-25', 'paid', 155500, 7775, 163275, 163275, '2025-07-10 09:00:00+00', '2025-07-22 14:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000002', 'Colgate Toothpaste', 100, 8500, 850000, '33061010', 9, 9),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000002', 'Surf Excel Detergent', 25, 24000, 600000, '34022000', 9, 9),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000002', 'Dairy Milk Chocolate', 50, 8000, 400000, '18069010', 9, 9);
INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, created_by, created_at)
VALUES (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'inv-0001-0000-0000-0000-000000000002', 163275, 'cheque', '2025-07-22', 'a678a567-b375-44c7-aaac-398560d44536', '2025-07-22 14:00:00+00');

-- Invoice 3 — paid (Aug 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000003', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0003', 'c0010001-0000-0000-0000-000000000003', '2025-08-05', '2025-09-05', 'paid', 89000, 4450, 93450, 93450, '2025-08-05 11:00:00+00', '2025-08-28 09:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000003', 'MTR Biryani Masala', 80, 4500, 360000, '21039010', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000003', 'Tata Salt Pack', 300, 1800, 540000, '25010010', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000003', 'Britannia Biscuits', 200, 3000, 600000, '19053100', 2.5, 2.5);
INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, created_by, created_at)
VALUES (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'inv-0001-0000-0000-0000-000000000003', 93450, 'cash', '2025-08-28', 'a678a567-b375-44c7-aaac-398560d44536', '2025-08-28 09:00:00+00');

-- Invoice 4 — sent/unpaid (Sep 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000004', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0004', 'c0010001-0000-0000-0000-000000000004', '2025-09-01', '2025-10-16', 'sent', 210000, 10500, 220500, 0, '2025-09-01 08:00:00+00', '2025-09-01 08:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000004', 'Ponds Face Powder', 50, 9500, 475000, '33049110', 9, 9),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000004', 'Dairy Milk Chocolate', 100, 8000, 800000, '18069010', 9, 9),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000004', 'Fortune Sunflower Oil', 40, 18500, 740000, '15121930', 2.5, 2.5);

-- Invoice 5 — overdue (Jul 2025, still unpaid)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000005', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0005', 'c0010001-0000-0000-0000-000000000005', '2025-07-15', '2025-08-15', 'overdue', 130000, 6500, 136500, 0, '2025-07-15 10:00:00+00', '2025-07-15 10:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000005', 'Premium Basmati Rice', 80, 8500, 680000, '10063090', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000005', 'Aashirvaad Atta', 150, 3200, 480000, '11010000', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000005', 'Surf Excel Detergent', 10, 24000, 240000, '34022000', 9, 9);

-- Invoice 6 — partial payment (Aug 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000006', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0006', 'c0010001-0000-0000-0000-000000000006', '2025-08-20', '2025-09-20', 'partial', 95000, 4750, 99750, 50000, '2025-08-20 09:00:00+00', '2025-09-05 10:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000006', 'Colgate Toothpaste', 50, 8500, 425000, '33061010', 9, 9),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000006', 'Britannia Biscuits', 150, 3000, 450000, '19053100', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000006', 'MTR Biryani Masala', 30, 4500, 135000, '21039010', 2.5, 2.5);
INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, created_by, created_at)
VALUES (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'inv-0001-0000-0000-0000-000000000006', 50000, 'cash', '2025-09-05', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-05 10:00:00+00');

-- Invoice 7 — paid (Sep 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000007', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0007', 'c0010001-0000-0000-0000-000000000007', '2025-09-10', '2025-10-10', 'paid', 180000, 9000, 189000, 189000, '2025-09-10 10:00:00+00', '2025-09-25 11:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000007', 'Premium Basmati Rice', 100, 8500, 850000, '10063090', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000007', 'Tata Salt Pack', 500, 1800, 900000, '25010010', 2.5, 2.5),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000007', 'Ponds Face Powder', 30, 9500, 285000, '33049110', 9, 9);
INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, created_by, created_at)
VALUES (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'inv-0001-0000-0000-0000-000000000007', 189000, 'online', '2025-09-25', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-25 11:00:00+00');

-- Invoice 8 — draft (Oct 2025)
INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at, gst_type)
VALUES ('inv-0001-0000-0000-0000-000000000008', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-INV-2025-0008', 'c0010001-0000-0000-0000-000000000008', '2025-10-01', '2025-11-01', 'draft', 72000, 3600, 75600, 0, '2025-10-01 08:00:00+00', '2025-10-01 08:00:00+00', 'intra');
INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000008', 'Dairy Milk Chocolate', 60, 8000, 480000, '18069010', 9, 9),
  (gen_random_uuid()::text, 'inv-0001-0000-0000-0000-000000000008', 'Britannia Biscuits', 100, 3000, 300000, '19053100', 2.5, 2.5);

-- ─── Purchase Orders ──────────────────────────────────

INSERT INTO hris_saas.purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, created_at, updated_at, gst_type)
VALUES ('po-0001-0000-0000-0000-000000000001', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-PO-2025-0001', 's0010001-0000-0000-0000-000000000001', '2026-01-01', '2025-06-15', 'received', 112000, 5600, 117600, '2026-01-01 09:00:00+00', '2025-06-14 10:00:00+00', 'intra');
INSERT INTO hris_saas.purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000001', 'Aashirvaad Atta', 200, 2400, 480000, '11010000', 2.5, 2.5),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000001', 'Tata Salt Pack', 400, 1200, 480000, '25010010', 2.5, 2.5),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000001', 'Britannia Biscuits', 300, 2200, 660000, '19053100', 2.5, 2.5);

INSERT INTO hris_saas.purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, created_at, updated_at, gst_type)
VALUES ('po-0001-0000-0000-0000-000000000002', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-PO-2025-0002', 's0010001-0000-0000-0000-000000000002', '2025-07-01', '2025-07-20', 'received', 235000, 11750, 246750, '2025-07-01 10:00:00+00', '2025-07-18 11:00:00+00', 'intra');
INSERT INTO hris_saas.purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000002', 'Colgate Toothpaste', 150, 6000, 900000, '33061010', 9, 9),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000002', 'Surf Excel Detergent', 40, 18500, 740000, '34022000', 9, 9),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000002', 'Ponds Face Powder', 60, 7200, 432000, '33049110', 9, 9);

INSERT INTO hris_saas.purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, created_at, updated_at, gst_type)
VALUES ('po-0001-0000-0000-0000-000000000003', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-PO-2025-0003', 's0010001-0000-0000-0000-000000000003', '2025-08-01', '2025-08-25', 'approved', 87000, 4350, 91350, '2025-08-01 08:00:00+00', '2025-08-05 09:00:00+00', 'intra');
INSERT INTO hris_saas.purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000003', 'Dairy Milk Chocolate', 80, 6200, 496000, '18069010', 9, 9),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000003', 'MTR Biryani Masala', 100, 3200, 320000, '21039010', 2.5, 2.5),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000003', 'Premium Basmati Rice', 30, 6000, 180000, '10063090', 2.5, 2.5);

INSERT INTO hris_saas.purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, created_at, updated_at, gst_type)
VALUES ('po-0001-0000-0000-0000-000000000004', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-PO-2025-0004', 's0010001-0000-0000-0000-000000000004', '2025-09-01', '2025-09-20', 'sent', 62000, 3100, 65100, '2025-09-01 09:00:00+00', '2025-09-01 09:00:00+00', 'intra');
INSERT INTO hris_saas.purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000004', 'Parle Biscuits Assorted', 200, 2200, 440000, '19053100', 2.5, 2.5),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000004', 'Fortune Sunflower Oil', 15, 15500, 232500, '15121930', 2.5, 2.5);

INSERT INTO hris_saas.purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, created_at, updated_at, gst_type)
VALUES ('po-0001-0000-0000-0000-000000000005', '27554327-8970-4804-bfb9-f0068fab64f8', 'BP-PO-2025-0005', 's0010001-0000-0000-0000-000000000005', '2025-09-15', '2025-10-05', 'draft', 150000, 7500, 157500, '2025-09-15 10:00:00+00', '2025-09-15 10:00:00+00', 'intra');
INSERT INTO hris_saas.purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate) VALUES
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000005', 'Amul Butter', 100, 12000, 1200000, '04051000', 2.5, 2.5),
  (gen_random_uuid()::text, 'po-0001-0000-0000-0000-000000000005', 'Amul Cheese', 50, 18000, 900000, '04061000', 5, 5);

-- ─── Balance Sheet (Expenses) ──────────────────────────

INSERT INTO hris_saas.balance_sheet (id, tenant_id, type, payment_method, amount, description, entry_date, created_by, created_at) VALUES
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 15000, 'Shop electricity bill - June', '2025-06-10', 'a678a567-b375-44c7-aaac-398560d44536', '2025-06-10 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'online', 25000, 'Monthly rent - June', '2026-01-01', 'a678a567-b375-44c7-aaac-398560d44536', '2026-01-01 09:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 85000, 'Staff salaries - June', '2025-06-28', 'a678a567-b375-44c7-aaac-398560d44536', '2025-06-28 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 12000, 'Shop electricity bill - July', '2025-07-10', 'a678a567-b375-44c7-aaac-398560d44536', '2025-07-10 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'online', 25000, 'Monthly rent - July', '2025-07-01', 'a678a567-b375-44c7-aaac-398560d44536', '2025-07-01 09:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 85000, 'Staff salaries - July', '2025-07-28', 'a678a567-b375-44c7-aaac-398560d44536', '2025-07-28 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 14000, 'Shop electricity bill - August', '2025-08-10', 'a678a567-b375-44c7-aaac-398560d44536', '2025-08-10 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'online', 25000, 'Monthly rent - August', '2025-08-01', 'a678a567-b375-44c7-aaac-398560d44536', '2025-08-01 09:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 85000, 'Staff salaries - August', '2025-08-28', 'a678a567-b375-44c7-aaac-398560d44536', '2025-08-28 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 11000, 'Shop electricity bill - September', '2025-09-10', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-10 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'online', 25000, 'Monthly rent - September', '2025-09-01', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-01 09:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'OUT', 'cash', 85000, 'Staff salaries - September', '2025-09-28', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-28 10:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'IN', 'cash', 50000, 'Cash deposit - counter sale', '2025-09-15', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-15 12:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'IN', 'online', 150000, 'Bank deposit - invoice payment', '2025-09-20', 'a678a567-b375-44c7-aaac-398560d44536', '2025-09-20 14:00:00+00');

-- ─── Additional Employees ─────────────────────────────

-- Note: password_hash is a bcrypt hash of 'Password@123'
INSERT INTO hris_saas.employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, job_type, base_salary, profession, status, created_at)
VALUES
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Vikram', 'Singh', 'vikram@business-pro.com', '+919876543211', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm4mD3z0qGq3q3q3q3q', 'employee', 'permanent', 35000, 'Cashier', 'active', '2025-01-15 00:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Priya', 'Sharma', 'priya@business-pro.com', '+919876543212', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm4mD3z0qGq3q3q3q3q', 'employee', 'permanent', 28000, 'Sales Assistant', 'active', '2025-02-01 00:00:00+00'),
  (gen_random_uuid()::text, '27554327-8970-4804-bfb9-f0068fab64f8', 'Rahul', 'Verma', 'rahul@business-pro.com', '+919876543213', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkfAjkMBcGm4mD3z0qGq3q3q3q3q', 'employee', 'adhoc', 22000, 'Store Keeper', 'active', '2025-03-01 00:00:00+00');

COMMIT;
