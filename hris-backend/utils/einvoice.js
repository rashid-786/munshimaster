const https = require('https');
const db = require('../config/db');

const IS_SANDBOX = process.env.EINVOICE_SANDBOX !== 'false';
const BASE_URL = IS_SANDBOX
  ? 'einv-apisandbox.nic.in'
  : 'einvoiceapi.einvoice.gov.in';

const STATE_CODES = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03', 'Chandigarh': '04',
  'Uttarakhand': '05', 'Haryana': '06', 'Delhi': '07', 'Rajasthan': '08',
  'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11', 'Arunachal Pradesh': '12',
  'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15', 'Tripura': '16',
  'Meghalaya': '17', 'Assam': '18', 'West Bengal': '19', 'Jharkhand': '20',
  'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23', 'Gujarat': '24',
  'Dadra and Nagar Haveli and Daman and Diu': '26', 'Maharashtra': '27', 'Andhra Pradesh': '28',
  'Karnataka': '29', 'Goa': '30', 'Lakshadweep': '31', 'Kerala': '32',
  'Tamil Nadu': '33', 'Puducherry': '34', 'Andaman and Nicobar': '35',
  'Telangana': '36', 'Andhra Pradesh (New)': '37', 'Ladakh': '38',
  'Other Territory': '97', 'Centre Jurisdiction': '99',
};

function getStateCode(stateName) {
  return STATE_CODES[stateName] || '99';
}

