jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const Pool = jest.fn(() => ({ query: mockQuery, on: jest.fn() }));
  return { Pool };
});

jest.mock('https', () => ({ request: jest.fn() }));

const { buildEinvoicePayload, getStateCode } = require('./einvoice');

describe('getStateCode', () => {
  test('returns correct code for known states', () => {
    expect(getStateCode('Maharashtra')).toBe('27');
    expect(getStateCode('Delhi')).toBe('07');
    expect(getStateCode('Karnataka')).toBe('29');
  });

  test('returns 99 for unknown state', () => {
    expect(getStateCode('Unknown')).toBe('99');
    expect(getStateCode('')).toBe('99');
  });
});

describe('buildEinvoicePayload', () => {
  const seller = {
    sellerGstin: '27AAACS1234A1Z5',
    sellerState: 'Maharashtra',
    company_name: 'Test Seller',
    sellerAddress: '123 Main St',
    sellerCity: 'Mumbai',
    sellerPincode: '400001',
  };

  const customer = {
    gstin: '29AAACT9999A1Z4',
    name: 'Test Customer',
    state: 'Karnataka',
    address: '456 Oak Rd',
    city: 'Bangalore',
    pincode: '560001',
  };

  const invoice = {
    invoice_number: 'INV-001',
    invoice_date: '15-06-2026',
    gst_type: 'inter',
    place_of_supply: 'Karnataka',
    total_amount: 118000,
  };

  const items = [
    {
      description: 'Product A',
      quantity: 2,
      unit_price: 50000, // paise
      total_price: 100000, // paise
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 9,
      hsn_code: '847130',
      product_id: 'prod-1',
    },
    {
      description: 'Service B',
      quantity: 1,
      unit_price: 18000,
      total_price: 18000,
      cgst_rate: 0,
      sgst_rate: 0,
      igst_rate: 18,
      hsn_code: '998311',
      product_id: null, // service
    },
  ];

  test('generates payload with correct structure', () => {
    const result = buildEinvoicePayload(invoice, items, seller, customer);

    expect(result).toBeDefined();
    expect(result.SellerDtls.Gstin).toBe('27AAACS1234A1Z5');
    expect(result.BuyerDtls.Gstin).toBe('29AAACT9999A1Z4');
    expect(result.DocDtls.Typ).toBe('INV');
    expect(result.DocDtls.No).toBe('INV-001');
    expect(result.ValDtls.TotInvVal).toBe(1302.4); // 1000 + 90 + 180 + 32.4
  });

  test('calculates inter-state IGST correctly', () => {
    const result = buildEinvoicePayload(invoice, items, seller, customer);

    // Item 1: 1000 * 9% = 90
    // Item 2: 180 * 18% = 32.40
    expect(result.ItemList).toHaveLength(2);

    expect(result.ItemList[0].GstRt).toBe(9);
    expect(result.ItemList[0].IgstAmt).toBe(90); // 1000 * 9%
    expect(result.ItemList[0].CgstAmt).toBe(0);
    expect(result.ItemList[0].SgstAmt).toBe(0);
    expect(result.ItemList[0].TotItemVal).toBe(1090); // 1000 + 90

    expect(result.ItemList[1].GstRt).toBe(18);
    expect(result.ItemList[1].IgstAmt).toBe(32.40); // 180 * 18%
    expect(result.ItemList[1].IsServc).toBe('Y');
  });

  test('handles intra-state CGST+SGST correctly', () => {
    const intraInvoice = { ...invoice, gst_type: 'intra', place_of_supply: 'Maharashtra' };
    const intraItems = [{
      ...items[0],
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 0,
    }];

    const result = buildEinvoicePayload(intraInvoice, intraItems, seller, customer);

    expect(result.ItemList[0].GstRt).toBe(18);
    expect(result.ItemList[0].CgstAmt).toBe(90);   // 1000 * 9%
    expect(result.ItemList[0].SgstAmt).toBe(90);   // 1000 * 9%
    expect(result.ItemList[0].IgstAmt).toBe(0);
    expect(result.ItemList[0].TotItemVal).toBe(1180); // 1000 + 90 + 90
  });

  test('sets supply type based on transaction', () => {
    const interResult = buildEinvoicePayload(invoice, items, seller, customer);
    expect(interResult.TranDtls.SupTyp).toBe('B2B');

    const sezCustomer = { ...customer, gstin: '29AAACT9999A1Z4' };
    const sezResult = buildEinvoicePayload(invoice, items, seller, sezCustomer);
    expect(sezResult.TranDtls.SupTyp).toBe('B2B');
  });

  test('generates item list with correct per-item amounts', () => {
    const singleItem = [items[0]];
    const result = buildEinvoicePayload(invoice, singleItem, seller, customer);

    expect(result.ItemList).toHaveLength(1);
    expect(result.ItemList[0].SlNo).toBe('1');
    expect(result.ItemList[0].HsnCd).toBe('847130');
    expect(result.ItemList[0].Qty).toBe(2);
    expect(result.ItemList[0].UnitPrice).toBe(500); // 50000 / 100
  });
});
