const express = require('express');
const router = express.Router();
const invoice = require('../controllers/invoice.controller');
const reconciliation = require('../controllers/paymentReconciliation.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, invoice.list);
router.get('/:id', authenticateToken, invoice.get);
router.get('/:id/pdf', authenticateToken, invoice.downloadPDF);
router.post('/', authenticateToken, invoice.create);
router.put('/:id', authenticateToken, invoice.update);
router.patch('/:id/status', authenticateToken, invoice.updateStatus);
router.post('/:id/email', authenticateToken, invoice.sendEmail);
router.delete('/:id', authenticateToken, invoice.remove);

// Bulk operations
router.post('/bulk/delete', authenticateToken, invoice.bulkDelete);
router.post('/bulk/export', authenticateToken, invoice.bulkExportExcel);

// Payment Reconciliation
router.get('/:id/payments', authenticateToken, reconciliation.listPayments);
router.post('/:id/payments', authenticateToken, reconciliation.recordPayment);
router.delete('/:id/payments/:paymentId', authenticateToken, reconciliation.deletePayment);

module.exports = router;