function buildEinvoicePayload(invoice, items, seller, customer) {
  const docType = invoice.gst_type === 'inter' ? 'INV' : 'INV';
  const placeOfSupply = invoice.place_of_supply
    ? getStateCode(invoice.place_of_supply)
    : getStateCode(seller.sellerState || '');

  const itemList = items.map((item, idx) => {
    const qty = parseFloat(item.quantity) || 1;
    const rate = (item.unit_price) / 100;
    const total = (item.total_price) / 100;
    const discount = 0;
    const cgstRate = parseFloat(item.cgst_rate) || 0;
    const sgstRate = parseFloat(item.sgst_rate) || 0;
    const igstRate = parseFloat(item.igst_rate) || 0;
    const taxableAmount = total - discount;
    const cgstAmt = Math.round(taxableAmount * cgstRate / 100 * 100) / 100;
    const sgstAmt = Math.round(taxableAmount * sgstRate / 100 * 100) / 100;
    const igstAmt = Math.round(taxableAmount * igstRate / 100 * 100) / 100;
    const totalItemAmt = taxableAmount + cgstAmt + sgstAmt + igstAmt;

    return {
      SlNo: String(idx + 1),
      PrdDesc: item.description || 'Item',
      IsServc: item.product_id ? 'N' : 'Y',
      HsnCd: item.hsn_code || '',
      Barcde: '',
      Qty: qty,
      FreeQty: 0,
      Unit: 'NOS',
      UnitPrice: rate,
      TotAmt: totalItemAmt,
      Discount: discount,
      AssAmt: taxableAmount,
      GstRt: cgstRate + sgstRate + igstRate,
      CgstAmt: cgstAmt,
      SgstAmt: sgstAmt,
      IgstAmt: igstAmt,
      TxVal: taxableAmount,
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: totalItemAmt,
      OrdLineRef: String(idx + 1),
      OrgCntry: 'IND',
    };
  });

  const totalTaxable = items.reduce((s, i) => s + (i.total_price), 0) / 100;
  const totalCgst = items.reduce((s, i) => {
    const taxable = (i.total_price) / 100;
    const rate = parseFloat(i.cgst_rate) || 0;
    return s + Math.round(taxable * rate / 100 * 100) / 100;
  }, 0);
  const totalSgst = items.reduce((s, i) => {
    const taxable = (i.total_price) / 100;
    const rate = parseFloat(i.sgst_rate) || 0;
    return s + Math.round(taxable * rate / 100 * 100) / 100;
  }, 0);
  const totalIgst = items.reduce((s, i) => {
    const taxable = (i.total_price) / 100;
    const rate = parseFloat(i.igst_rate) || 0;
    return s + Math.round(taxable * rate / 100 * 100) / 100;
  }, 0);

  const invoiceTotal = totalTaxable + totalCgst + totalSgst + totalIgst;

  const payload = {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      RegRev: 'N',
      EcmGstin: '',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: docType,
      No: invoice.invoice_number,
      Dt: invoice.invoice_date,
    },
    SellerDtls: {
      Gstin: seller.sellerGstin || '',
      LglNm: seller.sellerLegalName || seller.company_name,
      TrdNm: seller.company_name || '',
      Addr1: seller.sellerAddress || '',
      Addr2: '',
      Loc: seller.sellerCity || '',
      Pin: parseInt(seller.sellerPincode) || 0,
      Stcd: getStateCode(seller.sellerState || ''),
      Ph: seller.phone || '',
      Em: seller.sellerEmail || '',
    },
    BuyerDtls: {
      Gstin: customer.gstin || 'URP',
      LglNm: customer.name || '',
      TrdNm: customer.contact_person || customer.name || '',
      Addr1: customer.address || '',
      Addr2: '',
      Loc: customer.city || '',
      Pin: parseInt(customer.pincode) || 0,
      Stcd: getStateCode(customer.state || ''),
      Ph: customer.phone || '',
      Em: customer.email || '',
      Pos: placeOfSupply,
    },
    DispDtls: {
      Gstin: '',
      LglNm: '',
      TrdNm: '',
      Addr1: '',
      Addr2: '',
      Loc: '',
      Pin: 0,
      Stcd: '',
    },
    ShipDtls: {
      Gstin: customer.gstin || 'URP',
      LglNm: customer.name || '',
      TrdNm: '',
      Addr1: customer.address || '',
      Addr2: '',
      Loc: customer.city || '',
      Pin: parseInt(customer.pincode) || 0,
      Stcd: getStateCode(customer.state || ''),
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: Math.round(totalTaxable * 100) / 100,
      CgstVal: Math.round(totalCgst * 100) / 100,
      SgstVal: Math.round(totalSgst * 100) / 100,
      IgstVal: Math.round(totalIgst * 100) / 100,
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: Math.round((invoiceTotal - Math.round(invoiceTotal * 100) / 100) * 100) / 100,
      TotInvVal: Math.round(invoiceTotal * 100) / 100,
      TotAdvVal: 0,
    },
    PayDtls: {
      Nm: '',
      AccDet: '',
      PayTerm: '',
      PayInstr: '',
      CrTrn: '',
      DirDr: '',
      CrDay: 0,
      PayAmt: 0,
      PayAmtFxd: 0,
      PayDueDt: invoice.due_date || '',
    },
    RefDtls: {
      InvRm: invoice.notes || '',
      DocPerdDtls: {
        InvStDt: invoice.invoice_date,
        InvEndDt: invoice.invoice_date,
      },
      PrefDocDtls: [],
      ContrDocDtls: [],
      AddlDocDtls: [],
    },
    AddlDocDtls: [],
    ExpDtls: {
      CntCode: '',
      Port: '',
      ShipBNo: '',
      ShipBDt: '',
      Por: '',
    },
    EwbDtls: {
      TransId: '',
      TransName: '',
      TransMode: '',
      Distance: 0,
      TransDocNo: '',
      TransDocDt: '',
      VehNo: '',
      VehType: '',
    },
  };

  return payload;
}

async function generateIRN(einvoicePayload, credentials) {
  const { gstin, username, password, clientId, clientSecret } = credentials;

  if (!clientId || !clientSecret) {
    return simulateIRN(einvoicePayload);
  }

  const data = JSON.stringify({
    Data: Buffer.from(JSON.stringify(einvoicePayload)).toString('base64'),
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: '/einv/v1.0/ei',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'gstin': gstin,
        'username': username || '',
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.Error) {
            reject(new Error(result.Error.Message || 'IRP API error'));
          } else {
            resolve({
              irn: result.Irn,
              ackNo: result.AckNo,
              ackDt: result.AckDt,
              signedInvoice: result.SignedInvoice,
              signedQRCode: result.SignedQRCode,
              einvoicePdf: result.EinvoicePdf,
            });
          }
        } catch (e) {
          reject(new Error('Invalid IRP response: ' + body.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('IRP API timeout')); });
    req.write(data);
    req.end();
  });
}

