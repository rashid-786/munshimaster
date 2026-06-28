const XLSX = require('xlsx');

const COLUMN_MAPS = [
  {
    name: 'hdfc',
    match: (cols) => cols.some(c => /transaction.+date|txn.*date/i.test(c)) && cols.some(c => /narration|description|particulars/i.test(c)),
    map: { date: 'Date', description: 'Narration', debit: 'Withdrawal Amt.', credit: 'Deposit Amt.', balance: 'Balance' },
  },
  {
    name: 'icici',
    match: (cols) => cols.some(c => /value.+date/i.test(c)) && cols.some(c => /chq.+no|cheque/i.test(c)),
    map: { date: 'Value Date', description: 'Description', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
  },
  {
    name: 'sbi',
    match: (cols) => cols.some(c => /txn.+date|transaction.+date/i.test(c)) && cols.some(c => /withdrawal|debit/i.test(c)) && cols.some(c => /deposit|credit/i.test(c)),
    map: { date: 'Txn Date', description: 'Description', debit: 'Withdrawal', credit: 'Deposit', balance: 'Balance' },
  },
  {
    name: 'generic',
    match: () => true,
    map: { date: 'Date', description: 'Description', debit: 'Debit', credit: 'Credit', balance: 'Balance' },
  },
];

const CATEGORY_RULES = [
  { pattern: /sale|invoice|payment received|upi.*(?:pay|rec)|credit.*sale/i, category: 'sales' },
  { pattern: /purchase|supplier|vendor|payment.*(?:made|to|transfer)/i, category: 'purchases' },
  { pattern: /salary|wage|payroll/i, category: 'salary' },
  { pattern: /rent|electricity|water|bill|maintenance|internet|phone/i, category: 'expenses' },
  { pattern: /refund|cashback|interest|credit.*(?:int|ref)/i, category: 'other_income' },
  { pattern: /tax|gst|tds/i, category: 'taxes' },
  { pattern: /loan|emi|repayment/i, category: 'loan' },
  { pattern: /transfer.*(?:sav|cur|own)/i, category: 'transfers' },
  { pattern: /atm|withdrawal|cash/i, category: 'withdrawal' },
];

function detectFormat(columns) {
  const colSet = columns.map(c => String(c).trim());
  for (const fmt of COLUMN_MAPS) {
    if (fmt.match(colSet)) return fmt;
  }
  return COLUMN_MAPS[COLUMN_MAPS.length - 1];
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3]); if (y < 100) y += 2000;
    const mo = String(parseInt(m[2])).padStart(2, '0');
    const d = String(parseInt(m[1])).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return str;
}

function parseAmount(val) {
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.\-]/g, '');
  return Math.round(parseFloat(str) || 0);
}

function autoCategorize(description) {
  if (!description) return 'uncategorized';
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) return rule.category;
  }
  return 'uncategorized';
}

function parseCSV(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, codepage: 65001 });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

  if (rows.length < 2) return { rows: [], errors: ['File is empty or has no data rows.'] };

  const headerRow = rows.findIndex(r => r.some(c => String(c).trim().length > 0));
  if (headerRow === -1) return { rows: [], errors: ['No header row found.'] };

  const columns = rows[headerRow].map(c => String(c).trim());
  const fmt = detectFormat(columns);

  const colIndex = {};
  for (const [key, label] of Object.entries(fmt.map)) {
    const idx = columns.findIndex(c => c.toLowerCase() === label.toLowerCase()
      || c.toLowerCase().includes(label.toLowerCase())
      || label.toLowerCase().includes(c.toLowerCase()));
    if (idx !== -1) colIndex[key] = idx;
  }

  const dataRows = rows.slice(headerRow + 1).filter(r => r.some(c => String(c).trim()));

  const parsed = [];
  const errors = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const dateStr = colIndex.date !== undefined ? parseDate(r[colIndex.date]) : null;
    const description = colIndex.description !== undefined ? String(r[colIndex.description] || '').trim() : '';
    const debitRaw = colIndex.debit !== undefined ? r[colIndex.debit] : 0;
    const creditRaw = colIndex.credit !== undefined ? r[colIndex.credit] : 0;
    const balanceRaw = colIndex.balance !== undefined ? r[colIndex.balance] : null;

    const debit = parseAmount(debitRaw);
    const credit = parseAmount(creditRaw);
    const type = credit > 0 ? 'IN' : 'OUT';
    const amount = credit > 0 ? credit : debit;

    if (!dateStr || amount === 0) continue;

    parsed.push({
      entry_date: dateStr,
      description: description || '—',
      type,
      amount,
      debit_amount: debit,
      credit_amount: credit,
      running_balance: balanceRaw ? parseAmount(balanceRaw) : null,
      category: autoCategorize(description),
      row: r,
    });
  }

  return { rows: parsed, format: fmt.name, errors };
}

async function matchWithInvoices(tenantId, transactions, pool) {
  const matched = [];
  for (const txn of transactions) {
    try {
      const [rows] = await pool.query(
        `SELECT i.id, i.invoice_number, i.total_amount, i.customer_id, c.name as customer_name
         FROM hris_saas.invoices i JOIN hris_saas.customers c ON i.customer_id = c.id
         WHERE i.tenant_id = $1 AND i.total_amount = $2
           AND i.invoice_date BETWEEN $3 AND $4
         LIMIT 1`,
        [tenantId, txn.amount, txn.entry_date, txn.entry_date]
      );
      if (rows.length > 0) {
        txn.matched_invoice_id = rows[0].id;
        txn.confidence = 100;
        matched.push(txn.amount);
      }
    } catch {}
  }
  return transactions;
}

module.exports = { parseCSV, matchWithInvoices, autoCategorize };
