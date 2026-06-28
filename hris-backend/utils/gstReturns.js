const db = require('../config/db');

const STATE_CODES = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03', 'Chandigarh': '04',
  'Uttarakhand': '05', 'Haryana': '06', 'Delhi': '07', 'Rajasthan': '08',
  'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11', 'Arunachal Pradesh': '12',
  'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15', 'Tripura': '16',
  'Meghalaya': '17', 'Assam': '18', 'West Bengal': '19', 'Jharkhand': '20',
  'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23', 'Gujarat': '24',
  'Dadra and Nagar Haveli and Daman and Diu': '26', 'Maharashtra': '27',
  'Andhra Pradesh (Old)': '28', 'Karnataka': '29', 'Goa': '30', 'Lakshadweep': '31',
  'Kerala': '32', 'Tamil Nadu': '33', 'Puducherry': '34', 'Andaman and Nicobar': '35',
  'Telangana': '36', 'Andhra Pradesh': '37', 'Ladakh': '38',
};

async function getGstr1Data(tenantId, fromDate, toDate) {
  // B2B invoices (with customer GSTIN)
  const [b2b] = await db.query(`
    SELECT i.invoice_number, i.invoice_date, i.total_amount, i.subtotal, i.tax_amount,
           i.gst_type, i.place_of_supply, i.irn,
           c.name as customer_name, c.gstin as customer_gstin, c.state as customer_state
    FROM hris_saas.invoices i
    JOIN hris_saas.customers c ON i.customer_id = c.id
    WHERE i.tenant_id = $1
      AND i.invoice_date BETWEEN $2 AND $3
      AND i.status NOT IN ('draft', 'cancelled')
      AND c.gstin IS NOT NULL AND c.gstin != ''
    ORDER BY i.invoice_date`, [tenantId, fromDate, toDate]);

  // B2C invoices (no GSTIN or URP)
  const [b2c] = await db.query(`
    SELECT i.invoice_number, i.invoice_date, i.total_amount, i.subtotal, i.tax_amount,
           i.gst_type, i.place_of_supply,
           c.name as customer_name, c.state as customer_state
    FROM hris_saas.invoices i
    JOIN hris_saas.customers c ON i.customer_id = c.id
    WHERE i.tenant_id = $1
      AND i.invoice_date BETWEEN $2 AND $3
      AND i.status NOT IN ('draft', 'cancelled')
      AND (c.gstin IS NULL OR c.gstin = '' OR c.gstin = 'URP')
    ORDER BY i.invoice_date`, [tenantId, fromDate, toDate]);

  // Credit notes referencing B2B invoices
  const [cnB2b] = await db.query(`
    SELECT cn.credit_note_number, cn.cn_date, cn.total_amount, cn.subtotal, cn.tax_amount,
           cn.reason, cn.gst_type, cn.place_of_supply,
           i.invoice_number as ref_invoice, c.name as customer_name, c.gstin as customer_gstin
    FROM hris_saas.credit_notes cn
    JOIN hris_saas.invoices i ON cn.invoice_id = i.id
    JOIN hris_saas.customers c ON i.customer_id = c.id
    WHERE cn.tenant_id = $1
      AND cn.cn_date BETWEEN $2 AND $3
      AND cn.status = 'issued'
      AND c.gstin IS NOT NULL AND c.gstin != ''
    ORDER BY cn.cn_date`, [tenantId, fromDate, toDate]);

  // HSN-wise summary
  const [hsn] = await db.query(`
    SELECT ii.hsn_code,
           SUM(ii.quantity) as total_qty,
           SUM(ii.total_price) as total_value,
           SUM(ii.total_price * (COALESCE(ii.cgst_rate,0) + COALESCE(ii.sgst_rate,0) + COALESCE(ii.igst_rate,0)) / 100) as total_tax
    FROM hris_saas.invoice_items ii
    JOIN hris_saas.invoices i ON ii.invoice_id = i.id
    WHERE i.tenant_id = $1
      AND i.invoice_date BETWEEN $2 AND $3
      AND i.status NOT IN ('draft', 'cancelled')
      AND ii.hsn_code IS NOT NULL AND ii.hsn_code != ''
    GROUP BY ii.hsn_code ORDER BY ii.hsn_code`, [tenantId, fromDate, toDate]);

  return { b2b, b2c, cnB2b, hsn };
}

