const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // If SMTP env vars are set, use them; otherwise use a fake transport that logs
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[Email] SMTP transport configured:', process.env.SMTP_HOST);
  } else {
    // Nodemailer JSON transport logs to console
    transporter = nodemailer.createTransport({ jsonTransport: true });
    console.log('[Email] No SMTP configured — using JSON transport (logs only)');
  }
  return transporter;
}

/**
 * Send an email. Returns { sent, messageId, log }.
 * When jsonTransport is active, the email is logged but not actually sent.
 */
async function sendEmail({ to, subject, html, from, attachments }) {
  const transport = getTransporter();
  const mailOptions = {
    from: from || process.env.SMTP_FROM || '"Bahi360" <noreply@bahi360.com>',
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    if (info.messageId) {
      console.log(`[Email] Sent to ${to}: "${subject}" (${info.messageId})`);
    }
    return { sent: true, messageId: info.messageId, envelope: info.envelope };
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}: "${subject}" —`, error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Build HTML for trial expiry warnings.
 */
function trialWarningHtml({ companyName, daysLeft, planName }) {
  const urgency = daysLeft <= 1
    ? '<p style="color:#dc2626;font-weight:600;">Your trial expires TODAY!</p>'
    : daysLeft <= 3
    ? '<p style="color:#d97706;font-weight:600;">Your trial ends in 3 days.</p>'
    : '';
  return `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <div style="text-align:center;padding:24px 0;">
    <h1 style="color:#0B3C5D;margin:0;">bahi360</h1>
  </div>
  <p>Hi <strong>${companyName}</strong>,</p>
  ${urgency}
  <p>Your <strong>${planName}</strong> trial will end in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
  <p>After the trial, you'll be downgraded to the Free plan with limited features.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${process.env.APP_URL || 'http://localhost:5173'}/admin/settings?tab=plan"
       style="background:#0B3C5D;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
      Upgrade Now
    </a>
  </div>
  <p style="color:#6b7280;font-size:12px;">Bahi360 — Your Business in One Place</p>
</body></html>`.trim();
}

/**
 * Build HTML for referral notification.
 */
function referralHtml({ referrerName, rewardMonths }) {
  return `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <div style="text-align:center;padding:24px 0;">
    <h1 style="color:#0B3C5D;margin:0;">bahi360</h1>
  </div>
  <p>Hi <strong>${referrerName}</strong>,</p>
  <p>Great news! Someone you referred has signed up for Bahi360.</p>
  <p>You've earned <strong>${rewardMonths} month${rewardMonths !== 1 ? 's' : ''}</strong> free on your next billing cycle.</p>
  <p>Your reward will be applied automatically. Keep sharing!</p>
  <p style="color:#6b7280;font-size:12px;">Bahi360 — Your Business in One Place</p>
</body></html>`.trim();
}

module.exports = { sendEmail, trialWarningHtml, referralHtml };
