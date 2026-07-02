jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const Pool = jest.fn(() => ({ query: mockQuery, on: jest.fn() }));
  return { Pool };
});

const { buildGstr1Json, STATE_CODES } = require('./gstReturns');

describe('STATE_CODES', () => {
  test('has codes for major states', () => {
    expect(STATE_CODES['Maharashtra']).toBe('27');
    expect(STATE_CODES['Delhi']).toBe('07');
    expect(STATE_CODES['Karnataka']).toBe('29');
    expect(STATE_CODES['Tamil Nadu']).toBe('33');
    expect(STATE_CODES['Gujarat']).toBe('24');
  });
});

describe('buildGstr1Json', () => {
  const sellerInfo = { gstin: '27AAACS1234A1Z5', name: 'Test Seller', period: '062026' };

  test('builds B2B section with intra-state GST split', () => {
    const data = {
      b2b: [{
        invoice_number: 'INV-001', invoice_date: '15-06-2026',
        total_amount: 118000, subtotal: 100000, tax_amount: 18000,
        gst_type: 'intra', place_of_supply: 'Maharashtra',
        customer_name: 'Test Buyer', customer_gstin: '27AAACT5678A1Z3',
        customer_state: 'Maharashtra', irn: 'MOCKIRN123',
      }],
      b2c: [], cnB2b: [], hsn: [],
    };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);

    expect(result.gstin).toBe('27AAACS1234A1Z5');
    expect(result.fp).toBe('062026');
    expect(result.b2b).toHaveLength(1);
    expect(result.b2b[0].ctin).toBe('27AAACT5678A1Z3');
    expect(result.b2b[0].inv[0].inum).toBe('INV-001');

    const itmDet = result.b2b[0].inv[0].itms[0].itm_det;
    expect(itmDet.txval).toBe(1000); // 100000 paise = ₹1000
    expect(itmDet.camt).toBe(90);    // CGST = 18000 paise / 200 = 90
    expect(itmDet.samt).toBe(90);    // SGST = 18000 paise / 200 = 90
    expect(itmDet.iamt).toBe(0);     // No IGST for intra
    expect(result.b2b[0].inv[0].pos).toBe('27');
    expect(result.b2b[0].inv[0].einv).toBe('Y');
    expect(result.b2b[0].inv[0].irn).toBe('MOCKIRN123');
  });

  test('builds B2B section with inter-state IGST', () => {
    const data = {
      b2b: [{
        invoice_number: 'INV-002', invoice_date: '20-06-2026',
        total_amount: 118000, subtotal: 100000, tax_amount: 18000,
        gst_type: 'inter', place_of_supply: 'Karnataka',
        customer_name: 'Bangalore Buyer', customer_gstin: '29AAACT9999A1Z4',
        customer_state: 'Karnataka', irn: null,
      }],
      b2c: [], cnB2b: [], hsn: [],
    };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);
    const itmDet = result.b2b[0].inv[0].itms[0].itm_det;

    expect(itmDet.iamt).toBe(180);   // Full IGST = 18000 paise / 100 = 180
    expect(itmDet.camt).toBe(0);
    expect(itmDet.samt).toBe(0);
    expect(result.b2b[0].inv[0].pos).toBe('29');
    expect(result.b2b[0].inv[0].einv).toBe('N');
    expect(result.b2b[0].inv[0].irn).toBe('');
  });

  test('separates B2CL (>250k) and B2CS (<=250k) invoices', () => {
    const data = {
      b2b: [],
      b2c: [
        { invoice_number: 'INV-B2CL', invoice_date: '10-06-2026', total_amount: 300000,
          subtotal: 300000, tax_amount: 0, gst_type: 'intra',
          place_of_supply: 'Delhi', customer_name: 'Big Buyer', customer_state: 'Delhi' },
        { invoice_number: 'INV-B2CS', invoice_date: '11-06-2026', total_amount: 200000,
          subtotal: 200000, tax_amount: 0, gst_type: 'intra',
          place_of_supply: 'Delhi', customer_name: 'Small Buyer', customer_state: 'Delhi' },
      ],
      cnB2b: [], hsn: [],
    };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);

    expect(result.b2cl).toHaveLength(1);
    expect(result.b2cl[0].inv[0].inum).toBe('INV-B2CL');
    expect(result.b2cs).toHaveLength(1);
    expect(result.b2cs[0].pos).toBe('07');
    expect(result.b2cs[0].txval).toBeGreaterThan(0);
  });

  test('builds credit notes section (CDNR)', () => {
    const data = {
      b2b: [], b2c: [],
      cnB2b: [{
        credit_note_number: 'CN-001', cn_date: '25-06-2026',
        total_amount: 59000, subtotal: 50000, tax_amount: 9000,
        gst_type: 'intra', place_of_supply: 'Maharashtra',
        reason: 'Return', customer_name: 'Test Buyer', customer_gstin: '27AAACT5678A1Z3',
        ref_invoice: 'INV-001',
      }],
      hsn: [],
    };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);

    expect(result.cdnr).toHaveLength(1);
    expect(result.cdnr[0].ctin).toBe('27AAACT5678A1Z3');
    expect(result.cdnr[0].nt[0].nt_num).toBe('CN-001');
    expect(result.cdnr[0].nt[0].inum).toBe('INV-001');
    expect(result.cdnr[0].nt[0].ntty).toBe('C');

    const itmDet = result.cdnr[0].nt[0].itms[0].itm_det;
    expect(itmDet.txval).toBe(500);  // 50000 paise = ₹500
    expect(itmDet.camt).toBe(45);    // 9000 paise / 200 = 45
    expect(itmDet.samt).toBe(45);
  });

  test('builds HSN summary section', () => {
    const data = {
      b2b: [], b2c: [], cnB2b: [],
      hsn: [
        { hsn_code: '847130', total_qty: 10, total_value: 500000, total_tax: 90000 },
        { hsn_code: '620442', total_qty: 5, total_value: 250000, total_tax: 45000 },
      ],
    };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);

    expect(result.hsndata).toHaveLength(2);
    expect(result.hsndata[0].hsn_sc).toBe('847130');
    expect(result.hsndata[0].qty).toBe(10);
    expect(result.hsndata[0].val).toBe(5000); // 500000 paise / 100 = ₹5000
    expect(result.hsndata[1].hsn_sc).toBe('620442');
  });

  test('omits empty sections', () => {
    const data = { b2b: [], b2c: [], cnB2b: [], hsn: [] };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);

    expect(result.b2b).toBeUndefined();
    expect(result.b2cl).toBeUndefined();
    expect(result.b2cs).toBeUndefined();
    expect(result.cdnr).toBeUndefined();
    expect(result.hsndata).toBeUndefined();
  });

  test('calculates tax rate correctly', () => {
    const data = {
      b2b: [{
        invoice_number: 'INV-003', invoice_date: '15-06-2026',
        total_amount: 118000, subtotal: 100000, tax_amount: 18000,
        gst_type: 'intra', place_of_supply: 'Gujarat',
        customer_name: 'Guj Buyer', customer_gstin: '24AAACT5678A1Z5',
        customer_state: 'Gujarat', irn: null,
      }],
      b2c: [], cnB2b: [], hsn: [],
    };

    const result = buildGstr1Json(data, sellerInfo.gstin, sellerInfo.name, sellerInfo.period);

    const rt = result.b2b[0].inv[0].itms[0].itm_det.rt;
    expect(rt).toBe(18); // 180 / 1000 * 100 = 18%
  });
});
