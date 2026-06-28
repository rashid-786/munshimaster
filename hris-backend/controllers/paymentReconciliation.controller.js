const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.recordPayment = async (req, res) => {
  const tenantId = req.tenantId;
  const invoiceId = req.params.id;
  const { amount, payment_method, payment_date, reference, notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0.' });
  }
  if (!payment_date) {
    return res.status(400).json({ error: 'Payment date is required.' });
  }

  try {
    const [invs] = await db.query(
      'SELECT id, total_amount, amount_paid, status FROM invoices WHERE id = ? AND tenant_id = ?',
      [invoiceId, tenantId]
    );
    if (invs.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const inv = invs[0];
    const newAmountPaid = Number(inv.amount_paid) + Number(amount);
    const totalAmount = Number(inv.total_amount);

    const paymentId = uuidv4();
    await db.query(
      `INSERT INTO invoice_payments (id, tenant_id, invoice_id, amount, payment_method, payment_date, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, tenantId, invoiceId, amount, payment_method || 'cash', payment_date, reference || null, notes || null, req.user?.id || null]
    );

    // Determine new status
    let newStatus = inv.status;
    if (newAmountPaid >= totalAmount) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    }

    await db.query(
      'UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ? AND tenant_id = ?',
      [newAmountPaid, newStatus, invoiceId, tenantId]
    );

    // Optionally create a balance sheet entry for the payment
    const refText = reference ? ` (Ref: ${reference})` : '';
    const bsId = uuidv4();
    await db.query(
      `INSERT INTO balance_sheet (id, tenant_id, type, payment_method, amount, description, entry_date, created_by)
       VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)`,
      [bsId, tenantId, payment_method || 'cash', amount,
       `Payment received for Invoice #${inv.invoice_number || invoiceId}${refText}`,
       payment_date, req.user?.id || null]
    );

    const [payment] = await db.query('SELECT * FROM invoice_payments WHERE id = ?', [paymentId]);

    res.status(201).json({
      message: 'Payment recorded successfully.',
      payment: payment[0],
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, totalAmount - newAmountPaid),
      status: newStatus,
    });
  } catch (error) {
    console.error('recordPayment error:', error);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
};

exports.listPayments = async (req, res) => {
  const tenantId = req.tenantId;
  const invoiceId = req.params.id;

  try {
    const [payments] = await db.query(
      `SELECT * FROM invoice_payments WHERE tenant_id = ? AND invoice_id = ? ORDER BY payment_date DESC, created_at DESC`,
      [tenantId, invoiceId]
    );
    res.json(payments || []);
  } catch (error) {
    console.error('listPayments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
};

exports.deletePayment = async (req, res) => {
  const tenantId = req.tenantId;
  const invoiceId = req.params.id;
  const paymentId = req.params.paymentId;

  try {
    const [payments] = await db.query(
      'SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ? AND tenant_id = ?',
      [paymentId, invoiceId, tenantId]
    );
    if (payments.length === 0) return res.status(404).json({ error: 'Payment not found.' });

    const payment = payments[0];
    const amount = Number(payment.amount);

    await db.query(
      'DELETE FROM invoice_payments WHERE id = ? AND invoice_id = ? AND tenant_id = ?',
      [paymentId, invoiceId, tenantId]
    );

    // Also delete the corresponding balance sheet entry
    await db.query(
      "DELETE FROM balance_sheet WHERE tenant_id = ? AND description LIKE ? AND amount = ? AND type = 'IN'",
      [tenantId, `%${invoiceId}%`, amount]
    );

    // Recalculate invoice amount_paid and status
    const [remaining] = await db.query(
      'SELECT COALESCE(SUM(amount),0) as total FROM invoice_payments WHERE invoice_id = ? AND tenant_id = ?',
      [invoiceId, tenantId]
    );
    const newAmountPaid = Number(remaining[0].total);

    const [invs] = await db.query(
      'SELECT total_amount, status FROM invoices WHERE id = ? AND tenant_id = ?',
      [invoiceId, tenantId]
    );
    if (invs.length > 0) {
      const totalAmount = Number(invs[0].total_amount);
      let newStatus = invs[0].status;
      if (newAmountPaid >= totalAmount) {
        newStatus = 'paid';
      } else if (newAmountPaid > 0) {
        newStatus = 'partial';
      } else if (newAmountPaid === 0 && invs[0].status === 'paid') {
        newStatus = 'sent';
      }

      await db.query(
        'UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ? AND tenant_id = ?',
        [newAmountPaid, newStatus, invoiceId, tenantId]
      );
    }

    res.json({ message: 'Payment deleted successfully.', amountPaid: newAmountPaid });
  } catch (error) {
    console.error('deletePayment error:', error);
    res.status(500).json({ error: 'Failed to delete payment.' });
  }
};
