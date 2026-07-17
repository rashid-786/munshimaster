// Comprehensive seed data generator
// Usage: node seed-transactions.js

const db = require('./config/db');
const { v4: uuidv4 } = require('uuid');

const TID = '3ec6956e-3495-40fb-a9d1-dfc989948ab2';
const CUSTOMERS = [
  { id: 'af7fa2b3-2437-4da0-91ff-7af37bcd299c', name: 'Gupta Enterprises', gstin: '27AABCG1234A1Z5', state: 'Maharashtra', city: 'Mumbai' },
  { id: 'cc8a2bc3-3ce1-4f96-9bca-0a05fd8949f8', name: 'Mehta Distributors', gstin: '24AABCM5678A1Z2', state: 'Gujarat', city: 'Ahmedabad' },
  { id: 'b1ce893f-c0b3-48fa-a297-5b37922231f1', name: 'Patel Trading Co.', gstin: '36AABCP9012A1Z8', state: 'Gujarat', city: 'Surat' },
  { id: '22248a4f-e73d-44b1-9fb9-9bd99e975d59', name: 'Sharma Electricals', gstin: '07AABCS3456A1Z4', state: 'Delhi', city: 'Delhi' },
  { id: '77c00c6f-2183-44c4-aa8d-a3893860b33b', name: 'Singh Hardware Store', gstin: '03AABCT7890A1Z1', state: 'Punjab', city: 'Ludhiana' },
];
const SUPPLIERS = [
  { id: 'd4aa1240-7716-47bc-9bcb-2e020e846e3c', name: 'Bajaj Packaging Solutions', gstin: '27AACBB3456A1Z2', state: 'Maharashtra', city: 'Mumbai' },
  { id: 'e791bba2-e86a-4e97-b08c-19fd8336ce57', name: 'Delhi Office Essentials', gstin: '07AACBD7890A1Z5', state: 'Delhi', city: 'Delhi' },
  { id: '23b89fda-093e-4ef6-9f9b-8734dafa358a', name: 'Greenfield Agri Products', gstin: '36AABCG9012A1Z8', state: 'Gujarat', city: 'Vadodara' },
  { id: '935d98b5-165d-488d-bf71-3d8f9ecd0408', name: 'Reliance Digital Distributors', gstin: '24AABCR5678A1Z4', state: 'Gujarat', city: 'Rajkot' },
  { id: '37022ae5-8500-4e69-9114-fe9883926543', name: 'Tata Steel Supply', gstin: '27AAACT1234A1Z6', state: 'Maharashtra', city: 'Pune' },
];
const GST_RATES = [
  'gst-06', // 5%
  'gst-09', // 12%
  'gst-12', // 18%
  'gst-13', // 28%
];
const UNITS = ['unit-01', 'unit-03', 'unit-06', 'unit-07', 'unit-16', 'unit-20', 'unit-23'];

let createdProducts = [];
let createdSalesInvoices = [];
let createdPurchaseInvoices = [];

function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function itemRate(priceInRupees) {
  return Math.round(priceInRupees * 100);
}