function buildGstr1Json(data, sellerGstin, sellerLegalName, period) {
  const b2bInvoices = data.b2b.map(inv => {
    const isInter = inv.gst_type === 'inter';
    const stateCode = STATE_CODES[inv.place_of_supply] || STATE_CODES[inv.customer_state] || '99';
    const buyerStateCode = STATE_CODES[inv.customer_state] || '99';
    return {
      ctin: inv.customer_gstin,
      trdNm: inv.customer_name,
      inv: [{
        inum: inv.invoice_number,
        idt: inv.invoice_date,
        itms: [{
          num: 1,
          itm_det: {
            txval: Math.round(inv.subtotal / 100 * 100) / 100,
            rt: inv.total_amount > 0 ? Math.round(inv.tax_amount / inv.subtotal * 100 * 100) / 100 : 0,
            camt: isInter ? 0 : Math.round(inv.tax_amount / 200 * 100) / 100,
            samt: isInter ? 0 : Math.round(inv.tax_amount / 200 * 100) / 100,
            iamt: isInter ? Math.round(inv.tax_amount / 100 * 100) / 100 : 0,
            csamt: 0,
          }
        }],
        val: Math.round(inv.total_amount / 100 * 100) / 100,
        pos: stateCode,
        rchrg: 'N',
        einv: inv.irn ? 'Y' : 'N',
        irn: inv.irn || '',
      }]
    };
  });

  const b2clInvoices = data.b2c.filter(inv => inv.total_amount > 250000).map(inv => {
    const stateCode = STATE_CODES[inv.place_of_supply] || STATE_CODES[inv.customer_state] || '99';
    return {
      pos: stateCode,
      inv: [{
        inum: inv.invoice_number,
        idt: inv.invoice_date,
        val: Math.round(inv.total_amount / 100 * 100) / 100,
      }]
    };
  });

  const b2csInvoices = data.b2c.filter(inv => inv.total_amount <= 250000);
  const b2csMap = {};
  for (const inv of b2csInvoices) {
    const stateCode = STATE_CODES[inv.place_of_supply] || STATE_CODES[inv.customer_state] || '99';
    if (!b2csMap[stateCode]) b2csMap[stateCode] = { pos: stateCode, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    const isInter = inv.gst_type === 'inter';
    b2csMap[stateCode].txval += Math.round(inv.subtotal / 100 * 100) / 100;
    if (isInter) {
      b2csMap[stateCode].iamt += Math.round(inv.tax_amount / 100 * 100) / 100;
    } else {
      b2csMap[stateCode].camt += Math.round(inv.tax_amount / 200 * 100) / 100;
      b2csMap[stateCode].samt += Math.round(inv.tax_amount / 200 * 100) / 100;
    }
  }

  const cdnrData = data.cnB2b.map(cn => {
    const stateCode = STATE_CODES[cn.place_of_supply] || '99';
    const isInter = cn.gst_type === 'inter';
    return {
      ctin: cn.customer_gstin,
      trdNm: cn.customer_name,
      nt: [{
        nt_num: cn.credit_note_number,
        nt_dt: cn.cn_date,
        ntty: 'C',
        rsn: cn.reason || 'Others',
        inum: cn.ref_invoice,
        val: Math.round(cn.total_amount / 100 * 100) / 100,
        itms: [{
          num: 1,
          itm_det: {
            txval: Math.round(cn.subtotal / 100 * 100) / 100,
            rt: cn.total_amount > 0 ? Math.round(cn.tax_amount / cn.subtotal * 100 * 100) / 100 : 0,
            camt: isInter ? 0 : Math.round(cn.tax_amount / 200 * 100) / 100,
            samt: isInter ? 0 : Math.round(cn.tax_amount / 200 * 100) / 100,
            iamt: isInter ? Math.round(cn.tax_amount / 100 * 100) / 100 : 0,
            csamt: 0,
          }
        }],
        pos: stateCode,
        rchrg: 'N',
      }]
    };
  });

  const hsnData = data.hsn.map(h => ({
    hsn_sc: h.hsn_code,
    uqc: 'NOS',
    qty: parseFloat(h.total_qty) || 0,
    val: Math.round((h.total_value || 0) / 100 * 100) / 100,
    txval: Math.round((h.total_value || 0) / 100 * 100) / 100,
    iamt: 0, camt: 0, samt: 0, csamt: 0,
  }));

  return {
    gstin: sellerGstin,
    fp: period,
    gstinUser: sellerLegalName || '',
    b2b: b2bInvoices.length > 0 ? b2bInvoices : undefined,
    b2cl: b2clInvoices.length > 0 ? b2clInvoices : undefined,
    b2cs: Object.values(b2csMap).length > 0 ? Object.values(b2csMap) : undefined,
    cdnr: cdnrData.length > 0 ? cdnrData : undefined,
    hsndata: hsnData.length > 0 ? hsnData : undefined,
  };
}

async function getGstr3bSummary(tenantId, fromDate, toDate) {
  const [outwardSupplies] = await db.query(`
    SELECT i.gst_type, i.place_of_supply,
           COALESCE(SUM(i.subtotal), 0) as total_taxable,
           COALESCE(SUM(i.tax_amount), 0) as total_tax,
           COUNT(*) as count
    FROM hris_saas.invoices i
    WHERE i.tenant_id = $1
      AND i.invoice_date BETWEEN $2 AND $3
      AND i.status NOT IN ('draft', 'cancelled')
    GROUP BY i.gst_type, i.place_of_supply`, [tenantId, fromDate, toDate]);

  const [creditNotes] = await db.query(`
    SELECT COALESCE(SUM(cn.subtotal), 0) as total_taxable,
           COALESCE(SUM(cn.tax_amount), 0) as total_tax
    FROM hris_saas.credit_notes cn
    WHERE cn.tenant_id = $1
      AND cn.cn_date BETWEEN $2 AND $3
      AND cn.status = 'issued'`, [tenantId, fromDate, toDate]);

  const [purchaseSummary] = await db.query(`
    SELECT COALESCE(SUM(po.total_amount), 0) as total_purchases
    FROM hris_saas.purchase_orders po
    WHERE po.tenant_id = $1
      AND po.order_date BETWEEN $2 AND $3
      AND po.status IN ('received', 'approved')`, [tenantId, fromDate, toDate]);

  let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
  for (const row of outwardSupplies) {
    totalTaxable += parseInt(row.total_taxable);
    if (row.gst_type === 'inter') {
      totalIgst += parseInt(row.total_tax);
    } else {
      totalCgst += Math.round(parseInt(row.total_tax) / 2);
      totalSgst += Math.round(parseInt(row.total_tax) / 2);
    }
  }

  return {
    period: { from: fromDate, to: toDate },
    outwardSupplies: outwardSupplies,
    taxableValue: Math.round(totalTaxable / 100 * 100) / 100,
    cgst: Math.round(totalCgst / 100 * 100) / 100,
    sgst: Math.round(totalSgst / 100 * 100) / 100,
    igst: Math.round(totalIgst / 100 * 100) / 100,
    totalTaxLiability: Math.round((totalCgst + totalSgst + totalIgst) / 100 * 100) / 100,
    creditNotesAmount: Math.round((creditNotes[0]?.total_taxable || 0) / 100 * 100) / 100,
    creditNotesTax: Math.round((creditNotes[0]?.total_tax || 0) / 100 * 100) / 100,
    totalPurchases: Math.round((purchaseSummary[0]?.total_purchases || 0) / 100 * 100) / 100,
    invoiceCount: outwardSupplies.reduce((s, r) => s + parseInt(r.count || 0), 0),
  };
}

module.exports = { getGstr1Data, buildGstr1Json, getGstr3bSummary, STATE_CODES };
