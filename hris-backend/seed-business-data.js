require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const url = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:5432/${process.env.DB_NAME}`;
const pool = new Pool({ connectionString: url });

const TENANT_ID = '11af653f-2496-4f22-b3d9-c4955399a1b2';
const EMPLOYEE_ID = '9be4c0f0-6eeb-4c36-80bf-7b8644fe5924';
const TAX_RATE = 12;

const customers = [
  { name: 'FreshMart Retail Chain', gstin: '27AAACF1234L1RQ', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', phone: '+912222345678' },
  { name: 'Farm-to-Fork Cafes', gstin: '29AAACG5678S1LK', city: 'Bangalore', state: 'Karnataka', pincode: '560001', phone: '+918065432109' },
  { name: 'DailyFresh Distributors', gstin: '04AAACE7890Q1NM', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', phone: '+917984561230' },
  { name: 'GreenBasket Online', gstin: '29AAACG5678M1QP', city: 'Bangalore', state: 'Karnataka', pincode: '560002', phone: '+918076543210' },
  { name: 'PureHarvest Exports', gstin: '32AAACF1234R1ML', city: 'Kochi', state: 'Kerala', pincode: '682001', phone: '+914844567890' },
];

const suppliers = [
  { name: 'GreenField Seeds', gstin: '27AABCU5678E1ZW', city: 'Pune', state: 'Maharashtra', pincode: '411001', phone: '+912067890123' },
  { name: 'IrrigationTech Pvt Ltd', gstin: '27AABCU3456G1WV', city: 'Mumbai', state: 'Maharashtra', pincode: '400002', phone: '+912245678901' },
  { name: 'Organic Fertilizers Ltd', gstin: '24AABCU7890H1VU', city: 'Gandhinagar', state: 'Gujarat', pincode: '382010', phone: '+917956123478' },
  { name: 'Natural Pest Control Co.', gstin: '27AABCU9012F1YX', city: 'Nashik', state: 'Maharashtra', pincode: '422001', phone: '+912534567890' },
  { name: 'HarvestPack Packaging', gstin: '03AABCU1234I1UT', city: 'Ludhiana', state: 'Punjab', pincode: '141001', phone: '+911614567890' },
];

function cents(rupees) {
  return Math.round(rupees * 100);
}

function randomDate(startDays, endDays) {
  const d = new Date();
  d.setDate(d.getDate() - startDays - Math.floor(Math.random() * (endDays - startDays + 1)));
  return d.toISOString().split('T')[0];
}

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function randomItems(count) {
  const products = [
    { desc: 'Organic Wheat Flour (1kg)', hsn: '1101', price: cents(45) },
    { desc: 'Basmati Rice (5kg)', hsn: '1006', price: cents(350) },
    { desc: 'Coconut Oil (1L)', hsn: '1513', price: cents(220) },
    { desc: 'Turmeric Powder (100g)', hsn: '0910', price: cents(80) },
    { desc: 'Honey (500g)', hsn: '0409', price: cents(450) },
    { desc: 'Green Tea (100 bags)', hsn: '0902', price: cents(280) },
    { desc: 'Almonds (250g)', hsn: '0802', price: cents(390) },
    { desc: 'Handmade Soap (pack of 3)', hsn: '3401', price: cents(180) },
  ];
  const selected = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * products.length); } while (used.has(idx) && used.size < products.length);
    used.add(idx);
    const p = products[idx];
    const qty = Math.floor(Math.random() * 50) + 1;
    selected.push({ ...p, quantity: qty, total_price: p.price * qty, cgst_rate: TAX_RATE / 2, sgst_rate: TAX_RATE / 2, igst_rate: 0 });
  }
  return selected;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing business data for this tenant
    await client.query(`DELETE FROM hris_saas.debit_note_items WHERE debit_note_id IN (SELECT id FROM hris_saas.debit_notes WHERE tenant_id = $1)`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.debit_notes WHERE tenant_id = $1`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.credit_note_items WHERE credit_note_id IN (SELECT id FROM hris_saas.credit_notes WHERE tenant_id = $1)`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.credit_notes WHERE tenant_id = $1`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.attachments WHERE entity_type = 'invoice' AND entity_id IN (SELECT id FROM hris_saas.invoices WHERE tenant_id = $1)`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.invoice_payments WHERE invoice_id IN (SELECT id FROM hris_saas.invoices WHERE tenant_id = $1)`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.invoice_items WHERE invoice_id IN (SELECT id FROM hris_saas.invoices WHERE tenant_id = $1)`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.invoices WHERE tenant_id = $1`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM hris_saas.purchase_orders WHERE tenant_id = $1)`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.purchase_orders WHERE tenant_id = $1`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.customers WHERE tenant_id = $1`, [TENANT_ID]);
    await client.query(`DELETE FROM hris_saas.suppliers WHERE tenant_id = $1`, [TENANT_ID]);

    // Seed customers
    const customerIds = [];
    for (const c of customers) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO hris_saas.customers (id, tenant_id, name, email, phone, city, state, pincode, gstin, credit_limit, payment_terms, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW())`,
        [id, TENANT_ID, c.name, `contact@${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`, c.phone, c.city, c.state, c.pincode, c.gstin, cents(500000), '30 days']
      );
      customerIds.push(id);
      console.log(`  Customer: ${c.name} (${id})`);
    }

    // Seed suppliers
    const supplierIds = [];
    for (const s of suppliers) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO hris_saas.suppliers (id, tenant_id, name, email, phone, city, state, pincode, gstin, payment_terms, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW())`,
        [id, TENANT_ID, s.name, `sales@${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`, s.phone, s.city, s.state, s.pincode, s.gstin, '45 days']
      );
      supplierIds.push(id);
      console.log(`  Supplier: ${s.name} (${id})`);
    }

    // Seed purchase orders
    const poStatuses = ['draft', 'sent', 'approved', 'received', 'sent'];
    const poIds = [];
    for (let i = 0; i < poStatuses.length; i++) {
      const id = uuidv4();
      const poNum = `PO-${String(i + 1).padStart(4, '0')}`;
      const status = poStatuses[i];
      const orderDate = randomDate(90, 10);
      const expDate = futureDate(Math.floor(Math.random() * 15) + 5);
      const items = randomItems(Math.floor(Math.random() * 3) + 2);
      const subtotal = items.reduce((s, it) => s + it.total_price, 0);
      const tax = Math.round(subtotal * TAX_RATE / 100);
      const total = subtotal + tax;

      await client.query(
        `INSERT INTO hris_saas.purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, gst_type, place_of_supply, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [id, TENANT_ID, poNum, supplierIds[i % supplierIds.length], orderDate, expDate, status, subtotal, tax, total, 'intra', 'Maharashtra', `Order for supplies #${i + 1}`]
      );

      for (const it of items) {
        await client.query(
          `INSERT INTO hris_saas.purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [uuidv4(), id, it.desc, it.quantity, it.price, it.total_price, it.hsn, it.cgst_rate, it.sgst_rate, it.igst_rate]
        );
      }
      poIds.push(id);
      console.log(`  PO ${poNum}: ${status} — Rs.${(total / 100).toFixed(2)}`);
    }

    // Seed invoices
    const invStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue'];
    const invIds = [];
    for (let i = 0; i < invStatuses.length; i++) {
      const id = uuidv4();
      const invNum = `INV-${String(i + 1).padStart(4, '0')}`;
      const status = invStatuses[i];
      const invDate = randomDate(60, 5);
      const dueDate = futureDate(15);
      const items = randomItems(Math.floor(Math.random() * 3) + 2);
      const subtotal = items.reduce((s, it) => s + it.total_price, 0);
      const tax = Math.round(subtotal * TAX_RATE / 100);
      const total = subtotal + tax;

      await client.query(
        `INSERT INTO hris_saas.invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, amount_paid, gst_type, place_of_supply, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        [id, TENANT_ID, invNum, customerIds[i % customerIds.length], invDate, dueDate, status, subtotal, tax, total, 0, 'intra', 'Maharashtra', `Invoice for order #${i + 1}`]
      );

      for (const it of items) {
        await client.query(
          `INSERT INTO hris_saas.invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [uuidv4(), id, it.desc, it.quantity, it.price, it.total_price, it.hsn, it.cgst_rate, it.sgst_rate, it.igst_rate]
        );
      }

      // Add payments for paid/partial invoices
      if (status === 'paid') {
        const paidAmount = total;
        await client.query(`UPDATE hris_saas.invoices SET amount_paid = $1 WHERE id = $2`, [paidAmount, id]);
        await client.query(
          `INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, reference, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [uuidv4(), TENANT_ID, id, paidAmount, 'bank_transfer', invDate, `PAY-${invNum}`, 'Full payment received']
        );
      } else if (status === 'partial') {
        const paidAmount = Math.round(total * 0.4);
        await client.query(`UPDATE hris_saas.invoices SET amount_paid = $1 WHERE id = $2`, [paidAmount, id]);
        await client.query(
          `INSERT INTO hris_saas.invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, reference, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [uuidv4(), TENANT_ID, id, paidAmount, 'cash', invDate, `PAY-${invNum}`, 'Partial payment']
        );
      }

      invIds.push(id);
      console.log(`  Invoice ${invNum}: ${status} — Rs.${(total / 100).toFixed(2)}${status === 'paid' ? ' (paid)' : status === 'partial' ? ' (40% paid)' : ''}`);
    }

    // Seed credit notes (linked to invoices)
    for (let i = 0; i < 2; i++) {
      const id = uuidv4();
      const cnNum = `CN-${String(i + 1).padStart(4, '0')}`;
      const invId = invIds[i % invIds.length];
      const invRes = await client.query(`SELECT total_amount FROM hris_saas.invoices WHERE id = $1`, [invId]);
      const creditAmount = Math.round((invRes.rows[0]?.total_amount || 50000) * (i === 0 ? 0.5 : 0.25));
      const tax = Math.round(creditAmount * TAX_RATE / (100 + TAX_RATE));
      const subtotal = creditAmount - tax;

      await client.query(
        `INSERT INTO hris_saas.credit_notes (id, tenant_id, invoice_id, credit_note_number, cn_date, status, subtotal, tax_amount, total_amount, reason, gst_type, place_of_supply, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [id, TENANT_ID, invId, cnNum, randomDate(30, 1), 'issued', subtotal, tax, creditAmount, 'Return of defective goods', 'intra', 'Maharashtra', 'Credit note issued for damaged items']
      );

      await client.query(
        `INSERT INTO hris_saas.credit_note_items (id, credit_note_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), id, 'Returned items credit', 1, creditAmount, creditAmount, '9989', TAX_RATE / 2, TAX_RATE / 2, 0]
      );
      console.log(`  Credit Note ${cnNum}: Rs.${(creditAmount / 100).toFixed(2)} (linked to INV-${String(invIds.indexOf(invId) + 1).padStart(4, '0')})`);
    }

    // Seed debit notes (linked to invoices, like credit notes)
    for (let i = 0; i < 2; i++) {
      const id = uuidv4();
      const dnNum = `DN-${String(i + 1).padStart(4, '0')}`;
      const invId = invIds[i % invIds.length];
      const invRes2 = await client.query(`SELECT total_amount FROM hris_saas.invoices WHERE id = $1`, [invId]);
      const debitAmount = Math.round((invRes2.rows[0]?.total_amount || 50000) * (i === 0 ? 0.3 : 0.15));
      const tax = Math.round(debitAmount * TAX_RATE / (100 + TAX_RATE));
      const subtotal = debitAmount - tax;

      await client.query(
        `INSERT INTO hris_saas.debit_notes (id, tenant_id, invoice_id, debit_note_number, dn_date, status, subtotal, tax_amount, total_amount, reason, gst_type, place_of_supply, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [id, TENANT_ID, invId, dnNum, randomDate(20, 1), 'issued', subtotal, tax, debitAmount, 'Price discrepancy', 'intra', 'Maharashtra', 'Debit note for pricing error']
      );

      await client.query(
        `INSERT INTO hris_saas.debit_note_items (id, debit_note_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), id, 'Price adjustment debit', 1, debitAmount, debitAmount, '9989', TAX_RATE / 2, TAX_RATE / 2, 0]
      );
      console.log(`  Debit Note ${dnNum}: Rs.${(debitAmount / 100).toFixed(2)} (linked to INV-${String(invIds.indexOf(invId) + 1).padStart(4, '0')})`);
    }

    await client.query('COMMIT');
    console.log('\nBusiness seed data created successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
