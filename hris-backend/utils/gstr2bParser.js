const { v4: uuidv4 } = require('uuid');

const SECTION_LABELS = {
  b2b: 'B2B Invoices',
  b2ba: 'B2B Amended',
  cdnr: 'Credit Notes',
  cdnra: 'Credit Notes Amended',
  isda: 'ISD',
  isdaa: 'ISD Amended',
  impg: 'Import of Goods',
  imps: 'Import of Services',
  nil: 'Nil / Exempted',
};

function parseGstr2b(json, tenantId, importId) {
  const items = [];
  const sectionSummary = {};

  for (const [section, entries] of Object.entries(json)) {
    if (!Array.isArray(entries) || entries.length === 0) continue;

    let count = 0;

    for (const entry of entries) {
      const supplierGstin = entry.ctin || entry.suplrGstin || '';
      const supplierName = entry.trdnm || entry.sup || entry.suplr || '';

      const invoices = entry.inv || entry.itms || [entry];

      for (const inv of invoices) {
        const invoiceNumber = inv.inum || inv.invNum || inv.docNum || '';
        const invoiceDateStr = inv.idt || inv.docDt || inv.invDt || '';
        const totalValue = parseFloat(inv.val || inv.txval || 0) || 0;
        const taxableValue = parseFloat(inv.txval || inv.taxableValue || inv.val || 0) || 0;
        const igst = parseFloat(inv.igst || inv.iTax || 0) || 0;
        const cgst = parseFloat(inv.cgst || inv.cTax || 0) || 0;
        const sgst = parseFloat(inv.sgst || inv.sTax || 0) || 0;
        const cess = parseFloat(inv.cess || 0) || 0;

        let invoiceDate = null;
        if (invoiceDateStr) {
          const parts = invoiceDateStr.split(/[-/]/);
          if (parts.length === 3) {
            if (invoiceDateStr.includes('-')) {
              const [d, m, y] = parts;
              if (d.length === 2 && m.length === 2 && (y.length === 4 || y.length === 2)) {
                invoiceDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              }
            } else if (invoiceDateStr.includes('/')) {
              const [d, m, y] = parts;
              invoiceDate = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        }

        items.push({
          id: uuidv4(),
          import_id: importId,
          tenant_id: tenantId,
          section_type: section,
          supplier_gstin: supplierGstin,
          supplier_name: supplierName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          total_value: totalValue,
          taxable_value: taxableValue,
          igst,
          cgst,
          sgst,
          cess,
          match_status: 'unmatched',
          matched_po_id: null,
          matched_po_number: null,
          matched_at: null,
        });

        count++;
      }
    }

    sectionSummary[section] = { count, label: SECTION_LABELS[section] || section };
  }

  return { items, sectionSummary };
}

function autoMatchItems(items, purchaseOrders) {
  const poMap = {};
  for (const po of purchaseOrders) {
    const key = po.supplier_gstin || '';
    if (!poMap[key]) poMap[key] = [];
    poMap[key].push(po);
  }

  let matched = 0, unmatched = 0, ambiguous = 0;

  for (const item of items) {
    const supplierPos = poMap[item.supplier_gstin] || poMap[''] || [];
    const candidates = supplierPos.filter(po => {
      const amountDiff = Math.abs((po.total_amount || 0) / 100 - item.total_value);
      return amountDiff / Math.max(item.total_value, 1) <= 0.05;
    });

    if (candidates.length === 0) {
      item.match_status = 'unmatched';
      unmatched++;
    } else if (candidates.length === 1) {
      item.match_status = 'matched';
      item.matched_po_id = candidates[0].id;
      item.matched_po_number = candidates[0].po_number;
      item.matched_at = new Date().toISOString();
      matched++;
    } else {
      item.match_status = 'ambiguous';
      ambiguous++;
    }
  }

  return { items, matched, unmatched, ambiguous };
}

module.exports = { parseGstr2b, autoMatchItems, SECTION_LABELS };