async function simulateIRN(einvoicePayload) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(JSON.stringify(einvoicePayload)).digest('hex');
  const irn = `${einvoicePayload.SellerDtls.Gstin || 'MOCK'}${hash.slice(0, 34)}${String(Date.now()).slice(-8)}`;

  const qrcode = require('qrcode');
  const qrData = JSON.stringify({
    Irn: irn,
    Dt: einvoicePayload.DocDtls.Dt,
    GstinOfSeller: einvoicePayload.SellerDtls.Gstin,
    GstinOfBuyer: einvoicePayload.BuyerDtls.Gstin,
    TotInvVal: einvoicePayload.ValDtls.TotInvVal,
    ItmCnt: einvoicePayload.ItemList.length,
  });
  const signedQRCode = await qrcode.toDataURL(qrData, { width: 300, margin: 2 });

  return {
    irn,
    ackNo: `ACK_${irn.slice(0, 10)}`,
    ackDt: new Date().toISOString(),
    signedInvoice: JSON.stringify(einvoicePayload),
    signedQRCode,
    einvoicePdf: null,
  };
}

async function cancelIRN(irn, cancelReason, credentials) {
  const { gstin, username, clientId, clientSecret } = credentials;

  if (!clientId || !clientSecret) {
    console.log(`[E-Invoice] Simulated cancel IRN ${irn}: ${cancelReason}`);
    return { irn, cancelDate: new Date().toISOString() };
  }

  const data = JSON.stringify({
    Irn: irn,
    CnlRm: cancelReason,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: '/einv/v1.0/ei/cancel',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'gstin': gstin,
        'username': username || '',
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.Error) {
            reject(new Error(result.Error.Message || 'Cancel IRP error'));
          } else {
            resolve({ irn, cancelDate: result.CancelDate || new Date().toISOString() });
          }
        } catch (e) {
          reject(new Error('Invalid cancel response: ' + body.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Cancel IRP timeout')); });
    req.write(data);
    req.end();
  });
}

async function getIRNStatus(irn, credentials) {
  const { gstin, clientId, clientSecret } = credentials;

  if (!clientId || !clientSecret) {
    return { irn, status: 'ACTIVE' };
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/einv/v1.0/ei/${irn}`,
      method: 'GET',
      headers: {
        'gstin': gstin,
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid status response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Status API timeout')); });
    req.end();
  });
}

async function getSellerCredentials(tenantId) {
  const [rows] = await db.query(
    `SELECT company_name, phone, settings FROM hris_saas.tenants WHERE id = $1`,
    [tenantId]
  );
  if (rows.length === 0) return null;

  const settings = typeof rows[0].settings === 'string'
    ? JSON.parse(rows[0].settings) : (rows[0].settings || {});

  return {
    company_name: rows[0].company_name,
    phone: rows[0].phone,
    sellerGstin: settings.sellerGstin || '',
    sellerLegalName: settings.sellerLegalName || rows[0].company_name,
    sellerAddress: settings.sellerAddress || '',
    sellerCity: settings.sellerCity || '',
    sellerState: settings.sellerState || '',
    sellerStateCode: settings.sellerStateCode || '',
    sellerPincode: settings.sellerPincode || '',
    sellerEmail: settings.sellerEmail || '',
    einvoiceEnabled: settings.einvoiceEnabled || false,
    irpClientId: settings.irpClientId || '',
    irpClientSecret: settings.irpClientSecret || '',
    irpUsername: settings.irpUsername || '',
    irpGstin: settings.irpGstin || '',
  };
}

module.exports = {
  buildEinvoicePayload,
  generateIRN,
  cancelIRN,
  getIRNStatus,
  getSellerCredentials,
  getStateCode,
  STATE_CODES,
};
