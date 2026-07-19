const db = require('../config/db');

async function markOverdue() {
  try {
    const [result] = await db.query(
      `UPDATE hris_saas.transactions
       SET status = 'overdue', updated_at = NOW()
       WHERE transaction_type IN ('sales_invoice', 'purchase_invoice', 'payment_in', 'payment_out')
         AND status IN ('sent', 'partial', 'unpaid')
         AND due_date < CURRENT_DATE
         AND cancelled_at IS NULL`
    );
    if (result.rowCount > 0) {
      console.log(`[OverdueCheck] Marked ${result.rowCount} transaction(s) as overdue.`);
    }
  } catch (error) {
    console.error('[OverdueCheck] Error:', error.message || error);
  }
}

function startOverdueCron(intervalMs = 3600000) {
  console.log(`[OverdueCheck] Started (interval: ${intervalMs}ms)`);
  markOverdue();
  return setInterval(markOverdue, intervalMs);
}

module.exports = { startOverdueCron, markOverdue };
