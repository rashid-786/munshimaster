const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_00000000000000',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret',
});

async function createPaymentLink({ amount, description, customerName, customerEmail, customerPhone, invoiceId, invoiceNumber, tenantId, callbackUrl }) {
  const payload = {
    amount: Math.round(amount * 100),
    currency: 'INR',
    accept_partial: false,
    description: description || `Invoice ${invoiceNumber}`,
    customer: {
      name: customerName || '',
      email: customerEmail || '',
      contact: customerPhone ? (customerPhone.startsWith('+') ? customerPhone : `+${customerPhone.replace(/[^0-9]/g, '')}`) : '',
    },
    notify: {
      sms: false,
      email: false,
    },
    notes: {
      invoice_id: invoiceId,
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
    },
    callback_url: callbackUrl || '',
    callback_method: 'get',
  };

  try {
    const link = await razorpay.paymentLink.create(payload);
    console.log(`[PaymentLink] Created ${link.id} for invoice ${invoiceNumber} (${link.short_url})`);
    return {
      id: link.id,
      short_url: link.short_url,
      status: link.status,
      created_at: new Date(link.created_at * 1000).toISOString(),
    };
  } catch (error) {
    console.error('[PaymentLink] Create failed:', error.message);
    throw new Error(error.message || 'Failed to create payment link');
  }
}

async function cancelPaymentLink(linkId) {
  try {
    await razorpay.paymentLink.cancel(linkId);
    console.log(`[PaymentLink] Cancelled ${linkId}`);
  } catch (error) {
    console.error('[PaymentLink] Cancel failed:', error.message);
    throw new Error(error.message || 'Failed to cancel payment link');
  }
}

async function fetchPaymentLink(linkId) {
  try {
    return await razorpay.paymentLink.fetch(linkId);
  } catch (error) {
    console.error('[PaymentLink] Fetch failed:', error.message);
    return null;
  }
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

function buildPaymentLinkEmailHtml(linkUrl, invoiceNumber, customerName, companyName, amount, dueDate) {
  return `
    <p>Dear ${customerName},</p>
    <p>Please find your invoice <strong>${invoiceNumber}</strong> from ${companyName}.</p>
    <p>Amount: <strong>Rs.${amount.toFixed(2)}</strong></p>
    ${dueDate ? `<p>Due Date: ${dueDate}</p>` : ''}
    <div style="text-align:center;margin:30px 0;">
      <a href="${linkUrl}"
         style="background:#2FBF71;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;display:inline-block;">
        Pay Now — Rs.${amount.toFixed(2)}
      </a>
    </div>
    <p style="color:#6b7280;font-size:12px;">This is a secure payment link powered by Razorpay.</p>
    <br/>
    <p style="color:#6b7280;font-size:12px;">Thank you for your business!</p>`;
}

module.exports = { createPaymentLink, cancelPaymentLink, fetchPaymentLink, verifyWebhookSignature, buildPaymentLinkEmailHtml };
