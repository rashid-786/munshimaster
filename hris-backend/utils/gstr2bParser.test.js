jest.mock('uuid', () => ({ v4: () => 'mocked-uuid' }));

const { parseGstr2b, autoMatchItems, SECTION_LABELS } = require('./gstr2bParser');

describe('SECTION_LABELS', () => {
  test('has labels for all sections', () => {
    expect(SECTION_LABELS.b2b).toBe('B2B Invoices');
    expect(SECTION_LABELS.cdnr).toBe('Credit Notes');
    expect(SECTION_LABELS.impg).toBe('Import of Goods');
    expect(SECTION_LABELS.imps).toBe('Import of Services');
    expect(SECTION_LABELS.nil).toBe('Nil / Exempted');
  });
});

describe('parseGstr2b', () => {
  test('parses B2B section with one invoice', () => {
    const json = {
      b2b: [{
        ctin: '27AAACT5678A1Z3',
        trdnm: 'Test Supplier',
        inv: [{
          inum: 'SUP-INV-001',
          idt: '15-06-2026',
          val: 118000,
          txval: 100000,
          igst: 18000,
          cgst: 0,
          sgst: 0,
          cess: 0,
        }],
      }],
    };

    const result = parseGstr2b(json, 'tenant-1', 'import-1');

    expect(result.items).toHaveLength(1);
    expect(result.sectionSummary.b2b.count).toBe(1);

    const item = result.items[0];
    expect(item.supplier_gstin).toBe('27AAACT5678A1Z3');
    expect(item.supplier_name).toBe('Test Supplier');
    expect(item.invoice_number).toBe('SUP-INV-001');
    expect(item.total_value).toBe(118000);
    expect(item.taxable_value).toBe(100000);
    expect(item.igst).toBe(18000);
    expect(item.cgst).toBe(0);
    expect(item.sgst).toBe(0);
    expect(item.match_status).toBe('unmatched');
  });

  test('parses invoice date in dd-MM-yyyy format', () => {
    const json = {
      b2b: [{
        ctin: '27AAACT5678A1Z3', trdnm: 'S',
        inv: [{ inum: 'INV-001', idt: '01-04-2026', val: 1000, txval: 1000, igst: 0, cgst: 0, sgst: 0, cess: 0 }],
      }],
    };

    const result = parseGstr2b(json, 't1', 'i1');
    expect(result.items[0].invoice_date).toBe('2026-04-01');
  });

  test('parses multiple invoice sections', () => {
    const json = {
      b2b: [
        { ctin: 'GSTIN1', trdnm: 'S1', inv: [{ inum: 'INV-1', idt: '01-04-2026', val: 1000, txval: 1000, igst: 0, cgst: 0, sgst: 0, cess: 0 }] },
        { ctin: 'GSTIN2', trdnm: 'S2', inv: [{ inum: 'INV-2', idt: '02-04-2026', val: 2000, txval: 2000, igst: 0, cgst: 0, sgst: 0, cess: 0 }] },
      ],
      cdnr: [{
        ctin: 'GSTIN1', trdnm: 'S1',
        nt: [{ nt_num: 'CN-1', nt_dt: '05-04-2026', val: 500, txval: 500, igst: 0, cgst: 0, sgst: 0, cess: 0 }],
      }],
    };

    const result = parseGstr2b(json, 't1', 'i1');

    expect(result.items).toHaveLength(3);
    expect(result.sectionSummary.b2b.count).toBe(2);
    expect(result.sectionSummary.cdnr.count).toBe(1);
  });

  test('handles empty sections gracefully', () => {
    const json = { b2b: [], cdnr: [], nil: [] };
    const result = parseGstr2b(json, 't1', 'i1');

    expect(result.items).toHaveLength(0);
    expect(Object.keys(result.sectionSummary)).toHaveLength(0);
  });

  test('handles nil/empty JSON', () => {
    const result = parseGstr2b({}, 't1', 'i1');
    expect(result.items).toHaveLength(0);
  });

  test('handles alternative field names (suplrGstin, sup, invNum)', () => {
    const json = {
      imps: [{
        suplrGstin: '27AAACT5678A1Z3',
        sup: 'Foreign Supplier',
        itms: [{ invNum: 'IMP-001', invDt: '10-06-2026', val: 50000, txval: 50000, igst: 9000, cgst: 0, sgst: 0, cess: 0 }],
      }],
    };

    const result = parseGstr2b(json, 't1', 'i1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].supplier_gstin).toBe('27AAACT5678A1Z3');
    expect(result.items[0].supplier_name).toBe('Foreign Supplier');
    expect(result.items[0].invoice_number).toBe('IMP-001');
    expect(result.items[0].section_type).toBe('imps');
  });
});

describe('autoMatchItems', () => {
  const makePO = (id, poNum, gstin, amount) => ({
    id, po_number: poNum, supplier_gstin: gstin, total_amount: amount,
  });

  const makeItem = (supplierGstin, totalValue) => ({
    supplier_gstin: supplierGstin, total_value: totalValue,
    match_status: 'unmatched', matched_po_id: null, matched_po_number: null, matched_at: null,
  });

  test('matches exact single PO by GSTIN and amount within 5%', () => {
    const items = [makeItem('27AAACT5678A1Z3', 100000)];
    const pos = [makePO('po1', 'PO-001', '27AAACT5678A1Z3', 10000000)]; // 100000 in paise

    const result = autoMatchItems(items, pos);
    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(0);
    expect(result.ambiguous).toBe(0);
    expect(items[0].match_status).toBe('matched');
    expect(items[0].matched_po_id).toBe('po1');
  });

  test('flags amount mismatch over 5% as unmatched', () => {
    const items = [makeItem('27AAACT5678A1Z3', 100000)];
    const pos = [makePO('po1', 'PO-001', '27AAACT5678A1Z3', 9000000)]; // 90000 in paise (10% diff)

    const result = autoMatchItems(items, pos);
    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(items[0].match_status).toBe('unmatched');
  });

  test('flags ambiguous when multiple POs match same GSTIN + amount', () => {
    const items = [makeItem('27AAACT5678A1Z3', 100000)];
    const pos = [
      makePO('po1', 'PO-001', '27AAACT5678A1Z3', 10000000),
      makePO('po2', 'PO-002', '27AAACT5678A1Z3', 10200000),
    ];

    const result = autoMatchItems(items, pos);
    expect(result.matched).toBe(0);
    expect(result.ambiguous).toBe(1);
    expect(items[0].match_status).toBe('ambiguous');
  });

  test('ignores POs with different GSTIN', () => {
    const items = [makeItem('27AAACT5678A1Z3', 100000)];
    const pos = [makePO('po1', 'PO-001', '29AAACT9999A1Z4', 10000000)];

    const result = autoMatchItems(items, pos);
    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
  });

  test('handles empty POs list', () => {
    const items = [makeItem('27AAACT5678A1Z3', 100000)];
    const result = autoMatchItems(items, []);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
  });

  test('matches multiple items correctly', () => {
    const items = [
      makeItem('GSTIN-A', 50000),
      makeItem('GSTIN-B', 75000),
      makeItem('GSTIN-A', 99999), // no match (different amount)
    ];
    const pos = [
      makePO('po1', 'PO-001', 'GSTIN-A', 5000000),
      makePO('po2', 'PO-002', 'GSTIN-B', 7500000),
    ];

    const result = autoMatchItems(items, pos);
    expect(result.matched).toBe(2);
    expect(result.unmatched).toBe(1);
    expect(items[0].match_status).toBe('matched');
    expect(items[1].match_status).toBe('matched');
    expect(items[2].match_status).toBe('unmatched');
  });
});
