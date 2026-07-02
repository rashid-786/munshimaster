/**
 * Business API Test Script
 * Tests CRUD operations and data integrity for the business section.
 *
 * Usage:
 *   node test-business-api.js
 *
 * Requires:
 *   - Backend server running on http://localhost:5001
 *   - Seed data run via seed-business-data.js
 *
 * Login credentials: phone=+96550000001, password=786123
 */

const BASE = 'http://localhost:5001/api/v1';
const CORE = `${BASE}/core`;

let token, tenantId;
let customerId, supplierId, invoiceId, poId, cnId, dnId;
let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '+96550000001', password: '786123' }),
  });
  const data = await res.json();
  assert(res.ok, 'POST /auth/login — login successful');
  token = data.token;
  tenantId = data.tenant?.id || data.user?.tenantId;
  return data;
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${CORE}${path}`, opts);
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

async function run() {
  console.log('\n=== Logging in ===');
  const loginData = await login();
  if (!token) {
    console.log('  ✗ Login failed — aborting tests');
    process.exit(1);
  }
  console.log(`  Tenant ID: ${tenantId}`);

  // ===== CUSTOMERS =====
  console.log('\n=== Customers ===');
  let r;

  // List customers
  r = await api('GET', '/customers');
  assert(r.status === 200, 'GET /customers — list customers');
  const customersList = r.data?.data || r.data;
  assert(Array.isArray(customersList) && customersList.length === 5, `GET /customers — expected 5, got ${customersList?.length}`);
  customerId = customersList?.[0]?.id;

  // Create customer
  r = await api('POST', '/customers', {
    name: 'Test Customer API', phone: '+919999999999',
    email: 'test@api.com', city: 'Mumbai', state: 'Maharashtra',
    gstin: '27AAAAA0000A1Z5',
  });
  assert(r.status === 201 || r.status === 200, 'POST /customers — create customer');
  const newCustId = r.data?.id || r.data?.customer?.id;

  // Get single customer
  r = await api('GET', `/customers/${customerId}`);
  assert(r.status === 200, `GET /customers/:id — fetch customer`);
  assert(r.data?.name, `GET /customers/:id — has name`);

  // Update customer
  r = await api('PUT', `/customers/${customerId}`, { name: 'Updated Customer Name' });
  assert(r.status === 200, `PUT /customers/:id — update customer`);

  // Delete test customer
  if (newCustId) {
    r = await api('DELETE', `/customers/${newCustId}`);
    assert(r.status === 200, `DELETE /customers/:id — delete customer`);
  }

  // ===== SUPPLIERS =====
  console.log('\n=== Suppliers ===');

  r = await api('GET', '/suppliers');
  assert(r.status === 200, 'GET /suppliers — list suppliers');
  const suppliersList = r.data?.data || r.data;
  assert(Array.isArray(suppliersList) && suppliersList.length === 5, `GET /suppliers — expected 5, got ${suppliersList?.length}`);
  supplierId = suppliersList?.[0]?.id;

  r = await api('POST', '/suppliers', {
    name: 'Test Supplier API', phone: '+918888888888',
    email: 'supplier@api.com', city: 'Pune', state: 'Maharashtra',
    gstin: '27BBBBB0000B1Z5',
  });
  assert(r.status === 201 || r.status === 200, 'POST /suppliers — create supplier');
  const newSuppId = r.data?.id || r.data?.supplier?.id;

  r = await api('GET', `/suppliers/${supplierId}`);
  assert(r.status === 200, `GET /suppliers/:id — fetch supplier`);

  r = await api('PUT', `/suppliers/${supplierId}`, { name: 'Updated Supplier Name' });
  assert(r.status === 200, `PUT /suppliers/:id — update supplier`);

  if (newSuppId) {
    r = await api('DELETE', `/suppliers/${newSuppId}`);
    assert(r.status === 200, `DELETE /suppliers/:id — delete supplier`);
  }

  // ===== INVOICES =====
  console.log('\n=== Invoices ===');

  r = await api('GET', '/invoices');
  assert(r.status === 200, 'GET /invoices — list invoices');
  const invoicesList = r.data?.data || r.data;
  assert(Array.isArray(invoicesList) && invoicesList.length >= 5, `GET /invoices — expected >=5, got ${invoicesList?.length}`);
  invoiceId = invoicesList?.find(inv => inv.status === 'sent')?.id || invoicesList?.[0]?.id;

  r = await api('GET', `/invoices/${invoiceId}`);
  assert(r.status === 200, `GET /invoices/:id — fetch invoice`);
  assert(r.data?.invoice_number, `GET /invoices/:id — has invoice_number`);

  // Download PDF
  r = await api('GET', `/reports/download/pdf?type=customers`);
  assert(r.status === 200, 'GET /reports/download/pdf?type=customers — download PDF');

  // ===== PURCHASE ORDERS =====
  console.log('\n=== Purchase Orders ===');

  r = await api('GET', '/purchase-orders');
  assert(r.status === 200, 'GET /purchase-orders — list POs');
  const poList = r.data?.data || r.data;
  assert(Array.isArray(poList) && poList.length >= 5, `GET /purchase-orders — expected >=5, got ${poList?.length}`);
  poId = poList?.[0]?.id;

  r = await api('GET', `/purchase-orders/${poId}`);
  assert(r.status === 200, `GET /purchase-orders/:id — fetch PO`);
  const singlePo = r.data?.data || r.data;
  assert(singlePo?.po_number, `GET /purchase-orders/:id — has po_number`);

  // ===== DEBIT / CREDIT NOTES =====
  console.log('\n=== Notes (Credit/Debit) ===');

  r = await api('GET', '/notes/credit');
  assert(r.status === 200, 'GET /notes/credit — list credit notes');

  r = await api('GET', '/notes/debit');
  assert(r.status === 200, 'GET /notes/debit — list debit notes');

  // ===== REPORTS =====
  console.log('\n=== Reports ===');

  r = await api('GET', '/reports?type=customers');
  assert(r.status === 200, 'GET /reports?type=customers — customers report');

  r = await api('GET', '/reports?type=suppliers');
  assert(r.status === 200, 'GET /reports?type=suppliers — suppliers report');

  r = await api('GET', '/reports?type=balance&startDate=2026-01-01&endDate=2026-12-31');
  assert(r.status === 200, 'GET /reports?type=balance — balance report');

  r = await api('GET', '/reports?type=ar_aging&startDate=2026-01-01&endDate=2026-12-31');
  assert(r.status === 200, 'GET /reports?type=ar_aging — AR aging');

  r = await api('GET', '/reports?type=ap_aging&startDate=2026-01-01&endDate=2026-12-31');
  assert(r.status === 200, 'GET /reports?type=ap_aging — AP aging');

  r = await api('GET', '/reports?type=invoice_status_summary&startDate=2026-01-01&endDate=2026-12-31');
  assert(r.status === 200, 'GET /reports?type=invoice_status_summary — status summary');

  r = await api('GET', '/reports?type=gst_summary&startDate=2026-01-01&endDate=2026-12-31');
  assert(r.status === 200, 'GET /reports?type=gst_summary — GST summary');

  // ===== RESULTS =====
  console.log('\n==========================');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('==========================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err.message);
  process.exit(1);
});
