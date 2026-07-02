const db = require('../config/db');

function xmlSafe(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function buildEnvelope(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
<HEADER>
<TALLYREQUEST>Import Data</TALLYREQUEST>
</HEADER>
<BODY>
<IMPORT>
<REQUESTDATA>
${body}
</REQUESTDATA>
</IMPORT>
</BODY>
</ENVELOPE>`;
}

function buildLedgerXml(items, parent, gstRegType = 'Regular') {
  return items.map(item => `  <LEDGER NAME="${xmlSafe(item.name)}" PARENT="${xmlSafe(parent)}">
    <ADDRESS.LIST>
      <ADDRESS>${xmlSafe(item.address || '')}</ADDRESS>
    </ADDRESS.LIST>
    <GSTIN>${xmlSafe(item.gstin || '')}</GSTIN>
    <GSTREGISTRATIONTYPE>${item.gstin ? gstRegType : 'Unregistered'}</GSTREGISTRATIONTYPE>
    <PINCODE>${xmlSafe(item.pincode || '')}</PINCODE>
    <PHONE>${xmlSafe(item.phone || '')}</PHONE>
    <EMAIL>${xmlSafe(item.email || '')}</EMAIL>
    <CONTACT>${xmlSafe(item.contact_person || '')}</CONTACT>
  </LEDGER>`).join('\n');
}

function buildStockItemXml(items) {
  return items.map(item => `  <STOCKITEM NAME="${xmlSafe(item.name)}">
    <BASICUNITOFMEASUREMENT>Nos.</BASICUNITOFMEASUREMENT>
    <RATEOFINVOICE>${parseFloat(item.selling_price || 0).toFixed(2)}</RATEOFINVOICE>
    <OPENINGBALANCE>0</OPENINGBALANCE>
    <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
    ${item.hsn_code ? `<HSNCODE>${xmlSafe(item.hsn_code)}</HSNCODE>` : ''}
    ${item.tax_rate ? `
    <GSTDETAILS.LIST>
      <APPLICABLEFROM>01-04-2025</APPLICABLEFROM>
      <TAXRATE>${item.tax_rate}</TAXRATE>
      <CGST>${(item.tax_rate / 2)}</CGST>
      <SGST>${(item.tax_rate / 2)}</SGST>
    </GSTDETAILS.LIST>` : ''}
  </STOCKITEM>`).join('\n');
}

function buildVoucherEntry(ledgerName, amount) {
  const amt = parseFloat(amount) || 0;
  return `    <LEDGERENTRIES.LIST>
      <LEDGERNAME>${xmlSafe(ledgerName)}</LEDGERNAME>
      <AMOUNT>${amt.toFixed(2)}</AMOUNT>
    </LEDGERENTRIES.LIST>`;
}

function buildInventoryEntry(stockName, rate, qty, amount, hsn, desc) {
  return `    <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>${xmlSafe(stockName)}</STOCKITEMNAME>
      <RATE>${parseFloat(rate).toFixed(2)}</RATE>
      <ACTUALQTY>${parseFloat(qty)}</ACTUALQTY>
      <AMOUNT>${parseFloat(amount).toFixed(2)}</AMOUNT>
      ${hsn ? `<HSNCODE>${xmlSafe(hsn)}</HSNCODE>` : ''}
      <DESCRIPTION>${xmlSafe(desc || stockName)}</DESCRIPTION>
    </ALLINVENTORYENTRIES.LIST>`;
}

async function exportCustomers(tenantId) {
  const [customers] = await db.query(
    `SELECT name, address, city, state, pincode, gstin, phone, email, contact_person
     FROM hris_saas.customers WHERE tenant_id = $1 AND status != 'inactive' ORDER BY name`,
    [tenantId]
  );
  if (customers.length === 0) return null;

  const xml = buildLedgerXml(customers, 'Sundry Debtors');
  return buildEnvelope(`<TALLYMESSAGE>\n${xml}\n</TALLYMESSAGE>`);
}

async function exportSuppliers(tenantId) {
  const [suppliers] = await db.query(
    `SELECT name, address, city, state, pincode, gstin, phone, email, contact_person
     FROM hris_saas.suppliers WHERE tenant_id = $1 AND status != 'inactive' ORDER BY name`,
    [tenantId]
  );
  if (suppliers.length === 0) return null;

  const xml = buildLedgerXml(suppliers, 'Sundry Creditors');
  return buildEnvelope(`<TALLYMESSAGE>\n${xml}\n</TALLYMESSAGE>`);
}

async function exportProducts(tenantId) {
  const [products] = await db.query(
    `SELECT name, selling_price, purchase_price, hsn_code, tax_rate
     FROM hris_saas.products WHERE tenant_id = $1 ORDER BY name`,
    [tenantId]
  );
  if (products.length === 0) return null;

  const xml = buildStockItemXml(products);
  return buildEnvelope(`<TALLYMESSAGE>\n${xml}\n</TALLYMESSAGE>`);
}

async function exportInvoices(tenantId, from, to) {
  let where = 'i.tenant_id = $1 AND i.status NOT IN (\'draft\', \'cancelled\')';
  const params = [tenantId];
  if (from && to) { where += ` AND i.invoice_date BETWEEN $2 AND $3`; params.push(from, to); }

  const [invoices] = await db.query(
    `SELECT i.*, c.name as customer_name, c.gstin as customer_gstin, c.state as customer_state,
            c.address as customer_address
     FROM hris_saas.invoices i
     JOIN hris_saas.customers c ON i.customer_id = c.id
     WHERE ${where} ORDER BY i.invoice_date`,
    params
  );

  if (invoices.length === 0) return null;

  const vouchers = [];
  for (const inv of invoices) {
    const [items] = await db.query(
      `SELECT * FROM hris_saas.invoice_items WHERE invoice_id = $1 ORDER BY id`,
      [inv.id]
    );

    const totalTaxable = items.reduce((s, i) => s + (i.total_price || 0), 0) / 100;
    const totalCgst = items.reduce((s, i) => {
      const tv = (i.total_price || 0) / 100;
      return s + Math.round(tv * parseFloat(i.cgst_rate || 0) / 100 * 100) / 100;
    }, 0);
    const totalSgst = items.reduce((s, i) => {
      const tv = (i.total_price || 0) / 100;
      return s + Math.round(tv * parseFloat(i.sgst_rate || 0) / 100 * 100) / 100;
    }, 0);
    const totalIgst = items.reduce((s, i) => {
      const tv = (i.total_price || 0) / 100;
      return s + Math.round(tv * parseFloat(i.igst_rate || 0) / 100 * 100) / 100;
    }, 0);
    const isInter = inv.gst_type === 'inter';

    const inventoryEntries = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const rate = (item.unit_price || 0) / 100;
      const amount = (item.total_price || 0) / 100;
      return buildInventoryEntry(item.description || 'Item', rate, qty, amount, item.hsn_code, item.description);
    }).join('\n');

    const totalAmt = inv.total_amount / 100;
    const entries = [
      buildVoucherEntry(inv.customer_name, totalAmt),
      buildVoucherEntry('Sales Account', -totalTaxable),
    ];
    if (!isInter) {
      if (totalCgst > 0) entries.push(buildVoucherEntry('CGST Output', -totalCgst));
      if (totalSgst > 0) entries.push(buildVoucherEntry('SGST Output', -totalSgst));
    } else {
      if (totalIgst > 0) entries.push(buildVoucherEntry('IGST Output', -totalIgst));
    }

    const voucherXml = `  <VOUCHER VCHTYPE="Sales" ACTION="Create">
    <DATE>${formatDate(inv.invoice_date)}</DATE>
    <VOUCHERNUMBER>${xmlSafe(inv.invoice_number)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${xmlSafe(inv.customer_name)}</PARTYLEDGERNAME>
    ${inv.customer_gstin ? `<GSTIN>${xmlSafe(inv.customer_gstin)}</GSTIN>` : ''}
    <EFFECTIVEDATE>${formatDate(inv.invoice_date)}</EFFECTIVEDATE>
${inventoryEntries}
${entries.join('\n')}
  </VOUCHER>`;

    vouchers.push(voucherXml);
  }

  return buildEnvelope(`<TALLYMESSAGE>\n${vouchers.join('\n')}\n</TALLYMESSAGE>`);
}

async function exportPurchaseOrders(tenantId, from, to) {
  let where = 'po.tenant_id = $1 AND po.status NOT IN (\'draft\', \'cancelled\')';
  const params = [tenantId];
  if (from && to) { where += ` AND po.order_date BETWEEN $2 AND $3`; params.push(from, to); }

  const [pos] = await db.query(
    `SELECT po.*, s.name as supplier_name, s.gstin as supplier_gstin
     FROM hris_saas.purchase_orders po
     JOIN hris_saas.suppliers s ON po.supplier_id = s.id
     WHERE ${where} ORDER BY po.order_date`,
    params
  );

  if (pos.length === 0) return null;

  const vouchers = [];
  for (const po of pos) {
    const [items] = await db.query(
      `SELECT * FROM hris_saas.purchase_order_items WHERE purchase_order_id = $1 ORDER BY id`,
      [po.id]
    );

    const totalTaxable = items.reduce((s, i) => s + (i.total_price || 0), 0) / 100;
    const totalCgst = items.reduce((s, i) => {
      const tv = (i.total_price || 0) / 100;
      return s + Math.round(tv * parseFloat(i.cgst_rate || 0) / 100 * 100) / 100;
    }, 0);
    const totalSgst = items.reduce((s, i) => {
      const tv = (i.total_price || 0) / 100;
      return s + Math.round(tv * parseFloat(i.sgst_rate || 0) / 100 * 100) / 100;
    }, 0);
    const totalIgst = items.reduce((s, i) => {
      const tv = (i.total_price || 0) / 100;
      return s + Math.round(tv * parseFloat(i.igst_rate || 0) / 100 * 100) / 100;
    }, 0);
    const isInter = po.gst_type === 'inter';

    const inventoryEntries = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const rate = (item.unit_price || 0) / 100;
      const amount = (item.total_price || 0) / 100;
      return buildInventoryEntry(item.description || 'Item', rate, qty, amount, item.hsn_code, item.description);
    }).join('\n');

    const totalAmt = po.total_amount / 100;
    const entries = [
      buildVoucherEntry(po.supplier_name, -totalAmt),
      buildVoucherEntry('Purchase Account', totalTaxable),
    ];
    if (!isInter) {
      if (totalCgst > 0) entries.push(buildVoucherEntry('CGST Input', totalCgst));
      if (totalSgst > 0) entries.push(buildVoucherEntry('SGST Input', totalSgst));
    } else {
      if (totalIgst > 0) entries.push(buildVoucherEntry('IGST Input', totalIgst));
    }

    const voucherXml = `  <VOUCHER VCHTYPE="Purchase" ACTION="Create">
    <DATE>${formatDate(po.order_date)}</DATE>
    <VOUCHERNUMBER>${xmlSafe(po.po_number)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${xmlSafe(po.supplier_name)}</PARTYLEDGERNAME>
    ${po.supplier_gstin ? `<GSTIN>${xmlSafe(po.supplier_gstin)}</GSTIN>` : ''}
    <EFFECTIVEDATE>${formatDate(po.order_date)}</EFFECTIVEDATE>
${inventoryEntries}
${entries.join('\n')}
  </VOUCHER>`;

    vouchers.push(voucherXml);
  }

  return buildEnvelope(`<TALLYMESSAGE>\n${vouchers.join('\n')}\n</TALLYMESSAGE>`);
}

async function exportAllMasters(tenantId) {
  const parts = [];
  const cust = await exportCustomers(tenantId);
  if (cust) parts.push(cust);
  const supp = await exportSuppliers(tenantId);
  if (supp) parts.push(supp);
  const prod = await exportProducts(tenantId);
  if (prod) parts.push(prod);

  if (parts.length === 0) return null;

  return buildEnvelope(`<TALLYMESSAGE>\n${parts.map(p => {
    const m = p.match(/<TALLYMESSAGE>([\s\S]*)<\/TALLYMESSAGE>/);
    return m ? m[1].trim() : '';
  }).filter(Boolean).join('\n')}\n</TALLYMESSAGE>`);
}

module.exports = {
  exportCustomers, exportSuppliers, exportProducts,
  exportInvoices, exportPurchaseOrders, exportAllMasters,
};
