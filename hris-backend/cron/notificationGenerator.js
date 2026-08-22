const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function toRupees(paise) {
  return Math.abs(Math.round((paise || 0) / 100)).toLocaleString('en-IN');
}

async function tenantAdminId(tenantId) {
  const [rows] = await db.query(
    `SELECT id FROM employees WHERE tenant_id = ? AND role = 'tenant_admin' LIMIT 1`,
    [tenantId]
  );
  return rows[0]?.id || null;
}

async function alreadyCreated(tenantId, recipientId, type, entityType, entityId, day) {
  const [rows] = await db.query(
    `SELECT id FROM notifications
     WHERE tenant_id = ? AND recipient_id = ? AND type = ?
       AND COALESCE(entity_type,'') = COALESCE(?, '')
       AND COALESCE(entity_id,'') = COALESCE(?, '')
       AND created_at::date = ?::date
     LIMIT 1`,
    [tenantId, recipientId, type, entityType || null, entityId || null, day]
  );
  return rows.length > 0;
}

async function insertNotif({ tenantId, recipientId, title, message, type, entityType, entityId }) {
  const day = fmtDate(new Date());
  if (await alreadyCreated(tenantId, recipientId, type, entityType, entityId, day)) return;
  await db.query(
    `INSERT INTO notifications (id, tenant_id, recipient_id, title, message, type, entity_type, entity_id, actor_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), tenantId, recipientId, title, message, type, entityType || null, entityId || null, 'System']
  );
}

async function processTenant(tenantId) {
  const recipientId = await tenantAdminId(tenantId);
  if (!recipientId) return;

  // ── 1. Buyer payment overdue by 15 days ──
  const [buyers] = await db.query(
    `SELECT p.id, p.name, p.phone,
            (COALESCE(p.opening_balance,0) + COALESCE(g.total_given,0) - COALESCE(r.total_received,0)) AS balance,
            COALESCE(lt.last_date, CURRENT_DATE - INTERVAL '100 days') AS last_date
     FROM kirana_parties p
     LEFT JOIN (SELECT party_id, SUM(amount) total_given FROM kirana_transactions WHERE tenant_id = ? AND type='given' GROUP BY party_id) g ON g.party_id = p.id
     LEFT JOIN (SELECT party_id, SUM(amount) total_received FROM kirana_transactions WHERE tenant_id = ? AND type='received' GROUP BY party_id) r ON r.party_id = p.id
     LEFT JOIN (SELECT party_id, MAX(entry_date) last_date FROM kirana_transactions WHERE tenant_id = ? GROUP BY party_id) lt ON lt.party_id = p.id
     WHERE p.tenant_id = ? AND p.type = 'buyer'
       AND (COALESCE(p.opening_balance,0) + COALESCE(g.total_given,0) - COALESCE(r.total_received,0)) < 0
       AND COALESCE(lt.last_date, CURRENT_DATE - INTERVAL '100 days') <= CURRENT_DATE - INTERVAL '15 days'`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  for (const b of buyers) {
    await insertNotif({
      tenantId,
      recipientId,
      title: `Payment overdue from ${b.name}`,
      message: `₹${toRupees(b.balance)} is overdue by 15 days.`,
      type: 'buyerDue',
      entityType: 'buyer',
      entityId: b.id,
    });
  }

  // ── 2. Seller payment overdue ──
  const [sellers] = await db.query(
    `SELECT p.id, p.name, p.phone,
            (COALESCE(p.opening_balance,0) + COALESCE(g.total_given,0) - COALESCE(r.total_received,0)) AS balance,
            COALESCE(lt.last_date, CURRENT_DATE - INTERVAL '100 days') AS last_date
     FROM kirana_parties p
     LEFT JOIN (SELECT party_id, SUM(amount) total_given FROM kirana_transactions WHERE tenant_id = ? AND type='given' GROUP BY party_id) g ON g.party_id = p.id
     LEFT JOIN (SELECT party_id, SUM(amount) total_received FROM kirana_transactions WHERE tenant_id = ? AND type='received' GROUP BY party_id) r ON r.party_id = p.id
     LEFT JOIN (SELECT party_id, MAX(entry_date) last_date FROM kirana_transactions WHERE tenant_id = ? GROUP BY party_id) lt ON lt.party_id = p.id
     WHERE p.tenant_id = ? AND p.type = 'seller'
       AND (COALESCE(p.opening_balance,0) + COALESCE(g.total_given,0) - COALESCE(r.total_received,0)) > 0
       AND COALESCE(lt.last_date, CURRENT_DATE - INTERVAL '100 days') <= CURRENT_DATE - INTERVAL '15 days'`,
    [tenantId, tenantId, tenantId, tenantId]
  );
  for (const s of sellers) {
    await insertNotif({
      tenantId,
      recipientId,
      title: `Payment to ${s.name} is overdue`,
      message: `₹${toRupees(s.balance)} payment is overdue.`,
      type: 'sellerPayment',
      entityType: 'seller',
      entityId: s.id,
    });
  }

  // ── 3. Payroll due tomorrow ──
  const [payroll] = await db.query(
    `SELECT COUNT(DISTINCT a.employee_id) AS staff, COALESCE(SUM(a.total_hours),0) AS hours
     FROM attendance a
     WHERE a.tenant_id = ?
       AND a.total_hours > 0
       AND NOT EXISTS (
         SELECT 1 FROM payroll p
         WHERE p.tenant_id = a.tenant_id AND p.employee_id = a.employee_id
           AND p.status = 'paid' AND p.total_hours_worked > 0
           AND a.date >= p.pay_period_start AND a.date <= p.pay_period_end
       )`,
    [tenantId]
  );
  if (Number(payroll[0]?.staff || 0) > 0) {
    await insertNotif({
      tenantId,
      recipientId,
      title: 'Payroll due tomorrow',
      message: `${Number(payroll[0].hours).toFixed(1)}h unprocessed for ${payroll[0].staff} staff.`,
      type: 'payroll',
      entityType: 'payroll',
      entityId: 'current',
    });
  }

  // ── 4. Trial expires in 3 days ──
  const [trial] = await db.query(
    `SELECT id FROM tenants WHERE id = ? AND subscription_status = 'trialing' AND expiry_date::date = CURRENT_DATE + 3`,
    [tenantId]
  );
  if (trial.length > 0) {
    await insertNotif({
      tenantId,
      recipientId,
      title: 'Trial expires in 3 days',
      message: 'Your free trial expires in 3 days. Upgrade to keep using all features.',
      type: 'system',
      entityType: 'subscription',
      entityId: 'trial-expiry',
    });
  }

  // ── 5. Subscription expired ──
  const [expired] = await db.query(
    `SELECT id FROM tenants WHERE id = ? AND subscription_status = 'expired'`,
    [tenantId]
  );
  if (expired.length > 0) {
    await insertNotif({
      tenantId,
      recipientId,
      title: 'Subscription expired',
      message: 'Your subscription has expired. Renew now to continue using Bahi360.',
      type: 'system',
      entityType: 'subscription',
      entityId: 'expired',
    });
  }

  // ── 6. Attendance not marked today ──
  const [tenantRow] = await db.query(
    `SELECT settings FROM tenants WHERE id = ?`,
    [tenantId]
  );
  const settings = tenantRow[0]?.settings
    ? (typeof tenantRow[0].settings === 'string' ? JSON.parse(tenantRow[0].settings) : tenantRow[0].settings)
    : {};
  const weekendDays = Array.isArray(settings.weekendDays) ? settings.weekendDays : [0];
  const todayDow = new Date().getDay();
  if (!weekendDays.includes(todayDow)) {
    const [att] = await db.query(
      `SELECT COUNT(*) AS pending
       FROM employees e
       WHERE e.tenant_id = ? AND e.status = 'active' AND (e.role IS NULL OR e.role != 'tenant_admin')
         AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.tenant_id = e.tenant_id AND a.employee_id = e.id AND a.date = CURRENT_DATE)`,
      [tenantId]
    );
    if (Number(att[0]?.pending || 0) > 0) {
      await insertNotif({
        tenantId,
        recipientId,
        title: 'Attendance not marked for today',
        message: `${att[0].pending} staff haven't marked attendance today.`,
        type: 'attendance',
        entityType: 'attendance',
        entityId: 'today',
      });
    }
  }
}

async function generateNotifications() {
  try {
    const [tenants] = await db.query(`SELECT id FROM tenants`);
    for (const t of tenants) {
      try {
        await processTenant(t.id);
      } catch (err) {
        console.error(`[NotificationGen] Tenant ${t.id} error:`, err.message || err);
      }
    }
    console.log(`[NotificationGen] Completed scan of ${tenants.length} tenant(s).`);
  } catch (error) {
    console.error('[NotificationGen] Error:', error.message || error);
  }
}

function startNotificationCron(intervalMs = 3600000) {
  console.log(`[NotificationGen] Started (interval: ${intervalMs}ms)`);
  generateNotifications();
  return setInterval(generateNotifications, intervalMs);
}

module.exports = { startNotificationCron, generateNotifications };
