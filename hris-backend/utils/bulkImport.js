const XLSX = require('xlsx');

const COLUMN_MAP = {
  customer: {
    name: ['name', 'customer name', 'customer_name', 'party name', 'party'],
    email: ['email', 'e-mail', 'mail'],
    phone: ['phone', 'mobile', 'telephone', 'contact no', 'phone number'],
    address: ['address', 'addr', 'billing address'],
    city: ['city', 'town', 'district'],
    state: ['state', 'province'],
    pincode: ['pincode', 'pin code', 'pin', 'zip', 'zipcode'],
    gstin: ['gstin', 'gst', 'gst no', 'gst_number', 'gst no.', 'gstin no'],
    contact_person: ['contact person', 'contact_person', 'contactperson', 'contact'],
    credit_limit: ['credit limit', 'credit_limit', 'credit'],
    payment_terms: ['payment terms', 'payment_terms', 'terms'],
    notes: ['notes', 'remarks', 'note'],
  },
  supplier: {
    name: ['name', 'supplier name', 'supplier_name', 'vendor name', 'vendor'],
    email: ['email', 'e-mail', 'mail'],
    phone: ['phone', 'mobile', 'telephone', 'contact no'],
    address: ['address', 'addr'],
    city: ['city', 'town'],
    state: ['state', 'province'],
    pincode: ['pincode', 'pin code', 'pin'],
    gstin: ['gstin', 'gst', 'gst no', 'gst_number'],
    contact_person: ['contact person', 'contact_person', 'contact'],
    payment_terms: ['payment terms', 'payment_terms', 'terms'],
    notes: ['notes', 'remarks'],
  },
  product: {
    name: ['name', 'product name', 'product_name', 'item name', 'item', 'description'],
    hsn_code: ['hsn', 'hsn code', 'hsn_code', 'hsncode', 'sac'],
    selling_price: ['selling price', 'selling_price', 'price', 'rate', 'sale price'],
    purchase_price: ['purchase price', 'purchase_price', 'cost price', 'cost', 'buying price'],
    tax_rate: ['tax rate', 'tax_rate', 'gst', 'gst rate', 'cgst+sgst', 'tax', 'tax%'],
    unit: ['unit', 'uom', 'unit of measure'],
    stock: ['stock', 'opening stock', 'opening_stock', 'quantity', 'qty', 'current stock'],
    notes: ['notes', 'description', 'remarks'],
  },
};

function findColumn(headers, keys) {
  for (const key of keys) {
    const match = headers.find(h => h && h.trim().toLowerCase() === key.toLowerCase());
    if (match) return match;
  }
  const lowerHeaders = headers.map(h => h?.toLowerCase().trim() || '');
  for (const key of keys) {
    const idx = lowerHeaders.findIndex(h => h === key || h.replace(/[\s_-]/g, '') === key.replace(/[\s_-]/g, ''));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function parseFile(buffer, entityType) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (json.length === 0) return { rows: [], errors: ['Sheet is empty.'] };

  const headers = Object.keys(json[0]);
  const columnMap = COLUMN_MAP[entityType];
  if (!columnMap) return { rows: [], errors: [`Unknown entity type: ${entityType}`] };

  const mapping = {};
  for (const [field, aliases] of Object.entries(columnMap)) {
    const col = findColumn(headers, aliases);
    if (col) mapping[field] = col;
  }

  const rows = [];
  const errors = [];

  for (let i = 0; i < json.length; i++) {
    const raw = json[i];
    const row = { _row: i + 2 };

    if (entityType === 'customer' || entityType === 'supplier') {
      row.name = raw[mapping.name] || '';
      row.email = raw[mapping.email] || '';
      row.phone = String(raw[mapping.phone] || '');
      row.address = raw[mapping.address] || '';
      row.city = raw[mapping.city] || '';
      row.state = raw[mapping.state] || '';
      row.pincode = String(raw[mapping.pincode] || '');
      row.gstin = String(raw[mapping.gstin] || '').toUpperCase();
      row.contact_person = raw[mapping.contact_person] || '';
      row.credit_limit = parseFloat(raw[mapping.credit_limit]) || 0;
      row.payment_terms = raw[mapping.payment_terms] || '';
      row.notes = raw[mapping.notes] || '';

      if (!row.name) errors.push(`Row ${i + 2}: Name is required.`);
    }

    if (entityType === 'product') {
      row.name = raw[mapping.name] || '';
      row.hsn_code = String(raw[mapping.hsn_code] || '');
      row.selling_price = parseFloat(raw[mapping.selling_price]) || 0;
      row.purchase_price = parseFloat(raw[mapping.purchase_price]) || 0;
      row.tax_rate = parseFloat(raw[mapping.tax_rate]) || 0;
      row.unit = raw[mapping.unit] || 'Nos';
      row.stock = parseFloat(raw[mapping.stock]) || 0;
      row.notes = raw[mapping.notes] || '';

      if (!row.name) errors.push(`Row ${i + 2}: Name is required.`);
    }

    rows.push(row);
  }

  return { rows, errors, mapping };
}

module.exports = { parseFile, COLUMN_MAP };
