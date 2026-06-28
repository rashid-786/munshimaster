const https = require('https');
const db = require('../config/db');
const { getSellerCredentials, getStateCode } = require('./einvoice');

const IS_SANDBOX = process.env.EINVOICE_SANDBOX !== 'false';
const BASE_URL = IS_SANDBOX
  ? 'einv-apisandbox.nic.in'
  : 'api.einvoice.gov.in';

function buildEwaybillPayload(invoice, items, seller, customer, transport) {
  const buyerStateCode = getStateCode(customer.state || '');
  const sellerStateCode = getStateCode(seller.sellerState || '');
  const placeOfSupply = invoice.place_of_supply
    ? getStateCode(invoice.place_of_supply)
    : buyerStateCode;
  const isInter = invoice.gst_type === 'inter';

  const itemList = items.map((item, idx) => ({
    SlNo: idx + 1,
    PrdDesc: item.description || 'Item',
    IsServc: item.product_id ? 'N' : 'Y',
    HsnCd: item.hsn_code || '',
    Qty: parseFloat(item.quantity) || 1,
    Unit: 'NOS',
    UnitPrice: (item.unit_price || 0) / 100,
    TotAmt: (item.total_price || 0) / 100,
    AssAmt: (item.total_price || 0) / 100,
    GstRt: parseFloat(item.cgst_rate || 0) + parseFloat(item.sgst_rate || 0) + parseFloat(item.igst_rate || 0),
    TxVal: (item.total_price || 0) / 100,
    TotItemVal: (item.total_price || 0) / 100,
  }));

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

  return {
    ewbGstin: seller.sellerGstin || '',
    ewbVersion: '1.0.042',
    ewbDtls: {
      DocTyp: 'INV',
      DocNo: invoice.invoice_number,
      DocDt: invoice.invoice_date,
      FromGstin: seller.sellerGstin || '',
      FromTrdNm: seller.company_name || '',
      FromAddr1: seller.sellerAddress || '',
      FromAddr2: '',
      FromPlace: seller.sellerCity || '',
      FromPincode: parseInt(seller.sellerPincode) || 0,
      FromStateCode: parseInt(sellerStateCode) || 0,
      ActFromStateCode: parseInt(sellerStateCode) || 0,
      ToGstin: customer.gstin || 'URP',
      ToTrdNm: customer.name || '',
      ToAddr1: customer.address || '',
      ToAddr2: '',
      ToPlace: customer.city || '',
      ToPincode: parseInt(customer.pincode) || 0,
      ToStateCode: parseInt(placeOfSupply) || 0,
      ActToStateCode: parseInt(placeOfSupply) || 0,
      TotInvVal: Math.round(totalTaxable * 100) / 100,
      TotInvValCgst: Math.round(totalCgst * 100) / 100,
      TotInvValSgst: Math.round(totalSgst * 100) / 100,
      TotInvValIgst: Math.round(totalIgst * 100) / 100,
      TotInvValCes: 0,
      TotInvValStCes: 0,
      TotInvValOthChrg: 0,
      TotInvValRoff: 0,
      TransactionType: isInter ? 1 : 4,
      TransMode: transport.vehicleNumber ? '1' : '',
      TransDistance: transport.distance ? parseFloat(transport.distance) : 0,
      VehNo: transport.vehicleNumber || '',
      VehTy: transport.vehicleType || 'R',
      TransId: transport.transporterGstin || '',
      TransName: transport.transporterName || '',
      TrnDocNo: transport.transportDocNumber || '',
      TrnDocDt: transport.transportDocDate || '',
      ItemList: itemList,
      MainHsnCd: items[0]?.hsn_code || '',
      TotNonAdvVal: 0,
    },
  };
}

async function generateEwaybill(invoiceData, transport, credentials) {
  const { clientId, clientSecret } = credentials;

  if (!clientId || !clientSecret) {
    return simulateEwaybill(invoiceData);
  }

  const payload = JSON.stringify(invoiceData);
  const encoded = Buffer.from(payload).toString('base64');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: '/ewb/v1.0/ewaybill',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'gstin': credentials.gstin,
        'client_id': clientId,
        'client_secret': clientSecret,
        'username': credentials.username || '',
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
            reject(new Error(result.Error.Message || 'E-Way Bill API error'));
          } else {
            resolve({
              ewbNo: result.EwbNo,
              ewbDt: result.EwbDt,
              ewbValidTill: result.EwbValidTill,
              ewbId: result.EwbId,
            });
          }
        } catch (e) {
          reject(new Error('Invalid E-Way Bill response: ' + body.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('E-Way Bill API timeout')); });
    req.write(encoded);
    req.end();
  });
}

async function simulateEwaybill(invoiceData) {
  const crypto = require('crypto');
  const ewbDtls = invoiceData.ewbDtls || invoiceData;
  const hash = crypto.createHash('sha256').update(JSON.stringify(ewbDtls)).digest('hex');
  const ewbNo = `EWB${hash.slice(0, 8).toUpperCase()}${String(Date.now()).slice(-6)}`;

  const now = new Date();
  const validTill = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  return {
    ewbNo,
    ewbDt: now.toISOString(),
    ewbValidTill: validTill.toISOString(),
    ewbId: `SIM_${ewbNo}`,
  };
}

async function cancelEwaybill(ewbNo, cancelReason, credentials) {
  const { clientId, clientSecret } = credentials;

  if (!clientId || !clientSecret) {
    console.log(`[E-Way Bill] Simulated cancel ${ewbNo}: ${cancelReason}`);
    return { ewbNo, cancelDate: new Date().toISOString() };
  }

  const data = JSON.stringify({ EwbNo: ewbNo, CnlRsn: cancelReason });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: '/ewb/v1.0/ewaybill/cancel',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'gstin': credentials.gstin,
        'client_id': clientId,
        'client_secret': clientSecret,
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
            reject(new Error(result.Error.Message || 'Cancel E-Way Bill error'));
          } else {
            resolve({ ewbNo, cancelDate: result.CancelDate || new Date().toISOString() });
          }
        } catch (e) {
          reject(new Error('Invalid cancel response: ' + body.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Cancel E-Way Bill timeout')); });
    req.write(data);
    req.end();
  });
}

async function getEwaybillStatus(ewbNo, credentials) {
  const { clientId, clientSecret } = credentials;

  if (!clientId || !clientSecret) {
    return { ewbNo, status: 'ACTIVE' };
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/ewb/v1.0/ewaybill/${ewbNo}`,
      method: 'GET',
      headers: {
        'gstin': credentials.gstin,
        'client_id': clientId,
        'client_secret': clientSecret,
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

module.exports = {
  buildEwaybillPayload,
  generateEwaybill,
  cancelEwaybill,
  getEwaybillStatus,
};
