const db = require('../config/db');
const { sendWhatsApp, buildPaymentReminder } = require('../utils/whatsapp');
const { logWhatsApp } = require('../utils/whatsappLogger');

async function sendWhatsAppReminders() {
  console.log('[WhatsApp Cron] Checking for due invoice reminders...');
  try {
    const [tenants] = await db.query(
      `SELECT id, company_name, settings
       FROM hris_saas.tenants
       WHERE settings::jsonb->>'whatsappEnabled' = 'true'
         AND settings::jsonb->>'whatsappPhone' IS NOT NULL
         AND settings::jsonb->>'whatsappPhone' != ''`
    );

    for (const tenant of tenants) {
      const settings = typeof tenant.settings === 'string'
        ? JSON.parse(tenant.settings) : (tenant.settings || {});
      const remindDays = settings.remindDays || 1;

      const [invoices] = await db.query(
        `SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
                c.name as customer_name, c.phone as customer_phone
         FROM hris_saas.invoices i
         JOIN hris_saas.customers c ON i.customer_id = c.id
         WHERE i.tenant_id = $1
           AND i.status IN ('sent', 'partial')
           AND i.due_date <= CURRENT_DATE + $2::integer
           AND i.due_date >= CURRENT_DATE
           AND c.phone IS NOT NULL AND c.phone != ''
           AND NOT EXISTS (
             SELECT 1 FROM hris_saas.whatsapp_logs wl
             WHERE wl.tenant_id = i.tenant_id
               AND wl.entity_type = 'payment_reminder'
               AND wl.entity_id = i.id
               AND wl.sent_at >= CURRENT_DATE
           )`,
        [tenant.id, remindDays]
      );

      for (const inv of invoices) {
        const message = buildPaymentReminder(inv, inv.customer_name, tenant.company_name);
        const result = await sendWhatsApp({ to: inv.customer_phone, body: message });
        await logWhatsApp({
          tenantId: tenant.id,
          entityType: 'payment_reminder',
          entityId: inv.id,
          recipient: inv.customer_phone,
          message,
          status: result.sent ? 'sent' : 'failed',
          errorMessage: result.error,
        });
        if (result.sent) {
          console.log(`[WhatsApp Cron] Reminder sent for invoice ${inv.invoice_number} (${tenant.id})`);
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Cron] Error:', error.message);
  }
}

function startWhatsAppCron(intervalMs = 86400000) {
  console.log(`[WhatsApp Cron] Started (interval: ${intervalMs}ms)`);
  sendWhatsAppReminders();
  setInterval(sendWhatsAppReminders, intervalMs);
}

module.exports = { startWhatsAppCron, sendWhatsAppReminders };
