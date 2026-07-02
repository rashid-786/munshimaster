const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function processRecurringInvoices() {
  try {
    const [templates] = await db.query(
      `SELECT r.*, t.settings
       FROM recurring_invoice_templates r
       JOIN tenants t ON r.tenant_id = t.id
       WHERE r.is_active = true AND r.next_generation_date <= CURRENT_DATE`
    );

    for (const template of templates) {
      try {
        await generateInvoice(template);
        const nextDate = calcNextDate(template);
        await db.query(
          `UPDATE recurring_invoice_templates
           SET last_generated_date = CURRENT_DATE, next_generation_date = ?
           WHERE id = ?`,
          [nextDate, template.id]
        );
        console.log(`Recurring invoice generated for template ${template.id}, next: ${nextDate}`);
      } catch (err) {
        console.error(`Failed to generate for template ${template.id}:`, err.message);
      }
    }

    if (templates.length > 0) {
      console.log(`Processed ${templates.length} recurring templates.`);
    }
  } catch (err) {
    console.error('processRecurringInvoices error:', err);
  }
}

async function generateInvoice(template) {
  const settings = typeof template.settings === 'string' ? JSON.parse(template.settings) : (template.settings || {});
  const taxRate = (settings.taxRate || 18) / 100;

  const [items] = await db.query(
    'SELECT * FROM recurring_invoice_items WHERE template_id = ? ORDER BY sort_order',
    [template.id]
  );
  if (items.length === 0) return;

  const [[{ next }]] = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number, 5) AS INTEGER)), 0) + 1 as next
     FROM invoices WHERE tenant_id = ?`, [template.tenant_id]
  );
  const invNumber = `INV-${String(next).padStart(4, '0')}`;

  const invoiceDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (template.due_date_offset || 15));
  const dueDateStr = dueDate.toISOString().split('T')[0];

  let subtotal = 0;
  let totalTaxAmount = 0;
  const useGst = template.gst_type === 'intra' || template.gst_type === 'inter';

  const lineItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = Math.round(parseFloat(item.unit_price) || 0);
    const total = Math.round(qty * price);
    subtotal += total;

    let cgstRate = 0, sgstRate = 0, igstRate = 0;
    if (useGst) {
      if (template.gst_type === 'intra') {
        cgstRate = (taxRate * 100) / 2;
        sgstRate = (taxRate * 100) / 2;
      } else {
        igstRate = (taxRate * 100);
      }
    }

    const cgstAmt = Math.round(total * cgstRate / 100);
    const sgstAmt = Math.round(total * sgstRate / 100);
    const igstAmt = Math.round(total * igstRate / 100);
    totalTaxAmount += cgstAmt + sgstAmt + igstAmt;

    return {
      description: item.description,
      quantity: qty, unit_price: price, total_price: total,
      hsn_code: item.hsn_code || null,
      cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate,
    };
  });

  const totalAmount = subtotal + totalTaxAmount;
  const invId = uuidv4();

  await db.query(
    `INSERT INTO invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, notes, gst_type, place_of_supply)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    [invId, template.tenant_id, invNumber, template.customer_id, invoiceDate, dueDateStr,
     subtotal, totalTaxAmount, totalAmount, template.notes || null,
     template.gst_type || null, template.place_of_supply || null]
  );

  for (const item of lineItems) {
    await db.query(
      `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), invId, item.description, item.quantity, item.unit_price, item.total_price,
       item.hsn_code, item.cgst_rate, item.sgst_rate, item.igst_rate]
    );
  }
}

function calcNextDate(template) {
  const current = new Date(template.next_generation_date);
  const interval = template.interval_count || 1;

  switch (template.frequency) {
    case 'weekly':
      current.setDate(current.getDate() + 7 * interval);
      break;
    case 'monthly':
      current.setMonth(current.getMonth() + interval);
      break;
    case 'quarterly':
      current.setMonth(current.getMonth() + 3 * interval);
      break;
    case 'yearly':
      current.setFullYear(current.getFullYear() + interval);
      break;
    default:
      current.setMonth(current.getMonth() + interval);
  }
  return current.toISOString().split('T')[0];
}

function startRecurringInvoiceCron(intervalMs) {
  processRecurringInvoices();
  setInterval(processRecurringInvoices, intervalMs || 86400000);
  console.log(`Recurring invoice cron started (interval: ${intervalMs || 86400000}ms)`);
}

module.exports = { processRecurringInvoices, startRecurringInvoiceCron };
