const twilio = require('twilio');

let client = null;

function getClient() {
  if (client) return client;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('[WhatsApp] Twilio client configured');
  } else {
    console.log('[WhatsApp] Twilio not configured — messages will be logged only');
  }
  return client;
}

const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

function formatNumber(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) return `whatsapp:+91${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `whatsapp:+91${cleaned}`;
  if (cleaned.startsWith('91') && cleaned.length === 12) return `whatsapp:+${cleaned}`;
  return `whatsapp:+${cleaned}`;
}

async function sendWhatsApp({ to, body, mediaUrl }) {
  const twilioClient = getClient();

  if (!twilioClient) {
    console.log(`[WhatsApp] Would send to ${to}: "${body}"`);
    return { sent: true, simulated: true };
  }

  try {
    const message = await twilioClient.messages.create({
      from: WHATSAPP_FROM,
      to: formatNumber(to),
      body,
      ...(mediaUrl ? { mediaUrl: Array.isArray(mediaUrl) ? mediaUrl : [mediaUrl] } : {}),
    });
    console.log(`[WhatsApp] Sent to ${to}: "${body.slice(0, 50)}..." (${message.sid})`);
    return { sent: true, sid: message.sid };
  } catch (error) {
    console.error(`[WhatsApp] Failed to send to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
}

function buildInvoiceMessage(invoice, customerName, companyName) {
  const total = (invoice.total_amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : 'N/A';
  let msg = `📄 *Invoice from ${companyName}*\n\nHi ${customerName},\n\nInvoice #${invoice.invoice_number || invoice.invoiceNumber}\nAmount: ₹${total}\nDue Date: ${dueDate}`;
  if (invoice.payment_link_url && invoice.payment_link_status !== 'cancelled') {
    msg += `\n\n🔗 Pay here: ${invoice.payment_link_url}`;
  }
  msg += `\n\nThank you for your business!`;
  return msg;
}

function buildPOMessage(po, supplierName, companyName) {
  const total = (po.total_amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  return `📋 *Purchase Order from ${companyName}*\n\nHi ${supplierName},\n\nPO #${po.po_number || po.poNumber}\nAmount: ₹${total}\nDate: ${new Date(po.order_date || po.date).toLocaleDateString('en-IN')}\n\nPlease process at your earliest.`;
}

function buildPaymentReminder(invoice, customerName, companyName) {
  const total = (invoice.total_amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : 'N/A';
  const daysOverdue = invoice.due_date ? Math.floor((new Date() - new Date(invoice.due_date)) / (1000*60*60*24)) : 0;
  const urgency = daysOverdue > 0 ? ` (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue)` : '';
  return `⏰ *Payment Reminder from ${companyName}*\n\nHi ${customerName},\n\nInvoice #${invoice.invoice_number || invoice.invoiceNumber} of ₹${total} was due on ${dueDate}${urgency}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
}

module.exports = { sendWhatsApp, buildInvoiceMessage, buildPOMessage, buildPaymentReminder };