async function run() {
  console.log('=== Starting Seed Data Generation ===\n');

  // ── PRODUCTS ────────────────────────────────────
  console.log('--- Creating Products ---');
  const productData = [
  { name: 'Premium Cotton T-Shirt', sku: 'APP-TSH-001', unit: 'Piece', category: 'Apparel', hsn_code: '610910', selling_price: 599, purchase_price: 350, gst_rate_id: 'gst-06', tax_rate: 5, opening_stock: 500 },
  { name: 'Executive Leather Wallet', sku: 'ACC-WAL-002', unit: 'Piece', category: 'Accessories', hsn_code: '420231', selling_price: 1299, purchase_price: 750, gst_rate_id: 'gst-09', tax_rate: 12, opening_stock: 200 },
  { name: 'Stainless Steel Water Bottle 1L', sku: 'HOM-BOT-003', unit: 'Bottle', category: 'Home', hsn_code: '732393', selling_price: 849, purchase_price: 480, gst_rate_id: 'gst-12', tax_rate: 18, opening_stock: 300 },
  { name: 'Wireless Bluetooth Earbuds', sku: 'ELC-EAR-004', unit: 'Pair', category: 'Electronics', hsn_code: '851830', selling_price: 2499, purchase_price: 1500, gst_rate_id: 'gst-09', tax_rate: 12, opening_stock: 150 },
  { name: 'Organic Green Tea - 100 Bags', sku: 'GRO-TEA-005', unit: 'Pack', category: 'Groceries', hsn_code: '090210', selling_price: 349, purchase_price: 200, gst_rate_id: 'gst-06', tax_rate: 5, opening_stock: 400 },
  { name: 'LED Desk Lamp 12W', sku: 'ELC-LMP-006', unit: 'Piece', category: 'Electronics', hsn_code: '940510', selling_price: 1299, purchase_price: 700, gst_rate_id: 'gst-09', tax_rate: 12, opening_stock: 180 },
  { name: 'Basmati Rice 5kg', sku: 'GRO-RCE-007', unit: 'Kg', category: 'Groceries', hsn_code: '100630', selling_price: 699, purchase_price: 450, gst_rate_id: 'gst-06', tax_rate: 5, opening_stock: 250 },
  { name: 'Office Desk Chair Ergonomic', sku: 'FUR-CHR-008', unit: 'Piece', category: 'Furniture', hsn_code: '940130', selling_price: 7999, purchase_price: 4500, gst_rate_id: 'gst-12', tax_rate: 18, opening_stock: 50 },
  { name: 'Natural Honey 500g', sku: 'GRO-HON-009', unit: 'Jar', category: 'Groceries', hsn_code: '040900', selling_price: 449, purchase_price: 280, gst_rate_id: 'gst-06', tax_rate: 5, opening_stock: 350 },
  { name: 'Smart Watch Fitness Tracker', sku: 'ELC-WCH-010', unit: 'Piece', category: 'Electronics', hsn_code: '851762', selling_price: 3999, purchase_price: 2200, gst_rate_id: 'gst-09', tax_rate: 12, opening_stock: 100 },
  { name: 'Cotton bedsheet Set Double', sku: 'HOM-BED-011', unit: 'Set', category: 'Home', hsn_code: '630210', selling_price: 1599, purchase_price: 950, gst_rate_id: 'gst-06', tax_rate: 5, opening_stock: 120 },
  { name: 'Multipurpose Tool Kit 20-pc', sku: 'HRD-TLS-012', unit: 'Set', category: 'Hardware', hsn_code: '820600', selling_price: 1999, purchase_price: 1100, gst_rate_id: 'gst-12', tax_rate: 18, opening_stock: 80 },
  ];

  for (const p of productData) {
    try {
      const id = uuidv4();
      const tax = p.gst_rate_id === 'gst-06' ? 5 : p.gst_rate_id === 'gst-09' ? 12 : p.gst_rate_id === 'gst-12' ? 18 : 28;
      const effectiveSale = p.selling_price * (1 + tax / 100);
      await db.execute(`INSERT INTO hris_saas.products (id, tenant_id, name, sku, unit, category, hsn_code,
        selling_price, purchase_price, opening_stock, current_stock, tax_rate, gst_rate_id,
        effective_sale_price, effective_purchase_price, product_status, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`,
        [id, TID, p.name, p.sku, p.unit, p.category, p.hsn_code,
         p.selling_price, p.purchase_price, p.opening_stock, p.opening_stock, tax, p.gst_rate_id,
         effectiveSale, p.purchase_price, 'active']);
      createdProducts.push({ id, ...p, tax });
      console.log(`  ✓ ${p.name} (${p.sku})`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { console.log(`  ~ ${p.name} already exists`); }
      else { console.error(`  ✗ ${p.name}: ${e.message}`); }
    }
  }
  console.log(`  → ${createdProducts.length} products\n`);

  // If no products created, fetch existing
  if (createdProducts.length === 0) {
    const [rows] = await db.execute('SELECT * FROM hris_saas.products WHERE tenant_id = ?', [TID]);
    createdProducts = rows;
    console.log(`  → Loaded ${createdProducts.length} existing products\n`);
  }

  // ── SALES TRANSACTIONS ───────────────────────────
  console.log('--- Creating Sales Transactions ---');

  for (let i = 0; i < CUSTOMERS.length; i++) {
    const c = CUSTOMERS[i];
    const docDate = addDays(new Date('2026-07-01'), i * 3);
    const items = createdProducts.slice(i * 2, i * 2 + 3).filter(Boolean);

    if (items.length === 0) continue;

    // Sales Invoice
    await createTransaction({
      transaction_type: 'sales_invoice',
      party_id: c.id, party_name: c.name, party_gstin: c.gstin,
      party_state: c.state, party_city: c.city, party_country: 'India',
      document_date: fmtDate(docDate),
      due_date: fmtDate(addDays(docDate, 30)),
      place_of_supply: c.state,
      gst_type: 'intra',
      status: i === 0 ? 'draft' : i === 1 ? 'sent' : i === 2 ? 'partial' : i === 3 ? 'paid' : 'overdue',
      items: items.map((p, idx) => ({
        item_name: p.name, hsn_sac: p.hsn_code, quantity: i + 1,
        unit: p.unit, rate: itemRate(p.selling_price),
        gst_rate: p.tax, discount_percent: i === 2 ? 5 : 0,
      })),
      notes: `Sales invoice seed #${i + 1}`,
    });

    // Quotation
    await createTransaction({
      transaction_type: 'quotation',
      party_id: c.id, party_name: c.name, party_gstin: c.gstin,
      party_state: c.state, party_city: c.city, party_country: 'India',
      document_date: fmtDate(addDays(docDate, -5)),
      due_date: fmtDate(addDays(docDate, 25)),
      place_of_supply: c.state,
      gst_type: 'intra',
      status: i === 0 ? 'draft' : i === 1 ? 'sent' : i === 4 ? 'expired' : 'accepted',
      items: items.slice(0, 2).map((p, idx) => ({
        item_name: p.name, hsn_sac: p.hsn_code, quantity: i + 2,
        unit: p.unit, rate: itemRate(p.selling_price * 1.05),
        gst_rate: p.tax,
      })),
    });

    // Proforma Invoice
    if (i < 3) {
      await createTransaction({
        transaction_type: 'proforma_invoice',
        party_id: c.id, party_name: c.name, party_gstin: c.gstin,
        party_state: c.state, party_city: c.city, party_country: 'India',
        document_date: fmtDate(addDays(docDate, 1)),
        due_date: fmtDate(addDays(docDate, 15)),
        place_of_supply: c.state,
        gst_type: 'intra',
        status: i === 0 ? 'draft' : 'sent',
        items: items.slice(0, 1).map((p, idx) => ({
          item_name: p.name, hsn_sac: p.hsn_code, quantity: 1,
          unit: p.unit, rate: itemRate(p.selling_price),
          gst_rate: p.tax,
        })),
      });
    }

    // Delivery Challan
    if (i < 4) {
      await createTransaction({
        transaction_type: 'delivery_challan',
        party_id: c.id, party_name: c.name, party_gstin: c.gstin,
        party_state: c.state, party_city: c.city, party_country: 'India',
        document_date: fmtDate(addDays(docDate, 2)),
        due_date: fmtDate(addDays(docDate, 7)),
        place_of_supply: c.state,
        gst_type: 'intra',
        challan_type: ['delivery', 'sample', 'return', 'job_work'][i],
        status: i === 0 ? 'draft' : i === 1 ? 'sent' : i === 2 ? 'delivered' : 'delivered',
        items: items.slice(0, 2).map((p, idx) => ({
          item_name: p.name, hsn_sac: p.hsn_code, quantity: i + 1,
          unit: p.unit, rate: itemRate(p.selling_price),
          gst_rate: p.tax,
        })),
      });
    }
  }

  // Sales Return (using last invoice as reference)
  if (createdSalesInvoices.length > 1) {
    const refInv = createdSalesInvoices[0];
    const c = CUSTOMERS[0];
    await createTransaction({
      transaction_type: 'sales_return',
      party_id: c.id, party_name: c.name, party_gstin: c.gstin,
      party_state: c.state, party_city: c.city, party_country: 'India',
      document_date: fmtDate(addDays(new Date(), -1)),
      reference_number: refInv.doc_number,
      reference_type: 'sales_invoice',
      gst_type: 'intra',
      status: 'draft',
      reason: 'Damaged goods returned by customer',
      items: [{ item_name: 'Return Item', quantity: 2, rate: 50000, gst_rate: 18, hsn_sac: '610910' }],
    });
  }

  // Credit Note
  if (createdSalesInvoices.length > 2) {
    const refInv = createdSalesInvoices[1];
    const c = CUSTOMERS[1];
    await createTransaction({
      transaction_type: 'credit_note',
      party_id: c.id, party_name: c.name, party_gstin: c.gstin,
      party_state: c.state, party_city: c.city, party_country: 'India',
      document_date: fmtDate(new Date()),
      reference_number: refInv.doc_number,
      reference_type: 'sales_invoice',
      gst_type: 'intra',
      status: 'issued',
      reason: 'Price adjustment - incorrect billing',
      items: [{ item_name: 'Credit Adjustment', quantity: 1, rate: 25000, gst_rate: 12, hsn_sac: '420231' }],
    });
  }

  // Payment Received (against first paid invoice)
  if (createdSalesInvoices.length > 0) {
    const inv = createdSalesInvoices.find(s => s.status === 'paid') || createdSalesInvoices[3];
    if (inv) {
      await createTransaction({
        transaction_type: 'payment_in',
        party_id: inv.party_id, party_name: inv.party_name,
        document_date: fmtDate(addDays(new Date(inv.doc_date), 15)),
        payment_mode: 'bank', payment_reference: 'NEFT-REF-' + Date.now().toString(36).toUpperCase(),
        status: 'completed',
        payments: [{ allocated_to_id: inv.id, allocated_to_type: 'sales_invoice', amount_allocated: inv.grand_total }],
        notes: 'Payment received via bank transfer',
      });
    }
  }

  console.log(`  → Sales Invoices: ${createdSalesInvoices.length}`);
  console.log(`  → Other Sales docs: Quotations, Proformas, Challans, Returns, Credit Notes, Payments\n`);

  // ── PURCHASE TRANSACTIONS ────────────────────────
  console.log('--- Creating Purchase Transactions ---');

  for (let i = 0; i < SUPPLIERS.length; i++) {
    const s = SUPPLIERS[i];
    const docDate = addDays(new Date('2026-06-15'), i * 4);
    const items = createdProducts.slice(i * 2, i * 2 + 3).filter(Boolean);

    if (items.length === 0) continue;

    // Purchase Invoice
    await createTransaction({
      transaction_type: 'purchase_invoice',
      party_id: s.id, party_name: s.name, party_gstin: s.gstin,
      party_state: s.state, party_city: s.city, party_country: 'India',
      document_date: fmtDate(docDate),
      due_date: fmtDate(addDays(docDate, 30)),
      place_of_supply: s.state,
      gst_type: 'intra',
      status: i === 0 ? 'draft' : i === 1 ? 'sent' : i === 2 ? 'partial' : i === 3 ? 'paid' : 'overdue',
      items: items.map((p, idx) => ({
        item_name: p.name, hsn_sac: p.hsn_code, quantity: i + 2,
        unit: p.unit, rate: itemRate(p.purchase_price),
        gst_rate: p.tax, discount_percent: i === 2 ? 3 : 0,
      })),
      notes: `Purchase invoice seed #${i + 1}`,
    });

    // Purchase Order
    await createTransaction({
      transaction_type: 'purchase_order',
      party_id: s.id, party_name: s.name, party_gstin: s.gstin,
      party_state: s.state, party_city: s.city, party_country: 'India',
      document_date: fmtDate(addDays(docDate, -7)),
      due_date: fmtDate(addDays(docDate, 23)),
      place_of_supply: s.state,
      gst_type: 'intra',
      status: i === 0 ? 'draft' : i === 1 ? 'sent' : i === 4 ? 'cancelled' : 'approved',
      items: items.slice(0, 2).map((p, idx) => ({
        item_name: p.name, hsn_sac: p.hsn_code, quantity: i + 3,
        unit: p.unit, rate: itemRate(p.purchase_price),
        gst_rate: p.tax,
      })),
      notes: `Purchase order for ${s.name}`,
    });
  }

  // Purchase Return
  if (createdPurchaseInvoices.length > 1) {
    const refInv = createdPurchaseInvoices[0];
    const s = SUPPLIERS[0];
    await createTransaction({
      transaction_type: 'purchase_return',
      party_id: s.id, party_name: s.name, party_gstin: s.gstin,
      party_state: s.state, party_city: s.city, party_country: 'India',
      document_date: fmtDate(addDays(new Date(), -2)),
      reference_number: refInv.doc_number,
      reference_type: 'purchase_invoice',
      gst_type: 'intra',
      status: 'draft',
      reason: 'Defective items returned to supplier',
      items: [{ item_name: 'Return Item', quantity: 1, rate: 35000, gst_rate: 5, hsn_sac: '610910' }],
    });
  }

  // Debit Note
  if (createdPurchaseInvoices.length > 2) {
    const refInv = createdPurchaseInvoices[1];
    const s = SUPPLIERS[1];
    await createTransaction({
      transaction_type: 'debit_note',
      party_id: s.id, party_name: s.name, party_gstin: s.gstin,
      party_state: s.state, party_city: s.city, party_country: 'India',
      document_date: fmtDate(new Date()),
      reference_number: refInv.doc_number,
      reference_type: 'purchase_invoice',
      gst_type: 'intra',
      status: 'issued',
      reason: 'Rate discrepancy - supplier billed higher',
      items: [{ item_name: 'Price Difference', quantity: 1, rate: 15000, gst_rate: 12, hsn_sac: '420231' }],
    });
  }

  // Payment Out (against first paid purchase invoice)
  if (createdPurchaseInvoices.length > 0) {
    const inv = createdPurchaseInvoices.find(s => s.status === 'paid') || createdPurchaseInvoices[3];
    if (inv) {
      await createTransaction({
        transaction_type: 'payment_out',
        party_id: inv.party_id, party_name: inv.party_name,
        document_date: fmtDate(addDays(new Date(inv.doc_date), 20)),
        payment_mode: 'bank', payment_reference: 'RTGS-REF-' + Date.now().toString(36).toUpperCase(),
        status: 'completed',
        payments: [{ allocated_to_id: inv.id, allocated_to_type: 'purchase_invoice', amount_allocated: inv.grand_total }],
        notes: 'Payment made via RTGS',
      });
    }
  }

  console.log(`  → Purchase Invoices: ${createdPurchaseInvoices.length}`);
  console.log(`  → Other Purchase docs: Orders, Returns, Debit Notes, Payments\n`);

  // ── SUMMARY ──────────────────────────────────────
  console.log('=== Seed Data Generation Complete ===');
  const [allTxns] = await db.execute(
    'SELECT transaction_type, status, count(*) as cnt FROM hris_saas.transactions WHERE tenant_id = ? GROUP BY transaction_type, status ORDER BY transaction_type, status',
    [TID]
  );
  console.log('\nTransaction Summary:');
  const groups = {};
  for (const t of allTxns) {
    if (!groups[t.transaction_type]) groups[t.transaction_type] = [];
    groups[t.transaction_type].push(`${t.status}=${t.cnt}`);
  }
  for (const [type, statuses] of Object.entries(groups)) {
    console.log(`  ${type}: ${statuses.join(', ')}`);
  }
  const [prodCount] = await db.execute('SELECT count(*) as cnt FROM hris_saas.products WHERE tenant_id = ?', [TID]);
  console.log(`\nTotal Products: ${prodCount[0].cnt}`);
  process.exit(0);
}

async function createTransaction(data) {
  const id = uuidv4();
  const direction = data.transaction_type === 'payment_in' ? 'sales'
    : data.transaction_type === 'payment_out' ? 'purchase'
    : ['sales_invoice', 'quotation', 'proforma_invoice', 'delivery_challan', 'sales_return', 'credit_note'].includes(data.transaction_type) ? 'sales'
    : 'purchase';
  const prefix = { sales_invoice: 'INV', payment_in: 'PAYIN', sales_return: 'SR', credit_note: 'CN',
    delivery_challan: 'DC', quotation: 'QTN', proforma_invoice: 'PRO',
    purchase_invoice: 'BILL', payment_out: 'PAYOUT', purchase_return: 'PR', debit_note: 'DN', purchase_order: 'PO' }[data.transaction_type] || 'DOC';
  const seq = Date.now().toString(36).slice(-4).toUpperCase();
  const docNumber = data.document_number || `${prefix}-${seq}-${Math.floor(Math.random() * 1000)}`;

  const items = data.items || [];
  const payments = data.payments || [];

  // compute totals
  let subtotal = 0, discountAmt = 0, taxableAmt = 0, cgst = 0, sgst = 0, igst = 0, grandTotal = 0;
  const computedItems = items.map((item, idx) => {
    const qty = item.quantity || 1;
    const rate = item.rate || 0;
    const discPct = item.discount_percent || 0;
    const gstRate = item.gst_rate || 0;
    const lineSubtotal = qty * rate;
    const lineDisc = Math.round(lineSubtotal * discPct / 100);
    const lineTaxable = lineSubtotal - lineDisc;
    const lineCgst = data.gst_type === 'intra' ? Math.round(lineTaxable * gstRate / 100 / 2) : 0;
    const lineSgst = data.gst_type === 'intra' ? Math.round(lineTaxable * gstRate / 100 / 2) : 0;
    const lineIgst = data.gst_type === 'inter' ? Math.round(lineTaxable * gstRate / 100) : 0;
    const lineTotal = lineTaxable + lineCgst + lineSgst + lineIgst;
    subtotal += lineSubtotal;
    discountAmt += lineDisc;
    taxableAmt += lineTaxable;
    cgst += lineCgst;
    sgst += lineSgst;
    igst += lineIgst;
    grandTotal += lineTotal;
    return { ...item, qty, rate, discPct, gstRate, lineSubtotal, lineDisc, lineTaxable, lineCgst, lineSgst, lineIgst, lineTotal, sortOrder: idx + 1 };
  });
  grandTotal = Math.round(grandTotal);
  const roundOff = 0;
  const balanceDue = ['draft', 'sent', 'partial', 'overdue'].includes(data.status) ? grandTotal : 0;
  const amountPaid = grandTotal - balanceDue;

  const created_by = '5d6645b4-09bc-4756-a303-da625630a82c';

  try {
    await db.execute(`INSERT INTO hris_saas.transactions (
      id, tenant_id, transaction_type, direction, document_number, document_date,
      party_id, party_type, party_name, party_gstin, party_pan,
      party_address, party_city, party_state, party_country, party_postal_code,
      reference_number, reference_type,
      subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off, grand_total, amount_paid, balance_due,
      payment_date, payment_mode, payment_reference,
      due_date, gst_type, place_of_supply,
      reason, notes, challan_type, status, created_by
    ) VALUES (?,?,?,?,?,?,
      ?,?,?,?,?,
      ?,?,?,?,?,
      ?,?,
      ?,?,?,?,?,?,?,?,?,?,
      ?,?,?,
      ?,?,?,
      ?,?,?,?,?)`, [
      id, TID, data.transaction_type, direction, docNumber, data.document_date,
      data.party_id || null, data.transaction_type === 'payment_in' || data.transaction_type === 'payment_out' ? null : (direction === 'sales' ? 'customer' : 'supplier'),
      data.party_name || null, data.party_gstin || null, data.party_pan || null,
      data.party_address || null, data.party_city || null, data.party_state || null, data.party_country || null, data.party_postal_code || null,
      data.reference_number || null, data.reference_type || null,
      subtotal, discountAmt, taxableAmt, cgst, sgst, igst, roundOff, grandTotal, amountPaid, balanceDue,
      data.payment_date || null, data.payment_mode || null, data.payment_reference || null,
      data.due_date || null, data.gst_type || 'intra', data.place_of_supply || null,
      data.reason || null, data.notes || null, data.challan_type || null, data.status || 'draft', created_by,
    ]);

    // Insert items
    for (const ci of computedItems) {
      await db.execute(`INSERT INTO hris_saas.transaction_items
        (id, transaction_id, item_name, hsn_sac, quantity, unit, rate, discount_percent, discount_amount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        uuidv4(), id, ci.item_name || 'Item', ci.hsn_sac || null, ci.qty, ci.unit || null,
        ci.rate, ci.discPct, ci.lineDisc, ci.lineTaxable, ci.gstRate, ci.lineCgst, ci.lineSgst, ci.lineIgst, ci.lineTotal, ci.sortOrder,
      ]);
    }

    // Insert payments
    for (const p of payments) {
      await db.execute(`INSERT INTO hris_saas.transaction_payments
        (id, tenant_id, payment_transaction_id, allocated_to_id, allocated_to_type, amount_allocated)
        VALUES (?,?,?,?,?,?)`, [
        uuidv4(), TID, id, p.allocated_to_id, p.allocated_to_type, p.amount_allocated || 0,
      ]);
    }

    // Track created IDs for reference
    const record = { id, doc_number: docNumber, doc_date: data.document_date, party_id: data.party_id, party_name: data.party_name, status: data.status, grand_total: grandTotal, transaction_type: data.transaction_type };
    if (data.transaction_type === 'sales_invoice') createdSalesInvoices.push(record);
    if (data.transaction_type === 'purchase_invoice') createdPurchaseInvoices.push(record);

    // Update stock for sales/purchase invoices (simplified)
    if (['sales_invoice', 'delivery_challan'].includes(data.transaction_type) && data.status !== 'draft') {
      for (const ci of computedItems) {
        const prod = createdProducts.find(p => p.name === ci.item_name);
        if (prod) {
          await db.execute('UPDATE hris_saas.products SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ? AND tenant_id = ?', [ci.qty, prod.id, TID]);
        }
      }
    }
    if (data.transaction_type === 'purchase_invoice' && data.status !== 'draft') {
      for (const ci of computedItems) {
        const prod = createdProducts.find(p => p.name === ci.item_name);
        if (prod) {
          await db.execute('UPDATE hris_saas.products SET current_stock = current_stock + ? WHERE id = ? AND tenant_id = ?', [ci.qty, prod.id, TID]);
        }
      }
    }

    console.log(`  ✓ ${data.transaction_type}: ${docNumber} (${data.status})`);
  } catch (e) {
    console.error(`  ✗ ${data.transaction_type}: ${e.message}`);
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
